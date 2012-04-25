var zmq = require('zmq');

function Client(address) {
  var socket = this._socket = zmq.socket('dealer');

  var that = this;
  socket.on('message', function(/* parts */) {
    var command = arguments[0].toString();
    switch (command) {
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

  socket.connect(address);
}
Client.prototype = new (require('events').EventEmitter)();

Client.prototype.hello = function() {
  this._socket.send("HELLO");
}
Client.prototype.bye = function() {
  this._socket.send("BYE");
}
Client.prototype.accept = function(id) {
  this._socket.send(["ACCEPT", id]);
}
Client.prototype.reject = function(id, reason) {
  reason = reason || "";
  this._socket.send(["REJECT", id, reason]);
}
Client.prototype.send = function(data /*, connection ids */) {
  var parts = Array.prototype.slice.call(arguments);
  parts.unshift("SEND");
  this._socket.send(parts);
}

// === and finally

module.exports.connect = function (addr) {
  return new Client(addr);
};
