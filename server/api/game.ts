import fs from 'fs';
import path from 'path';
import { getGamePath } from 'steam-game-path';
import express from 'express';
import { loadConfig } from './config';
import { GSI } from '../sockets';
import { spawn } from 'child_process';
import { Config } from '../../types/interfaces';
import { AFXInterop } from '../../electron';

interface CFG {
    cfg: string,
    file: string
}

function createCFG(customRadar: boolean, customKillfeed: boolean): CFG {
    let cfg = `cl_draw_only_deathnotices 1`;
    let file = 'hud';

    if (!customRadar) {
        cfg += `\ncl_drawhud_force_radar 1`;
    } else {
        cfg += `\ncl_drawhud_force_radar 0`;
        file += '_radar';
    }
    if (customKillfeed) {
        file += '_killfeed';
        cfg += `\ncl_drawhud_force_deathnotices -1`;
        cfg += `\nmirv_pgl url "ws://localhost:31337/mirv"`;
        cfg += `\nmirv_pgl start`;
    }
    file += '.cfg';
    return { cfg, file };
}

function exists(file: string) {
    try {
        const GamePath = getGamePath(730);
        if (!GamePath || !GamePath.game || !GamePath.game.path) {
            return false;
        }
        const cfgDir = path.join(GamePath.game.path, 'csgo', 'cfg');
    
        return fs.existsSync(path.join(cfgDir, file));
    } catch {
        return false;
    }
}

function isCorrect(cfg: CFG) {
    try {
        const GamePath = getGamePath(730);
        if (!GamePath || !GamePath.game || !GamePath.game.path) {
            return false;
        }
        const file = cfg.file;
        const cfgDir = path.join(GamePath.game.path, 'csgo', 'cfg');
        return fs.readFileSync(path.join(cfgDir, file), 'UTF-8') === cfg.cfg;
    } catch {
        return false;
    }
}

export const checkCFGs: express.RequestHandler = async (req, res) => {
    let config: Config;
    let GamePath;
    try {
        config = await loadConfig();
        GamePath = getGamePath(730);
    } catch {
        return res.json({ success: false, message: "Game path couldn't be found", accessible: false});
    }
    if (!config || !GamePath || !GamePath.game || !GamePath.game.path) {
        return res.json({ success: false, message: "Game path couldn't be found", accessible: false});
    }

    const switcher = [true, false];
    const cfgs: CFG[] = [];
    const afx_interop_cfg: CFG = {
        cfg: 'afx_interop connect 1',
        file: 'hud_interop.cfg'
    }
    cfgs.push(afx_interop_cfg);
    switcher.forEach(radar => {
        switcher.forEach(killfeed => {
            cfgs.push(createCFG(radar, killfeed));
        });
    });
    const files = cfgs.map(cfg => cfg.file);

    if (!files.every(exists)) {
        return res.json({ success: false, message: 'Files are missing', accessible: true });
    }
    if (!cfgs.every(isCorrect)) {
        return res.json({ success: false, message: 'CFGs is incorrect', accessible: true })
    }
    return res.json({ success: true });
}

export const createCFGs: express.RequestHandler = async (_req, res) => {
    let GamePath;
    try {
        GamePath = getGamePath(730);
    } catch {
        return res.json({ success: false, message: 'Unexpected error occured' });
    }
    if (!GamePath || !GamePath.game || !GamePath.game.path) {
        return res.json({ success: false, message: 'Unexpected error occured' });
    }
    const cfgDir = path.join(GamePath.game.path, 'csgo', 'cfg');

    try {
        const switcher = [true, false];

        const cfgs: CFG[] = [];
        const afx_interop_cfg: CFG = {
            cfg: 'afx_interop connect 1',
            file: 'hud_interop.cfg'
        }
        cfgs.push(afx_interop_cfg);

        switcher.forEach(radar => {
            switcher.forEach(killfeed => {
                const cfg = createCFG(radar, killfeed);
                cfgs.push(cfg);
            });
        });
        for(const cfg of cfgs){
            
            const cfgPath = path.join(cfgDir, cfg.file);
            if (fs.existsSync(cfgPath)) {
                fs.unlinkSync(cfgPath);
            }
            fs.writeFileSync(cfgPath, cfg.cfg, 'UTF-8');
        }
        return res.json({ success: true, message: 'Configs were successfully saved' })
    } catch {
        return res.json({ success: false, message: 'Unexpected error occured' })
    }
}

