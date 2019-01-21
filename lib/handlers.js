/**
 * Request Handlers
 * 
 */

// Dependencies
const _data = require('./data');
const helpers = require('./helpers');
const config = require('./config');

// Define handlers
const handlers = {};
/**
 * HTML Handlers
 * 
 */

 // Index handler
 handlers.index = (data, callback) => {
    // Reject any request that isn't a GET
    if(data.method == 'get') {
        // Prepare data for interpolation
        var templateData = {
            'head.title': 'This is the title',
            'head.description': 'This is the header description',
            'body.title': 'Hello template world',
            'body.class': 'index'
        }
        // Read in the index template as string
        helpers.getTemplate('index', templateData, (err, str) => {
            if(!err && str) {
                // Add the universal templates
                helpers.addUniversalTemplate(str, templateData, (err, str) => {
                    if(!err && str) {
                        callback(200, str, 'html')
                    } else {
                        callback(500, undefined, 'html')
                    }
                })
            } else {
                callback(500, undefined, 'html')
            }
        })
    } else {
        callback(405, undefined, 'html')
    }
 }

 // Favicon
 handlers.favicon = (data, callback) => {
    // Reject any request that isn't a GET
    if(data.method == 'get') {
        // Read in the favicon's data
        helpers.getStaticAsset('favicon.ico', (err, data) => {
            if(!err && data) {
                // Callback the data
                callback(200, data, 'favicon')
            } else {
                callback(500)
            }
        });
    } else {
        callback(405)
    }
 };

