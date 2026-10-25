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
  room.strokes = []; // Wipe canvas on server
  room.word = null;   // Secret word is hidden
  room.mask = '';
  room.timeLeft = CHOOSE_TIME;
  room.guessedCount = 0; // Tracks how many players correctly guessed this round

  // Automatically clear canvas on all player screens for the new drawer!
  io.to(room.code).emit('canvas_clear');

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
  const drawerSocket = io.sockets?.sockets?.get(drawer.id);
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

  // Broadcast game state securely (drawer gets word, guessers get mask)
  emitGameState(io, room);

  // Drawing countdown timer
  room.timer = setInterval(() => {
    room.timeLeft--;
    io.to(room.code).emit('timer_tick', { timeLeft: room.timeLeft });

    // When time expires -> End round!
    if (room.timeLeft <= 0) {
      console.log(`[${room.code}] Draw time expired for word "${room.word}".`);
      endRound(io, room);
      return;
    }

    // Phase 5 Hint 1: At 50% time left, reveal 1st letter hint in mask!
    if (room.timeLeft === Math.floor(room.settings.drawTime * 0.5)) {
      room.mask = revealHint(room.word, room.mask);
      emitGameState(io, room);
      io.to(room.code).emit('chat_message', {
        id: Date.now() + Math.random(),
        kind: 'system',
        text: '💡 A letter hint was revealed!',
      });
    }

    // Phase 5 Hint 2: At 25% time left, reveal 2nd letter hint (if word >= 5 chars)!
    if (room.timeLeft === Math.floor(room.settings.drawTime * 0.25) && room.word?.length >= 5) {
      room.mask = revealHint(room.word, room.mask);
      emitGameState(io, room);
      io.to(room.code).emit('chat_message', {
        id: Date.now() + Math.random(),
        kind: 'system',
        text: '💡 Another letter hint was revealed!',
      });
    }
  }, 1000);
}

/**
 * 3. Round ends:
 * Stops drawing -> reveals secret word -> waits 5s -> advances to next turn.
 */
export function endRound(io, room) {
  if (room.phase === 'round_end') return; // Guard: Never end a round that has already ended!
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
      // Special "Master Artist" recognition only when EVERYONE guessed with at least 20 seconds left on the clock!
      const allGuessedEarly = (room.guessedCount || 0) >= guesserCount && room.timeLeft >= 20;

      const messageText = allGuessedEarly
        ? `🎨👨‍🎨 Master Artist! Everyone guessed early (${room.timeLeft}s left) — ${drawer.name} earned full ${drawerPoints} pts! 🖌️✨`
        : `🎨 ${drawer.name} earned ${drawerPoints} pts as the drawer.`;

      io.to(room.code).emit('chat_message', {
        id: Date.now() + Math.random(),
        kind: 'system',
        text: messageText,
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
  // safety check => must be "drawing phase"
  if (room.phase !== 'drawing') return;

  const player = room.players.find((p) => p.id === socket.id);
  if (!player) return;

  // safety check => Drawer cannot guess their own drawing
  const isDrawer = socket.id === room.players[room.drawerIndex]?.id;
  if (isDrawer) return;
  
  // if this player already guessed correctly this round, stop further movement
  if (player.hasGuessed) return;

  // Evaluate the guess against the secret word
  const result = checkGuess(text, room.word); 

  // Correct Guess case!
  if (result === 'correct') {
    player.hasGuessed = true;
    room.guessedCount = (room.guessedCount || 0) + 1;

    // calculating points
    const points = calcGuesserPoints({
      timeLeft: room.timeLeft,
      drawTime: room.settings.drawTime || 80,
      order: room.guessedCount,
    });
    player.score = (player.score || 0) + points;

    // Broadcasting announcement, word not revealed
    io.to(room.code).emit('chat_message', {
      id: Date.now() + Math.random(),
      kind: 'system',
      text: `🎉 Yayyy! ${player.name} guessed the correct word! (+${points} pts)`,
    });

    // Broadcast updated game state so scoreboard reflects new score and green checkmark
    emitGameState(io, room);

    // Check if ALL non-drawers have guessed correctly!
    const totalGuessers = room.players.length - 1;
    if (room.guessedCount >= totalGuessers) {
      console.log(`[${room.code}] All players guessed the word! Ending round early.`);
      if (room.timeLeft >= 20) {
        io.to(room.code).emit('chat_message', {
          id: Date.now() + Math.random(),
          kind: 'system',
          text: `⚡ Master Artist found! Everyone guessed with ${room.timeLeft}s remaining! 🏆🎨`,
        });
      }
      endRound(io, room);
    }
    return;
  }

  // Case B: Close typo
  if (result === 'close') {
    // send hint only to this player
    socket.emit('guess_close');

    // still display the typo in public chat 
    io.to(room.code).emit('chat_message', {
      id: Date.now() + Math.random(),
      kind: 'chat',
      playerName: player.name,
      text,
    });
    return;
  }

  // Case C: Wrong guess
  // Broadcast message in chat for everyone
  io.to(room.code).emit('chat_message', {
    id: Date.now() + Math.random(),
    kind: 'chat',
    playerName: player.name,
    text,
  });
}

// ============================================================================
// Piece #9: Letter Hint Revealer (Phase 5)
// ============================================================================

/**
 * 5. Reveals one random hidden letter in the mask:
 * @param {string} word - The secret word (e.g. "elephant")
 * @param {string} currentMask - The current mask (e.g. "________")
 * Returns: Updated mask with 1 letter revealed (e.g. "____h___")
 */
export function revealHint(word, currentMask) {
  if (!word || !currentMask) return currentMask;
  const chars = currentMask.split('');

  // Find all character positions that are still hidden ('_')
  const hiddenIndices = [];
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === '_') {
      hiddenIndices.push(i);
    }
  }

  // If only 1 hidden letter remains, don't give away the entire word
  if (hiddenIndices.length <= 1) return currentMask;

  // Pick one random hidden index to reveal
  const randomIndex = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
  chars[randomIndex] = word[randomIndex];

  return chars.join('');
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

/**
 * Helper: Securely broadcasts game state.
 * - Guessers receive sanitized public snapshot (secret word is null).
 * - Active drawer privately receives their secret word so it is always visible on their header.
 */
export function emitGameState(io, room) {
  io.to(room.code).emit('game_state', getPublicSnapshot(room));

  if (room.phase === 'drawing' && room.word) {
    const drawer = room.players[room.drawerIndex];
    if (drawer) {
      // 1. Send dedicated drawer_word event
      io.to(drawer.id).emit('drawer_word', { word: room.word });
      // 2. Also send game_state with word attached so room.word is populated on drawer
      io.to(drawer.id).emit('game_state', {
        ...getPublicSnapshot(room),
        word: room.word,
      });
    }
  }
}
