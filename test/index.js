const assert = require('assert');
const crypto = require('../lib/crypto');

describe('lib/crypto', function() {
    describe('#encrypt/#decrypt()', function() {
        it('should successfully encrypt and decrypt a value', function(done) {
            const plaintext = 'Hello, I am going to be encrypted';
            const node_id = '12345';

            crypto.generate_dh();
            crypto.add_id(node_id, crypto.get_dh_secret(crypto.pubkey));

            return crypto.encrypt({
                id: node_id,
                target: node_id,
                data: plaintext
            }, function(err, encrypted) {
                if (err) {
                    return done(err);
                }

                const decrypted = crypto.decrypt(encrypted);
                assert.equal(plaintext, decrypted);
                return done();
            });
        });
    });
});
