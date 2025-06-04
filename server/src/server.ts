// server/src/server.ts
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';

const app = express();

// CORS configuration
// This allows your React client (typically running on localhost:3000)
// to communicate with this server (running on localhost:3001).
app.use(cors({
    origin: "http://localhost:3000", // Allow only your client origin
    methods: ["GET", "POST"]         // Allow specific HTTP methods
}));

const server = http.createServer(app); // Create HTTP server with Express app

// Initialize Socket.IO server
const io = new SocketIOServer(server, {
    cors: {
        origin: "http://localhost:3000", // Client URL
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3001;

// Basic route (optional, just for testing if server is up via browser)
app.get('/', (req, res) => {
    res.send('Pong Server is running!');
});

// Socket.IO connection logic
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Send a welcome message to the connected client
    socket.emit('message', `Welcome, you are connected with ID: ${socket.id}`);

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });

    // Example: Listen for a custom event from client
    socket.on('clientMessage', (data) => {
        console.log(`Message from ${socket.id}:`, data);
        // Echo back to the sender
        socket.emit('message', `Server received your message: ${data}`);
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Socket.IO is listening for connections.`);
});