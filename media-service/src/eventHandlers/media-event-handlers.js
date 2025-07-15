const Media = require("../models/Media");
const { deleteMediaFromCloudinary } = require("../utils/cloudinary");
const logger = require("../utils/logger");

const handlePostDeleted = async (event) => {
    console.log(event, 'eventeventevent')
    // the above gives:
    // postId: '6876a1968d1cb349f59e87b5',
    // userId: '6873e2705cb81bc84ed1ef3f',
    // mediaIds: [ '6876a15517911fe48ba89cf9' ]

    // using the above info, we now delete the media from cloudinary etc.
    const {postId, mediaIds} = event
    try{
        // first get the media to delete
        const mediaToDelete = await Media.find({_id : {$in: mediaIds}});    // Finds all media documents whose _id is in the list mediaIds
        for(const media of mediaToDelete){  // Loops over each media item found in the DB
            await deleteMediaFromCloudinary(media.publicId);    // delete from cloudinary
            await Media.findByIdAndDelete(media._id);  // delete from mongo db

            logger.info(`Deleted media ${media._id} associated with this deleted post ${postId}`);
        }
        logger.info(`Processed deletion of media for post ID ${postId}`);
    }catch(e){
        logger.error(e, "Error occurred while media deletion")
    }
};

module.exports = { handlePostDeleted };