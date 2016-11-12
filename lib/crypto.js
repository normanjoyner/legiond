'use strict';

const _ = require('lodash');
const crypto = require('crypto');

const CIPHER_ALGORITHM = 'aes-256-gcm';

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
        return this.dh.computeSecret(pubkey);
    }

    generate_dh() {
        this.dh = crypto.createDiffieHellman(256);
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
            secret: temp_dh.computeSecret(pubkey)
        };
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
                    return fn();
                }

                const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, id, iv);
                const encrypted = Buffer.concat([cipher.update(options.data), cipher.final()]);
                const tag = cipher.getAuthTag();
                const aad = new Buffer(routing);

                return fn(null, {
                    iv: iv,
                    aad: aad,
                    ciphertext: encrypted,
                    auth_tag: tag
                });
            });
        } else{
            const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, id, options.iv);
            const encrypted = Buffer.concat([cipher.update(options.data), cipher.final()]);
            const tag = cipher.getAuthTag();
            const aad = new Buffer(routing);

            return fn(null, {
                iv: options.iv,
                aad: aad,
                ciphertext: encrypted,
                auth_tag: tag
            });
        }
    }

    decrypt(object) {
        const aad = new Buffer(object.aad);
        const val = aad.toString('ascii');
        const id = this.ids[val];
        const iv = new Buffer(object.iv);
        const ciphertext = new Buffer(object.ciphertext);
        const auth_tag = new Buffer(object.auth_tag);

        const decipher = crypto.createDecipheriv(CIPHER_ALGORITHM, id, iv);
        decipher.setAuthTag(auth_tag);
        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

        return decrypted.toString();
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
};
