const Joi = require('joi'); // joi is the validation library

const validateRegistration = (data) => {
    const schema = Joi.object({
        username : Joi.string().min(3).max(50).required(),
        email : Joi.string().email().required(),
        password : Joi.string().min(6).required()
    })

    // now based on the above schema, validate if the data given is valid or not - using validate() method
    return schema.validate(data);
}

const validateLogin = (data) => {   // for this, we only need email and password
    const schema = Joi.object({
        email : Joi.string().email().required(),
        password : Joi.string().min(6).required()
    })

    // now based on the above schema, validate if the data given is valid or not - using validate() method
    return schema.validate(data);
}

module.exports = { validateRegistration, validateLogin };