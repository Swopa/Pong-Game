
import React, { useEffect, useState, useCallback } from 'react';
import socket from './socket';
import './App.css';

// Import types from shared
import {
    SOCKET_EVENTS,
    GameState,
    RoomJoinedPayload, // For the payload of ROOM_JOINED
    // We'll need more types as we build out the UI (Ball, Paddle etc.)
} from '@shared/types';

function App() {
    const [isConnected, setIsConnected] = useState<boolean>(socket.connected);
    const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
    const [isPlayerOne, setIsPlayerOne] = useState<boolean | null>(null);
    const [roomName, setRoomName] = useState<string | null>(null);
    const [uiMessage, setUiMessage] = useState<string>('Connecting to server...');
    const [currentGameState, setCurrentGameState] = useState<GameState | null>(null);

    // --- Handlers for Socket Events ---
    const onConnect = useCallback(() => {
        console.log('Connected to server! Socket ID:', socket.id);
        setIsConnected(true);
        setUiMessage('Connected. Click "Join Game" to find a match.');
        // socket.id is available here, but myPlayerId will be set by the server
    }, []);

    const onDisconnect = useCallback(() => {
        console.log('Disconnected from server.');
        setIsConnected(false);
        setUiMessage('Disconnected from server. Please refresh or try again.');
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
        setIsPlayerOne(payload.isPlayerOne);
        setCurrentGameState(payload.initialGameState);
        setUiMessage(payload.message || `Joined room: ${payload.roomName}. You are Player ${payload.isPlayerOne ? 1 : 2}.`);
    }, []);

    const onGameStart = useCallback((initialGameState: GameState) => {
        console.log(SOCKET_EVENTS.GAME_START, initialGameState);
        setCurrentGameState(initialGameState);
        setUiMessage(`Game started in room ${roomName}! Good luck.`);
    }, [roomName]); // Dependency on roomName for the message

    const onOpponentDisconnected = useCallback((data: { message: string }) => {
        console.log(SOCKET_EVENTS.OPPONENT_DISCONNECTED, data);
        setUiMessage(data.message || "Your opponent disconnected. Game over.");
        // Reset game state or navigate away from game view
        setCurrentGameState(null); // Or a specific "game over" state
        setRoomName(null); // Clear room, ready to join a new one
        setIsPlayerOne(null);
    }, []);

    const onServerError = useCallback((data: { message: string }) => {
        console.error('Server error:', data.message);
        setUiMessage(`Error: ${data.message}`);
    }, []);

    // --- useEffect for Socket Event Listeners ---
    useEffect(() => {
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on(SOCKET_EVENTS.WAITING_FOR_PLAYER, onWaitingForPlayer);
        socket.on(SOCKET_EVENTS.ROOM_JOINED, onRoomJoined);
        socket.on(SOCKET_EVENTS.GAME_START, onGameStart);
        socket.on(SOCKET_EVENTS.OPPONENT_DISCONNECTED, onOpponentDisconnected);
        socket.on(SOCKET_EVENTS.ERROR, onServerError); // Listen for generic errors from server

        // For initial connection status
        if (socket.connected) {
            onConnect();
        }

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off(SOCKET_EVENTS.WAITING_FOR_PLAYER, onWaitingForPlayer);
            socket.off(SOCKET_EVENTS.ROOM_JOINED, onRoomJoined);
            socket.off(SOCKET_EVENTS.GAME_START, onGameStart);
            socket.off(SOCKET_EVENTS.OPPONENT_DISCONNECTED, onOpponentDisconnected);
            socket.off(SOCKET_EVENTS.ERROR, onServerError);
        };
    }, [onConnect, onDisconnect, onWaitingForPlayer, onRoomJoined, onGameStart, onOpponentDisconnected, onServerError]);


    // --- Action Handlers ---
    const handleJoinGame = () => {
        if (socket.connected) {
            console.log('Requesting to join a room...');
            socket.emit(SOCKET_EVENTS.JOIN_ROOM_REQUEST);
            setUiMessage('Searching for a game...');
        } else {
            setUiMessage('Not connected to server. Please wait or refresh.');
        }
    };

    return (
        <div className="App">
            <header className="App-header">
                <h1>Multiplayer Pong</h1>
                <p>Status: {isConnected ? `Connected (ID: ${socket.id || 'N/A'})` : 'Disconnected'}</p>
                <p>UI Message: {uiMessage}</p>

                {!currentGameState && ( // Show Join Game button only if not in a game
                    <button onClick={handleJoinGame} disabled={!isConnected || !!roomName}>
                        {roomName ? "In Room" : "Join Game"}
                    </button>
                )}

                {roomName && <p>Room: {roomName}</p>}
                {myPlayerId && <p>My Player ID: {myPlayerId} {isPlayerOne !== null ? (isPlayerOne ? "(Player 1 - Left)" : "(Player 2 - Right)") : ""}</p>}

                {currentGameState && (
                    <div className="game-info">
                        <h2>Game Active!</h2>
                        <p>Ball X: {currentGameState.ball.x.toFixed(0)}, Ball Y: {currentGameState.ball.y.toFixed(0)}</p>
                        <p>
                            My Score: {currentGameState.scores[myPlayerId!] !== undefined ? currentGameState.scores[myPlayerId!] : 'N/A'}
                        </p>
                        <p>Opponent Score:
                            {
                                Object.keys(currentGameState.scores).map(pId => {
                                    if (pId !== myPlayerId) {
                                        return ` ${currentGameState.scores[pId]}`;
                                    }
                                    return null;
                                })
                            }
                        </p>
                        {/* We will replace this with actual game rendering components */}
                        <pre style={{ textAlign: 'left', border: '1px solid #ccc', padding: '10px' }}>
                            {JSON.stringify(currentGameState, null, 2)}
                        </pre>
                    </div>
                )}
            </header>
        </div>
    );
}

export default App;