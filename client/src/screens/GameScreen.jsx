// client/src/screens/GameScreen.jsx
// Phase 2: Game screen displaying the canvas, toolbar, and room header.

import { useState } from 'react';
import Canvas from '../components/Canvas.jsx';
import Toolbar from '../components/Toolbar.jsx';

export default function GameScreen({ room, syncedStrokes, onLeaveRoom }) {
  // Current drawing settings
  const [color, setColor] = useState('#000000');
  const [size,  setSize]  = useState(8);

  // In Phase 2, anyone can draw to verify real-time sync works.
  // Phase 3 will restrict this strictly to the turn-based drawer!
  const isDrawer = true;

  return (
    <div style={styles.container}>
      {/* ── Top Bar ── */}
      <div style={styles.header}>
        <div style={styles.roomInfo}>
          <span style={styles.badge}>ROOM: {room?.code}</span>
          <span style={{ color: '#aaa', fontSize: '0.9rem' }}>
            {room?.players?.length} player(s) online
          </span>
        </div>
        <button style={styles.leaveBtn} onClick={onLeaveRoom}>
          Leave Game
        </button>
      </div>

      {/* ── Center Stage: Toolbar + Canvas ── */}
      <div style={styles.mainStage}>
        {isDrawer && (
          <Toolbar
            color={color}
            setColor={setColor}
            size={size}
            setSize={setSize}
          />
        )}

        <Canvas
          isDrawer={isDrawer}
          color={color}
          size={size}
          syncedStrokes={syncedStrokes}
        />
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '1.2rem',
    background: '#1a1a2e',
    color: '#eee',
    fontFamily: 'system-ui, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: '850px',
    marginBottom: '1rem',
    background: '#16213e',
    padding: '0.8rem 1.2rem',
    borderRadius: '10px',
    border: '1px solid #0f3460',
  },
  roomInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  badge: {
    background: '#e94560',
    padding: '3px 8px',
    borderRadius: '5px',
    fontWeight: 'bold',
    fontSize: '0.85rem',
  },
  leaveBtn: {
    background: 'transparent',
    border: '1px solid #0f3460',
    color: '#aaa',
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  mainStage: {
    width: '100%',
    maxWidth: '850px',
    display: 'flex',
    flexDirection: 'column',
  },
};
