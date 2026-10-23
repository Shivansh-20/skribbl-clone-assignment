// server/run_phase1_test.mjs
// Self-contained test: starts server on random available port, connects 2 clients, tests Phase 1.

import express          from 'express';
import { createServer } from 'http';
import { Server }       from 'socket.io';
import { io as Client } from 'socket.io-client';

import {
  rooms,
  generateCode,
  makePlayer,
  sanitizeSettings,
  getRoomBySocket,
} from './src/rooms.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

// Wire exact same event handlers as src/index.js
io.on('connection', (socket) => {
  socket.on('create_room', (payload, ack) => {
    if (typeof ack !== 'function') return;
    const player = makePlayer(socket.id, payload?.hostName);
    if (!player.name) return ack({ error: 'Invalid name' });

    const code = generateCode();
    const settings = sanitizeSettings(payload?.settings);
    const room = { code, hostId: socket.id, settings, players: [player], phase: 'lobby' };
    rooms.set(code, room);
    socket.data.roomCode = code;
    socket.join(code);
    ack({ ok: true, code, room });
  });

  socket.on('join_room', (payload, ack) => {
    if (typeof ack !== 'function') return;
    const code = payload?.code?.toUpperCase()?.trim();
    const room = rooms.get(code);
    if (!room) return ack({ error: 'Room not found' });
    if (room.players.length >= room.settings.maxPlayers) return ack({ error: 'Full' });

    const player = makePlayer(socket.id, payload?.playerName);
    room.players.push(player);
    socket.data.roomCode = code;
    socket.join(code);
    io.to(code).emit('player_joined', { players: room.players });
    ack({ ok: true, code, room });
  });

  socket.on('start_game', () => {
    const room = getRoomBySocket(socket);
    if (!room || socket.id !== room.hostId || room.players.length < 2) return;
    io.to(room.code).emit('game_started');
  });

  socket.on('disconnect', () => {
    const room = getRoomBySocket(socket);
    if (!room) return;
    const idx = room.players.findIndex(p => p.id === socket.id);
    if (idx !== -1) room.players.splice(idx, 1);
    if (room.players.length === 0) {
      rooms.delete(room.code);
    } else {
      if (socket.id === room.hostId) room.hostId = room.players[0].id;
      io.to(room.code).emit('player_left', { playerId: socket.id, players: room.players, hostId: room.hostId });
    }
  });
});

await new Promise((res) => httpServer.listen(0, res));
const port = httpServer.address().port;
const URL = `http://localhost:${port}`;

console.log(`Test server running on port ${port}`);

// Test 1: Alice creates room
const c1 = Client(URL);
await new Promise(r => c1.on('connect', r));

const createRes = await new Promise(r => c1.emit('create_room', { hostName: 'Alice' }, r));
if (!createRes.ok || createRes.code.length !== 5) {
  console.error('FAIL: create_room');
  process.exit(1);
}
console.log(`PASS 1: create_room returned code "${createRes.code}"`);

// Test 2: Bob joins room
const c2 = Client(URL);
await new Promise(r => c2.on('connect', r));

const aliceReceivedBob = new Promise(r => c1.on('player_joined', r));
const joinRes = await new Promise(r => c2.emit('join_room', { code: createRes.code, playerName: 'Bob' }, r));
if (!joinRes.ok) {
  console.error('FAIL: join_room');
  process.exit(1);
}
console.log('PASS 2: Bob joined successfully');

const joinedPayload = await aliceReceivedBob;
if (joinedPayload.players.length !== 2) {
  console.error('FAIL: player_joined player count mismatch');
  process.exit(1);
}
console.log('PASS 3: Alice received broadcast of Bob joining (2 players in room)');

// Test 3: Host starts game
const bobSawStart = new Promise(r => c2.on('game_started', r));
c1.emit('start_game');
await bobSawStart;
console.log('PASS 4: Start game broadcast reached other room members');

// Test 4: Bob leaves
const aliceSawBobLeave = new Promise(r => c1.on('player_left', r));
c2.disconnect();
const leavePayload = await aliceSawBobLeave;
if (leavePayload.players.length !== 1) {
  console.error('FAIL: player_left count mismatch');
  process.exit(1);
}
console.log('PASS 5: Player left broadcast received and player count decremented');

// Cleanup
c1.disconnect();
httpServer.close();
console.log('\n⭐ ALL PHASE 1 CHECKS PASSED PERFECTLY!\n');
process.exit(0);
