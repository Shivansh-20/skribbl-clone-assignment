// client/src/App.jsx
// Phase 4: Chat messages, guess feedback, and full score synchronization.

import { useState, useEffect } from 'react';
import socket from './socket.js';
import Home from './screens/Home.jsx';
import Lobby from './screens/Lobby.jsx';
import GameScreen from './screens/GameScreen.jsx';

export default function App() {
  const [screen, setScreen] = useState('home'); // 'home' | 'lobby' | 'game'
  const [room, setRoom] = useState(null);
  const [syncedStrokes, setSyncedStrokes] = useState([]);
  const [wordOptions, setWordOptions] = useState([]);
  const [revealedWord, setRevealedWord] = useState(null);

  // Chat message history
  const [messages, setMessages] = useState([]);

  // Flag to briefly flash the orange "You're so close!" hint to the sender
  const [showCloseHint, setShowCloseHint] = useState(false);

  useEffect(() => {
    // ── Player Joined ──
    socket.on('player_joined', ({ players }) => {
      setRoom((prev) => (prev ? { ...prev, players } : prev));
    });

    // ── Player Left ──
    socket.on('player_left', ({ playerName, players, hostId }) => {
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

    // ── Round Start ──
    socket.on('round_start', ({ drawerId, drawerName, round }) => {
      setWordOptions([]);
      setRevealedWord(null);
      setScreen('game');
      // Announce the new round in chat
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          kind: 'system',
          text: `Round ${round} started! ${drawerName} is drawing.`,
        },
      ]);
    });

    // ── Word Choices (Sent ONLY to Drawer) ──
    socket.on('word_options', ({ options }) => {
      setWordOptions(options);
    });

    // ── Timer Tick (Every Second) ──
    socket.on('timer_tick', ({ timeLeft }) => {
      setRoom((prev) => (prev ? { ...prev, timeLeft } : prev));
    });

    // ── Round End (Word Revealed) ──
    socket.on('round_end', ({ word, scores }) => {
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
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          kind: 'system',
          text: `Round ended! The word was: "${word}".`,
        },
      ]);
    });

    // ── Incoming Chat or Guess Message ──
    socket.on('chat_message', (msg) => {
      setMessages((prev) => [...prev, { ...msg, id: Date.now() + Math.random() }]);
    });

    // ── Private "Close!" Hint for the Sender ──
    socket.on('guess_close', () => {
      setShowCloseHint(true);
      setTimeout(() => setShowCloseHint(false), 2500); // Disappear after 2.5s
    });

    // ── Game Over ──
    socket.on('game_over', ({ winner, leaderboard }) => {
      alert(`🏆 GAME OVER!\nWinner: ${winner?.name || 'Nobody'} with ${winner?.score || 0} pts!`);
      setScreen('lobby');
    });

    // ── Stroke Sync & Clear ──
    socket.on('strokes_sync', ({ strokes }) => {
      setSyncedStrokes(strokes || []);
    });

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
      socket.off('chat_message');
      socket.off('guess_close');
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
    setMessages([]);
    setScreen('home');

    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.pathname);
  }

  if (screen === 'game' && room) {
    return (
      <GameScreen
        room={room}
        syncedStrokes={syncedStrokes}
        wordOptions={wordOptions}
        revealedWord={revealedWord}
        messages={messages}
        showCloseHint={showCloseHint}
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  if (screen === 'lobby' && room) {
    return <Lobby room={room} onLeaveRoom={handleLeaveRoom} />;
  }

  return <Home onJoinedRoom={handleJoinedRoom} />;
}
