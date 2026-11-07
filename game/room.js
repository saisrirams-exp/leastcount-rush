const {
  createShoe,
  getDeckCountForPlayerCapacity,
  calculateHandScore,
  isValidDrop,
  applyWildJokerToCard
} = require('./deck');

class GameRoom {
  constructor(code, hostId, hostName, settings = {}) {
    this.code = code;
    this.hostId = hostId;
    this.createdAt = Date.now();

    // Configurable Settings (6 to 15 players)
    this.maxPlayers = Math.min(15, Math.max(6, parseInt(settings.maxPlayers, 10) || 10));
    this.eliminationScore = parseInt(settings.eliminationScore, 10) || 150; // 100, 150, or 200
    this.turnDuration = parseInt(settings.turnDuration, 10) || 12; // in seconds (e.g. 10, 12, 15)
    this.handSize = 5; // Standard 5 cards

    // Room State
    this.status = 'LOBBY'; // 'LOBBY' | 'PLAYING' | 'ROUND_OVER' | 'GAME_OVER'
    this.roundNumber = 0;
    this.players = []; // Array of Player objects

    // Table State
    this.drawPile = [];
    this.discardPile = [];
    this.wildJokerCard = null;
    this.wildJokerRank = null;
    this.currentTurnIndex = 0;
    this.turnPhase = 'DROP'; // 'DROP' | 'DRAW'
    this.turnTimer = null;
    this.turnTimeRemaining = 0;
    this.lastAction = null;
    this.roundResults = null;
    this.deckCountUsed = getDeckCountForPlayerCapacity(this.maxPlayers);

    // Initial Host Player
    this.addPlayer(hostId, hostName, false);
  }

  addPlayer(id, name, isBot = false, socketId = null) {
    // 1. Reconnection check (player with same ID already in room)
    const existing = this.players.find(p => p.id === id);
    if (existing) {
      existing.connected = true;
      existing.socketId = socketId;
      if (name && !existing.isBot) existing.name = name.trim();
      return { success: true, player: existing, reconnected: true };
    }

    // 2. Capacity check
    if (this.players.length >= this.maxPlayers) {
      return { success: false, message: `Table is full (max ${this.maxPlayers} players)` };
    }

    const player = {
      id,
      socketId,
      name: name.trim() || (isBot ? `Bot_${Math.floor(100 + Math.random() * 900)}` : 'Player'),
      isBot,
      connected: true,
      score: 0,
      hand: [],
      eliminated: false,
      waitingNextRound: this.status === 'PLAYING',
      droppedThisTurn: []
    };

    this.players.push(player);
    return { success: true, player, reconnected: false };
  }

