const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const Message = require('../models/Message');

// Create a new room
router.post('/create', async (req, res) => {
    try {
        const { name, creator } = req.body;

        if (!name || !creator) {
            return res.status(400).json({ message: 'Room name and creator are required' });
        }

        const room = new Room({
            name,
            creator,
            participants: [{ username: creator, joinedAt: new Date() }]
        });

        await room.save();

        res.status(201).json({
            message: 'Room created successfully',
            room: {
                id: room._id,
                name: room.name,
                inviteCode: room.inviteCode,
                creator: room.creator,
                participants: room.participants
            }
        });
    } catch (error) {
        console.error('Error creating room:', error);
        res.status(500).json({ message: 'Server error creating room' });
    }
});

// Get all rooms for a user
router.get('/user/:username', async (req, res) => {
    try {
        const { username } = req.params;

        const rooms = await Room.find({
            'participants.username': username
        }).sort({ updatedAt: -1 });

        res.json(rooms);
    } catch (error) {
        console.error('Error fetching rooms:', error);
        res.status(500).json({ message: 'Server error fetching rooms' });
    }
});

// Join room by invite code
router.post('/join', async (req, res) => {
    try {
        const { inviteCode, username } = req.body;

        if (!inviteCode || !username) {
            return res.status(400).json({ message: 'Invite code and username are required' });
        }

        const room = await Room.findOne({ inviteCode });

        if (!room) {
            return res.status(404).json({ message: 'Invalid invite code' });
        }

        // Check if user is already a participant
        const isParticipant = room.participants.some(p => p.username === username);

        if (!isParticipant) {
            room.participants.push({ username, joinedAt: new Date() });
            await room.save();
        }

        res.json({
            message: 'Joined room successfully',
            room: {
                id: room._id,
                name: room.name,
                inviteCode: room.inviteCode,
                creator: room.creator,
                participants: room.participants
            }
        });
    } catch (error) {
        console.error('Error joining room:', error);
        res.status(500).json({ message: 'Server error joining room' });
    }
});

// Get room details
router.get('/:roomId', async (req, res) => {
    try {
        const { roomId } = req.params;

        const room = await Room.findById(roomId);

        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        res.json(room);
    } catch (error) {
        console.error('Error fetching room:', error);
        res.status(500).json({ message: 'Server error fetching room' });
    }
});

// Get room participants
router.get('/:roomId/participants', async (req, res) => {
    try {
        const { roomId } = req.params;

        const room = await Room.findById(roomId);

        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        res.json(room.participants);
    } catch (error) {
        console.error('Error fetching participants:', error);
        res.status(500).json({ message: 'Server error fetching participants' });
    }
});

module.exports = router;
