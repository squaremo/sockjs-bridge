var zmq = require('zmq');

function Client(serviceAddr, bindAddr, connectAddr) {
  this._serviceAddr = serviceAddr; // where to register
  this._bindAddr = bindAddr; // where to wait for opens
  this._connectAddr = connectAddr; // where to tell the bridge to send opens
  var connections = this._connections = {};

  var channel = this._channel = zmq.socket('router');
  var service = this._service = zmq.socket('dealer');

  var that = this;
  channel.on('message', function(id /*, parts */) {
    var command = arguments[1].toString();
    switch (command) {
    case "HUP":
      console.warn("Received HUP from bridge, re-registering with " +
                   that._serviceAddr);
      that.hello(); // and ...
      break;
    case "OPEN":
      var connId = arguments[2].toString();
      var detail = JSON.parse(arguments[3]);
      connections[connId] = {bridge: id, detail: detail};
      that.emit('open', connId, detail);
      break;
    case "CLOSE":
      var connId = arguments[2].toString();
      that.emit('close', connId);
      delete connections[connId]; // TODO check if we know about it ..?
      break;
    case "RECV":
      var connId = arguments[2].toString();
      that.emit('recv', connId, arguments[2]);
      break;
    case "FLOW":
      var connId = arguments[2].toString();
      var lwm = arguments[3].readUInt32BE();
      var size = arguments[4].readUInt32BE();
      that.emit('flow', connId, lwm, size);
      break;
    default:
      console.warn({unknown: command});
    }
  });
}
Client.prototype = new (require('events').EventEmitter)();

Client.prototype.hello = function() {
  // errrrr
  if (this._bound) {
    this._service.send(["HELLO", this._connectAddr]);
  }
  else {
    var that = this, service = this._service;
    this._channel.bind(this._bindAddr, function() {
      that._bound = true;
      service.connect(that._serviceAddr);
      service.send(["HELLO", that._connectAddr]);
    });
  }
}
Client.prototype.bye = function() {
  // TODO send to all known bridge IDs (collate from connections?)
  this._channel.send("BYE");
}
Client.prototype.accept = function(id) {
  var connection = this._connections[id];
  if (connection) {
    this._channel.send([connection.bridge, "ACCEPT", id]);
  }
  else {
    console.warn("Accept unknown connection " + id);
  }
}
Client.prototype.reject = function(id, reason) {
  reason = reason || "";
  var connection = this._connections[id];
  if (connection) {
    this._channel.send([connection.bridge, "REJECT", id, reason]);
  }
  else {
    console.warn("Reject unknown connection " + id);
  }
}
Client.prototype.send = function(data /*, connection ids */) {
  // oh piss.
  var bridges = {};
  for (var i = 1, len = arguments.length; i < len; i++) {
    var connId = arguments[i];
    var conn = this._connections[connId];
    if (conn) {
      if (bridges[conn.bridge]) {
        bridges[conn.bridge].push(connId);
      }
      else {
        bridges[conn.bridge] = [conn.bridge, "SEND", data, connId];
      }
    }
    else {
      console.warn("Send to unknown connection " + connId);
    }
  }
  for (k in bridges) {
    if (bridges.hasOwnProperty(k)) {
      var parts = bridges[k];
      this._channel.send(parts);
    }
  }
};

// === and finally

module.exports.connect = function (service, bind, connect) {
  return new Client(service, bind, connect);
};
