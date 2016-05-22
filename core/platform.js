/**
 * Main platform. Handles the core interop of the program and
 * acts as the glue code for the various parts of the code.
 *
 * Written By:
 *         Matthew Knox
 *
 * License:
 *        MIT License. All code unless otherwise specified is
 *        Copyright (c) Matthew Knox and Contributors 2015.
 */
var figlet = require('figlet');
var request = require('request');
var EventEmitter = require('events');
var _ = require('lodash');
var moment = require('moment');
var messageEvent = new EventEmitter();

var matchList = {};
var singleList = [];
var lonelyIndex = [];

Platform = function(modes) {
    require.reload('./prototypes.js');
    this.config = require('./config.js');
    this.loadedModules = [];
    this.modes = null;
    this.defaultPrefix = '';
    this.packageInfo = require.once('../package.json');
    this.modules = require.once('./modules.js');
    this.statusFlag = StatusFlag.NotStarted;
    this.onShutdown = null;
    this.waitingTime = 2500;
    this.packageInfo.name = this.packageInfo.name.toProperCase();
    this.setModes(modes);
};
Platform.prototype.handleTransaction = function(module, args) {
    var returnVal = true,
        timeout = setTimeout(function() {
            if (returnVal !== true) {
                return;
            }
            args[0].sendTyping(args[1].thread_id);
        }, this.waitingTime);
    returnVal = module.run.apply(module, args);
    clearTimeout(timeout);
};


function getMessage(event, thread, api, eventId) {
    return request.post({
        url: 'http://localhost:3500/message',
        form: event.event
    }, function(err, response, body) {
        api.sendTyping(thread);
        body = JSON.parse(body);
        if (body.type === 'sticker') {
            return api.sendSticker({
                sticker: body.content
            }, thread);
        } else if (body.type === 'message') {
            return api.sendMessage(body.content, thread);
        } else if (body.type === 'photo') {
            return api.sendFile('url', body.content, thread);
        } else if (body.type === 'file') {
            return api.sendFile('url', body.content, thread);
        }
    })
}

function cleanMatchingList(thread) {
    console.log('cleaning matching list for ' + thread)
    matchList[matchList[thread].thread] = null;
    matchList[thread] = null;
}

