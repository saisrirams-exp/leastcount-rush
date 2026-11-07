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

  const suitOrder = { '♣': 1, '♦': 2, '♥': 3, '♠': 4, '★': 5, '?': 6 };
  const getRankVal = (r) => {
    if (r === 'JOKER') return 0;
    if (r === 'A') return 1;
    if (r === 'J') return 11;
    if (r === 'Q') return 12;
    if (r === 'K') return 13;
    const n = parseInt(r, 10);
    return isNaN(n) ? 0 : n;
  };

  return cards.sort((a, b) => {
    // 1. Wild cards & Jokers always come first (0 points)
    const isWildA = !!(a.isWild || a.isJoker || a.rank === 'JOKER');
    const isWildB = !!(b.isWild || b.isJoker || b.rank === 'JOKER');
    if (isWildA !== isWildB) {
      return isWildA ? -1 : 1;
    }

    // 2. Rank numerical order: A (1) < 2 < 3 < ... < 10 < J (11) < Q (12) < K (13)
    const rvA = getRankVal(a.rank);
    const rvB = getRankVal(b.rank);
    if (rvA !== rvB) {
      return ascending ? rvA - rvB : rvB - rvA;
    }

    // 3. Same rank: sort by suit (Clubs, Diamonds, Hearts, Spades)
    const sA = suitOrder[a.suit] || 0;
    const sB = suitOrder[b.suit] || 0;
    return sA - sB;
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

// Top App Bar
const topAppBar = document.querySelector('header.app-bar');

// Opponents Perimeter Container
const opponentsPerimeter = document.getElementById('opponentsPerimeter');

// Top HUD Elements
const tableCodeInHud = document.getElementById('tableCodeInHud');
const gameMenuToggleBtn = document.getElementById('gameMenuToggleBtn');
const gameMenuModal = document.getElementById('gameMenuModal');
const menuCloseBtn = document.getElementById('menuCloseBtn');
const menuRulesBtn = document.getElementById('menuRulesBtn');
const menuCopyLinkBtn = document.getElementById('menuCopyLinkBtn');
const menuAdminStopBtn = document.getElementById('menuAdminStopBtn');
const menuExitBtn = document.getElementById('menuExitBtn');
const menuTableCodeLabel = document.getElementById('menuTableCodeLabel');
const rotateDevicePrompt = document.getElementById('rotateDevicePrompt');
const dismissRotatePromptBtn = document.getElementById('dismissRotatePromptBtn');
const landscapeShieldOverlay = document.getElementById('landscapeShieldOverlay');
const forceRotateLandscapeBtn = document.getElementById('forceRotateLandscapeBtn');
const hudRotateBtn = document.getElementById('hudRotateBtn');

// In-Game Elements (Left: Deck & Joker | Middle: Dotted Drop Box | Right: Discard Stack)
const arenaStadium = document.getElementById('arenaStadium');
const roundNumberBadge = document.getElementById('roundNumberBadge');
const deckShoeBadge = document.getElementById('deckShoeBadge');
const actionBanner = document.getElementById('actionBanner');
const eliminationScoreBadge = document.getElementById('eliminationScoreBadge');
const wildJokerSlot = document.getElementById('wildJokerSlot');
const wildJokerMiniLabel = document.getElementById('wildJokerMiniLabel');
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
const turnStatusNotice = document.getElementById('turnStatusNotice');

// Player Bar HUD & Corner Action Button
const myPlayerAvatar = document.getElementById('myPlayerAvatar');
const myHandPoints = document.getElementById('myHandPoints');
const myGameScore = document.getElementById('myGameScore');
const maxScoreTarget = document.getElementById('maxScoreTarget');
const turnStatusBadge = document.getElementById('turnStatusBadge');
const myHandCards = document.getElementById('myHandCards');
const cornerActionButton = document.getElementById('cornerActionButton');
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

// In-Game Menu Modal (Hamburger ☰)
if (gameMenuToggleBtn) {
  gameMenuToggleBtn.addEventListener('click', () => {
    if (gameMenuModal) {
      if (menuTableCodeLabel) menuTableCodeLabel.innerText = currentRoomCode || '------';
      if (menuAdminStopBtn) menuAdminStopBtn.style.display = isHost ? 'block' : 'none';
      gameMenuModal.style.display = 'flex';
      triggerHaptic('tap');
    }
  });
}

if (menuCloseBtn) {
  menuCloseBtn.addEventListener('click', () => {
    if (gameMenuModal) gameMenuModal.style.display = 'none';
    triggerHaptic('tap');
  });
}

if (menuRulesBtn) {
  menuRulesBtn.addEventListener('click', () => {
    if (gameMenuModal) gameMenuModal.style.display = 'none';
    openRules();
  });
}

if (menuCopyLinkBtn) {
  menuCopyLinkBtn.addEventListener('click', () => {
    copyInvite();
    if (gameMenuModal) gameMenuModal.style.display = 'none';
  });
}

if (menuAdminStopBtn) {
  menuAdminStopBtn.addEventListener('click', () => {
    if (confirm('⚠️ ADMIN ACTION:\n\nAre you sure you want to STOP the game entirely for all players? Everyone will return to the lobby.')) {
      socket.emit('stopGame');
      if (gameMenuModal) gameMenuModal.style.display = 'none';
    }
  });
}

if (menuExitBtn) {
  menuExitBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to leave this table and return to the main menu?')) {
      socket.emit('leaveRoom');
      if (gameMenuModal) gameMenuModal.style.display = 'none';
    }
  });
}

