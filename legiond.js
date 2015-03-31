var _ = require("lodash");
var Network = require([__dirname, "lib", "network"].join("/"));
var EventEmitter = require("eventemitter2").EventEmitter2;
var heartbeat = require([__dirname, "lib", "heartbeat"].join("/"));

function LegionD(options){
    var self = this;
    EventEmitter.call(this);

    var required_libs = [
        "heartbeat",
        "node",
        "nodes",
        "discovery"
    ]

    this.events = {};
    this.actions = {};

    if(_.isUndefined(options))
        options = {};

    this.options = _.defaults(options, {
        network: {},
        heartbeat_interval: 15000,
        node_timeout: 60000,
        attributes: {}
    });

    this.libraries = {};

    _.each(required_libs, function(lib){
        var library_name = lib.split(".")[0];
        this.libraries[library_name] = require([__dirname, "lib", lib].join("/"))(this);
    }, this);


    this.libraries.node.attributes = this.options.attributes;

    this.network = new Network(this.options.network, function(){
        self.libraries.node.attributes.id = self.options.network.id;
        self.libraries.node.attributes.port = self.options.network.port;
        self.libraries.node.attributes.host_name =  self.options.network.address.host_name;
        self.libraries.node.attributes.address = {
            private: self.options.network.address.private,
            public: self.options.network.address.public
        }

        self.actions.start_heartbeat();

        self.emit("listening");

        var cidr = self.options.network.cidr;
        self.actions.discover_peers(cidr);
    });

    this.network.on("message", function(msg){
        if(_.has(self.events, msg.event)){
            var json = {
                author: self.libraries.nodes.list[msg.id],
                data: msg.data,
                stream: msg.stream
            }
            self.events[msg.event](json);
        }
    });

    this.network.on("error", function(err){
        self.emit("error", err);
    });
}

LegionD.super_ = EventEmitter;
LegionD.prototype = Object.create(EventEmitter.prototype, {
    constructor: {
        value: LegionD,
        enumerable: false
    }
});

LegionD.prototype.get_peers = function(){
    return _.map(this.libraries.nodes.list, function(node, name){
        this.clean_data(node);
        return node;
    }, this);
}

LegionD.prototype.join = function(event){
    var self = this;

    var reserved_commands = [
        "listening",
        "node_added",
        "node_removed"
    ]

    if(!_.contains(reserved_commands, event)){
        this.events[event] = function(data){
            self.emit(event, data);
        }
    }
}

LegionD.prototype.leave = function(event){
    if(_.has(this.events, event))
        delete this.events[event];
}

LegionD.prototype.send = function(json, targets, fn){
    if(_.isFunction(targets)){
        fn = targets;
        targets = _.values(this.libraries.nodes.list);
    }
    else if(_.isUndefined(targets))
        targets = _.values(this.libraries.nodes.list);
    else if(!_.isArray(targets))
        var targets = [targets];

    if(_.isUndefined(json.data))
        json.data = {};

    this.network.send(json, targets, fn);
}

LegionD.prototype.clean_data = function(data){
    delete data.pubkey;
    delete data.prime;
}

LegionD.prototype.get_attributes = function(){
    var attributes = _.cloneDeep(this.libraries.node.attributes);
    this.clean_data(attributes);
    return attributes;
}

LegionD.prototype.set_attributes = function(attributes){
    attributes = _.omit(attributes, ["id", "host_name", "address", "port"]);
    _.defaults(attributes, this.libraries.node.attributes);
    this.libraries.node.attributes = attributes;
    this.send({
        event: "legiond.node_updated",
        data: attributes
    });
}

LegionD.prototype.exit = function(fn){
    var self = this;
    this.actions.exit(function(){
        self.actions.stop_heartbeat();
        self.removeAllListeners();
        self.network.destroy();
        self.libraries.heartbeat.cache.purge();
        if(!_.isUndefined(fn))
            return fn();
    });
}

module.exports = LegionD;
