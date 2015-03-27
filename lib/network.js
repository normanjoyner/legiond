var async = require("async");
var net = require("net");
var _ = require("lodash");
var EventEmitter = require("eventemitter2").EventEmitter2;
var os = require("os");
var crypto = require([__dirname, "crypto"].join("/"));
var network = require("network");

function Network(options, fn){
    EventEmitter.call(this);

    var self = this;

    this.options = _.defaults(options, {
        tcp_timeout: 5000,
        port: 27272,
        public: false,
        address: {}
    });

    async.series([
        function(cb){
            self.set_address_configuration(function(address_config){
                self.options.address = address_config;
                return cb();
            });
        },
        function(cb){
            self.setup_server(function(){
                return cb();
            });
        }
    ], function(){
        return fn();
    });
}

Network.super_ = EventEmitter;

Network.prototype = Object.create(EventEmitter.prototype, {
    constructor: {
        value: Network,
        enumerable: false
    }
});

Network.prototype.set_address_configuration = function(fn){
    var address_config = {
        global: "0.0.0.0",
        host_name: os.hostname()
    }

    async.parallel([
        function(cb){
            network.get_public_ip(function(err, ip){
                if(_.isNull(err))
                    address_config.public = ip;

                return cb();
            });
        },
        function(cb){
            network.get_private_ip(function(err, ip){
                if(_.isNull(err))
                    address_config.private = ip;

                return cb();
            });
        }
    ], function(){
        return fn(address_config);
    });
}

Network.prototype.setup_server = function(fn){
    var self = this;
    this.server = net.createServer();

    this.server.on("connection", function(socket){
        var buffer = [];

        socket.on("data", function(msg){
            buffer.push(msg);
        });

        socket.on("end", function(){
            var emit = function(msg){
                if(msg.id != self.options.id)
                    self.emit("message", msg);
            }

            buffer = buffer.join("");

            try{
                var msg = JSON.parse(buffer);
                if(_.has(msg, "event") && _.has(msg, "id") && _.has(msg, "data"))
                    emit(msg);
                else{
                    msg = crypto.decrypt(msg);
                    if(!_.isNull(msg)){
                        try{
                            emit(JSON.parse(msg));
                        }
                        catch(err){}
                    }
                }
            }
            catch(err){}

            socket.destroy();
        });
    });

    this.server.listen(this.options.port, this.options.address.global, function(){
        self.generate_node_id(function(id){
            self.options.id = id;
            crypto.generate_dh();
            return fn();
        });
    });
}

Network.prototype.send = function(event, data, targets, fn){
    var self = this;

    var json = {
        event: event,
        id: this.options.id,
        data: data
    }

    var data = new Buffer(JSON.stringify(json));

    var unencryptable_events = [
        "legiond.discovery",
        "legiond.discovered",
        "legiond.accept_node",
        "legiond.node_accepted"
    ]

    var connect = function(target, data, fn){
        var client = new net.Socket();

        client.setTimeout(self.options.tcp_timeout, function(a){
            client.destroy();
        });

        if(_.isUndefined(target.port))
            target.port = self.options.port;

        if(self.options.public)
            var scope = "public";
        else
            var scope = "private";

        client.connect(target.port, target.address[scope], function(){
            client.write(data);
            client.destroy();
        });

        client.on("close", function(){
            return fn();
        });

        client.on("error", function(err){
            self.emit("error", err);
        });
    }

    if(_.contains(unencryptable_events, event)){
        async.each(targets, function(target, next){
            return connect(target, data, next);
        }, function(err){
            if(!_.isUndefined(fn))
                return fn();
        });
    }
    else{
        async.each(targets, function(target, next){
            crypto.encrypt(target.id, data, self.options.id, function(encrypted){
                if(!_.isNull(encrypted))
                    encrypted = new Buffer(JSON.stringify(encrypted));

                return connect(target, encrypted, next);
            });
        }, function(err){
            if(!_.isUndefined(fn))
                return fn();
        });
    }
}

Network.prototype.generate_node_id = function(fn){
    crypto.generate_node_id(function(id){
        if(!_.isUndefined(id))
            id = id.toString("hex");

        return fn(id);
    });
}

Network.prototype.destroy = function(){
    this.server.close();
}

module.exports = Network;
