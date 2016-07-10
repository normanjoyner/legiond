'use strict';

/*
    Responsible for handling ping / heartbeat related functionality
*/

const Cache = require('./cache');

const _ = require('lodash');

module.exports = function(legiond) {

    legiond.actions.ping = function() {
        legiond.send({
            event: 'legiond.ping',
            data: legiond.libraries.node.attributes
        });
    };

    legiond.actions.expire_node = function(id) {
        const data = legiond.libraries.nodes.list[id];

        if(!_.isUndefined(data)){
            legiond.actions.remove_node(data);
            legiond.emit('node_removed', legiond.clean_data(data));
        }
    };

    legiond.actions.exit = function(fn) {
        legiond.send({
            event: 'legiond.exit',
            data: legiond.libraries.node.attributes
        }, fn);
    };

    let heartbeat;

    legiond.actions.start_heartbeat = function() {
        legiond.actions.ping();
        heartbeat = setInterval(function(){
            legiond.actions.ping();
        }, legiond.options.heartbeat_interval);
    };

    legiond.actions.stop_heartbeat = function() {
        clearInterval(heartbeat);
    };

    legiond.events['legiond.ping'] = function(message) {
        legiond.actions.add_node(message.data);
    };

    legiond.events['legiond.exit'] = function(message) {
        cache.delete(message.data.id);
        legiond.actions.expire_node(message.data.id);
    };

    const cache = new Cache();

    cache.on('expired', function(id){
        legiond.actions.expire_node(id);
    });

    return {
        cache: cache
    };
};
