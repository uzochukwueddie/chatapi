var mongoose = require('mongoose');
const Club = require('../models/club');
const User = require('../models/user');
const Country = require('../models/countries');
const jwt = require('jsonwebtoken');
const Post = require('../models/posts');
const moment = require('moment');
const _ = require('lodash');
const cloudinary = require('cloudinary');

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET
});





exports.getRooms = async (req, res) => {
    const rooms = await Club.find({}).sort({"name": 1})
    return res.status(200).json({message: 'Rooms Found', rooms: rooms});
}

exports.getUser = async (req, res) => {
    const username = req.params.username.replace(/-/g, ' '); //use req.body.username
    const user = await User.findOne({'username': username}, {'password': 0})
                            .populate('request.senderId')
                            .populate('friends.friendId')
                            .populate('notFriends.friendId')

    if(!user) {
      return res.status(200).json({message: 'No user Found'})
    } else {
      return res.status(200).json({message: 'User data returned', user: user})
    }
}

exports.getRoom = (req, res) => {
    return res.status(200).json({message: 'Chat Room', room: req.params.name.replace(/-/g, ' ')}); //use req.body.username
}

exports.addFriend = async (req, res) => {
    const sender = req.body.sender;
    const receiver = req.body.receiver;
    
    const senderName = req.body.senderName;
    const receiverName = req.body.receiverName;
    
    const sendername = req.body.sendername;
    const receivername = req.body.receivername;
    
    const nameReceiver = req.body.receiver_name;
    const idReceiver = req.body.receiver_Id;
    const nameSender = req.body.sender_name;
    
    //...............Sending request...........................
    
    if(req.body.request === 'request'){
        await User.update({
            'username': receiver,
            'request.username': {$ne: req.body.sender},
            'friends.name': {$ne: req.body.sender}
        }, {
            $push: {request: {
                username: req.body.sender,
                senderId: req.body.senderId
            }},
            $inc: {totalRequest: 1}
        });

        await User.update({
            'username': sender,
            'sentRequest.username': {$ne: req.body.receiver}
        }, {
            $push: {sentRequest: {
                username: req.body.receiver
            }}
        });
    }
    
    //...............End...........................
    
    //...............Accepting request...........................
    
    
    if(req.body.accept === 'accept'){
        await User.update({
            '_id': req.body.receiverid,
            'friends.name': {$ne: req.body.senderName}
        }, {
            $push: {friends: {
                name: req.body.senderName,
                friendId: req.body.senderid
            }},
            $pull: {notFriends: {
                name: req.body.senderName
            }},
            $inc: {totalRequest: -1}
        });
        
        await User.update({
            '_id': req.body.receiverid,
        }, {
            $pull: {request: {
                senderId: req.body.senderid
            }},
            
        });

        await User.update({
            '_id': req.body.senderid,
            'friends.name': {$ne: req.body.receiverName}
        }, {
            $push: {friends: {
                name: req.body.receiverName,
                friendId: req.body.receiverid
            }},
            $pull: {notFriends: {
                name: req.body.receiverName
            }}
        });
        
        await User.update({
            '_id': req.body.senderid,
        }, {
            $pull: {sentRequest: {
                username: req.body.receiverName
            }}
        });
    }
    
    //...............End...........................
    
    //...............Cancelling request...........................
    
    await User.update({
        'username': receivername,
        'request.username': {$eq: req.body.sendername}
    }, {
        $pull: {request: {
            username: req.body.sendername
        }},
        $inc: {totalRequest: -1}
    });
    
    await User.update({
        'username': sendername,
        'sentRequest.username': {$eq: req.body.receivername}
    }, {
        $pull: {sentRequest: {
            username: req.body.receivername
        }},
    });
    
    
    //...................Add to not friends array........................
    
    if(req.body.sender_name || req.body.receiver_name){
        await User.update({
            "username": req.body.sender_name,
            'notFriends.name': {$ne: req.body.receiver_name}
        }, {
            $push: {notFriends: {
                name: req.body.receiver_name,
                friendId: req.body.receiver_Id
            }}
        });
        
        await User.update({
            "username": req.body.receiver_name,
            'notFriends.name': {$ne: req.body.sender_name}
        }, {
            $push: {notFriends: {
                name: req.body.sender_name,
                friendId: req.body.sender_Id
            }}
        });
    }
    
    //...............End...........................
    
    if(sender && receiver) {
        return res.status(200).json({message: 'Friend request sent'});
    } else if(senderName && receiverName) {
        return res.status(200).json({message: 'Friend request accepted'});
    } else if(sendername && receivername) {
        return res.status(200).json({message: 'Friend request cancelled'});
    }
}

exports.addFavorite = async (req, res) => {
    await Club.update({
        '_id': req.body.id,
        'fans.username': {$ne: req.body.user}
    }, {
        $push: {fans: {
            username: req.body.user
        }}
    });
    
    await User.update({
        'username': req.body.user,
        'favClub': {$ne: req.body.roomName}
    }, {
        $push: {favClub: req.body.roomName}
    })
    
    return res.status(200).json({message: `${req.body.roomName} has been added to favorite`});
}

