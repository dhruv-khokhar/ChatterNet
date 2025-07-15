// 1. create User model

const mongoose = require('mongoose');
const argon2 = require('argon2');   // for hashing pass (like bcrypt)

const userSchema = new mongoose.Schema({
    username : {
        type : String,
        required : true,
        unique : true,
        trim : true
    },
    email : {
        type : String,
        required : true,
        unique : true,
        trim : true,
        lowercase : true    // email has to be in lowercase
    },
    password : {
        type : String,
        required : true
    },
    createdAt : {
        type : Date,
        default : Date.now
    }
}, {
    timestamps : true
});

// all user specific functions must be implemented in models - instead of keep checking/doing them again and again in each controller

// create some functions
userSchema.pre('save', async function(next){    // before saving the password to the DB, hash it - hence pre save() operation
    // we can do this in registration controller but it is better to do it here only - so that we dont need to hash pass in every controller
    if(this.isModified('password')){
        try{
            this.password = await argon2.hash(this.password);   // hash password
        }catch(error){  // goes to global error handler
            next(error);
        }
    }
})

// create a util to compare password
userSchema.methods.comparePassword = async function(candidatePassword){ // candidatePassword is the password we want to compare
    try{    // compare passwords for login, etc. -> better to do here
        return await argon2.verify(this.password, candidatePassword);
    }catch(error){
        throw error;
    }
}

// create one more indexing - that is implement a search functionality on top of this 'username' field
userSchema.index({username : 'text'});  // makes search faster (in MongoDB, this is implemented using B-trees)

// create the model
const User = mongoose.model('User', userSchema);
module.exports = User;