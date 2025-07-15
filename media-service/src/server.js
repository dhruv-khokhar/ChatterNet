require('dotenv').config();
const mongoose = require("mongoose");
const logger = require("./utils/logger");
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const mediaRoutes = require('./routes/media-routes');
const errorHandler = require('./middleware/errorHandler');
const { connectToRabbitMQ, consumeEvent } = require('./utils/rabbitmq');
const { handlePostDeleted } = require('./eventHandlers/media-event-handlers');

const app = express();
const PORT = process.env.PORT || 3003;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => logger.info("Connected to MongoDB"))
  .catch((e) => logger.error("MongoDB Connection Error", e));

// middleware
app.use(helmet());
app.use(cors());    // can config this as well - as done before
app.use(express.json());    // parses json
app.use((req, res, next) => {   // just for logging purpose
    logger.info(`Received ${req.method} request to ${req.url}`);
    logger.info(`Request Body, ${req.body}`);
    next();
});

//*** implement IP based rate limiting for sensitive endpoints (say user uploading multiple times)

app.use('/api/media', mediaRoutes);
app.use(errorHandler);

// start RabbitMQ server
async function startServer(){
    try{
        await connectToRabbitMQ();  // connect to RabbitMQ from media-service

        // consume all the events
        await consumeEvent('post.deleted', handlePostDeleted); // pass with routing key and next create a handler

        app.listen(PORT, () => {
            logger.info(`Media Service running on PORT: ${PORT}`);
        })
    }catch(error){
        logger.error('Failed to connect to server', error);
        process.exit(1);
    }
}

startServer();  

// now start the server - MOVED ABOVE (like in post-service)
// app.listen(PORT, () => {
//     logger.info(`Media Service running on PORT: ${PORT}`);
// })

// create unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at', promise, "reason:", reason);
});