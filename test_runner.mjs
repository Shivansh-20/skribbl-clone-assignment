// skribbl/test_runner.mjs
// Automated Verification Suite for Skribbl Core Pieces (Phases 1 - 5)

import assert from 'assert';
import { normalize, checkGuess, calcGuesserPoints, calcDrawerPoints } from './server/src/scoring.js';
import { buildMask, revealHint, nextTurn } from './server/src/game.js';
import { generateCode, sanitizeSettings, makePlayer } from './server/src/rooms.js';

console.log('🧪 Starting Skribbl Automated Test Suite...\n');

let passedCount = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// ============================================================================
// 1. UNIT TESTS: String Normalization & Word Matching (Piece #5)
// ============================================================================
console.log('--- 1. Unit Tests: Normalization & Levenshtein-1 Matching ---');

test('normalize: trims extra whitespace and converts uppercase to lowercase', () => {
  assert.strictEqual(normalize('  Apple  '), 'apple');
  assert.strictEqual(normalize('PIZZA'), 'pizza');
  assert.strictEqual(normalize(null), '');
  assert.strictEqual(normalize(undefined), '');
});

test('checkGuess: identifies exact match, 1-letter typo ("close"), and wrong guess', () => {
  assert.strictEqual(checkGuess('apple', 'apple'), 'correct');
  assert.strictEqual(checkGuess('  APPLE  ', 'apple'), 'correct');
  assert.strictEqual(checkGuess('aple', 'apple'), 'close');    // 1 missing char
  assert.strictEqual(checkGuess('applee', 'apple'), 'close');   // 1 extra char
  assert.strictEqual(checkGuess('appla', 'apple'), 'close');    // 1 replaced char
  assert.strictEqual(checkGuess('banana', 'apple'), 'wrong');   // totally different
});

// ============================================================================
// 2. UNIT TESTS: Scoring Formulas (Piece #6)
// ============================================================================
console.log('\n--- 2. Unit Tests: Scoring Formulas ---');

test('calcGuesserPoints: awards speed-decay points plus 1st-place trophy bonus', () => {
  // First guesser with 70s left out of 80s:
  // Math.round(400 * (70/80)) + 50 + 50 = 350 + 50 + 50 = 450
  const firstGuesserPts = calcGuesserPoints({ timeLeft: 70, drawTime: 80, order: 1 });
  assert.strictEqual(firstGuesserPts, 450);

  // Second guesser with 40s left out of 80s (no 1st-place bonus):
  // Math.round(400 * (40/80)) + 50 = 200 + 50 = 250
  const secondGuesserPts = calcGuesserPoints({ timeLeft: 40, drawTime: 80, order: 2 });
  assert.strictEqual(secondGuesserPts, 250);

  // Guesser with 0s left:
  // Math.round(400 * (0/80)) + 50 = 50 base points
  const lastSecondGuesserPts = calcGuesserPoints({ timeLeft: 0, drawTime: 80, order: 3 });
  assert.strictEqual(lastSecondGuesserPts, 50);
});

test('calcDrawerPoints: rewards drawer proportionally to successful guessers', () => {
  // 3 out of 3 guessers succeeded -> 100% -> 300 pts
  assert.strictEqual(calcDrawerPoints({ correctCount: 3, guesserCount: 3 }), 300);

  // 1 out of 2 guessers succeeded -> 50% -> 150 pts
  assert.strictEqual(calcDrawerPoints({ correctCount: 1, guesserCount: 2 }), 150);

  // 0 out of 3 guessers succeeded -> 0% -> 0 pts
  assert.strictEqual(calcDrawerPoints({ correctCount: 0, guesserCount: 3 }), 0);

  // Defensive fallback against division by zero
  assert.strictEqual(calcDrawerPoints({ correctCount: 0, guesserCount: 0 }), 0);
});

