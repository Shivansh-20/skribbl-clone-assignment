// client/src/components/Chat.jsx
// Phase 4: Chat Panel & Guess Input.
// Handles typing guesses, displaying wrong guesses, system announcements, and close hints.

import { useState, useRef, useEffect } from 'react';
import socket from '../socket.js';

export default function Chat({
  messages = [],
  isDrawer = false,
  hasGuessed = false,
  phase = 'lobby',
  showCloseHint = false,
}) {
  const [text, setText] = useState('');
  const messagesEndRef = useRef(null);

  // Auto-scroll to the newest message whenever a new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showCloseHint]);

  // Submit guess to the server
  function handleSend(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    socket.emit('guess', { text: trimmed });
    setText(''); // Clear input box
  }

  // Determine if this user is permitted to type right now
  const canType = !isDrawer && !hasGuessed && phase === 'drawing';

  let placeholder = 'Type your guess here...';
  if (isDrawer) {
    placeholder = '✏️ You are drawing! (No guessing)';
  } else if (hasGuessed) {
    placeholder = '🎉 You guessed it! Keep it secret!';
  } else if (phase !== 'drawing') {
    placeholder = 'Waiting for round to start...';
  }

  return (
    <div className="chat-panel">
      <h3 style={styles.title}>Guesses & Chat</h3>

      {/* ── Message Log ── */}
      <div style={styles.messagesBox}>
        {messages.map((msg) => {
          if (msg.kind === 'system') {
            return (
              <div key={msg.id} style={styles.systemMsg}>
                📢 {msg.text}
              </div>
            );
          }

          if (msg.kind === 'close') {
            return (
              <div key={msg.id} style={styles.closeHint}>
                🔥 {msg.text}
              </div>
            );
          }

          return (
            <div key={msg.id} style={styles.chatMsg}>
              <strong style={styles.author}>{msg.playerName}:</strong>{' '}
              <span style={styles.msgText}>{msg.text}</span>
            </div>
          );
        })}

        {/* Private "Close!" hint displayed only to this specific player */}
        {showCloseHint && (
          <div style={styles.closeHint}>
            🔥 You are so close! Try again!
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Guess Input Box ── */}
      <form onSubmit={handleSend} style={styles.form}>
        <input
          style={{
            ...styles.input,
            opacity: canType ? 1 : 0.6,
            cursor: canType ? 'text' : 'not-allowed',
          }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          disabled={!canType}
          maxLength={100}
        />
        <button
          type="submit"
          style={{
            ...styles.sendBtn,
            opacity: canType ? 1 : 0.6,
            cursor: canType ? 'pointer' : 'not-allowed',
          }}
          disabled={!canType}
        >
          Send
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: {
    background: '#16213e',
    borderRadius: '10px',
    border: '1px solid #0f3460',
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    margin: '0',
    padding: '0.8rem 1rem',
    fontSize: '0.9rem',
    color: '#aaa',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    borderBottom: '1px solid #0f3460',
  },
  messagesBox: {
    flex: 1,
    overflowY: 'auto',
    padding: '0.8rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  chatMsg: {
    fontSize: '0.85rem',
    lineHeight: '1.4',
    wordBreak: 'break-word',
  },
  author: {
    color: '#54a0ff',
  },
  msgText: {
    color: '#eee',
  },
  systemMsg: {
    fontSize: '0.8rem',
    color: '#1dd1a1',
    fontWeight: 'bold',
    background: 'rgba(29, 209, 161, 0.1)',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  closeHint: {
    fontSize: '0.8rem',
    color: '#ff9f43',
    fontWeight: 'bold',
    background: 'rgba(255, 159, 67, 0.15)',
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px dashed #ff9f43',
  },
  form: {
    display: 'flex',
    borderTop: '1px solid #0f3460',
  },
  input: {
    flex: 1,
    padding: '0.65rem 0.8rem',
    background: '#0d172a',
    border: 'none',
    color: '#eee',
    fontSize: '0.85rem',
    outline: 'none',
  },
  sendBtn: {
    padding: '0.65rem 1rem',
    background: '#e94560',
    border: 'none',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '0.85rem',
  },
};
