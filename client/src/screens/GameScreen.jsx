// client/src/screens/GameScreen.jsx
// Phase 4: Full Game Screen with Player Scoreboard, Canvas Stage, and Live Chat.

import { useState } from 'react';
import socket from '../socket.js';
import Canvas from '../components/Canvas.jsx';
import Toolbar from '../components/Toolbar.jsx';
import WordPicker from '../components/WordPicker.jsx';
import Timer from '../components/Timer.jsx';
import PlayerList from '../components/PlayerList.jsx';
import Chat from '../components/Chat.jsx';

export default function GameScreen({
  room,
  syncedStrokes,
  wordOptions = [],
  revealedWord = null,
  messages = [],
  showCloseHint = false,
  onLeaveRoom,
}) {
  const [color, setColor] = useState('#000000');
  const [size,  setSize]  = useState(8);

  const isDrawer = socket.id === room?.drawerId;
  const isChoosing = room?.phase === 'choosing';
  const isDrawing = room?.phase === 'drawing';
  const isRoundEnd = room?.phase === 'round_end';

  // Check if this current user has already guessed correctly this round
  const me = room?.players?.find((p) => p.id === socket.id);
  const hasGuessed = me?.hasGuessed || false;

  const currentDrawerName = room?.players?.find((p) => p.id === room.drawerId)?.name || 'Someone';

  return (
    <div style={styles.container}>
      {/* ── Top Header Bar ── */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.badge}>
            Round {room?.round || 1} / {room?.settings?.rounds || 3}
          </span>
          <span style={styles.drawerTag}>
            {isDrawer ? '✏️ You are drawing!' : `👀 ${currentDrawerName} is drawing`}
          </span>
        </div>

        <div style={styles.headerCenter}>
          {isChoosing && (
            <span style={styles.statusText}>
              {isDrawer ? 'Pick a word below!' : `${currentDrawerName} is choosing a word...`}
            </span>
          )}

          {isDrawing && (
            <div style={styles.wordDisplay}>
              {isDrawer ? (
                <span style={styles.secretWord}>WORD: {room?.word || room?.mask}</span>
              ) : (
                <span style={styles.maskedWord}>
                  {room?.mask ? room.mask.split('').join(' ') : ''}
                </span>
              )}
            </div>
          )}

          {isRoundEnd && (
            <span style={styles.roundEndWord}>
              The word was: <strong>{revealedWord || room?.word || '—'}</strong>
            </span>
          )}
        </div>

        <div style={styles.headerRight}>
          <Timer timeLeft={room?.timeLeft} />
          <button style={styles.leaveBtn} onClick={onLeaveRoom}>
            Leave
          </button>
        </div>
      </div>

      {/* ── 3-Column Game Arena ── */}
      <div style={styles.arena}>
        {/* Left Column: Player Scoreboard */}
        <PlayerList
          players={room?.players}
          drawerId={room?.drawerId}
          hostId={room?.hostId}
        />

        {/* Center Column: Toolbar + Canvas */}
        <div style={styles.centerStage}>
          {isDrawer && isDrawing && (
            <Toolbar
              color={color}
              setColor={setColor}
              size={size}
              setSize={setSize}
            />
          )}

          <Canvas
            isDrawer={isDrawer && isDrawing}
            color={color}
            size={size}
            syncedStrokes={syncedStrokes}
          />
        </div>

        {/* Right Column: Chat & Guesses */}
        <Chat
          messages={messages}
          isDrawer={isDrawer}
          hasGuessed={hasGuessed}
          phase={room?.phase}
          showCloseHint={showCloseHint}
        />
      </div>

      {/* ── Word Picker Modal (Drawer Only) ── */}
      {isDrawer && isChoosing && wordOptions.length > 0 && (
        <WordPicker options={wordOptions} chooseTime={room?.timeLeft || 15} />
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '0.8rem 1rem',
    background: '#1a1a2e',
    color: '#eee',
    fontFamily: 'system-ui, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: '1180px',
    marginBottom: '0.8rem',
    background: '#16213e',
    padding: '0.7rem 1.2rem',
    borderRadius: '10px',
    border: '1px solid #0f3460',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.8rem',
  },
  badge: {
    background: '#0f3460',
    border: '1px solid #1a4a80',
    padding: '4px 10px',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '0.85rem',
  },
  drawerTag: {
    fontSize: '0.9rem',
    color: '#aaa',
  },
  headerCenter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  statusText: {
    color: '#aaa',
    fontStyle: 'italic',
    fontSize: '0.95rem',
  },
  wordDisplay: {
    display: 'flex',
    alignItems: 'center',
  },
  secretWord: {
    color: '#2ed573',
    fontWeight: 'bold',
    fontSize: '1.2rem',
    letterSpacing: '1px',
  },
  maskedWord: {
    color: '#ffa502',
    fontWeight: 'bold',
    fontSize: '1.5rem',
    letterSpacing: '4px',
  },
  roundEndWord: {
    color: '#e94560',
    fontSize: '1.1rem',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.8rem',
  },
  leaveBtn: {
    background: 'transparent',
    border: '1px solid #0f3460',
    color: '#888',
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  arena: {
    display: 'flex',
    justifyContent: 'center',
    gap: '0.8rem',
    width: '100%',
    maxWidth: '1180px',
  },
  centerStage: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '680px',
  },
};
