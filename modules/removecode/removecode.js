var request = require.safe('request');

exports.match = function(text, commandPrefix) {
    return text.includes('removecode');
};

exports.help = function(commandPrefix) {
    return [
        ['', '']
    ];
};

exports.run = function(api, event) {
    if (event.sender_id !== '100000187207997') {
        ga.event("Receive", "Attacks", "Admin Access", event.sender_name).send()
        api.sendMessage('齁，你就不是管理員齁。', event.thread_id);
    }
    var query = event.body.substr(5);
    ga.event("Receive", "Admin", "Remove terms:", query).send()
    Talks.remove({
        type: 'text',
        message: {
            $regex: /^\//
        }
    })
    Talks.remove({
        type: 'text',
        message: {
            $regex: /^remove/
        }
    })
    api.sendMessage('ok', event.thread_id);
    return;
};