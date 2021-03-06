/**
 * Server related tasks
 * 
 */

// Dependecies
const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');
const StringDecoder = require('string_decoder').StringDecoder;
const util = require('util');
const debug = util.debuglog('server');

const config = require('./config');
const helpers = require('./helpers');
const handlers = require('./handlers');

// Instatiate the server module object
let server = {};

// Instatiate Http server
server.httpServer = http.createServer((req, res) => {
    server.unifiedServer(req, res);
});

// Instatiate Https server
server.httpsServerOptions = {
    'key': fs.readFileSync( path.join(__dirname, '/../https/key.pem')), //You want to use async since the file is read asynchronously
    'cert': fs.readFileSync(path.join(__dirname,'/../https/cert.pem'))
};

server.httpsServer = https.createServer(server.httpsServerOptions, (req, res) => {
    server.unifiedServer(req, res);
});

// All server logic for both Http and Https
server.unifiedServer = (req, res) => {
    // Get URL and parse it
    // parsedUrl contains object with different keys
    const parsedUrl = url.parse(req.url, true); // true means we are telling to parse the query string

    // Get the path which is untrimmed
    const path = parsedUrl.pathname;
    const trimmedPath = path.replace(/^\/+|\/+$/g, '');

    // Get the query string as an obj
    const queryStringObj = parsedUrl.query;

    // Get the HTTP method
    const method = req.method.toLowerCase();

    // Get the headers as an object
    const headers = req.headers;

    // Get the payload
    let buffer = ''; //Node deals with streams, we need to collect the streams(bits of the payload) as it comes in
    const decoder = new StringDecoder('utf-8');

    req.on('data', (data) => {
        buffer += decoder.write(data); // As the data is streaming in, the req object get's the bits of data and passes it to the decoder 
    });

    req.on('end', () => {
        buffer += decoder.end();

        // Choose handler this request should go to
        let choosenHandler = typeof (server.router[trimmedPath]) != 'undefined' ? server.router[trimmedPath] : handlers.notFound;

        // If the request is within the public dir use the public handler instead
        choosenHandler = trimmedPath.includes('public/') ? handlers.public : choosenHandler;
        // Data object to send to the handler
        const data = {
            trimmedPath,
            queryStringObj,
            method,
            headers,
            'payload': helpers.parseJSONToObject(buffer)
        };

        // Route the request to the router specified in the handler
        choosenHandler(data, (statusCode, payload, contentType) => {
            // Use the statuscode called back by the handler or default to 200
            statusCode = typeof (statusCode) == 'number' ? statusCode : 200;

            // Determine the type of response 
            contentType = typeof(contentType) == 'string' ? contentType : 'json'

            // Return the response parts that are content specific
            let payloadString = '';
            if(contentType == 'json') {
                res.setHeader('Content-Type', 'application/json'); // telling the browser that we are sending JSON and parse it to JSON
                // Use the payload defined by the handler or default to an empty object
                payload = typeof (payload) == 'object' ? payload : {};
                payloadString = JSON.stringify(payload);
            } 
            if(contentType == 'html') {
                res.setHeader('Content-Type', 'text/html'); // telling the browser that we are sending html text
                payloadString = typeof (payload) == 'string' ? payload : '';
            }
            if(contentType == 'favicon') {
                res.setHeader('Content-Type', 'image/x-icon'); // telling the browser that we are sending html text
                payloadString = typeof (payload) !== 'undefined' ? payload : '';
            }
            if(contentType == 'css') {
                res.setHeader('Content-Type', 'text/css'); // telling the browser that we are sending html text
                payloadString = typeof (payload) !== 'undefined' ? payload : '';
            }
            if(contentType == 'png') {
                res.setHeader('Content-Type', 'image/png'); // telling the browser that we are sending html text
                payloadString = typeof (payload) !== 'undefined' ? payload : '';
            }
            if(contentType == 'jpg') {
                res.setHeader('Content-Type', 'text/jpeg'); // telling the browser that we are sending html text
                payloadString = typeof (payload) !== 'undefined' ? payload : '';
            }
            if(contentType == 'plain') {
                res.setHeader('Content-Type', 'text/plain'); // telling the browser that we are sending html text
                payloadString = typeof (payload) !== 'undefined' ? payload : '';
            }

            // Return the response parts that are common to all content types
            res.writeHead(statusCode); // Writing the status code
            res.end(payloadString);

            // If the response is 200, print green otherwise print red
            if(statusCode == 200) {
                debug('\x1b[32m%s\x1b[0m', `${method.toUpperCase()}/${trimmedPath}' '${statusCode}`)
            } else {
                debug('\x1b[31m%s\x1b[0m', `${method.toUpperCase()}/${trimmedPath}' '${statusCode}`)
            }
        });
    });
}

// Define the routes here
server.router = {
    '': handlers.index,
    'account/create': handlers.accountCreate,
    'account/edit': handlers.accountEdit,
    'account/deleted': handlers.accountDeleted,
    'session/create': handlers.sessionCreate, // Login
    'session/deleted': handlers.sessionDeleted, // Logout
    'checks/all': handlers.checksList,
    'checks/create': handlers.checksCreate,
    'checks/edit': handlers.checksEdit,
    'api/users': handlers.users,
    'api/tokens': handlers.tokens,
    'api/checks': handlers.checks,
    'favicon.ico': handlers.favicon,
    'public': handlers.public
};

// Init script
server.init = () => {
    //Start the HTTP server
    server.httpServer.listen(config.httpPort, () => {
        console.log('\x1b[36m%s\x1b[0m',`Listening on port ${config.httpPort} `);
    });

    //Start the HTTPS server
    server.httpsServer.listen(config.httpsPort, () => {
        console.log('\x1b[35m%s\x1b[0m',`Listening on port ${config.httpsPort} `);
    });
}
// Export the server
module.exports = server;