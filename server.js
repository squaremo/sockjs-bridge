var sockjs = require('sockjs'),
  zmq = require('zmq'),
  http = require('http');

var app = http.createServer();
var socks = sockjs.createServer({prefix: '/socks'});
socks.installHandlers(app);

var service = zmq.socket('router');
service.on('message', function(id) {
  var args = Array.prototype.slice.call(arguments, 1);
  console.log({from: id, args: args});
  if ("HELLO" == args[0]) {
    console.log({hello: id});
    addRouter(id);
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

socks.on('connection', function(conn) {
  var id = idOf(conn);
  console.log({connection: id});
  var router = nextRouter();
  if (router) {
    var detail = detailOf(conn);
    service.send([router, "OPEN", id, JSON.stringify(detail)]);
  }
  else {
    console.warn("No router to send to! Closing connection");
    conn.close(500, "No service"); // TODO proper code.
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
