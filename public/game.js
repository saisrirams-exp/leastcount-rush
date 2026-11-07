// Client Game Controller for Least Count Rush (6 to 15 Players)

const socket = io();

// Local State
// Isolated unique player ID per browser session/tab, persisting across page reloads and reconnects
let persistentPlayerId = sessionStorage.getItem('leastcount_user_id');
if (!persistentPlayerId) {
  persistentPlayerId = 'usr_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  sessionStorage.setItem('leastcount_user_id', persistentPlayerId);
}

let myPlayerId = persistentPlayerId;
let currentRoomCode = null;
let gameState = null;
let selectedCards = new Set(); // Set of card IDs selected in hand
let isHost = false;

// Touch Drag State for Mobile
let touchDraggedCardId = null;

// DOM Elements
const homeScreen = document.getElementById('homeScreen');
const lobbyScreen = document.getElementById('lobbyScreen');
const gameScreen = document.getElementById('gameScreen');
const createTableModal = document.getElementById('createTableModal');
const resultsModal = document.getElementById('resultsModal');

// Invite Link Elements
const inviteBlock = document.getElementById('inviteBlock');
const standardBlock = document.getElementById('standardBlock');
const inviteCodeLabel = document.getElementById('inviteCodeLabel');
const inviteJoinBtn = document.getElementById('inviteJoinBtn');
const showNormalHomeBtn = document.getElementById('showNormalHomeBtn');

const roomBadge = document.getElementById('roomBadge');
const roomBadgeCode = document.getElementById('roomBadgeCode');
const copyInviteBtn = document.getElementById('copyInviteBtn');
const copyInviteLinkBtn = document.getElementById('copyInviteLinkBtn');
const shareInviteBtn = document.getElementById('shareInviteBtn');
const exitTableBtn = document.getElementById('exitTableBtn');
const adminStopGameBtn = document.getElementById('adminStopGameBtn');
const openRulesBtn = document.getElementById('openRulesBtn');
const homeRulesBtn = document.getElementById('homeRulesBtn');
const rulesModal = document.getElementById('rulesModal');
const closeRulesBtn = document.getElementById('closeRulesBtn');
const heroAvatarDisplay = document.getElementById('heroAvatarDisplay');
const gameToast = document.getElementById('gameToast');

let toastTimer = null;
function showToast(msg, duration = 2400) {
  if (!gameToast) return;
  gameToast.innerText = msg;
  gameToast.style.display = 'block';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    gameToast.style.display = 'none';
  }, duration);
}

// Mobile Tactical Haptic Feedback (Vibration API)
function triggerHaptic(type = 'tap') {
  if (!navigator.vibrate) return;
  try {
    if (type === 'tap') navigator.vibrate(15);
    else if (type === 'drop') navigator.vibrate(25);
    else if (type === 'draw') navigator.vibrate(30);
    else if (type === 'slash') navigator.vibrate([40, 30, 60]);
    else if (type === 'show') navigator.vibrate([60, 40, 100]);
    else if (type === 'turn') navigator.vibrate([50, 40, 50]);
  } catch (e) {}
}

let selectedFaceScore = 'STANDARD_10';
let myAvatar = localStorage.getItem('leastcount_avatar') || '👑';
let lastTurnPlayerId = null;

// Global Hand Auto-Sort Preference (defaults to true)
let isAutoSortEnabled = localStorage.getItem('leastcount_autosort') !== 'false';

function sortCardsArray(cards, ascending = true) {
  if (!cards || !Array.isArray(cards)) return cards;

  const suitOrder = { '♣': 1, '♦': 2, '♥': 3, '♠': 4, '?': 5 };
  const getRankVal = (r) => {
    if (r === 'JOKER') return 0;
    if (r === 'A') return 1;
    if (r === 'J') return 11;
    if (r === 'Q') return 12;
    if (r === 'K') return 13;
    return parseInt(r, 10) || 0;
  };

  return cards.sort((a, b) => {
    // 1. Points (Jokers/Wild = 0 first, Aces = 1, ..., Kings = 13)
    const pA = (a.isWild || a.isJoker) ? 0 : (a.points !== undefined ? a.points : getRankVal(a.rank));
    const pB = (b.isWild || b.isJoker) ? 0 : (b.points !== undefined ? b.points : getRankVal(b.rank));
    if (pA !== pB) {
      return ascending ? pA - pB : pB - pA;
    }
    // 2. Rank numerical order (A < 2-10 < J < Q < K)
    const rvA = getRankVal(a.rank);
    const rvB = getRankVal(b.rank);
    if (rvA !== rvB) {
      return ascending ? rvA - rvB : rvB - rvA;
    }
    // 3. Group by suit
    return (suitOrder[a.suit] || 0) - (suitOrder[b.suit] || 0);
  });
}

const playerNameInput = document.getElementById('playerNameInput');
const joinCodeInput = document.getElementById('joinCodeInput');
const openCreateModalBtn = document.getElementById('openCreateModalBtn');
const cancelCreateModalBtn = document.getElementById('cancelCreateModalBtn');
const confirmCreateBtn = document.getElementById('confirmCreateBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');

// Create Settings Elements
const maxPlayersSlider = document.getElementById('maxPlayersSlider');
const playerSliderValue = document.getElementById('playerSliderValue');
const deckCapacityInfo = document.getElementById('deckCapacityInfo');
let selectedElimScore = 150;
let selectedTurnDuration = 12;

// Lobby Elements
const lobbyRoomCode = document.getElementById('lobbyRoomCode');
const lobbyCapacityLabel = document.getElementById('lobbyCapacityLabel');
const playerCountLabel = document.getElementById('playerCountLabel');
const maxCapacityLabel = document.getElementById('maxCapacityLabel');
const waitingPlayerList = document.getElementById('waitingPlayerList');
const hostLobbyControls = document.getElementById('hostLobbyControls');
const nonHostLobbyMessage = document.getElementById('nonHostLobbyMessage');
const addSingleBotBtn = document.getElementById('addSingleBotBtn');
const fillBotsBtn = document.getElementById('fillBotsBtn');
const startGameBtn = document.getElementById('startGameBtn');

