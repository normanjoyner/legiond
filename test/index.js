const assert = require('assert');
const crypto = require('../lib/crypto');

describe('lib/crypto', function() {
  describe('#encrypt/#decrypt()', function() {
    let node_id;

    before((done) => {
      crypto.generate_node_id((err, id) => {
        node_id = id;
        return done(err);
      });
    });

    it('should successfully encrypt and decrypt a value', function(done) {
      const plaintext = 'Hello, I am going to be encrypted';

      crypto.generate_dh();
      const dh_secret = crypto.generate_dh_secret(crypto.pubkey, crypto.prime);
      console.log(dh_secret.secret);
      crypto.add_id(node_id, dh_secret.secret);

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

    it('should return null if auth tag is tampered with', function(done) {
      const plaintext = 'Hello, I am going to be tampered with encrypted';

      crypto.generate_dh();
      const dh_secret = crypto.generate_dh_secret(crypto.pubkey, crypto.prime);
      console.log(dh_secret.secret);
      crypto.add_id(node_id, dh_secret.secret);

      return crypto.encrypt({
        id: node_id,
        target: node_id,
        data: plaintext
      }, function(err, encrypted) {
        if (err) {
          return done(err);
        }

        crypto.generate_dh();
        const dh_secret = crypto.generate_dh_secret(crypto.pubkey, crypto.prime);
        const tampered_secret = dh_secret.secret;
        crypto.add_id(node_id, tampered_secret);

        const decrypted = crypto.decrypt(encrypted);
        assert.equal(null, decrypted);
        return done();
      });
    });
  });
});
