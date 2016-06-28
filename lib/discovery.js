/*
    Responsible for peer discovery functionality
*/

const crypto = require('./crypto');

const _ = require('lodash');
const Netmask = require('netmask').Netmask;

module.exports = function(legiond) {

    legiond.events['legiond.discovery'] = function(message){
        const attributes = _.merge(legiond.libraries.node.attributes, {
            pubkey: crypto.get_dh_pubkey(),
            prime: crypto.get_dh_prime()
        });

        legiond.libraries.node.gatekeeper(message.data, (accepted) => {
            if(accepted) {
                legiond.send({
                    event: 'legiond.accept_node',
                    data: attributes
                }, message.data);
            }
        });
    }

    legiond.actions.discover_peers = function(cidr) {
        if(_.isUndefined(cidr)) {
            return;
        }

        if(!_.isArray(cidr)) {
            cidr = [cidr];
        }

        _.each(cidr, function(range){
            const block = new Netmask(range);
            const targets = [];

            block.forEach((address) => {
                targets.push({
                    address: {
                        public: address,
                        private: address
                    }
                });
            });

            legiond.send({
                event: 'legiond.discovery',
                data: legiond.libraries.node.attributes
            }, targets);
        });
    }

}