// In-Game Elements (Left: Deck & Joker | Middle: Dotted Drop Box | Right: Discard Stack)
const arenaStadium = document.getElementById('arenaStadium');
const roundNumberBadge = document.getElementById('roundNumberBadge');
const deckShoeBadge = document.getElementById('deckShoeBadge');
const actionBanner = document.getElementById('actionBanner');
const eliminationScoreBadge = document.getElementById('eliminationScoreBadge');
const wildJokerSlot = document.getElementById('wildJokerSlot');
const drawPileBtn = document.getElementById('drawPileBtn');
const middleDottedDropBox = document.getElementById('middleDottedDropBox');
const middleDropPlaceholder = document.getElementById('middleDropPlaceholder');
const middleStagedCardContainer = document.getElementById('middleStagedCardContainer');
const returnStagedCardBtn = document.getElementById('returnStagedCardBtn');
const sortCardsBtn = document.getElementById('sortCardsBtn');
const discardStackPile = document.getElementById('discardStackPile');
const discardPileCardWrapper = document.getElementById('discardPileCardWrapper');
const deckCountBadge = document.getElementById('deckCountBadge');
const timerCircle = document.getElementById('timerCircle');
const turnGuidePrompt = document.getElementById('turnGuidePrompt');

// Hand Console Elements
const myHandPoints = document.getElementById('myHandPoints');
const myGameScore = document.getElementById('myGameScore');
const maxScoreTarget = document.getElementById('maxScoreTarget');
const turnStatusBadge = document.getElementById('turnStatusBadge');
const myHandCards = document.getElementById('myHandCards');
const dropCardsBtn = document.getElementById('dropCardsBtn');
const callShowBtn = document.getElementById('callShowBtn');
const callShowPoints = document.getElementById('callShowPoints');
const slashBtn = document.getElementById('slashBtn');
const slashRankText = document.getElementById('slashRankText');

// Staged drop cards in the middle box (pending draw to commit)
let stagedCards = [];

// Results Modal Elements
const resultsTitle = document.getElementById('resultsTitle');
const resultsSubtitle = document.getElementById('resultsSubtitle');
const resultsTableBody = document.getElementById('resultsTableBody');
const eliminatedNotice = document.getElementById('eliminatedNotice');
const hostNextRoundContainer = document.getElementById('hostNextRoundContainer');
const nonHostNextRoundMessage = document.getElementById('nonHostNextRoundMessage');
const nextRoundBtn = document.getElementById('nextRoundBtn');

// Helper: Save and load player name from localStorage
playerNameInput.value = localStorage.getItem('leastcount_player_name') || '';

// URL Room Code Auto-Fill & Dedicated Invite View
const urlParams = new URLSearchParams(window.location.search);
const inviteRoom = urlParams.get('room');
if (inviteRoom && inviteRoom.trim().length > 0) {
  const cleanCode = inviteRoom.toUpperCase().trim();
  joinCodeInput.value = cleanCode;
  if (inviteCodeLabel) inviteCodeLabel.innerText = cleanCode;

  // Only show invite screen if we are not already in this room
  if (sessionStorage.getItem('leastcount_current_room') !== cleanCode) {
    if (inviteBlock) inviteBlock.style.display = 'block';
    if (standardBlock) standardBlock.style.display = 'none';
  }
}

if (showNormalHomeBtn) {
  showNormalHomeBtn.addEventListener('click', () => {
    inviteBlock.style.display = 'none';
    standardBlock.style.display = 'block';
  });
}

if (inviteJoinBtn) {
  inviteJoinBtn.addEventListener('click', () => {
    let name = playerNameInput.value.trim();
    if (!name) {
      name = 'Player_' + Math.floor(100 + Math.random() * 900);
      playerNameInput.value = name;
    }
    const code = joinCodeInput.value.trim().toUpperCase();
    if (!code) {
      alert('Please enter a room code.');
      return;
    }
    localStorage.setItem('leastcount_player_name', name);
    sessionStorage.setItem('leastcount_current_room', code);

    socket.emit('joinRoom', {
      roomCode: code,
      playerId: persistentPlayerId,
      playerName: name,
      avatar: myAvatar
    });
  });
}

// -----------------------------------------------------------------------------
// SETTINGS SLIDER & PILL CONTROLS (6 to 15 Players)
// -----------------------------------------------------------------------------
function updateDeckCapacityLabel(playerCount) {
  playerSliderValue.innerText = `${playerCount} Players`;
  if (playerCount <= 7) {
    deckCapacityInfo.innerHTML = `🃏 <strong>2 Decks Shoe</strong> (108 cards with Jokers)`;
  } else if (playerCount <= 11) {
    deckCapacityInfo.innerHTML = `🃏 <strong>3 Decks Shoe</strong> (162 cards with Jokers)`;
  } else {
    deckCapacityInfo.innerHTML = `🃏 <strong>4 Decks Shoe</strong> (216 cards with Jokers)`;
  }
}

maxPlayersSlider.addEventListener('input', (e) => {
  updateDeckCapacityLabel(parseInt(e.target.value, 10));
});

// Elimination score pill selection
document.querySelectorAll('#elimScorePills .pill-opt').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('#elimScorePills .pill-opt').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    selectedElimScore = parseInt(pill.dataset.val, 10);
    triggerHaptic('tap');
  });
});

// Turn timer speed pill selection
document.querySelectorAll('#turnTimerPills .pill-opt').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('#turnTimerPills .pill-opt').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    selectedTurnDuration = parseInt(pill.dataset.val, 10);
    triggerHaptic('tap');
  });
});

// Face card scoring mode pill selection
document.querySelectorAll('#faceScorePills .pill-opt').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('#faceScorePills .pill-opt').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    selectedFaceScore = pill.dataset.val;
    triggerHaptic('tap');
  });
});

// Rules Modal open & close
function openRules() {
  if (rulesModal) rulesModal.style.display = 'flex';
  triggerHaptic('tap');
}
function closeRules() {
  if (rulesModal) rulesModal.style.display = 'none';
  triggerHaptic('tap');
}
if (openRulesBtn) openRulesBtn.addEventListener('click', openRules);
if (homeRulesBtn) homeRulesBtn.addEventListener('click', openRules);
if (closeRulesBtn) closeRulesBtn.addEventListener('click', closeRules);

