require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Redis = require('ioredis');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const logger = require('./utils/logger');
const proxy = require('express-http-proxy');    // pkg to redirect api gateway to identity when registering (say)
const errorHandler = require('./middleware/errorHandler');
const validateToken = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

const redisClient = new Redis(process.env.REDIS_URL);

app.use(helmet());
app.use(cors());
app.use(express.json());

// rate limiting - same config as in identity-service
const ratelimitOptions = rateLimit({
    windowMs : 15*60*1000,  // 15m
    max : 100,
    standardHeaders : true,
    legacyHeaders : false,
    handler : (req, res) => {
        logger.warn(`Sensitive Endpoint Rate Limit Exceeded for IP: ${req.ip}`);
        res.status(429).json({  // 429 -> status code for 'Too Many Requests'
            success : false,
            message : "Too Many Requests",
        })
    },
    store : new RedisStore({
        sendCommand : (...args) => redisClient.call(...args)
    }),
});

app.use(ratelimitOptions);

// logging middleware
app.use((req, res, next) => {   // just for logging purpose
    logger.info(`Received ${req.method} request to ${req.url}`);
    logger.info(`Request Body, ${req.body}`);
    next();
});

// This is a config object for the proxy middleware -> common for all microservices
const proxyOptions = {  // we use proxyReqPathResolver() fn where we tell which path we need to replace
    proxyReqPathResolver : (req) => {
        return req.originalUrl.replace(/^\/v1/, "/api");   // replace the original url -> we pass a regex to replace /v1 prefix with /api 
    },
    // also create a proxy error handler -> handles any error during the proxy request
    proxyErrorHandler : (err, res, next) => {
        logger.error(`Proxy Error: ${err.message}`);
        res.status(500).json({
            message : `Internal Server Error`,
            error : err.message,
        });
    },
};

// now set up our proxy for all authentication routes
// setting up proxy for identity-service ie incoming requests with /v1/auth
app.use('/v1/auth', proxy( process.env.IDENTITY_SERVICE_URL, {     // this v1 in original url will get replaced by auth by the proxy and we use proxy() to pass the host ie identity-service-url
    ...proxyOptions,     // pass proxy options here (created above) -> destructure it first using ...
    proxyReqOptDecorator : (proxyReqOpts, srcReq) => {    // we use another func - proxyReqOptDecorator - this allows customization (override request options) of the proxy request (say adding headers, changing method, etc) before it is sent to the target
        proxyReqOpts.headers["Content-Type"] = "application/json"   // header added - ensures the identity-service receives JSON-formatted data
        return proxyReqOpts; // remember to return this back
    },
    // After getting the response from the identity service, you can inspect or change the response before sending to the user.
    userResDecorator : (proxyRes, proxyResData, userReq, userRes) => { // this func is called whenever we receive a response (say after receiving a response from the proxy service, we call identiy-service) -> helps to see if anything went wrong or not
        logger.info(`Response received from Identity Service: ${proxyRes.statusCode}`)  // since we are targetting the identity-service
        return proxyResData;    // return the proxy response data as-is
        // proxyRes = raw response object from target server
	    // proxyResData = actual response data (body)
	    // userReq, userRes = original request and response
    }
}))

// api-gateway -> /v1/auth/register -> 3000 // we need v1 here because its important for API versioning -> because for all the services we need to keep it uniform (hence use v1 at the start of the system only ie in api-gateway)
// identity -> /api/auth/register -> 3001

// localhost:3000/v1/auth/register -> localhost:3001/api/auth/register

// setting up proxy for post-service
// first get the validateToken middleware, only then move ahead w proxy
app.use('/v1/posts', validateToken, proxy(process.env.POST_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator : (proxyReqOpts, srcReq) => {
        proxyReqOpts.headers["content-type"] = "application/json";
        proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;   // pass the userId in the header for POST service and we get srcReq.user due to the validateToken middleware
        return proxyReqOpts;
    },
    userResDecorator : (proxyRes, proxyResData, userReq, userRes) => {
        logger.info(`Response received from Post Service: ${proxyRes.statusCode}`)
        return proxyResData;
    }
}))

// setting up proxy for media-service
app.use('/v1/media', validateToken, proxy(process.env.MEDIA_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator : (proxyReqOpts, srcReq) => {
        proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;
        // media is not a form data -> not normal text but multipart form data
        if(!srcReq.headers['content-type'].startsWith('multipart/form-data')){  // ie if not multipart form data | reading a header -> lower case, setting a header -> case insensitive
            proxyReqOpts.headers["Content-Type"] = "application/json";  // then only change to "application/json"
        }
        return proxyReqOpts;
    },
    userResDecorator : (proxyRes, proxyResData, userReq, userRes) => {
        logger.info(`Response received from Media Service: ${proxyRes.statusCode}`)
        return proxyResData;
    },
    parseReqBody : false    // ensures that the entire req body is proxied for the file uploads also
}))

// setting up proxy for search-service
// first get the validateToken middleware, only then move ahead w proxy
app.use('/v1/search', validateToken, proxy(process.env.SEARCH_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator : (proxyReqOpts, srcReq) => {
        proxyReqOpts.headers["content-type"] = "application/json";
        proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;   // pass the userId in the header for POST service and we get srcReq.user due to the validateToken middleware
        return proxyReqOpts;
    },
    userResDecorator : (proxyRes, proxyResData, userReq, userRes) => {
        logger.info(`Response received from Search Service: ${proxyRes.statusCode}`)
        return proxyResData;
    }
}))

// use error handler at the end always
app.use(errorHandler);

app.listen(PORT, () => {
    logger.info(`API Gateway is running on PORT: ${PORT}`);
    logger.info(`Identity Service is running on PORT: ${process.env.IDENTITY_SERVICE_URL}`);
    logger.info(`Post Service is running on PORT: ${process.env.POST_SERVICE_URL}`);
    logger.info(`Media Service is running on PORT: ${process.env.MEDIA_SERVICE_URL}`);
    logger.info(`Search Service is running on PORT: ${process.env.SEARCH_SERVICE_URL}`);
    logger.info(`Redis URL: ${process.env.REDIS_URL}`);
})