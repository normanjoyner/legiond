/*
    Responsible for storing node attributes
*/

module.exports = function(legiond){
    var gatekeeper = function(data, fn){
        return fn(true);
    }

    return {
        attributes: {},
        gatekeeper: legiond.options.gatekeeper || gatekeeper
    }
}
