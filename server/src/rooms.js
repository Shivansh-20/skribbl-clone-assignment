// server/src/rooms.js
// This file manages all room data stored in the server's RAM.
// It has small, clean helper functions to create players, validate settings,
// and generate unique room codes.

// Characters allowed in room codes.
// Notice we leave out 0, O, 1, and I so users never confuse "zero" with the letter "O".
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// In-memory store for all active rooms.
// Key = 5-character room code (e.g. 'XK9P2'), Value = Room object.
export const rooms = new Map();

// Default values for settings if the host didn't supply them or sent bad input.
const DEFAULT_SETTINGS = {
  maxPlayers: 8,
  rounds: 3,
  drawTime: 80,
  wordChoices: 3,
};

// Clamps a number between a minimum and maximum.
// If the input is not a valid number, it falls back to a safe default.
function clamp(val, min, max, fallback) {
  if (typeof val !== 'number' || isNaN(val)) return fallback;
  return Math.max(min, Math.min(max, Math.round(val)));
}

// Ensures host settings stay within safe boundaries so someone can't enter 99999 rounds.
export function sanitizeSettings(raw = {}) {
  return {
    maxPlayers:  clamp(raw.maxPlayers,  2, 20,  DEFAULT_SETTINGS.maxPlayers),
    rounds:      clamp(raw.rounds,       2, 10,  DEFAULT_SETTINGS.rounds),
    drawTime:    clamp(raw.drawTime,     15, 240, DEFAULT_SETTINGS.drawTime),
    wordChoices: clamp(raw.wordChoices,  1, 5,   DEFAULT_SETTINGS.wordChoices),
  };
}

// Generates a random 5-character code and guarantees it is not already in use.
export function generateCode() {
  let code = '';
  do {
    code = Array.from({ length: 5 }, () =>
      CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    ).join('');
  } while (rooms.has(code)); // If a collision happens (very rare), pick another.
  return code;
}

// Builds a clean player object from socket id and raw name.
export function makePlayer(socketId, rawName) {
  // Trim extra spaces and limit name length between 1 and 20 characters.
  const name = typeof rawName === 'string' ? rawName.trim().slice(0, 20) : 'Player';
  return {
    id: socketId,
    name: name || 'Player',
    score: 0,
    hasGuessed: false,
  };
}

// Finds the room that a given socket is currently inside.
// We attach `socket.data.roomCode` when a player joins, so we can look it up instantly.
export function getRoomBySocket(socket) {
  if (!socket.data?.roomCode) return null;
  return rooms.get(socket.data.roomCode) || null;
}
