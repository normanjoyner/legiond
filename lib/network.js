'use strict';

const crypto = require('./crypto');

const _ = require('lodash');
const async = require('async');
const EventEmitter = require('eventemitter2').EventEmitter2;
const jsonStream = require('json-stream2');
const MemoryStream = require('memorystream');
const net = require('net');
const network = require('network');
const os = require('os');

class Network extends EventEmitter {
    constructor(options, fn) {
        super();

        this.options = options || {};
        this.options = _.defaults(options, {
            tcp_timeout: 5000,
            port: 27272,
            public: false,
            address: {}
        });

        this.server = null;

        const self = this;
        async.series([
            (cb) => {
                self.set_address_configuration((error, address_config) => {
                    self.options.address = address_config;

                    return cb();
                });
            },
            (cb) => self.setup_server(cb)
        ], () => {
            return fn();
        });
    }

    set_address_configuration(fn) {
        const self = this;

        const address_config = {
            global: '0.0.0.0',
            host_name: os.hostname()
        };

        return async.parallel([
            (cb) => {
                network.get_public_ip((err, ip) => {
                    if(_.isNull(err)) {
                        address_config.public = ip;
                    }

                    return cb();
                });
            },
            (cb) => {
                if(_.has(self.options, 'interface')) {
                    network.get_interfaces_list((err, interfaces) => {
                        if(_.isNull(err)) {
                            const selectedInterface = _.find(interfaces, { name : self.options.interface });

                            if(!_.isUndefined(selectedInterface)) {
                                address_config.private = selectedInterface.ip_address;
                            }
                        }

                        return cb();
                    });
                } else{
                    network.get_private_ip((err, ip) => {
                        if(_.isNull(err)) {
                            address_config.private = ip;
                        }

                        return cb();
                    });
                }
            }
        ], () => {
            return fn(null, address_config);
        });
    }

    setup_server(fn) {
        const self = this;
        this.server = net.createServer();

        this.server.on('connection', (socket) => {
            let message;
            let stream;
            const parseStream = jsonStream.Parse('\n');

            socket.pipe(parseStream).on('data', (json) => {
                if(_.isUndefined(message)) {
                    message = json;
                } else if(_.isUndefined(stream)){
                    stream = new MemoryStream();
                    end_message();
                    const decrypted_message = crypto.decrypt(json);
                    stream.write(decrypted_message);
                } else {
                    const decrypted_message = crypto.decrypt(json);
                    stream.write(decrypted_message);
                }
            }).on('finish', () => {
                if(!_.isUndefined(stream)) {
                    stream.end();
                }
            });

            const end_message = () => {
                const emit = (message) => {
                    if(message.id != self.options.id) {
                        self.emit('message', message);
                    }
                };

                try {
                    if(_.has(message, 'event') && _.has(message, 'id') && _.has(message, 'data')) {
                        emit(message);
                    } else {
                        message = crypto.decrypt(message);

                        if(!_.isNull(message)) {
                            try{
                                const json = JSON.parse(message);

                                if(!_.isUndefined(stream)) {
                                    json.stream = stream;
                                }

                                emit(json);
                            } catch(_) { /* ignore error */ }
                        }
                    }
                } catch(_){ /* ignore error */ }
            };

            socket.on('end', function(){
                end_message();
            });
        });

        const listen_address = this.options.public ? this.options.address.global : this.options.address.private;

        this.server.listen(this.options.port, listen_address, () => {
            if(_.isUndefined(self.options.id)) {
                self.generate_node_id((id) => {
                    self.options.id = id;
                    crypto.generate_dh();

                    return fn();
                });
            } else{
                crypto.generate_dh();

                return fn();
            }
        });
    }

    send(json, targets, fn) {
        const self = this;
        let stream = null;

        json.id = this.options.id;

        if(!_.isUndefined(json.stream)) {
            stream = json.stream;
        }

        json.stream = !_.isUndefined(json.stream);
        const stringified_json = new Buffer(JSON.stringify(json));

        const clients = [];

        const unencryptable_events = [
            'legiond.discovery',
            'legiond.discovered',
            'legiond.accept_node',
            'legiond.node_accepted'
        ];

        async.each(targets, (target, fn) => {
            const socket = new net.Socket();

            socket.setTimeout(self.options.tcp_timeout, () => {
                socket.end();
            });

            if(_.isUndefined(target.port)) {
                target.port = self.options.port;
            }

            let scope = 'private';

            if(self.options.public) {
                scope = 'public';
            }

            socket.connect(target.port, target.address[scope], () => {
                const client = {
                    id: target.id,
                    socket: socket
                };

                if(_.contains(unencryptable_events, json.event)){
                    socket.write(stringified_json + '\n');
                    socket.end();

                    return fn();
                } else {
                    const encryption_options = {
                        id: self.options.id,
                        target: target.id,
                        data: stringified_json
                    };

                    crypto.encrypt(encryption_options, (error, encryption) => {
                        socket.write(JSON.stringify(encryption) + '\n');
                        client.iv = encryption.iv;
                        clients.push(client);

                        return fn();
                    });
                }
            });

            socket.on('error', (err) => {
                self.emit('error', err);
            });

        }, () => {
            if(json.stream) {
                const queue = async.queue((encryption_options, fn) => {
                    const client = encryption_options.client;
                    delete encryption_options.client;
                    crypto.encrypt(encryption_options, (error, encryption) => {
                        client.socket.write(JSON.stringify(encryption) + '\n', fn);
                    });
                }, 1);

                const drain = () => {
                    _.each(clients, (client) => {
                        client.socket.end();
                    });

                    if(!_.isUndefined(fn)) {
                        return fn();
                    }
                };

                stream.on('data', (chunk) => {
                    _.each(clients, (client) => {
                        const encryption_options = {
                            id: self.options.id,
                            target: client.id,
                            iv: client.iv,
                            data: new Buffer(chunk.toString()),
                            client: client
                        };

                        queue.push(encryption_options);
                    });
                });

                stream.on('end', () => {
                    if(queue.length() == 0) {
                        drain();
                    } else {
                        queue.drain = drain;
                    }
                });
            } else {
                _.each(clients, (client) => {
                    client.socket.end();
                });

                if(!_.isUndefined(fn)) {
                    return fn();
                }
            }
        });
    }

    generate_node_id(fn) {
        crypto.generate_node_id((error, id) => {
            if(!_.isUndefined(id)) {
                id = id.toString('hex');
            }

            return fn(id);
        });
    }

    destroy() {
        this.server.close();
    }
}
module.exports = Network;