socket.on('leftRoom', () => {
  currentRoomCode = null;
  sessionStorage.removeItem('leastcount_current_room');
  gameState = null;
  selectedCards.clear();
  stagedCards = [];
  isForceRotated = false;
  
  if (topAppBar) topAppBar.style.display = 'flex';
  roomBadge.style.display = 'none';
  lobbyScreen.style.display = 'none';
  gameScreen.style.display = 'none';
  if (gameScreen) gameScreen.classList.remove('force-landscape-rotated');
  resultsModal.style.display = 'none';
  if (gameMenuModal) gameMenuModal.style.display = 'none';
  if (rotateDevicePrompt) rotateDevicePrompt.style.display = 'none';
  if (landscapeShieldOverlay) landscapeShieldOverlay.style.display = 'none';
  homeScreen.style.display = 'flex';

  // Clean URL query
  window.history.replaceState(null, '', window.location.pathname);
});

// Horizontal Landscape Orientation Enforcer
let isForceRotated = false;

function checkOrientationHelper() {
  const isGameVisible = gameScreen && gameScreen.style.display !== 'none';
  const isPortrait = !isForceRotated && (window.innerHeight > window.innerWidth);

  if (isGameVisible && isPortrait) {
    if (landscapeShieldOverlay) landscapeShieldOverlay.style.display = 'flex';
  } else {
    if (landscapeShieldOverlay) landscapeShieldOverlay.style.display = 'none';
  }

  // If user rotated phone to landscape naturally, reset forced rotation
  if (window.innerWidth >= window.innerHeight && isForceRotated) {
    isForceRotated = false;
    if (gameScreen) gameScreen.classList.remove('force-landscape-rotated');
    if (resultsModal) resultsModal.classList.remove('force-landscape-rotated');
    if (gameMenuModal) gameMenuModal.classList.remove('force-landscape-rotated');
  }
}

function toggleForceLandscape() {
  isForceRotated = !isForceRotated;
  if (isForceRotated) {
    if (gameScreen) gameScreen.classList.add('force-landscape-rotated');
    if (resultsModal) resultsModal.classList.add('force-landscape-rotated');
    if (gameMenuModal) gameMenuModal.classList.add('force-landscape-rotated');
    if (landscapeShieldOverlay) landscapeShieldOverlay.style.display = 'none';
    triggerHaptic('tap');

    // Attempt OS Fullscreen and Landscape Orientation Lock
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().then(() => {
          if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(() => {});
          }
        }).catch(() => {});
      } else if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    } catch (e) {}
  } else {
    if (gameScreen) gameScreen.classList.remove('force-landscape-rotated');
    if (resultsModal) resultsModal.classList.remove('force-landscape-rotated');
    if (gameMenuModal) gameMenuModal.classList.remove('force-landscape-rotated');
    checkOrientationHelper();
  }

  // Re-render opponents for horizontal layout
  if (gameState && gameState.players) {
    const opponents = gameState.players.filter(p => p.id !== myPlayerId);
    renderOpponents(opponents, gameState.currentTurnPlayerId);
  }
}

if (forceRotateLandscapeBtn) {
  forceRotateLandscapeBtn.addEventListener('click', toggleForceLandscape);
}

if (hudRotateBtn) {
  hudRotateBtn.addEventListener('click', toggleForceLandscape);
}

window.addEventListener('resize', () => {
  checkOrientationHelper();
  if (gameState && gameState.players && gameScreen && gameScreen.style.display !== 'none') {
    const opponents = gameState.players.filter(p => p.id !== myPlayerId);
    renderOpponents(opponents, gameState.currentTurnPlayerId);
  }
});

window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    checkOrientationHelper();
    if (gameState && gameState.players && gameScreen && gameScreen.style.display !== 'none') {
      const opponents = gameState.players.filter(p => p.id !== myPlayerId);
      renderOpponents(opponents, gameState.currentTurnPlayerId);
    }
  }, 150);
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
  try {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  } catch (e) {}
  socket.emit('startGame');
});

nextRoundBtn.addEventListener('click', () => {
  socket.emit('nextRound');
  resultsModal.style.display = 'none';
});

