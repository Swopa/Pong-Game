import express from "express";
import http from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import cors from "cors";

// Import types and constants from shared
import {
  GameState,
  Player,
  Paddle,
  Ball,
  Scores,
  GameUpdatePayload,
  // GameRoom, // We'll manage room state directly here for now, or make a class later
  SOCKET_EVENTS,
  GAME_WIDTH,
  GAME_HEIGHT,
  PADDLE_WIDTH,
  PADDLE_HEIGHT,
  PADDLE_OFFSET_X,
  BALL_RADIUS,
  INITIAL_BALL_SPEED,
  PlayerInputPayload,
  WINNING_SCORE,
  PaddleMoveKey,
  PADDLE_SPEED, // Make sure PADDLE_SPEED is exported from shared/types.ts or define it here
} from "@shared/types";

// --- Game Loop Constants ---
const FRAME_RATE = 60; // Target frames per second for game updates
const GAME_LOOP_INTERVAL = 1000 / FRAME_RATE; // Interval in milliseconds

const app = express();
app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  })
);

const serverHttp = http.createServer(app);
const io = new SocketIOServer(serverHttp, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3001;

// --- Game Room Management ---
interface ServerGameRoom {
  roomName: string;
  players: { [socketId: string]: PlayerDetails }; // Player socketId to their details
  gameState: GameState;
  playerOrder: string[]; // [player1SocketId, player2SocketId]
  status: "waiting" | "playing" | "finished";
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
    scores: {}, // Will be populated
    status: "starting",
    message: "Waiting for game to start...",
  };
}

