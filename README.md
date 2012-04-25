# SockJS bridge

This is a server that proxies SockJS connections. Why bother? Well,
not everyone can have a SockJS server in their chosen language,
whereas TCP/ZeroMQ bindings are far more common. Also, you may wish to
deploy the bridge independently of your application, because of
Reasons.

## Debugging

    $ npm install && node server.js

or

    $ npm start

starts a server that listens for SockJS connections on port 8000 and
for applications on port 5000.

The Node.JS module `client` has a simple client that speaks the proxy
to app protocol. To simulate an application using the bridge, connect
a client to `localhost:5000`:

    $ var client = require('./client').connect('tcp://localhost:5000');
    $ client.on('open', function(id) { client.accept(id); });
    $ client.on('recv', function(id, data) {console.log(data.toString());});

To send data to one or more connections, use

   $ client.send(data, connectionId ...);

The `index.html` in the top directory simply includes the appropriate
script tag so you can open a connection. Try serving it through your
favourite web server, e.g.:

    $ python -m SimpleHTTPServer 8080

Then you can point a browser at that page, open a JavaScript console
in the browser, and open a connection (as suggested on the page
itself):

    > var sock = new SockJS('http://localhost:8000/socks');
    > sock.onmesssage = function(msg) { console.log(msg); };
