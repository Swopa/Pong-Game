import React, { useEffect, useState, useCallback } from "react";
import socket from "./socket";
import "./App.css";
import GameArea from "./components/GameArea";

// Import types from shared
import {
  SOCKET_EVENTS,
  GameState,
  RoomJoinedPayload,
  PlayerInputPayload, // For constructing the payload to send
  PaddleMoveKey, // For typing the event.key
  // Ball, Paddle etc. will be used when we render the game properly
  GameUpdatePayload,
} from "@shared/types";

function App() {
  const [gameOverMessage, setGameOverMessage] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(socket.connected);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [isPlayerOne, setIsPlayerOne] = useState<boolean | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [uiMessage, setUiMessage] = useState<string>("Connecting to server...");
  const [currentGameState, setCurrentGameState] = useState<GameState | null>(
    null
  );

  // --- Handlers for Socket Events ---
  const onConnect = useCallback(() => {
    console.log("Connected to server! Socket ID:", socket.id);
    setIsConnected(true);
    setUiMessage('Connected. Click "Join Game" to find a match.');
  }, []);

  const onDisconnect = useCallback(() => {
    console.log("Disconnected from server.");
    setIsConnected(false);
    setUiMessage("Disconnected from server. Please refresh or try again.");
    setMyPlayerId(null);
    setRoomName(null);
    setCurrentGameState(null);
    setIsPlayerOne(null);
  }, []);

  const onWaitingForPlayer = useCallback((data: { message: string }) => {
    console.log(SOCKET_EVENTS.WAITING_FOR_PLAYER, data);
    setUiMessage(data.message);
  }, []);

  const onRoomJoined = useCallback((payload: RoomJoinedPayload) => {
    console.log(SOCKET_EVENTS.ROOM_JOINED, payload);
    setRoomName(payload.roomName);
    setMyPlayerId(payload.yourPlayerId);
    setIsPlayerOne(payload.isPlayerOne); // Assumes isPlayerOne is in RoomJoinedPayload
    setCurrentGameState(payload.initialGameState);
    setUiMessage(
      payload.message ||
        `Joined room: ${payload.roomName}. You are Player ${
          payload.isPlayerOne ? 1 : 2
        }.`
    );
  }, []);

  const onGameOver = useCallback((finalGameState: GameState) => {
    console.log(SOCKET_EVENTS.GAME_OVER, finalGameState);
    setCurrentGameState(finalGameState); // Ensure final state is set
    if (finalGameState.winner && finalGameState.message) {
      setGameOverMessage(finalGameState.message);
    } else {
      setGameOverMessage("Game Over!");
    }
    // `uiMessage` might also be set by the last GAME_UPDATE's gameState.message
  }, []);

  const onGameStart = useCallback(
    (initialGameState: GameState) => {
      console.log(SOCKET_EVENTS.GAME_START, initialGameState);
      setCurrentGameState(initialGameState);
      // The message update relies on roomName being set from ROOM_JOINED
      setUiMessage(
        `Game started in room ${roomName || "your room"}! Good luck.`
      );
    },
    [roomName]
  );

  const onGameUpdate = useCallback(
    (payload: GameUpdatePayload) => {
      // For debugging, to see the updates flooding in:
      // console.log('Received GAME_UPDATE', payload.gameState);
      setCurrentGameState(payload.gameState);

      // Update UI message if the game state contains a message (e.g., scoring)
      if (payload.gameState.message) {
        setUiMessage(payload.gameState.message);
      } else if (
        currentGameState?.status === "playing" &&
        uiMessage.includes("Scores!")
      ) {
        // Clear scoring message if game is playing and previous message was a score
        // This is a simple way, could be more robust
        // setUiMessage(`Game active in room ${roomName || 'your room'}`);
      }
    },
    [currentGameState?.status, uiMessage, roomName]
  );

  const onOpponentDisconnected = useCallback((data: { message: string }) => {
    console.log(SOCKET_EVENTS.OPPONENT_DISCONNECTED, data);
    setUiMessage(data.message || "Your opponent disconnected. Game over.");
    setCurrentGameState(null);
    setRoomName(null);
    setIsPlayerOne(null);
  }, []);

  const onServerError = useCallback((data: { message: string }) => {
    console.error("Server error:", data.message);
    setUiMessage(`Error: ${data.message}`);
  }, []);

  // --- useEffect for Socket Event Listeners ---
  useEffect(() => {
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on(SOCKET_EVENTS.WAITING_FOR_PLAYER, onWaitingForPlayer);
    socket.on(SOCKET_EVENTS.ROOM_JOINED, onRoomJoined);
    socket.on(SOCKET_EVENTS.GAME_START, onGameStart); // Listens for GAME_START
    socket.on(SOCKET_EVENTS.GAME_UPDATE, onGameUpdate);
    socket.on(SOCKET_EVENTS.OPPONENT_DISCONNECTED, onOpponentDisconnected);
    socket.on(SOCKET_EVENTS.ERROR, onServerError);
    socket.on(SOCKET_EVENTS.GAME_OVER, onGameOver);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off(SOCKET_EVENTS.WAITING_FOR_PLAYER, onWaitingForPlayer);
      socket.off(SOCKET_EVENTS.ROOM_JOINED, onRoomJoined);
      socket.off(SOCKET_EVENTS.GAME_START, onGameStart);
      socket.off(SOCKET_EVENTS.GAME_UPDATE, onGameUpdate);
      socket.off(SOCKET_EVENTS.OPPONENT_DISCONNECTED, onOpponentDisconnected);
      socket.off(SOCKET_EVENTS.ERROR, onServerError);
      socket.off(SOCKET_EVENTS.GAME_OVER, onGameOver);
    };
  }, [
    onConnect,
    onDisconnect,
    onWaitingForPlayer,
    onRoomJoined,
    onGameUpdate,
    onGameStart,
    onOpponentDisconnected,
    onServerError,
    onGameOver
  ]);

  // --- useEffect for Keyboard Input ---
  useEffect(() => {
    // Only add listeners if the player is in a room, game state exists, and player role is known
    if (!roomName || !currentGameState || !myPlayerId || isPlayerOne === null) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key as PaddleMoveKey;

      if (
        key === "w" ||
        key === "s" ||
        key === "ArrowUp" ||
        key === "ArrowDown"
      ) {
        event.preventDefault();

        let shouldEmit = false;
        if (isPlayerOne) {
          // Player 1 (isPlayerOne === true) controls 'w' and 's'
          if (key === "w" || key === "s") shouldEmit = true;
        } else {
          // Player 2 (isPlayerOne === false) controls 'ArrowUp' and 'ArrowDown'
          if (key === "ArrowUp" || key === "ArrowDown") shouldEmit = true;
        }

        if (shouldEmit) {
          const payload: PlayerInputPayload = {
            roomName: roomName,
            key: key,
            action: "press",
          };
          socket.emit(SOCKET_EVENTS.PLAYER_INPUT, payload);
          // console.log('Sent PLAYER_INPUT:', payload); // For debugging client send
        }
      }
    };

    // Add keydown listener
    window.addEventListener("keydown", handleKeyDown);

    // Cleanup: remove event listener when component unmounts or dependencies change
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [roomName, currentGameState, myPlayerId, isPlayerOne]); // Dependencies: re-run if these change

  // --- Action Handlers ---
  const handleJoinGame = () => {
    if (socket.connected) {
      console.log("Requesting to join a room...");
      setGameOverMessage(null);     // Clear the game over message
      setCurrentGameState(null);    // Clear the state of the previous game
      setRoomName(null);            // Clear the old room name
      setIsPlayerOne(null);         // Clear player role assignment
      socket.emit(SOCKET_EVENTS.JOIN_ROOM_REQUEST);
      setUiMessage("Searching for a game...");
    } else {
      setUiMessage("Not connected to server. Please wait or refresh.");
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Multiplayer Pong</h1>
      </header>

      <div className="info-panels-container">
        <div className="panel server-info-panel">
          <h2>Server Info</h2>
          <p>Status: {isConnected ? "Connected" : "Disconnected"}</p>
          {isConnected && <p>Client ID: {socket.id || "N/A"}</p>}
          {/* Display uiMessage only if it's NOT the game over message */}
          {uiMessage !== gameOverMessage && (
            <p className="ui-message">Message: {uiMessage}</p>
          )}
          {roomName &&
            !gameOverMessage &&
            currentGameState?.status !== "gameOver" && <p>Room: {roomName}</p>}
        </div>

        {myPlayerId &&
          currentGameState &&
          currentGameState.status !== "gameOver" &&
          !gameOverMessage && (
            <div className="panel player-info-panel">
              <h2>Your Game Info</h2>
              <p>
                You are:{" "}
                <strong>
                  {isPlayerOne
                    ? "Player 1 (Left Paddle)"
                    : "Player 2 (Right Paddle)"}
                </strong>
              </p>
              <p>
                Controls:{" "}
                <strong>
                  {isPlayerOne ? "W (Up) / S (Down)" : "ArrowUp / ArrowDown"}
                </strong>
              </p>
            </div>
          )}
      </div>

      {/* --- Main Content Area: Game Over, Game Active, or Pre-Game --- */}
      <div className="main-content-area">
        {gameOverMessage ? (
          <div className="game-over-section">
            <h2>{gameOverMessage}</h2>
            <button onClick={handleJoinGame} className="action-button">
              Find New Match
            </button>
          </div>
        ) : currentGameState && currentGameState.status !== "gameOver" ? (
          <div className="game-container">
            <GameArea gameState={currentGameState} myPlayerId={myPlayerId} />
          </div>
        ) : (
          <div className="game-interaction-area">
            {!roomName ? (
              <button
                onClick={handleJoinGame}
                disabled={!isConnected}
                className="action-button"
              >
                Join Game
              </button>
            ) : (
              <p>Waiting for game to start in room: {roomName}...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
