var LegionD = require([__dirname, "legiond"].join("/"));
var pkg = require([__dirname, "package"].join("/"));

module.exports = function(options){
    var legiond = new LegionD(options);
    legiond.version = pkg.version;
    return legiond;
}
