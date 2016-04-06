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
var defaultMessage = require('./default.js');
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
Platform.prototype.messageRxd = function(api, event) {
    if (console.isDebug() && event.sender_id !== '100000187207997') {
        return;
    }
    if (event.event && event.event.attachments && event.event.attachments[0] && event.event.attachments[0].type === 'sticker') {
        ga.event("Receive", "Sticker", event.event.attachments[0].stickerID).send()
        Talks.insert({
            type: 'sticker',
            message: event.event.attachments[0].stickerID
        })
        return Talks.aggregate([{
            $match: {
                type: 'sticker'
            }
        }, {
            $sample: {
                size: 1
            }
        }], function(err, message) {
            return api.sendSticker({
                sticker: message[0].message
            }, event.thread_id);
        })
    }
    var matchArgs = [event.body, api.commandPrefix, event.thread_id, event.sender_name],
        runArgs = [api, event];
    var moduleLength = this.loadedModules.length;
    var falseCount = 0;
    var handleTransactionFunction = this.handleTransaction
    var modules = this.loadedModules;
    var isGroup = event.event.isGroup;
    return redisClient
        .multi()
        .incr(event.thread_id)
        .expire(event.thread_id, 120)
        .exec()
        .then(function(value) {
            if (value && value[0] && value[0][1] >= 5) {
                return redisClient
                    .multi()
                    .decr(event.thread_id)
                    .expire(event.thread_id, 120)
                    .exec();
                if (value[0][1] > 6) {
                    console.log('ga-attacks-dos')
                    ga.event("Receive", "Attacks_possible_DOS", event.sender_name).send()
                    return redisClient
                        .multi()
                        .set(event.thread_id, 0)
                        .expire(event.thread_id, 120)
                        .exec();
                }
            }
            // Run user modules in protected mode
            for (var i = 0; i < moduleLength; i++) {
                var matchResult = false;
                try {
                    matchResult = modules[i].match.apply(modules[i], matchArgs);
                } catch (e) {
                    console.error('The module ' + modules[i].name + ' appears to be broken. Please remove or fix it.');
                    console.critical(e);
                    continue;
                }
                if (matchResult) {
                    try {
                        handleTransactionFunction(modules[i], runArgs);
                    } catch (e) {
                        api.sendMessage(event.body + ' fucked up. Damn you ' + event.sender_name + ".", event.thread_id, event);
                        console.critical(e);
                    }
                    return;
                } else {
                    falseCount++;
                }
            }
            if (falseCount === moduleLength) {
                api.sendTyping(event.thread_id);
                defaultMessage(event.body, function(response) {
                    if (response.type === 'sticker') {
                        console.log('ga-sticker-content')
                        ga.event("Answer", "Sticker", response).send()
                        api.sendSticker({
                            sticker: response.message
                        }, event.thread_id);
                    } else {
                        if (response.type === 'text') {
                            response = response.message
                        }
                        console.log('ga-message-content')
                        ga.event("Answer", "Message", response).send()
                        api.sendMessage(response, event.thread_id);
                    }
                })
                return;
            }
        })
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