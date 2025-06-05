

// ------------ Game Constants ------------
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
export const PADDLE_WIDTH = 15;
export const PADDLE_HEIGHT = 100;
export const PADDLE_SPEED = 10; // Units per keyboard event (or per frame if continuous)
export const BALL_RADIUS = 8;
export const INITIAL_BALL_SPEED = 5;
export const PADDLE_OFFSET_X = 30; // Distance from side walls

// ------------ Game Object Interfaces ------------
export interface Player {
  id: string; // Corresponds to socket.id
  name: string; // Could be user-entered or generated
  // playerNumber: 1 | 2; // Could be assigned by the server
}

export interface Paddle {
  playerId: string; // ID of the player controlling this paddle
  x: number;
  y: number;
  width: number;
  height: number;
  // dy: number; // Current vertical speed, for smoother server-side movement if needed
}

export interface Ball {
  x: number;
  y: number;
  radius: number;
  dx: number; // Direction vector x (-1 or 1 for horizontal)
  dy: number; // Direction vector y (can be a float for angle)
  speed: number;
}

// ------------ Game State & Room Interfaces ------------
export interface Scores {
  [playerId: string]: number; // Score for player1Id and player2Id
}

export interface GameRoom {
  roomName: string;
  players: Player[]; // Max 2 players
  gameState: GameState;
  status: 'waiting' | 'playing' | 'finished';
  // gameLoopInterval?: NodeJS.Timeout; // Server-side only
}

export interface GameState {
  ball: Ball;
  paddles: { // Keyed by player ID
    [playerId: string]: Paddle;
  };
  scores: Scores;
  status: 'starting' | 'playing' | 'paused' | 'score' | 'gameOver'; // More granular game phase
  message: string | null; // e.g., "Player 1 scores!", "Game Over!"
  lastScoredBy?: string | null; // playerId who last scored
  winner?: string | null; // playerId of the winner
}


// ------------ Socket Event Payloads (Client to Server) ------------
export interface PlayerInputPayload {
  // Define what input the client sends, e.g., for paddle movement
  // Example: { direction: 'up' | 'down' | 'stop' }
  // Or simply the new desired Y position (less ideal as server should validate)
  key: 'ArrowUp' | 'ArrowDown' | 'w' | 's'; // Or 'up' | 'down'
  action: 'press' | 'release';
}

export interface JoinRoomPayload {
  playerName?: string; // Optional player name
}


// ------------ Socket Event Payloads (Server to Client) ------------
export interface GameUpdatePayload {
  gameState: GameState;
}

export interface RoomJoinedPayload {
  roomName: string;
  yourPlayerId: string;
  isPlayerOne: boolean; 
  initialGameState: GameState;
  message: string;
}

export interface ErrorPayload {
  message: string;
}

export interface PlayerAssignedPayload {
  playerId: string; // The ID of this client's player
  isPlayerOne: boolean; // True if this client controls the left paddle
  // initialPaddleY: number; // Could be sent if server determines initial Y
}

// It's good practice to define the event names as constants too
export const SOCKET_EVENTS = {
  // Client to Server
  PLAYER_INPUT: 'playerInput',
  JOIN_ROOM_REQUEST: 'joinRoomRequest', // Client wants to join/create a room

  // Server to Client
  GAME_UPDATE: 'gameUpdate',         // Full game state update
  PADDLE_MOVE_CONFIRMED: 'paddleMoveConfirmed', // (Optional) if you only send deltas
  ROOM_JOINED: 'roomJoined',         // Confirmation that player joined a room, with initial state
  GAME_START: 'gameStart',           // Signals the game is officially starting
  OPPONENT_JOINED: 'opponentJoined',
  OPPONENT_DISCONNECTED: 'opponentDisconnected',
  SCORE_UPDATE: 'scoreUpdate',       // For just score changes, or include in GameState
  GAME_OVER: 'gameOver',
  ERROR: 'error',                    // For sending error messages to client
  PLAYER_ASSIGNMENT: 'playerAssignment', // Tells client which player they are
  WAITING_FOR_PLAYER: 'waitingForPlayer',
} as const; // `as const` makes the values read-only and more specific types