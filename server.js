var sockjs = require('sockjs'),
  zmq = require('zmq'),
  http = require('http'),
  sys = require('sys');

var app = http.createServer();
var socks = sockjs.createServer({prefix: '/socks'});
socks.installHandlers(app);

var service = zmq.socket('router');
service.on('message', function(id) {
  var command = arguments[1].toString();
  var args = Array.prototype.slice.call(arguments, 2);
  console.log({from: id, args: args});
  switch (command) {
  case "HELLO":
    console.log({hello: id});
    addRouter(id);
    break;
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
  case "SEND":
    var data = args[0];
    console.log({send: data});
    for (var i = 1, len = args.length; i < len; i++) {
      sendOnConnection(args[i], data);
    }
    break;
  case "CONT":
    // TODO
    break;
  default:
    console.warn({unknown: command, args: args});
  }
});

routers = [];
function addRouter(id) {
  routers.push(id);
}
function nextRouter() {
  var router = routers.shift();
  if (router) { routers.push(router); }
  return router;
}
function removeRouter(id) {
  var idStr = id.toString();
  for (var i = 0, len = routers.length; i < len; i++) {
    if (routers[i].toString() == idStr) {
      routers.splice(i, 1);
      return;
    }
  }
  console.warn("BYE from unknown router: " + sys.inspect(id));
}

pending = {};
open = {};

function parkConnection(id, connection) {
  pending[id] = connection;
}
function acceptConnection(id) {
  var conn = pending[id];
  if (conn) {
    open[id] = conn;
    delete pending[id];
  }
  else {
    console.warn("Accept unknown connection: " + id);
  }
}
function rejectConnection(id, connection) {
  var conn = pending[id];
  if (conn) {
    conn.close(500, "Connection rejected"); // proper code
    delete pending[id];
  }
  else {
    console.warn("Reject unknown connection: " + id);
  }
}

function sendOnConnection(id, data) {
  var conn = open[id];
  if (conn) {
    conn.write(data);
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
    parkConnection(id, conn);
    var detail = detailOf(conn);
    pending[id] = conn;
    service.send([router, "OPEN", id, JSON.stringify(detail)]);
  }
  else {
    // TODO Something more constructive
    console.warn("No router to send to! Closing connection");
    conn.close(500, "No service"); // TODO proper error code.
  }
});

service.bind('tcp://*:5000', function() {
  console.log("Service bound to *:5000");
  app.listen(8000);
});

// ============= gubbins ==============

function idOf(connection) {
  return JSON.stringify({addr: connection.remoteAddress,
                         port: connection.remotePort});
}

function detailOf(connection) {
  return {headers: connection.headers,
          path: connection.url};
}
