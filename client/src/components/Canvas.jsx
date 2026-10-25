// client/src/components/Canvas.jsx
// Phase 2 + 3: Canvas component with smooth mouse tracking and live sync.

import { useRef, useEffect, useCallback } from 'react';
import socket from '../socket.js';
import { getPoint, drawSegment, redrawAll } from '../canvas.js';

export default function Canvas({ isDrawer, color, size, syncedStrokes = [] }) {
  const canvasRef = useRef(null);

  // Are we currently dragging the pointer?
  const isDrawing = useRef(false);

  // Remember the local drawer's previous point
  const lastPoint = useRef(null);

  // Remember the remote drawer's previous point, color, and size
  const remoteLastPoint = useRef(null);
  const remoteColor = useRef('#000000');
  const remoteSize = useRef(8);

  // Authoritative local stroke history (replayed on resize or undo, never lost!)
  const strokeHistory = useRef([]);

  // ── 1. Adjust Canvas Resolution to Match CSS Size ──────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resizeCanvas() {
      const newW = canvas.offsetWidth;
      const newH = canvas.offsetHeight;
      if (!newW || !newH) return;

      // ONLY reassign width/height if dimensions actually changed!
      // (Reassigning canvas.width resets the canvas bitmap to blank)
      if (canvas.width !== newW || canvas.height !== newH) {
        canvas.width = newW;
        canvas.height = newH;
        const ctx = canvas.getContext('2d');
        redrawAll(ctx, canvas, strokeHistory.current);
      }
    }

    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // ── 2. Redraw whenever syncedStrokes changes (Late Joiners or Undo) ─────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (syncedStrokes && syncedStrokes.length >= 0) {
      strokeHistory.current = [...syncedStrokes];
      const ctx = canvas.getContext('2d');
      redrawAll(ctx, canvas, strokeHistory.current);
    }
  }, [syncedStrokes]);

  // ── 3. Listen for Incoming Drawing Data from Other Players ──────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function onDrawData(data) {
      const { kind, x, y, color: incomingColor, size: incomingSize } = data;

      if (incomingColor) remoteColor.current = incomingColor;
      if (typeof incomingSize === 'number' && incomingSize > 0) remoteSize.current = incomingSize;

      if (kind === 'start') {
        remoteLastPoint.current = { x, y };
        strokeHistory.current.push({
          color: remoteColor.current,
          size: remoteSize.current,
          points: [{ x, y }],
        });
        drawSegment(ctx, canvas, { x, y }, { x, y }, remoteColor.current, remoteSize.current);
      } else if (kind === 'move' && remoteLastPoint.current) {
        const current = strokeHistory.current[strokeHistory.current.length - 1];
        if (current) current.points.push({ x, y });

        drawSegment(ctx, canvas, remoteLastPoint.current, { x, y }, remoteColor.current, remoteSize.current);
        remoteLastPoint.current = { x, y };
      } else if (kind === 'end') {
        remoteLastPoint.current = null;
      }
    }

    function onClear() {
      strokeHistory.current = [];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    socket.on('draw_data', onDrawData);
    socket.on('canvas_clear', onClear);

    return () => {
      socket.off('draw_data', onDrawData);
      socket.off('canvas_clear', onClear);
    };
  }, []);

  // ── 4. Pointer Event Handlers (Drawer Only — Pointer Capture API) ───────────

  // Pointer Pressed Down -> Start a new stroke and capture the pointer
  const handlePointerDown = useCallback((e) => {
    if (!isDrawer) return;

    // Only respond to primary click (left mouse button / single finger / pen)
    if (e.button !== 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Capture pointer so rapid movements never lose focus
    try {
      e.target.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture isn't supported
    }

    const ctx = canvas.getContext('2d');
    const pt = getPoint(e, canvas);

    isDrawing.current = true;
    lastPoint.current = pt;

    strokeHistory.current.push({
      color,
      size,
      points: [pt],
    });

    drawSegment(ctx, canvas, pt, pt, color, size);
    socket.emit('draw_start', { x: pt.x, y: pt.y, color, size });
  }, [isDrawer, color, size]);

  // Pointer Moved -> Continue stroke smoothly
  const handlePointerMove = useCallback((e) => {
    if (!isDrawer || !isDrawing.current || !lastPoint.current) return;

    // Safety: If left button is released, finish the stroke
    if (e.buttons !== 1) {
      isDrawing.current = false;
      lastPoint.current = null;
      socket.emit('draw_end');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const pt = getPoint(e, canvas);

    const current = strokeHistory.current[strokeHistory.current.length - 1];
    if (current) current.points.push(pt);

    drawSegment(ctx, canvas, lastPoint.current, pt, color, size);
    socket.emit('draw_move', { x: pt.x, y: pt.y, color, size });
    lastPoint.current = pt;
  }, [isDrawer, color, size]);

  // Pointer Released -> Finish stroke and release pointer
  const handlePointerUp = useCallback((e) => {
    if (!isDrawer || !isDrawing.current) return;

    try {
      if (e.target.hasPointerCapture(e.pointerId)) {
        e.target.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore if already released
    }

    isDrawing.current = false;
    lastPoint.current = null;
    socket.emit('draw_end');
  }, [isDrawer]);

  // High-contrast 2-tone cursor (black + white) that never camouflages on any background
  const crosshairCursor = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><circle cx='12' cy='12' r='5' fill='none' stroke='%23000' stroke-width='2'/><circle cx='12' cy='12' r='4' fill='none' stroke='%23fff' stroke-width='1.5'/><line x1='12' y1='2' x2='12' y2='6' stroke='%23000' stroke-width='2'/><line x1='12' y1='18' x2='12' y2='22' stroke='%23000' stroke-width='2'/><line x1='2' y1='12' x2='6' y2='12' stroke='%23000' stroke-width='2'/><line x1='18' y1='12' x2='22' y2='12' stroke='%23000' stroke-width='2'/></svg>") 12 12, crosshair`;

  return (
    <div className="canvas-wrapper">
      <canvas
        ref={canvasRef}
        style={{
          ...styles.canvas,
          cursor: isDrawer ? crosshairCursor : 'default',
          touchAction: 'none', // Prevents touch scrolling on mobile while drawing
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
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