export const getLatestData: express.RequestHandler = async (_req, res) => {
    return res.json(GSI.last || {});
}

export const getSteamPath: express.RequestHandler = async (_req, res) => {
    try {
        const GamePath = getGamePath(730);
        if(!GamePath || !GamePath.steam || !GamePath.steam.path){
            return res.status(404).json({success: false});
        }
        return res.json({success:true, steamPath: path.join(GamePath.steam.path, 'Steam.exe')});
    } catch {
        return res.status(404).json({success: false});
    }
}

export const run: express.RequestHandler = async (req, res) => {
    const config = await loadConfig();
    if(!config ||!req.query.config || typeof req.query.config !== "string"){
        return res.sendStatus(422);
    }
    let GamePath;
    try {
        GamePath = getGamePath(730);
    } catch {
        return res.sendStatus(404);
    }
    if(!GamePath || !GamePath.steam || !GamePath.steam.path || !GamePath.game || !GamePath.game.path){
        return res.sendStatus(404);
    }

    const HLAEPath = config.hlaePath;
    const GameExePath = path.join(GamePath.game.path, 'csgo.exe');

    const isHLAE = req.query.config.includes("killfeed");
    const exePath = isHLAE ? HLAEPath : path.join(GamePath.steam.path, "Steam.exe");

    if(isHLAE && (!HLAEPath || !fs.existsSync(HLAEPath))){
        return res.sendStatus(404);
    }

    const args = [];

    if(!isHLAE){
        args.push('-applaunch 730', `+exec ${req.query.config}`);
    } else {
        args.push('-csgoLauncher','-noGui', '-autoStart', `-csgoExe "${GameExePath}"`, `-customLaunchOptions "+exec ${req.query.config}"`);
    }

    try {
        const steam = spawn(`"${exePath}"`, args, { detached: true, shell: true, stdio: 'ignore' });
        steam.unref();
    } catch(e) {
        return res.sendStatus(500);
    }
    return res.sendStatus(200);
}
export const runExperimental: express.RequestHandler = async (req, res) => {
    const config = await loadConfig();
    if(!config){
        return res.sendStatus(422);
    }
    let GamePath;
    try {
        GamePath = getGamePath(730);
    } catch {
        return res.sendStatus(404);
    }
    if(!GamePath || !GamePath.steam || !GamePath.steam.path || !GamePath.game || !GamePath.game.path){
        return res.sendStatus(404);
    }

    const HLAEPath = config.hlaePath;
    const GameExePath = path.join(GamePath.game.path, 'csgo.exe');

    const exePath = HLAEPath;

    if(!HLAEPath || !fs.existsSync(HLAEPath) || !config.afxCEFHudInteropPath || !fs.existsSync(config.afxCEFHudInteropPath)){
        return res.sendStatus(404);
    }

    const args = [];

    const url = `http://localhost:${config.port}/hlae.html`;

    args.push('-csgoLauncher','-noGui', '-autoStart', `-csgoExe "${GameExePath}"`, '-gfxFull false', `-customLaunchOptions "-afxInteropLight +exec hud_interop"`);
    

    try {
        const steam = spawn(`"${exePath}"`, args, { detached: true, shell: true, stdio: 'ignore' });
        steam.unref();
        if(!AFXInterop.process){

            const process = spawn(`${config.afxCEFHudInteropPath}`, [`--url=${url}`], { stdio: 'ignore' });
            AFXInterop.process = process;
        }
    } catch(e) {
        return res.sendStatus(500);
    }
    return res.sendStatus(200);
}