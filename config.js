/**
 * Create and export configuration variables
 * 
 */

 // Container for all environments
 let environments = {};

 // Staging or default environment
environments.staging = {
    'httpPort': 3000,
    'httpsPort': 3100,
    'envName': 'staging'
}


 // Production environment
 environments.production = {
    'httpPort': 5000,
    'httpsPort': 5100,
    'envName': 'production'
}

// Determine which env should be exported
let currentEnvironment = typeof(process.env.NODE_ENV) == 'string' ? process.env.NODE_ENV.toLowerCase() : '';

// Check that the current env is one of the ones defined in our config above, else default to staging env
const environmentToExport = typeof(environments[currentEnvironment]) == 'object' ? environments[currentEnvironment] : environments.staging;
// Export the module
module.exports = environmentToExport;
