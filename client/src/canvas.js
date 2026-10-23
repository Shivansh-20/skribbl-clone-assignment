// client/src/canvas.js
// Phase 2: Core drawing helpers.
// This file answers the interview question:
// "How are drawing strokes captured, sent, and rendered across clients?"

/**
 * 1. Convert mouse coordinates into fractions (0.0 to 1.0)
 * Why? If one player is on a laptop (800px wide) and another is on a monitor (1600px wide),
 * raw pixel coordinates would be in completely different places.
 * Fractions make coordinates resolution-independent!
 */
export function getPoint(event, canvasEl) {
  // getBoundingClientRect() gives the exact position of the canvas on the screen
  const rect = canvasEl.getBoundingClientRect();

  // Subtract rect.left / rect.top so (0,0) is the top-left of the canvas, not the entire webpage
  const pixelX = event.clientX - rect.left;
  const pixelY = event.clientY - rect.top;

  // Convert to fraction (0.0 = left/top edge, 1.0 = right/bottom edge)
  const fractionX = pixelX / rect.width;
  const fractionY = pixelY / rect.height;

  // Clamp between 0 and 1 so fast mouse moves outside the canvas don't give negative numbers
  return {
    x: Math.max(0, Math.min(1, fractionX)),
    y: Math.max(0, Math.min(1, fractionY)),
  };
}

/**
 * 2. Draw one line segment between two points
 * @param {CanvasRenderingContext2D} ctx - 2D context of the HTML5 canvas
 * @param {HTMLCanvasElement} canvasEl - The canvas DOM element (to get its current pixel width/height)
 * @param {{x: number, y: number}} from - Starting point as fractions (0 to 1)
 * @param {{x: number, y: number}} to - Ending point as fractions (0 to 1)
 * @param {string} color - CSS color string like "#000000" or "#e94560"
 * @param {number} size - Brush size in pixels
 */
export function drawSegment(ctx, canvasEl, from, to, color, size) {
  // Convert fractions back to actual pixels for this specific screen
  const fromX = from.x * canvasEl.width;
  const fromY = from.y * canvasEl.height;
  const toX = to.x * canvasEl.width;
  const toY = to.y * canvasEl.height;

  ctx.save(); // Save current canvas settings

  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';   // Makes ends of lines rounded instead of square
  ctx.lineJoin = 'round';  // Makes corners smooth when dragging fast

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  ctx.restore(); // Restore previous settings
}

/**
 * 3. Clear the canvas and redraw every stroke from history.
 * Why is this needed?
 * - Used when a player clicks "Undo" (removes last stroke, then redraws).
 * - Used when a late player joins and needs to see the current drawing.
 */
export function redrawAll(ctx, canvasEl, strokes) {
  // Wipe the entire canvas clean
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

  if (!Array.isArray(strokes)) return;

  // Replay each stroke from history
  for (const stroke of strokes) {
    const { points, color, size } = stroke;
    if (!points || points.length === 0) continue;

    // A stroke with just 1 point is a single dot/click
    if (points.length === 1) {
      drawSegment(ctx, canvasEl, points[0], points[0], color, size);
      continue;
    }

    // Connect each sequential point with a line segment
    for (let i = 1; i < points.length; i++) {
      drawSegment(ctx, canvasEl, points[i - 1], points[i], color, size);
    }
  }
}
