/*
    Responsible for handling ping / heartbeat related functionality
*/

var _ = require("lodash");
var Cache = require([__dirname, "cache"].join("/"));

module.exports = function(legiond){

    legiond.actions.ping = function(){
        legiond.send("legiond.ping", legiond.libraries.node.attributes);
    }

    legiond.actions.expire_node = function(id){
        var data = legiond.libraries.nodes.list[id];
        if(!_.isUndefined(data)){
            legiond.actions.remove_node(data);
            legiond.clean_data(data);
            legiond.emit("node_removed", data);
        }
    }

    legiond.actions.exit = function(fn){
        legiond.send("legiond.exit", legiond.libraries.node.attributes, fn);
    }

    var heartbeat;

    legiond.actions.start_heartbeat = function(){
        legiond.actions.ping();
        heartbeat = setInterval(function(){
            legiond.actions.ping();
        }, legiond.options.heartbeat_interval);
    }

    legiond.actions.stop_heartbeat = function(){
        clearInterval(heartbeat);
    }

    legiond.events["legiond.ping"] = function(data){
        legiond.actions.add_node(data);
    }

    legiond.events["legiond.exit"] = function(data){
        cache.delete(data.id);
        legiond.actions.expire_node(data.id);
    }

    var cache = new Cache();

    cache.on("expired", function(id){
        legiond.actions.expire_node(id);
    });

    return {
        cache: cache
    }

}
