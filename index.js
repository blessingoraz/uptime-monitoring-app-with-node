/**
 * Primary file for the API
 * 
 */

 // Dependecies
const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const StringDecoder = require('string_decoder').StringDecoder;
const config = require('./lib/config');
const helpers = require('./lib/helpers');

const handlers = require('./lib/handlers');

// Instatiate Http server
const httpServer = http.createServer((req, res) => {
    unifiedServer(req, res);
});

// Start the Http server
httpServer.listen(config.httpPort, () => {
    console.log(`Listening on port ${config.httpPort} `);
});

// Instatiate Https server
const httpsServerOptions = {
    'key': fs.readFileSync('./https/key.pem'), //You want to use async since the file is read asynchronously
    'cert': fs.readFileSync('./https/cert.pem')
};

const httpsServer = https.createServer(httpsServerOptions, (req, res) => {
    unifiedServer(req, res);
});

// Start the Https server
httpsServer.listen(config.httpsPort, () => {
    console.log(`Listening on port ${config.httpsPort} `);
});

// All server logic for both Http and Https
const unifiedServer = (req, res) => {
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
        let choosenHandler = typeof(router[trimmedPath]) != 'undefined' ? router[trimmedPath] : handlers.notFound;

        // Data object to send to the handler
        const data = {
            trimmedPath,
            queryStringObj,
            method,
            headers,
            'payload': helpers.parseJSONToObject(buffer)
        };
        
        // Route the request to the router specified in the handler
        choosenHandler(data, (statusCode, payload) => {
            // Use the statuscode called back by the handler or default to 200
            statusCode = typeof(statusCode) == 'number' ? statusCode : 200;

            // Use the payload defined by the handler or default to an empty object
            payload = typeof(payload) == 'object' ? payload : {};

            // Convert payload to a string to send to the user
            const payloadString = JSON.stringify(payload);

            // Return the response
            res.setHeader('Content-Type', 'application/json'); // telling the browser that we are sending JSON and parse it to JSON
            res.writeHead(statusCode); // Writing the status code
            res.end(payloadString);
        });
    });
}

// Define the routes here
const router = {
    'users': handlers.users,
    'tokens': handlers.tokens,
    'checks': handlers.checks
};