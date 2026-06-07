const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const roomRoutes = require('./routes/rooms');
const Message = require('./models/Message');
const User = require('./models/User');
const Room = require('./models/Room');

const app = express();
const server = http.createServer(app);      
const allowedOrigins = (process.env.CLIENT_URL || process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

const corsOptions = {
    origin: (origin, callback) => {
        const isRenderOrigin = process.env.NODE_ENV === 'production' && /^https:\/\/[a-z0-9-]+\.onrender\.com$/.test(origin || '');

        if (!origin || allowedOrigins.includes(origin) || isRenderOrigin) {
            return callback(null, true);
        }

        return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    methods: ['GET', 'POST']
};

const io = socketIo(server, {
    cors: corsOptions
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;

if (process.env.NODE_ENV === 'production' && /localhost|127\.0\.0\.1/.test(MONGODB_URI || '')) {
    console.error('MONGODB_URI points to localhost. Use a MongoDB Atlas connection string on Render.');
    process.exit(1);
}

if (!MONGODB_URI) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
}

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

// Routes                                
app.use('/api/auth', authRoutes);           
app.use('/api/messages', messageRoutes);    
app.use('/api/rooms', roomRoutes); 

// Store online users per room
const roomParticipants = new Map(); // roomId -> Set of usernames

// Socket.IO connection handling      
io.on('connection', (socket) => {      
    console.log('New client connected:', socket.id);

    // User joins a specific room
    socket.on('join_room', async ({ username, roomId }) => {
        try {
            socket.username = username;
            socket.currentRoom = roomId;

            // Join the Socket.IO room
            socket.join(roomId);

            // Track participants in this room
            if (!roomParticipants.has(roomId)) {
                roomParticipants.set(roomId, new Set());
            }
            roomParticipants.get(roomId).add(username);
            // Update user online status in database
            await User.findOneAndUpdate(
                { username },
                { isOnline: true, lastSeen: new Date() }
            );

            // Get room details
            const room = await Room.findById(roomId);

            // Broadcast updated participant list to everyone in the room
            const participants = Array.from(roomParticipants.get(roomId));
            io.to(roomId).emit('room_participants_update', {
                roomId,
                participants
            });

            console.log(`${username} joined room: ${room?.name || roomId}`);
        } catch (error) {
            console.error('Error in join_room:', error);
        }
    });

    // Handle new message in a room
    socket.on('send_message', async (data) => {
        try {
            const { sender, content, roomId } = data;

            if (!roomId) {
                console.error('No roomId provided for message');
                return;
            }

            // Save message to database
            const message = new Message({
                sender,
                content,
                roomId,
                timestamp: new Date()
            });

            await message.save();

            // Broadcast message only to users in this room  
            io.to(roomId).emit('receive_message', {      
                id: message._id,
                sender: message.sender,
                content: message.content,
                roomId: message.roomId,
                timestamp: message.timestamp
            }); 

            console.log(`Message from ${sender} in room ${roomId}: ${content}`);
        } catch (error) {
            console.error('Error saving message:', error);
        }
    });

    // Handle typing indicator in a room
    socket.on('typing', ({ username, roomId }) => {
        socket.to(roomId).emit('user_typing', { username, roomId });
    });

    socket.on('stop_typing', ({ roomId }) => {
        socket.to(roomId).emit('user_stop_typing', { roomId });
    });

    // Handle leaving a room
    socket.on('leave_room', ({ username, roomId }) => {
        socket.leave(roomId);

        if (roomParticipants.has(roomId)) {
            roomParticipants.get(roomId).delete(username);

            // Broadcast updated participant list
            const participants = Array.from(roomParticipants.get(roomId));
            io.to(roomId).emit('room_participants_update', {
                roomId,
                participants
            });
        }

        console.log(`${username} left room ${roomId}`);
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
        const username = socket.username;
        const roomId = socket.currentRoom;

        if (username && roomId) {
            // Remove from room participants
            if (roomParticipants.has(roomId)) {
                roomParticipants.get(roomId).delete(username);

                // Broadcast updated participant list
                const participants = Array.from(roomParticipants.get(roomId));
                io.to(roomId).emit('room_participants_update', {
                    roomId,
                    participants
                });
            }

            // Update user offline status in database
            try {
                await User.findOneAndUpdate(
                    { username },
                    { isOnline: false, lastSeen: new Date() }
                );
            } catch (error) {
                console.error('Error updating user status:', error);
            }

            console.log(`${username} disconnected from room ${roomId}`);
        }
    });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
