// same as identity-service

const winston = require('winston'); // first import winston

const logger = winston.createLogger({
    // set the logging level based on the env variable
    level : process.env.NODE_ENV === 'production' ? 'info' : 'debug',   // if envt is production then level is info otherwise in dev, its debug - check winston logging levels (0-7)
    format : winston.format.combine(    // this defines how we'll format the messages ie logs
        winston.format.timestamp(), // so every log in the file first has a timestamp 
        winston.format.errors({stack : true}),  // then include the stack trace in the log entry if there is any error
        winston.format.splat(),  // for string interpolation (ie inserting variables into a string) | splat() enables support for message templating
        winston.format.json()   // at the end, format all log messages in JSON for structured logging
        // all this is combined in one format using .combine()
    ),
    defaultMeta : {service : 'search-service'},   // here we are just giving the metadata - what service we are using for this particular logger
    transports : [  // this specifies the transport or output destination for your log
        new winston.transports.Console({    // first, whatever log we have, get them in our console | "winston.transports.Console" means it will be a console transport -> logs appear in the terminal(console) whenever we get some logs
            format : winston.format.combine(    // this describes the format of the logs in our console
                winston.format.colorize(),  // colorize it for better readability (errors in red, warnings in yellow, etc.)
                winston.format.simple() // and make it simple ie no JSON in console -> makes it easier for humans
            ),
        }),
        new winston.transports.File({filename : 'error.log', level : 'error'}),   // create 2 files - one to log errors in that file if any and other will have combined logs | pass level of the things you want to log
        new winston.transports.File({filename : 'combined.log'})    // no level here - so all logs here
    ],
});

module.exports = logger;