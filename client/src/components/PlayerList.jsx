// client/src/components/PlayerList.jsx
// Phase 4: In-game player scoreboard showing real-time scores and status badges.

import socket from '../socket.js';

export default function PlayerList({ players = [], drawerId, hostId }) {
  // Sort players by score descending (highest score first)
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Scoreboard</h3>
      <div style={styles.list}>
        {sortedPlayers.map((p, index) => {
          const isDrawer = p.id === drawerId;
          const isHost = p.id === hostId;
          const isMe = p.id === socket.id;

          return (
            <div
              key={p.id}
              style={{
                ...styles.item,
                background: p.hasGuessed ? '#064e3b' : '#0f3460', // Green if guessed!
                border: isMe ? '1px solid #e94560' : '1px solid #1a4a80',
              }}
            >
              <div style={styles.playerInfo}>
                <span style={styles.rank}>#{index + 1}</span>
                <span style={styles.name}>{p.name}</span>
                <div style={styles.badges}>
                  {isDrawer && <span style={styles.drawerBadge}>✏️</span>}
                  {p.hasGuessed && <span style={styles.guessedBadge}>✓</span>}
                  {isHost && <span style={styles.hostBadge}>👑</span>}
                </div>
              </div>

              <div style={styles.score}>{p.score} pts</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: '200px',
    background: '#16213e',
    borderRadius: '10px',
    border: '1px solid #0f3460',
    padding: '0.8rem',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '520px',
    overflowY: 'auto',
  },
  title: {
    margin: '0 0 0.6rem 0',
    fontSize: '0.9rem',
    color: '#aaa',
    letterSpacing: '1px',
    textTransform: 'uppercase',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  item: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem 0.6rem',
    borderRadius: '6px',
    transition: 'background 0.3s ease',
  },
  playerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    overflow: 'hidden',
  },
  rank: {
    fontSize: '0.75rem',
    color: '#888',
    fontWeight: 'bold',
  },
  name: {
    fontSize: '0.85rem',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '85px',
  },
  badges: {
    display: 'flex',
    gap: '2px',
  },
  drawerBadge: {
    fontSize: '0.75rem',
  },
  guessedBadge: {
    background: '#10b981',
    color: '#fff',
    fontSize: '0.65rem',
    fontWeight: 'bold',
    borderRadius: '3px',
    padding: '1px 4px',
  },
  hostBadge: {
    fontSize: '0.75rem',
  },
  score: {
    fontSize: '0.8rem',
    fontWeight: 'bold',
    color: '#ffa502',
  },
};