Platform.prototype.messageRxd = function(api, event) {
    if (console.isDebug() && event.sender_id !== '100000187207997' && event.sender_id !== '100012106154442') {
        return;
    }
    if (event.sender_id === '100012106154442' || event.sender_id === '100011651739263') {
        return;
    }
    var timeoutCallback = function() {
        console.log('match response')
        clearTimeout(timer);
    }
    var thread = event.thread_id;
    messageEvent.once('sending_to_' + thread, timeoutCallback)
    var timer = setTimeout(function() {
        console.log('timeout')
        lonelyIndex[thread] += 1
        if (lonelyIndex[thread] > 10) {
            cleanMatchingList(thread)
        }
        messageEvent.removeListener('sending_to_' + thread, timeoutCallback)
        return getMessage(event, thread, api);
    }, 10000);
    if (!matchList[thread]) {
        console.log('not matched, start matching');
        if (!_.isEmpty(singleList) && !_.includes(singleList, thread)) {
            var now = moment();
            var match = singleList.shift();
            matchList[match] = {
                thread: thread,
                time: now
            };
            matchList[thread] = {
                thread: match,
                time: now
            };
            lonelyIndex[thread] = 0;
            console.log('matched');
        } else if (!_.includes(singleList, thread)) {
            singleList.push(thread)
            console.log('single');
        } else {
            clearTimeout(timer);
            messageEvent.removeListener('sending_to_' + thread, timeoutCallback)
            return getMessage(event, thread, api);
        }
    }
    var now = moment();
    var diff = now.diff(matchList[thread], 'minutes')
    console.log(diff)
    if (diff > 15) {
        cleanMatchingList(thread);
    }
    var message = event.event;
    if (matchList[thread]) {
        console.log('send matched message');
        lonelyIndex[matchList[thread].thread] = 0
        if (message && message.attachments && message.attachments[0] && message.attachments[0].type === 'sticker') {
            ga.event("Answer", "MatchingSticker", message.attachments[0].stickerID).send()
            Talks.insert({
                type: 'sticker',
                message: message.attachments[0].stickerID
            })
            messageEvent.emit('sending_to_' + matchList[thread].thread)
            return api.sendSticker({
                sticker: message.attachments[0].stickerID
            }, matchList[thread].thread);
        } else if (message && message.attachments && message.attachments[0] && message.attachments[0].type === 'photo') {
            return api.sendFile(
                'url',
                message.attachments[0].hiresUrl,
                thread);
        } else if (message && message.attachments && message.attachments[0] && message.attachments[0].type === 'file') {
            return api.sendFile(
                'url',
                message.attachments[0].url,
                thread);
        } else {
            messageEvent.emit('sending_to_' + matchList[thread].thread)
            ga.event("Answer", "MatchingMessage", message.body).send()
            return api.sendMessage(message.body, matchList[thread].thread);
        }
    }
};
Platform.prototype.setModes = function(modes) {
    try {
        if (this.statusFlag !== StatusFlag.NotStarted) {
            throw 'Cannot change mode when it is already started.';
        }
        this.modes = [];
        for (var i = 0; i < modes.length; i++) {
            var mode = {
                instance: require.once('./output/' + modes[i]),
                name: modes[i]
            };
            this.modes.push(mode);
        }
        return true;
    } catch (e) {
        console.critical(e);
        console.error('Loading the output mode file \'' + modes[i] + '\' failed.' +
            '\n\nIf this is your file please ensure that it is syntactically correct.');
        return false;
    }
};
Platform.prototype.start = function() {
    if (this.statusFlag !== StatusFlag.NotStarted) {
        throw 'Cannot start platform when it is already started.';
    }
    if (!this.modes.length) {
        throw 'Modes must be set before starting';
    }
    console.title(figlet.textSync(this.packageInfo.name.toProperCase()));
    console.title(' ' + this.packageInfo.version);
    console.info('------------------------------------');
    console.warn('Starting system...\n' + 'Loading system configuration...');
    this.modules.disabledConfig = this.config.loadDisabledConfig();
    for (var i = 0; i < this.modes.length; i++) {
        this.modes[i].instance.platform = this;
        this.modes[i].instance.config = this.config.loadOutputConfig(this.modes[i].name);
        if (!this.modes[i].instance.config.commandPrefix) {
            this.modes[i].instance.config.commandPrefix = this.defaultPrefix;
        }
    }
    // Load Kassy modules
    console.warn('Loading modules...');
    m = this.modules.listModules();
    for (var mod in m) {
        var ld = this.modules.loadModule(m[mod]);
        if (ld !== null) {
            this.loadedModules.push(ld);
        }
    }
    // Starting output
    console.warn('Starting integrations...');
    for (var i = 0; i < this.modes.length; i++) {
        try {
            console.write("Loading output '" + this.modes[i].name + "'...\t");
            this.modes[i].instance.start(this.messageRxd.bind(this));
            console.info("[DONE]");
        } catch (e) {
            console.error("[FAIL]");
            console.debug("Failed to start output integration '" + this.modes[i].name + "'.");
            console.critical(e);
        }
    }
    this.statusFlag = StatusFlag.Started;
    console.warn('System has started. ' + 'Hello World!'.rainbow);
};
Platform.prototype.shutdown = function(flag) {
    if (this.statusFlag !== StatusFlag.Started) {
        throw 'Cannot shutdown platform when it is not started.';
    }
    if (!flag) {
        flag = 0;
    }
    // Stop output modes
    for (var i = 0; i < this.modes.length; i++) {
        try {
            this.modes[i].instance.stop();
        } catch (e) {
            console.debug("Failed to correctly stop output mode '" + this.modes[i] + "'.");
            console.critical(e);
        }
    }
    // Unload user modules
    for (var i = 0; i < this.loadedModules.length; i++) {
        if (this.loadedModules[i].unload) {
            this.loadedModules[i].unload();
        }
        this.loadedModules[i] = null;
    }
    this.loadedModules = [];
    this.config.saveConfig();
    this.statusFlag = flag ? flag : StatusFlag.Shutdown;
    console.warn(this.packageInfo.name + " has shutdown.");
    if (this.onShutdown && this.onShutdown != null) {
        this.onShutdown(this.statusFlag);
    }
};
Platform.prototype.setOnShutdown = function(onShutdown) {
    this.onShutdown = onShutdown;
};
module.exports = Platform;