// client/src/screens/Home.jsx
// Phase 1: Home screen where players either create a new room or join an existing one.

import { useState, useEffect } from 'react';
import socket from '../socket.js';

export default function Home({ onJoinedRoom }) {
  // Active tab: 'create' or 'join'
  const [tab, setTab] = useState('create');

  // Player's chosen display name
  const [name, setName] = useState('');

  // 5-letter Room Code for joining
  const [code, setCode] = useState('');

  // Customizable settings for the host
  const [maxPlayers,  setMaxPlayers]  = useState(8);
  const [rounds,      setRounds]      = useState(3);
  const [drawTime,    setDrawTime]    = useState(80);
  const [wordChoices, setWordChoices] = useState(3);

  // Error message display (e.g. "Room not found", "Room is full")
  const [error, setError] = useState('');

  // Detect if someone clicked an invite link with ?room=XXXXX in the URL!
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setCode(roomParam.toUpperCase().trim());
      setTab('join'); // Switch directly to the Join tab for convenience!
    }
  }, []);

  // ── Handle "Create Room" submission ────────────────────────────────────────
  function handleCreate(e) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      return setError('Please enter your name.');
    }

    // Connect socket if not already connected
    if (!socket.connected) socket.connect();

    // Send 'create_room' event to server with an acknowledgement callback
    socket.emit(
      'create_room',
      {
        hostName: name.trim(),
        settings: {
          maxPlayers:  Number(maxPlayers),
          rounds:      Number(rounds),
          drawTime:    Number(drawTime),
          wordChoices: Number(wordChoices),
        },
      },
      (response) => {
        // The server calls this function with its reply
        if (response.error) {
          setError(response.error);
        } else {
          // Success: pass room data to App.jsx to switch to Lobby screen
          onJoinedRoom(response.room);
        }
      }
    );
  }

  // ── Handle "Join Room" submission ──────────────────────────────────────────
  function handleJoin(e) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      return setError('Please enter your name.');
    }
    if (!code.trim()) {
      return setError('Please enter a 5-character room code.');
    }

    if (!socket.connected) socket.connect();

    // Send 'join_room' event to server
    socket.emit(
      'join_room',
      {
        code: code.toUpperCase().trim(),
        playerName: name.trim(),
      },
      (response) => {
        if (response.error) {
          setError(response.error);
        } else {
          onJoinedRoom(response.room);
        }
      }
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>🎨 Skribbl</h1>
      <p style={styles.subheading}>Phase 1 — Rooms & Lobby</p>

      <div style={styles.card}>
        {/* Tab buttons to toggle Create vs Join */}
        <div style={styles.tabBar}>
          <button
            type="button"
            style={{
              ...styles.tabBtn,
              background: tab === 'create' ? '#e94560' : '#0f3460',
            }}
            onClick={() => { setTab('create'); setError(''); }}
          >
            Create Room
          </button>
          <button
            type="button"
            style={{
              ...styles.tabBtn,
              background: tab === 'join' ? '#e94560' : '#0f3460',
            }}
            onClick={() => { setTab('join'); setError(''); }}
          >
            Join Room
          </button>
        </div>

        {/* ── Tab A: Create Room Form ── */}
        {tab === 'create' && (
          <form onSubmit={handleCreate} style={styles.form}>
            <label style={styles.label}>Your Name</label>
            <input
              style={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alice"
              maxLength={20}
              autoFocus
            />

            <div style={styles.grid2}>
              <div>
                <label style={styles.label}>Max Players (Min 2)</label>
                <input
                  type="number"
                  min="2"
                  max="20"
                  style={styles.input}
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(e.target.value)}
                />
              </div>
              <div>
                <label style={styles.label}>Rounds (Min 2)</label>
                <input
                  type="number"
                  min="2"
                  max="10"
                  style={styles.input}
                  value={rounds}
                  onChange={(e) => setRounds(e.target.value)}
                />
              </div>
            </div>

            <div style={styles.grid2}>
              <div>
                <label style={styles.label}>Draw Time (Min 15s)</label>
                <input
                  type="number"
                  min="15"
                  max="240"
                  style={styles.input}
                  value={drawTime}
                  onChange={(e) => setDrawTime(e.target.value)}
                />
              </div>
              <div>
                <label style={styles.label}>Word Choices (Min 1)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  style={styles.input}
                  value={wordChoices}
                  onChange={(e) => setWordChoices(e.target.value)}
                />
              </div>
            </div>

            {error && <p style={styles.error}>{error}</p>}

            <button type="submit" style={styles.submitBtn}>
              Create Room ✨
            </button>
          </form>
        )}

        {/* ── Tab B: Join Room Form ── */}
        {tab === 'join' && (
          <form onSubmit={handleJoin} style={styles.form}>
            <label style={styles.label}>Your Name</label>
            <input
              style={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bob"
              maxLength={20}
              autoFocus
            />

            <label style={styles.label}>5-Letter Room Code</label>
            <input
              style={{ ...styles.input, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold' }}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. ABCDE"
              maxLength={5}
            />

            {error && <p style={styles.error}>{error}</p>}

            <button type="submit" style={styles.submitBtn}>
              Join Room 🚀
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// Clean inline styles — no CSS framework required
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '1.5rem',
    fontFamily: 'system-ui, sans-serif',
    color: '#eee',
    background: '#1a1a2e',
  },
  heading: {
    fontSize: '2.5rem',
    color: '#e94560',
    margin: 0,
  },
  subheading: {
    color: '#888',
    marginBottom: '1.5rem',
  },
  card: {
    background: '#16213e',
    border: '1px solid #0f3460',
    borderRadius: '12px',
    padding: '1.8rem',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
  },
  tabBar: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1.5rem',
  },
  tabBtn: {
    flex: 1,
    padding: '0.6rem',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.8rem',
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.8rem',
  },
  label: {
    display: 'block',
    fontSize: '0.85rem',
    color: '#aaa',
    marginBottom: '0.2rem',
  },
  input: {
    width: '100%',
    padding: '0.55rem 0.75rem',
    background: '#0f3460',
    border: '1px solid #1a4a80',
    borderRadius: '6px',
    color: '#eee',
    fontSize: '0.95rem',
    boxSizing: 'border-box',
    outline: 'none',
  },
  submitBtn: {
    marginTop: '0.5rem',
    padding: '0.75rem',
    background: '#e94560',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '1rem',
    cursor: 'pointer',
  },
  error: {
    color: '#ff6b6b',
    fontSize: '0.85rem',
    margin: '0.2rem 0',
  },
};