// -----------------------------------------------------------------------------
// CARD INTERACTION: DIRECT TAP TO DROP (OR MULTI-DROP SAME RANK)
// -----------------------------------------------------------------------------
function onHandCardClick(cardId) {
  if (!gameState) return;
  const isMyTurn = gameState.currentTurnPlayerId === myPlayerId;
  const isDropPhase = isMyTurn && gameState.turnPhase === 'DROP';
  const myPlayer = gameState.players.find(p => p.id === myPlayerId);
  if (!myPlayer || !myPlayer.hand) return;

  const targetCard = myPlayer.hand.find(c => c.id === cardId);
  if (!targetCard) return;

  if (!isDropPhase) {
    // Check if card can be slashed
    const topDiscard = gameState.topDiscard;
    if (topDiscard && (targetCard.rank === topDiscard.rank || (targetCard.isWild && topDiscard.isWild))) {
      executeSlash();
    } else {
      showToast('Wait for your turn to drop cards');
    }
    return;
  }

  // IT IS DROP PHASE ON MY TURN:
  // 1. If nothing staged yet: stage this card!
  if (stagedCards.length === 0) {
    stagedCards = [targetCard];
    window.soundFx.playCardDrop();
    updateHandUI();
    updateActionUI();
    showToast(`Dropped ${targetCard.rank}! Tap Left Deck or Discard to pick.`);
    return;
  }

  // 2. If card(s) already staged:
  const firstRank = stagedCards[0].rank;
  const firstIsWild = stagedCards[0].isWild;
  const isSameRank = targetCard.rank === firstRank || (targetCard.isWild && firstIsWild);

  if (isSameRank) {
    // Add to staged cards (multi-card drop!)
    if (!stagedCards.some(c => c.id === targetCard.id)) {
      stagedCards.push(targetCard);
      window.soundFx.playCardDrop();
      updateHandUI();
      updateActionUI();
      showToast(`Added another ${targetCard.rank} (${stagedCards.length}x)! Tap Deck or Discard to finish.`);
    }
  } else {
    // Different rank -> Swap previous cards with this one
    stagedCards = [targetCard];
    window.soundFx.playCardDrop();
    updateHandUI();
    updateActionUI();
    showToast(`Swapped to ${targetCard.rank}! Tap Left Deck or Discard to finish.`);
  }
}

function unstageCards() {
  if (stagedCards.length === 0) return;
  stagedCards = [];
  window.soundFx.playCardDraw();
  updateHandUI();
  updateActionUI();
  showToast('Cards returned to hand ↩️');
}

function shakeDropBox() {
  if (!middleDottedDropBox) return;
  middleDottedDropBox.classList.remove('shake');
  void middleDottedDropBox.offsetWidth; // trigger reflow
  middleDottedDropBox.classList.add('shake');
  setTimeout(() => middleDottedDropBox.classList.remove('shake'), 450);
}

// Click on middle dashed box: returns cards to hand so player can change mind!
middleDottedDropBox.addEventListener('click', () => {
  if (stagedCards.length > 0) {
    unstageCards();
  } else {
    showToast('Tap card(s) from your hand to drop into this box');
    shakeDropBox();
  }
});

if (returnStagedCardBtn) {
  returnStagedCardBtn.addEventListener('click', unstageCards);
}

// -----------------------------------------------------------------------------
// MIDDLE DASHED DROP BOX (DRAG AND DROP)
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
    onHandCardClick(cardId);
  }
});

// -----------------------------------------------------------------------------
// CARD DRAW: DIRECT TAP ON LEFT DRAW DECK OR RIGHT DISCARD PILE
// -----------------------------------------------------------------------------
drawPileBtn.addEventListener('click', () => {
  if (!gameState) return;
  const isMyTurn = gameState.currentTurnPlayerId === myPlayerId;
  if (!isMyTurn) {
    showToast('Wait for your turn to draw');
    return;
  }

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
    showToast('👉 Drop your card(s) in the middle first!');
    shakeDropBox();
  }
});