// Avatar Selection & Persistence
if (heroAvatarDisplay) heroAvatarDisplay.innerText = myAvatar;
document.querySelectorAll('#avatarSelector .avatar-opt').forEach(opt => {
  if (opt.dataset.avatar === myAvatar) {
    document.querySelectorAll('#avatarSelector .avatar-opt').forEach(o => o.classList.remove('active'));
    opt.classList.add('active');
  }
  opt.addEventListener('click', () => {
    document.querySelectorAll('#avatarSelector .avatar-opt').forEach(o => o.classList.remove('active'));
    opt.classList.add('active');
    myAvatar = opt.dataset.avatar;
    localStorage.setItem('leastcount_avatar', myAvatar);
    if (heroAvatarDisplay) heroAvatarDisplay.innerText = myAvatar;
    triggerHaptic('tap');
    showToast(`Avatar selected: ${myAvatar}`);
  });
});

// -----------------------------------------------------------------------------
// NAVIGATION, EXIT, & ADMIN STOP GAME
// -----------------------------------------------------------------------------
openCreateModalBtn.addEventListener('click', () => {
  createTableModal.style.display = 'flex';
});

cancelCreateModalBtn.addEventListener('click', () => {
  createTableModal.style.display = 'none';
});

if (joinCodeInput) {
  joinCodeInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  });
}

