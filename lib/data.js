/**
 * Library for storing data
 * 
 */

// Dependencies
const fs = require('fs');
const path = require('path'); //Normalize paths 
const helpers = require('./helpers');

// Container of module to be expected
const lib = {};

// Base dir of the data folder
lib.baseDir = path.join(__dirname, '/../.data/'); // Make it into one clean path i.e app/.data
// write data to a file
lib.create = (dir, file, data, callback) => {
    // Open the file for writing
    // fileDescriptor is a way to uniquely identify file
    fs.open(lib.baseDir + dir + '/' + file + '.json', 'wx', (err, fileDescriptor) => {
        if (!err && fileDescriptor) {
            // Convert data to string
            const stringData = JSON.stringify(data);

            // Write to file and close
            fs.writeFile(fileDescriptor, stringData, (err) => {
                if (!err) {
                    // Close file
                    fs.close(fileDescriptor, (err) => {
                        if (!err) {
                            callback(false)
                        } else {
                            callback('Error closing the file')
                        }
                    })
                } else {
                    callback('Error writing to a new file')
                }
            })
        } else {
            callback('Could not create a new file, it might already exist');
        }
    });
}

// Read data from file
lib.read = (dir, file, callback) => {
    fs.readFile(lib.baseDir + dir + '/' + file + '.json', 'utf-8', (err, data) => {
        if(!err && data) {
            const parsedData = helpers.parseJSONToObject(data);
            callback(false, parsedData);
        } else {
            callback(err, data);
        }
    });
}

// Update existing file with new data
lib.update = (dir, file, data, callback) => {
    //Open the file for writing
    // r+ means open for writing and error out if the file already exist
    fs.open(lib.baseDir + dir + '/' + file + '.json', 'r+', (err, fileDescriptor) => {
        if (!err && fileDescriptor) {
            // Convert data to string
            const stringData = JSON.stringify(data);

            //Truncate file before you write to it
            fs.ftruncate(fileDescriptor, (err) => {
                if (!err) {
                    // Write into file and close it
                    fs.writeFile(fileDescriptor, stringData, (err) => {
                        if (!err) {
                            //Close the file
                            fs.close(fileDescriptor, (err) => {
                                if (!err) {
                                    callback(false);
                                } else {
                                    callback('There was an error closing the file');
                                }
                            })
                        } else {
                            callback('Error writing to an existing file')
                        }
                    })
                } else {
                    callback('Error truncating file');
                }
            })
        } else {
            callback('Could not open the file for updating, it may not exist')
        }
    })
}

// Delete file
lib.delete = (dir, file, callback) => {
    //Unlinking(removing file from the file system)
    fs.unlink(lib.baseDir + dir + '/' + file + '.json', (err) => {
        if (!err) {
            callback(false)
        } else {
            callback('Error deleting the file');
        }
    })
}

// Export the module
module.exports = lib;