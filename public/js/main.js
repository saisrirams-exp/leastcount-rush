/**
 * Least Count Rush - Main Application Bootstrap & Socket.IO Client Controller
 */
import { GAME_CONSTANTS, STORAGE_KEYS, getSocketServerUrl, isNativeApp } from './config.js';
import { store } from './state.js';
import { soundFx } from './sound.js';
import { nativeBridge } from './native-bridge.js';
import { createCardInner } from './cards.js';
import { flyCardWipe } from './animations.js';
import { TableUIController } from './ui.js';

const socketUrl = getSocketServerUrl();
const socket = window.io(socketUrl, {
  transports: ['websocket', 'polling'],
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000
});

const ui = new TableUIController({
  onDropAndDraw: (dropIds, source) => socket.emit('dropAndDraw', { dropCardIds: dropIds, source }),
  onDrawCard: (source) => socket.emit('drawCard', { source }),
  onSlashCards: (cardIds) => socket.emit('slashCards', { cardIds }),
  onCallShow: () => socket.emit('callShow'),
  onRemoveBot: (botId) => socket.emit('removeBot', botId)
});

async function handleHardwareBack() {
  const { rulesModal, gameMenuModal, createTableModal, scoreMatrixModal, confirmDialogModal } = ui.dom;
  if (confirmDialogModal && confirmDialogModal.style.display !== 'none') {
    ui.dom.confirmDialogCancelBtn?.click();
    return;
  }
  if (scoreMatrixModal && scoreMatrixModal.style.display !== 'none') {
    scoreMatrixModal.style.display = 'none';
    return;
  }
  if (rulesModal && rulesModal.style.display !== 'none') {
    ui.closeRules();
    return;
  }
  if (gameMenuModal && gameMenuModal.style.display !== 'none') {
    gameMenuModal.style.display = 'none';
    return;
  }
  if (createTableModal && createTableModal.style.display !== 'none') {
    createTableModal.style.display = 'none';
    return;
  }
  if (store.currentRoomCode) {
    const leave = await ui.askConfirm({
      title: 'Leave Table?',
      message: 'Return to main menu and leave this table?',
      okText: '🚪 Leave'
    });
    if (leave) socket.emit('leaveRoom');
    return;
  }
  nativeBridge.exitApp();
}

function handleJoinWithCode(code) {
  let name = ui.dom.playerNameInput.value.trim();
  if (!name) {
    name = 'Player_' + Math.floor(100 + Math.random() * 900);
    ui.dom.playerNameInput.value = name;
  }
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    alert('Please enter a 5-letter room code.');
    return;
  }
  localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, name);
  store.setRoomCode(cleanCode);

  socket.emit('joinRoom', {
    roomCode: cleanCode,
    playerId: store.persistentPlayerId,
    playerName: name,
    avatar: store.myAvatar
  });
}

