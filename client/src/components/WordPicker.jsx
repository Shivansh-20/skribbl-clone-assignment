// client/src/components/WordPicker.jsx
// Phase 3: Modal popup shown ONLY to the drawer during the 'choosing' phase.

import socket from '../socket.js';

export default function WordPicker({ options = [], chooseTime = 15 }) {
  // When the drawer clicks one of the 3 word buttons
  function handleSelectWord(word) {
    socket.emit('word_chosen', { word });
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2 style={styles.title}>Choose a word to draw!</h2>
        <p style={styles.hint}>
          Pick quickly! You have {chooseTime} seconds or the server will pick for you.
        </p>

        <div style={styles.optionsGrid}>
          {options.map((word) => (
            <button
              key={word}
              type="button"
              style={styles.wordBtn}
              onClick={() => handleSelectWord(word)}
            >
              {word}
            </button>
          ))}
        </div>
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
    background: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(3px)',
  },
  modal: {
    background: '#16213e',
    border: '2px solid #e94560',
    borderRadius: '12px',
    padding: '2rem',
    maxWidth: '480px',
    width: '90%',
    textAlign: 'center',
    boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
  },
  title: {
    margin: 0,
    color: '#e94560',
    fontSize: '1.6rem',
  },
  hint: {
    color: '#aaa',
    fontSize: '0.9rem',
    margin: '0.6rem 0 1.5rem',
  },
  optionsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.8rem',
  },
  wordBtn: {
    padding: '0.9rem 1.2rem',
    background: '#0f3460',
    border: '1px solid #1a4a80',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
};

/*
================================================================================
📜 FILE LIFECYCLE & EXECUTION FLOW SUMMARY: WordPicker.jsx
================================================================================
1. Rendered inside GameScreen when:
   - isDrawer === true AND room.phase === 'choosing' AND options.length > 0.
2. User Action:
   - Drawer clicks one of the word options.
   - handleSelectWord() emits 'word_chosen' { word } to server.
3. Server Response:
   - Server locks in word, switches phase to 'drawing', and unmounts this modal!
================================================================================
*/
