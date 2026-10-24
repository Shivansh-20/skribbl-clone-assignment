// server/src/game.js
// Phase 3: Game Engine — manages timers, phases, word options, and round transitions.
// This is the core state machine for Skribbl.

import wordsData from './words.json' with { type: 'json' };
import { checkGuess, calcGuesserPoints, calcDrawerPoints } from './scoring.js';

const CHOOSE_TIME = 15; // Drawer has 15 seconds to pick a word
const ROUND_END_PAUSE = 5; // 5-second pause at round end to reveal word

// Combine all categorized words into one flat list of drawable words
const ALL_WORDS = [
  ...wordsData.animals,
  ...wordsData.food,
  ...wordsData.objects,
  ...wordsData.nature,
];

// Helper: Pick N random unique words from the word bank
export function pickRandomWords(count = 3) {
  const shuffled = [...ALL_WORDS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Helper: Always clear an active timer before starting a new one
export function clearRoomTimer(room) {
  if (room.timer) {
    clearInterval(room.timer);
    clearTimeout(room.timer);
    room.timer = null;
  }
}

// ============================================================================
// ✍️ PIECE #7: TURN & ROUND ADVANCE
// ============================================================================

/**
 * Part A: Replaces all letters in a word with underscores (_)
 * Example: "cat" -> "___", "ice cream" -> "___ _____"
 * Must keep spaces and hyphens intact!
 */
export function buildMask(word) {
  if (typeof word !== 'string') return '';
  return word.replace(/[a-zA-Z]/g, '_');
}

/**
 * Part B: Advances turn to the next player, increments rounds, and detects game over.
 * Inputs: room object
 * Returns: { phase, round, drawerIndex }
 */
export function nextTurn(room) {
  const totalPlayers = room.players.length;
  const maxRounds = room.settings.rounds || 3;

  // Move to the next player in the array
  let nextDrawerIndex = room.drawerIndex + 1;
  let nextRound = room.round;

  // If nextDrawerIndex is past the last player, a full cycle has finished!
  if (nextDrawerIndex >= totalPlayers) {
    nextDrawerIndex = 0;       // Reset back to first player
    nextRound = nextRound + 1;  // Advance round number
  }

  // If starting Round 1 for the very first time
  if (nextRound === 0) {
    nextRound = 1;
  }

  // If we have exceeded total rounds -> Game Over!
  if (nextRound > maxRounds) {
    return {
      phase: 'game_over',
      round: room.round,
      drawerIndex: room.drawerIndex,
    };
  }

  // Otherwise, start next turn in choosing phase
  return {
    phase: 'choosing',
    round: nextRound,
    drawerIndex: nextDrawerIndex,
  };
}

// ============================================================================
// ⚙️ GAME STATE MACHINE PLUMBING (AI SCAFFOLDING)
// ============================================================================

/**
 * 1. Start a new turn:
 * Calls nextTurn() -> sets drawer -> picks 3 words -> starts 15s choose timer.
 */
export function startTurn(io, room) {
  clearRoomTimer(room);

  // Advance turn using your Piece #7 logic
  const turnResult = nextTurn(room);

  // If all rounds are finished -> End the Game!
  if (turnResult?.phase === 'game_over') {
    room.phase = 'game_over';
    console.log(`[${room.code}] Game Over!`);

    // Sort leaderboard by score descending
    const leaderboard = [...room.players].sort((a, b) => b.score - a.score);
    io.to(room.code).emit('game_over', {
      winner: leaderboard[0] || null,
      leaderboard,
    });
    return;
  }

  // Update room state for the new turn
  room.phase = 'choosing';
  room.round = turnResult.round;
  room.drawerIndex = turnResult.drawerIndex;
  room.strokes = []; // Wipe canvas for new drawer
  room.word = null;   // Secret word is hidden
  room.mask = '';
  room.timeLeft = CHOOSE_TIME;
  room.guessedCount = 0; // Tracks how many players correctly guessed this round

  // Reset guessing status for all players
  for (const player of room.players) {
    player.hasGuessed = false;
  }

  const drawer = room.players[room.drawerIndex];
  const wordOptions = pickRandomWords(room.settings.wordChoices || 3);
  room.wordOptions = wordOptions;

  console.log(`[${room.code}] Turn started. Round ${room.round}. Drawer: "${drawer.name}". Options: ${wordOptions.join(', ')}`);

  // Broadcast round start to everyone
  io.to(room.code).emit('round_start', {
    drawerId: drawer.id,
    drawerName: drawer.name,
    round: room.round,
    totalRounds: room.settings.rounds,
  });

  // Send word choices ONLY to the drawer (never to guessers!)
  const drawerSocket = io.sockets.sockets.get(drawer.id);
  if (drawerSocket) {
    drawerSocket.emit('word_options', { options: wordOptions, chooseTime: CHOOSE_TIME });
  }

  // Broadcast updated game state
  io.to(room.code).emit('game_state', getPublicSnapshot(room));

  // 15-second timer: If drawer doesn't pick in time, auto-select the first word!
  let secondsLeft = CHOOSE_TIME;
  room.timer = setInterval(() => {
    secondsLeft--;
    room.timeLeft = secondsLeft;
    io.to(room.code).emit('timer_tick', { timeLeft: room.timeLeft });

    if (secondsLeft <= 0) {
      console.log(`[${room.code}] Choosing timed out. Auto-picked: "${wordOptions[0]}"`);
      chooseWord(io, room, wordOptions[0]);
    }
  }, 1000);
}

/**
 * 2. Drawer picks a word:
 * Locks in word -> builds mask -> starts drawing phase & countdown timer.
 */
export function chooseWord(io, room, chosenWord) {
  clearRoomTimer(room);

  // Validate the chosen word was actually one of the offered choices
  if (!room.wordOptions.includes(chosenWord)) {
    chosenWord = room.wordOptions[0];
  }

  room.phase = 'drawing';
  room.word = chosenWord; // Server-only secret!
  room.mask = buildMask(chosenWord); // What guessers see (underscores)
  room.timeLeft = room.settings.drawTime;

  console.log(`[${room.code}] Word chosen: "${room.word}". Mask sent to guessers: "${room.mask}"`);

  // Broadcast drawing phase to everyone
  io.to(room.code).emit('game_state', getPublicSnapshot(room));

  // Drawing countdown timer
  room.timer = setInterval(() => {
    room.timeLeft--;
    io.to(room.code).emit('timer_tick', { timeLeft: room.timeLeft });

    // When time expires -> End round!
    if (room.timeLeft <= 0) {
      console.log(`[${room.code}] Draw time expired for word "${room.word}".`);
      endRound(io, room);
    }
  }, 1000);
}

/**
 * 3. Round ends:
 * Stops drawing -> reveals secret word -> waits 5s -> advances to next turn.
 */
export function endRound(io, room) {
  clearRoomTimer(room);
  room.phase = 'round_end';

  console.log(`[${room.code}] Round ended. Secret word was: "${room.word}"`);

  // Award points to the drawer based on how many players guessed correctly
  const drawer = room.players[room.drawerIndex];
  const guesserCount = room.players.length - 1;
  if (drawer && guesserCount > 0) {
    const drawerPoints = calcDrawerPoints({
      correctCount: room.guessedCount || 0,
      guesserCount,
    });
    drawer.score = (drawer.score || 0) + drawerPoints;
    if (drawerPoints > 0) {
      io.to(room.code).emit('chat_message', {
        id: Math.random().toString(36).substring(2, 9),
        kind: 'system',
        text: `🎨 ${drawer.name} earned ${drawerPoints} pts as the drawer!`,
      });
    }
  }

  // Reveal the secret word and updated scores to everyone
  io.to(room.code).emit('round_end', {
    word: room.word,
    scores: room.players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
  });

  // 5-second pause to let players see the word and scores, then start next turn!
  room.timer = setTimeout(() => {
    startTurn(io, room);
  }, ROUND_END_PAUSE * 1000);
}

// ============================================================================
// Piece #8: Guess Handler State Flow
// ============================================================================

/**
 * 4. Process incoming guess from a player:
 * @param {object} io - Socket.IO server instance
 * @param {object} socket - Socket of the guessing player
 * @param {object} room - Current room state
 * @param {string} text - Raw guess text submitted by player
 */
export function handleGuess(io, socket, room, text) {
  // TODO: [Piece #8] Write handleGuess here in VS Code!
}

/**
 * Helper: Sanitizes the room state for public broadcast.
 * Guarantees room.word is NEVER sent to guessers!
 */
export function getPublicSnapshot(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    settings: room.settings,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      hasGuessed: p.hasGuessed,
    })),
    phase: room.phase,
    round: room.round,
    drawerId: room.players[room.drawerIndex]?.id || null,
    mask: room.mask,
    timeLeft: room.timeLeft,
  };
}
