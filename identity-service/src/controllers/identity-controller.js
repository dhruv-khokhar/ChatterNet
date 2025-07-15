// get the logger first - in high level projects, we need to log everything
const logger = require('../utils/logger');
const { validateRegistration, validateLogin } = require('../utils/validation');
const User = require('../models/User');
const generateTokens = require('../utils/generateToken');
const RefreshToken = require('../models/RefreshToken');

// implement user registration
const registerUser = async (req, res) => {
    // log (with its level - info here) first that we at Registration (message)
    logger.info('Registraion Endpoint Hit...')
    try{
        // validate the schema first - ie are we getting the correct user info (like correct length usernames, specific conditions to be met for pass etc.) or not -> for this, create another utility (validation.js)
        // validate if there's any error or not
        const {error} = validateRegistration(req.body);   // req.body is where our data from the user is
        if(error){
            // if there's an error, always first log it
            logger.warn('Validation Error', error.details[0].message);
            // now we need to immediately return from here
            return res.status(400).json({
                success : false,
                message : error.details[0].message,
            });
        }
        // data validated
        const {email, password, username} = req.body;
        // create the doc for this user in DB
        // first check if user already registered or not
        let user = await User.findOne({ $or : [{email}, {username}]})  // using 'or' operator, we can find/check for the user on the basis of multiple fields (email and username in our case)
        if(user){   // if user exists
            logger.warn('User Already Exists');
            return res.status(400).json({
                success : false,
                message : "User Already Exists",
            });
        }
        // new user
        user = new User({username, email, password});
        await user.save();
        // log this
        logger.warn('User Registered Successfully', user._id); // user._id is the _id from MongoDB

        // create utility to generate a token - generateToken.js
        const {accessToken, refreshToken} = await generateTokens(user);
        
        res.status(201).json({
            success : true,
            message : "User Registered Successfully",
            accessToken,    // pass them back to the client since they are stored at client-side (in the browser)
            refreshToken
        })
    }catch(e){
        logger.error('Registration Error Occurred', e);
        res.status(500).json({
            success : false,
            message : "Internal Server Error"
        })
    }
};

// implement user login
const loginUser = async (req, res) => {
    logger.info('Login Endpoint Hit...')
    try{
        const {error} = validateLogin(req.body)
        if(error){
            // if there's an error, always first log it
            logger.warn('Validation Error', error.details[0].message);
            // now we need to immediately return from here
            return res.status(400).json({
                success : false,
                message : error.details[0].message,
            });
        }
        // data validated
        const {email, password} = req.body;
        const user = await User.findOne({email});   // find the user using email
        if(!user){  // user not present
            logger.warn('Invalid User');
            res.status(400).json({
                success: false,
                message: "Invalid Credentials"
            })
        }
        // user present
        // check if password valid or not
        const isValidPassword = await user.comparePassword(password);  // this method created in User model
        if(!isValidPassword){  // invalid password
            logger.warn('Invalid Password');
            res.status(400).json({
                success: false,
                message: "Invalid Credentials"
            })
        }

        // get the access token and refresh token
        const {accessToken, refreshToken} = await generateTokens(user);
        res.json({  // pass the tokens back
            accessToken,
            refreshToken,
            userId: user._id
        })
    }catch(e){
       logger.error('Login Error Occurred', e);
        res.status(500).json({
            success : false,
            message : "Internal Server Error"
        }) 
    }
}

// implement refresh token - first we create a model for refresh token -> everytime a user registers/login, we create a refresh token and save it for some time -> when logout, delete that refresh token from our DB
// this is to create a refresh token endpoint which creates a refresh token by hitting this endpoint (as refresh token is kept for 7 days only) -> optional feature
const refreshTokenUser = async (req, res) => {
    logger.info('Refresh Token Endpoint Hit...')
    try{
        // first get the refresh token
        const {refreshToken} = req.body;
        if(!refreshToken){  // if refresh token is missing
            logger.warn("Refresh Token Mission")
            return res.status(400).json({
                success : false,
                message : "Refresh Token Missing"
            })
        }
        // refresh token present
        // get the stored token from the DB
        const storedToken = await RefreshToken.findOne({token : refreshToken})
        if(!storedToken || storedToken.expiresAt < new Date()){ // if stored token missing or its expiresAt value less than current date (invalid token - expired)
            logger.warn('Invalid or Expired Refresh Token');
            return res.status(401).json({
                success : false,
                message : 'Invalid or Expired Refresh Token'
            })
        }

        // now create the new token - but first find that user
        const user = await User.findById(storedToken.user);
        if(!user){  // user not found
            logger.warn('User Not Found');
            return res.staturs(401).json({
                success : false,
                message : 'User Not Found'
            })
        }
        // generate new token
        const {accessToken : newAccessToken, refreshToken : newRefreshToken} = await generateTokens(user);
        // delete the old refresh token - imp
        await RefreshToken.deleteOne({_id : storedToken._id});   // pass the id of the token to be deleted
        // return new token
        res.json({
            accessToken : newAccessToken,
            refreshToken : newRefreshToken,
        });
    }catch(e){
       logger.error('Refresh Token Error Occurred', e);
        res.status(500).json({
            success : false,
            message : "Internal Server Error"
        }) 
    }
}

// implement logout
const logoutUser = async (req, res) => {
    logger.info('Logout Endpoint Hit...')
    try{
        // first delete the refresh token from the DB -> so in this endpoint, we need to pass the refresh token for it to be deleted
        const {refreshToken} = req.body;
        if(!refreshToken){  // if refresh token is missing
            logger.warn("Refresh Token Mission")
            return res.status(400).json({
                success : false,
                message : "Refresh Token Missing"
            })
        }
        // delete token
        await RefreshToken.deleteOne({token : refreshToken});
        logger.info("Refresh Token deleted for Logout");
        res.json({
            success: true,
            message: 'Logged Out Successfully!'
        })
    }catch(e){
       logger.error('Error while Logging Out', e);
        res.status(500).json({
            success : false,
            message : "Internal Server Error"
        }) 
    }
}


module.exports = {
    registerUser,
    loginUser,
    refreshTokenUser,
    logoutUser
};