import express from 'express';
import { app } from 'electron';
import socketio from 'socket.io';
import * as players from './players';
import * as teams from './teams';
import * as match from './match';
import * as config from './config';
import * as huds from './huds';
import * as path from 'path';
import * as gsi from './gamestate';
import * as csgo from './csgo';

export default function (router: express.Router, io: socketio.Server) {
    router.route('/api/players')
        .get(players.getPlayers)
        .post(players.addPlayer);

    router.route('/api/players/:id')
        .get(players.getPlayers)
        .patch(players.updatePlayer)
        .delete(players.deletePlayer);

    router.route('/api/players/avatar/:id')
        .get(players.getAvatarFile);

    router.route('/api/players/avatar/steamid/:steamid')
        .get(players.getAvatarURLBySteamID);

    router.route('/api/teams')
        .get(teams.getTeams)
        .post(teams.addTeam);

    router.route('/api/teams/:id')
        .get(teams.getTeam)
        .patch(teams.updateTeam)
        .delete(teams.deleteTeam);

    router.route('/api/teams/logo/:id')
        .get(teams.getLogoFile)

    router.route('/api/config')
        .get(config.getConfig)
        .patch(config.updateConfig);

    router.route('/api/match')
        .get(match.getMatches)
        .patch(match.setMatch(io));

    router.route('/api/huds')
        .get(huds.getHUDs)
        .post(huds.openHUDsDirectory);

    router.route('/api/huds/close')
        .post(huds.closeHUD);

    router.route('/api/huds/:hudDir/start')
        .post(huds.showHUD(io));

    router.route('/api/gsi')
        .get(gsi.checkGSIFile)
        .put(gsi.createGSIFile);

    router.route('/api/csgo')
        .get(csgo.getLatestData);

    router.route('/api/cfg')
        .get(csgo.checkCFGs)
        .put(csgo.createCFGs);

    router.route('/huds/:dir/')
        .get(huds.renderHUD);

    router.use('/huds/:dir/', huds.renderAssets);

    router.route('/huds/:dir/thumbnail')
        .get(huds.renderThumbnail);




    /**
     * LEGACY ROUTING
     */
    router.route('/legacy/:hudName/index.js')
        .get(huds.legacyJS);

    router.route('/legacy/:hudName/style.css')
        .get(huds.legacyCSS);

    router.use('/', express.static(path.join(__dirname, '../static/legacy')))



    /**
     * END OF LEGACY ROUTING
     */

}