const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    user : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'User',
        required : true,
    },
    content : {
        type : String,
        required : true,
    },
    mediaIds : [
        {
            type : String,
        }
    ],
    createdAt : {
        type : Date,
        default : Date.now
    }
}, {timestamps : true});

// create a DB index for fast search (fast lookup table) - on 'content' field
postSchema.index({content : 'text'});   // since we'll also be having a diff service for search, so we can also skip this part

const Post = mongoose.model('Post', postSchema);
module.exports = Post;