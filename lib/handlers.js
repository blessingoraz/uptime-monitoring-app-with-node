/**
 * Request Handlers
 * 
 */

// Dependencies
const _data = require('./data');
const helpers = require('./helpers');

// Define handlers
const handlers = {};

// Users
handlers.users = (data, callback) => {
    const acceptableMethods = ['post', 'get', 'put', 'delete'];
    if (acceptableMethods.indexOf(data.method) > -1) {
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
                    callback(500, { 'Error': 'Couldn\t not hash the user\s password' });
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
                                    callback(500, { 'Error': 'Couldn\t update the user' });
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
                _data.read('users', phone, (err, data) => {
                    if (!err && data) {
                        _data.delete('users', phone, (err) => {
                            if (!err) {
                                callback(200, { 'Success': 'User was successfully deleted' });
                            } else {
                                callback(500, { 'Error': 'Couldn\t delete the user' })
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
    if (acceptableMethods.indexOf(data.method) > -1) {
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
                callback(400, { 'Error': 'Couldn\t find the specified user' })
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
                callback(400, { 'Error': 'Couldn\t find the token provided' })
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
                            callback(500, { 'Error': 'Couldn\t update the token expiration' })
                        }
                    })
                } else {
                    callback(400, { 'Error': 'Token has already expired and can\t be extended' })
                }
            } else {
                callback(400, { 'Error': 'Couldn\t find the token' })
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

// Not found handlers
handlers.notFound = (data, cb) => {
    cb(404);
}

module.exports = handlers;