require('dotenv').config();
const mongoose = require("mongoose");
const logger = require("./utils/logger");
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const Redis = require('ioredis');
const postRoutes = require('./routes/post-routes');
const errorHandler = require('./middleware/errorHandler');
const { connectToRabbitMQ } = require('./utils/rabbitmq');

const app = express();
const PORT = process.env.PORT || 3002;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => logger.info("Connected to MongoDB"))
  .catch((e) => logger.error("MongoDB Connection Error", e));

const redisClient = new Redis(process.env.REDIS_URL);

// middleware
app.use(helmet());
app.use(cors());    // can config this as well - as done before
app.use(express.json());    // parses json
app.use((req, res, next) => {   // just for logging purpose
    logger.info(`Received ${req.method} request to ${req.url}`);
    logger.info(`Request Body, ${req.body}`);
    next();
});

//*** implement IP based rate limiting for sensitive endpoints

// use routes -> also pass your Redis client here because we'll use this Redis Client in our controller (for caching)
app.use("/api/posts", (req, res, next) => {
    req.redisClient = redisClient;  // for caching in case of getAllPosts and get a single post
    next();
}, postRoutes);

app.use(errorHandler);

// use the RabbitMQ connection
async function startServer(){
    try{
        await connectToRabbitMQ();  // connect to RabbitMQ from post-service
        app.listen(PORT, () => {
            logger.info(`Post Service running on PORT: ${PORT}`);
        })
    }catch(error){
        logger.error('Failed to connect to server', error);
        process.exit(1);
    }
}

startServer();

// now start the server - MOVED ABOVE
// app.listen(PORT, () => {
//     logger.info(`Post Service running on PORT: ${PORT}`);
// })

// create unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at', promise, "reason:", reason);
});