// Public Assests
handlers.favicon = (data, callback) => {
    // Reject any request that isn't a GET
    if(data.method == 'get') {
        // Get the file name being requested
        const trimmedAssetName = data.trimmedPath.replace('public/', '');
        if(trimmedAssetName > 0) {
            // Read in the asset data
            helpers.getStaticAsset(trimmedAssetName, (err, data) => {
                if(!err && data) {
                    // Determine the content type and default to plain text
                    let contentType = 'plain';
                    if(trimmedAssetName.includes('.css')) {
                        contentType = 'css';
                    }
                    if(trimmedAssetName.includes('.png')) {
                        contentType = 'png';
                    }
                    if(trimmedAssetName.includes('.jpg')) {
                        contentType = 'jpg';
                    }
                    if(trimmedAssetName.includes('.ico')) {
                        contentType = 'favicon';
                    }
                    // Callback the data
                    callback(200, data, contentType);
                } else {
                    callback(404)
                }
            })
        } else {
            callback(404);
        }
    } else {
        callback(405)
    }

/**
 * JSON API handlers
 * 
 */

// Users
handlers.users = (data, callback) => {
    const acceptableMethods = ['post', 'get', 'put', 'delete'];
    if (acceptableMethods.includes(data.method)) {
        handlers._users[data.method](data, callback)
    } else {
        callback(405)
    }
};

// Containers for users sub methods
handlers._users = {};

// Users - POST
// Required fields: firstName, lastName, phone, password, tosAgreement
handlers._users.post = (data, callback) => {
    // Check that all the required fields are filled put
    let { firstName, lastName, phone, password, tosAgreement } = data.payload;
    firstName = typeof (firstName) == 'string' && firstName.trim().length > 0 ? firstName.trim() : false;
    lastName = typeof (lastName) == 'string' && lastName.trim().length > 0 ? lastName.trim() : false;
    phone = typeof (phone) == 'string' && phone.trim().length == 10 ? phone.trim() : false;
    password = typeof (password) == 'string' && password.trim().length > 0 ? password.trim() : false;
    tosAgreement = typeof (tosAgreement) == 'boolean' && tosAgreement == true ? true : false;

    if (firstName && lastName && phone && password && tosAgreement) {
        // Make sure user doesn't already exist by reading from user data
        _data.read('users', phone, (data, err) => {
            if (!err) {
                // Hash the password
                const hashedPassword = helpers.hashed(password);

                // Create the user object
                if (hashedPassword) {
                    const userObject = {
                        firstName,
                        lastName,
                        phone,
                        hashedPassword,
                        'tosAgreement': true
                    }

                    // Store the user
                    _data.create('users', phone, userObject, (err) => {
                        if (!err) {
                            callback(200);
                        } else {
                            callback(500, { 'Error': 'Could not create the new user' })
                        }
                    });
                } else {
                    callback(500, { 'Error': 'Couldn\'t not hash the user\'s password' });
                }
            } else {
                // User already exist
                callback(400, { 'Error': 'A user with that phone number already exist' });
            }
        });

    } else {
        callback(400, { 'Error': 'Missing required fields' });
    }
}

// Users - GET
// Require data: phone
// Optional data: none
handlers._users.get = (data, callback) => {
    // Check that the phone number is valid
    let { phone } = data.queryStringObj;
    phone = typeof (phone) == 'string' && phone.trim().length == 10 ? phone.trim() : false;
    if (phone) {
        // Get the token from the headers
        let { token } = data.headers;
        token = typeof (token) == 'string' ? token : false;

        // Verify that the given token is valid for the phone
        handlers._tokens.verifyToken(token, phone, (tokenIsValid) => {
            if (tokenIsValid) {
                // Lookup user
                _data.read('users', phone, (err, data) => {
                    if (!err && data) {
                        // Remove the hashed password before returning data to user
                        delete data.hashedPassword;
                        callback(200, data)
                    } else {
                        callback(404)
                    }
                })
            } else {
                callback(403, { 'Error': 'Missing required token in header or token is invalid' })
            }
        })
    } else {
        callback(400, { 'Error': 'Missing required field' })
    }

}

// Users - PUT
// Require data: phone
// Optional data: firstName, lastName
handlers._users.put = (data, callback) => {
    // Check for required field
    let { phone, firstName, lastName, password } = data.payload;
    phone = typeof (phone) == 'string' && phone.trim().length == 10 ? phone.trim() : false;

    // Check for optional fields
    firstName = typeof (firstName) == 'string' && firstName.trim().length > 0 ? firstName.trim() : false;
    lastName = typeof (lastName) == 'string' && lastName.trim().length > 0 ? lastName.trim() : false;
    password = typeof (password) == 'string' && password.trim().length > 0 ? password.trim() : false;

    // Error if the phone is invalid
    if (phone) {
        if (firstName || lastName || password) {

            // Get the token from the headers
            let { token } = data.headers;
            token = typeof (token) == 'string' ? token : false;

            // Verify that the given token is valid for the phone
            handlers._tokens.verifyToken(token, phone, (tokenIsValid) => {
                if (tokenIsValid) {
                    // Lookup user
                    _data.read('users', phone, (err, userData) => {
                        if (!err && userData) {
                            // Update necessary fields
                            if (firstName) {
                                userData.firstName = firstName;
                            }
                            if (lastName) {
                                userData.lastName = lastName;
                            }
                            if (password) {
                                userData.hashedPassword = helpers.hashed(password);
                            }

                            // Store the new update
                            _data.update('users', phone, userData, (err) => {
                                if (!err) {
                                    callback(200)
                                } else {
                                    callback(500, { 'Error': 'Couldn\'t update the user' });
                                }
                            });
                        } else {
                            callback(400, { 'Error': 'Specified user does not exist' });
                        }
                    })
                } else {
                    callback(403, { 'Error': 'Missing required token in header or token is invalid' })
                }
            })
        } else {
            callback(400, { 'Error': 'Missing fields to update' })
        }
    } else {
        callback(400, { 'Error': 'Missing required field' })
    }
}

// Users - DELETE
// Required data: phone
// Optional data: none
handlers._users.delete = (data, callback) => {
    // Check that the phone number is valid
    let { phone } = data.queryStringObj;
    phone = typeof (phone) == 'string' && phone.trim().length == 10 ? phone.trim() : false;

    // Error if phone is not valid
    if (phone) {
        // Get the token from the headers
        let { token } = data.headers;
        token = typeof (token) == 'string' ? token : false;

        // Verify that the given token is valid for the phone
        handlers._tokens.verifyToken(token, phone, (tokenIsValid) => {
            if (tokenIsValid) {
                // Lookup user
                _data.read('users', phone, (err, userData) => {
                    if (!err && userData) {
                        _data.delete('users', phone, (err) => {
                            if (!err) {
                                // Delete each of the checks associated with the user
                                let { checks } = userData;
                                let userChecks = typeof (checks) == 'object' && checks instanceof Array ? checks : [];
                                let checksToDelete = userChecks.length;
                                if (checksToDelete > 0) {
                                    let checksDeleted = 0;
                                    let deletionErrors = false;

                                    // Loop throught the checks
                                    userChecks.forEach((checkId) => {
                                        // Delete the check
                                        _data.delete('checks', checkId, (err) => {
                                            if (err) {
                                                deletionErrors = true;
                                            }
                                            checksDeleted++;
                                            if (checksDeleted == checksToDelete) {
                                                if (!deletionErrors) {
                                                    callback(200, { 'Success': 'User was successfully deleted' });
                                                } else {
                                                    callback(500, { 'Error': 'Errors encountered while attempting to delete all of the user checks. ' })
                                                }
                                            }

                                        })
                                    })
                                } else {
                                    callback(200)
                                }
                            } else {
                                callback(500, { 'Error': 'Couldn\'t delete the user' })
                            }
                        })
                    } else {
                        callback(400, { 'Error': 'The specified user does not exist' })
                    }
                })
            } else {
                callback(403, { 'Error': 'Missing required token in header or token is invalid' })
            }
        })
    } else {
        callback(400, { 'Error': 'Missing required field' })
    }
}


// Tokens
handlers.tokens = (data, callback) => {
    const acceptableMethods = ['post', 'get', 'put', 'delete'];
    if (acceptableMethods.includes(data.method)) {
        handlers._tokens[data.method](data, callback)
    } else {
        callback(405)
    }
};

// Containers for users sub methods
handlers._tokens = {};

// Tokens - POST
handlers._tokens.post = (data, callback) => {
    // Required data: phone, password
    // Optional data: none
    let { phone, password } = data.payload;
    phone = typeof (phone) == 'string' && phone.trim().length == 10 ? phone.trim() : false;
    password = typeof (password) == 'string' && password.trim().length > 0 ? password.trim() : false;

    if (phone && password) {
        //Lookup user that matches the phone number
        _data.read('users', phone, (err, userData) => {
            if (!err && userData) {
                // Compare the password provided with password in the store
                const hashedPassword = helpers.hashed(password);
                if (hashedPassword == userData.hashedPassword) {
                    // If valid, create a token with random string that has an expiration date of 1 hour from the time it was created
                    const tokenId = helpers.createRandomString(20)
                    const expires = Date.now() + 1000 * 60 * 60
                    const tokenObj = {
                        phone,
                        id: tokenId,
                        expires
                    }

                    // Store the token
                    _data.create('tokens', tokenId, tokenObj, (err) => {
                        if (!err) {
                            callback(200, tokenObj)
                        } else {
                            callback(500, { 'Error': 'Could not create token' })
                        }
                    })
                } else {
                    callback(400, { 'Error': 'Password did not match the user\'s stored password' })
                }
            } else {
                callback(400, { 'Error': 'Couldn\'t find the specified user' })
            }
        })
    } else {
        callback(400, { 'Error': 'Missing required fields' })
    }
}

// Tokens - GET
// Required data: id
// Optional data: none
handlers._tokens.get = (data, callback) => {
    // Validate Id
    let { id: tokenId } = data.queryStringObj;
    tokenId = typeof (tokenId) == 'string' && tokenId.trim().length == 20 ? tokenId : false;

    if (tokenId) {
        // Lookup id from the tokens file
        _data.read('tokens', tokenId, (err, tokenData) => {
            if (!err && tokenData) {
                callback(200, tokenData)
            } else {
                callback(400, { 'Error': 'Couldn\'t find the token provided' })
            }
        })
    } else {
        callback(400, { 'Error': 'Missing required query string' })
    }
}

// Tokens - PUT
// Required data: tokenId, extend
// Optional data: none
handlers._tokens.put = (data, callback) => {
    // Validate fields
    let { id: tokenId, extend } = data.payload;
    tokenId = typeof (tokenId) == 'string' && tokenId.trim().length == 20 ? tokenId : false;
    extend = typeof (extend) == 'boolean' && extend == true ? true : false;

    if (tokenId && extend) {
        // Lookup the token
        _data.read('tokens', tokenId, (err, tokenData) => {
            if (!err && tokenData) {
                // Check that token is not expired
                if (tokenData.expires > Date.now()) {
                    // Set the expiration an hour from now
                    tokenData.expires = Date.now() + 1000 * 60 * 60;

                    // Store new data
                    _data.update('tokens', tokenId, tokenData, (err) => {
                        if (!err) {
                            callback(200)
                        } else {
                            callback(500, { 'Error': 'Couldn\'t update the token expiration' })
                        }
                    })
                } else {
                    callback(400, { 'Error': 'Token has already expired and can\'t be extended' })
                }
            } else {
                callback(400, { 'Error': 'Couldn\'t find the token' })
            }
        })
    } else {
        callback(400, { 'Error': 'Missing required fields' })
    }
}

// Tokens - DELETE
// Required data: tokenId
// Optional data: none
handlers._tokens.delete = (data, callback) => {
    // Validate field
    let { id: tokenId } = data.queryStringObj;
    tokenId = typeof (tokenId) == 'string' && tokenId.trim().length == 20 ? tokenId : false;

    if (tokenId) {
        // Lookup id
        _data.read('tokens', tokenId, (err, data) => {
            if (!err && data) {
                _data.delete('tokens', tokenId, (err) => {
                    if (!err) {
                        callback(200, { 'Success': 'Token was successfully deleted' })
                    } else {
                        callback(500, { 'Error': 'Could not delete the specified token' })
                    }
                })
            } else {
                callback(400, { 'Error': 'Could not find the token' })
            }
        })
    } else {
        callback(400, { 'Error': 'Missing required field' })
    }
}

// Verify if a given token is valid for a user
handlers._tokens.verifyToken = (tokenId, phone, callback) => {
    _data.read('tokens', tokenId, (err, tokenData) => {
        if (!err && tokenData) {
            // check if token is for given user and it isn't expired
            if (tokenData.phone == phone && tokenData.expires > Date.now()) {
                callback(true)
            } else {
                callback(false)
            }
        } else {
            callback(false)
        }
    })
}

// Checks
handlers.checks = (data, callback) => {
    const acceptableMethods = ['post', 'get', 'put', 'delete'];
    if (acceptableMethods.includes(data.method)) {
        handlers._checks[data.method](data, callback)
    } else {
        callback(405)
    }
};

// Container for all the checks
handlers._checks = {};

// Check - POST
// Required data: protocol, url, method, successCodes, timeoutSeconds
// Optional data: none
handlers._checks.post = (data, callback) => {
    // Validate the data
    let { protocol, url, method, successCodes, timeoutSeconds } = data.payload;

    protocol = typeof (protocol) == 'string' && ['http', 'https'].includes(protocol) ? protocol : false;
    url = typeof (url) == 'string' && url.trim().length > 0 ? url : false;
    method = typeof (method) == 'string' && ['get', 'post', 'put', 'delete'].includes(method) ? method : false;
    successCodes = typeof (successCodes) == 'object' && successCodes instanceof Array && successCodes.length > 0 ? successCodes : false;
    timeoutSeconds = typeof (timeoutSeconds) == 'number' && timeoutSeconds % 1 === 0 && timeoutSeconds >= 1 && timeoutSeconds <= 5 ? timeoutSeconds : false

    if (protocol && url && method && successCodes && timeoutSeconds) {
        // Verify user by token from headers
        let { token } = data.headers;
        token = typeof (token) == 'string' ? token : false;

        // Lookup the user by reading the token
        _data.read('tokens', token, (err, tokenData) => {
            if (!err && token) {
                const userPhone = tokenData.phone;

                // Lookup the user data
                _data.read('users', userPhone, (err, userData) => {
                    if (!err && userData) {
                        let { checks } = userData;
                        let userChecks = typeof (checks) == 'object' && checks instanceof Array ? checks : [];

                        // Verify that user has less than the number of maxChecks per user
                        if (userChecks.length < config.maxChecks) {
                            // Create a random Id for the checks
                            const checkId = helpers.createRandomString(20);

                            // Create the check object and include the user's phone
                            const checkObj = {
                                id: checkId,
                                userPhone,
                                protocol,
                                url,
                                method,
                                successCodes,
                                timeoutSeconds
                            };

                            // Store checks to file
                            _data.create('checks', checkId, checkObj, (err) => {
                                if (!err) {
                                    // Add the check id to the user's object
                                    userData.checks = userChecks;
                                    userData.checks.push(checkId);

                                    // Save the updated user data
                                    _data.update('users', userPhone, userData, (err) => {
                                        if (!err) {
                                            // Return data about the check
                                            callback(200, checkObj);
                                        } else {
                                            callback(500, { 'Error': 'Couldn\'t update the user with the new check' })
                                        }
                                    })
                                } else {
                                    callback(500, { 'Error': 'Couldn\'t not create the new check' })
                                }
                            })

                        } else {
                            callback(400, { 'Error': `The user already has the maximum number of checks(${config.maxChecks})` })
                        }
                    } else {
                        callback(403)
                    }
                })
            } else {
                callback(403)
            }
        })

    } else {
        callback(400, { 'Error': 'Missing required fields' })
    }
};

// Checks - GET
// Required data: id
// Optional data: none
handlers._checks.get = (data, callback) => {
    // Validate Id
    let { id: checkId } = data.queryStringObj;
    checkId = typeof (checkId) == 'string' && checkId.trim().length == 20 ? checkId : false;

    if (checkId) {
        // Lookup id from the checks file
        _data.read('checks', checkId, (err, checkData) => {
            if (!err && checkData) {

                // Get the token from the headers
                let { token } = data.headers;
                token = typeof (token) == 'string' ? token : false;

                // Verify that the given token is valid and belongs to the user who created the check
                handlers._tokens.verifyToken(token, checkData.userPhone, (tokenIsValid) => {
                    if (tokenIsValid) {
                        // Return check data
                        callback(200, checkData);
                    } else {
                        callback(403)
                    }
                });
            } else {
                callback(400, { 'Error': 'Couldn\'t find the check provided' })
            }
        });
    } else {
        callback(400, { 'Error': 'Missing required query string' })
    }
}

// Checks - PUT
// Require data: id
// Optional data: protocol, url, method, successCodes, timeoutSeconds
handlers._checks.put = (data, callback) => {
    // Check for required field
    let { id: checkId } = data.payload;
    checkId = typeof (checkId) == 'string' && checkId.trim().length == 20 ? checkId.trim() : false;

    // Check for optional fields
    // Validate the data
    let { protocol, url, method, successCodes, timeoutSeconds } = data.payload;

    protocol = typeof (protocol) == 'string' && ['http', 'https'].includes(protocol) ? protocol : false;
    url = typeof (url) == 'string' && url.trim().length > 0 ? url : false;
    method = typeof (method) == 'string' && ['get', 'post', 'put', 'delete'].includes(method) ? method : false;
    successCodes = typeof (successCodes) == 'object' && successCodes instanceof Array && successCodes.length > 0 ? successCodes : false;
    timeoutSeconds = typeof (timeoutSeconds) == 'number' && timeoutSeconds % 1 === 0 && timeoutSeconds >= 1 && timeoutSeconds <= 5 ? timeoutSeconds : false

    // Error if the checkid is invalid
    if (checkId) {
        if (protocol || url || method || successCodes || timeoutSeconds) {

            // Lookup the checks by id
            _data.read('checks', checkId, (err, checkData) => {
                if (!err && checkData) {
                    // Get the token from the headers
                    let { token } = data.headers;
                    token = typeof (token) == 'string' ? token : false;

                    // Verify that the given token is valid for the phone
                    handlers._tokens.verifyToken(token, checkData.userPhone, (tokenIsValid) => {
                        if (tokenIsValid) {
                            // Update the check
                            if (protocol) {
                                checkData.protocol = protocol;
                            }
                            if (url) {
                                checkData.url = url;
                            }
                            if (method) {
                                checkData.method = method;
                            }
                            if (successCodes) {
                                checkData.successCodes = successCodes;
                            }
                            if (timeoutSeconds) {
                                checkData.timeoutSeconds = timeoutSeconds;
                            }

                            // Store the new update
                            _data.update('checks', checkId, checkData, (err) => {
                                if (!err) {
                                    callback(200)
                                } else {
                                    callback(500, { 'Error': 'Couldn\'t update the check' });
                                }
                            });
                        } else {
                            callback(403, { 'Error': 'Missing required token in header or token is invalid' })
                        }
                    })

                } else {
                    callback(400, { 'Error': 'Check id did not exist' })
                }
            })
        } else {
            callback(400, { 'Error': 'Missing fields to update' })
        }
    } else {
        callback(400, { 'Error': 'Missing required field' })
    }
}

// Users - DELETE
// Required data: id
// Optional data: none
handlers._checks.delete = (data, callback) => {
    // Check that the phone number is valid
    let { id: checkId } = data.queryStringObj;
    checkId = typeof (checkId) == 'string' && checkId.trim().length == 20 ? checkId.trim() : false;

    // Error if checkId is not valid
    if (checkId) {

        // Lookup check to delete
        _data.read('checks', checkId, (err, checkData) => {
            if (!err && checkData) {
                // Get the token from the headers
                let { token } = data.headers;
                token = typeof (token) == 'string' ? token : false;

                // Verify that the given token is valid for the phone
                handlers._tokens.verifyToken(token, checkData.userPhone, (tokenIsValid) => {
                    if (tokenIsValid) {

                        // Delete the check data
                        _data.delete('checks', checkId, (err) => {
                            if (!err) {
                                // Lookup user
                                _data.read('users', checkData.userPhone, (err, userData) => {
                                    if (!err && userData) {
                                        let { checks } = userData;
                                        let userChecks = typeof (checks) == 'object' && checks instanceof Array ? checks : [];

                                        // Remove the deleted check from the list of checks
                                        let checkPosition = userChecks.indexOf(checkId);
                                        if (checkPosition >= -1) {
                                            userChecks.splice(checkPosition, 1);

                                            // Re-save the users data
                                            _data.update('users', checkData.userPhone, userData, (err) => {
                                                if (!err) {
                                                    callback(200, { 'Success': 'User was successfully deleted' })
                                                } else {
                                                    callback(500, { 'Error': 'Couldn\' update user data' })
                                                }
                                            })

                                        } else {
                                            callback(500, { 'Error': 'Couldn\'t find the check on the user object' })
                                        }
                                    } else {
                                        callback(400, { 'Error': 'Couldn\'t find the user that created the check so check can\'t be deleted' })
                                    }
                                })
                            } else {
                                callback(500, { 'Error': 'Could not delete the check' })
                            }
                        })
                    } else {
                        callback(403, { 'Error': 'Missing required token in header or token is invalid' })
                    }
                })
            } else {
                callback(400, { 'Error': 'The specified check id doesn\'t exist' })
            }
        })
    } else {
        callback(400, { 'Error': 'Missing required field' })
    }
}
// Not found handlers
handlers.notFound = (data, cb) => {
    cb(404);
}

module.exports = handlers;