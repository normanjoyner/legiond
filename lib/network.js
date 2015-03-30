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
        tcp_timeout: 15000,
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

Network.prototype.send = function(json, targets, fn){
    var self = this;

    json.id = this.options.id

    if(!_.isUndefined(json.stream))
        var stream = json.stream;

    json.stream = !_.isUndefined(json.stream);
    var stringified_json = new Buffer(JSON.stringify(json));

    var clients = [];

    var unencryptable_events = [
        "legiond.discovery",
        "legiond.discovered",
        "legiond.accept_node",
        "legiond.node_accepted"
    ]

    async.each(targets, function(target, fn){
        var socket = new net.Socket();

        socket.setTimeout(self.options.tcp_timeout, function(){
            socket.destroy();
        });

        if(_.isUndefined(target.port))
            target.port = self.options.port;

        if(self.options.public)
            var scope = "public";
        else
            var scope = "private";

        socket.connect(target.port, target.address[scope], function(){
            var client = {
                id: target.id,
                socket: socket
            }

            if(_.contains(unencryptable_events, json.event)){
                socket.write(stringified_json);
                socket.destroy();
                return fn();
            }
            else{
                var encryption_options = {
                    id: self.options.id,
                    target: target.id,
                    data: stringified_json
                }

                crypto.encrypt(encryption_options, function(encryption){
                    socket.write(encryption);
                    client.iv = encryption.iv;
                    clients.push(client);
                    return fn();
                });
            }
        });

        socket.on("error", function(err){
            self.emit("error", err);
        });

    }, function(){
        async.each(clients, function(client, fn){
            client.socket.on("end", fn);
        }, fn);

        if(json.stream){
            async.each(clients, function(client){
                var queue = async.queue(function(encryption_options, fn){
                    crypto.encrypt(encryption_options, function(encryption){
                        clients.socket.write(encryption);
                        return fn();
                    });
                }, 1);

                json.stream.on("data", function(chunk){
                    var encryption_options = {
                        id: self.options.id,
                        target: client.id,
                        iv: client.iv,
                        data: chunk
                    }
                    queue.push(encryption_options);
                });

                json.stream.on("end", function(){
                    queue.drain = function(){
                        client.socket.destroy();
                    }
                });
            });
        }
    });

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
