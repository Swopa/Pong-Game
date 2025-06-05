import React, { useEffect, useState, useCallback } from 'react';
import socket from './socket';
import './App.css';

// Import types from shared
import {
    SOCKET_EVENTS,
    GameState,
    RoomJoinedPayload,
    PlayerInputPayload, // For constructing the payload to send
    PaddleMoveKey,      // For typing the event.key
    // Ball, Paddle etc. will be used when we render the game properly
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
        setIsPlayerOne(payload.isPlayerOne); // Assumes isPlayerOne is in RoomJoinedPayload
        setCurrentGameState(payload.initialGameState);
        setUiMessage(payload.message || `Joined room: ${payload.roomName}. You are Player ${payload.isPlayerOne ? 1 : 2}.`);
    }, []);

    const onGameStart = useCallback((initialGameState: GameState) => {
        console.log(SOCKET_EVENTS.GAME_START, initialGameState);
        setCurrentGameState(initialGameState);
        // The message update relies on roomName being set from ROOM_JOINED
        setUiMessage(`Game started in room ${roomName || 'your room'}! Good luck.`);
    }, [roomName]);

    const onOpponentDisconnected = useCallback((data: { message: string }) => {
        console.log(SOCKET_EVENTS.OPPONENT_DISCONNECTED, data);
        setUiMessage(data.message || "Your opponent disconnected. Game over.");
        setCurrentGameState(null);
        setRoomName(null);
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
        socket.on(SOCKET_EVENTS.GAME_START, onGameStart); // Listens for GAME_START
        socket.on(SOCKET_EVENTS.OPPONENT_DISCONNECTED, onOpponentDisconnected);
        socket.on(SOCKET_EVENTS.ERROR, onServerError);

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


    // --- useEffect for Keyboard Input ---
    useEffect(() => {
        // Only add listeners if the player is in a room, game state exists, and player role is known
        if (!roomName || !currentGameState || !myPlayerId || isPlayerOne === null) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            const key = event.key as PaddleMoveKey;

            if (key === 'w' || key === 's' || key === 'ArrowUp' || key === 'ArrowDown') {
                event.preventDefault();

                let shouldEmit = false;
                if (isPlayerOne) { // Player 1 (isPlayerOne === true) controls 'w' and 's'
                    if (key === 'w' || key === 's') shouldEmit = true;
                } else { // Player 2 (isPlayerOne === false) controls 'ArrowUp' and 'ArrowDown'
                    if (key === 'ArrowUp' || key === 'ArrowDown') shouldEmit = true;
                }

                if (shouldEmit) {
                    const payload: PlayerInputPayload = {
                        roomName: roomName,
                        key: key,
                        action: 'press',
                    };
                    socket.emit(SOCKET_EVENTS.PLAYER_INPUT, payload);
                    // console.log('Sent PLAYER_INPUT:', payload); // For debugging client send
                }
            }
        };

        // Add keydown listener
        window.addEventListener('keydown', handleKeyDown);

        // Cleanup: remove event listener when component unmounts or dependencies change
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [roomName, currentGameState, myPlayerId, isPlayerOne]); // Dependencies: re-run if these change


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
                <p>Status: {isConnected ? `Connected (Client ID: ${socket.id || 'N/A'})` : 'Disconnected'}</p>
                <p>UI Message: {uiMessage}</p>

                {!currentGameState && (
                    <button onClick={handleJoinGame} disabled={!isConnected || !!roomName}>
                        {roomName ? "In Room..." : "Join Game"}
                    </button>
                )}

                {roomName && <p>Room: {roomName}</p>}
                {myPlayerId && <p>My Server-Assigned Player ID: {myPlayerId} {isPlayerOne !== null ? (isPlayerOne ? "(Player 1 - Left - Controls: W/S)" : "(Player 2 - Right - Controls: Up/Down Arrows)") : ""}</p>}

                {currentGameState && (
                    <div className="game-info">
                        <h2>Game Active! (Raw State Below)</h2>
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
                                }).filter(Boolean).join('') || 'N/A' // filter(Boolean) removes nulls, join concatenates
                            }
                        </p>
                        <pre style={{ textAlign: 'left', border: '1px solid #ccc', padding: '10px', maxHeight: '300px', overflowY: 'auto', background: '#f7f7f7' }}>
                            {JSON.stringify(currentGameState, null, 2)}
                        </pre>
                    </div>
                )}
            </header>
        </div>
    );
}

export default App;