io.on("connection", (socket: Socket) => {
  console.log("A user connected:", socket.id);

  socket.on(SOCKET_EVENTS.JOIN_ROOM_REQUEST, () => {
    console.log(`\n--- SERVER: JOIN_ROOM_REQUEST from ${socket.id} ---`);

    // Check if this player is already in an *active, playing* game.
    for (const [existingRoomName, existingRoom] of rooms.entries()) {
        if (existingRoom.players[socket.id]) { // If the player is listed in any room
            console.log(`SERVER: Player ${socket.id} found in existing room '${existingRoomName}' which has status: '${existingRoom.status}'`);
            if (existingRoom.status === 'playing') {
                // Player is in an *active, ongoing* game. Send them back.
                console.log(`SERVER: Player ${socket.id} is in an ACTIVE PLAYING room: ${existingRoomName}. Sending them back and blocking new join.`);
                socket.emit(SOCKET_EVENTS.ERROR, { message: "You are already in an active game." });
                socket.join(existingRoomName); // Ensure they are in the socket.io room
                socket.emit(SOCKET_EVENTS.ROOM_JOINED, {
                    roomName: existingRoomName,
                    yourPlayerId: socket.id,
                    isPlayerOne: existingRoom.players[socket.id].isPlayerOne,
                    initialGameState: existingRoom.gameState,
                    message: "Rejoined your active game."
                });
                return; // IMPORTANT: Exit JOIN_ROOM_REQUEST handler for this player
            }
            // If the room status is 'finished' or 'waiting' (though 'waiting' shouldn't have them in 'players' list this way),
            // we simply ignore it and let them proceed to new matchmaking.
            // The old 'finished' room will eventually be cleaned up by disconnects or could be proactively cleaned.
        }
    }

    // If we've reached here, the player is not in an active 'playing' room.
    console.log(`SERVER: Player ${socket.id} is clear to join/wait. Current waitingPlayerSocket: ${waitingPlayerSocket ? waitingPlayerSocket.id : 'null'}`);

    if (waitingPlayerSocket && waitingPlayerSocket.id !== socket.id) {
        // --- Pair with waiting player ---
        console.log(`SERVER: Pairing ${socket.id} with waiting player ${waitingPlayerSocket.id}`);
        const player1Socket = waitingPlayerSocket;
        const player2Socket = socket;
        waitingPlayerSocket = null;

        const roomName = `room-${Date.now()}-${player1Socket.id.substring(0,5)}-${player2Socket.id.substring(0,5)}`; // More unique room name
        console.log(`SERVER: Creating NEW room: ${roomName}`);

        player1Socket.join(roomName);
        player2Socket.join(roomName);

        const initialGameState = createInitialGameState(); // Fresh game state
        const player1Id = player1Socket.id;
        const player2Id = player2Socket.id;

        initialGameState.paddles[player1Id] = { playerId: player1Id, x: PADDLE_OFFSET_X, y: GAME_HEIGHT / 2 - PADDLE_HEIGHT / 2, width: PADDLE_WIDTH, height: PADDLE_HEIGHT };
        initialGameState.scores[player1Id] = 0;
        initialGameState.paddles[player2Id] = { playerId: player2Id, x: GAME_WIDTH - PADDLE_WIDTH - PADDLE_OFFSET_X, y: GAME_HEIGHT / 2 - PADDLE_HEIGHT / 2, width: PADDLE_WIDTH, height: PADDLE_HEIGHT };
        initialGameState.scores[player2Id] = 0;

        const newRoom: ServerGameRoom = {
            roomName,
            players: {
                [player1Id]: { socketId: player1Id, isPlayerOne: true },
                [player2Id]: { socketId: player2Id, isPlayerOne: false },
            },
            gameState: initialGameState,
            playerOrder: [player1Id, player2Id],
            status: 'playing',
        };
        rooms.set(roomName, newRoom);

        console.log(`SERVER: New room ${roomName} created and stored. Players: P1=${player1Id}, P2=${player2Id}.`);

        player1Socket.emit(SOCKET_EVENTS.ROOM_JOINED, { roomName, yourPlayerId: player1Id, isPlayerOne: true, initialGameState, message: "Opponent found! You are Player 1 (Left Paddle)." });
        player2Socket.emit(SOCKET_EVENTS.ROOM_JOINED, { roomName, yourPlayerId: player2Id, isPlayerOne: false, initialGameState, message: "Opponent found! You are Player 2 (Right Paddle)." });

        console.log(`SERVER: Emitting GAME_START to new room ${roomName}`);
        io.to(roomName).emit(SOCKET_EVENTS.GAME_START, initialGameState);

        console.log(`SERVER: Game setup complete for new room ${roomName}, attempting to start loop.`);
        startGameLoop(roomName);

    } else if (!waitingPlayerSocket || waitingPlayerSocket.id === socket.id) {
        // --- Become waiting player or re-confirm waiting status ---
        if (waitingPlayerSocket && waitingPlayerSocket.id === socket.id) {
            console.log(`SERVER: Player ${socket.id} is ALREADY the waitingPlayerSocket.`);
            socket.emit(SOCKET_EVENTS.WAITING_FOR_PLAYER, { message: "You are already waiting for an opponent." });
        } else {
            console.log(`SERVER: Player ${socket.id} becomes the new waitingPlayerSocket.`);
            waitingPlayerSocket = socket;
            socket.emit(SOCKET_EVENTS.WAITING_FOR_PLAYER, { message: "Waiting for an opponent to join..." });
        }
    } else {
        console.error(`SERVER ERROR: Unhandled logic branch in JOIN_ROOM_REQUEST for player ${socket.id}. waitingPlayerSocket: ${waitingPlayerSocket ? waitingPlayerSocket.id : 'null'}`);
    }
});

  socket.on(SOCKET_EVENTS.PLAYER_INPUT, (payload: PlayerInputPayload) => {
    const room = rooms.get(payload.roomName);
    if (!room || room.status !== "playing") {
      return;
    }

    const playerDetails = room.players[socket.id];
    if (!playerDetails) {
      return;
    }

    const paddle = room.gameState.paddles[socket.id];
    if (!paddle) {
      return;
    }

    if (payload.action === "press") {
      let moveUp = false;
      let moveDown = false;

      if (playerDetails.isPlayerOne) {
        if (payload.key === "w") moveUp = true;
        if (payload.key === "s") moveDown = true;
      } else {
        if (payload.key === "ArrowUp") moveUp = true;
        if (payload.key === "ArrowDown") moveDown = true;
      }

      if (moveUp) {
        paddle.y -= PADDLE_SPEED;
      }
      if (moveDown) {
        paddle.y += PADDLE_SPEED;
      }

      if (paddle.y < 0) {
        paddle.y = 0;
      }
      if (paddle.y + PADDLE_HEIGHT > GAME_HEIGHT) {
        paddle.y = GAME_HEIGHT - PADDLE_HEIGHT;
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    if (waitingPlayerSocket && waitingPlayerSocket.id === socket.id) {
      waitingPlayerSocket = null;
      console.log(
        `Waiting player ${socket.id} disconnected, cleared waiting spot.`
      );
    }

    for (const [roomNameIteration, room] of rooms.entries()) {
      // Renamed roomName to avoid conflict in block scope
      if (room.players[socket.id]) {
        console.log(
          `Player ${socket.id} disconnected from room ${room.roomName}.`
        );
        // Notify the other player
        const remainingPlayerId = room.playerOrder.find(
          (id) => id !== socket.id
        );
        if (remainingPlayerId) {
          io.to(remainingPlayerId).emit(SOCKET_EVENTS.OPPONENT_DISCONNECTED, {
            message: "Your opponent has disconnected. Game over.",
          });
        }

        // VVVVVV STOP THE GAME LOOP FOR THIS ROOM VVVVVV
        const loop = gameLoops.get(room.roomName); // Use room.roomName here
        if (loop) {
          clearInterval(loop);
          gameLoops.delete(room.roomName); // Use room.roomName here
          console.log(
            `Game loop for room ${room.roomName} stopped due to player disconnect.`
          );
        }
        // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

        // Clean up the room from the `rooms` map
        rooms.delete(room.roomName); // Use room.roomName here
        console.log(`Room ${room.roomName} deleted.`);
        break;
      }
    }
  });

  socket.on("clientMessage", (data) => {
    console.log(`Message from ${socket.id}:`, data);
    socket.emit("message", `Server received your message: ${data}`);
  });
});

serverHttp.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// (We can move these into a separate game.ts file later for better organization)
function updateBallPosition(ball: Ball) {
  ball.x += ball.dx * ball.speed;
  ball.y += ball.dy * ball.speed;
}

function handleWallCollisions(ball: Ball): boolean {
  // Returns true if a vertical wall was hit (for score)
  let scored = false;
  // Top/Bottom walls
  if (ball.y - ball.radius < 0) {
    ball.y = ball.radius;
    ball.dy *= -1;
  } else if (ball.y + ball.radius > GAME_HEIGHT) {
    ball.y = GAME_HEIGHT - ball.radius;
    ball.dy *= -1;
  }

  // Left/Right walls (scoring)
  if (ball.x - ball.radius < 0) {
    // Ball passed left paddle
    scored = true;
  } else if (ball.x + ball.radius > GAME_WIDTH) {
    // Ball passed right paddle
    scored = true;
  }
  return scored;
}

function handlePaddleCollision(ball: Ball, paddle: Paddle): boolean {
  // Simple AABB (Axis-Aligned Bounding Box) collision detection
  const ballTop = ball.y - ball.radius;
  const ballBottom = ball.y + ball.radius;
  const ballLeft = ball.x - ball.radius;
  const ballRight = ball.x + ball.radius;

  const paddleTop = paddle.y;
  const paddleBottom = paddle.y + paddle.height;
  const paddleLeft = paddle.x;
  const paddleRight = paddle.x + paddle.width;

  if (
    ballLeft < paddleRight &&
    ballRight > paddleLeft &&
    ballTop < paddleBottom &&
    ballBottom > paddleTop
  ) {
    // Collision detected
    ball.dx *= -1; // Reverse horizontal direction

    // Optional: Adjust ball's vertical direction based on where it hit the paddle
    const hitSpot =
      (ball.y - (paddle.y + paddle.height / 2)) / (paddle.height / 2); // -1 to 1
    ball.dy = hitSpot * 0.8; // Max angle change, adjust 0.8 as needed
    // Ensure dy isn't too flat or too steep

    // Ensure ball is moved out of paddle to prevent sticking
    if (ball.dx > 0) {
      // Moving right, hit left paddle
      ball.x = paddleRight + ball.radius;
    } else {
      // Moving left, hit right paddle
      ball.x = paddleLeft - ball.radius;
    }

    // Optional: Increase ball speed slightly
    // ball.speed = Math.min(ball.speed * 1.05, INITIAL_BALL_SPEED * 2); // Cap speed

    return true;
  }
  return false;
}

function resetBall(ball: Ball) {
  ball.x = GAME_WIDTH / 2;
  ball.y = GAME_HEIGHT / 2;
  ball.speed = INITIAL_BALL_SPEED;
  ball.dx = Math.random() < 0.5 ? 1 : -1; // Random horizontal direction
  // More varied angle, ensure it's not too flat
  let newDy;
  do {
    newDy = (Math.random() * 2 - 1) * 0.7; // Random vertical direction, less steep
  } while (Math.abs(newDy) < 0.1); // Ensure it's not too flat
  ball.dy = newDy;
}

// --- Game Loop for a Room ---
const gameLoops = new Map<string, NodeJS.Timeout>(); // To store interval IDs for each room

function startGameLoop(roomName: string) {
  const room = rooms.get(roomName);
  if (!room || room.status !== "playing") return;

  console.log(`Starting game loop for room: ${roomName}`);

  const loop = setInterval(() => {
    if (!rooms.has(roomName)) {
      // If room was deleted (e.g., player disconnected)
      clearInterval(loop);
      gameLoops.delete(roomName);
      console.log(`Stopped game loop for deleted room: ${roomName}`);
      return;
    }

    const currentRoom = rooms.get(roomName)!; // We know room exists here
    const gameState = currentRoom.gameState;

    updateBallPosition(gameState.ball);

    // Paddle collisions
    const player1Id = currentRoom.playerOrder[0];
    const player2Id = currentRoom.playerOrder[1];
    const paddle1 = gameState.paddles[player1Id];
    const paddle2 = gameState.paddles[player2Id];

    if (gameState.ball.dx < 0) {
      // Ball moving left, check collision with P1 paddle
      if (paddle1) handlePaddleCollision(gameState.ball, paddle1);
    } else {
      // Ball moving right, check collision with P2 paddle
      if (paddle2) handlePaddleCollision(gameState.ball, paddle2);
    }

    // Wall collisions and Scoring
    const scored = handleWallCollisions(gameState.ball);
    if (scored) {
      if (gameState.ball.x < GAME_WIDTH / 2) {
        // Ball on left side, P2 scores
        gameState.scores[player2Id]++;
        gameState.message = "Player 2 Scores!";
        console.log(
          `Player 2 scored in room ${roomName}. Score: P1=${gameState.scores[player1Id]}, P2=${gameState.scores[player2Id]}`
        );
      } else {
        // Ball on right side, P1 scores
        gameState.scores[player1Id]++;
        gameState.message = "Player 1 Scores!";
        console.log(
          `Player 1 scored in room ${roomName}. Score: P1=${gameState.scores[player1Id]}, P2=${gameState.scores[player2Id]}`
        );
      }
      resetBall(gameState.ball);
    } else {
      gameState.message = null; // Clear scoring message if no score this frame
    }

    if (
      gameState.scores[player1Id] >= WINNING_SCORE ||
      gameState.scores[player2Id] >= WINNING_SCORE
    ) {
      currentRoom.status = "finished";
      gameState.status = "gameOver";
      gameState.winner =
        gameState.scores[player1Id] >= WINNING_SCORE ? player1Id : player2Id;
      const winnerName =
        gameState.winner === player1Id ? "Player 1" : "Player 2";
      gameState.message = `Game Over! ${winnerName} wins!`;

      console.log(`Game over in room ${roomName}. Winner: ${winnerName}`);

      // Stop the game loop
      const loop = gameLoops.get(roomName);
      if (loop) {
        clearInterval(loop);
        gameLoops.delete(roomName);
      }

      // Emit final game over state (clients can use this to display final message and options)
      io.to(roomName).emit(SOCKET_EVENTS.GAME_OVER, gameState);
      // We'll also still send a GAME_UPDATE so clients get the final scores/message.
      // The GAME_OVER event is more of a signal.
      const updatePayload: GameUpdatePayload = { gameState };
      io.to(roomName).emit(SOCKET_EVENTS.GAME_UPDATE, updatePayload);

      

      // Optionally, after a delay, you could automatically clean up the room
      // or wait for clients to explicitly leave/request new game.
      // For now, the room stays until disconnect or new join requests effectively reset things.
      // To allow players to "find new game", we don't immediately delete the room from `rooms` map here.
      // It gets cleaned up if they disconnect, or effectively reset if they both join new games.
      return; // Exit the loop iteration as game is over
    } else {
      gameState.message = null; // Clear scoring message if no score this frame
    }

    // Broadcast updated game state to all clients in the room
    const updatePayload: GameUpdatePayload = { gameState };
    io.to(roomName).emit(SOCKET_EVENTS.GAME_UPDATE, updatePayload);
  }, GAME_LOOP_INTERVAL);

  gameLoops.set(roomName, loop);
}