function copyInvite() {
  if (!currentRoomCode) return;
  const link = `${window.location.origin}/?room=${currentRoomCode}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).then(() => {
      showToast(`📋 Table link copied: ${link}`);
    }).catch(() => {
      prompt('Copy invite link:', link);
    });
  } else {
    prompt('Copy invite link:', link);
  }
}

copyInviteBtn.addEventListener('click', copyInvite);
copyInviteLinkBtn.addEventListener('click', copyInvite);

if (shareInviteBtn) {
  shareInviteBtn.addEventListener('click', () => {
    if (!currentRoomCode) return;
    const link = `${window.location.origin}/?room=${currentRoomCode}`;
    const shareData = {
      title: 'Least Count Rush',
      text: `🃏 Join my Least Count card table! Table Code: ${currentRoomCode}`,
      url: link
    };
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      navigator.share(shareData).catch(() => copyInvite());
    } else {
      copyInvite();
    }
  });
}

// Exit Table Option
exitTableBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to leave this table and return to the main menu?')) {
    socket.emit('leaveRoom');
  }
});

// Admin Stop Game Option
adminStopGameBtn.addEventListener('click', () => {
  if (confirm('⚠️ ADMIN ACTION:\n\nAre you sure you want to STOP the game entirely for all players? Everyone will return to the lobby.')) {
    socket.emit('stopGame');
  }
});

socket.on('leftRoom', () => {
  currentRoomCode = null;
  sessionStorage.removeItem('leastcount_current_room');
  gameState = null;
  selectedCards.clear();
  
  roomBadge.style.display = 'none';
  lobbyScreen.style.display = 'none';
  gameScreen.style.display = 'none';
  resultsModal.style.display = 'none';
  homeScreen.style.display = 'flex';

  // Clean URL query
  window.history.replaceState(null, '', window.location.pathname);
});

// -----------------------------------------------------------------------------
// SOCKET EVENT EMITTERS
// -----------------------------------------------------------------------------
confirmCreateBtn.addEventListener('click', () => {
  let name = playerNameInput.value.trim();
  if (!name) {
    name = 'Host_' + Math.floor(100 + Math.random() * 900);
    playerNameInput.value = name;
  }
  localStorage.setItem('leastcount_player_name', name);
  const maxP = parseInt(maxPlayersSlider.value, 10);

  socket.emit('createRoom', {
    playerId: persistentPlayerId,
    playerName: name,
    avatar: myAvatar,
    settings: {
      maxPlayers: maxP,
      eliminationScore: selectedElimScore,
      turnDuration: selectedTurnDuration,
      faceCardScoring: selectedFaceScore
    }
  });

  createTableModal.style.display = 'none';
});

joinRoomBtn.addEventListener('click', () => {
  let name = playerNameInput.value.trim();
  if (!name) {
    name = 'Player_' + Math.floor(100 + Math.random() * 900);
    playerNameInput.value = name;
  }
  const code = joinCodeInput.value.trim().toUpperCase();
  if (!code) {
    alert('Please enter a 5-letter room code.');
    return;
  }
  localStorage.setItem('leastcount_player_name', name);
  sessionStorage.setItem('leastcount_current_room', code);

  socket.emit('joinRoom', {
    roomCode: code,
    playerId: persistentPlayerId,
    playerName: name,
    avatar: myAvatar
  });
});

addSingleBotBtn.addEventListener('click', () => {
  socket.emit('addBot');
});

fillBotsBtn.addEventListener('click', () => {
  socket.emit('fillBots');
});

startGameBtn.addEventListener('click', () => {
  socket.emit('startGame');
});

nextRoundBtn.addEventListener('click', () => {
  socket.emit('nextRound');
  resultsModal.style.display = 'none';
});

// -----------------------------------------------------------------------------
// CARD INTERACTION: SELECTION & DRAG-AND-DROP INTO MIDDLE DOTTED BOX
// -----------------------------------------------------------------------------
function toggleCardSelection(cardId) {
  if (!gameState) return;
  const isMyTurn = gameState.currentTurnPlayerId === myPlayerId;
  const isDropPhase = isMyTurn && gameState.turnPhase === 'DROP';

  // If a card is ALREADY staged in the middle box:
  // Tapping another card in hand allows instant swapping!
  if (stagedCards.length > 0 && isDropPhase) {
    stageCardsInMiddle([cardId]);
    showToast('Swapped card in drop zone 🔄');
    return;
  }

  if (selectedCards.has(cardId)) {
    // If tapping an already selected card on drop turn: stage it into middle box!
    if (isDropPhase) {
      stageCardsInMiddle(Array.from(selectedCards));
      return;
    }
    selectedCards.delete(cardId);
  } else {
    // If selecting multiple cards, ensure they have the same rank!
    const myPlayer = gameState?.players.find(p => p.id === myPlayerId);
    if (myPlayer) {
      const targetCard = myPlayer.hand.find(c => c.id === cardId);
      if (selectedCards.size > 0 && targetCard) {
        const firstSelectedId = Array.from(selectedCards)[0];
        const firstCard = myPlayer.hand.find(c => c.id === firstSelectedId);
        if (firstCard && firstCard.rank !== targetCard.rank) {
          // Reset selection to just this new card
          selectedCards.clear();
        }
      }
    }
    selectedCards.add(cardId);
  }
  updateHandUI();
  updateActionUI();
}

// -----------------------------------------------------------------------------
// STAGE CARDS IN MIDDLE DOTTED BOX (CAN CHANGE / REVERT FREELY BEFORE DRAWING)
// -----------------------------------------------------------------------------
function stageCardsInMiddle(cardIdsToStage) {
  if (!gameState) return;
  const isMyTurn = gameState.currentTurnPlayerId === myPlayerId;
  if (!isMyTurn || gameState.turnPhase !== 'DROP') return;

  const myPlayer = gameState.players.find(p => p.id === myPlayerId);
  if (!myPlayer) return;

  const cards = [];
  for (const cid of cardIdsToStage) {
    const found = myPlayer.hand.find(c => c.id === cid);
    if (found) cards.push(found);
  }
  if (cards.length === 0) return;

  // Validate rank matching
  const firstRank = cards[0].rank;
  const firstIsWild = cards[0].isWild;
  const allMatch = cards.every(c => c.rank === firstRank || (c.isWild && firstIsWild));
  if (!allMatch) {
    showToast('⚠️ Multiple cards dropped must have the same rank!');
    return;
  }

  stagedCards = cards;
  selectedCards.clear();
  window.soundFx.playCardDrop();

  updateHandUI();
  updateActionUI();
  showToast('Card in drop zone! Tap Left Deck or Right Discard to draw 🂠');
}

function unstageCards() {
  if (stagedCards.length === 0) return;
  stagedCards = [];
  selectedCards.clear();
  window.soundFx.playCardDraw();

  updateHandUI();
  updateActionUI();
  showToast('Card returned to hand ↩️');
}

// Click on middle dotted box:
// - If already staged: returns card to hand so player can change mind!
// - If not staged: drops selected cards into middle box
middleDottedDropBox.addEventListener('click', () => {
  if (!gameState) return;
  const isMyTurn = gameState.currentTurnPlayerId === myPlayerId;
  if (!isMyTurn || gameState.turnPhase !== 'DROP') return;

  if (stagedCards.length > 0) {
    unstageCards();
  } else if (selectedCards.size > 0) {
    stageCardsInMiddle(Array.from(selectedCards));
  } else {
    showToast('Select or drag a card from your hand into this box first');
  }
});

if (returnStagedCardBtn) {
  returnStagedCardBtn.addEventListener('click', unstageCards);
}

// Fallback click on drop button in controls
dropCardsBtn.addEventListener('click', () => {
  if (selectedCards.size > 0) {
    stageCardsInMiddle(Array.from(selectedCards));
  }
});

// -----------------------------------------------------------------------------
// MIDDLE DOTTED DROP BOX (DRAG AND DROP)
// -----------------------------------------------------------------------------
middleDottedDropBox.addEventListener('dragover', (e) => {
  if (!gameState) return;
  const isMyTurn = gameState.currentTurnPlayerId === myPlayerId;
  if (isMyTurn && gameState.turnPhase === 'DROP') {
    e.preventDefault();
    middleDottedDropBox.classList.add('drag-over');
  }
});

middleDottedDropBox.addEventListener('dragleave', () => {
  middleDottedDropBox.classList.remove('drag-over');
});

middleDottedDropBox.addEventListener('drop', (e) => {
  e.preventDefault();
  middleDottedDropBox.classList.remove('drag-over');

  const cardId = e.dataTransfer.getData('text/plain');
  if (cardId) {
    if (selectedCards.has(cardId) && selectedCards.size > 1) {
      stageCardsInMiddle(Array.from(selectedCards));
    } else {
      stageCardsInMiddle([cardId]);
    }
  }
});

// -----------------------------------------------------------------------------
// CARD DRAW: DIRECT TAP ON LEFT DRAW DECK OR RIGHT DISCARD PILE
// -----------------------------------------------------------------------------
drawPileBtn.addEventListener('click', () => {
  if (!gameState) return;
  const isMyTurn = gameState.currentTurnPlayerId === myPlayerId;
  if (!isMyTurn) return;

  // Staged drop ready -> Commit atomic drop & draw from DECK!
  if (stagedCards.length > 0) {
    const dropIds = stagedCards.map(c => c.id);
    stagedCards = [];
    socket.emit('dropAndDraw', { dropCardIds: dropIds, source: 'DECK' });
    window.soundFx.playCardDraw();
  } else if (gameState.turnPhase === 'DRAW') {
    socket.emit('drawCard', { source: 'DECK' });
    window.soundFx.playCardDraw();
  } else {
    showToast('👉 Place your card into the Middle Drop Box first!');
  }
});

discardStackPile.addEventListener('click', () => {
  if (!gameState) return;
  const isMyTurn = gameState.currentTurnPlayerId === myPlayerId;
  if (!isMyTurn) return;

  // Staged drop ready -> Commit atomic drop & pick PREVIOUS discard!
  if (stagedCards.length > 0) {
    const dropIds = stagedCards.map(c => c.id);
    stagedCards = [];
    socket.emit('dropAndDraw', { dropCardIds: dropIds, source: 'DISCARD' });
    window.soundFx.playCardDraw();
  } else if (gameState.turnPhase === 'DRAW') {
    socket.emit('drawCard', { source: 'DISCARD' });
    window.soundFx.playCardDraw();
  } else {
    // Check if player has matching card to slash
    const myPlayer = gameState.players.find(p => p.id === myPlayerId);
    const topDiscard = gameState.topDiscard;
    if (myPlayer && topDiscard) {
      const hasMatch = myPlayer.hand.some(c => c.rank === topDiscard.rank || (c.isWild && topDiscard.isWild));
      if (hasMatch) {
        executeSlash();
        return;
      }
    }
    showToast('👉 Place your card into the Middle Drop Box first!');
  }
});

// -----------------------------------------------------------------------------
// SLASH (MATCH & DROP): DROPS MATCHING CARD WITHOUT DRAWING!
// -----------------------------------------------------------------------------
function executeSlash() {
  if (!gameState || !gameState.topDiscard) return;
  const myPlayer = gameState.players.find(p => p.id === myPlayerId);
  if (!myPlayer) return;

  const targetRank = gameState.topDiscard.rank;
  const matchingCards = myPlayer.hand.filter(c => c.rank === targetRank || (c.isWild && gameState.topDiscard.isWild));
  if (matchingCards.length === 0) {
    showToast(`No card in your hand matches the top discard (${targetRank}) to slash.`);
    return;
  }

  const cardIds = matchingCards.map(c => c.id);
  stagedCards = [];
  selectedCards.clear();
  socket.emit('slashCards', { cardIds });
  window.soundFx.playSlash();
  showToast(`⚡ SLASHED ${targetRank}! Dropped without drawing!`);
}

slashBtn.addEventListener('click', executeSlash);

// -----------------------------------------------------------------------------
// AUTO-SORT HAND (ASCENDING ORDER)
// -----------------------------------------------------------------------------
function sortMyHand(ascending = true) {
  isAutoSortEnabled = true;
  localStorage.setItem('leastcount_autosort', 'true');
  if (!gameState) return;
  const myPlayer = gameState.players.find(p => p.id === myPlayerId);
  if (!myPlayer || !myPlayer.hand) return;

  sortCardsArray(myPlayer.hand, ascending);
  window.soundFx.playCardDraw();
  showToast('🃏 Hand sorted in ascending order (0 ➔ K)');
  updateHandUI();
}

if (sortCardsBtn) {
  sortCardsBtn.addEventListener('click', () => sortMyHand(true));
}

// -----------------------------------------------------------------------------
// CALL SHOW: ONLY APPEARS WHEN HAND SCORE IS 10 OR BELOW
// -----------------------------------------------------------------------------
callShowBtn.addEventListener('click', () => {
  const myPlayer = gameState?.players.find(p => p.id === myPlayerId);
  const myScore = myPlayer?.handScore || 0;

  if (myScore > 10) {
    alert('You can only call SHOW when your hand total is 10 or below!');
    return;
  }

  const confirmMsg = `Declare SHOW with ${myScore} points?\n\nIf you have the lowest hand at the table, you score 0!\nIf anyone ties or beats you, you take a +40 penalty!`;
  if (confirm(confirmMsg)) {
    socket.emit('callShow');
  }
});

// -----------------------------------------------------------------------------
// SOCKET LISTENERS & STATE HANDLING
// -----------------------------------------------------------------------------
// Automatically reconnect/rejoin if connection was interrupted or page was refreshed
socket.on('connect', () => {
  const savedRoom = currentRoomCode || sessionStorage.getItem('leastcount_current_room');
  if (savedRoom) {
    const savedName = localStorage.getItem('leastcount_player_name') || 'Player';
    socket.emit('joinRoom', {
      roomCode: savedRoom,
      playerId: persistentPlayerId,
      playerName: savedName
    });
  }
});

socket.on('roomJoined', (data) => {
  myPlayerId = data.playerId || persistentPlayerId;
  persistentPlayerId = myPlayerId;
  sessionStorage.setItem('leastcount_user_id', persistentPlayerId);
  currentRoomCode = data.roomCode;
  sessionStorage.setItem('leastcount_current_room', data.roomCode);

  roomBadge.style.display = 'flex';
  exitTableBtn.style.display = 'inline-block';
  roomBadgeCode.innerText = data.roomCode;
  lobbyRoomCode.innerText = data.roomCode;

  const newUrl = `${window.location.pathname}?room=${data.roomCode}`;
  window.history.replaceState(null, '', newUrl);

  renderGameState(data.state);
});

socket.on('gameState', (state) => {
  renderGameState(state);
});

socket.on('turnTimerTick', ({ turnTimeRemaining, currentTurnPlayerId }) => {
  timerCircle.innerText = turnTimeRemaining;
  if (turnTimeRemaining <= 3) {
    timerCircle.classList.add('danger');
    if (currentTurnPlayerId === persistentPlayerId) {
      window.soundFx.playTimerTick();
    }
  } else {
    timerCircle.classList.remove('danger');
  }
});

socket.on('roomError', (msg) => {
  sessionStorage.removeItem('leastcount_current_room');
  alert(`Error: ${msg}`);
  if (lobbyScreen.style.display !== 'none' || gameScreen.style.display !== 'none') {
    lobbyScreen.style.display = 'none';
    gameScreen.style.display = 'none';
    homeScreen.style.display = 'flex';
  }
});

socket.on('actionError', (msg) => {
  alert(msg);
});

// -----------------------------------------------------------------------------
// RENDER UI FROM STATE
// -----------------------------------------------------------------------------
function renderGameState(state) {
  gameState = state;
  myPlayerId = persistentPlayerId;
  isHost = state.hostId === persistentPlayerId;

  // Auto-sort hand in ascending order (0 pts Wilds/Jokers ➔ A ➔ 2-10 ➔ J, Q, K)
  const myPlayer = state.players.find(p => p.id === myPlayerId);
  if (myPlayer && myPlayer.hand && isAutoSortEnabled) {
    sortCardsArray(myPlayer.hand, true);
  }

  // Header controls
  adminStopGameBtn.style.display = isHost && state.status === 'PLAYING' ? 'inline-block' : 'none';
  exitTableBtn.style.display = 'inline-block';

  if (state.status === 'LOBBY') {
    homeScreen.style.display = 'none';
    gameScreen.style.display = 'none';
    lobbyScreen.style.display = 'flex';
    resultsModal.style.display = 'none';

    renderLobby(state);
  } else if (state.status === 'PLAYING') {
    homeScreen.style.display = 'none';
    lobbyScreen.style.display = 'none';
    gameScreen.style.display = 'flex';
    resultsModal.style.display = 'none';

    renderGameTable(state);
  } else if (state.status === 'ROUND_OVER' || state.status === 'GAME_OVER') {
    renderGameTable(state);
    showResultsModal(state.roundResults, state.status === 'GAME_OVER');
  }
}

// 1. Render Lobby
function renderLobby(state) {
  playerCountLabel.innerText = state.players.length;
  maxCapacityLabel.innerText = state.maxPlayers;
  const scoringName = state.faceCardScoring === 'CLASSIC_13' ? 'Classic (10-13)' : 'Standard (10s)';
  lobbyCapacityLabel.innerText = `Supports ${state.maxPlayers} Players • ${state.deckCountUsed} Decks • ${scoringName} • Knockout at ${state.eliminationScore} pts`;

  waitingPlayerList.innerHTML = '';
  state.players.forEach(p => {
    const chip = document.createElement('div');
    chip.className = 'waiting-player-chip';

    const avatar = p.isBot ? '🤖' : (p.avatar || (p.id === state.hostId ? '👑' : '👤'));
    const role = p.id === state.hostId ? 'HOST' : (p.isBot ? 'BOT' : 'PLAYER');

    chip.innerHTML = `
      <div class="avatar">${avatar}</div>
      <div class="name" title="${p.name}">${p.name}</div>
      <div class="role-tag">${role}</div>
      ${isHost && p.isBot ? `<button class="btn-kick" title="Remove Bot" onclick="socket.emit('removeBot', '${p.id}')">✕</button>` : ''}
    `;
    waitingPlayerList.appendChild(chip);
  });

  if (isHost) {
    hostLobbyControls.style.display = 'block';
    nonHostLobbyMessage.style.display = 'none';

    addSingleBotBtn.style.display = state.players.length >= state.maxPlayers ? 'none' : 'block';
    fillBotsBtn.style.display = state.players.length >= state.maxPlayers ? 'none' : 'block';
    startGameBtn.disabled = state.players.length < 2;
    startGameBtn.innerText = state.players.length < 2
      ? `Add at least 1 more player/bot to start (${state.players.length}/${state.maxPlayers})`
      : `Start Game (${state.players.length} Players)`;
  } else {
    hostLobbyControls.style.display = 'none';
    nonHostLobbyMessage.style.display = 'block';
  }
}

// 2. Render In-Game Table & 6 to 15 Player Arena
function renderGameTable(state) {
  roundNumberBadge.innerText = state.roundNumber;
  const scoringBadge = state.faceCardScoring === 'CLASSIC_13' ? 'Classic 10-13' : 'Standard 10s';
  deckShoeBadge.innerText = `(${state.deckCountUsed} Decks • ${scoringBadge})`;
  eliminationScoreBadge.innerText = state.eliminationScore;
  maxScoreTarget.innerText = state.eliminationScore;

  if (state.lastAction) {
    actionBanner.innerText = state.lastAction.text;
  }

  deckCountBadge.innerText = state.drawPileCount;
  timerCircle.innerText = state.turnTimeRemaining;

  // LEFT: Render Single Wild Joker Card Displayed at start of the game
  if (state.wildJokerCard) {
    wildJokerSlot.innerHTML = createCardInner(state.wildJokerCard, true);
    wildJokerSlot.className = `card-pile single-card wild-joker-card ${state.wildJokerCard.color}`;
  } else {
    wildJokerSlot.innerHTML = `<div style="margin:auto; font-size:11px; opacity:0.5;">No Joker</div>`;
  }

  // RIGHT: Render Discard Stack (Where dropped cards are shown like in the game!)
  if (state.topDiscard) {
    discardPileCardWrapper.innerHTML = createCardHTML(state.topDiscard, false);
  } else {
    discardPileCardWrapper.innerHTML = `<div class="single-card" style="opacity:0.3; justify-content:center; align-items:center;">Empty</div>`;
  }

  // TOP: Render Top Stadium (6 to 15 Players)
  arenaStadium.innerHTML = '';
  state.players.forEach(p => {
    const isCurrentTurn = p.id === state.currentTurnPlayerId;
    const isMe = p.id === myPlayerId;
    const badge = document.createElement('div');
    badge.className = `stadium-badge ${isCurrentTurn ? 'active-turn' : ''} ${p.eliminated ? 'eliminated' : ''}`;

    const icon = p.eliminated ? '💀' : (p.isBot ? '🤖' : (p.avatar || (isMe ? '⭐' : '👤')));

    badge.innerHTML = `
      ${isCurrentTurn ? '<div class="turn-indicator"></div>' : ''}
      <div style="font-size:16px;">${icon}</div>
      <div class="p-name">${p.name}${isMe ? ' (You)' : ''}</div>
      <div class="p-stats">
        <span class="p-cards">${p.waitingNextRound ? 'Spectating' : `🂠 ${p.cardCount}`}</span>
        <span class="p-score">${p.score} pts</span>
      </div>
    `;
    arenaStadium.appendChild(badge);
  });

  // Render My Hand & Update Table Direct Interaction cues
  const myPlayer = state.players.find(p => p.id === myPlayerId);
  if (myPlayer) {
    myGameScore.innerText = myPlayer.score;
    myHandPoints.innerText = myPlayer.waitingNextRound ? 'Spectating' : (myPlayer.handScore !== null ? myPlayer.handScore : '--');

    updateHandUI();
    updateActionUI();
  }
}

function calculateHandScore(cards) {
  if (!cards || cards.length === 0) return 0;
  return cards.reduce((sum, c) => sum + (c.isWild || c.isJoker ? 0 : (c.points || 0)), 0);
}

function createCardHTML(card, isSelected) {
  return `
    <div class="single-card ${card.color} ${isSelected ? 'selected' : ''} ${card.isWild ? 'wild-joker-card' : ''}">
      ${createCardInner(card, false)}
    </div>
  `;
}

function createCardInner(card, isTableJoker = false) {
  if (card.rank === '?') {
    return `
      <div style="margin:auto; font-size:24px; color:#aaa;">🂠</div>
    `;
  }

  const suitIcon = card.suit;
  const isJoker = card.isJoker || card.isWild;

  return `
    <div class="card-corner">
      <div>${card.rank}</div>
      <div style="font-size:10px;">${card.isJoker ? '★' : suitIcon}</div>
    </div>
    <div class="card-points-badge">${card.points} pts</div>
    <div class="card-center-suit">${card.isJoker ? '🃏' : suitIcon}</div>
    ${isTableJoker || card.isWild ? `<div class="wild-joker-badge">★ WILD (0 pts)</div>` : ''}
    <div class="card-corner" style="transform: rotate(180deg);">
      <div>${card.rank}</div>
      <div style="font-size:10px;">${card.isJoker ? '★' : suitIcon}</div>
    </div>
  `;
}

function renderMiddleDropBox(isMyTurn, turnPhase) {
  if (stagedCards.length > 0) {
    middleDropPlaceholder.style.display = 'none';
    middleStagedCardContainer.style.display = 'flex';
    middleStagedCardContainer.style.flexDirection = 'column';
    middleStagedCardContainer.style.alignItems = 'center';
    middleStagedCardContainer.style.justifyContent = 'center';
    middleDottedDropBox.className = 'middle-drop-box has-staged';

    const card = stagedCards[0];
    const multiCount = stagedCards.length > 1 ? ` (${stagedCards.length}x)` : '';
    middleStagedCardContainer.innerHTML = `
      <div class="staged-badge">READY TO DROP${multiCount}</div>
      <div class="single-card ${card.color} ${card.isWild ? 'wild-joker-card' : ''}" style="width:100%; height:100%; pointer-events:none; margin:0; box-shadow:none;">
        ${createCardInner(card, false)}
      </div>
      <div class="staged-return-hint">↩️ Tap to change</div>
    `;
    if (returnStagedCardBtn) returnStagedCardBtn.style.display = 'inline-flex';
  } else {
    middleDropPlaceholder.style.display = 'flex';
    middleStagedCardContainer.style.display = 'none';
    middleStagedCardContainer.innerHTML = '';
    if (returnStagedCardBtn) returnStagedCardBtn.style.display = 'none';

    if (isMyTurn && turnPhase === 'DROP') {
      middleDottedDropBox.className = 'middle-drop-box active-drop';
    } else {
      middleDottedDropBox.className = 'middle-drop-box';
    }
  }
}

function updateHandUI() {
  if (!gameState) return;
  const myPlayer = gameState.players.find(p => p.id === myPlayerId);
  if (!myPlayer) return;

  if (myPlayer.hand && isAutoSortEnabled) {
    sortCardsArray(myPlayer.hand, true);
  }

  if (myPlayer.waitingNextRound) {
    myHandCards.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 18px; text-align: center; background: rgba(0,0,0,0.35); border-radius: 14px; border: 1.5px dashed rgba(245,197,66,0.4); margin: 6px auto; max-width: 500px;">
        <div style="font-size: 16px; font-weight: bold; color: var(--gold); margin-bottom: 4px;">⏳ Spectating Round ${gameState.roundNumber}</div>
        <div style="color: rgba(253,250,243,0.85); font-size: 12px;">You will be dealt 5 cards automatically as soon as Round ${gameState.roundNumber + 1} begins!</div>
      </div>
    `;
    return;
  }

  const isMyTurn = gameState.currentTurnPlayerId === myPlayerId;
  const isDropPhase = isMyTurn && gameState.turnPhase === 'DROP';

  // If a card is currently staged in the middle box, filter it out from hand display
  const visibleHand = myPlayer.hand.filter(c => !stagedCards.some(sc => sc.id === c.id));
  myHandPoints.innerText = stagedCards.length > 0 ? calculateHandScore(visibleHand) : (myPlayer.handScore !== null ? myPlayer.handScore : '--');

  myHandCards.innerHTML = '';
  visibleHand.forEach(card => {
    const isSelected = selectedCards.has(card.id);
    const cardEl = document.createElement('div');
    cardEl.className = `hand-card single-card ${card.color} ${isSelected ? 'selected' : ''} ${card.isWild ? 'wild-joker-card' : ''}`;
    cardEl.innerHTML = createCardInner(card, false);

    // Tap / Click to select or double-tap to stage
    cardEl.addEventListener('click', () => toggleCardSelection(card.id));

    // Enable HTML5 Drag & Drop on your turn
    if (isDropPhase) {
      cardEl.setAttribute('draggable', 'true');
      cardEl.addEventListener('dragstart', (e) => {
        cardEl.classList.add('dragging');
        e.dataTransfer.setData('text/plain', card.id);
      });

      cardEl.addEventListener('dragend', () => {
        cardEl.classList.remove('dragging');
        middleDottedDropBox.classList.remove('drag-over');
      });

      // Mobile Touch Drag Support
      cardEl.addEventListener('touchstart', (e) => {
        touchDraggedCardId = card.id;
      }, { passive: true });

      cardEl.addEventListener('touchend', (e) => {
        if (!touchDraggedCardId) return;
        const touch = e.changedTouches[0];
        const elemUnder = document.elementFromPoint(touch.clientX, touch.clientY);

        // Dragged into middle dotted box: stage card!
        if (elemUnder && (elemUnder === middleDottedDropBox || middleDottedDropBox.contains(elemUnder))) {
          if (selectedCards.has(touchDraggedCardId) && selectedCards.size > 1) {
            stageCardsInMiddle(Array.from(selectedCards));
          } else {
            stageCardsInMiddle([touchDraggedCardId]);
          }
        }
        // Dragged onto discard pile: if matches top discard rank, auto-slash!
        else if (elemUnder && (elemUnder === discardStackPile || discardStackPile.contains(elemUnder))) {
          const topDiscard = gameState?.topDiscard;
          const draggedCard = myPlayer.hand.find(c => c.id === touchDraggedCardId);
          if (topDiscard && draggedCard && (draggedCard.rank === topDiscard.rank || (draggedCard.isWild && topDiscard.isWild))) {
            executeSlash();
          }
        }
        touchDraggedCardId = null;
      });
    }

    myHandCards.appendChild(cardEl);
  });
}

