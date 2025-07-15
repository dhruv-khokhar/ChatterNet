const cloudinary = require('cloudinary').v2;
const logger = require('./logger');

cloudinary.config({
    cloud_name : process.env.CLOUDINARY_CLOUD_NAME,
    api_key : process.env.CLOUDINARY_API_KEY,
    api_secret : process.env.CLOUDINARY_API_SECRET
});

// upload media to cloudinary
const uploadMediaToCloudinary = (file) => { // file as inout -> which is to be uploaded
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                resource_type : "auto", // detects automatically the type of the resource being uploaded (image or video)
            },
            (error, result) => {   // callback function -> called when upload is done or failed
                if(error){
                    logger.error('Error while uploading media to Cloudinary', error);
                    reject(error);  // reject due to error
                } else{
                    resolve(result);
                }
            }
        )

        uploadStream.end(file.buffer);
    });
};

const deleteMediaFromCloudinary = async(publicId) => {
    try{
        const result = await cloudinary.uploader.destroy(publicId);
        logger.info('Media deleted successfully from cloud storage', publicId);
        return result;
    }catch(error){
        logger.error('Error deleting media from cloudinary', error);
        throw error;
    }
}

module.exports = {
    uploadMediaToCloudinary,
    deleteMediaFromCloudinary
}