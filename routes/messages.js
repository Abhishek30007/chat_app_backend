const express = require('express');
const router = express.Router();
const Message = require('../models/Message');

// Get all messages or messages by room
router.get('/', async (req, res) => {
    try {
        const { roomId } = req.query;

        if (!roomId) {
            return res.status(400).json({ message: 'Room ID is required' });
        }

        const messages = await Message.find({ roomId })
            .sort({ timestamp: 1 })
            .limit(100);

        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Server error fetching messages' });
    }
});

module.exports = router;
