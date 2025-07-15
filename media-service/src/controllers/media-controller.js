const { uploadMediaToCloudinary } = require('../utils/cloudinary');
const logger = require('../utils/logger');
const Media = require('../models/Media');

const uploadMedia = async (req, res) => {
    logger.info('Starting media upload');
    try{
        // first check if the file is present in req or not (which is to be uploaded)
        if(!req.file){  // file not present
            logger.error("No file found. Please add a file and try again.");
            return res.status(400).json({
                success : false,
                message : "No file found. Please add a file and try again."
            })
        }
        // file present -> so get some things from the file
        const {originalname, mimetype, buffer} = req.file   // when reading, do lowercase -> multer saves them as lowercase keys
        // get userID
        const userId = req.user.userId;
        // log it to check if working
        logger.info(`File details: name=${originalname}, type=${mimetype}`);
        logger.info('Uploading to Cloudinary starting...');

        const cloudinaryUploadResult = await uploadMediaToCloudinary(req.file); // cloudinary returns public_id and other stuff (secure_url etc.)
        logger.info(`Cloudinary upload successful. Public ID: ${cloudinaryUploadResult.public_id}`);

        // create the new media
        const newlyCreatedMedia = new Media({
            publicId : cloudinaryUploadResult.public_id,
            originalName : originalname,
            mimeType : mimetype,
            url : cloudinaryUploadResult.secure_url,
            userId
        })
        await newlyCreatedMedia.save();
        res.status(201).json({
            success : true,
            mediaId : newlyCreatedMedia._id,
            url : newlyCreatedMedia.url,
            message : "Media upload is successful."
        })
        // till now we've just uploaded the media to Cloudinary and DB

    }catch(error){
        logger.error('Error creating media', error);
        res.status(500).json({
            success : false,
            message : "Error creating media"
        })
    }
};

// to check if media is actually getting deleted or not - optional
const getAllMedias = async (req, res) => {
    try{
        const results = await Media.find({})
        res.json({results});
    }catch(error){
        logger.error('Error fetching medias', error);
        res.status(500).json({
            success : false,
            message : "Error fetching medias"
        })
    }
}

module.exports = {
    uploadMedia,
    getAllMedias
}