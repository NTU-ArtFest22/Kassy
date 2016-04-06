var request = require.safe('request');
var _ = require.safe('lodash');

exports.match = function(text, commandPrefix) {
    return text.includes('remove');
};

exports.help = function(commandPrefix) {
    return [
        ['', '']
    ];
};

exports.run = function(api, event) {
    if (event.sender_id !== '100000187207997') {
        ga.event("Receive", "Invaild_admin_access", event.sender_name).send()
        console.log('ga-attack-admin')
        api.sendMessage('齁，你就不是管理員齁。', event.thread_id);
    }
    var query = event.body.substr(11);
    ga.event("Receive", "Admin_remove_terms", query).send()
    console.log('ga-admin-remove')
    Talks.remove({
        type: 'text',
        message: {
            $regex: /^\//
        }
    })
    Talks.remove({
        type: 'text',
        message: {
            $regex: /\d\./
        }
    })
    Talks.remove({
        type: 'text',
        message: {
            $regex: /npm/
        }
    })
    Talks.remove({
        type: 'text',
        message: {
            $regex: /bug/
        }
    })
    Talks.remove({
        type: 'text',
        message: {
            $regex: /robot/
        }
    })
    Talks.remove({
        type: 'text',
        message: {
            $regex: /^\d+/
        }
    })
    Talks.remove({
        type: 'text',
        message: {
            $regex: /系統維護/
        }
    })
    Talks.remove({
        type: 'text',
        message: {
            $regex: /bot/
        }
    })
    Talks.remove({
        type: 'text',
        message: {
            $regex: /帳號/
        }
    })
    Talks.remove({
        type: 'text',
        message: {
            $regex: /家豪/
        }
    })
    Talks.remove({
        type: 'text',
        message: {
            $regex: /幹/
        }
    })
    Talks.remove({
        type: 'text',
        message: {
            $regex: /[Fuck|fuck]/
        }
    })
    Talks.remove({
        type: 'text',
        message: {
            $regex: /removecode/
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
        console.log(result)
        console.log(k)
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