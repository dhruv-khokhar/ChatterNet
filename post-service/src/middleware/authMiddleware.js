const logger = require('../utils/logger');

const authenticateRequest = (req, res, next) => {
    const userId = req.headers['x-user-id'];    // this header we'll get from API gateway -> this header gives the userId -> to get this from API Gateway, we create a middleware (authMiddleware) for this there
    if(!userId){    // userId not present
        logger.warn('Access attempted without User ID');
        return res.status(401).jsoon({  // 401 -> unauthorized
            success : false,
            message : 'Authentication Required! Please login to continue.'
        })
    }
    // userId present -> attach to the request's user field
    req.user = {userId};
    next();
}

module.exports = {
    authenticateRequest,
};