function initUIEventListeners() {
  const d = ui.dom;

  // Restore saved player name
  d.playerNameInput.value = localStorage.getItem(STORAGE_KEYS.PLAYER_NAME) || '';

  // URL invite link auto-fill (?room=CODE)
  const urlParams = new URLSearchParams(window.location.search);
  const inviteRoom = urlParams.get('room');
  if (inviteRoom && inviteRoom.trim().length > 0) {
    const cleanCode = inviteRoom.toUpperCase().trim();
    d.joinCodeInput.value = cleanCode;
    if (d.inviteCodeLabel) d.inviteCodeLabel.innerText = cleanCode;
    if (sessionStorage.getItem(STORAGE_KEYS.CURRENT_ROOM) !== cleanCode) {
      if (d.inviteBlock) d.inviteBlock.style.display = 'block';
      if (d.standardBlock) d.standardBlock.style.display = 'none';
    }
  }

  d.showNormalHomeBtn?.addEventListener('click', () => {
    d.inviteBlock.style.display = 'none';
    d.standardBlock.style.display = 'block';
  });

  d.inviteJoinBtn?.addEventListener('click', () => handleJoinWithCode(d.joinCodeInput.value));

  // Settings controls
  d.maxPlayersSlider?.addEventListener('input', (e) => {
    ui.updateDeckCapacityLabel(parseInt(e.target.value, 10));
  });

  document.querySelectorAll('#elimScorePills .pill-opt').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#elimScorePills .pill-opt').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      store.selectedElimScore = parseInt(pill.dataset.val, 10);
      nativeBridge.triggerHaptic('tap');
    });
  });

  document.querySelectorAll('#turnTimerPills .pill-opt').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#turnTimerPills .pill-opt').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      store.selectedTurnDuration = parseInt(pill.dataset.val, 10);
      nativeBridge.triggerHaptic('tap');
    });
  });

  document.querySelectorAll('#faceScorePills .pill-opt').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#faceScorePills .pill-opt').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      store.selectedFaceScore = pill.dataset.val;
      nativeBridge.triggerHaptic('tap');
    });
  });

  // Rules & Avatar
  d.openRulesBtn?.addEventListener('click', () => ui.openRules());
  d.homeRulesBtn?.addEventListener('click', () => ui.openRules());
  d.closeRulesBtn?.addEventListener('click', () => ui.closeRules());

  if (d.heroAvatarDisplay) d.heroAvatarDisplay.innerText = store.myAvatar;
  document.querySelectorAll('#avatarSelector .avatar-opt').forEach((opt) => {
    if (opt.dataset.avatar === store.myAvatar) {
      document.querySelectorAll('#avatarSelector .avatar-opt').forEach((o) => o.classList.remove('active'));
      opt.classList.add('active');
    }
    opt.addEventListener('click', () => {
      document.querySelectorAll('#avatarSelector .avatar-opt').forEach((o) => o.classList.remove('active'));
      opt.classList.add('active');
      store.myAvatar = opt.dataset.avatar;
      localStorage.setItem(STORAGE_KEYS.AVATAR, store.myAvatar);
      if (d.heroAvatarDisplay) d.heroAvatarDisplay.innerText = store.myAvatar;
      nativeBridge.triggerHaptic('tap');
      ui.showToast(`Avatar selected: ${store.myAvatar}`);
    });
  });

  // Modals & Navigation
  d.openCreateModalBtn?.addEventListener('click', () => {
    d.createTableModal.style.display = 'flex';
  });
  d.cancelCreateModalBtn?.addEventListener('click', () => {
    d.createTableModal.style.display = 'none';
  });
  d.joinCodeInput?.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  });

  d.copyInviteBtn?.addEventListener('click', () => ui.copyInvite());
  d.copyInviteLinkBtn?.addEventListener('click', () => ui.copyInvite());
  d.shareInviteBtn?.addEventListener('click', () => ui.shareInvite());

  d.exitTableBtn?.addEventListener('click', async () => {
    const ok = await ui.askConfirm({
      title: 'Leave Table?',
      message: 'Are you sure you want to leave this table and return to the main menu?',
      okText: '🚪 Leave'
    });
    if (ok) socket.emit('leaveRoom');
  });

  d.spectatorExitBtn?.addEventListener('click', async () => {
    const ok = await ui.askConfirm({
      title: 'Leave Table?',
      message: 'Return to the main menu?',
      okText: '🚪 Exit'
    });
    if (ok) socket.emit('leaveRoom');
  });

  d.adminStopGameBtn?.addEventListener('click', async () => {
    const ok = await ui.askConfirm({
      title: 'Stop Game (Admin)?',
      message: 'Are you sure you want to STOP the game for all players?',
      okText: '🛑 Stop Game'
    });
    if (ok) socket.emit('stopGame');
  });

  // Hamburger Game Menu
  d.gameMenuToggleBtn?.addEventListener('click', () => {
    if (d.gameMenuModal) {
      if (d.menuTableCodeLabel) d.menuTableCodeLabel.innerText = store.currentRoomCode || '------';
      if (d.menuAdminStopBtn) d.menuAdminStopBtn.style.display = store.isHost ? 'block' : 'none';
      if (d.menuMuteSoundBtn) {
        d.menuMuteSoundBtn.innerText = soundFx.enabled ? '🔊 Sound Effects: ON' : '🔇 Sound Effects: OFF';
      }
      d.gameMenuModal.style.display = 'flex';
      nativeBridge.triggerHaptic('tap');
    }
  });

  d.menuCloseBtn?.addEventListener('click', () => {
    d.gameMenuModal.style.display = 'none';
    nativeBridge.triggerHaptic('tap');
  });

  d.menuMuteSoundBtn?.addEventListener('click', () => {
    const isEnabled = soundFx.toggleMute();
    d.menuMuteSoundBtn.innerText = isEnabled ? '🔊 Sound Effects: ON' : '🔇 Sound Effects: OFF';
    nativeBridge.triggerHaptic('tap');
  });

  d.menuRulesBtn?.addEventListener('click', () => {
    d.gameMenuModal.style.display = 'none';
    ui.openRules();
  });

  d.menuCopyLinkBtn?.addEventListener('click', () => {
    ui.copyInvite();
    d.gameMenuModal.style.display = 'none';
  });

  d.menuAdminStopBtn?.addEventListener('click', async () => {
    const ok = await ui.askConfirm({
      title: 'Stop Game (Admin)?',
      message: 'STOP the game entirely for all players?',
      okText: '🛑 Stop'
    });
    if (ok) {
      socket.emit('stopGame');
      d.gameMenuModal.style.display = 'none';
    }
  });

  d.menuExitBtn?.addEventListener('click', async () => {
    const ok = await ui.askConfirm({
      title: 'Leave Table?',
      message: 'Leave this table and return to the main menu?',
      okText: '🚪 Leave'
    });
    if (ok) {
      socket.emit('leaveRoom');
      d.gameMenuModal.style.display = 'none';
    }
  });

  // 1-Tap Play with Bots
  d.quickPlayBotsBtn?.addEventListener('click', () => {
    let name = d.playerNameInput.value.trim();
    if (!name) {
      name = 'Player_' + Math.floor(100 + Math.random() * 900);
      d.playerNameInput.value = name;
    }
    localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, name);
    nativeBridge.lockLandscape();
    nativeBridge.triggerHaptic('tap');
    socket.emit('quickPlayBots', {
      playerId: store.persistentPlayerId,
      playerName: name,
      avatar: store.myAvatar,
      settings: {
        maxPlayers: 6,
        eliminationScore: store.selectedElimScore || 200,
        turnDuration: store.selectedTurnDuration || 18,
        faceCardScoring: store.selectedFaceScore || 'STANDARD_10'
      }
    });
  });

  // Auto Play & Reaction Emojis & Scoreboard Matrix
  d.autoPlayBtn?.addEventListener('click', () => {
    nativeBridge.triggerHaptic('tap');
    socket.emit('toggleAutoPlay');
  });

  d.emojiPickerToggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!d.emojiPickerPopup) return;
    const isVisible = d.emojiPickerPopup.style.display !== 'none';
    d.emojiPickerPopup.style.display = isVisible ? 'none' : 'grid';
  });

  document.querySelectorAll('#emojiPickerPopup .emoji-opt').forEach((el) => {
    el.addEventListener('click', () => {
      const emoji = el.dataset.emoji;
      if (emoji) {
        socket.emit('sendEmoji', { emoji });
        nativeBridge.triggerHaptic('tap');
      }
      if (d.emojiPickerPopup) d.emojiPickerPopup.style.display = 'none';
    });
  });

  document.addEventListener('click', (e) => {
    if (
      d.emojiPickerPopup &&
      d.emojiPickerPopup.style.display !== 'none' &&
      !d.emojiPickerPopup.contains(e.target) &&
      e.target !== d.emojiPickerToggleBtn
    ) {
      d.emojiPickerPopup.style.display = 'none';
    }
  });

  d.hudScoreboardBtn?.addEventListener('click', () => ui.openScoreMatrix());
  d.openScoreMatrixFromResultsBtn?.addEventListener('click', () => ui.openScoreMatrix());
  d.closeScoreMatrixBtn?.addEventListener('click', () => {
    if (d.scoreMatrixModal) d.scoreMatrixModal.style.display = 'none';
  });
  d.closeResultsSpectateBtn?.addEventListener('click', () => {
    store.spectatingRoundOver = true;
    if (d.resultsModal) d.resultsModal.style.display = 'none';
  });

  // Room Create / Join / Lobby Actions
  d.confirmCreateBtn?.addEventListener('click', () => {
    let name = d.playerNameInput.value.trim();
    if (!name) {
      name = 'Host_' + Math.floor(100 + Math.random() * 900);
      d.playerNameInput.value = name;
    }
    localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, name);
    const maxP = parseInt(d.maxPlayersSlider.value, 10);

    socket.emit('createRoom', {
      playerId: store.persistentPlayerId,
      playerName: name,
      avatar: store.myAvatar,
      settings: {
        maxPlayers: maxP,
        eliminationScore: store.selectedElimScore,
        turnDuration: store.selectedTurnDuration,
        faceCardScoring: store.selectedFaceScore
      }
    });
    d.createTableModal.style.display = 'none';
  });

  d.joinRoomBtn?.addEventListener('click', () => handleJoinWithCode(d.joinCodeInput.value));
  d.addSingleBotBtn?.addEventListener('click', () => socket.emit('addBot'));
  d.fillBotsBtn?.addEventListener('click', () => socket.emit('fillBots'));

  d.startGameBtn?.addEventListener('click', () => {
    nativeBridge.lockLandscape();
    socket.emit('startGame');
  });

  d.nextRoundBtn?.addEventListener('click', () => {
    socket.emit('nextRound');
    d.resultsModal.style.display = 'none';
  });

  // Orientation & Resize
  d.forceRotateLandscapeBtn?.addEventListener('click', () => ui.toggleForceLandscape());
  d.hudRotateBtn?.addEventListener('click', () => ui.toggleForceLandscape());
  window.addEventListener('resize', () => {
    ui.checkOrientationHelper();
    if (store.gameState?.players && d.gameScreen?.style.display !== 'none') {
      const opponents = store.gameState.players.filter((p) => p.id !== store.myPlayerId);
      ui.renderOpponents(opponents, store.gameState.currentTurnPlayerId);
    }
  });
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      ui.checkOrientationHelper();
      if (store.gameState?.players && d.gameScreen?.style.display !== 'none') {
        const opponents = store.gameState.players.filter((p) => p.id !== store.myPlayerId);
        ui.renderOpponents(opponents, store.gameState.currentTurnPlayerId);
      }
    }, 150);
  });

  // Middle Drop Box Interaction & HTML5 Drag-and-Drop
  d.middleDottedDropBox?.addEventListener('click', () => {
    if (store.stagedCards.length > 0) {
      ui.unstageCards();
    } else {
      ui.showToast('Tap or swipe up card(s) from your hand to drop here');
      ui.shakeDropBox();
    }
  });

  d.returnStagedCardBtn?.addEventListener('click', () => ui.unstageCards());

  d.middleDottedDropBox?.addEventListener('dragover', (e) => {
    if (!store.gameState) return;
    if (store.gameState.currentTurnPlayerId === store.myPlayerId && store.gameState.turnPhase === 'DROP') {
      e.preventDefault();
      d.middleDottedDropBox.classList.add('drag-over');
    }
  });
  d.middleDottedDropBox?.addEventListener('dragleave', () => {
    d.middleDottedDropBox.classList.remove('drag-over');
  });
  d.middleDottedDropBox?.addEventListener('drop', (e) => {
    e.preventDefault();
    d.middleDottedDropBox.classList.remove('drag-over');
    const cardId = e.dataTransfer.getData('text/plain');
    if (cardId) ui.onHandCardClick(cardId);
  });

  // Draw Deck & Discard Stack Piles
  d.drawPileBtn?.addEventListener('click', () => {
    if (!store.gameState) return;
    if (store.gameState.currentTurnPlayerId !== store.myPlayerId) {
      ui.showToast('Wait for your turn to draw');
      return;
    }

    if (store.stagedCards.length > 0) {
      const dropIds = store.stagedCards.map((c) => c.id);
      store.stagedCards = [];
      flyCardWipe(d.drawPileBtn, d.myHandCards, '🂠', {
        cardClass: 'deck-back-pattern',
        duration: GAME_CONSTANTS.ANIM_DURATION_DRAW_MS,
        onComplete: () => {
          socket.emit('dropAndDraw', { dropCardIds: dropIds, source: 'DECK' });
          soundFx.playCardDraw();
          nativeBridge.triggerHaptic('draw');
        }
      });
    } else if (store.gameState.turnPhase === 'DRAW') {
      flyCardWipe(d.drawPileBtn, d.myHandCards, '🂠', {
        cardClass: 'deck-back-pattern',
        duration: GAME_CONSTANTS.ANIM_DURATION_DRAW_MS,
        onComplete: () => {
          socket.emit('drawCard', { source: 'DECK' });
          soundFx.playCardDraw();
          nativeBridge.triggerHaptic('draw');
        }
      });
    } else {
      ui.showToast('👉 Drop your card(s) in the middle first!');
      ui.shakeDropBox();
    }
  });

  d.discardStackPile?.addEventListener('click', () => {
    if (!store.gameState) return;
    const isMyTurn = store.gameState.currentTurnPlayerId === store.myPlayerId;
    const myPlayer = store.gameState.players.find((p) => p.id === store.myPlayerId);
    const topDiscard = store.gameState.topDiscard;

    if (isMyTurn && store.stagedCards.length > 0) {
      const dropIds = store.stagedCards.map((c) => c.id);
      store.stagedCards = [];
      flyCardWipe(d.discardStackPile, d.myHandCards, topDiscard ? createCardInner(topDiscard, false) : '', {
        cardClass: topDiscard ? `${topDiscard.color}` : '',
        duration: GAME_CONSTANTS.ANIM_DURATION_DRAW_MS,
        onComplete: () => {
          socket.emit('dropAndDraw', { dropCardIds: dropIds, source: 'DISCARD' });
          soundFx.playCardDraw();
          nativeBridge.triggerHaptic('draw');
        }
      });
    } else if (isMyTurn && store.gameState.turnPhase === 'DRAW') {
      flyCardWipe(d.discardStackPile, d.myHandCards, topDiscard ? createCardInner(topDiscard, false) : '', {
        cardClass: topDiscard ? `${topDiscard.color}` : '',
        duration: GAME_CONSTANTS.ANIM_DURATION_DRAW_MS,
        onComplete: () => {
          socket.emit('drawCard', { source: 'DISCARD' });
          soundFx.playCardDraw();
          nativeBridge.triggerHaptic('draw');
        }
      });
    } else {
      if (isMyTurn) {
        if (myPlayer && topDiscard) {
          const hasMatch = myPlayer.hand.some((c) => c.rank === topDiscard.rank || (c.isWild && topDiscard.isWild));
          if (hasMatch) {
            ui.executeSlash();
            return;
          }
        }
        ui.showToast('👉 Drop your card(s) in the middle first!');
        ui.shakeDropBox();
      } else {
        ui.showToast('Wait for your turn');
      }
    }
  });

  d.slashBtn?.addEventListener('click', () => ui.executeSlash());
  d.sortCardsBtn?.addEventListener('click', () => ui.sortMyHand(true));
  d.callShowBtn?.addEventListener('click', () => ui.declareShow());
}

