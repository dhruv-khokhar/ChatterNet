const Search = require("../models/Search");
const logger = require("../utils/logger");

const searchPostController = async(req, res) => {
    logger.info(`Search Endpoint Hit`);
    try{
        // first we'll be getting the query - typed by user
        const {query} = req.query;  // Extracts the search term that the user typed in

        const results = await Search.find(
            {
                // text search -> It searches all fields with a text index for words matching query
                $text : {$search : query}   // search based on query
            },
            {
                score : {$meta : 'textScore'}   // Tells MongoDB:
                // Include a field called score.
                // Value = its text search score.
                // That score indicates how relevant the match is.
            }
        ).sort({score : {$meta : 'textScore'}}).limit(10)   // sort based on score and limit results to 10

        res.json(results);
    }catch(e){
        logger.error('Error while searching post', e);
        res.status(500).json({
            success : false,
            message : "Error while searching post"
        })
    }
}

module.exports = { searchPostController };