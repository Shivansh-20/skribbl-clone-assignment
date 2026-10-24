// client/src/components/Timer.jsx
// Phase 3: Displays the seconds remaining in the current timed phase.
// Turns red and pulses slightly when under 10 seconds remaining.

export default function Timer({ timeLeft }) {
  const isUrgent = typeof timeLeft === 'number' && timeLeft <= 10;

  return (
    <div
      style={{
        ...styles.timerBox,
        color: isUrgent ? '#ff4757' : '#2ed573',
        borderColor: isUrgent ? '#ff4757' : '#0f3460',
      }}
    >
      <span style={styles.icon}>⏱️</span>
      <span style={styles.number}>
        {typeof timeLeft === 'number' ? timeLeft : '–'}s
      </span>
    </div>
  );
}

const styles = {
  timerBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    background: '#0d172a',
    border: '1px solid',
    padding: '0.35rem 0.8rem',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '1.1rem',
    minWidth: '75px',
    justifyContent: 'center',
    transition: 'color 0.2s, border-color 0.2s',
  },
  icon: {
    fontSize: '1rem',
  },
  number: {
    fontVariantNumeric: 'tabular-nums', // Prevents width jumping as numbers count down
  },
};

/*
================================================================================
📜 FILE LIFECYCLE & EXECUTION FLOW SUMMARY: Timer.jsx
================================================================================
1. Inputs (Props):
   - timeLeft (number): Seconds left in current phase (updated every second by server).
2. Rendering:
   - Displays seconds remaining.
   - Highlights green when comfortable (>10s), switches to urgent red when <= 10s.
================================================================================
*/
