const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const roomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    inviteCode: {
        type: String,
        unique: true,
        default: () => uuidv4().substring(0, 8)
    },
    creator: {
        type: String,
        required: true
    },
    participants: [{
        username: String,
        joinedAt: {
            type: Date,
            default: Date.now
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Room', roomSchema);
