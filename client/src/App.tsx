
import React, { useEffect, useState } from 'react';
import socket from './socket'; 
import './App.css'; 

function App() {
  const [isConnected, setIsConnected] = useState<boolean>(socket.connected);
  const [serverMessage, setServerMessage] = useState<string>('');
  const [myId, setMyId] = useState<string | null>(null);
  const [messageToSend, setMessageToSend] = useState<string>('');

  useEffect(() => {
    // Listener for when the connection is established
    const onConnect = () => {
      console.log('Connected to server! Socket ID:', socket.id);
      setIsConnected(true);
      setMyId(socket.id || 'N/A'); // Store our socket ID
    };

    // Listener for when the connection is lost
    const onDisconnect = () => {
      console.log('Disconnected from server.');
      setIsConnected(false);
      setMyId(null);
    };

    // Listener for custom 'message' events from the server
    const onServerMessage = (data: string) => {
      console.log('Message from server:', data);
      setServerMessage(prevMessages => `${prevMessages}\nServer: ${data}`); // Append new messages
    };

    // Registering event listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('message', onServerMessage); // This matches the event name in server.ts

    // Check initial connection status
    setIsConnected(socket.connected);
    if (socket.connected) {
      setMyId(socket.id || 'N/A');
    }

    // Cleanup function: Remove event listeners when the component unmounts
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('message', onServerMessage);
    };
  }, []); // Empty dependency array means this effect runs once on mount and cleans up on unmount

  const handleSendMessage = () => {
    if (messageToSend.trim() && socket.connected) {
      socket.emit('clientMessage', messageToSend); // Matches event name in server.ts
      setServerMessage(prev => `${prev}\nMe: ${messageToSend}`);
      setMessageToSend('');
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Multiplayer Pong Client</h1>
        <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
        {myId && <p>My Socket ID: {myId}</p>}
        <div>
          <input
            type="text"
            value={messageToSend}
            onChange={(e) => setMessageToSend(e.target.value)}
            placeholder="Type a message..."
          />
          <button onClick={handleSendMessage} disabled={!isConnected}>
            Send Message to Server
          </button>
        </div>
        <h3>Server Responses:</h3>
        <pre style={{ textAlign: 'left', whiteSpace: 'pre-wrap', border: '1px solid #ccc', padding: '10px', maxHeight: '200px', overflowY: 'auto' }}>
          {serverMessage || "No messages yet."}
        </pre>
      </header>
    </div>
  );
}

export default App;