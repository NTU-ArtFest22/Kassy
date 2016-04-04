var fb = require("facebook-chat-api"),
	fs = require("fs"),
	shim = require.once("../shim.js"),
	stopListeningMethod = null,
	platform = null,
	endTyping = null,
	platformApi = null;

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
				setTimeout(function() {
					api.sendMessage(id, thread);
					return redisClient
						.multi()
						.decr(thread)
						.expire(thread, 120)
						.exec()
				}, Math.floor(Math.random() * 10) * 1000)
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
					return redisClient
						.multi()
						.decr(thread)
						.expire(thread, 120)
						.exec()
				}, message.length * 100 + Math.floor(Math.random() * 20) * 0)
			},
			sendDebugMessage: function(message, thread) {
				if (endTyping != null) {
					endTyping();
					endTyping = null;
				}
				api.sendMessage({
					body: message
				}, thread);
				return redisClient
					.multi()
					.decr(thread)
					.expire(thread, 120)
					.exec()
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
				return redisClient
					.multi()
					.decr(thread)
					.expire(thread, 120)
					.exec()
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
				redisClient
					.multi()
					.decr(thread)
					.expire(thread, 120)
					.exec()
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