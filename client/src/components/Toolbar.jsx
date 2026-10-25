// client/src/components/Toolbar.jsx
// Phase 2: Drawing toolbar with colors, brush sizes, eraser, undo, and clear buttons.

import socket from '../socket.js';

// Standard Skribbl color palette (vibrant drawable colors; Eraser is used for white)
const PALETTE = [
  '#000000', // Black
  '#ff4757', // Red
  '#ff6b81', // Pink
  '#ff9f43', // Orange
  '#feca57', // Yellow
  '#1dd1a1', // Green
  '#54a0ff', // Blue
  '#5f27cd', // Purple
];

const BRUSH_SIZES = [
  { label: 'S', size: 3 },
  { label: 'M', size: 8 },
  { label: 'L', size: 16 },
];

export default function Toolbar({ color, setColor, size, setSize }) {
  // Drawer clicks "Clear"
  function handleClear() {
    socket.emit('canvas_clear');
  }

  // Drawer clicks "Undo"
  function handleUndo() {
    socket.emit('draw_undo');
  }

  // Eraser is just drawing with white (the canvas background color)
  function handleEraser() {
    setColor('#ffffff');
  }

  return (
    <div style={styles.toolbar}>
      {/* ── Color Swatches ── */}
      <div style={styles.group}>
        {PALETTE.map((c) => {
          const isSelected = color === c;
          return (
            <button
              key={c}
              type="button"
              style={{
                ...styles.colorBtn,
                background: c,
                border: isSelected ? '3px solid #e94560' : '2px solid #555',
                transform: isSelected ? 'scale(1.15)' : 'scale(1)',
              }}
              onClick={() => setColor(c)}
              title={c}
            />
          );
        })}
      </div>

      {/* ── Brush Sizes ── */}
      <div style={styles.group}>
        {BRUSH_SIZES.map((b) => {
          const isSelected = size === b.size && color !== '#ffffff';
          return (
            <button
              key={b.size}
              type="button"
              style={{
                ...styles.btn,
                background: isSelected ? '#e94560' : '#0f3460',
              }}
              onClick={() => setSize(b.size)}
            >
              {b.label}
            </button>
          );
        })}
      </div>

      {/* ── Tools: Eraser, Undo, Clear ── */}
      <div style={styles.group}>
        <button
          type="button"
          style={{
            ...styles.btn,
            background: color === '#ffffff' ? '#e94560' : '#0f3460',
          }}
          onClick={handleEraser}
          title="Eraser (draws in canvas background color)"
        >
          🧹 Eraser
        </button>

        <button
          type="button"
          style={styles.btn}
          onClick={handleUndo}
          title="Undo last stroke"
        >
          ↩️ Undo
        </button>

        <button
          type="button"
          style={{ ...styles.btn, background: '#842029' }}
          onClick={handleClear}
          title="Clear entire canvas"
        >
          🗑️ Clear
        </button>
      </div>
    </div>
  );
}

const styles = {
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    background: '#16213e',
    padding: '0.6rem 1rem',
    borderRadius: '10px',
    border: '1px solid #0f3460',
    marginBottom: '0.6rem',
  },
  group: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  colorBtn: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    cursor: 'pointer',
    outline: 'none',
    transition: 'transform 0.1s ease',
  },
  btn: {
    padding: '0.4rem 0.75rem',
    background: '#0f3460',
    border: '1px solid #1a4a80',
    borderRadius: '6px',
    color: '#eee',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '0.85rem',
  },
};