  setPlayerDisconnected(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      player.connected = false;
      player.disconnectedAt = Date.now();
    }
  }

  removePlayer(playerId) {
    const idx = this.players.findIndex(p => p.id === playerId);
    if (idx === -1) return false;

    const removed = this.players.splice(idx, 1)[0];

    // If host leaves, assign next connected human player as host
    if (this.hostId === playerId) {
      const nextHuman = this.players.find(p => !p.isBot);
      if (nextHuman) {
        this.hostId = nextHuman.id;
      }
    }

    // If game is in progress and player count drops below 2
    if (this.status === 'PLAYING') {
      const activePlayers = this.getActivePlayers();
      if (activePlayers.length <= 1) {
        this.endGame('Not enough players to continue.');
      } else if (this.currentTurnIndex >= this.players.length) {
        this.currentTurnIndex = 0;
      }
    }

    return removed;
  }

  addBot() {
    if (this.players.length >= this.maxPlayers) return false;
    const botNames = [
      'Alex', 'Jordan', 'Sam', 'Taylor', 'Morgan', 'Casey', 'Riley',
      'Avery', 'Jamie', 'Dakota', 'Quinn', 'Skyler', 'Cameron', 'Rowan', 'Harper'
    ];
    const usedNames = new Set(this.players.map(p => p.name));
    let botName = botNames.find(n => !usedNames.has(n));
    if (!botName) botName = `Bot_${this.players.length + 1}`;

    const botId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    return this.addPlayer(botId, botName, true);
  }

  fillWithBots() {
    const added = [];
    while (this.players.length < this.maxPlayers) {
      const res = this.addBot();
      if (res && res.player) added.push(res.player);
      else break;
    }
    return added;
  }

  removeBot(botId) {
    const bot = this.players.find(p => p.id === botId && p.isBot);
    if (!bot) return false;
    return this.removePlayer(botId);
  }

  updateSettings(settings) {
    if (this.status !== 'LOBBY') return false;
    if (settings.maxPlayers) {
      this.maxPlayers = Math.min(15, Math.max(6, parseInt(settings.maxPlayers, 10)));
      this.deckCountUsed = getDeckCountForPlayerCapacity(this.maxPlayers);
      // Trim excess bots if new max is smaller
      while (this.players.length > this.maxPlayers) {
        const lastBot = [...this.players].reverse().find(p => p.isBot);
        if (lastBot) this.removePlayer(lastBot.id);
        else break;
      }
    }
    if (settings.eliminationScore) {
      this.eliminationScore = parseInt(settings.eliminationScore, 10);
    }
    if (settings.turnDuration) {
      this.turnDuration = Math.min(30, Math.max(6, parseInt(settings.turnDuration, 10)));
    }
    return true;
  }

  getActivePlayers() {
    return this.players.filter(p => !p.eliminated && !p.waitingNextRound);
  }

  startNewGame() {
    const active = this.getActivePlayers();
    if (active.length < 2) {
      return { success: false, message: 'Need at least 2 players to start.' };
    }

    this.roundNumber = 0;
    this.players.forEach(p => {
      p.score = 0;
      p.eliminated = false;
      p.waitingNextRound = false;
      p.hand = [];
    });

    this.startNewRound();
    return { success: true };
  }

  startNewRound() {
    this.roundNumber++;
    this.status = 'PLAYING';
    this.roundResults = null;

    // Reset waiting players and hands so everyone starts fresh!
    this.players.forEach(p => {
      p.waitingNextRound = false;
      p.hand = [];
      p.droppedThisTurn = [];
    });

    // Build shoe based on player capacity
    this.deckCountUsed = getDeckCountForPlayerCapacity(this.maxPlayers);
    this.drawPile = createShoe(this.deckCountUsed, true);
    this.discardPile = [];

    // Cut one card to be the Wild Joker for this round
    this.wildJokerCard = this.drawPile.pop();
    this.wildJokerRank = this.wildJokerCard.isJoker ? 'A' : this.wildJokerCard.rank;
    applyWildJokerToCard(this.wildJokerCard, this.wildJokerRank);

    // Deal 5 cards to each active player
    const activePlayers = this.getActivePlayers();
    for (let c = 0; c < this.handSize; c++) {
      for (const p of activePlayers) {
        if (this.drawPile.length > 0) {
          const card = this.drawPile.pop();
          applyWildJokerToCard(card, this.wildJokerRank);
          p.hand.push(card);
        }
      }
    }

    // Flip the first card to discard pile
    if (this.drawPile.length > 0) {
      const firstDiscard = this.drawPile.pop();
      applyWildJokerToCard(firstDiscard, this.wildJokerRank);
      this.discardPile.push(firstDiscard);
    }

    // Pick starting player randomly or rotate
    const activeIndices = this.players
      .map((p, idx) => (!p.eliminated ? idx : -1))
      .filter(idx => idx !== -1);
    
    this.currentTurnIndex = activeIndices[(this.roundNumber - 1) % activeIndices.length];
    this.turnPhase = 'DROP';
    this.lastAction = { type: 'ROUND_START', text: `Round ${this.roundNumber} begins!` };

    this.startTurnTimer();
  }

  getCurrentPlayer() {
    return this.players[this.currentTurnIndex];
  }

  startTurnTimer() {
    this.clearTurnTimer();
    this.turnTimeRemaining = this.turnDuration;
  }

  clearTurnTimer() {
    if (this.turnTimer) {
      clearInterval(this.turnTimer);
      this.turnTimer = null;
    }
  }

  /**
   * Discard 1 or multiple cards of matching rank.
   */
  handleDrop(playerId, cardIds) {
    if (this.status !== 'PLAYING') return { success: false, message: 'Game is not active' };
    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer || currentPlayer.id !== playerId) {
      return { success: false, message: 'Not your turn' };
    }
    if (this.turnPhase !== 'DROP') {
      return { success: false, message: 'You have already dropped cards this turn. Now draw.' };
    }

    if (!Array.isArray(cardIds) || cardIds.length === 0) {
      return { success: false, message: 'Must select at least 1 card to drop' };
    }

    // Find cards in player's hand
    const cardsToDrop = [];
    for (const cid of cardIds) {
      const found = currentPlayer.hand.find(c => c.id === cid);
      if (!found) return { success: false, message: 'Card not in your hand' };
      cardsToDrop.push(found);
    }

    // Validate if matching ranks
    if (!isValidDrop(cardsToDrop)) {
      return { success: false, message: 'Multiple cards dropped must have the same rank!' };
    }

    // Remove from hand
    currentPlayer.hand = currentPlayer.hand.filter(c => !cardIds.includes(c.id));
    
    // Add to discard pile (top is last element)
    cardsToDrop.forEach(c => this.discardPile.push(c));
    currentPlayer.droppedThisTurn = cardsToDrop;

    const rankText = cardsToDrop.map(c => c.rank).join(', ');
    this.lastAction = {
      type: 'DROP',
      playerId,
      playerName: currentPlayer.name,
      text: `${currentPlayer.name} dropped [${rankText}]`
    };

    // Transition to DRAW phase
    this.turnPhase = 'DRAW';
    return { success: true, cardsDropped: cardsToDrop };
  }

  /**
   * Slash (Match & Drop) Action:
   * When top discard matches rank in hand, player can SLASH it!
   * Drops matching card(s) and skips DRAW phase completely (hand shrinks!).
   */
  handleSlash(playerId, cardIds) {
    if (this.status !== 'PLAYING') return { success: false, message: 'Game is not active' };
    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer || currentPlayer.id !== playerId) {
      return { success: false, message: 'You can only slash on your turn' };
    }
    if (this.turnPhase !== 'DROP') {
      return { success: false, message: 'You have already dropped cards this turn' };
    }

    const topDiscard = this.discardPile[this.discardPile.length - 1];
    if (!topDiscard) {
      return { success: false, message: 'No discard card to slash' };
    }

    if (!Array.isArray(cardIds) || cardIds.length === 0) {
      return { success: false, message: 'Must select matching card(s) to slash' };
    }

    const cardsToSlash = [];
    for (const cid of cardIds) {
      const found = currentPlayer.hand.find(c => c.id === cid);
      if (!found) return { success: false, message: 'Card not in your hand' };
      cardsToSlash.push(found);
    }

    const targetRank = topDiscard.rank;
    const allMatch = cardsToSlash.every(c => c.rank === targetRank || (c.isWild && topDiscard.isWild));
    if (!allMatch) {
      return { success: false, message: `To slash, selected card(s) must match the top discard (${targetRank})!` };
    }

    // Remove from hand
    currentPlayer.hand = currentPlayer.hand.filter(c => !cardIds.includes(c.id));

    // Place onto discard pile
    cardsToSlash.forEach(c => this.discardPile.push(c));

    this.lastAction = {
      type: 'SLASH',
      playerId,
      playerName: currentPlayer.name,
      text: `⚡ ${currentPlayer.name} SLASHED the ${targetRank}! Dropped without drawing!`
    };

    // Slash skips DRAW phase completely! Advance turn immediately
    this.advanceTurn();
    return { success: true, slashedCards: cardsToSlash };
  }

  /**
   * Stop Game entirely (Admin / Table Creator)
   */
  stopGame(reason = 'Game stopped by table admin') {
    this.clearTurnTimer();
    this.status = 'LOBBY';
    this.roundNumber = 0;
    this.roundResults = null;
    this.drawPile = [];
    this.discardPile = [];
    this.wildJokerCard = null;
    this.wildJokerRank = null;
    this.players.forEach(p => {
      p.hand = [];
      p.score = 0;
      p.eliminated = false;
      p.waitingNextRound = false;
      p.droppedThisTurn = [];
    });
    this.lastAction = { type: 'STOPPED', text: reason };
    return { success: true };
  }

  /**
   * Draw a card from either the 'DECK' or the 'DISCARD' pile.
   */
  handleDraw(playerId, source = 'DECK') {
    if (this.status !== 'PLAYING') return { success: false, message: 'Game is not active' };
    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer || currentPlayer.id !== playerId) {
      return { success: false, message: 'Not your turn' };
    }
    if (this.turnPhase !== 'DRAW') {
      return { success: false, message: 'You must drop card(s) first before drawing' };
    }

    let drawnCard = null;

    if (source === 'DISCARD') {
      // Must leave at least the cards just dropped or have available card
      // In Least Count, you cannot pick what you just dropped yourself!
      const availableCards = this.discardPile.length - (currentPlayer.droppedThisTurn ? currentPlayer.droppedThisTurn.length : 0);
      if (availableCards <= 0) {
        return { success: false, message: 'Cannot draw from discard pile right now' };
      }
      
      // Draw top card from discard
      drawnCard = this.discardPile.pop();
    } else {
      // Draw from face-down deck
      this.ensureDrawPileHasCards();
      if (this.drawPile.length === 0) {
        return { success: false, message: 'Deck is empty and cannot be replenished' };
      }
      drawnCard = this.drawPile.pop();
    }

    if (drawnCard) {
      applyWildJokerToCard(drawnCard, this.wildJokerRank);
    }

    currentPlayer.hand.push(drawnCard);
    currentPlayer.droppedThisTurn = [];

    this.lastAction = {
      type: 'DRAW',
      playerId,
      playerName: currentPlayer.name,
      source,
      text: `${currentPlayer.name} drew a card from ${source === 'DISCARD' ? 'the discard pile' : 'the deck'}`
    };

    // Turn complete -> advance to next player
    this.advanceTurn();
    return { success: true, drawnCard };
  }

  /**
   * If draw pile gets low, recycle discard pile (preserving top card).
   */
  ensureDrawPileHasCards() {
    if (this.drawPile.length <= 1 && this.discardPile.length > 1) {
      const topDiscard = this.discardPile.pop();
      // Shuffle rest of discard pile into draw pile
      const recycled = [...this.discardPile];
      this.discardPile = [topDiscard];

      for (let i = recycled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [recycled[i], recycled[j]] = [recycled[j], recycled[i]];
      }
      this.drawPile.push(...recycled);
    }
  }

  /**
   * Calling "Show" (Declaration).
   * Caller claims they have the lowest score in hand!
   */
  handleCallShow(playerId) {
    if (this.status !== 'PLAYING') return { success: false, message: 'Game is not active' };
    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer || currentPlayer.id !== playerId) {
      return { success: false, message: 'You can only call Show on your turn' };
    }
    if (this.turnPhase !== 'DROP') {
      return { success: false, message: 'Must call Show before dropping cards' };
    }

    const callerScoreCheck = calculateHandScore(currentPlayer.hand);
    if (callerScoreCheck > 10) {
      return { success: false, message: 'You can only call Show when your total hand score is 10 or below!' };
    }

    this.clearTurnTimer();
    this.status = 'ROUND_OVER';

    // Calculate score for all active players
    const activePlayers = this.getActivePlayers();
    const scores = activePlayers.map(p => ({
      player: p,
      handScore: calculateHandScore(p.hand),
      hand: [...p.hand]
    }));

    const callerEntry = scores.find(s => s.player.id === playerId);
    const callerScore = callerEntry.handScore;

    // Check if anyone has a score <= caller
    const others = scores.filter(s => s.player.id !== playerId);
    const lowestOther = others.reduce((min, s) => s.handScore < min ? s.handScore : min, 9999);

    let isGoodShow = false;
    let penaltyPlayerId = null;
    let roundWinner = null;

    if (callerScore < lowestOther) {
      // Good Show: Caller strictly lowest!
      isGoodShow = true;
      roundWinner = callerEntry.player;
      callerEntry.roundPoints = 0;
      others.forEach(s => {
        s.roundPoints = s.handScore;
        s.player.score += s.handScore;
      });
    } else {
      // Bad Show (Wrong Show): Someone tied or beat the caller!
      isGoodShow = false;
      penaltyPlayerId = playerId;
      callerEntry.roundPoints = 40; // Flat 40 pt penalty
      callerEntry.player.score += 40;

      // Find the player(s) with true lowest
      const best = scores.reduce((min, s) => (s.player.id !== playerId && s.handScore < min) ? s.handScore : min, 9999);
      const trueLowest = others.find(s => s.handScore === best);
      roundWinner = trueLowest ? trueLowest.player : null;

      others.forEach(s => {
        if (s === trueLowest) {
          s.roundPoints = 0;
        } else {
          s.roundPoints = s.handScore;
          s.player.score += s.handScore;
        }
      });
    }

    // Check for eliminations (score >= eliminationScore)
    const newlyEliminated = [];
    this.players.forEach(p => {
      if (!p.eliminated && p.score >= this.eliminationScore) {
        p.eliminated = true;
        newlyEliminated.push(p);
      }
    });

    const remainingActive = this.getActivePlayers();
    let gameOver = false;
    let champion = null;

    if (remainingActive.length <= 1) {
      gameOver = true;
      this.status = 'GAME_OVER';
      champion = remainingActive[0] || null;
    }

    this.roundResults = {
      caller: {
        id: callerEntry.player.id,
        name: callerEntry.player.name,
        score: callerScore
      },
      isGoodShow,
      penaltyPlayerId,
      roundWinner: roundWinner ? { id: roundWinner.id, name: roundWinner.name } : null,
      details: scores.map(s => ({
        id: s.player.id,
        name: s.player.name,
        hand: s.hand,
        handScore: s.handScore,
        roundPoints: s.roundPoints,
        totalScore: s.player.score,
        eliminated: s.player.eliminated
      })),
      newlyEliminated: newlyEliminated.map(p => ({ id: p.id, name: p.name, score: p.score })),
      gameOver,
      champion: champion ? { id: champion.id, name: champion.name } : null
    };

    this.lastAction = {
      type: 'SHOW',
      isGoodShow,
      callerName: callerEntry.player.name,
      text: `${callerEntry.player.name} called SHOW! (${isGoodShow ? 'Good Show! 0 pts' : 'Bad Show! +40 Penalty'})`
    };

    return {
      success: true,
      roundResults: this.roundResults
    };
  }

  advanceTurn() {
    this.turnPhase = 'DROP';
    const total = this.players.length;
    let nextIdx = (this.currentTurnIndex + 1) % total;

    // Skip eliminated players
    let attempts = 0;
    while (this.players[nextIdx].eliminated && attempts < total) {
      nextIdx = (nextIdx + 1) % total;
      attempts++;
    }

    this.currentTurnIndex = nextIdx;
    this.startTurnTimer();
  }

  /**
   * Auto-play for timeouts or AFK.
   */
  autoPlayCurrentTurn() {
    const player = this.getCurrentPlayer();
    if (!player) return;

    if (this.turnPhase === 'DROP') {
      // Find highest card(s) and drop
      const sortedHand = [...player.hand].sort((a, b) => b.points - a.points);
      const cardToDrop = sortedHand[0];
      if (cardToDrop) {
        this.handleDrop(player.id, [cardToDrop.id]);
        // Also auto-draw immediately
        this.handleDraw(player.id, 'DECK');
      }
    } else if (this.turnPhase === 'DRAW') {
      this.handleDraw(player.id, 'DECK');
    }
  }

  /**
   * AI Bot Turn Decision Engine
   */
  decideBotMove(botPlayer) {
    if (this.status !== 'PLAYING') return null;
    if (this.getCurrentPlayer()?.id !== botPlayer.id) return null;

    const handScore = calculateHandScore(botPlayer.hand);

    // 1. Should bot call SHOW?
    // If hand is <= 7 points, or low round turn and <= 10 points with low variance
    if (this.turnPhase === 'DROP') {
      const shouldShow = handScore <= 6 || (handScore <= 8 && Math.random() < 0.6);
      if (shouldShow) {
        return { action: 'SHOW' };
      }

      // 2. Decide what to drop:
      // Group cards by rank to find multi-drop opportunities (e.g. drop 2 Kings = 26 pts!)
      const rankGroups = {};
      botPlayer.hand.forEach(c => {
        rankGroups[c.rank] = rankGroups[c.rank] || [];
        rankGroups[c.rank].push(c);
      });

      // Find the group that drops the maximum total points
      let bestGroup = null;
      let maxPoints = -1;

      for (const rank in rankGroups) {
        const group = rankGroups[rank];
        const groupPoints = group.reduce((sum, c) => sum + c.points, 0);
        if (groupPoints > maxPoints) {
          maxPoints = groupPoints;
          bestGroup = group;
        }
      }

      const cardIds = bestGroup ? bestGroup.map(c => c.id) : [botPlayer.hand[0].id];
      return { action: 'DROP', cardIds };
    }

    // 3. Decide what to draw:
    if (this.turnPhase === 'DRAW') {
      // Evaluate top discard card
      const topDiscard = this.discardPile[this.discardPile.length - 1];
      const canPickDiscard = topDiscard && !botPlayer.droppedThisTurn.some(c => c.id === topDiscard.id);

      if (canPickDiscard) {
        // Pick discard if it is an Ace/Joker or points <= 3 or matches a rank in hand to make a future set
        const matchesInHand = botPlayer.hand.some(c => c.rank === topDiscard.rank);
        if (topDiscard.points <= 3 || (matchesInHand && topDiscard.points <= 7)) {
          return { action: 'DRAW', source: 'DISCARD' };
        }
      }

      return { action: 'DRAW', source: 'DECK' };
    }

    return null;
  }

  endGame(reason) {
    this.clearTurnTimer();
    this.status = 'GAME_OVER';
    this.lastAction = { type: 'GAME_OVER', text: reason || 'Game over' };
  }

  /**
   * Sanitizes state for transmission over WebSockets.
   * Hides other players' hands to prevent client-side peeking!
   */
  getClientState(forPlayerId) {
    return {
      code: this.code,
      hostId: this.hostId,
      status: this.status,
      roundNumber: this.roundNumber,
      maxPlayers: this.maxPlayers,
      eliminationScore: this.eliminationScore,
      turnDuration: this.turnDuration,
      deckCountUsed: this.deckCountUsed,
      wildJokerCard: this.wildJokerCard,
      wildJokerRank: this.wildJokerRank,
      drawPileCount: this.drawPile.length,
      topDiscard: this.discardPile.length > 0 ? this.discardPile[this.discardPile.length - 1] : null,
      discardPileCount: this.discardPile.length,
      currentTurnPlayerId: this.getCurrentPlayer() ? this.getCurrentPlayer().id : null,
      currentTurnPlayerName: this.getCurrentPlayer() ? this.getCurrentPlayer().name : null,
      turnPhase: this.turnPhase,
      turnTimeRemaining: this.turnTimeRemaining,
      lastAction: this.lastAction,
      roundResults: this.roundResults,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        score: p.score,
        connected: p.connected !== false,
        waitingNextRound: p.waitingNextRound || false,
        cardCount: p.hand.length,
        eliminated: p.eliminated,
        // Only reveal the actual cards if it's the requested player or round is over
        hand: (p.id === forPlayerId || this.status === 'ROUND_OVER' || this.status === 'GAME_OVER')
          ? p.hand
          : p.hand.map(c => ({ id: c.id, rank: '?', suit: '?', points: 0 })),
        handScore: (p.id === forPlayerId || this.status === 'ROUND_OVER' || this.status === 'GAME_OVER')
          ? calculateHandScore(p.hand)
          : null
      }))
    };
  }
}

module.exports = GameRoom;
