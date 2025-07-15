const mongoose = require('mongoose');

const searchPostSchema = new mongoose.Schema({
    postId : {  // to search post
        type : String,
        required : true,
        unique : true,
    },
    userId : {
        type : String,
        required : true,
        index : true,  // not unique : true -> same user can have multiple posts/searches | index: true tells MongoDB to create an index on userId so queries filtering by userId are faster
    },
    content : {
        type : String,
        required : true,
    },
    // no media Ids since we'll search based on post content (and not media)
    createdAt : {
        type : Date,
        required : true,
    }
}, {timestamps : true});

// create an index for search - search based on 'content' property
searchPostSchema.index({content : 'text'});
// create another index based on 'createdAt' property
searchPostSchema.index({createdAt : -1});

const Search = mongoose.model('Search', searchPostSchema);
module.exports = Search;