const express = require('express');
const {createPost, getAllPosts, getPost, deletePost} = require('../controllers/post-controller');
const {authenticateRequest} = require('../middleware/authMiddleware');

// create router
const router = express.Router();

// first create a middleware -> this will tell if the user is an auth user or not
// use this authenticateRequest for all the routes we'll create
// pass this middleware generally -> since its applicable for all routes (otherwise do individually for specific routes)
router.use(authenticateRequest); // now we can get the userId of the authenticated user

// routes
router.post('/create-post', createPost);
router.get('/all-posts', getAllPosts);
router.get('/:id', getPost);
router.delete('/:id', deletePost);

module.exports = router;