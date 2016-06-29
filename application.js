'use strict';

const LegionD = require('./legiond');
const pkg = require('./package.json');

module.exports = function(options) {
    const legiond = new LegionD(options);
    legiond.version = pkg.version;

    return legiond;
};
