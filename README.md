# legiond

## About

### Build Status
[![Build Status](https://drone.containership.io/api/badges/containership/legiond/status.svg)](https://drone.containership.io/containership/legiond)

### Description
Legiond is a secure distributed event layer for nodejs applications. Given a CIDR range, it automatically finds and connects to peers, forming a clustered EventEmitter. Legiond exposes a standard set of events which can be listened for, such as addition of a new node, removal of an existing node, etc. It also allows an application to register custom events and respond to them how it sees fit. More detail about custom events can be found below.

### Author
ContainerShip Developers - developers@containership.io

## Getting Started

### Installation
```npm install legiond```

###Configuration

##Features

###Standard Events
The following are standard events provided by legiond. These events cannot be overwritten by custom user events.

* `listening` - emits when legiond has started listening
* `node_added` - emits on existing nodes when a new node joins the cluster
* `node_removed` - emits on existing nodes when a node leaves the cluster
* `error` - emits when an error occurs

###Custom Events
Custom user events can be registered and listened for like any standard event. To start listening for a specific event, call `legiond.join("event_name")`. Similarly, when legiond should no longer care about a custom event, simply remove the event listener by calling `legiond.leave("event_name")`.

##Security

###Gatekeeper
By default, any node running legiond can connect to an existing legiond cluster. Since this may not be desirable, filters can be enforced which require a connecting node to meet certain criteria, before being added to the cluster. When configuring your node, simply pass legiond a `gatekeeper` function. The `gatekeeper` function takes two parameters, the node object and a callback, which should be executed, returning an error if applicable. If the callback returns an error, the node is unable to join the cluster, otherwise it is accepted. For example, the following filter will only accept nodes if their hostname ends with "org.internal":

```javascript
const LegionD = require('legiond');
const legiond = new LegionD({
    gatekeeper: (data, callback) => {
        if(data.host.match(/org.internal$/g) === null) {
            return callback(new Error(`Rejected connection! ${data.id} has invalid hostname`));
        } else {
            return callback();
        }
    }
});
```

### Encryption
Once a node is connected to the cluster, legiond encrypts all traffic using 128-bit aes-gcm authenticated encryption. The aes key used for each pair of nodes is unique, and is generated using Diffie-Hellman key exchange upon initial connection. Initialization vectors are never reused. Since legiond does not require a pre-shared key to perform encryption, there is no fear of having that key compromised. Additionally, key rotation is made easy by simply restarting the node.
