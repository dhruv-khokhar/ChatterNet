const mongoose = require('mongoose');
// we upload this first to cloud storage - cloudinar, we get data back from it and then store it to DB -> then publish a media.uploaded even to RabbitMQ -> so that post-service can capture/consume it next
const mediaSchema = new mongoose.Schema({
    // for every media uploaded to Cloudinary, it gets a unique publicID
    publicId : {
        type : String,
        required : true,
    },
    originalName : {
        type : String,
        required : true,
    },
    mimeType : {
        type : String,
        required : true,
    },
    url : {
        type : String,
        required : true,
    },
    userId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'User',
        required : true,
    }
}, {timestamps : true});

const Media = mongoose.model('Media', mediaSchema);
module.exports = Media;