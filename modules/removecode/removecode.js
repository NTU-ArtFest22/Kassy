var request = require.safe('request');
var _ = require.safe('lodash');

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
    var query = event.body.substr(11);
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
            $regex: /^removecode/
        }
    })
    Talks.remove({
        type: 'text',
        message: {
            $regex: /{\w}/
        }
    })
    Talks.remove({
        type: 'text',
        message: {
            $regex: /[\_]/
        }
    })
    Talks.remove({
        type: 'text',
        message: query
    })
    Talks.aggregate([{
        $match: {
            'type': 'text'
        }
    }, {
        $group: {
            _id: {
                'message': '$message'
            },
            count: {
                $sum: 1
            }
        }
    }], function(err, result, k) {
        result = _.map(result, function(row) {
            return {
                message: row._id.message,
                count: row.count
            }
        })
        result = _.sortBy(result, 'count');
        var response = '';
        _.each(result, function(row) {
            if (row.message.length > 15) {
                response += row.message.substring(0, 12) + '...'
            } else {
                response += row.message
            }
            response += '\n---------\n'
        })
        api.sendDebugMessage(response, event.thread_id);
        return;
    })

};