function updateActionUI() {
  if (!gameState) return;
  const isMyTurn = gameState.currentTurnPlayerId === myPlayerId;
  const turnPhase = gameState.turnPhase;
  const myPlayer = gameState.players.find(p => p.id === myPlayerId);

  // Reset interactive pile classes
  drawPileBtn.classList.remove('can-draw');
  discardStackPile.classList.remove('can-draw');

  renderMiddleDropBox(isMyTurn, turnPhase);

  if (!isMyTurn || myPlayer?.eliminated || myPlayer?.waitingNextRound) {
    lastTurnPlayerId = null;
    stagedCards = [];
    renderMiddleDropBox(false, turnPhase);

    turnStatusBadge.className = 'turn-status-badge';
    if (myPlayer?.waitingNextRound) {
      turnStatusBadge.innerText = 'Spectating this round 👁️';
      turnGuidePrompt.innerText = `Round ${gameState.roundNumber} in progress. You'll be dealt cards when Round ${gameState.roundNumber + 1} begins!`;
    } else {
      turnStatusBadge.innerText = myPlayer?.eliminated ? 'Eliminated 💀' : `Waiting for ${gameState.currentTurnPlayerName}…`;
      turnGuidePrompt.innerText = `It is currently ${gameState.currentTurnPlayerName}'s turn. Cards appear on the right discard stack as they play.`;
    }

    callShowBtn.style.display = 'none';
    slashBtn.style.display = 'none';
    dropCardsBtn.style.display = 'none';
    return;
  }

  // IT IS MY TURN!
  if (lastTurnPlayerId !== myPlayerId) {
    triggerHaptic('turn');
    lastTurnPlayerId = myPlayerId;
  }
  turnStatusBadge.className = 'turn-status-badge my-turn';

  // 1. If card is staged in middle box: pick a card from LEFT deck or RIGHT discard to finish turn!
  if (stagedCards.length > 0) {
    turnStatusBadge.innerText = 'YOUR TURN: Pick a Card';
    turnGuidePrompt.innerText = 'Card in middle! Tap LEFT Draw Deck or RIGHT Discard Pile to pick and finish turn.';

    drawPileBtn.classList.add('can-draw');
    discardStackPile.classList.add('can-draw');

    callShowBtn.style.display = 'none';
    slashBtn.style.display = 'none';
    dropCardsBtn.style.display = 'none';
    return;
  }

  // 2. DROP Phase: player needs to drag/stage a card into the middle box
  if (turnPhase === 'DROP') {
    turnStatusBadge.innerText = 'YOUR TURN: Drop Card(s)';
    turnGuidePrompt.innerText = 'Drag card(s) into the MIDDLE DOTTED BOX to prepare your drop (or tap card and drop).';

    // SHOW BUTTON: Strictly appears ONLY when hand score <= 10 before dropping!
    if (myPlayer.handScore !== null && myPlayer.handScore <= 10) {
      callShowBtn.style.display = 'inline-flex';
      callShowPoints.innerText = myPlayer.handScore;
    } else {
      callShowBtn.style.display = 'none';
    }

    // SLASH OPTION (Match & Drop): If holding a card matching top discard rank!
    if (gameState.topDiscard) {
      const targetRank = gameState.topDiscard.rank;
      const hasMatch = myPlayer.hand.some(c => c.rank === targetRank || (c.isWild && gameState.topDiscard.isWild));
      if (hasMatch) {
        slashBtn.style.display = 'inline-flex';
        slashRankText.innerText = targetRank;
      } else {
        slashBtn.style.display = 'none';
      }
    } else {
      slashBtn.style.display = 'none';
    }

    // Fallback button if user selected cards
    if (selectedCards.size > 0) {
      dropCardsBtn.style.display = 'inline-flex';
      dropCardsBtn.innerText = `Place ${selectedCards.size} in Middle`;
    } else {
      dropCardsBtn.style.display = 'none';
    }
  } else if (turnPhase === 'DRAW') {
    turnStatusBadge.innerText = 'YOUR TURN: Pick a Card';
    turnGuidePrompt.innerText = 'Drop complete! Tap the LEFT Draw Deck or the RIGHT Discard Stack to pick a card.';

    drawPileBtn.classList.add('can-draw');
    discardStackPile.classList.add('can-draw');

    callShowBtn.style.display = 'none';
    slashBtn.style.display = 'none';
    dropCardsBtn.style.display = 'none';
  }
}

