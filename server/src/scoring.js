// server/src/scoring.js
// Phase 4: Word Matching and Point Calculation Logic.
// Contains Piece #5 (Word Matching) and Piece #6 (Scoring Formulas).

// ============================================================================
// Piece #5: Word Matching
// ============================================================================

/**
 * 1. Normalize text:
 * Trims extra spaces from both ends and converts to lowercase.
 * Example: "  Cat  " -> "cat"
 */
export function normalize(text) {
  if (typeof text !== 'string') return '';
  return text.trim().toLowerCase();
}

/**
 * Helper: Detects if two words are exactly 1 letter away (typo detection)
 * e.g. "catt" vs "cat", "cot" vs "cat", "ca" vs "cat"
 */
function isClose(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;

  let diff = 0;
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i] !== b[j]) {
      diff++;
      if (diff > 1) return false; // More than 1 letter difference

      if (a.length > b.length) {
        i++; // 'a' has an extra character
      } else if (b.length > a.length) {
        j++; // 'b' has an extra character
      } else {
        i++;
        j++; // One character replaced
      }
    } else {
      i++;
      j++;
    }
  }

  if (i < a.length || j < b.length) {
    diff++;
  }

  return diff === 1;
}

/**
 * 2. Check guess against the secret word:
 * Returns: 'correct' | 'close' | 'wrong'
 * - 'correct': normalized guess === normalized word
 * - 'close': guess is exactly 1 letter away (e.g. 1 extra, 1 missing, 1 different letter)
 * - 'wrong': anything else
 */
export function checkGuess(guess, word) {
  const normGuess = normalize(guess);
  const normWord = normalize(word);

  if (!normGuess || !normWord) return 'wrong';
  if (normGuess === normWord) return 'correct';
  if (isClose(normGuess, normWord)) return 'close';
  return 'wrong';
}

// ============================================================================
// Piece #6: Scoring Formulas
// ============================================================================

/**
 * 3. Calculate points for a correct guesser:
 * @param {number} timeLeft - Seconds remaining when guess was made
 * @param {number} drawTime - Total drawing time allowed (e.g. 80s)
 * @param {number} order - 1 for 1st guesser, 2 for 2nd, etc.
 * Formula: Base points + Time bonus + First-guesser bonus
 */
export function calcGuesserPoints({ timeLeft, drawTime, order }) {
  const safeTotal = drawTime > 0 ? drawTime : 80;
  const safeTime = Math.max(0, Math.min(timeLeft, safeTotal));

  const base = 50;
  const timeBonus = Math.round(400 * (safeTime / safeTotal));
  const firstBonus = order === 1 ? 50 : 0;

  return base + timeBonus + firstBonus;
}

/**
 * 4. Calculate points awarded to the drawer at round end:
 * @param {number} correctCount - How many players guessed correctly
 * @param {number} guesserCount - Total number of guessers (players.length - 1)
 */
export function calcDrawerPoints({ correctCount, guesserCount }) {
  if (!guesserCount || guesserCount <= 0) return 0;
  return Math.round(300 * (correctCount / guesserCount));
}
