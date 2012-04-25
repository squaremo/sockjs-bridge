# SockJS bridge

This is a server that proxies SockJS connections. Why bother? Well,
not everyone can have a SockJS server in their chosen language,
whereas TCP/ZeroMQ bindings are far more common. Also, you may wish to
deploy the bridge independently of your application.

## Debugging

    $ node server.js

starts a server that listens for SockJS connections on port 8000 and
for applications on port 5000.

To simulate an application using the bridge, open a ZeroMQ dealer
socket to port 5000. For example, in Node.JS:

    $ var zmq = require('zmq');
    $ var bridge = zmq.socket('dealer');
    $ bridge.connect('tcp://localhost:5000');
    $ bridge.on('message', function(reply) { console.log(reply); });
    $ bridge.send("HELLO");

(Note that you won't hear anything over the socket until someone opens
a SockJS connection, but you should get some debug output to the
console from the server).

The `index.html` in the top directory simply includes the appropriate
script tag so you can open a connection. Try serving it through your
favourite web server, e.g.:

    $ python -m SimpleHTTPServer 8080

Then you can point a browser at that page, open a JavaScript console
in the browser, and open a connection (as suggested on the page
itself):

    > var sock = new SockJS('http://localhost:8000/socks');
