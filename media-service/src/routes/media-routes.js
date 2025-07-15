const express = require('express');
const multer = require('multer');
const {uploadMedia, getAllMedias} = require('../controllers/media-controller');
const {authenticateRequest} = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

// configure multer for file upload - can also create a separate file for this
const upload = multer({ // this automatically creates utils for multer
    storage : multer.memoryStorage(),
    limits : {
        fileSize : 5 * 1024 * 1024  // 5MB
    }
}).single('file');  // single file upload

router.post('/upload', authenticateRequest, (req, res, next) => {   // middleware for the multer
    upload(req, res, function(err){ // check if any error occurred
        if(err instanceof multer.MulterError){  // for multer error
            logger.error('Multer error while uploading: ', err)
            return res.status(400).json({
                message : 'Multer error while uploading',
                error : err.message,
                stack : err.stack
            })
        } else if(err){ // other error
            logger.error('Unknown error occurred while uploading: ', err);
            return res.status(500).json({
                message : 'Unknown error occurred while uploading',
                error : err.message,
                stack : err.stack
            })
        }
        // no error
        // check if req.file present
        if(!req.file){
            return res.status(400).json({
                message : 'No file found.',
            })
        }
        next();
    })
}, uploadMedia);    // pass controller here

router.get('/get', authenticateRequest, getAllMedias);

module.exports = router;