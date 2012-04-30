var sockjs = require('sockjs'),
  zmq = require('zmq'),
  http = require('http'),
  util = require('util');

var app = http.createServer();
var socks = sockjs.createServer({prefix: '/socks'});
socks.installHandlers(app);

var service = zmq.socket('router');
service.on('message', function(id) {
  var command = arguments[1].toString();
  var args = Array.prototype.slice.call(arguments, 2);
  switch (command) {
  case "HELLO":
    addr = args[0].toString();
    console.log({hello: addr});
    addRouter(addr);
    break;
  }
});

function wireChannel(id, channel) {
  channel.on('message', function() {
    var command = arguments[0].toString();
    var args = Array.prototype.slice.call(arguments, 1);
    console.log({service: id, args: args});
    switch (command) {
    case "BYE":
      console.log({bye: id});
      removeRouter(id);
      break;
    case "ACCEPT":
      console.log({accept: args[0]});
      acceptConnection(args[0]);
      break;
    case "REJECT":
      console.log({reject: args[0]});
      rejectConnection(args[0]);
      break;
    case "CLOSE":
      var connId = args[0];
      var reason = args[1];
      console.log({close: connId});
      closeConnection(connId, reason);
      break;
    case "SEND":
      var data = args[0];
      console.log({send: data});
      for (var i = 1, len = args.length; i < len; i++) {
        sendOnConnection(args[i], data);
      }
      break;
    case "CONT":
      // TODO -- continue a send
      break;
    default:
      console.warn({unknown: command, args: args});
    }
  });
}

// takeover handling
process.on('SIGUSR1', function() {
  console.log("Received SIGUSR1, freeing registration port");
  // free the port
  service.close();
  // tell all the routers to re-register
  for (var i = 0, len = routers.length; i < len; i++) {
    routers[i].socket.send("HUP");
  }
});
process.on('SIGUSR2', function() {
  console.log("Received SIGUSR2, freeing HTTP port");
  app.close();
  // TODO and close channel and exit, when all routers have gone away.
});

routers = [];
function addRouter(addr) {
  var channel = zmq.socket('dealer');
  wireChannel(addr, channel);
  channel.connect(addr);
  routers.push({id: addr, socket: channel});
}
function nextRouter() {
  var router = routers.shift();
  if (router) { routers.push(router); }
  return router;
}
function removeRouter(id) {
  for (var i = 0, len = routers.length; i < len; i++) {
    if (routers[i].id == id) {
      var closed = routers.splice(i, 1);
      closed[0].socket.close();
      return;
    }
  }
  console.warn("BYE from unknown router: " + util.inspect(id));
}

pending = {};
open = {};

function parkConnection(id, router, connection) {
  pending[id] = {router: router, connection: connection};
}
function acceptConnection(id) {
  var conn = pending[id];
  if (conn) {
    open[id] = conn;
    delete pending[id];
    conn.connection.on('close', function() {
      conn.router.socket.send(["CLOSE", id]);
    });
  }
  else {
    console.warn("Accept unknown connection: " + id);
  }
}
function rejectConnection(id, connection) {
  var conn = pending[id];
  if (conn) {
    conn.connection.close(500, "Connection rejected"); // proper code
    delete pending[id];
  }
  else {
    console.warn("Reject unknown connection: " + id);
  }
}

function closeConnection(id, reason) {
  var conn = open[id];
  if (conn) {
    conn.connection.close(500, reason);
    delete open[id];
  }
  else {
    console.warn("Close unknown (or unaccepted) connection: " + id);
  }
}

function sendOnConnection(id, data) {
  var conn = open[id];
  if (conn) {
    conn.connection.write(data);
  }
  else {
    console.warn("Send on unknown (or unaccepted) connection: " + id);
  }
}

socks.on('connection', function(conn) {
  var id = idOf(conn);
  console.log({connection: id});
  var router = nextRouter();
  if (router) {
    parkConnection(id, router, conn);
    var detail = detailOf(conn);
    router.socket.send(["OPEN", id, JSON.stringify(detail)]);
  }
  else {
    // TODO Something more constructive
    console.warn("No router to send to! Closing connection");
    conn.close(500, "No service"); // TODO proper error code.
  }
});

var oldPid = false;
if (process.argv.length > 2) {
  oldPid = parseInt(process.argv[2]);
  process.kill(oldPid, 'SIGUSR1');
}
service.bind('tcp://*:5000', function() {
  console.log("Service bound to *:5000");
  if (oldPid) {
    process.kill(oldPid, 'SIGUSR2');
  }
  app.listen(8000);
});

console.log("Running as pid " + process.pid);

module.exports = {pending: pending,
                  open: open,
                  service: service,
                  routers: routers};

// ============= gubbins ==============

function idOf(connection) {
  return JSON.stringify({addr: connection.remoteAddress,
                         port: connection.remotePort});
}

function detailOf(connection) {
  return {headers: connection.headers,
          path: connection.url};
}
