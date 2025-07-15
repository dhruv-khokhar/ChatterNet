// COPIED FROM POST-SERVICE

const amqp = require('amqplib');    // Imports the AMQP library (amqplib) to work with RabbitMQ using the AMQP 0.9.1 protocol
const logger = require('./logger');

// create connection and then channel
let connection = null;  // we don't have right now | connection: represents the TCP connection to RabbitMQ server.
let channel = null; // channel: a lightweight virtual connection over a single TCP connection. Most messaging is done over channels

// create a unique exchange name
const EXCHANGE_NAME = 'facebook_events';    // (say) -> since its a social application

async function connectToRabbitMQ(){ // function that establishes a connection and channel, and sets up an exchange
    try{
        connection = await amqp.connect(process.env.RABBITMQ_URL);  // create connection
        channel = await connection.createChannel(); // the connection lets you create channel

        await channel.assertExchange(EXCHANGE_NAME, 'topic', {durable : false});    // durable if true, exchange survives broker restarts. Here, it’s temporary | Type topic means routing is done based on patterns in the routing key
        // An exchange is a routing mechanism in RabbitMQ.
		// It receives messages from a producer and routes them to queues based on some rules (bindings)
        
        logger.info('Connected to RabbitMQ');
        return channel;
    }catch(e){
        logger.error('Error connecting to RabbitMQ', e);
    }
}

// when deleting a post -> we delete its media -> for this, we need to publish an event
async function publishEvent(routingKey, message){
    if(!channel){   // channel not present -> then connect
        await connectToRabbitMQ();
    }
    // publish event
    channel.publish(EXCHANGE_NAME, routingKey, Buffer.from(JSON.stringify(message)));   // message: Any JavaScript object or data you want to send as the content of the event
    logger.info(`Event published: ${routingKey}`);
}

// to consume event from post-service
async function consumeEvent(routingKey, callback){
    if(!channel){   // channel not present -> then connect
        await connectToRabbitMQ();
    }
    // create queue
    const q = await channel.assertQueue("", {exclusive : true});    // exclusive: true → queue is deleted when connection closes
    // bind queue
    await channel.bindQueue(q.queue, EXCHANGE_NAME, routingKey);    // routingKey is the pattern itself here
    channel.consume(q.queue, (msg) => { // msg is passed by RabbitMQ
        if(msg !== null){
            const content = JSON.parse(msg.content.toString());
            callback(content);
            channel.ack(msg);
        }
    })
    logger.info(`Subscribed to event: ${routingKey}`);
}

module.exports = { connectToRabbitMQ, publishEvent, consumeEvent };