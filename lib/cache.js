var _ = require("lodash");
var EventEmitter = require("eventemitter2").EventEmitter2;

function Cache(){
    this.keys = {};
}

Cache.super_ = EventEmitter;

Cache.prototype = Object.create(EventEmitter.prototype, {
    constructor: {
        value: Cache,
        enumerable: false
    }
});

Cache.prototype.get_keys = function(){
    return _.keys(keys);
}

Cache.prototype.set = function(key, ms){
    var self = this;

    if(_.has(this.keys, key))
        clearTimeout(this.keys[key]);

    this.keys[key] = setTimeout(function(){
        self.emit("expired", key);
    }, ms);
}

Cache.prototype.delete = function(key){
    if(_.has(this.keys, key))
        clearTimeout(this.keys[key]);
}

Cache.prototype.purge = function(){
    _.each(this.keys, function(timer, key){
        clearTimeout(timer);
    }, this);
}

module.exports = Cache;
