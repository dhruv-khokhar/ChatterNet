// get jwt to generate a JWT Token
const jwt = require('jsonwebtoken');
// crypto module for refresh token
const crypto = require('crypto');

const RefreshToken = require('../models/RefreshToken');

const generateTokens = async (user) => {
    const accessToken = jwt.sign({
        userId : user._id,
        username : user.username
    }, process.env.JWT_SECRET, {expiresIn : '60m'});    // in real scenario, use 10 or 15 mins (ideally 10mins)

    // say you observe there is no movement of the cursor in you client application -> so you wait for say 5 mins and then show a pop-up say there is no user activity - do you want to continue -> 
    // say user moves the cursor now, so hide that pop-up (user is now active) but if still there's no activity, you immediately log out the user -> Refresh tokens help in getting new access tokens (after expiry) without asking the user to log in again every time - if there's user activity
    
    // so create a refresh token for this - using crypto module
    const refreshToken = crypto.randomBytes(40).toString('hex'); // so this becomes a complex token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // refresh token expires in 7 days
    // Refresh tokens are longer-lived.
	// User shouldn’t have to log in every hour.
	// Can get new access tokens as long as refresh token is valid.

    await RefreshToken.create({
        token : refreshToken,
        user : user._id,
        expiresAt
    })

    return {accessToken, refreshToken};
}

module.exports = generateTokens;