// client/src/components/GameOverModal.jsx
// Phase 5: Game Over Podium and Final Leaderboard Modal.

export default function GameOverModal({ leaderboard = [], winner = null, onPlayAgain }) {
  const topThree = leaderboard.slice(0, 3);
  const others = leaderboard.slice(3);

  const medalEmojis = ['🥇', '🥈', '🥉'];

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <span style={styles.trophy}>🏆</span>
          <h2 style={styles.title}>Game Over!</h2>
          {winner ? (
            <p style={styles.winnerSubtitle}>
              <strong>{winner.name}</strong> won with <strong>{winner.score} pts</strong>!
            </p>
          ) : (
            <p style={styles.winnerSubtitle}>Thanks for playing!</p>
          )}
        </div>

        {/* ── Podium for Top 3 ── */}
        <div style={styles.podium}>
          {topThree.map((player, index) => (
            <div
              key={player.id}
              style={{
                ...styles.podiumCol,
                order: index === 0 ? 2 : index === 1 ? 1 : 3, // Center 1st place!
              }}
            >
              <span style={styles.medal}>{medalEmojis[index]}</span>
              <div
                style={{
                  ...styles.pillar,
                  height: index === 0 ? '110px' : index === 1 ? '85px' : '65px',
                  background: index === 0 ? '#f59e0b' : index === 1 ? '#94a3b8' : '#b45309',
                }}
              >
                <span style={styles.podiumName}>{player.name}</span>
                <span style={styles.podiumScore}>{player.score} pts</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Remaining Players ── */}
        {others.length > 0 && (
          <div style={styles.othersList}>
            {others.map((p, i) => (
              <div key={p.id} style={styles.otherRow}>
                <span>#{i + 4} {p.name}</span>
                <span>{p.score} pts</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Actions ── */}
        <button style={styles.playAgainBtn} onClick={onPlayAgain}>
          Play Again
        </button>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  modal: {
    background: '#16213e',
    border: '2px solid #0f3460',
    borderRadius: '16px',
    padding: '2rem',
    width: '90%',
    maxWidth: '460px',
    textAlign: 'center',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
  },
  header: {
    marginBottom: '1.5rem',
  },
  trophy: {
    fontSize: '3rem',
    display: 'block',
    marginBottom: '0.4rem',
  },
  title: {
    margin: '0',
    color: '#fff',
    fontSize: '1.8rem',
  },
  winnerSubtitle: {
    color: '#aaa',
    fontSize: '0.95rem',
    marginTop: '0.4rem',
  },
  podium: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: '0.8rem',
    margin: '1.5rem 0',
  },
  podiumCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100px',
  },
  medal: {
    fontSize: '1.6rem',
    marginBottom: '4px',
  },
  pillar: {
    width: '100%',
    borderRadius: '8px 8px 0 0',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '0.5rem 0.2rem',
    boxShadow: 'inset 0 2px 4px rgba(255, 255, 255, 0.2)',
  },
  podiumName: {
    fontWeight: 'bold',
    fontSize: '0.85rem',
    color: '#fff',
    maxWidth: '90px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  podiumScore: {
    fontSize: '0.75rem',
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: '2px',
  },
  othersList: {
    background: '#0f3460',
    borderRadius: '8px',
    padding: '0.6rem 0.8rem',
    maxHeight: '100px',
    overflowY: 'auto',
    marginBottom: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
  },
  otherRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.8rem',
    color: '#cbd5e1',
  },
  playAgainBtn: {
    background: '#e94560',
    border: 'none',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '1rem',
    padding: '0.75rem 2rem',
    borderRadius: '8px',
    cursor: 'pointer',
    width: '100%',
    transition: 'background 0.2s ease',
  },
};
