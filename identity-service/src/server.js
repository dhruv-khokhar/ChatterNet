require("dotenv").config();
const mongoose = require("mongoose");
const logger = require("./utils/logger");
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { RateLimiterRedis } = require('rate-limiter-flexible');
const Redis = require('ioredis');
const { rateLimit } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const routes = require('./routes/identity-service');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001 ; // this service runs on PORT 3001

// connect to mongodb (you can create another folder as database where you do this as well)
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => logger.info("Connected to MongoDB"))
  .catch((e) => logger.error("MongoDB Connection Error", e));

const redisClient = new Redis(process.env.REDIS_URL);

// use all our middlewares
// use helmet -> it is a package that helps secure the express app -> it sets various HTTP headers which improve security -> prevents access attacks, etc.
app.use(helmet());
app.use(cors());    // can config this as well - as done before
app.use(express.json());    // parses json
app.use((req, res, next) => {   // just for logging purpose
    logger.info(`Received ${req.method} request to ${req.url}`);
    logger.info(`Request Body, ${req.body}`);
    next();
});

// now implement basic rate limiter and DDoS protection - using rate-limiter-flexible package
// this pkg counts and limits the actions by key and protects from DDoS and brute force attacks
// A DDoS (Distributed Denial of Service) attack is a malicious attempt to disrupt the normal functioning of a server, service, or network by overwhelming it with a flood of internet traffic

// but first create a Redis client -> Redis already set up in .env (previously we did in server.js (mention host and port))
// client created above

// DDoS Protection & Rate Limiting
const rateLimiter = new RateLimiterRedis({
    storeClient : redisClient,   // this tells that the client is a Redis client instance that stores rate limit data (redis must be installed in local machine)
    keyPrefix : 'middleware',    // this is a prefix added to your Redis keys for rate limiting -> helps to distinguish rate limiting data from other Redis data
    points : 10,    // max number of requests that a user or your IP address can make in a given period of time
    duration : 1,   // max 10 requests in 1 second from this user or IP address
});

app.use((req, res, next) => {   // this basically provides DDoS Protection
    rateLimiter.consume(req.ip).then(() => next()).catch(() => { // req.ip is my current IP address -> consume(req.ip) returns a promise 
        logger.warn(`Rate Limit Exceeded for IP: ${req.ip}`);
        res.status(429).json({  // 429 -> status code for 'Too Many Requests'
            success : false,
            message : "Too Many Requests",
        })
    })
    // if rate limiter is not exceeded, it calls the next method but if exceeded then catch block
});

// now we implement rate limiting on our endpoints - /register etc. -> we do this using express-rate-limit package
// IP based rate limiting for sensitive endpoints
const sensitiveEndpointsLimiter = rateLimit({
    windowMs : 15*60*1000,    // time window for the rate limiting - 15m here
    max : 50,   // max requests that can be made
    standardHeaders : true, // this tells whether we want to include the rate limit info in the response headers or not | this also allows the client to see how many requests they have left in their current time window
    legacyHeaders : false,  // to include some legacy headers or not
    handler : (req, res) => {
        logger.warn(`Sensitive Endpoint Rate Limit Exceeded for IP: ${req.ip}`);
        res.status(429).json({  // 429 -> status code for 'Too Many Requests'
            success : false,
            message : "Too Many Requests",
        })
    },
    store : new RedisStore({    // we can also pass an additional property - store -> we use rate-limit-redis package -> this is the redis store for the express rate limiter
        sendCommand : (...args) => redisClient.call(...args)
    }),
});
// now apply this limiter in our /register endpoint (and other routes)
app.use('/api/auth/register', sensitiveEndpointsLimiter);

// here are the main routes
app.use('/api/auth', routes);

// error handler
app.use(errorHandler);

// now start the server
app.listen(PORT, () => {
    logger.info(`Identity Service running on PORT: ${PORT}`);
})

// create unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at', promise, "reason:", reason);
});