// -----------------------------------------------------------------------------
// SHOW RESULTS MODAL
// -----------------------------------------------------------------------------
function showResultsModal(results, isGameOver) {
  if (!results) return;

  resultsModal.style.display = 'flex';

  if (results.isGoodShow) {
    window.soundFx.playGoodShow();
    resultsTitle.innerText = `👑 Good Show by ${results.caller.name}!`;
    resultsTitle.style.color = 'var(--gold)';
    resultsSubtitle.innerText = `${results.caller.name} had the lowest hand (${results.caller.score} pts) and scored 0!`;
  } else {
    window.soundFx.playBadShow();
    resultsTitle.innerText = `❌ Bad Show! Penalty (+40 pts)`;
    resultsTitle.style.color = 'var(--danger)';
    resultsSubtitle.innerText = `${results.caller.name} called Show with ${results.caller.score} pts, but was tied or beaten! Takes +40 penalty.`;
  }

  resultsTableBody.innerHTML = '';
  results.details.forEach(item => {
    const tr = document.createElement('tr');
    if (item.id === results.roundWinner?.id) tr.className = 'winner-row';
    if (item.id === results.penaltyPlayerId) tr.className = 'penalty-row';

    const cardList = item.hand.map(c => `${c.rank}${c.suit}`).join(' ');

    tr.innerHTML = `
      <td>${item.name} ${item.eliminated ? '💀' : ''}</td>
      <td style="font-family:monospace; font-size:11px;">${cardList}</td>
      <td><strong>${item.handScore}</strong></td>
      <td style="color:${item.roundPoints === 0 ? 'var(--success)' : (item.roundPoints >= 40 ? 'var(--danger)' : '#fff')};">
        +${item.roundPoints}
      </td>
      <td><strong>${item.totalScore}</strong></td>
    `;
    resultsTableBody.appendChild(tr);
  });

  if (results.newlyEliminated && results.newlyEliminated.length > 0) {
    const names = results.newlyEliminated.map(p => p.name).join(', ');
    eliminatedNotice.innerText = `💀 Knocked Out this round: ${names}`;
  } else {
    eliminatedNotice.innerText = '';
  }

  if (isGameOver) {
    resultsTitle.innerText = `🏆 GAME OVER - ${results.champion ? results.champion.name : 'Winner'} Wins!`;
    resultsSubtitle.innerText = 'The last player standing has won the table!';
    hostNextRoundContainer.style.display = 'none';
    nonHostNextRoundMessage.innerText = 'Match finished. Refresh or return to lobby to start a new game.';
  } else {
    if (isHost) {
      hostNextRoundContainer.style.display = 'block';
      nonHostNextRoundMessage.style.display = 'none';
    } else {
      hostNextRoundContainer.style.display = 'none';
      nonHostNextRoundMessage.style.display = 'block';
    }
  }
}
