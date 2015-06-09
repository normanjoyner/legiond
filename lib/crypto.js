var crypto = require("crypto");
var _ = require("lodash");
var gcm = require("node-aes-gcm");

var dh;
var server;
var prime;
var pubkey;

module.exports = {

    ids: {},

    add_id: function(name, secret){
        this.ids[name] = new Buffer(secret);
    },

    get_dh_secret: function(pubkey){
        return dh.computeSecret(pubkey).toString("hex");
    },

    generate_dh: function(){
        dh = crypto.createDiffieHellman(64);
        prime = dh.getPrime();
        dh = crypto.createDiffieHellman(prime);
        dh.generateKeys();
        pubkey = dh.getPublicKey();
    },

    generate_dh_secret: function(pubkey, requested_prime){
        var temp_dh = crypto.createDiffieHellman(requested_prime);
        temp_dh.generateKeys();
        return {
            pubkey: temp_dh.getPublicKey(),
            secret: temp_dh.computeSecret(pubkey).toString("hex")
        }
    },

    get_dh_prime: function(){
        return prime;
    },

    get_dh_pubkey: function(){
        return pubkey;
    },

    encrypt: function(options, fn){
        var id = this.ids[options.target];
        var routing = options.id;

        if(_.isUndefined(options.iv)){
            utils.generate_iv(function(iv){
                if(_.isNull(iv))
                    return fn();

                var aad = new Buffer(routing);
                var encrypted = _.merge(gcm.encrypt(id, iv, options.data, aad), {
                    iv: iv,
                    aad: aad
                });

                return fn(encrypted);
            });
        }
        else{
            var aad = new Buffer(routing);
            var encrypted = _.merge(gcm.encrypt(id, options.iv, options.data, aad), {
                iv: options.iv,
                aad: aad
            });

            return fn(encrypted);
        }
    },

    decrypt: function(object){
        var aad = object.aad;
        aad = new Buffer(aad);
        var val = aad.toString("ascii");
        var id = this.ids[val];
        var iv = new Buffer(object.iv);
        var ciphertext = new Buffer(object.ciphertext);
        var auth_tag = new Buffer(object.auth_tag);

        var decrypted = gcm.decrypt(id, iv, ciphertext, aad, auth_tag);

        if(decrypted.auth_ok)
            return decrypted.plaintext.toString();
        else
            return null;
    },

    generate_node_id: function(bytes, fn){
        if(_.isUndefined(fn) && _.isFunction(bytes)){
            fn = bytes;
            bytes = 8;
        }

        crypto.randomBytes(bytes, function(err, id){
            return fn(id);
        });
    }

}

var utils = {

    generate_iv: function(fn){
        crypto.randomBytes(12, function(err, iv){
            if(_.isNull(err))
                return fn(iv);

            return fn(err);
        });
    }

}
