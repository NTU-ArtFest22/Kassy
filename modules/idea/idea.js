var request = require.safe('request');

exports.match = function(text, commandPrefix) {
    return text.startsWith(commandPrefix + '點子');
};

exports.help = function(commandPrefix) {
    return [
        [commandPrefix + 'idea', 'Generates an idea for your next StartUp.']
    ];
};

exports.idea = function(callback) {
    request.get('http://itsthisforthat.com/api.php?json', function(error, response, body) {
        if (response.statusCode === 200 && response.body) {
            var idea = JSON.parse(response.body);

            if (idea) {
                callback(idea.this + '\nfor\n' + idea.that);
            } else {
                callback({
                    error: 'Well that was unexpected, api did not return an idea.'
                });
            }
        } else {
            callback({
                error: 'Whomever the system admin is around here, I demand that they should be fired.'
            });
        }
    });
};

exports.run = function(api, event) {
    ga.event("Receive", "Idea", event.body).send()
    exports.idea(function(result) {
        api.sendMessage(result, event.thread_id);
    });
};