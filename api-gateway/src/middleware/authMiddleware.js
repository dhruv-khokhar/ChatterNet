// to get 'x-user-id' header for userId in other services like post-service

const logger = require("../utils/logger");
const jwt = require('jsonwebtoken');    // to verify the token

const validateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];    // HTTP headers are case-insensitive but always use lowercase in case Node/Express
    // next get the token from the authHeader -> we'll be passing this from Postman whenever we do any request
    const token = authHeader && authHeader.split(" ")[1];  // split with space since we'll have "Bearer <token>" and then get the first element ie token
    if(!token){ // no token present
        logger.warn('Access attempt without valid token!');
        return res.status(401).json({
            message : 'Authentication Required',
            success : false
        })
    }
    // token present -> verify it
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if(err){
            logger.warn('Invalid token!');
            return res.status(429).json({
                message : 'Invalid token!',
                success : false
            })
        }
        // if no error ie token valid
        req.user = user;    // Attaches decoded user payload to the request
        next(); // request continues only if token is valid
    });
}

module.exports = validateToken;