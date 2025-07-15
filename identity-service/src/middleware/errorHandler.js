// first get the logger
const logger = require('../utils/logger');

// create error handler
const errorHandler = (err, req, res, next) => {
    logger.error(err.stack);    // log the error stack trace

    res.status(err.status || 500).json({  // if error's status is available so render that, otherwise give 500
        message : err.message || 'Internal Server Error',

    })
};

module.exports = errorHandler;