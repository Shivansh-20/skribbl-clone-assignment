// server/src/index.js
// Phase 3: Integrating the Game Loop (Turns, Timers, Word Selection & Drawer Permissions).

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

// Import Game State Machine functions from game.js
import {
  startTurn,
  chooseWord,
  endRound,
  clearRoomTimer,
  getPublicSnapshot,
  handleGuess,
} from './game.js';

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

// ─── HTTP Server + Socket.IO ────────────────────────────────────────────────
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Helper: Check if socket is the active drawer
function isDrawer(socket, room) {
  return room?.players[room.drawerIndex]?.id === socket.id;
}

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
      word: null,
      wordOptions: [],
      mask: '',
      timeLeft: 0,
      strokes: [],
      timer: null,
    };

    rooms.set(code, room);
    socket.data.roomCode = code;
    socket.join(code);

    console.log(`[${code}] Room created by host "${player.name}" (${socket.id})`);
    ack({ ok: true, code, room: getPublicSnapshot(room) });
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

    // Broadcast updated player list
    io.to(code).emit('player_joined', { players: room.players });

    // Send stroke history to late joiners
    socket.emit('strokes_sync', { strokes: room.strokes });

    ack({ ok: true, code, room: getPublicSnapshot(room) });
  });

  // ── 3. Start Game (Host only) ──────────────────────────────────────────────
  socket.on('start_game', () => {
    const room = getRoomBySocket(socket);
    if (!room || socket.id !== room.hostId) return;

    if (room.players.length < 2) {
      console.warn(`[${room.code}] Need at least 2 players to start.`);
      return;
    }

    console.log(`[${room.code}] Game started by host! Starting Turn 1...`);
    room.round = 1;
    room.drawerIndex = -1; // startTurn will increment this to index 0

    // Begin the turn cycle!
    startTurn(io, room);
  });

  // ── 4. Word Chosen (Drawer only) ───────────────────────────────────────────
  socket.on('word_chosen', (payload) => {
    const room = getRoomBySocket(socket);
    if (!room || room.phase !== 'choosing') return;

    // Security: Only the active drawer can pick a word
    if (!isDrawer(socket, room)) return;

    const word = payload?.word;
    if (typeof word !== 'string') return;

    chooseWord(io, room, word);
  });

  // ── 5. Drawing: draw_start ─────────────────────────────────────────────────
  socket.on('draw_start', (payload) => {
    const room = getRoomBySocket(socket);
    if (!room || room.phase !== 'drawing') return;

    // Security Guard: Only the designated drawer can draw!
    if (!isDrawer(socket, room)) return;

    const { x, y, color, size } = payload || {};
    if (typeof x !== 'number' || typeof y !== 'number') return;

    const stroke = {
      color: color || '#000000',
      size: size || 8,
      points: [{ x, y }],
    };
    room.strokes.push(stroke);

    socket.to(room.code).emit('draw_data', {
      kind: 'start',
      x,
      y,
      color: stroke.color,
      size: stroke.size,
    });
  });

  // ── 6. Drawing: draw_move ──────────────────────────────────────────────────
  socket.on('draw_move', (payload) => {
    const room = getRoomBySocket(socket);
    if (!room || room.phase !== 'drawing') return;

    // Security Guard: Only drawer can draw!
    if (!isDrawer(socket, room)) return;

    const { x, y } = payload || {};
    if (typeof x !== 'number' || typeof y !== 'number') return;

    const currentStroke = room.strokes[room.strokes.length - 1];
    if (currentStroke) {
      currentStroke.points.push({ x, y });
    }

    const strokeColor = payload?.color || currentStroke?.color || '#000000';
    const strokeSize = payload?.size || currentStroke?.size || 8;

    socket.to(room.code).emit('draw_data', {
      kind: 'move',
      x,
      y,
      color: strokeColor,
      size: strokeSize,
    });
  });

  // ── 7. Drawing: draw_end ───────────────────────────────────────────────────
  socket.on('draw_end', () => {
    const room = getRoomBySocket(socket);
    if (!room || room.phase !== 'drawing') return;
    if (!isDrawer(socket, room)) return;

    socket.to(room.code).emit('draw_data', { kind: 'end' });
  });

  // ── 8. Drawing: canvas_clear ───────────────────────────────────────────────
  socket.on('canvas_clear', () => {
    const room = getRoomBySocket(socket);
    if (!room || room.phase !== 'drawing') return;
    if (!isDrawer(socket, room)) return;

    room.strokes = [];
    console.log(`[${room.code}] Canvas cleared by drawer.`);
    io.to(room.code).emit('canvas_clear');
  });

  // ── 9. Drawing: draw_undo ──────────────────────────────────────────────────
  socket.on('draw_undo', () => {
    const room = getRoomBySocket(socket);
    if (!room || room.phase !== 'drawing') return;
    if (!isDrawer(socket, room) || room.strokes.length === 0) return;

    room.strokes.pop();
    io.to(room.code).emit('strokes_sync', { strokes: room.strokes });
  });

  // ── 10. Guess / Chat (Phase 4) ─────────────────────────────────────────────
  socket.on('guess', (payload) => {
    const room = getRoomBySocket(socket);
    if (!room) return;

    const text = typeof payload?.text === 'string' ? payload.text : '';
    if (!text.trim()) return;

    handleGuess(io, socket, room, text);
  });

  // ── 11. Disconnect ─────────────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    console.log(`[-] disconnected: ${socket.id} (${reason})`);

    const room = getRoomBySocket(socket);
    if (!room) return;

    const leavingIndex = room.players.findIndex((p) => p.id === socket.id);
    const leavingPlayer = room.players[leavingIndex];
    const wasDrawer = isDrawer(socket, room);
    const wasHost = socket.id === room.hostId;

    if (leavingIndex !== -1) {
      room.players.splice(leavingIndex, 1);
      // Keep drawer index aligned if someone before drawer leaves
      if (leavingIndex <= room.drawerIndex) {
        room.drawerIndex--;
      }
    }

    // If room is empty, clear active timers and delete room
    if (room.players.length === 0) {
      clearRoomTimer(room);
      rooms.delete(room.code);
      console.log(`[${room.code}] Room deleted (all players left).`);
      return;
    }

    // Host migration
    if (wasHost) {
      room.hostId = room.players[0].id;
      console.log(`[${room.code}] Host migrated to "${room.players[0].name}"`);
    }

    // Notify room of departure
    io.to(room.code).emit('player_left', {
      playerId: socket.id,
      playerName: leavingPlayer?.name,
      players: room.players,
      hostId: room.hostId,
    });

    // Edge case: If fewer than 2 players remain, stop the game and return to lobby
    if (room.players.length < 2 && room.phase !== 'lobby') {
      clearRoomTimer(room);
      room.phase = 'lobby';
      room.round = 0;
      room.drawerIndex = -1;
      room.strokes = [];
      io.to(room.code).emit('chat_message', {
        id: Date.now() + Math.random(),
        kind: 'system',
        text: '📢 Not enough players to continue. Returned to lobby.',
      });
      io.to(room.code).emit('game_state', getPublicSnapshot(room));
      return;
    }

    // If game was active and the drawer left -> end round immediately!
    if (room.phase === 'choosing' || room.phase === 'drawing') {
      if (wasDrawer) {
        console.log(`[${room.code}] Drawer disconnected! Ending round early.`);
        endRound(io, room);
      }
    }
  });
});

// ─── Start Listening ─────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`\n✅  Phase 3 Server Ready (Game Loop Engine Running)`);
  console.log(`   Local:  http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
});
