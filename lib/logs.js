/**
 * This is a library for storing and rotating logs
 * 
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Container for the module
const lib = {};

// Base dir of the data folder
lib.baseDir = path.join(__dirname, '/../.logs/'); // Make it into one clean path i.e app/.data

// Append a string to a file, create the file if it doesn't exist
lib.append = (file, str, callback) => {
    // Open the file for appending
    // fileDescriptor is a way to uniquely identify file
    fs.open(lib.baseDir + file + '.log', 'a', (err, fileDescriptor) => {
        if (!err && fileDescriptor) {

            // Append to file and close it
            fs.appendFile(fileDescriptor, str + '\n', (err) => {
                if (!err) {
                    // Close file
                    fs.close(fileDescriptor, (err) => {
                        if (!err) {
                            callback(false);
                        } else {
                            callback('Error closing the file')
                        }
                    })
                } else {
                    callback('Error appending to file')
                }
            })
        } else {
            callback('Could not open file for appending, it might already exist');
        }
    });
}

// List all the logs and include compressed logs
lib.list = (includeCompressedLogs, callback) => {
    fs.readdir(lib.baseDir, (err, data) => {
        if(!err && data && data.length > 0) {
            let trimmedFileNames = [];
            data.forEach((fileName) => {
                // Add the .log files
                if(fileName.indexOf('.log') > -1) {
                    trimmedFileNames.push(fileName.replace('.log', ''))
                }

                // Add on the .gz files
                if(fileName.indexOf('.gz.b64') > -1 && includeCompressedLogs) {
                    trimmedFileNames.push(fileName.replace('.gz.b64', ''));
                }
            })
            callback(false, trimmedFileNames);
        } else {
            callback(err, data);
        }
    })
}

// Compress the content of one .log file into .gz.b64 within the same directory
lib.compress = (logId, newFieldId, callback) => {
    const sourceFile = logId+'.log';
    const destinationFile = newFieldId+'.gz.b64';

    // Read the source files
    fs.readFile(lib.baseDir+sourceFile, 'utf-8', (err, inputString) => {
        if(!err && inputString) {
            // Compress the data using gzip
            zlib.gzip(inputString, (err,  buffer) => {
                if(!err &&  buffer) {
                    // Send data to the destination file
                    fs.open(lib.baseDir+destinationFile, 'wx', (err, fileDescriptor) => {
                        if(!err && fileDescriptor) {
                            // Continue to write to the destination files
                            fs.writeFile(fileDescriptor, buffer.toString('base64'), (err) => {
                                if(!err) {
                                    // Close the destination file
                                    fs.close(fileDescriptor, (err) => {
                                        if(!err) {
                                            callback(false)
                                        } else {
                                            callback(err)
                                        }
                                    })
                                } else {
                                    callback(err);
                                }
                            })
                        } else {
                            callback(err)
                        }
                    })
                } else {
                    callback(err)
                }
            })
        } else {
            callback(err);
        }
    });
}

// Decompress the content of a .gz.b64 file into a string
lib.decompress = (fileId, callback) => {
    const fileName = fileId+'.gz.b64';
    fs.readFile(lib.baseDir+fileName, 'utf-8', (err, str) => {
        if(!err && str) {
            // Decompress the data
            const inputBuffer = new Buffer.from(str, 'base64');
            zlib.unzip(inputBuffer, (err, outputBuffer) => {
                if(!err && outputBuffer) {
                    let str = outputBuffer.toString();
                    callback(false, str)
                } else {
                    callback(err)
                }
            })
        } else {
            callback(err)
        }
    })
}

// Truncate a log file
lib.truncate = (logId, callback) => {
    fs.truncate(lib.baseDir+logId+'.log', 0, (err) => {
        if(!err) {
            callback(false)
        } else {
            callback(err)
        }
    })
}


// Export module
module.exports = lib;