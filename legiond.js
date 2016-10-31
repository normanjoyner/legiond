'use strict';

const fs = require('fs');
const mkdirp = require('mkdirp');
const _ = require('lodash');
const EventEmitter = require('eventemitter2').EventEmitter2;
const Network = require('./lib/network');

const REQUIRED_LIBS = [
    'heartbeat',
    'node',
    'nodes',
    'discovery'
];

class LegionD extends EventEmitter {
    constructor(options) {
        super();

        this.events = {};
        this.actions = {};

        this.options = options || {};
        this.options = _.defaults(options, {
            network: {},
            heartbeat_interval: 15000,
            discovery_interval: 60000,
            node_timeout: 60000,
            attributes_snapshot_dir: '/opt/containership/legiond',
            attributes: {}
        });

        this.libraries = {};
        this.libraries = _.reduce(REQUIRED_LIBS, (result, libname) => {
            result[libname] = require(`./lib/${libname}`)(this);

            return result;
        }, {});

        this.libraries.node.attributes = this.options.attributes;

        this.network = new Network(this.options.network, () => {
            this.libraries.node.attributes.id = this.options.network.id;
            this.libraries.node.attributes.port = this.options.network.port;
            this.libraries.node.attributes.host_name =  this.options.network.address.host_name;
            this.libraries.node.attributes.address = {
                private: this.options.network.address.private,
                public: this.options.network.address.public
            };

            this.actions.start_heartbeat();

            this.emit('listening');

            this.actions.discover_peers(this.options.network.cidr);

            if(this.options.discovery_interval > 0){
                setInterval(() => {
                    this.actions.discover_peers(this.options.network.cidr);
                }, this.options.discovery_interval);
            }
        });

        this.network.on('message', (msg) => {
            if(_.has(this.events, msg.event)) {
                const json = {
                    author: this.clean_data(this.libraries.nodes.list[msg.id]),
                    data: msg.data,
                    stream: msg.stream
                };

                this.events[msg.event](json);
            }
        });

        this.network.on('error', err => this.emit('error', err));

        this.restore_attributes();
    }

    /*
     * Retrieve all the known peers connected to the cluster. Strip
     * pubkey & prime number before returning the node attributes
     */
    get_peers() {
        return _.map(this.libraries.nodes.list, (node/*, name*/) => {
            return this.clean_data(node);
        });
    }

    /*
     * If it is not a reserved command, register the inside legiond to
     * enable emitting across the cluster for the given event.
     *
     * @param {string} event - The event to be registered to the legiond
     * emitter
     */
    join(event) {
        const self = this;

        const RESERVED_COMMANDS = [
            'listening',
            'node_added',
            'node_removed'
        ];

        if(!_.contains(RESERVED_COMMANDS, event)) {
            this.events[event] = (data) => {
                self.emit(event, data);
            };
        }
    }

    /*
     * Remove the given event from the legiond event emitter
     *
     * @param {string} event - The event to be unregistered from
     * the legiond emitter
     */
    leave(event) {
        delete this.events[event];
    }

    /*
     * Send an event to the targets provided or to all peers
     * in the cluster if no target was provided
     *
     * @param {Object} json - The json object to send over the network
     * @param {string|array[string]} targets - The targets to send the event to
     * @param {callback} fn - Callback to trigger once the event has been sent
     * across the network
     */
    send(json, targets, fn) {
        if(_.isFunction(targets)) {
            fn = targets;
            targets = _.values(this.libraries.nodes.list);
        } else if(_.isUndefined(targets)) {
            targets = _.values(this.libraries.nodes.list);
        } else if(!_.isArray(targets)) {
            targets = [targets];
        }

        json.data = json.data || {};
        this.network.send(json, targets, fn);
    }

    clean_data(data) {
        return _.omit(data, ['prime', 'pubkey']);
    }

    get_attributes() {
        const attributes = _.cloneDeep(this.libraries.node.attributes);
        this.clean_data(attributes);

        return attributes;
    }

    set_attributes(attributes) {
        attributes = _.omit(attributes, ['id', 'host_name', 'address', 'port']);
        _.defaults(attributes, this.libraries.node.attributes);
        this.libraries.node.attributes = attributes;

        this.send({
            event: 'legiond.node_updated',
            data: attributes
        });

        this.save_attributes();
    }

    restore_attributes() {
        fs.readFile(this.options.attributes_snapshot_dir + '/attributes.snapshot', 'utf-8', (err, data) => {
            if(err) {
                this.emit('error', err);
            } else {
                this.set_attributes(JSON.parse(data));
            }
        });
    }

    save_attributes() {
        const onError = (e) => {
            this.emit('error', e);
        };

        mkdirp(this.options.attributes_snapshot_dir, (err) => {
            if(err) {
                onError(err);
            } else {
                fs.writeFile(this.options.attributes_snapshot_dir + '/attributes.snapshot',
                        JSON.stringify(this.get_attributes()), (err) => {
                            if(err) onError(err);
                        });
            }
        });
    }

    exit(fn) {
        this.actions.exit(() => {
            this.actions.stop_heartbeat();
            this.removeAllListeners();
            this.network.destroy();
            this.libraries.heartbeat.cache.purge();

            if(!_.isUndefined(fn)) {
                return fn();
            }
        });
    }
}

module.exports = LegionD;
