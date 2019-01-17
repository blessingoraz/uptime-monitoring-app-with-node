/**
 * These are workers related tasks
 * 
 */

const http = require('http')
const https = require('https')
const path = require('path')
const fs = require('fs')
const url = require('url');

const data = require('./data')
const helpers = require('./helpers')
const _logs = require('./logs');

// Instatiate workers object
const workers = {};

// Look up checks and gather the data and send to a validator
workers.gatherAllChecks = () => {
    // Get all checks that exist in the system
    data.list('checks', (err, checks) => {
        if (!err && checks && checks.length > 0) {
            checks.forEach((check) => {
                // Read in the check data by passing the check name to data.read
                data.read('checks', check, (err, originalCheckData) => {
                    if (!err && originalCheckData) {
                        // Pass the data to the check validator and let the function continue to log errors as needed
                        workers.validatCheckData(originalCheckData);
                    } else {
                        console.log('Error reading one of the checks data')
                    }
                })
            })
        } else {
            console.log('Error, could not find any checks to process');
        }
    })
}

// Check the check data
workers.validatCheckData = (originalCheckData) => {
    // Makde sure the originalcheckdata exist
    let { id, userPhone, protocol, url, method, successCodes, timeoutSeconds } = originalCheckData;

    originalCheckData = typeof (originalCheckData) == 'object' && originalCheckData !== null ? originalCheckData : false;
    id = typeof (id) == 'string' && id.trim().length == 20 ? id : false;
    userPhone = typeof (userPhone) == 'string' && userPhone.trim().length == 10 ? userPhone : false;
    protocol = typeof (protocol) == 'string' && ['http', 'https'].indexOf(protocol) > -1 ? protocol : false;
    url = typeof (url) == 'string' && url.trim().length > 0 ? url : false;
    method = typeof (method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(method) > -1 ? method : false;
    successCodes = typeof (successCodes) == 'object' && successCodes instanceof Array && successCodes.length ? successCodes : false;
    timeoutSeconds = typeof (timeoutSeconds) == 'number' && timeoutSeconds % 1 === 0 && timeoutSeconds >= 1 && timeoutSeconds <= 5 ? timeoutSeconds : false;

    // Set the keys that might not be set if the workers haven't seen the check before
    originalCheckData.state = typeof (originalCheckData.state) == 'string' && ['up', 'down'].indexOf(originalCheckData.state) > -1 ? originalCheckData.state : 'down';
    originalCheckData.lastChecked = typeof (originalCheckData.lastChecked) == 'number' && originalCheckData.lastChecked > 0 ? originalCheckData.lastChecked : false;

    // If all the check pass, pass data along to the next process
    if (id && userPhone && protocol && url && method && successCodes && timeoutSeconds) {
        workers.performCheck(originalCheckData);
    } else {
        console.log('Error: One of the checks is not properly formated. Skip it')
    }
}

// Perform the check, check the original check data, and record an outcome
workers.performCheck = (originalCheckData) => {
    const { protocol, url: checkUrl, method, timeoutSeconds } = originalCheckData;
    // Prepare the initial check outcome
    const checkOutcome = {
        'error': false,
        'responseCode': false
    }

    // Mark that the outcome has not be sent yet
    let outcomeSent = false;

    // Parse the hostname and the path out of the originalCheckData
    const parsedUrl = url.parse(`${protocol}://${checkUrl}`, true);
    const hostName = parsedUrl.hostname;
    const path = parsedUrl.path; // Using path not pathname cos we want the full query string

    // Constructing the request
    const requestDetails = {
        'protocol': `${protocol}:`,
        'hostname': hostName,
        'method': method.toUpperCase(),
        'path': path,
        'timeout': timeoutSeconds * 1000
    }

    // Instatiate the request object using either http or https module
    const _moduleToUse = protocol == 'http' ? http : https;
    const req = _moduleToUse.request(requestDetails, (res) => {
        // Get the status of the sent request
        const status = res.statusCode;

        // Update the checkOutcome and pass the data along
        checkOutcome.responseCode = status;
        if (!outcomeSent) {
            workers.processCheckOutcome(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    });

    // Bind to the error event so that it doesn't get thrown
    req.on('error', (e) => {
        // Update the checkOutcome and pass the data along
        checkOutcome.error = {
            'error': true,
            'value': e
        }
        if (!outcomeSent) {
            workers.processCheckOutcome(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    });

    // Bind to the timeout event
    req.on('timeout', (e) => {
        // Update the checkOutcome and pass the data along
        checkOutcome.error = {
            'error': true,
            'value': 'timeout'
        }
        if (!outcomeSent) {
            workers.processCheckOutcome(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    });

    // End the request
    req.end();
};

// Process the check outcome and update the check data and trigger an alert to the user when needed
// Logic to accommodate a check that has not be tested.
workers.processCheckOutcome = (originalCheckData, checkOutcome) => {
    // Decide if the check is considered up or down
    const state = !checkOutcome.err && checkOutcome.responseCode && originalCheckData.successCodes.indexOf(checkOutcome.responseCode) > -1 ? 'up' : 'down';

    // Decide if an alert needs to be sent
    const alertWarranted = originalCheckData.lastChecked && originalCheckData.state !== state ? true : false;

    // Update the check data
    const newCheckData = originalCheckData;
    newCheckData.state = state;
    newCheckData.lastChecked = Date.now();

    // Log the outcome
    const timeOfCheck = Date.now();
    workers.log(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck)

    // Save the update
    data.update('checks', newCheckData.id, newCheckData, (err) => {
        if (!err) {
            // Send new check to the next process
            if (alertWarranted) {
                workers.alertUserToStatusChange(newCheckData);
            } else {
                console.log('Check outcome has not changed. No alert needed')
            }
        } else {
            console.log('Error: Trying tp save update to one of the checks')
        }
    })
}

// Alert the user when there is a change in the status
workers.alertUserToStatusChange = (newCheckData) => {
    const msg = `Alert: Your check for ${newCheckData.method.toUpperCase()} ${newCheckData.protocol}://${newCheckData.url} is currently ${newCheckData.state}`;
    helpers.sendTwilioSMS(newCheckData.userPhone, msg, (err) => {
        if (!err) {
            console.log('Success: User was alerted with the status to the change in the check')
        } else {
            console.log('Error: Could not send sms to user who had a state change');
        }
    })
}

workers.log = (originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck) => {
    // Form the log data
    const logData = {
        'check': originalCheckData,
        'outcome': checkOutcome,
        'state': state,
        'alert': alertWarranted,
        'time': timeOfCheck
    };

    // Convert logData to a string
    const logString = JSON.stringify(logData);

    // Determine the name of the log file
    const logFileName = originalCheckData.id;

    // Append the logString to the file we want to write to

    _logs.append(logFileName, logString, (err) => {
        if (!err) {
            console.log('Logging to file succeeded');
        } else {
            console.log('Error: Logging to file failed')
        }
    })
}

// Timer to execute the timer check once per minute
workers.loop = () => {
    setInterval(() => {
        workers.gatherAllChecks();
    }, 1000 * 60);
}

// Rotate or compress the log files
workers.rotateLogs = () => {
    // List all the non compressed log files 
    _logs.list(false, (err, logs) => {
        if (!err && logs && logs.length > 0) {
            logs.forEach((logName) => {
                // Compress data to a different file
                const logId = logName.replace('.log', '');
                const newFileId = logId + '-' + Date.now();
                _logs.compress(logId, newFileId, (err) => {
                    if(!err) {
                        // Truncating the log i.e emptying everything out from the llog file after taking the content and moving to a new file
                        _logs.truncate(logId, (err) => {
                            if(!err) {
                                console.log('Success truncating log file')
                            } else {
                                console.log('Error: Truncating log file')
                            }
                        })
                    } else {
                        console.log('Error: Compressing one of the log files')
                    }
                });
            })
        } else {
            console.log('Error: Could not find any log to rotate')
        }
    })
}

// Timer to execute the log rotation process once per day
workers.logRotationLoop = () => {
    setInterval(() => {
        workers.rotateLogs();
    }, 1000 * 60 * 60 * 24);
}
//Init script
workers.init = () => {
    //Execute all the checks
    workers.gatherAllChecks();

    //Call the loop so that the checks will execute
    workers.loop();

    // Compress logs 
    workers.rotateLogs();

    // Call the compression loops so logs will be compressed
    workers.logRotationLoop();

}

// Export the module
module.exports = workers;