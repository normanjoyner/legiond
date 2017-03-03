'use strict';

const _ = require('lodash');
const async = require('async');

/*
    Responsible for storing node attributes
*/
module.exports = function(legiond) {

    let gatekeepers = legiond.options.gatekeepers || [];

    return {
        attributes: {},

        add_gatekeeper: (gatekeeper) => {
            gatekeepers.push(gatekeeper);
        },

        get_gatekeepers: () => {
            return gatekeepers;
        },

        remove_gatekeeper: (gatekeeper) => {
            gatekeepers = _.without(gatekeepers, gatekeeper);
        },

        enforce_gatekeepers: (node, callback) => {
            async.parallel(_.map(gatekeepers, (gatekeeper) => {
                return function(callback) {
                    gatekeeper(node, callback);
                };
            }), callback);
        }
    };
};
