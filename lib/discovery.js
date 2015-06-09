/*
    Responsible for peer discovery functionality
*/

var _ = require("lodash");
var crypto = require([__dirname, "crypto"].join("/"));
var Netmask = require("netmask").Netmask;

module.exports = function(legiond){

    legiond.events["legiond.discovery"] = function(message){
        var attributes = _.merge(legiond.libraries.node.attributes, {
            pubkey: crypto.get_dh_pubkey(),
            prime: crypto.get_dh_prime()
        });

        legiond.libraries.node.gatekeeper(message.data, function(accepted){
            if(accepted){
                legiond.send({
                    event: "legiond.accept_node",
                    data: attributes
                }, message.data);
            }
        });
    }

    legiond.actions.discover_peers = function(cidr){
        if(!_.isUndefined(cidr)){
            if(!_.isArray(cidr))
                cidr = [cidr];

            _.each(cidr, function(range){
                var block = new Netmask(range);
                var targets = [];
                block.forEach(function(address){
                    targets.push({
                        address: {
                            public: address,
                            private: address
                        }
                    });
                });

                legiond.send({
                    event: "legiond.discovery",
                    data: legiond.libraries.node.attributes
                }, targets);
            });
        }
    }

}
