// client/src/socket.js
// Creates ONE socket connection for the whole app.
// Import this file wherever you need to send or receive events.
//
// Why not create the socket inside a component?
// If you did, every re-render would open a new connection.
// One module-level constant = one connection per browser tab.

import { io } from 'socket.io-client';

// In development: Vite's proxy forwards /socket.io → localhost:3001.
// In production: the page and the server share the same URL,
//   so passing no argument connects back to wherever the page came from.
const socket = io({ autoConnect: false });

export default socket;
