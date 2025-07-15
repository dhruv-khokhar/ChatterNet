const Joi = require('joi'); // joi is the validation library

const validateCreatePost = (data) => {
    const schema = Joi.object({
        content : Joi.string().min(3).max(5000).required(),
        mediaIds : Joi.array(),
    })

    // now based on the above schema, validate if the data given is valid or not - using validate() method
    return schema.validate(data);
}

module.exports = { validateCreatePost };