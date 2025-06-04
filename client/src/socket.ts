
import { io, Socket } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3001';


// The 'Socket' type comes from 'socket.io-client' and provides type safety.
// We explicitly type 'socket' for better autocompletion and error checking.
const socket: Socket = io(SERVER_URL, {
    
});

socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
});

export default socket;