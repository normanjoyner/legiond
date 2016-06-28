'use strict'

const _ = require('lodash');
const EventEmitter = require('eventemitter2').EventEmitter2;

class Cache extends EventEmitter {
    constructor() {
        super();

        this.keys = {};
    }

    get_keys() {
        return _.keys(keys);
    }

    set(key, ms) {
        const self = this;

        if(_.has(this.keys, key)) {
            clearTimeout(this.keys[key]);
        }

        this.keys[key] = setTimeout(() => {
            self.emit('expired', key);
        }, ms);
    }

    delete(key) {
        if(_.has(this.keys, key)) {
            clearTimeout(this.keys[key]);
        }
    }

    purge() {
        _.each(this.keys, (timer, key) => {
            clearTimeout(timer);
        });
    }
}

module.exports = Cache;
