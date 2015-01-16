/*
    Responsible for handling tracking of other nodes
*/

var _ = require("lodash");
var crypto = require([__dirname, "crypto"].join("/"));

module.exports = function(legiond){

    legiond.events["legiond.accept_node"] = function(data){
        var prime = new Buffer(data.prime);
        var pubkey = new Buffer(data.pubkey);

        var dh = crypto.generate_dh_secret(pubkey, prime);
        crypto.add_id(data.id, dh.secret);
        legiond.actions.add_node(data);
        var attributes = _.merge(legiond.libraries.node.attributes, {
            pubkey: dh.pubkey,
            prime: data.prime
        });

        legiond.send("legiond.node_accepted", attributes, data);
        legiond.clean_data(data);
        legiond.emit("node_added", data);
    }

    legiond.events["legiond.node_accepted"] = function(data){
        var pubkey = new Buffer(data.pubkey);
        var prime = new Buffer(data.prime);
        var secret = crypto.get_dh_secret(pubkey);
        crypto.add_id(data.id, secret);
        legiond.actions.add_node(data);
        legiond.clean_data(data);
        legiond.emit("node_added", data);
    }

    legiond.events["legiond.node_updated"] = function(node){
        legiond.actions.add_node(node);
    }

    var list = {};

    legiond.actions.add_node = function(node){
        list[node.id] = node;
        legiond.libraries.heartbeat.cache.set(node.id, legiond.options.node_timeout);
    }

    legiond.actions.remove_node = function(node){
        delete list[node.id];
    }

    return {
        list: list
    }
}
