// client/src/App.jsx
// Phase 3: Manages full game loop events, word selection state, and timers.

import { useState, useEffect } from 'react';
import socket from './socket.js';
import Home from './screens/Home.jsx';
import Lobby from './screens/Lobby.jsx';
import GameScreen from './screens/GameScreen.jsx';

export default function App() {
  const [screen, setScreen] = useState('home'); // 'home' | 'lobby' | 'game'
  const [room, setRoom] = useState(null);
  const [syncedStrokes, setSyncedStrokes] = useState([]);

  // Word choices presented to the drawer during 'choosing' phase
  const [wordOptions, setWordOptions] = useState([]);

  // Revealed word shown to everyone when round ends
  const [revealedWord, setRevealedWord] = useState(null);

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

    // ── Full Game State Snapshot from Server ──
    socket.on('game_state', (snapshot) => {
      setRoom(snapshot);
      if (
        snapshot.phase === 'choosing' ||
        snapshot.phase === 'drawing' ||
        snapshot.phase === 'round_end'
      ) {
        setScreen('game');
      }
    });

    // ── Round Start (Turn Begins) ──
    socket.on('round_start', ({ drawerId, drawerName, round }) => {
      console.log(`[socket] Round ${round} started. Drawer: ${drawerName}`);
      setWordOptions([]);
      setRevealedWord(null);
      setScreen('game');
    });

    // ── Word Choices (Sent ONLY to Drawer) ──
    socket.on('word_options', ({ options }) => {
      console.log('[socket] Received secret word options:', options);
      setWordOptions(options);
    });

    // ── Timer Tick (Every Second) ──
    socket.on('timer_tick', ({ timeLeft }) => {
      setRoom((prev) => (prev ? { ...prev, timeLeft } : prev));
    });

    // ── Round End (Word Revealed) ──
    socket.on('round_end', ({ word, scores }) => {
      console.log(`[socket] Round ended. Word was: ${word}`);
      setRevealedWord(word);
      setWordOptions([]);
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          phase: 'round_end',
          players: scores || prev.players,
        };
      });
    });

    // ── Game Over (All Rounds Complete) ──
    socket.on('game_over', ({ winner, leaderboard }) => {
      alert(`🏆 GAME OVER! Winner: ${winner?.name || 'Nobody'} with ${winner?.score || 0} pts!`);
      setScreen('lobby');
    });

    // ── Stroke Sync (Late join or Undo) ──
    socket.on('strokes_sync', ({ strokes }) => {
      setSyncedStrokes(strokes || []);
    });

    // ── Canvas Clear ──
    socket.on('canvas_clear', () => {
      setSyncedStrokes([]);
    });

    return () => {
      socket.off('player_joined');
      socket.off('player_left');
      socket.off('game_state');
      socket.off('round_start');
      socket.off('word_options');
      socket.off('timer_tick');
      socket.off('round_end');
      socket.off('game_over');
      socket.off('strokes_sync');
      socket.off('canvas_clear');
    };
  }, []);

  function handleJoinedRoom(roomData) {
    setRoom(roomData);
    if (
      roomData.phase === 'choosing' ||
      roomData.phase === 'drawing' ||
      roomData.phase === 'round_end'
    ) {
      setScreen('game');
    } else {
      setScreen('lobby');
    }
  }

  function handleLeaveRoom() {
    socket.disconnect();
    setRoom(null);
    setSyncedStrokes([]);
    setWordOptions([]);
    setRevealedWord(null);
    setScreen('home');

    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.pathname);
  }

  // ── Render Active Screen ──
  if (screen === 'game' && room) {
    return (
      <GameScreen
        room={room}
        syncedStrokes={syncedStrokes}
        wordOptions={wordOptions}
        revealedWord={revealedWord}
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  if (screen === 'lobby' && room) {
    return <Lobby room={room} onLeaveRoom={handleLeaveRoom} />;
  }

  return <Home onJoinedRoom={handleJoinedRoom} />;
}

/*
================================================================================
📜 FILE LIFECYCLE & EXECUTION FLOW SUMMARY: App.jsx
================================================================================
1. State Management:
   - screen: 'home' | 'lobby' | 'game'.
   - wordOptions: Temporarily holds the 3 word choices for the active drawer.
   - revealedWord: Holds the secret word revealed during 'round_end'.
2. Event Wiring:
   - round_start -> resets round UI and switches to GameScreen.
   - word_options -> populates wordOptions modal for drawer.
   - timer_tick -> updates room.timeLeft every 1 second.
   - round_end -> displays the revealed word and updates scores.
   - game_over -> shows victory alert and transitions back to lobby.
================================================================================
*/
