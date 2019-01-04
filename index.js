/**
 * Primary file for the API
 * 
 */

 // Dependecies
const http = require('http');
const https = require('https');
const url = require('url');
const PORT = 3000;
const path = require('path');
const StringDecoder = require('string_decoder').StringDecoder;

// Server responds to all request
const server = http.createServer((req, res) => {
    // Get URL and parse it
    // parsedUrl contains object with different keys
    let parsedUrl = url.parse(req.url, true); // true means we are telling to parse the query string

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
            'payload': buffer
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
            res.writeHead(statusCode); // Writing the status code
            res.end(payloadString);

            // Send the repsonse
            console.log('Payload here ====', statusCode, payloadString);
        });
    });

});

// Start the server to listen on port 3000
server.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`)
});

// Handlers
const handlers = {};

// Sample handler
handlers.sample = (data, cb) => {
    // callback a HTTP status code and a payload which is an obj
    cb(406, {'name': 'Sample handler'});
}

// Not found handlers
handlers.notFound = (data, cb) => {
    cb(404);
}
// Define the routes here
const router = {
    'sample': handlers.sample
};