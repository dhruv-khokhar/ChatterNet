const mongoose = require('mongoose');
const User = require('./User');

const refreshTokenSchema = new mongoose.Schema({
    token : {
        type : String,
        required : true,
        unique : true
    },
    user : {
        type : mongoose.Schema.Types.ObjectId,
        ref : User, // reference here is the userSchema
        required : true, 
    },
    expiresAt : {
        type : Date,
        required : true,
    }
}, {timestamps : true});

// now create an index also 
refreshTokenSchema.index({expiresAt : 1}, {expireAfterSeconds : 0});    // creates an index (in ascending order(1)) on expiresAt field and 'expireAfterSeconds : 0' deletes the refresh token immediately on expiry (creates a TTL (Time-To-Live) index)
// Example use case in words
// 	•	User logs in → app issues a refresh token that expires in 30 days.
// 	•	Document is saved with expiresAt = today + 30 days.
// 	•	When 30 days pass, MongoDB automatically removes it.

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema); 
module.exports = RefreshToken;