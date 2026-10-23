// server/src/index.js
// Phase 1 + Phase 2: Adding Real-Time Drawing synchronization to the server.

import express          from 'express';
import { createServer } from 'http';
import { Server }       from 'socket.io';
import cors             from 'cors';
import path             from 'path';
import { fileURLToPath } from 'url';

import {
  rooms,
  generateCode,
  makePlayer,
  sanitizeSettings,
  getRoomBySocket,
} from './rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ?? 3001;

// ─── Express ────────────────────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));

app.get('/health', (_req, res) => {
  res.json({ ok: true, roomsCount: rooms.size });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// ─── HTTP server + Socket.IO ────────────────────────────────────────────────
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`[+] connected: ${socket.id}`);

  // ── 1. Create Room ─────────────────────────────────────────────────────────
  socket.on('create_room', (payload, ack) => {
    if (typeof ack !== 'function') return;

    const hostName = payload?.hostName;
    const player = makePlayer(socket.id, hostName);
    if (!player.name) {
      return ack({ error: 'Please enter a valid display name.' });
    }

    const code = generateCode();
    const settings = sanitizeSettings(payload?.settings);

    const room = {
      code,
      hostId: socket.id,
      settings,
      players: [player],
      phase: 'lobby',
      round: 0,
      drawerIndex: -1,
      strokes: [], // Stores all finished strokes so late joiners & undo work!
    };

    rooms.set(code, room);
    socket.data.roomCode = code;
    socket.join(code);

    console.log(`[${code}] Room created by host "${player.name}" (${socket.id})`);
    ack({ ok: true, code, room });
  });

  // ── 2. Join Room ───────────────────────────────────────────────────────────
  socket.on('join_room', (payload, ack) => {
    if (typeof ack !== 'function') return;

    const code = typeof payload?.code === 'string' ? payload.code.toUpperCase().trim() : '';
    const playerName = payload?.playerName;

    const room = rooms.get(code);
    if (!room) {
      return ack({ error: `Room "${code}" not found. Check the code and try again!` });
    }

    if (room.players.length >= room.settings.maxPlayers) {
      return ack({ error: 'Room is already full.' });
    }

    const player = makePlayer(socket.id, playerName);
    if (!player.name) {
      return ack({ error: 'Please enter a valid display name.' });
    }

    room.players.push(player);
    socket.data.roomCode = code;
    socket.join(code);

    console.log(`[${code}] "${player.name}" joined (${room.players.length}/${room.settings.maxPlayers})`);

    // Broadcast to room
    io.to(code).emit('player_joined', { players: room.players });

    // Send existing drawing history to this new player (Late Joiner feature)
    socket.emit('strokes_sync', { strokes: room.strokes });

    ack({ ok: true, code, room });
  });

  // ── 3. Start Game (Host only) ──────────────────────────────────────────────
  socket.on('start_game', () => {
    const room = getRoomBySocket(socket);
    if (!room || socket.id !== room.hostId) return;

    console.log(`[${room.code}] Host started the game! Transitioning to drawing screen.`);
    room.phase = 'drawing';
    io.to(room.code).emit('game_started');
  });

  // ── 4. Drawing: draw_start ─────────────────────────────────────────────────
  // Drawer starts a new stroke
  socket.on('draw_start', (payload) => {
    const room = getRoomBySocket(socket);
    if (!room) return;

    const { x, y, color, size } = payload || {};
    if (typeof x !== 'number' || typeof y !== 'number') return;

    // Start a new stroke in server memory
    const stroke = {
      color: color || '#000000',
      size: size || 8,
      points: [{ x, y }],
    };
    room.strokes.push(stroke);

    // Relay to everyone ELSE in this room (the drawer already drew locally!)
    socket.to(room.code).emit('draw_data', {
      kind: 'start',
      x,
      y,
      color: stroke.color,
      size: stroke.size,
    });
  });

  // ── 5. Drawing: draw_move ──────────────────────────────────────────────────
  // Drawer continues moving mouse
  socket.on('draw_move', (payload) => {
    const room = getRoomBySocket(socket);
    if (!room) return;

    const { x, y } = payload || {};
    if (typeof x !== 'number' || typeof y !== 'number') return;

    // Append point to current stroke
    const currentStroke = room.strokes[room.strokes.length - 1];
    if (currentStroke) {
      currentStroke.points.push({ x, y });
    }

    // Relay to other players
    socket.to(room.code).emit('draw_data', { kind: 'move', x, y });
  });

  // ── 6. Drawing: draw_end ───────────────────────────────────────────────────
  // Drawer lifts mouse
  socket.on('draw_end', () => {
    const room = getRoomBySocket(socket);
    if (!room) return;

    socket.to(room.code).emit('draw_data', { kind: 'end' });
  });

  // ── 7. Drawing: canvas_clear ───────────────────────────────────────────────
  socket.on('canvas_clear', () => {
    const room = getRoomBySocket(socket);
    if (!room) return;

    room.strokes = []; // Wipe strokes history
    console.log(`[${room.code}] Canvas cleared.`);
    io.to(room.code).emit('canvas_clear');
  });

  // ── 8. Drawing: draw_undo ──────────────────────────────────────────────────
  socket.on('draw_undo', () => {
    const room = getRoomBySocket(socket);
    if (!room || room.strokes.length === 0) return;

    room.strokes.pop(); // Remove last finished stroke
    console.log(`[${room.code}] Undo: ${room.strokes.length} strokes remaining.`);
    // Tell everyone in room to wipe and replay remaining strokes
    io.to(room.code).emit('strokes_sync', { strokes: room.strokes });
  });

  // ── 9. Disconnect ──────────────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    console.log(`[-] disconnected: ${socket.id} (${reason})`);

    const room = getRoomBySocket(socket);
    if (!room) return;

    const leavingIndex = room.players.findIndex(p => p.id === socket.id);
    const leavingPlayer = room.players[leavingIndex];

    if (leavingIndex !== -1) {
      room.players.splice(leavingIndex, 1);
    }

    if (room.players.length === 0) {
      rooms.delete(room.code);
      console.log(`[${room.code}] Room deleted (all players left).`);
      return;
    }

    if (socket.id === room.hostId) {
      room.hostId = room.players[0].id;
      console.log(`[${room.code}] Host migrated to "${room.players[0].name}"`);
    }

    io.to(room.code).emit('player_left', {
      playerId: socket.id,
      playerName: leavingPlayer?.name,
      players: room.players,
      hostId: room.hostId,
    });
  });
});

// ─── Start listening ─────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`\n✅  Phase 2 Server Ready (Real-Time Drawing Enabled)`);
  console.log(`   Local:  http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
});