discardStackPile.addEventListener('click', () => {
  if (!gameState) return;
  const isMyTurn = gameState.currentTurnPlayerId === myPlayerId;
  const myPlayer = gameState.players.find(p => p.id === myPlayerId);
  const topDiscard = gameState.topDiscard;

  // Staged drop ready -> Commit atomic drop & pick PREVIOUS discard!
  if (isMyTurn && stagedCards.length > 0) {
    const dropIds = stagedCards.map(c => c.id);
    stagedCards = [];
    socket.emit('dropAndDraw', { dropCardIds: dropIds, source: 'DISCARD' });
    window.soundFx.playCardDraw();
  } else if (isMyTurn && gameState.turnPhase === 'DRAW') {
    socket.emit('drawCard', { source: 'DISCARD' });
    window.soundFx.playCardDraw();
  } else {
    // Check if player has matching card to slash
    if (myPlayer && topDiscard) {
      const hasMatch = myPlayer.hand.some(c => c.rank === topDiscard.rank || (c.isWild && topDiscard.isWild));
      if (hasMatch) {
        executeSlash();
        return;
      }
    }
    if (isMyTurn) {
      showToast('👉 Drop your card(s) in the middle first!');
      shakeDropBox();
    } else {
      showToast('Wait for your turn');
    }
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
  socket.emit('slashCards', { cardIds });
  window.soundFx.playSlash();
  showToast(`⚡ SLASHED ${targetRank}! Dropped without drawing!`);
}

if (slashBtn) {
  slashBtn.addEventListener('click', executeSlash);
}

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
  showToast('🃏 Hand sorted ascending (0 ➔ K)');
  updateHandUI();
}

if (sortCardsBtn) {
  sortCardsBtn.addEventListener('click', () => sortMyHand(true));
}

// -----------------------------------------------------------------------------
// CALL SHOW: ONLY APPEARS WHEN HAND SCORE IS 10 OR BELOW
// -----------------------------------------------------------------------------
function declareShow() {
  const myPlayer = gameState?.players.find(p => p.id === myPlayerId);
  const myScore = myPlayer ? calculateHandScore(myPlayer.hand) : 0;

  if (myScore > 10) {
    showToast('⚠️ You can only call SHOW when your hand total is 10 or below!');
    return;
  }

  const confirmMsg = `Declare SHOW with ${myScore} points?\n\nIf you have the lowest hand at the table, you score 0!\nIf anyone ties or beats you, you take a +40 penalty!`;
  if (confirm(confirmMsg)) {
    if (stagedCards.length > 0) {
      stagedCards = [];
      updateHandUI();
    }
    socket.emit('callShow');
  }
}

if (callShowBtn) {
  callShowBtn.addEventListener('click', declareShow);
}

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
    if (topAppBar) topAppBar.style.display = 'flex';
    homeScreen.style.display = 'none';
    gameScreen.style.display = 'none';
    lobbyScreen.style.display = 'flex';
    resultsModal.style.display = 'none';
    if (rotateDevicePrompt) rotateDevicePrompt.style.display = 'none';

    renderLobby(state);
  } else if (state.status === 'PLAYING') {
    if (topAppBar) topAppBar.style.display = 'none';
    homeScreen.style.display = 'none';
    lobbyScreen.style.display = 'none';
    gameScreen.style.display = 'flex';
    resultsModal.style.display = 'none';
    checkOrientationHelper();

    renderGameTable(state);
  } else if (state.status === 'ROUND_OVER' || state.status === 'GAME_OVER') {
    if (topAppBar) topAppBar.style.display = 'none';
    if (rotateDevicePrompt) rotateDevicePrompt.style.display = 'none';
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

// 2. Render In-Game Table & Fullscreen Immersive Canvas
function renderGameTable(state) {
  roundNumberBadge.innerText = state.roundNumber;
  const scoringBadge = state.faceCardScoring === 'CLASSIC_13' ? 'Classic 10-13' : 'Standard 10s';
  deckShoeBadge.innerText = `(${state.deckCountUsed} Decks • ${scoringBadge})`;
  eliminationScoreBadge.innerText = state.eliminationScore;
  if (maxScoreTarget) maxScoreTarget.innerText = state.eliminationScore;

  if (tableCodeInHud) {
    tableCodeInHud.innerText = state.roomCode || currentRoomCode || '------';
  }

  if (state.lastAction) {
    actionBanner.innerText = state.lastAction.text;
  }

  deckCountBadge.innerText = state.drawPileCount;
  timerCircle.innerText = state.turnTimeRemaining;

  // LEFT: Render Wild Joker Card Underneath Draw Deck (clearly showing rank & suit)
  if (state.wildJokerCard) {
    wildJokerSlot.innerHTML = createCardInner(state.wildJokerCard, true);
    wildJokerSlot.className = `wild-joker-under-card single-card ${state.wildJokerCard.color}`;
  } else {
    wildJokerSlot.innerHTML = '';
  }

  // RIGHT: Render Discard Stack (Where open dropped cards are shown)
  if (state.topDiscard) {
    discardPileCardWrapper.innerHTML = `
      <div class="single-card ${state.topDiscard.color} ${state.topDiscard.isWild ? 'wild-joker-card' : ''}">
        ${createCardInner(state.topDiscard, false)}
      </div>
    `;
  } else {
    discardPileCardWrapper.innerHTML = `<div class="single-card" style="opacity:0.25; border:1.5px dashed rgba(255,255,255,0.3);"></div>`;
  }

  // OPPONENTS: Render all opponents around the table perimeter
  const opponents = state.players.filter(p => p.id !== myPlayerId);
  renderOpponents(opponents, state.currentTurnPlayerId);

  if (arenaStadium) {
    arenaStadium.innerHTML = '';
  }

  // Render My Hand & Update Table Direct Interaction cues
  const myPlayer = state.players.find(p => p.id === myPlayerId);
  if (myPlayer) {
    if (myPlayerAvatar) {
      myPlayerAvatar.innerText = myPlayer.isBot ? '🤖' : (myPlayer.avatar || myAvatar || '👑');
    }
    if (myGameScore) {
      myGameScore.innerText = myPlayer.score;
    }

    updateHandUI();
    updateActionUI();
  }
}

// Opponents Sitting in Perimeter Oval around the Table
function renderOpponents(opponents, currentTurnPlayerId) {
  const container = opponentsPerimeter || document.getElementById('opponentsPerimeter');
  if (!container) return;
  container.innerHTML = '';

  if (!opponents || opponents.length === 0) return;

  const total = opponents.length;
  const isHorizontal = isForceRotated || (window.innerWidth >= window.innerHeight);

  opponents.forEach((p, idx) => {
    const isCurrentTurn = p.id === currentTurnPlayerId;
    const slotDiv = document.createElement('div');
    const avatarEmoji = p.eliminated ? '💀' : (p.isBot ? '🤖' : (p.avatar || '👤'));
    const countDisplay = p.eliminated ? '💀' : (p.waitingNextRound ? '👁️' : (p.cardCount !== undefined ? p.cardCount : 7));

    if (isHorizontal) {
      // LANDSCAPE HORIZONTAL MODE: Wide Perimeter Arc (Matching Play Store 2000x1200 landscape layout)
      let slotClass = 'slot-top-center';
      if (total === 1) {
        slotClass = 'slot-top-center';
      } else if (total === 2) {
        const map2 = ['slot-top-left', 'slot-top-right'];
        slotClass = map2[idx] || 'slot-top-center';
      } else if (total === 3) {
        const map3 = ['slot-left', 'slot-top-center', 'slot-right'];
        slotClass = map3[idx] || 'slot-top-center';
      } else if (total === 4) {
        const map4 = ['slot-left', 'slot-top-left', 'slot-top-right', 'slot-right'];
        slotClass = map4[idx] || 'slot-top-center';
      } else if (total === 5) {
        const map5 = ['slot-left', 'slot-top-left', 'slot-top-center', 'slot-top-right', 'slot-right'];
        slotClass = map5[idx] || 'slot-top-center';
      }

      if (total <= 5) {
        slotDiv.className = `opponent-slot ${slotClass} ${isCurrentTurn ? 'active-turn' : ''} ${p.eliminated ? 'eliminated' : ''}`;
      } else {
        // 6 to 14 opponents: Wide Elliptical Perimeter Arc
        const angle = Math.PI - (idx / (total - 1)) * Math.PI;
        const leftPct = 50 - 44 * Math.cos(angle);
        const topPct = 34 - 24 * Math.sin(angle);
        slotDiv.className = `opponent-slot ${isCurrentTurn ? 'active-turn' : ''} ${p.eliminated ? 'eliminated' : ''}`;
        slotDiv.style.left = `${leftPct}%`;
        slotDiv.style.top = `${topPct}%`;
        slotDiv.style.transform = 'translate(-50%, -50%)';
        if (leftPct > 70) slotDiv.style.flexDirection = 'row-reverse';
      }
    } else {
      // PORTRAIT MODE: Horseshoe Perimeter (Left -> Top Arc -> Right)
      let leftPct = 50;
      let topPct = 9;
      let flexDir = 'row';

      if (total <= 3) {
        if (idx === 0) { leftPct = 12; topPct = 26; flexDir = 'row'; }
        else if (idx === 1) { leftPct = 50; topPct = 9; flexDir = 'column'; }
        else { leftPct = 88; topPct = 26; flexDir = 'row-reverse'; }
      } else {
        const sideCount = Math.max(1, Math.floor(total * 0.35));
        const topCount = total - 2 * sideCount;

        if (idx < sideCount) {
          // Left side
          const step = (sideCount > 1) ? idx / (sideCount - 1) : 0.5;
          leftPct = 9;
          topPct = 36 - step * 18; // 36% down to 18%
          flexDir = 'row';
        } else if (idx < sideCount + topCount) {
          // Top arc
          const topIdx = idx - sideCount;
          const step = (topCount > 1) ? topIdx / (topCount - 1) : 0.5;
          leftPct = 24 + step * 52; // 24% to 76%
          topPct = 9;
          flexDir = 'column';
        } else {
          // Right side
          const rightIdx = idx - (sideCount + topCount);
          const step = (sideCount > 1) ? rightIdx / (sideCount - 1) : 0.5;
          leftPct = 91;
          topPct = 18 + step * 18; // 18% down to 36%
          flexDir = 'row-reverse';
        }
      }

      slotDiv.className = `opponent-slot compact-portrait ${isCurrentTurn ? 'active-turn' : ''} ${p.eliminated ? 'eliminated' : ''}`;
      slotDiv.style.left = `${leftPct}%`;
      slotDiv.style.top = `${topPct}%`;
      slotDiv.style.transform = 'translate(-50%, -50%)';
      slotDiv.style.flexDirection = flexDir;
    }

    slotDiv.innerHTML = `
      <div class="opponent-profile">
        <div class="opponent-avatar-ring">
          ${isCurrentTurn ? '<div class="turn-halo"></div>' : ''}
          <span class="opponent-avatar-emoji">${avatarEmoji}</span>
        </div>
        <div class="opponent-name-label" title="${p.name}">${p.name}</div>
      </div>
      <div class="opponent-cards-fan">
        <div class="fan-card f1"></div>
        <div class="fan-card f2"></div>
        <div class="fan-card f3"></div>
        <div class="fan-count-badge">${countDisplay}</div>
      </div>
    `;

    container.appendChild(slotDiv);
  });
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

// Authentic Playing Card Royal SVG Illustrations (King, Queen, Jack)
function getCourtSvg(rank, suit, isRed) {
  const strokeColor = isRed ? '#d00000' : '#1a1a1a';
  const fillColor = isRed ? '#ffe8e8' : '#eef2f7';
  const goldColor = '#f5c542';

  if (rank === 'K') {
    return `
      <svg class="court-svg" viewBox="0 0 48 72" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 28 C12 20 20 16 24 16 C28 16 36 20 36 28 C36 34 32 40 24 40 C16 40 12 34 12 28 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5"/>
        <path d="M14 18 L19 22 L24 16 L29 22 L34 18 L32 26 L16 26 Z" fill="${goldColor}" stroke="#b8860b" stroke-width="1"/>
        <circle cx="24" cy="14" r="2" fill="${goldColor}"/>
        <path d="M16 40 L10 66 L38 66 L32 40 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5"/>
        <path d="M24 40 L24 66" stroke="${strokeColor}" stroke-width="1.5"/>
        <text x="24" y="55" font-size="13" text-anchor="middle" fill="${strokeColor}">${suit}</text>
      </svg>
    `;
  }
  if (rank === 'Q') {
    return `
      <svg class="court-svg" viewBox="0 0 48 72" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 26 C14 18 20 16 24 16 C28 16 34 18 34 26 C34 32 30 38 24 38 C18 38 14 32 14 26 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5"/>
        <path d="M16 19 Q24 14 32 19 L30 24 L18 24 Z" fill="${goldColor}" stroke="#b8860b" stroke-width="1"/>
        <circle cx="24" cy="13" r="2.5" fill="${goldColor}"/>
        <path d="M16 38 L12 66 L36 66 L32 38 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5"/>
        <circle cx="24" cy="50" r="4" fill="${strokeColor}"/>
        <text x="24" y="63" font-size="11" text-anchor="middle" fill="${strokeColor}">${suit}</text>
      </svg>
    `;
  }
  if (rank === 'J') {
    return `
      <svg class="court-svg" viewBox="0 0 48 72" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 26 C14 19 20 17 24 17 C28 17 34 19 34 26 C34 33 30 38 24 38 C18 38 14 33 14 26 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5"/>
        <path d="M16 20 L24 15 L32 20 L28 25 L20 25 Z" fill="${goldColor}" stroke="#b8860b" stroke-width="1"/>
        <path d="M17 38 L12 66 L36 66 L31 38 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5"/>
        <line x1="30" y1="36" x2="38" y2="66" stroke="${goldColor}" stroke-width="2.5"/>
        <circle cx="38" cy="66" r="3" fill="${goldColor}"/>
        <text x="22" y="55" font-size="12" text-anchor="middle" fill="${strokeColor}">${suit}</text>
      </svg>
    `;
  }
  return '';
}

// Authentic Playing Card Inner HTML (clean indices, centered royalty/pip, NO 'pts' stamp)
function createCardInner(card, isTableJoker = false) {
  if (card.rank === '?') {
    return `<div style="margin:auto; font-size:24px; color:#aaa;">🂠</div>`;
  }

  const isJoker = card.isJoker || card.rank === 'JOKER';
  const isWild = !!card.isWild;
  const isRed = card.color === 'red' || card.suit === '♥' || card.suit === '♦';
  const suitIcon = isJoker ? '★' : (card.suit || '');
  const rankText = isJoker ? 'J' : card.rank;

  let centerContent = '';
  if (isJoker) {
    centerContent = `
      <div class="joker-center-art">
        <span style="font-size:24px;">🃏</span>
        <span class="joker-star-label">JOKER</span>
      </div>
    `;
  } else if (['K', 'Q', 'J'].includes(card.rank)) {
    centerContent = `
      <div class="court-figure">
        ${getCourtSvg(card.rank, suitIcon, isRed)}
      </div>
    `;
  } else {
    // Number card or Ace
    centerContent = `
      <div class="number-center-suit ${isRed ? 'red-suit' : 'black-suit'}">
        ${suitIcon}
      </div>
    `;
  }

  const wildBadge = isWild || isTableJoker ? `
    <div class="card-wild-star-badge">★ WILD</div>
  ` : '';

  return `
    <div class="card-index top-left">
      <span class="index-rank">${rankText}</span>
      <span class="index-suit">${suitIcon}</span>
    </div>
    ${centerContent}
    ${wildBadge}
    <div class="card-index bottom-right">
      <span class="index-rank">${rankText}</span>
      <span class="index-suit">${suitIcon}</span>
    </div>
  `;
}

// Center Dashed Drop Zone (Clean layout, fanned horizontal cards, ZERO yellow banners)
function renderMiddleDropBox(isMyTurn, turnPhase) {
  if (stagedCards.length > 0) {
    middleDropPlaceholder.style.display = 'none';
    middleStagedCardContainer.style.display = 'block';
    middleDottedDropBox.className = 'middle-drop-zone has-staged';

    const count = stagedCards.length;
    const isMobile = window.innerWidth <= 600;
    const cardW = isMobile ? 54 : 64;
    const cardH = isMobile ? 78 : 92;
    const offset = count > 1 ? Math.min(22, Math.floor(62 / (count - 1))) : 0;
    const totalW = cardW + (count - 1) * offset;
    const boxW = middleDottedDropBox.clientWidth || (isMobile ? 122 : 140);
    const startLeft = Math.max(4, Math.floor((boxW - totalW) / 2));

    const cardsHtml = stagedCards.map((card, i) => `
      <div class="single-card ${card.color} ${card.isWild ? 'wild-joker-card' : ''}"
           style="position:absolute; left:${startLeft + i * offset}px; top:4px; width:${cardW}px; height:${cardH}px; z-index:${i + 1}; pointer-events:none; box-shadow:-2px 3px 8px rgba(0,0,0,0.5);">
        ${createCardInner(card, false)}
      </div>
    `).join('');

    middleStagedCardContainer.innerHTML = cardsHtml;
    if (returnStagedCardBtn) returnStagedCardBtn.style.display = 'none';
  } else {
    middleDropPlaceholder.style.display = 'flex';
    middleStagedCardContainer.style.display = 'none';
    middleStagedCardContainer.innerHTML = '';
    if (returnStagedCardBtn) returnStagedCardBtn.style.display = 'none';

    if (isMyTurn && turnPhase === 'DROP') {
      middleDottedDropBox.className = 'middle-drop-zone active-drop';
    } else {
      middleDottedDropBox.className = 'middle-drop-zone';
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
      <div style="grid-column: 1 / -1; padding: 14px; text-align: center; background: rgba(0,0,0,0.35); border-radius: 14px; border: 1.5px dashed rgba(245,197,66,0.4); margin: 6px auto; max-width: 500px;">
        <div style="font-size: 15px; font-weight: bold; color: var(--gold); margin-bottom: 4px;">⏳ Spectating Round ${gameState.roundNumber}</div>
        <div style="color: rgba(253,250,243,0.85); font-size: 12px;">You will be dealt cards automatically as soon as Round ${gameState.roundNumber + 1} begins!</div>
      </div>
    `;
    return;
  }

  const isMyTurn = gameState.currentTurnPlayerId === myPlayerId;
  const isDropPhase = isMyTurn && gameState.turnPhase === 'DROP';

  // Live Count calculation: subtracts staged cards in real time!
  const visibleHand = myPlayer.hand.filter(c => !stagedCards.some(sc => sc.id === c.id));
  const liveCount = calculateHandScore(visibleHand);
  myHandPoints.innerText = liveCount;

  myHandCards.innerHTML = '';
  visibleHand.forEach(card => {
    const cardEl = document.createElement('div');
    cardEl.className = `hand-card single-card ${card.color} ${card.isWild ? 'wild-joker-card' : ''}`;
    cardEl.innerHTML = createCardInner(card, false);

    // Direct tap on card in hand -> moves directly to middle drop box!
    cardEl.addEventListener('click', () => onHandCardClick(card.id));

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

        // Dragged into middle dashed box: stage card!
        if (elemUnder && (elemUnder === middleDottedDropBox || middleDottedDropBox.contains(elemUnder))) {
          onHandCardClick(touchDraggedCardId);
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

    if (turnStatusBadge) {
      turnStatusBadge.className = 'turn-status-badge';
      if (myPlayer?.waitingNextRound) {
        turnStatusBadge.innerText = 'Spectating this round 👁️';
      } else {
        turnStatusBadge.innerText = myPlayer?.eliminated ? 'Eliminated 💀' : `Waiting for ${gameState.currentTurnPlayerName}…`;
      }
    }

    // Check if player has SLASH opportunity out-of-turn
    if (cornerActionButton) {
      if (gameState.topDiscard && myPlayer && !myPlayer.eliminated && !myPlayer.waitingNextRound &&
          myPlayer.hand.some(c => c.rank === gameState.topDiscard.rank || (c.isWild && gameState.topDiscard.isWild))) {
        cornerActionButton.style.display = 'inline-flex';
        cornerActionButton.className = 'corner-action-btn btn-slash';
        cornerActionButton.innerHTML = `Slash`;
        cornerActionButton.onclick = executeSlash;
      } else {
        cornerActionButton.style.display = 'none';
        cornerActionButton.onclick = null;
      }
    }

    if (callShowBtn) callShowBtn.style.display = 'none';
    if (slashBtn) slashBtn.style.display = 'none';
    if (dropCardsBtn) dropCardsBtn.style.display = 'none';
    return;
  }

  // IT IS MY TURN!
  if (lastTurnPlayerId !== myPlayerId) {
    triggerHaptic('turn');
    lastTurnPlayerId = myPlayerId;
  }

  if (turnStatusBadge) {
    turnStatusBadge.className = 'turn-status-badge my-turn';
  }

  const myCurrentScore = myPlayer.handScore !== null ? myPlayer.handScore : calculateHandScore(myPlayer.hand);

  // 1. If card(s) are staged in middle box: Ready to draw from LEFT deck or RIGHT discard to finish turn!
  if (stagedCards.length > 0) {
    if (turnStatusBadge) turnStatusBadge.innerText = 'Tap Left Deck or Discard to Draw';

    drawPileBtn.classList.add('can-draw');
    discardStackPile.classList.add('can-draw');

    // If initial score was <= 10, keep Show available in corner
    if (cornerActionButton) {
      if (myCurrentScore <= 10) {
        cornerActionButton.style.display = 'inline-flex';
        cornerActionButton.className = 'corner-action-btn btn-show';
        cornerActionButton.innerHTML = `Show`;
        cornerActionButton.onclick = declareShow;
      } else {
        cornerActionButton.style.display = 'none';
        cornerActionButton.onclick = null;
      }
    }

    if (callShowBtn) callShowBtn.style.display = myCurrentScore <= 10 ? 'inline-flex' : 'none';
    if (slashBtn) slashBtn.style.display = 'none';
    if (dropCardsBtn) dropCardsBtn.style.display = 'none';
    return;
  }

  // 2. DROP Phase on My Turn (Nothing staged yet)
  if (turnPhase === 'DROP') {
    if (turnStatusBadge) turnStatusBadge.innerText = 'Your Turn: Tap Card(s) to Drop';

    // UNIFIED BOTTOM-RIGHT ACTION BUTTON:
    // If score <= 10 on your turn: SHOW appears!
    // Else if top discard matches a card in hand: SLASH appears!
    if (cornerActionButton) {
      if (myCurrentScore <= 10) {
        cornerActionButton.style.display = 'inline-flex';
        cornerActionButton.className = 'corner-action-btn btn-show';
        cornerActionButton.innerHTML = `Show`;
        cornerActionButton.onclick = declareShow;
      } else if (gameState.topDiscard && myPlayer.hand.some(c => c.rank === gameState.topDiscard.rank || (c.isWild && gameState.topDiscard.isWild))) {
        cornerActionButton.style.display = 'inline-flex';
        cornerActionButton.className = 'corner-action-btn btn-slash';
        cornerActionButton.innerHTML = `Slash`;
        cornerActionButton.onclick = executeSlash;
      } else {
        cornerActionButton.style.display = 'none';
        cornerActionButton.onclick = null;
      }
    }

    if (callShowBtn) {
      if (myCurrentScore <= 10) {
        callShowBtn.style.display = 'inline-flex';
        if (callShowPoints) callShowPoints.innerText = myCurrentScore;
      } else {
        callShowBtn.style.display = 'none';
      }
    }

    if (slashBtn) {
      if (gameState.topDiscard && myPlayer.hand.some(c => c.rank === gameState.topDiscard.rank || (c.isWild && gameState.topDiscard.isWild))) {
        slashBtn.style.display = 'inline-flex';
        if (slashRankText) slashRankText.innerText = gameState.topDiscard.rank;
      } else {
        slashBtn.style.display = 'none';
      }
    }

    if (dropCardsBtn) dropCardsBtn.style.display = 'none';
  } else if (turnPhase === 'DRAW') {
    if (turnStatusBadge) turnStatusBadge.innerText = 'Tap Left Deck or Discard to Draw';

    drawPileBtn.classList.add('can-draw');
    discardStackPile.classList.add('can-draw');

    if (cornerActionButton) cornerActionButton.style.display = 'none';
    if (callShowBtn) callShowBtn.style.display = 'none';
    if (slashBtn) slashBtn.style.display = 'none';
    if (dropCardsBtn) dropCardsBtn.style.display = 'none';
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
