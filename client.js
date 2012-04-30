var zmq = require('zmq');

function Client(serviceAddr, bindAddr, connectAddr) {
  this._serviceAddr = serviceAddr; // where to register
  this._bindAddr = bindAddr; // where to wait for opens
  this._connectAddr = connectAddr; // where to tell the bridge to send opens

  var channel = this._channel = zmq.socket('pair');
  var service = this._service = zmq.socket('dealer');

  var that = this;
  channel.on('message', function(/* parts */) {
    var command = arguments[0].toString();
    switch (command) {
    case "HUP":
      console.warn("Received HUP from bridge, re-registering with " +
                   that._serviceAddr);
      that.hello(); // and ...
      break;
    case "OPEN":
      var id = arguments[1].toString();
      var detail = JSON.parse(arguments[2]);
      that.emit('open', id, detail);
      break;
    case "RECV":
      var id = arguments[1].toString();
      that.emit('recv', id, arguments[2]);
      break;
    case "FLOW":
      var lwm = arguments[2].readUInt32BE();
      var size = arguments[3].readUInt32BE();
      that.emit('flow', lwm, size);
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
  this._channel.send("BYE");
}
Client.prototype.accept = function(id) {
  this._channel.send(["ACCEPT", id]);
}
Client.prototype.reject = function(id, reason) {
  reason = reason || "";
  this._channel.send(["REJECT", id, reason]);
}
Client.prototype.send = function(data /*, connection ids */) {
  var parts = Array.prototype.slice.call(arguments);
  parts.unshift("SEND");
  this._channel.send(parts);
}

// === and finally

module.exports.connect = function (service, bind, connect) {
  return new Client(service, bind, connect);
};
