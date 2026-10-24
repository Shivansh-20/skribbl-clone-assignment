// client/src/components/Canvas.jsx
// Phase 2 + 3: Canvas component with smooth mouse tracking and live sync.

import { useRef, useEffect, useCallback } from 'react';
import socket from '../socket.js';
import { getPoint, drawSegment, redrawAll } from '../canvas.js';

export default function Canvas({ isDrawer, color, size, syncedStrokes }) {
  const canvasRef = useRef(null);

  // Are we currently dragging the mouse?
  const isDrawing = useRef(false);

  // Remember the previous point so we can connect line segments
  const lastPoint = useRef(null);

  // Remember the remote drawer's previous point
  const remoteLastPoint = useRef(null);

  // ── 1. Adjust Canvas Resolution to Match CSS Size ──────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resizeCanvas() {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const ctx = canvas.getContext('2d');
      redrawAll(ctx, canvas, syncedStrokes);
    }

    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [syncedStrokes]);

  // ── 2. Redraw whenever syncedStrokes changes (Late Joiners or Undo) ─────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    redrawAll(ctx, canvas, syncedStrokes);
  }, [syncedStrokes]);

  // ── 3. Listen for Incoming Drawing Data from Other Players ──────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function onDrawData(data) {
      const { kind, x, y, color: remoteColor, size: remoteSize } = data;

      if (kind === 'start') {
        remoteLastPoint.current = { x, y };
        drawSegment(ctx, canvas, { x, y }, { x, y }, remoteColor, remoteSize);
      } else if (kind === 'move' && remoteLastPoint.current) {
        drawSegment(ctx, canvas, remoteLastPoint.current, { x, y }, remoteColor, remoteSize);
        remoteLastPoint.current = { x, y };
      } else if (kind === 'end') {
        remoteLastPoint.current = null;
      }
    }

    function onClear() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    socket.on('draw_data', onDrawData);
    socket.on('canvas_clear', onClear);

    return () => {
      socket.off('draw_data', onDrawData);
      socket.off('canvas_clear', onClear);
    };
  }, []);

  // ── 4. Mouse Event Handlers (Drawer Only) ───────────────────────────────────

  // Mouse Pressed Down -> Start a new stroke
  const handleMouseDown = useCallback((e) => {
    if (!isDrawer) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pt = getPoint(e, canvas);

    isDrawing.current = true;
    lastPoint.current = pt;

    drawSegment(ctx, canvas, pt, pt, color, size);
    socket.emit('draw_start', { x: pt.x, y: pt.y, color, size });
  }, [isDrawer, color, size]);

  // Mouse Moved -> Continue stroke
  const handleMouseMove = useCallback((e) => {
    if (!isDrawer) return;

    // Safety: If mouse button is NOT held down (e.buttons === 0), don't draw!
    if (e.buttons !== 1) {
      if (isDrawing.current) {
        isDrawing.current = false;
        lastPoint.current = null;
        socket.emit('draw_end');
      }
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pt = getPoint(e, canvas);

    // If we just re-entered the canvas with button still held, start seamlessly
    if (!isDrawing.current || !lastPoint.current) {
      isDrawing.current = true;
      lastPoint.current = pt;
      drawSegment(ctx, canvas, pt, pt, color, size);
      socket.emit('draw_start', { x: pt.x, y: pt.y, color, size });
      return;
    }

    drawSegment(ctx, canvas, lastPoint.current, pt, color, size);
    socket.emit('draw_move', { x: pt.x, y: pt.y });
    lastPoint.current = pt;
  }, [isDrawer, color, size]);

  // Mouse Released -> Finish stroke
  const handleMouseUp = useCallback(() => {
    if (!isDrawer || !isDrawing.current) return;

    isDrawing.current = false;
    lastPoint.current = null;
    socket.emit('draw_end');
  }, [isDrawer]);

  return (
    <div style={styles.canvasWrapper}>
      <canvas
        ref={canvasRef}
        style={{
          ...styles.canvas,
          cursor: isDrawer ? 'crosshair' : 'default',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        // If mouse leaves, we don't abruptly kill the stroke if they drag right back in
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
}

const styles = {
  canvasWrapper: {
    width: '100%',
    height: '450px',
    background: '#ffffff',
    borderRadius: '10px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    overflow: 'hidden',
    position: 'relative',
    userSelect: 'none', // Prevents accidental text selection while dragging fast
  },
  canvas: {
    display: 'block',
    width: '100%',
    height: '100%',
  },
};
