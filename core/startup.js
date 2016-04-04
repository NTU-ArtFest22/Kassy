/**
 * Handles the startup of Kassy.
 *
 * Written By:
 *         Matthew Knox
 *
 * Contributors:
 *         Dion Woolley
 *         Jay Harris
 *         Matt Hartstonge
 *         (Others, mainly strange people)
 *
 * License:
 *        MIT License. All code unless otherwise specified is
 *        Copyright (c) Matthew Knox and Contributors 2015.
 */

var selectedModes = null,
    startNewPlatform = function() {
        try {
            var Platform = require.once('./platform.js'),
                platform = new Platform(selectedModes);
            platform.setOnShutdown(checkShutdownCode);
            platform.start();
        } catch (e) {
            console.critical(e);
            console.log(e.codeFrame);
            console.error('A critical error occurred while running. Please check your configuration or report a bug.');
            process.exit(-3);
        }
    },
    checkShutdownCode = function(code) {
        if (code === StatusFlag.ShutdownShouldRestart) {
            startNewPlatform();
        }
    };

exports.run = function(modes) {
    var Redis = require('ioredis');
    var mongojs = require('mongojs')
    var db = mongojs('ntuaf', ['jokes', 'talks'])
    var ua = require('universal-analytics');
    global.ga = ua('UA-68973533-6');
    global.Jokes = db.jokes;
    global.Talks = db.talks;
    global.redisClient = new Redis({
        host: 'localhost',
        port: '6379'
    });
    redisClient.flushdb();
    selectedModes = modes;
    startNewPlatform();
};