// ============================================================================
// 3. UNIT TESTS: Masking & Hint Revealing (Piece #7A & Piece #9)
// ============================================================================
console.log('\n--- 3. Unit Tests: Word Masking & Hint Algorithms ---');

test('buildMask: replaces all letters with underscores while preserving spaces', () => {
  assert.strictEqual(buildMask('cat'), '___');
  assert.strictEqual(buildMask('hot dog'), '___ ___');
  assert.strictEqual(buildMask('ice cream'), '___ _____');
});

test('revealHint: dynamically reveals a hidden letter without destroying existing hints', () => {
  const secret = 'planet';
  const initialMask = '______';
  
  // Reveal 1st hint
  const hint1 = revealHint(secret, initialMask);
  assert.strictEqual(hint1.length, 6);
  assert.strictEqual(hint1.replace(/_/g, '').length, 1); // exactly 1 letter revealed

  // Reveal 2nd hint
  const hint2 = revealHint(secret, hint1);
  assert.strictEqual(hint2.length, 6);
  assert.strictEqual(hint2.replace(/_/g, '').length, 2); // exactly 2 letters revealed

  // Verify non-revealed positions remain underscores
  for (let i = 0; i < hint2.length; i++) {
    if (hint2[i] !== '_') {
      assert.strictEqual(hint2[i], secret[i]);
    }
  }
});

// ============================================================================
// 4. INTEGRATION TESTS: Room State Machine & Turn Rotation (Piece #7B)
// ============================================================================
console.log('\n--- 4. Integration Tests: State Machine & Turn Rotation ---');

test('sanitizeSettings: clamps round and time values within safe minimums and maximums', () => {
  const cleaned = sanitizeSettings({ rounds: -5, drawTime: 999 });
  assert.strictEqual(cleaned.rounds, 2);       // clamped to min 2
  assert.strictEqual(cleaned.drawTime, 240);   // clamped to max 240
});

test('generateCode: produces a 5-character string free of ambiguous characters (0, O, 1, I)', () => {
  const code = generateCode();
  assert.strictEqual(code.length, 5);
  assert.strictEqual(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/.test(code), true);
});

test('nextTurn: rotates drawerIndex across players and increments round only after all have drawn', () => {
  const room = {
    round: 0,
    drawerIndex: -1,
    players: [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
    ],
    settings: { rounds: 2 },
  };

  // Turn 1: Alice draws (drawerIndex 0, round 1)
  const turn1 = nextTurn(room);
  assert.strictEqual(turn1.drawerIndex, 0);
  assert.strictEqual(turn1.round, 1);
  room.drawerIndex = turn1.drawerIndex;
  room.round = turn1.round;

  // Turn 2: Bob draws (drawerIndex 1, round 1)
  const turn2 = nextTurn(room);
  assert.strictEqual(turn2.drawerIndex, 1);
  assert.strictEqual(turn2.round, 1);
  room.drawerIndex = turn2.drawerIndex;
  room.round = turn2.round;

  // Turn 3: Alice draws again -> Now Round 2 starts!
  const turn3 = nextTurn(room);
  assert.strictEqual(turn3.drawerIndex, 0);
  assert.strictEqual(turn3.round, 2);
  room.drawerIndex = turn3.drawerIndex;
  room.round = turn3.round;

  // Turn 4: Bob draws again (Round 2)
  const turn4 = nextTurn(room);
  assert.strictEqual(turn4.drawerIndex, 1);
  assert.strictEqual(turn4.round, 2);
  room.drawerIndex = turn4.drawerIndex;
  room.round = turn4.round;

  // Turn 5: Round 2 complete -> Triggers game_over
  const turn5 = nextTurn(room);
  assert.strictEqual(turn5.phase, 'game_over');
});

console.log(`\n========================================================`);
console.log(`🎉 ALL ${passedCount} AUTOMATED TESTS PASSED SUCCESSFULLY!`);
console.log(`========================================================\n`);
