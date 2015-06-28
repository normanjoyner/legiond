var async = require("async");
var net = require("net");
var _ = require("lodash");
var EventEmitter = require("eventemitter2").EventEmitter2;
var os = require("os");
var crypto = require([__dirname, "crypto"].join("/"));
var network = require("network");
var MemoryStream = require("memorystream");
var jsonStream = require("json-stream2");

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
    var self = this;

    var address_config = {
        global: "0.0.0.0",
        host_name: os.hostname()
    }

    async.parallel([
        function(cb){
            if(!self.options.public)
                return cb();

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
       var message;
       var stream;
       var parseStream = jsonStream.Parse("\n");

       socket.pipe(parseStream).on("data", function(json){
            if(_.isUndefined(message))
                message = json;
            else if(_.isUndefined(stream)){
                stream = new MemoryStream();
                end_message();
                var decrypted_message = crypto.decrypt(json);
                stream.write(decrypted_message);
            }
            else{
                var decrypted_message = crypto.decrypt(json);
                stream.write(decrypted_message);
            }
       });

        var end_message = function(){
            var emit = function(message){
                if(message.id != self.options.id)
                    self.emit("message", message);
            }

            try{
                if(_.has(message, "event") && _.has(message, "id") && _.has(message, "data")){
                    emit(message);
                }
                else{
                    message = crypto.decrypt(message);
                    if(!_.isNull(message)){
                        try{
                            var json = JSON.parse(message);
                            if(!_.isUndefined(stream))
                                json.stream = stream;

                            emit(json);
                        }
                        catch(e){}
                    }
                }
            }
            catch(e){}
        }

        socket.on("end", function(){
            end_message();
        });
    });

    var listen_address = this.options.public ? this.options.address.global : this.options.address.private;

    this.server.listen(this.options.port, listen_address, function(){
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
            socket.end();
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
                socket.write(stringified_json + "\n");
                socket.end();
                return fn();
            }
            else{
                var encryption_options = {
                    id: self.options.id,
                    target: target.id,
                    data: stringified_json
                }

                crypto.encrypt(encryption_options, function(encryption){
                    socket.write(JSON.stringify(encryption) + "\n");
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
        if(json.stream){
            async.each(clients, function(client, fn){
                client.socket.on("end", fn);

                var queue = async.queue(function(encryption_options, fn){
                    crypto.encrypt(encryption_options, function(encryption){
                        client.socket.write(JSON.stringify(encryption) + "\n");
                        return fn();
                    });
                }, 1);

                stream.on("data", function(chunk){
                    var encryption_options = {
                        id: self.options.id,
                        target: client.id,
                        iv: client.iv,
                        data: new Buffer(chunk.toString())
                    }
                    queue.push(encryption_options);
                });

                stream.on("end", function(){
                    client.socket.end();
                });
            }, function(){
                if(!_.isUndefined(fn))
                    return fn();
            });
        }
        else{
            _.each(clients, function(client){
                client.socket.end();
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
