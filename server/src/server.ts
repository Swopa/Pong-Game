// server/src/server.ts
import express from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import cors from 'cors';

// Import types and constants from shared
import {
    GameState,
    Player,
    Paddle,
    Ball,
    Scores,
    // GameRoom, // We'll manage room state directly here for now, or make a class later
    SOCKET_EVENTS,
    GAME_WIDTH,
    GAME_HEIGHT,
    PADDLE_WIDTH,
    PADDLE_HEIGHT,
    PADDLE_OFFSET_X,
    BALL_RADIUS,
    INITIAL_BALL_SPEED
} from '@shared/types';

const app = express();
app.use(cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
}));

const serverHttp = http.createServer(app);
const io = new SocketIOServer(serverHttp, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3001;

// --- Game Room Management ---
interface ServerGameRoom {
    roomName: string;
    players: { [socketId: string]: PlayerDetails }; // Player socketId to their details
    gameState: GameState;
    playerOrder: string[]; // [player1SocketId, player2SocketId]
    status: 'waiting' | 'playing' | 'finished';
    // gameLoopInterval?: NodeJS.Timeout; // We'll add this later
}

interface PlayerDetails {
    socketId: string;
    isPlayerOne: boolean; // True if they control the left paddle
    // name?: string; // Optional: if players can set names
}

const rooms = new Map<string, ServerGameRoom>();
let waitingPlayerSocket: Socket | null = null;

// Helper function to create initial game state
function createInitialGameState(): GameState {
    return {
        ball: {
            x: GAME_WIDTH / 2,
            y: GAME_HEIGHT / 2,
            radius: BALL_RADIUS,
            dx: Math.random() < 0.5 ? 1 : -1, // Random initial horizontal direction
            dy: (Math.random() * 2 - 1) * 0.5, // Random initial vertical direction (less steep)
            speed: INITIAL_BALL_SPEED,
        },
        paddles: {}, // Will be populated when players join and are assigned
        scores: {},  // Will be populated
        status: 'starting',
        message: "Waiting for game to start...",
    };
}


io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on(SOCKET_EVENTS.JOIN_ROOM_REQUEST, () => {
        console.log(`Player ${socket.id} wants to join a room.`);

        if (waitingPlayerSocket && waitingPlayerSocket.id !== socket.id) {
            // --- Second player joins, create a room and start the game ---
            const player1Socket = waitingPlayerSocket;
            const player2Socket = socket;
            waitingPlayerSocket = null; // Clear the waiting player

            const roomName = `room-${player1Socket.id}-${player2Socket.id}`;

            // Join both players to the Socket.IO room
            player1Socket.join(roomName);
            player2Socket.join(roomName);

            const initialGameState = createInitialGameState();

            // Player 1 (left paddle)
            const player1Id = player1Socket.id;
            initialGameState.paddles[player1Id] = {
                playerId: player1Id,
                x: PADDLE_OFFSET_X,
                y: GAME_HEIGHT / 2 - PADDLE_HEIGHT / 2,
                width: PADDLE_WIDTH,
                height: PADDLE_HEIGHT,
            };
            initialGameState.scores[player1Id] = 0;

            // Player 2 (right paddle)
            const player2Id = player2Socket.id;
            initialGameState.paddles[player2Id] = {
                playerId: player2Id,
                x: GAME_WIDTH - PADDLE_WIDTH - PADDLE_OFFSET_X,
                y: GAME_HEIGHT / 2 - PADDLE_HEIGHT / 2,
                width: PADDLE_WIDTH,
                height: PADDLE_HEIGHT,
            };
            initialGameState.scores[player2Id] = 0;


            const newRoom: ServerGameRoom = {
                roomName,
                players: {
                    [player1Id]: { socketId: player1Id, isPlayerOne: true },
                    [player2Id]: { socketId: player2Id, isPlayerOne: false },
                },
                gameState: initialGameState,
                playerOrder: [player1Id, player2Id],
                status: 'playing', // Or 'starting' then emit gameStart
            };
            rooms.set(roomName, newRoom);

            console.log(`Room ${roomName} created with players ${player1Id} and ${player2Id}.`);

            // Notify player 1
            player1Socket.emit(SOCKET_EVENTS.ROOM_JOINED, {
                roomName,
                yourPlayerId: player1Id,
                isPlayerOne: true,
                initialGameState,
                message: "Opponent found! You are Player 1 (Left Paddle)."
            });

            // Notify player 2
            player2Socket.emit(SOCKET_EVENTS.ROOM_JOINED, {
                roomName,
                yourPlayerId: player2Id,
                isPlayerOne: false,
                initialGameState,
                message: "Opponent found! You are Player 2 (Right Paddle)."
            });

            // Could also emit a general game start to the room
            io.to(roomName).emit(SOCKET_EVENTS.GAME_START, initialGameState);
            console.log(`Game starting in room ${roomName}`);

        } else if (!waitingPlayerSocket || waitingPlayerSocket.id === socket.id) {
            // --- First player, or same player clicking again ---
            if (waitingPlayerSocket && waitingPlayerSocket.id === socket.id) {
                console.log(`Player ${socket.id} is already waiting.`);
                socket.emit(SOCKET_EVENTS.WAITING_FOR_PLAYER, { message: "You are already waiting for an opponent." });
            } else {
                // Check if this player is already in another active room (simple check)
                let alreadyInRoom = false;
                for (const room of rooms.values()) {
                    if (room.players[socket.id]) {
                        alreadyInRoom = true;
                        // Re-send their current game state or an error
                        socket.emit(SOCKET_EVENTS.ERROR, { message: "You are already in a game." });
                        // Potentially re-join them to their room's socket.io channel if disconnected
                        socket.join(room.roomName);
                        socket.emit(SOCKET_EVENTS.ROOM_JOINED, {
                            roomName: room.roomName,
                            yourPlayerId: socket.id,
                            isPlayerOne: room.players[socket.id].isPlayerOne,
                            initialGameState: room.gameState,
                            message: "Rejoined your active game."
                        });
                        break;
                    }
                }

                if (!alreadyInRoom) {
                    waitingPlayerSocket = socket;
                    console.log(`Player ${socket.id} is now waiting for an opponent.`);
                    socket.emit(SOCKET_EVENTS.WAITING_FOR_PLAYER, { message: "Waiting for an opponent to join..." });
                }
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (waitingPlayerSocket && waitingPlayerSocket.id === socket.id) {
            waitingPlayerSocket = null;
            console.log(`Waiting player ${socket.id} disconnected, cleared waiting spot.`);
        }

        // Handle player disconnecting from an active room
        for (const [roomName, room] of rooms.entries()) {
            if (room.players[socket.id]) {
                console.log(`Player ${socket.id} disconnected from room ${roomName}.`);
                // Notify the other player
                const remainingPlayerId = room.playerOrder.find(id => id !== socket.id);
                if (remainingPlayerId) {
                    io.to(remainingPlayerId).emit(SOCKET_EVENTS.OPPONENT_DISCONNECTED, {
                        message: "Your opponent has disconnected. Game over."
                    });
                }
                // Clean up the room
                rooms.delete(roomName);
                console.log(`Room ${roomName} deleted.`);
                // Potentially, the remaining player could go back to waiting queue
                // or the game just ends. For now, it ends.
                break;
            }
        }
    });

    // Placeholder for other events
    socket.on('clientMessage', (data) => { // Keep this for basic testing if needed
        console.log(`Message from ${socket.id}:`, data);
        socket.emit('message', `Server received your message: ${data}`);
    });
});

serverHttp.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});