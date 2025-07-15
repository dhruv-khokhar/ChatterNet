require('dotenv').config();
const mongoose = require("mongoose");
const logger = require("./utils/logger");
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const Redis = require('ioredis');
const errorHandler = require('./middleware/errorHandler');
const {connectToRabbitMQ, consumeEvent} = require('./utils/rabbitmq');
const searchRoutes = require('./routes/search-routes');
const { handlePostCreated, handlePostDeleted } = require('./eventHandlers/search-event-handlers');

const app = express();
const PORT = process.env.PORT || 3004;

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
//*** pass redis client as part of your request and then implement Redis caching

app.use('/api/search', searchRoutes);

app.use(errorHandler);

// use the RabbitMQ connection
async function startServer(){
    try{
        await connectToRabbitMQ();  // connect to RabbitMQ from search-service
        
        // consume the events/subscribe to the events
        await consumeEvent('post.created', handlePostCreated) // key (pattern) and pass event handler
        await consumeEvent('post.deleted', handlePostDeleted)

        app.listen(PORT, () => {
            logger.info(`Search Service running on PORT: ${PORT}`);
        })
    }catch(error){
        logger.error('Failed to start search service', error);
        process.exit(1);
    }
}

startServer();

// create unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at', promise, "reason:", reason);
});