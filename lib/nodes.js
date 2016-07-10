'use strict';

const crypto = require('./crypto');

const _ = require('lodash');

/*
    Responsible for handling tracking of other nodes
*/
module.exports = function(legiond) {

    legiond.events['legiond.accept_node'] = function(message) {
        // node already exists
        if(_.has(list, message.data.id)) {
            return;
        }

        const prime = new Buffer(message.data.prime);
        const pubkey = new Buffer(message.data.pubkey);

        const dh = crypto.generate_dh_secret(pubkey, prime);
        crypto.add_id(message.data.id, dh.secret);
        legiond.actions.add_node(message.data);
        const attributes = _.merge(legiond.libraries.node.attributes, {
            pubkey: dh.pubkey,
            prime: message.data.prime
        });

        legiond.send({
            event: 'legiond.node_accepted',
            data: attributes
        }, message.data);
        legiond.emit('node_added', legiond.clean_data(message.data));
    };

    legiond.events['legiond.node_accepted'] = function(message) {
        const pubkey = new Buffer(message.data.pubkey);
        const secret = crypto.get_dh_secret(pubkey);
        crypto.add_id(message.data.id, secret);
        legiond.actions.add_node(message.data);
        legiond.emit('node_added', legiond.clean_data(message.data));
    };

    legiond.events['legiond.node_updated'] = function(message) {
        legiond.actions.add_node(message.data);
    };

    const list = {};

    legiond.actions.add_node = function(node) {
        list[node.id] = node;
        legiond.libraries.heartbeat.cache.set(node.id, legiond.options.node_timeout);
    };

    legiond.actions.remove_node = function(node) {
        delete list[node.id];
    };

    return {
        list: list
    };
};
