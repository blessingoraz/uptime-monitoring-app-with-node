/**
 * Helpers for various files
 * 
 */

// Dependencies
const https = require('https');
const crypto = require('crypto');
const queryString = require('querystring');
const path = require('path');
const fs = require('fs');
const config = require('./config');

// Container for all helpers
const helpers = {};

// Create a SHA256 hash
helpers.hashed = (str) => {
    if (typeof (str) == 'string' && str.length > 0) {
        const hash = crypto.createHmac('sha256', config.hashingSecret).update(str).digest('hex');
        return hash;
    } else {
        return false
    }
}

// Parse a JSON string to an object in all cases without throwing
helpers.parseJSONToObject = (str) => {
    try {
        const obj = JSON.parse(str);
        return obj;
    } catch (e) {
        return {}
    }
}

// Create a string of random characters of a given length
helpers.createRandomString = (strLength) => {
    strLength = typeof strLength == 'number' && strLength > 0 ? strLength : false
    if (strLength) {
        // Possible characters that can be in the random string
        let possibleCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789'

        // Final string
        let str = ''
        for (let i = 1; i <= strLength; i++) {
            // Get a random character from possibleCharacters
            let randomCharacter = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));
            // Append random characters to final strinf
            str += randomCharacter
        }
        // Return final string
        return str
    } else {
        return false
    }
}

// Send SMS via Twilio
helpers.sendTwilioSMS = (phone, msg, callback) => {
    // Validate the parameters
    phone = typeof (phone) == 'string' && phone.trim().length == 10 ? phone : false;
    msg = typeof (msg) == 'string' && msg.trim().length > 0 && msg.trim().length < 1600 ? msg : false;

    if (phone && msg) {
        // Configure the request payload to send to twilio
        const payload = {
            'From': config.twilio.fromPhone,
            'To': '+234' + phone,
            msg
        };

        // Stringify the payload
        const stringPayload = queryString.stringify(payload);

        //Configure the request details
        const requestDetails = {
            'protocol': https,
            'hostname': 'api.twilio.com',
            'method': 'POST',
            'path': `/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`,
            'auth': `${config.twilio.accountSid}:${config.twilio.authToken}`,
            'headers': {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(stringPayload)
            }
        };

        // Instatiate the request object
        const req = https.request(requestDetails, (res) => {
            // Grab the status of the sent request
            const status = res.statusCode;
            // Callback successfully if the request went through
            if (status == 200 || status == 201) {
                callback(false)
            } else {
                callback(`Status code returned was ${status}`)
            }
        })

        // Bind to the error event so it doesn't throw(We don't want any error to kill event)
        req.on('error', (e) => {
            callback(e)
        })

        // Add payload to the request
        req.write(stringPayload)

        // End thr request
        req.end()

    } else {
        callback('Given parameters were missing or invalid')
    }
}

// Get the string content of a template
helpers.getTemplate = (templateName, data, callback) => {
    templateName = typeof (templateName) == 'string' && templateName.length > 0 ? templateName : false;
    data = typeof (data) == 'object' && data !== null ? data : {};
    if (templateName) {
        const templatesDir = path.join(__dirname, '/../templates/');
        fs.readFile(templatesDir + templateName + '.html', 'utf-8', (err, str) => {
            if (!err && str && str.length > 0) {
                // Do interpolation on the string

                const finalString = helpers.interpolate(str, data);
                callback(false, finalString)
            } else {
                callback('No template could be found');
            }
        })
    } else {
        callback('A valid template name wasn\'t provided')
    }
}

// Add the universal header and footer to a string and pass the provided data for interpolation
helpers.addUniversalTemplate = (str, data, callback) => {
    str = typeof (str) == 'string' && str.length > 0 ? str : '';
    data = typeof (data) == 'object' && data !== null ? data : {};
    // Get the headers
    helpers.getTemplate('_header', data, (err, headerString) => {
        if(!err && headerString) {
            // Get the footer
            helpers.getTemplate('_footer', data, (err, footerString) => {
                if(!err && footerString) {
                    // Add all the template together
                    const fullString = headerString + str + footerString;
                    callback(false, fullString);
                } else {
                    callback('Could nit find the footer template')
                }
            });
        } else {
            callback('Could not find the header template')
        }
    });
}

// Take a given string and a data object and replace all the keys within it
helpers.interpolate = (str, data) => {
    str = typeof (str) == 'string' && str.length > 0 ? str : '';
    data = typeof (data) == 'object' && data !== null ? data : {};
    // Add the templateGlobals to the data object, prepending their key name with global
    for (let keyName in config.templateGlobals) {
        if (config.templateGlobals.hasOwnProperty(keyName)) {
            data['global.' + keyName] = config.templateGlobals[keyName];
        }
    }

    // For each key in the data object, inserts it's value of string at it's corresponding placeholder
    for (let key in data) {
        if (data.hasOwnProperty(key) && typeof (data[key]) == 'string') {
            let replace = data[key];
            let find = `{${key}}`;

            str = str.replace(find, replace);
        }
    }

    return str;
}

// Get the content of a static(public) asset
helpers.getStaticAsset = (fileName, callback) => {
    fileName = typeof(fileName) == 'string' ? fileName : false;
    if(fileName) {
        publicDir = path.join(__dirname, '/../public/');
        fs.readFile(publicDir + fileName , (err, data) => {
            if(!err) {
                callback(false, data);
            } else {
                callback('No file could be found')
            }
        })
    } else {
        callback('A valid file name was not specified ')
    }
}

module.exports = helpers;