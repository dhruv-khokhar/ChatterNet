const Post = require('../models/Post');
const logger = require('../utils/logger');
const { validateCreatePost } = require('../utils/validation');
const { publishEvent } = require('../utils/rabbitmq');

// function to invalidate the cache -> do it in utils ideally and then import it
async function invalidatePostCache(req, input){
    // for single post
    const cachedKey = `post:${input}`;  // input is the post id
    await req.redisClient.del(cachedKey);
    
    // remove all posts that have cacheKey starting with 'posts:'
    const keys = await req.redisClient.keys('posts:*');
    if(keys.length > 0){
        await req.redisClient.del(keys);    // clears cache
    }
}

const createPost = async (req, res) => {
    logger.info('Create Post Endpoint Hit...')
    try{
        // validate the post schema
        const {error} = validateCreatePost(req.body);   // req.body is where our data from the user is
        if(error){
            // if there's an error, always first log it
            logger.warn('Validation Error', error.details[0].message);
            // now we need to immediately return from here
            return res.status(400).json({
                success : false,
                message : error.details[0].message,
            });
        }
        // get the content and mediaIds
        const { content, mediaIds } = req.body;
        // create new post
        const newlyCreatedPost = new Post({
            user : req.user.userId, // we get this userId from identity-service (not import - since separate services) by creating a middleware (pass through header etc) -> this we get from the authMiddleware
            content,
            mediaIds : mediaIds || [],   // if present then same only, or else empty
        })

        await newlyCreatedPost.save();

        // when creating a post -> we need to add to search collection -> for this, we need to publish an event -> consumed in search-routes and added to search collecton -> from this collection the posts/searches get queried
        await publishEvent('post.created', {
            postId : newlyCreatedPost._id.toString(),
            userId : newlyCreatedPost.user.toString(),
            content : newlyCreatedPost.content,
            createdAt : newlyCreatedPost.createdAt
        })

        // after saving the new post, invalidate the cache since ordering (pages, etc.) has changed
        await invalidatePostCache(req, newlyCreatedPost._id.toString());    // newlyCreatedPost._id.toString() is passed as input
        logger.info('Post Created Successfully', newlyCreatedPost);
        res.status(201).json({
            success : true,
            message : 'Post Created Successfully'
        })
    }catch(e){
        logger.error('Error creating post', e);
        res.status(500).json({
            success : false,
            message : "Error creating post"
        })
    }
}

// for getAllPosts and get a single post, we need to implement caching | also we need to implement invalidate cache everytime we create/delete any post
const getAllPosts = async (req, res) => {
    try{
        // implement pagination as well
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const startIndex = (page - 1) * limit;  // 0-9, 10-19...

        // create a cache key
        const cacheKey = `posts:${page}:${limit}`;  // now get this from the cache
        const cachedPosts = await req.redisClient.get(cacheKey); // if any posts present in the cache for this key, return them | req.redisClient is the redisClient
        if(cachedPosts){    // cachedPosts present
            return res.json(JSON.parse(cachedPosts));   // Redis stores data as strings only. So even if you store a JS object in Redis, it’s stored as a JSON string
        }
        // if not present
        const posts = await Post.find({}).sort({createdAt : -1}).skip(startIndex).limit(limit);    // get latest posts first
        
        const totalNoOfPosts = await Post.countDocuments();  // gives total no. of posts

        const result = {    // all this is helpful for the client side -> Helps frontend know which page they’re on and how many are left
            posts,
            currentPage : page,
            totalPages : Math.ceil(totalNoOfPosts/limit),
            totalPosts : totalNoOfPosts
        }

        // save posts in redis cache now
        await req.redisClient.setex(cacheKey, 300, JSON.stringify(result));   // pass cache key, duration (5mins here - TTL for the cacheKey (and its value - posts)), and the result | next time, this will be in cache and will be returned as cachedPosts
        // Converts the result object into a JSON string to store in Redis | Redis can only store strings, not raw JS objects | setex is a Redis command for SET with EXpiration - use setex because you want automatic cache invalidation

        res.json(result);
    }catch(e){
        logger.error('Error fetching posts', e);
        res.status(500).json({
            success : false,
            message : "Error fetching posts"
        })
    }
}

// get single post by ID
const getPost = async (req, res) => {
    try{
        const postId = req.params.id;
        // create cache key
        const cacheKey = `post:${postId}`;
        // check if cacheKey present in cache or not
        const cachedPost = await req.redisClient.get(cacheKey);
        if(cachedPost){    // cachedPosts present
            return res.json(JSON.parse(cachedPost)); 
        }
        // if not present in cache -> add to cache and return the post
        const singlePostDetailsById = await Post.findById(postId);
        if(!singlePostDetailsById){ // if not present in DB as well
            return res.status(404).json({
                message : 'Post Not Found',
                success : false,
            })
        }
        // post present in DB (but not in cache) -> so add to cache and return
        await req.redisClient.setex(cacheKey, 3600, JSON.stringify(singlePostDetailsById));    // this is a single post so it will hardly change -> so set its expiry longer (1hr here)
        res.json(singlePostDetailsById);
    }catch(e){
        logger.error('Error fetching post', e);
        res.status(500).json({
            success : false,
            message : "Error fetching post by ID"
        })
    }
}

// deleting post by id
const deletePost = async (req, res) => {
    try{
        // first find the post
        // this returns the deleted document if found
        const post = await Post.findOneAndDelete({   // we can't directly delete the post -> the user who has created the post can only delete it -> we need to pass the post id and the user info (userId)
            // filter criteria
            _id : req.params.id,
            user : req.user.userId  // Only delete if user field matches the logged-in user’s ID | we get this from our authMiddleware -> authenticateRequest
        })
        if(!post){ // if post not in DB
            return res.status(404).json({
                message : 'Post Not Found',
                success : false,
            })
        }
        
        // when deleting a post -> we delete its media -> for this, we need to publish an event
        // publish post delete method
        await publishEvent('post.deleted', {    // 'post.deleted' is the routing key (unique identifier) -> 'deleted' is the action | this event is consumed by the media-service
            postId : post._id.toString(),   // this is the message object
            userId : req.user.userId,
            mediaIds : post.mediaIds
        })

        // post deleted from DB so now invalidate cache
        await invalidatePostCache(req, req.params.id);   // now we also need to pass the input -> to invalidate this post from the cache?
        res.json({
            message : "Post Deleted Successfully"
        })
    }catch(e){
        logger.error('Error deleting post', e);
        res.status(500).json({
            success : false,
            message : "Error deleting post"
        })
    }
}

module.exports = {
    createPost,
    getAllPosts,
    getPost,
    deletePost
}