function initSocketListeners() {
  socket.on('connect', () => {
    const savedRoom = store.getSavedRoomCode();
    if (savedRoom) {
      const savedName = localStorage.getItem(STORAGE_KEYS.PLAYER_NAME) || 'Player';
      socket.emit('joinRoom', {
        roomCode: savedRoom,
        playerId: store.persistentPlayerId,
        playerName: savedName,
        avatar: store.myAvatar
      });
    }
  });

  socket.on('connect_error', () => {
    if (isNativeApp()) {
      ui.showToast('📡 Connecting to multiplayer arena…');
    }
  });

  socket.on('roomJoined', (data) => {
    store.savePlayerId(data.playerId || store.persistentPlayerId);
    store.setRoomCode(data.roomCode);

    if (ui.dom.roomBadge) ui.dom.roomBadge.style.display = 'flex';
    if (ui.dom.exitTableBtn) ui.dom.exitTableBtn.style.display = 'inline-block';
    if (ui.dom.roomBadgeCode) ui.dom.roomBadgeCode.innerText = data.roomCode;
    if (ui.dom.lobbyRoomCode) ui.dom.lobbyRoomCode.innerText = data.roomCode;

    if (!isNativeApp()) {
      const newUrl = `${window.location.pathname}?room=${data.roomCode}`;
      window.history.replaceState(null, '', newUrl);
    }

    ui.renderGameState(data.state);
  });

  socket.on('gameState', (state) => ui.renderGameState(state));
  socket.on('turnTimerTick', (payload) => ui.onTimerTick(payload));
  socket.on('playerEmoji', ({ playerId, emoji }) => ui.showPlayerEmoji(playerId, emoji));

  socket.on('leftRoom', () => {
    store.resetRoomSession();
    ui.showHomeScreen();
    if (!isNativeApp()) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  });

  socket.on('roomError', (msg) => {
    store.setRoomCode(null);
    ui.showToast(`⚠️ ${msg}`, 3400);
    if (ui.dom.lobbyScreen.style.display !== 'none' || ui.dom.gameScreen.style.display !== 'none') {
      ui.dom.lobbyScreen.style.display = 'none';
      ui.dom.gameScreen.style.display = 'none';
      ui.dom.homeScreen.style.display = 'flex';
    }
  });

  socket.on('actionError', (msg) => ui.showToast(`⚠️ ${msg}`, 2800));
}

// Bootstrap Application
document.addEventListener('DOMContentLoaded', () => {
  initUIEventListeners();
  initSocketListeners();
  nativeBridge.init({
    onBackButton: handleHardwareBack,
    onDeepLinkRoom: (code) => {
      ui.dom.joinCodeInput.value = code;
      handleJoinWithCode(code);
    }
  });
});