exports.getPost = async (req, res) => {
    
    
    var today = moment().startOf('day')
    var tomorrow = moment(today).add(1, 'days');
    
    var date = new Date();
    var daysToDeletion = 1;
    var deletionDate = new Date(date.setDate(date.getDate() - daysToDeletion));
    
    const del = await Post.remove({"created": {$lt : deletionDate}});
    
    if(del){
        const posts = await Post.find({"created": {$gte: today.toDate(), $lt: tomorrow.toDate()}})
                                .populate("user")
                                .sort({ "created": -1 });


        const topPost = await Post.find({"created": {$gte: today.toDate(), $lt: tomorrow.toDate()}, "likes": {$gt: 10}})
                                .populate("user")
                                .sort({ "likes": -1 });


        return res.status(200).json({message: `All User's Posts`, posts: posts, top: topPost});
    }
}

exports.addPost = async (req, res) => {
    if(req.body.post && (req.body.post !== '' || req.body.post !== undefined) && !req.body.image){
        const userId = req.body.id;
        const username = req.body.username;
        const post = req.body.post;

        const newPost = new Post();
        newPost.user = userId;
        newPost.username = username;
        newPost.post = post;
        newPost.created = new Date();

        const post2 = await newPost.save();

        return res.status(200).json({message: 'Post Added', posts: post2});   
    }
    
    
    if(req.body.post && req.body.image){
        cloudinary.uploader.upload(req.body.image, async function (resp) {
            if(req.body.image){
                const userId = req.body.id;
                const username = req.body.username;
                const post = req.body.post;

                const newPost = new Post();
                newPost.user = userId;
                newPost.username = username;
                newPost.post = post;
                newPost.created = new Date();
                newPost.imageVersion = resp.version;
                newPost.imageId = resp.public_id;

                const post2 = await newPost.save();

                return res.status(200).json({message: 'Post added successfully', posts: post2})
            }
        });
    }
}

exports.getComments = async (req, res) => {
    const userComment = await Post.findOne({"_id": req.params.postId}) //user req.body.postId
                                        .populate("user")
                                        .populate("comment.id");
    
    return res.status(200).json({message: 'Users Comments', comments: userComment});
}

exports.postComments = async (req, res) => {
    const postid = req.body.postid;
    const userId = req.body.userid;
    const senderId = req.body.senderId;
    const senderName = req.body.senderName;
    const comment = req.body.comment;
    
    const postId = req.body.postId;
    
    await Post.update({
        "_id": postid
    }, {
        $push: {comment: {
            id: senderId,
            username: senderName,
            comment: comment,
            createdAt: new Date()
        }}
    });
    
    await Post.update({
        "_id": postId
    }, {
        $inc: {likes: 1}
    });
    
    const userComment = await Post.findOne({"_id": req.body.postid})
                                        .populate("user")
                                        .populate("comment.id");
    
    if(postId){
        return res.status(200).json({message: 'Post Liked'});
    } else {
        return res.status(200).json({message: 'Comment Added', comments: userComment});
    }
}

exports.searchRoom = async (req, res) => {
    const searchName = req.body.room.replace(/-/g, ' ');
    const regex = new RegExp(searchName, 'gi');
    const room = await Club.find({"name": regex});
    const room1 = await Country.find({"name": regex});
    
    if(room || room1){
        return res.status(200).json({message: 'Search Results', rooms: _.uniqBy(room, 'name'), rooms1: _.uniqBy(room1, 'name')});
    } else {
        return res.status(200).json({message: 'Search Results Error', rooms: []});
    }
}

exports.addRoom = async (req, res) => {
    const newClub = new Club();
    newClub.name = firstUpper(req.body.room)
    newClub.country = firstUpper(req.body.country)
    newClub.save((err) => {
        if(err){
            return res.status(200).json({message: 'Room Creation Error', error: err});
        }
        return res.status(200).json({message: 'Room Created', room: newClub});
    });
}

exports.blockUser = async (req, res) => {
    
    await User.update({
        'username': req.body.user1,
        'friends.name': req.body.user2,
        'blockedUsers': {$ne: req.body.user2},
    }, {
        $push: {blockedUsers: req.body.user2}
    });
    
    await User.update({
        'username': req.body.user2,
        'friends.name': req.body.user1,
        'blockedBy': {$ne: req.body.user1},
    }, {
        $push: {blockedBy: req.body.user1}
    });
    
    return res.status(200).json({message: 'User Blocked'});
}

exports.unblockUser = async (req, res) => {
    
    await User.update({
        'username': req.body.user1
    }, {
        $pull: { blockedUsers: { $in: [req.body.user2] }}
    });
    
    await User.update({
        'username': req.body.user2,
        
    }, {
        $pull: { blockedBy: { $in: [req.body.user1] }}
    });
    
    return res.status(200).json({message: 'User Unblocked'});
}


firstUpper = function(name){
    return name.charAt(0).toUpperCase() + name.slice(1);
};


getToken = function (headers) {
  if (headers && headers.authorization) {
    var parted = headers.authorization.split(' ');
    if (parted.length === 2) {
      return parted[1];
    } else {
      return null;
    }
  } else {
    return null;
  }
};