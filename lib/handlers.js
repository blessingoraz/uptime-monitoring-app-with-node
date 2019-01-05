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
    if(acceptableMethods.indexOf(data.method) > -1) {
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
    const firstName = typeof (data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false; 
    const lastName = typeof (data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
    const phone = typeof (data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false; 
    const password = typeof (data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false; 
    const tosAgreement = typeof (data.payload.tosAgreement) == 'boolean' && data.payload.tosAgreement == true ? true : false; 

    if(firstName && lastName && phone && password && tosAgreement ) {
        // Make sure user doesn't already exist by reading from user data
        _data.read('users', phone, (data, err) => {
            if(!err) {
                // Hash the password
                const hashedPassword = helpers.hashed(password);

                // Create the user object
                if(hashedPassword) {
                    const userObject = {
                        firstName,
                        lastName,
                        phone,
                        hashedPassword,
                        'tosAgreement': true
                    }
    
                    // Store the user
                    _data.create('users', phone, userObject, (err) => {
                        if(!err) {
                            console.log('userObject ===', userObject)
                            callback(200);
                        } else {
                            callback(500, {'Error': 'Could not create the new user'})
                        }
                    });
                } else {
                    callback(500, {'Error': 'Couldn\t not hash the user\s password'});
                }
            } else {
                // User already exist
                callback(400, {'Error': 'A user with that phone number already exist'});
            }
        });
        
    } else {
        callback(400, {'Error': 'Missing required fields'});
    }
}

// Users - GET
// Require data: phone
// Optional data: none
handlers._users.get = (data, callback) => {
    // Check that the phone number is valid
    const phone = typeof(data.queryStringObj.phone) == 'string' && data.queryStringObj.phone.trim().length == 10 ? data.queryStringObj.phone.trim() : false;
    if(phone) {
        // Lookup user
        _data.read('users', phone, (err, data) => {
            if(!err && data) {
                // Remove the hashed password before returning data to user
                delete data.hashedPassword;
                callback(200, data)
            } else {
                callback(404)
            }
        })
    } else {
        callback(400, {'Error': 'Missing required field'})
    }

}

// Users - PUT
// Require data: phone
// Optional data: firstName, lastName
handlers._users.put = (data, callback) => {
    // Check for required field
    const phone = typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
    
    // Check for optional fields
    const firstName = typeof (data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false; 
    const lastName = typeof (data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
    const password = typeof (data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false; 

    // Error if the phone is invalid
    if(phone) {
        if(firstName || lastName || password) {
            // Lookup user
            _data.read('users', phone, (err, userData) => {
                if(!err && userData) {
                    // Update necessary fields
                    if(firstName) {
                        userData.firstName = firstName;
                    }
                    if(lastName) {
                        userData.lastName = lastName;
                    }
                    if(password) {
                        userData.hashedPassword = helpers.hashed(password);
                    }

                    // Store the new update
                    _data.update('users', phone, userData, (err) => {
                        if(!err) {
                            callback(200)
                        } else {
                            callback(500, {'Error': 'Couldn\t update the user'});
                        }
                    });
                } else {
                    callback(400, {'Error': 'Specified user does not exist'});
                }
            })
        } else {
            callback(400, {'Error': 'Missing fields to update'})
        }
    } else {
        callback(400, {'Error': 'Missing required field'})
    }
}

// Users - DELETE
// Required data: phone
// Optional data: none
handlers._users.delete = (data, callback) => {
    // Check that the phone number is valid
    const phone = typeof(data.queryStringObj.phone) == 'string' && data.queryStringObj.phone.trim().length == 10 ? data.queryStringObj.phone.trim() : false;
    // Error if phone is not valid
    if(phone) {
        // Lookup user
        _data.read('users', phone, (err, data) => {
            if(!err && data) {
                _data.delete('users', phone, (err) => {
                    if(!err) {
                        callback(200, {'Success': 'User was successfully deleted'});
                    } else {
                        callback(500, {'Error': 'Couldn\t delete the user'})
                    }
                })
            } else {
                callback(400, {'Error': 'The specified user does not exist'})
            }
        })
    } else {
        callback(400, {'Error': 'Missing required field'})
    }
}

// Not found handlers
handlers.notFound = (data, cb) => {
    cb(404);
}

module.exports = handlers;