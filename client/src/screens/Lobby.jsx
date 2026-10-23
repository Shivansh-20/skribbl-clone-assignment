// client/src/screens/Lobby.jsx
// Phase 1: Lobby screen showing the waiting room, player list, and settings.

import { useState } from 'react';
import socket from '../socket.js';

export default function Lobby({ room, onLeaveRoom }) {
  const [copied, setCopied] = useState(false);

  // Is this specific client the host?
  const isHost = socket.id === room.hostId;

  // Can we start? Skribbl requires at least 2 players
  const canStart = room.players.length >= 2;

  // ── Copy Invite Link to Clipboard ──────────────────────────────────────────
  function handleCopyInvite() {
    // Generates a link like: http://localhost:5173/?room=ABCDE
    const inviteUrl = `${window.location.origin}/?room=${room.code}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset text after 2 seconds
  }

  // ── Host clicks "Start Game" ───────────────────────────────────────────────
  function handleStartGame() {
    if (!isHost || !canStart) return;
    socket.emit('start_game');
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>🎨 Skribbl Lobby</h1>

      <div style={styles.card}>
        {/* Room Code + Copy button */}
        <div style={styles.roomHeader}>
          <div>
            <span style={styles.roomLabel}>ROOM CODE</span>
            <div style={styles.roomCode}>{room.code}</div>
          </div>
          <button style={styles.copyBtn} onClick={handleCopyInvite}>
            {copied ? '✅ Copied!' : '📋 Copy Link'}
          </button>
        </div>

        {/* Players List */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            Players ({room.players.length} / {room.settings.maxPlayers})
          </div>
          <div style={styles.playerList}>
            {room.players.map((p) => {
              const isThisHost = p.id === room.hostId;
              const isMe = p.id === socket.id;

              return (
                <div key={p.id} style={styles.playerItem}>
                  <span style={styles.playerName}>{p.name}</span>
                  <div style={styles.badgeContainer}>
                    {isThisHost && <span style={styles.hostBadge}>👑 Host</span>}
                    {isMe && <span style={styles.youBadge}>You</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Room Settings Overview */}
        <div style={styles.settingsBox}>
          <div><strong>Rounds:</strong> {room.settings.rounds}</div>
          <div><strong>Draw Time:</strong> {room.settings.drawTime}s</div>
          <div><strong>Word Choices:</strong> {room.settings.wordChoices}</div>
        </div>

        {/* Action Button: Start or Waiting */}
        <div style={styles.actions}>
          {isHost ? (
            <button
              style={{
                ...styles.startBtn,
                opacity: canStart ? 1 : 0.6,
                cursor: canStart ? 'pointer' : 'not-allowed',
              }}
              onClick={handleStartGame}
              disabled={!canStart}
            >
              {canStart ? 'Start Game 🎮' : 'Waiting for more players (need 2+)...'}
            </button>
          ) : (
            <div style={styles.waitingText}>
              ⏳ Waiting for the host to start the game...
            </div>
          )}

          <button style={styles.leaveBtn} onClick={onLeaveRoom}>
            Leave Lobby
          </button>
        </div>
      </div>
    </div>
  );
}

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
    fontSize: '2.2rem',
    color: '#e94560',
    margin: 0,
    marginBottom: '1rem',
  },
  card: {
    background: '#16213e',
    border: '1px solid #0f3460',
    borderRadius: '12px',
    padding: '1.8rem',
    width: '100%',
    maxWidth: '440px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
  },
  roomHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #0f3460',
    paddingBottom: '1rem',
    marginBottom: '1rem',
  },
  roomLabel: {
    fontSize: '0.75rem',
    color: '#888',
    letterSpacing: '1px',
    display: 'block',
  },
  roomCode: {
    fontSize: '1.8rem',
    fontWeight: 'bold',
    color: '#e94560',
    letterSpacing: '3px',
  },
  copyBtn: {
    padding: '0.5rem 0.9rem',
    background: '#0f3460',
    border: '1px solid #1a4a80',
    borderRadius: '6px',
    color: '#eee',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 'bold',
  },
  section: {
    marginBottom: '1.2rem',
  },
  sectionTitle: {
    fontSize: '0.9rem',
    fontWeight: 'bold',
    color: '#aaa',
    marginBottom: '0.6rem',
  },
  playerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  playerItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#0f3460',
    padding: '0.55rem 0.8rem',
    borderRadius: '6px',
  },
  playerName: {
    fontWeight: '500',
    fontSize: '0.95rem',
  },
  badgeContainer: {
    display: 'flex',
    gap: '0.4rem',
  },
  hostBadge: {
    background: '#e94560',
    fontSize: '0.7rem',
    padding: '2px 6px',
    borderRadius: '4px',
    fontWeight: 'bold',
  },
  youBadge: {
    background: '#2196f3',
    fontSize: '0.7rem',
    padding: '2px 6px',
    borderRadius: '4px',
    fontWeight: 'bold',
  },
  settingsBox: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '0.5rem',
    background: '#0d172a',
    padding: '0.75rem',
    borderRadius: '6px',
    fontSize: '0.75rem',
    color: '#aaa',
    marginBottom: '1.2rem',
    textAlign: 'center',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
  },
  startBtn: {
    padding: '0.75rem',
    background: '#e94560',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '1rem',
    transition: 'opacity 0.2s',
  },
  waitingText: {
    textAlign: 'center',
    color: '#aaa',
    fontStyle: 'italic',
    padding: '0.5rem',
    fontSize: '0.9rem',
  },
  leaveBtn: {
    padding: '0.55rem',
    background: 'transparent',
    border: '1px solid #0f3460',
    borderRadius: '6px',
    color: '#888',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
};
