var fb = require("facebook-chat-api"),
	fs = require("fs"),
	shim = require.once("../shim.js"),
	stopListeningMethod = null,
	platform = null,
	endTyping = null,
	platformApi = null;

var async = require('async');
var _ = require('lodash');

exports.start = function(callback) {
	var page = {};
	if (this.config.pageID) {
		page.pageID = this.config.pageID;
	}
	fb({
		email: this.config.username,
		password: this.config.password
	}, page, function(err, api) {
		if (err) {
			console.error(err);
			process.exit(-1);
		}
		api.setOptions({
			listenEvents: true
		});
		platformApi = api;

		platform = shim.createPlatformModule({
			commandPrefix: exports.config.commandPrefix,
			sendSticker: function(id, thread) {
				if (!id || !id.sticker) {
					id = {
						sticker: 1604284059801367
					};
				}
				api.sendMessage(id, thread);
			},
			sendMessage: function(message, thread) {
				if (endTyping != null) {
					endTyping();
					endTyping = null;
				}
				setTimeout(function() {
					api.sendMessage({
						body: message
					}, thread);
				}, message.length * 100 + Math.floor(Math.random() * 2) * 1000)
			},
			sendDebugMessage: function(message, thread) {
				if (endTyping != null) {
					endTyping();
					endTyping = null;
				}
				api.sendMessage({
					body: message
				}, thread);
			},
			sendUrl: function(url, thread) {
				if (endTyping != null) {
					endTyping();
					endTyping = null;
				}
				api.sendMessage({
					body: url,
					url: url
				}, thread);
			},
			sendImage: function(type, image, description, thread) {
				if (endTyping != null) {
					endTyping();
					endTyping = null;
				}
				switch (type) {
					case "url":
						api.sendMessage({
							body: description,
							url: image
						}, thread, function(err, messageInfo) {
							console.log(err)
							if (err) {
								api.sendMessage(description + " " + image, thread);
							}
						});
						break;
					case "file":
						api.sendMessage({
							body: description,
							attachment: fs.createReadStream(image)
						}, thread);
						break;
					default:
						api.sendMessage(description, thread);
						api.sendMessage(image, thread);
						break;
				}
			},
			sendFile: this.sendImage,
			sendTyping: function(thread) {
				if (endTyping != null) {
					endTyping();
					endTyping = null;
				}
				api.sendTypingIndicator(thread, function(err, end) {
					if (!err) {
						endTyping = end;
					}
				});
			},
			setTitle: function(title, thread) {
				if (endTyping != null) {
					endTyping();
					endTyping = null;
				}
				api.setTitle(title, thread);
			}
		});

		var stopListening = api.listen(function(err, event) {
			if (err) {
				stopListening();
				console.error(err);
				process.exit(-1);
			}
			stopListeningMethod = function() {
				stopListening();
				api.logout();
			};
			switch (event.type) {
				case "message":
					{
						var data = shim.createEvent(event.threadID, event.senderID, event.senderName, event.body, event);
						callback(platform, data);
						break;
					}
				case "inbox":
					{
						var events = [];
						var ids = [];
						api.getMessageRequests(0, 1, function(err, threads) {
							if (!_.isEmpty(threads)) {
								console.log('ga-request-message')
								ga.event("Receive", "MessageRequest", event.snippetSender).send()
								ids = _.map(threads, function(thread) {
									return thread.snippetSender;
								})
								async.each(threads, function(thread, callback) {
									api.getThreadHistory(thread.threadID, 0, 1, Date.now(), function(err, messageRequests) {
										events = _.concat(events, messageRequests);
										callback();
									})
								}, function(err) {
									if (err) {
										console.log(err);
									}
									api.acceptMessageRequest(ids, function() {
										_.each(events, function(event) {
											var data = shim.createEvent(event.threadID, event.senderID, event.senderName, event.body, event);
											callback(platform, data);
										})
									});
								});
							}
						})
						break;
					}
			}
		});
	});
};

exports.stop = function() {
	if (endTyping != null) {
		endTyping();
		endTyping = null;
	}
	stopListeningMethod();
	platformApi.logout();
	platform = null;
};