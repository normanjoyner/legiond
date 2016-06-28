'use strict';

const _ = require('lodash');
const crypto = require('crypto');
const gcm = require('node-aes-gcm');

class Crypto {
    constructor() {
        this.ids = {};
        this.dh = null;
        this.prime = null;
        this.pubkey = null;
    }

    add_id(name, secret) {
        this.ids[name] = new Buffer(secret);
    }

    get_dh_secret(pubkey) {
        return this.dh.computeSecret(pubkey).toString('hex');
    }

    generate_dh() {
        this.dh = crypto.createDiffieHellman(64);
        this.prime = this.dh.getPrime();
        this.dh = crypto.createDiffieHellman(this.prime);
        this.dh.generateKeys();
        this.pubkey = this.dh.getPublicKey();
    }

    generate_dh_secret(pubkey, requested_prime) {
        const temp_dh = crypto.createDiffieHellman(requested_prime);
        temp_dh.generateKeys();

        return {
            pubkey: temp_dh.getPublicKey(),
            secret: temp_dh.computeSecret(pubkey).toString('hex')
        }
    }

    get_dh_prime() {
        return this.prime;
    }

    get_dh_pubkey() {
        return this.pubkey;
    }

    encrypt(options, fn){
        const id = this.ids[options.target];
        const routing = options.id;

        if(_.isUndefined(options.iv)) {
            utils.generate_iv((error, iv) => {
                if (error) {
                    // TODO - NT: should we return the error as well?
                    return fn();
                }

                const aad = new Buffer(routing);
                const encrypted = _.merge(gcm.encrypt(id, iv, options.data, aad), {
                    iv: iv,
                    aad: aad
                });

                return fn(null, encrypted);
            });
        } else{
            const aad = new Buffer(routing);
            const encrypted = _.merge(gcm.encrypt(id, options.iv, options.data, aad), {
                iv: options.iv,
                aad: aad
            });

            return fn(null, encrypted);
        }
    }

    decrypt(object) {
        const aad = new Buffer(object.aad);
        const val = aad.toString('ascii');
        const id = this.ids[val];
        const iv = new Buffer(object.iv);
        const ciphertext = new Buffer(object.ciphertext);
        const auth_tag = new Buffer(object.auth_tag);

        const decrypted = gcm.decrypt(id, iv, ciphertext, aad, auth_tag);

        if(decrypted.auth_ok) {
            return decrypted.plaintext.toString();
        }

        return null;
    }

    generate_node_id(bytes, fn) {
        if(_.isUndefined(fn) && _.isFunction(bytes)) {
            fn = bytes;
            bytes = 8;
        }

        return crypto.randomBytes(bytes, fn);
    }

}
module.exports = new Crypto();

const utils = {
    generate_iv: (fn) => crypto.randomBytes(12, fn)
}
