var reddit = require('./../common/reddit.js'),
    request = require.safe('request'),
    results = [];

exports.match = function(text, commandPrefix) {
    return text.startsWith(commandPrefix + '笑話');
};

exports.help = function(commandPrefix) {
    return [
        [commandPrefix + 'joke', 'A mixed bag of fun.']
    ];
};

exports.joke = function(callback) {
    // If we have no stored joke, get some
    Jokes.aggregate([{
        $sample: {
            size: 1
        }
    }], function(err, message) {
        var content = message[0].url;
        console.log(content)
        callback(content || response);
    })
};

exports.fuckNode = function(callback) {
    // Get some random joke

    var index = Math.floor(Math.random() * results.length),
        title = results[index].data.title,
        text = results[index].data.selftext;

    // Delete the joke, so we don't get it again
    results.splice(index, 1);

    callback(title + '\n' + text);
};

exports.run = function(api, event) {
    ga.event("Receive", "Jokes", "content", event.body).send()
    exports.joke(function(result) {
            api.sendMessage(result, event.thread_id);
        },
        function() {
            api.sendTyping(event.thread_id);
        });
};