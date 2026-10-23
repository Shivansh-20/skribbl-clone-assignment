// client/src/App.jsx
// Phase 1 + Phase 2: Manages screens ('home' | 'lobby' | 'game') and drawing state.

import { useState, useEffect } from 'react';
import socket from './socket.js';
import Home from './screens/Home.jsx';
import Lobby from './screens/Lobby.jsx';
import GameScreen from './screens/GameScreen.jsx';

export default function App() {
  // Screen state: 'home' | 'lobby' | 'game'
  const [screen, setScreen] = useState('home');

  // Room state mirrored from server
  const [room, setRoom] = useState(null);

  // Stored strokes for late-joiners and undo
  const [syncedStrokes, setSyncedStrokes] = useState([]);

  useEffect(() => {
    // ── Player Joined ──
    socket.on('player_joined', ({ players }) => {
      setRoom((prev) => (prev ? { ...prev, players } : prev));
    });

    // ── Player Left ──
    socket.on('player_left', ({ playerName, players, hostId }) => {
      console.log(`[socket] ${playerName || 'Player'} left.`);
      setRoom((prev) => (prev ? { ...prev, players, hostId } : prev));
    });

    // ── Host started game -> Switch to GameScreen! ──
    socket.on('game_started', () => {
      setScreen('game');
    });

    // ── Server syncs stroke history (late join or undo) ──
    socket.on('strokes_sync', ({ strokes }) => {
      setSyncedStrokes(strokes || []);
    });

    // ── Canvas clear wipes local stroke history ──
    socket.on('canvas_clear', () => {
      setSyncedStrokes([]);
    });

    return () => {
      socket.off('player_joined');
      socket.off('player_left');
      socket.off('game_started');
      socket.off('strokes_sync');
      socket.off('canvas_clear');
    };
  }, []);

  function handleJoinedRoom(roomData) {
    setRoom(roomData);
    setScreen('lobby');
  }

  function handleLeaveRoom() {
    socket.disconnect();
    setRoom(null);
    setSyncedStrokes([]);
    setScreen('home');

    // Clean URL
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.pathname);
  }

  // ── Render Screen ──
  if (screen === 'game' && room) {
    return (
      <GameScreen
        room={room}
        syncedStrokes={syncedStrokes}
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  if (screen === 'lobby' && room) {
    return <Lobby room={room} onLeaveRoom={handleLeaveRoom} />;
  }

  return <Home onJoinedRoom={handleJoinedRoom} />;
}
