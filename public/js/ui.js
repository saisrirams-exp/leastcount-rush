/**
 * Table UI Controller & Interactive Touch/Drag Renderer
 * Decouples DOM manipulation & mobile ergonomics cleanly from Socket networking.
 */
import { store } from './state.js';
import { soundFx } from './sound.js';
import { nativeBridge } from './native-bridge.js';
import { calculateHandScore, createCardInner, sortCardsArray } from './cards.js';
import {
  flyCardWipe,
  flyOpponentGhostCard,
  flyOpponentPlayCards,
  launchCelebrationConfetti,
  spawnFloatingEmoji
} from './animations.js';
import { GAME_CONSTANTS, STORAGE_KEYS, getPublicWebUrl } from './config.js';

export class TableUIController {
  constructor(actions) {
    this.actions = actions; // { onDropAndDraw, onDrawCard, onSlashCards, onCallShow, onRemoveBot, onToggleAutoPlay, onSendEmoji, onExitTable }
    this.toastTimer = null;
    this.outcomeTimer = null;
    this.confirmResolver = null;
    this.dom = this._collectDOM();
  }

  _collectDOM() {
    const id = (k) => document.getElementById(k);
    return {
      homeScreen: id('homeScreen'),
      lobbyScreen: id('lobbyScreen'),
      gameScreen: id('gameScreen'),
      createTableModal: id('createTableModal'),
      resultsModal: id('resultsModal'),
      rulesModal: id('rulesModal'),
      gameMenuModal: id('gameMenuModal'),

      inviteBlock: id('inviteBlock'),
      standardBlock: id('standardBlock'),
      inviteCodeLabel: id('inviteCodeLabel'),
      inviteJoinBtn: id('inviteJoinBtn'),
      showNormalHomeBtn: id('showNormalHomeBtn'),

      playerNameInput: id('playerNameInput'),
      joinCodeInput: id('joinCodeInput'),
      openCreateModalBtn: id('openCreateModalBtn'),
      quickPlayBotsBtn: id('quickPlayBotsBtn'),
      cancelCreateModalBtn: id('cancelCreateModalBtn'),
      confirmCreateBtn: id('confirmCreateBtn'),
      joinRoomBtn: id('joinRoomBtn'),

      maxPlayersSlider: id('maxPlayersSlider'),
      playerSliderValue: id('playerSliderValue'),
      deckCapacityInfo: id('deckCapacityInfo'),

      roomBadge: id('roomBadge'),
      roomBadgeCode: id('roomBadgeCode'),
      copyInviteBtn: id('copyInviteBtn'),
      copyInviteLinkBtn: id('copyInviteLinkBtn'),
      shareInviteBtn: id('shareInviteBtn'),
      exitTableBtn: id('exitTableBtn'),
      adminStopGameBtn: id('adminStopGameBtn'),
      openRulesBtn: id('openRulesBtn'),
      homeRulesBtn: id('homeRulesBtn'),
      closeRulesBtn: id('closeRulesBtn'),
      heroAvatarDisplay: id('heroAvatarDisplay'),
      gameToast: id('gameToast'),

      lobbyRoomCode: id('lobbyRoomCode'),
      lobbyCapacityLabel: id('lobbyCapacityLabel'),
      playerCountLabel: id('playerCountLabel'),
      maxCapacityLabel: id('maxCapacityLabel'),
      waitingPlayerList: id('waitingPlayerList'),
      hostLobbyControls: id('hostLobbyControls'),
      nonHostLobbyMessage: id('nonHostLobbyMessage'),
      addSingleBotBtn: id('addSingleBotBtn'),
      fillBotsBtn: id('fillBotsBtn'),
      startGameBtn: id('startGameBtn'),

      topAppBar: document.querySelector('header.app-bar'),
      opponentsPerimeter: id('opponentsPerimeter'),
      tableCodeInHud: id('tableCodeInHud'),
      gameMenuToggleBtn: id('gameMenuToggleBtn'),
      menuCloseBtn: id('menuCloseBtn'),
      menuRulesBtn: id('menuRulesBtn'),
      menuCopyLinkBtn: id('menuCopyLinkBtn'),
      menuMuteSoundBtn: id('menuMuteSoundBtn'),
      menuAdminStopBtn: id('menuAdminStopBtn'),
      menuExitBtn: id('menuExitBtn'),
      menuTableCodeLabel: id('menuTableCodeLabel'),

      rotateDevicePrompt: id('rotateDevicePrompt'),
      dismissRotatePromptBtn: id('dismissRotatePromptBtn'),
      landscapeShieldOverlay: id('landscapeShieldOverlay'),
      forceRotateLandscapeBtn: id('forceRotateLandscapeBtn'),
      hudRotateBtn: id('hudRotateBtn'),
      hudScoreboardBtn: id('hudScoreboardBtn'),
      yourTurnBanner: id('yourTurnBanner'),
      outcomeCallout: id('outcomeCallout'),
      outcomeCalloutEmoji: id('outcomeCalloutEmoji'),
      outcomeCalloutText: id('outcomeCalloutText'),

      roundNumberBadge: id('roundNumberBadge'),
      deckShoeBadge: id('deckShoeBadge'),
      actionBanner: id('actionBanner'),
      eliminationScoreBadge: id('eliminationScoreBadge'),
      wildJokerSlot: id('wildJokerSlot'),
      wildJokerMiniLabel: id('wildJokerMiniLabel'),
      drawPileBtn: id('drawPileBtn'),
      middleDottedDropBox: id('middleDottedDropBox'),
      middleDropPlaceholder: id('middleDropPlaceholder'),
      middleStagedCardContainer: id('middleStagedCardContainer'),
      returnStagedCardBtn: id('returnStagedCardBtn'),
      sortCardsBtn: id('sortCardsBtn'),
      discardStackPile: id('discardStackPile'),
      discardPileCardWrapper: id('discardPileCardWrapper'),
      deckCountBadge: id('deckCountBadge'),
      timerCircle: id('timerCircle'),

      myAvatarBox: id('myAvatarBox'),
      myTurnRing: id('myTurnRing'),
      myTurnTimerBadge: id('myTurnTimerBadge'),
      myPlayerAvatar: id('myPlayerAvatar'),
      myHandPoints: id('myHandPoints'),
      myGameScore: id('myGameScore'),
      maxScoreTarget: id('maxScoreTarget'),
      emojiPickerToggleBtn: id('emojiPickerToggleBtn'),
      emojiPickerPopup: id('emojiPickerPopup'),
      autoPlayBtn: id('autoPlayBtn'),
      eliminatedSpectatorBar: id('eliminatedSpectatorBar'),
      spectatorExitBtn: id('spectatorExitBtn'),
      turnStatusBadge: id('turnStatusBadge'),
      myHandCards: id('myHandCards'),
      cornerActionButton: id('cornerActionButton'),
      dropCardsBtn: id('dropCardsBtn'),
      callShowBtn: id('callShowBtn'),
      callShowPoints: id('callShowPoints'),
      slashBtn: id('slashBtn'),
      slashRankText: id('slashRankText'),

      resultsTitle: id('resultsTitle'),
      resultsSubtitle: id('resultsSubtitle'),
      resultsTableBody: id('resultsTableBody'),
      eliminatedNotice: id('eliminatedNotice'),
      openScoreMatrixFromResultsBtn: id('openScoreMatrixFromResultsBtn'),
      closeResultsSpectateBtn: id('closeResultsSpectateBtn'),
      hostNextRoundContainer: id('hostNextRoundContainer'),
      nonHostNextRoundMessage: id('nonHostNextRoundMessage'),
      nextRoundBtn: id('nextRoundBtn'),

      scoreMatrixModal: id('scoreMatrixModal'),
      matrixRoundTitle: id('matrixRoundTitle'),
      matrixScoreLimit: id('matrixScoreLimit'),
      scoreMatrixHead: id('scoreMatrixHead'),
      scoreMatrixBody: id('scoreMatrixBody'),
      scoreMatrixFoot: id('scoreMatrixFoot'),
      closeScoreMatrixBtn: id('closeScoreMatrixBtn'),

      confirmDialogModal: id('confirmDialogModal'),
      confirmDialogTitle: id('confirmDialogTitle'),
      confirmDialogMessage: id('confirmDialogMessage'),
      confirmDialogOkBtn: id('confirmDialogOkBtn'),
      confirmDialogCancelBtn: id('confirmDialogCancelBtn')
    };
  }

  askConfirm({ title = 'Confirm Action', message = '', okText = 'Confirm' }) {
    const modal = this.dom.confirmDialogModal;
    if (!modal) {
      return Promise.resolve(window.confirm(message));
    }
    this.dom.confirmDialogTitle.innerText = title;
    this.dom.confirmDialogMessage.innerText = message;
    this.dom.confirmDialogOkBtn.innerText = okText;
    modal.style.display = 'flex';

    return new Promise((resolve) => {
      const cleanup = (accepted) => {
        modal.style.display = 'none';
        this.dom.confirmDialogOkBtn.onclick = null;
        this.dom.confirmDialogCancelBtn.onclick = null;
        resolve(accepted);
      };
      this.dom.confirmDialogOkBtn.onclick = () => cleanup(true);
      this.dom.confirmDialogCancelBtn.onclick = () => cleanup(false);
    });
  }

  showToast(msg, duration = 2400) {
    const toast = this.dom.gameToast;
    if (!toast) return;
    toast.innerText = msg;
    toast.style.display = 'block';
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, duration);
  }

  updateDeckCapacityLabel(playerCount) {
    if (this.dom.playerSliderValue) {
      this.dom.playerSliderValue.innerText = `${playerCount} Players`;
    }
    if (!this.dom.deckCapacityInfo) return;
    if (playerCount <= 7) {
      this.dom.deckCapacityInfo.innerHTML = '🃏 <strong>2 Decks Shoe</strong> (108 cards with Jokers)';
    } else if (playerCount <= 11) {
      this.dom.deckCapacityInfo.innerHTML = '🃏 <strong>3 Decks Shoe</strong> (162 cards with Jokers)';
    } else {
      this.dom.deckCapacityInfo.innerHTML = '🃏 <strong>4 Decks Shoe</strong> (216 cards with Jokers)';
    }
  }

  openRules() {
    if (this.dom.rulesModal) this.dom.rulesModal.style.display = 'flex';
    nativeBridge.triggerHaptic('tap');
  }

  closeRules() {
    if (this.dom.rulesModal) this.dom.rulesModal.style.display = 'none';
    nativeBridge.triggerHaptic('tap');
  }

  shakeDropBox() {
    const box = this.dom.middleDottedDropBox;
    if (!box) return;
    box.classList.remove('shake');
    void box.offsetWidth;
    box.classList.add('shake');
    setTimeout(() => box.classList.remove('shake'), 450);
  }

  copyInvite() {
    if (!store.currentRoomCode) return;
    const link = `${getPublicWebUrl()}/?room=${store.currentRoomCode}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(link)
        .then(() => {
          this.showToast(`📋 Table link copied: ${link}`);
        })
        .catch(() => {
          prompt('Copy invite link:', link);
        });
    } else {
      prompt('Copy invite link:', link);
    }
  }

  shareInvite() {
    if (!store.currentRoomCode) return;
    const link = `${getPublicWebUrl()}/?room=${store.currentRoomCode}`;
    nativeBridge.shareTableInvite({
      title: 'Least Count Rush',
      text: `🃏 Join my Least Count Rush table! Code: ${store.currentRoomCode}`,
      url: link,
      onCopyFallback: () => this.copyInvite()
    });
  }

  checkOrientationHelper() {
    const isGameVisible = this.dom.gameScreen && this.dom.gameScreen.style.display !== 'none';
    const isPortrait = !store.isForceRotated && window.innerHeight > window.innerWidth;

    if (this.dom.landscapeShieldOverlay) {
      this.dom.landscapeShieldOverlay.style.display = isGameVisible && isPortrait ? 'flex' : 'none';
    }

    if (window.innerWidth >= window.innerHeight && store.isForceRotated) {
      store.isForceRotated = false;
      this.dom.gameScreen?.classList.remove('force-landscape-rotated');
      this.dom.resultsModal?.classList.remove('force-landscape-rotated');
      this.dom.gameMenuModal?.classList.remove('force-landscape-rotated');
      this.dom.scoreMatrixModal?.classList.remove('force-landscape-rotated');
      this.dom.confirmDialogModal?.classList.remove('force-landscape-rotated');
    }
  }

  toggleForceLandscape() {
    store.isForceRotated = !store.isForceRotated;
    if (store.isForceRotated) {
      this.dom.gameScreen?.classList.add('force-landscape-rotated');
      this.dom.resultsModal?.classList.add('force-landscape-rotated');
      this.dom.gameMenuModal?.classList.add('force-landscape-rotated');
      this.dom.scoreMatrixModal?.classList.add('force-landscape-rotated');
      this.dom.confirmDialogModal?.classList.add('force-landscape-rotated');
      if (this.dom.landscapeShieldOverlay) {
        this.dom.landscapeShieldOverlay.style.display = 'none';
      }
      nativeBridge.triggerHaptic('tap');
      try {
        if (document.documentElement.requestFullscreen) {
          document.documentElement
            .requestFullscreen()
            .then(() => nativeBridge.lockLandscape())
            .catch(() => {});
        } else {
          nativeBridge.lockLandscape();
        }
      } catch (e) {}
    } else {
      this.dom.gameScreen?.classList.remove('force-landscape-rotated');
      this.dom.resultsModal?.classList.remove('force-landscape-rotated');
      this.dom.gameMenuModal?.classList.remove('force-landscape-rotated');
      this.dom.scoreMatrixModal?.classList.remove('force-landscape-rotated');
      this.dom.confirmDialogModal?.classList.remove('force-landscape-rotated');
      this.checkOrientationHelper();
    }

    if (store.gameState?.players) {
      const opponents = store.gameState.players.filter((p) => p.id !== store.myPlayerId);
      this.renderOpponents(opponents, store.gameState.currentTurnPlayerId);
    }
  }

  showHomeScreen() {
    if (this.dom.topAppBar) this.dom.topAppBar.style.display = 'flex';
    if (this.dom.roomBadge) this.dom.roomBadge.style.display = 'none';
    if (this.dom.lobbyScreen) this.dom.lobbyScreen.style.display = 'none';
    if (this.dom.gameScreen) {
      this.dom.gameScreen.style.display = 'none';
      this.dom.gameScreen.classList.remove('force-landscape-rotated');
    }
    if (this.dom.resultsModal) this.dom.resultsModal.style.display = 'none';
    if (this.dom.scoreMatrixModal) this.dom.scoreMatrixModal.style.display = 'none';
    if (this.dom.confirmDialogModal) this.dom.confirmDialogModal.style.display = 'none';
    if (this.dom.gameMenuModal) this.dom.gameMenuModal.style.display = 'none';
    if (this.dom.emojiPickerPopup) this.dom.emojiPickerPopup.style.display = 'none';
    if (this.dom.rotateDevicePrompt) this.dom.rotateDevicePrompt.style.display = 'none';
    if (this.dom.landscapeShieldOverlay) this.dom.landscapeShieldOverlay.style.display = 'none';
    if (this.dom.homeScreen) this.dom.homeScreen.style.display = 'flex';
    nativeBridge.setImmersiveGameplay(false);
  }

  _updateAvatarTurnTimers(turnTimeRemaining, currentTurnPlayerId) {
    const duration = Math.max(1, store.gameState?.turnDuration || 12);
    const pct = Math.max(0, Math.min(100, Math.round((turnTimeRemaining / duration) * 100)));
    const isUrgent = turnTimeRemaining <= 4;
    const isSelfTurn = currentTurnPlayerId === store.myPlayerId && store.gameState?.status === 'PLAYING';

    if (this.dom.myTurnRing && this.dom.myTurnTimerBadge) {
      this.dom.myTurnRing.classList.toggle('active-turn-ring', isSelfTurn);
      this.dom.myTurnRing.classList.toggle('urgent', isSelfTurn && isUrgent);
      this.dom.myTurnRing.style.setProperty('--turn-pct', `${pct}%`);
      this.dom.myTurnTimerBadge.style.display = isSelfTurn ? 'inline-block' : 'none';
      this.dom.myTurnTimerBadge.innerText = `${turnTimeRemaining}s`;
      this.dom.myTurnTimerBadge.classList.toggle('urgent', isUrgent);
    }

    document.querySelectorAll('.opp-turn-timer-pill').forEach((pill) => {
      pill.style.display = pill.dataset.playerId === currentTurnPlayerId ? 'inline-block' : 'none';
      if (pill.dataset.playerId === currentTurnPlayerId) {
        pill.innerText = `${turnTimeRemaining}s`;
        pill.classList.toggle('urgent', isUrgent);
      }
    });
    document.querySelectorAll('.opponent-avatar-ring').forEach((ring) => {
      if (ring.dataset.playerId === currentTurnPlayerId) {
        ring.style.setProperty('--turn-pct', `${pct}%`);
        ring.classList.toggle('urgent', isUrgent);
      }
    });
  }

  onTimerTick({ turnTimeRemaining, currentTurnPlayerId }) {
    if (this.dom.timerCircle) {
      this.dom.timerCircle.innerText = turnTimeRemaining;
      if (turnTimeRemaining <= 3) {
        this.dom.timerCircle.classList.add('danger');
        if (currentTurnPlayerId === store.persistentPlayerId) {
          soundFx.playTimerTick();
        }
      } else {
        this.dom.timerCircle.classList.remove('danger');
      }
    }
    this._updateAvatarTurnTimers(turnTimeRemaining, currentTurnPlayerId);
  }

  renderGameState(state) {
    store.gameState = state;
    store.myPlayerId = store.persistentPlayerId;
    store.isHost = state.hostId === store.persistentPlayerId;

    const myPlayer = state.players.find((p) => p.id === store.myPlayerId);
    if (myPlayer?.hand && store.isAutoSortEnabled) {
      sortCardsArray(myPlayer.hand, true);
    }

    if (this.dom.adminStopGameBtn) {
      this.dom.adminStopGameBtn.style.display = store.isHost && state.status === 'PLAYING' ? 'inline-block' : 'none';
    }
    if (this.dom.exitTableBtn) {
      this.dom.exitTableBtn.style.display = 'inline-block';
    }

    if (state.status === 'LOBBY') {
      if (this.dom.topAppBar) this.dom.topAppBar.style.display = 'flex';
      this.dom.homeScreen.style.display = 'none';
      this.dom.gameScreen.style.display = 'none';
      this.dom.lobbyScreen.style.display = 'flex';
      this.dom.resultsModal.style.display = 'none';
      if (this.dom.scoreMatrixModal) this.dom.scoreMatrixModal.style.display = 'none';
      if (this.dom.outcomeCallout) this.dom.outcomeCallout.style.display = 'none';
      if (this.dom.rotateDevicePrompt) this.dom.rotateDevicePrompt.style.display = 'none';
      store.spectatingRoundOver = false;
      nativeBridge.setImmersiveGameplay(false);
      this.renderLobby(state);
    } else if (state.status === 'PLAYING') {
      if (this.dom.topAppBar) this.dom.topAppBar.style.display = 'none';
      this.dom.homeScreen.style.display = 'none';
      this.dom.lobbyScreen.style.display = 'none';
      this.dom.gameScreen.style.display = 'flex';
      this.dom.resultsModal.style.display = 'none';
      if (this.dom.outcomeCallout) this.dom.outcomeCallout.style.display = 'none';
      store.spectatingRoundOver = false;
      nativeBridge.setImmersiveGameplay(true);
      this.checkOrientationHelper();
      this.renderGameTable(state);
    } else if (state.status === 'ROUND_OVER' || state.status === 'GAME_OVER') {
      if (this.dom.topAppBar) this.dom.topAppBar.style.display = 'none';
      if (this.dom.rotateDevicePrompt) this.dom.rotateDevicePrompt.style.display = 'none';
      this.dom.homeScreen.style.display = 'none';
      this.dom.lobbyScreen.style.display = 'none';
      this.dom.gameScreen.style.display = 'flex';
      this.renderGameTable(state);
      this.handleRoundEnded(state.roundResults, state.status === 'GAME_OVER');
    }
  }

  renderLobby(state) {
    this.dom.playerCountLabel.innerText = state.players.length;
    this.dom.maxCapacityLabel.innerText = state.maxPlayers;
    const scoringName = state.faceCardScoring === 'CLASSIC_13' ? 'Classic (10-13)' : 'Standard (10s)';
    this.dom.lobbyCapacityLabel.innerText = `Supports ${state.maxPlayers} Players • ${state.deckCountUsed} Decks • ${scoringName} • Knockout at ${state.eliminationScore} pts`;

    this.dom.waitingPlayerList.innerHTML = '';
    state.players.forEach((p) => {
      const chip = document.createElement('div');
      chip.className = 'waiting-player-chip';

      const avatar = p.isBot ? '🤖' : p.avatar || (p.id === state.hostId ? '👑' : '👤');
      const role = p.id === state.hostId ? 'HOST' : p.isBot ? 'BOT' : 'PLAYER';

      chip.innerHTML = `
        <div class="avatar">${avatar}</div>
        <div class="name" title="${p.name}">${p.name}</div>
        <div class="role-tag">${role}</div>
      `;

      if (store.isHost && p.isBot) {
        const kickBtn = document.createElement('button');
        kickBtn.className = 'btn-kick';
        kickBtn.title = 'Remove Bot';
        kickBtn.textContent = '✕';
        kickBtn.addEventListener('click', () => this.actions.onRemoveBot(p.id));
        chip.appendChild(kickBtn);
      }

      this.dom.waitingPlayerList.appendChild(chip);
    });

    if (store.isHost) {
      this.dom.hostLobbyControls.style.display = 'block';
      this.dom.nonHostLobbyMessage.style.display = 'none';
      const isFull = state.players.length >= state.maxPlayers;
      this.dom.addSingleBotBtn.style.display = isFull ? 'none' : 'block';
      this.dom.fillBotsBtn.style.display = isFull ? 'none' : 'block';
      this.dom.startGameBtn.disabled = state.players.length < 2;
      this.dom.startGameBtn.innerText =
        state.players.length < 2
          ? `Add at least 1 more player/bot to start (${state.players.length}/${state.maxPlayers})`
          : `Start Game (${state.players.length} Players)`;
    } else {
      this.dom.hostLobbyControls.style.display = 'none';
      this.dom.nonHostLobbyMessage.style.display = 'block';
    }
  }

  renderGameTable(state) {
    this.dom.roundNumberBadge.innerText = state.roundNumber;
    const scoringBadge = state.faceCardScoring === 'CLASSIC_13' ? 'Classic 10-13' : 'Standard 10s';
    this.dom.deckShoeBadge.innerText = `(${state.deckCountUsed} Decks • ${scoringBadge})`;
    this.dom.eliminationScoreBadge.innerText = state.eliminationScore;
    if (this.dom.maxScoreTarget) this.dom.maxScoreTarget.innerText = state.eliminationScore;
    if (this.dom.tableCodeInHud) {
      this.dom.tableCodeInHud.innerText = state.roomCode || store.currentRoomCode || '------';
    }

    if (state.roundNumber && state.roundNumber !== store.lastObservedRoundNumber) {
      store.lastObservedRoundNumber = state.roundNumber;
      store.isRoundDealAnimationActive = true;
      soundFx.playCardWhoosh();
    }

    if (state.lastAction) {
      this.dom.actionBanner.innerText = state.lastAction.text;
      const actionKey = `${state.roundNumber}_${state.lastAction.playerId || ''}_${state.lastAction.type || ''}_${state.lastAction.text || ''}`;
      if (store.lastObservedActionKey !== actionKey) {
        store.lastObservedActionKey = actionKey;
        const actorId = state.lastAction.playerId;
        if (actorId && actorId !== store.myPlayerId) {
          const oppEl = document.getElementById(`oppSlot_${actorId}`);
          if (oppEl) {
            const actionType = state.lastAction.type;
            const droppedCards = state.lastAction.cards;
            if (actionType === 'DROP' || actionType === 'SLASH' || actionType === 'PLAY') {
              if (Array.isArray(droppedCards) && droppedCards.length > 0) {
                flyOpponentPlayCards(oppEl, this.dom.middleDottedDropBox, droppedCards, createCardInner);
              } else {
                flyOpponentGhostCard(oppEl, this.dom.middleDottedDropBox);
              }
              if (actionType === 'PLAY') {
                const drawFrom = state.lastAction.source === 'DISCARD' ? this.dom.discardStackPile : this.dom.drawPileBtn;
                setTimeout(() => flyOpponentGhostCard(drawFrom, oppEl), 170);
              }
            } else if (actionType === 'DRAW') {
              const drawFrom = state.lastAction.source === 'DISCARD' ? this.dom.discardStackPile : this.dom.drawPileBtn;
              flyOpponentGhostCard(drawFrom, oppEl);
            }
          }
        }
      }
    }

    this.dom.deckCountBadge.innerText = state.drawPileCount;
    if (this.dom.timerCircle) this.dom.timerCircle.innerText = state.turnTimeRemaining;
    this._updateAvatarTurnTimers(state.turnTimeRemaining, state.currentTurnPlayerId);

    const myPlayerForTurn = state.players.find((p) => p.id === store.myPlayerId);
    const isMyActiveTurn =
      state.status === 'PLAYING' &&
      state.currentTurnPlayerId === store.myPlayerId &&
      myPlayerForTurn &&
      !myPlayerForTurn.eliminated &&
      !myPlayerForTurn.waitingNextRound;
    if (this.dom.yourTurnBanner) {
      this.dom.yourTurnBanner.style.display = isMyActiveTurn ? 'inline-flex' : 'none';
    }

    if (state.wildJokerCard) {
      this.dom.wildJokerSlot.innerHTML = createCardInner(state.wildJokerCard, true);
      this.dom.wildJokerSlot.className = `wild-joker-under-card single-card ${state.wildJokerCard.color}`;
    } else {
      this.dom.wildJokerSlot.innerHTML = '';
    }

    if (state.topDiscard) {
      this.dom.discardPileCardWrapper.innerHTML = `
        <div class="single-card ${state.topDiscard.color} ${state.topDiscard.isWild ? 'wild-joker-card' : ''}">
          ${createCardInner(state.topDiscard, false)}
        </div>
      `;
    } else {
      this.dom.discardPileCardWrapper.innerHTML =
        '<div class="single-card" style="opacity:0.25; border:1.5px dashed rgba(255,255,255,0.3);"></div>';
    }

    const opponents = state.players.filter((p) => p.id !== store.myPlayerId);
    this.renderOpponents(opponents, state.currentTurnPlayerId);

    const myPlayer = state.players.find((p) => p.id === store.myPlayerId);
    if (myPlayer) {
      if (this.dom.myPlayerAvatar) {
        this.dom.myPlayerAvatar.innerText = myPlayer.eliminated ? '💀' : myPlayer.isBot ? '🤖' : myPlayer.avatar || store.myAvatar || '👑';
      }
      if (this.dom.myAvatarBox) {
        this.dom.myAvatarBox.classList.toggle('eliminated', Boolean(myPlayer.eliminated));
      }
      if (this.dom.autoPlayBtn) {
        this.dom.autoPlayBtn.classList.toggle('active', Boolean(myPlayer.autoPlay));
        this.dom.autoPlayBtn.style.display = myPlayer.eliminated || myPlayer.waitingNextRound ? 'none' : 'inline-flex';
      }
      if (this.dom.eliminatedSpectatorBar) {
        this.dom.eliminatedSpectatorBar.style.display = myPlayer.eliminated ? 'flex' : 'none';
      }
      if (this.dom.myHandCards) {
        this.dom.myHandCards.style.display = myPlayer.eliminated ? 'none' : 'flex';
      }
      if (this.dom.myGameScore) {
        this.dom.myGameScore.innerText = myPlayer.score;
      }
      this.updateHandUI();
      this.updateActionUI();
    }
  }

  renderOpponents(opponents, currentTurnPlayerId) {
    const container = this.dom.opponentsPerimeter;
    if (!container) return;
    container.innerHTML = '';
    if (!opponents || opponents.length === 0) return;

    const total = opponents.length;
    const isHorizontal = store.isForceRotated || window.innerWidth >= window.innerHeight;

    opponents.forEach((p, idx) => {
      const isCurrentTurn = p.id === currentTurnPlayerId;
      const slotDiv = document.createElement('div');
      const avatarEmoji = p.eliminated ? '💀' : p.isBot ? '🤖' : p.avatar || '👤';
      const countDisplay = p.eliminated
        ? '💀'
        : p.waitingNextRound
          ? '👁️'
          : p.cardCount !== undefined
            ? p.cardCount
            : 7;

      if (isHorizontal) {
        let slotClass = 'slot-top-center';
        if (total === 1) slotClass = 'slot-top-center';
        else if (total === 2) slotClass = ['slot-top-left', 'slot-top-right'][idx] || 'slot-top-center';
        else if (total === 3) slotClass = ['slot-left', 'slot-top-center', 'slot-right'][idx] || 'slot-top-center';
        else if (total === 4) {
          slotClass = ['slot-left', 'slot-top-left', 'slot-top-right', 'slot-right'][idx] || 'slot-top-center';
        } else if (total === 5) {
          slotClass =
            ['slot-left', 'slot-top-left', 'slot-top-center', 'slot-top-right', 'slot-right'][idx] || 'slot-top-center';
        }

        if (total <= 5) {
          slotDiv.className = `opponent-slot compact-landscape ${slotClass} ${isCurrentTurn ? 'active-turn' : ''} ${p.eliminated ? 'eliminated' : ''}`;
        } else {
          const angle = Math.PI - (idx / (total - 1)) * Math.PI;
          const leftPct = 50 - 44 * Math.cos(angle);
          const topPct = 38 - 21 * Math.sin(angle);
          slotDiv.className = `opponent-slot compact-landscape ${isCurrentTurn ? 'active-turn' : ''} ${p.eliminated ? 'eliminated' : ''}`;
          slotDiv.style.left = `${leftPct}%`;
          slotDiv.style.top = `${topPct}%`;
          slotDiv.style.transform = 'translate(-50%, -50%)';
          if (leftPct > 70) slotDiv.style.flexDirection = 'row-reverse';
        }
      } else {
        let leftPct = 50;
        let topPct = 9;
        let flexDir = 'row';

        if (total <= 3) {
          if (idx === 0) {
            leftPct = 12;
            topPct = 26;
            flexDir = 'row';
          } else if (idx === 1) {
            leftPct = 50;
            topPct = 9;
            flexDir = 'column';
          } else {
            leftPct = 88;
            topPct = 26;
            flexDir = 'row-reverse';
          }
        } else {
          const sideCount = Math.max(1, Math.floor(total * 0.35));
          const topCount = total - 2 * sideCount;

          if (idx < sideCount) {
            const step = sideCount > 1 ? idx / (sideCount - 1) : 0.5;
            leftPct = 9;
            topPct = 36 - step * 18;
            flexDir = 'row';
          } else if (idx < sideCount + topCount) {
            const topIdx = idx - sideCount;
            const step = topCount > 1 ? topIdx / (topCount - 1) : 0.5;
            leftPct = 24 + step * 52;
            topPct = 9;
            flexDir = 'column';
          } else {
            const rightIdx = idx - (sideCount + topCount);
            const step = sideCount > 1 ? rightIdx / (sideCount - 1) : 0.5;
            leftPct = 91;
            topPct = 18 + step * 18;
            flexDir = 'row-reverse';
          }
        }

        slotDiv.className = `opponent-slot compact-portrait ${isCurrentTurn ? 'active-turn' : ''} ${p.eliminated ? 'eliminated' : ''}`;
        slotDiv.style.left = `${leftPct}%`;
        slotDiv.style.top = `${topPct}%`;
        slotDiv.style.transform = 'translate(-50%, -50%)';
        slotDiv.style.flexDirection = flexDir;
      }

      slotDiv.setAttribute('data-player-id', p.id);
      slotDiv.id = `oppSlot_${p.id}`;

      const isShowCaller =
        (store.gameState?.status === 'ROUND_OVER' || store.gameState?.status === 'GAME_OVER') &&
        store.gameState?.roundResults?.caller?.id === p.id;
      const timerPill = isCurrentTurn && !p.eliminated && store.gameState?.status === 'PLAYING'
        ? `<span class="opp-turn-timer-pill" data-player-id="${p.id}">${store.gameState?.turnTimeRemaining ?? 12}s</span>`
        : '';
      const showedTag = isShowCaller ? `<span class="opp-showed-pill">Showed</span>` : '';
      const elimTag = p.eliminated ? `<span class="opp-elim-tag">ELIMINATED</span>` : '';

      slotDiv.innerHTML = `
        <div class="opponent-profile">
          ${timerPill}
          ${showedTag}
          <div class="opponent-avatar-ring ${isCurrentTurn ? 'active-turn-ring' : ''}" data-player-id="${p.id}">
            ${isCurrentTurn ? '<div class="turn-halo"></div>' : ''}
            <span class="opponent-avatar-emoji">${avatarEmoji}</span>
          </div>
          <div class="opponent-name-label" title="${p.name}">${p.name}</div>
          ${elimTag}
        </div>
        ${
          p.eliminated
            ? ''
            : `<div class="opponent-cards-fan">
                 <div class="fan-card f1"></div>
                 <div class="fan-card f2"></div>
                 <div class="fan-card f3"></div>
                 <div class="fan-count-badge">${countDisplay}</div>
               </div>`
        }
      `;

      container.appendChild(slotDiv);
    });
  }

  onHandCardClick(cardId, cardEl) {
    if (!store.gameState) return;
    const isMyTurn = store.gameState.currentTurnPlayerId === store.myPlayerId;
    const isDropPhase = isMyTurn && store.gameState.turnPhase === 'DROP';
    const myPlayer = store.gameState.players.find((p) => p.id === store.myPlayerId);
    if (!myPlayer || !myPlayer.hand) return;

    const targetCard = myPlayer.hand.find((c) => c.id === cardId);
    if (!targetCard) return;

    if (!isDropPhase) {
      this.showToast(isMyTurn ? 'Tap Left Deck or Discard to finish drawing!' : 'Wait for your turn to drop cards');
      return;
    }

    const commitDrop = () => {
      if (store.stagedCards.length === 0) {
        store.stagedCards = [targetCard];
        soundFx.playCardDrop();
        nativeBridge.triggerHaptic('drop');
        this.updateHandUI();
        this.updateActionUI();
        this.showToast(`Dropped ${targetCard.rank}! Tap Left Deck or Discard to pick.`);
        return;
      }

      const firstRank = store.stagedCards[0].rank;
      const firstIsWild = store.stagedCards[0].isWild;
      const isSameRank = targetCard.rank === firstRank || (targetCard.isWild && firstIsWild);

      if (isSameRank) {
        if (!store.stagedCards.some((c) => c.id === targetCard.id)) {
          store.stagedCards.push(targetCard);
          soundFx.playCardDrop();
          nativeBridge.triggerHaptic('drop');
          this.updateHandUI();
          this.updateActionUI();
          this.showToast(`Added another ${targetCard.rank} (${store.stagedCards.length}x)! Tap Deck or Discard to finish.`);
        }
      } else {
        store.stagedCards = [targetCard];
        soundFx.playCardDrop();
        nativeBridge.triggerHaptic('drop');
        this.updateHandUI();
        this.updateActionUI();
        this.showToast(`Swapped to ${targetCard.rank}! Tap Left Deck or Discard to finish.`);
      }
    };

    const sourceEl = cardEl || document.querySelector(`.hand-card[data-card-id="${cardId}"]`);
    if (sourceEl && this.dom.middleDottedDropBox) {
      sourceEl.style.opacity = '0';
      flyCardWipe(sourceEl, this.dom.middleDottedDropBox, createCardInner(targetCard, false), {
        cardClass: `${targetCard.color} ${targetCard.isWild ? 'wild-joker-card' : ''}`,
        duration: GAME_CONSTANTS.ANIM_DURATION_DROP_MS,
        onComplete: commitDrop
      });
    } else {
      commitDrop();
    }
  }

  unstageCards() {
    if (store.stagedCards.length === 0) return;
    store.stagedCards = [];
    flyCardWipe(this.dom.middleDottedDropBox, this.dom.myHandCards, '', {
      duration: 200,
      onComplete: () => {
        soundFx.playCardDraw();
        this.updateHandUI();
        this.updateActionUI();
        this.showToast('Cards returned to hand ↩️');
      }
    });
  }

  executeSlash(explicitCardIds = null) {
    if (!store.gameState || !store.gameState.topDiscard) return;
    if (store.gameState.currentTurnPlayerId !== store.myPlayerId) {
      this.showToast('You can only Slash on your turn');
      return;
    }
    const myPlayer = store.gameState.players.find((p) => p.id === store.myPlayerId);
    if (!myPlayer) return;

    const topDiscard = store.gameState.topDiscard;
    const targetRank = topDiscard.rank;
    const isMatch = (c) => c.rank === targetRank || (c.isWild && topDiscard.isWild);

    let cardsToSlash = [];
    if (Array.isArray(explicitCardIds) && explicitCardIds.length > 0) {
      cardsToSlash = myPlayer.hand.filter((c) => explicitCardIds.includes(c.id) && isMatch(c));
    } else if (store.stagedCards.length > 0 && store.stagedCards.every(isMatch)) {
      const stagedIds = store.stagedCards.map((c) => c.id);
      cardsToSlash = myPlayer.hand.filter((c) => stagedIds.includes(c.id) && isMatch(c));
    } else {
      cardsToSlash = myPlayer.hand.filter(isMatch);
    }

    if (cardsToSlash.length === 0) {
      this.showToast(`Dropped card must match top discard (${targetRank}) to Slash.`);
      return;
    }

    const cardIds = cardsToSlash.map((c) => c.id);
    store.stagedCards = [];
    this.actions.onSlashCards(cardIds);
    soundFx.playSlash();
    nativeBridge.triggerHaptic('slash');
    this.showToast(`⚡ SLASHED ${targetRank}! Turn complete without drawing!`);
  }

  async declareShow() {
    const myPlayer = store.gameState?.players.find((p) => p.id === store.myPlayerId);
    const myScore = myPlayer ? calculateHandScore(myPlayer.hand) : 0;

    if (myScore > GAME_CONSTANTS.SHOW_THRESHOLD) {
      this.showToast('⚠️ You can only call SHOW when your hand total is 10 or below!');
      return;
    }

    const confirmed = await this.askConfirm({
      title: `Declare Show (${myScore} pts)?`,
      message:
        myPlayer.autoPlay
          ? `Call Show with ${myScore} points? Lowest hand scores 0; any tie or lower takes +40 penalty.`
          : `If your ${myScore} points are strictly the lowest at the table, you score 0!\nIf anyone ties or beats you, you take +40 penalty points.`,
      okText: '👑 Call Show'
    });

    if (confirmed) {
      if (store.stagedCards.length > 0) {
        store.stagedCards = [];
        this.updateHandUI();
      }
      nativeBridge.triggerHaptic('show');
      this.actions.onCallShow();
    }
  }

  sortMyHand(ascending = true) {
    store.isAutoSortEnabled = true;
    localStorage.setItem(STORAGE_KEYS.AUTO_SORT, 'true');
    if (!store.gameState) return;
    const myPlayer = store.gameState.players.find((p) => p.id === store.myPlayerId);
    if (!myPlayer || !myPlayer.hand) return;

    sortCardsArray(myPlayer.hand, ascending);
    soundFx.playCardDraw();
    this.showToast('🃏 Hand sorted ascending (0 ➔ K)');
    this.updateHandUI();
  }

  renderMiddleDropBox(isMyTurn, turnPhase) {
    if (store.stagedCards.length > 0) {
      this.dom.middleDropPlaceholder.style.display = 'none';
      this.dom.middleStagedCardContainer.style.display = 'block';
      this.dom.middleDottedDropBox.className = 'middle-drop-zone has-staged';

      const count = store.stagedCards.length;
      const isMobile = window.innerWidth <= 600;
      const cardW = isMobile ? 54 : 64;
      const cardH = isMobile ? 78 : 92;
      const offset = count > 1 ? Math.min(22, Math.floor(62 / (count - 1))) : 0;
      const totalW = cardW + (count - 1) * offset;
      const boxW = this.dom.middleDottedDropBox.clientWidth || (isMobile ? 122 : 140);
      const startLeft = Math.max(4, Math.floor((boxW - totalW) / 2));

      this.dom.middleStagedCardContainer.innerHTML = store.stagedCards
        .map(
          (card, i) => `
          <div class="single-card ${card.color} ${card.isWild ? 'wild-joker-card' : ''}"
               style="position:absolute; left:${startLeft + i * offset}px; top:4px; width:${cardW}px; height:${cardH}px; z-index:${i + 1}; pointer-events:none; box-shadow:-2px 3px 8px rgba(0,0,0,0.5);">
            ${createCardInner(card, false)}
          </div>`
        )
        .join('');

      if (this.dom.returnStagedCardBtn) this.dom.returnStagedCardBtn.style.display = 'none';
    } else {
      this.dom.middleDropPlaceholder.style.display = 'flex';
      this.dom.middleStagedCardContainer.style.display = 'none';
      this.dom.middleStagedCardContainer.innerHTML = '';
      if (this.dom.returnStagedCardBtn) this.dom.returnStagedCardBtn.style.display = 'none';
      this.dom.middleDottedDropBox.className =
        isMyTurn && turnPhase === 'DROP' ? 'middle-drop-zone active-drop' : 'middle-drop-zone';
    }
  }

  updateHandUI() {
    if (!store.gameState) return;
    const myPlayer = store.gameState.players.find((p) => p.id === store.myPlayerId);
    if (!myPlayer) return;

    if (myPlayer.hand && store.isAutoSortEnabled) {
      sortCardsArray(myPlayer.hand, true);
    }

    if (myPlayer.waitingNextRound) {
      this.dom.myHandCards.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 14px; text-align: center; background: rgba(0,0,0,0.35); border-radius: 14px; border: 1.5px dashed rgba(245,197,66,0.4); margin: 6px auto; max-width: 500px;">
          <div style="font-size: 15px; font-weight: bold; color: var(--gold); margin-bottom: 4px;">⏳ Spectating Round ${store.gameState.roundNumber}</div>
          <div style="color: rgba(253,250,243,0.85); font-size: 12px;">You will be dealt cards automatically as soon as Round ${store.gameState.roundNumber + 1} begins!</div>
        </div>
      `;
      return;
    }

    const isMyTurn = store.gameState.currentTurnPlayerId === store.myPlayerId;
    const isDropPhase = isMyTurn && store.gameState.turnPhase === 'DROP';

    const visibleHand = myPlayer.hand.filter((c) => !store.stagedCards.some((sc) => sc.id === c.id));
    this.dom.myHandPoints.innerText = calculateHandScore(visibleHand);

    this.dom.myHandCards.innerHTML = '';
    visibleHand.forEach((card, idx) => {
      const cardEl = document.createElement('div');
      cardEl.className = `hand-card single-card ${card.color} ${card.isWild ? 'wild-joker-card' : ''}`;
      cardEl.setAttribute('data-card-id', card.id);

      if (store.isRoundDealAnimationActive) {
        cardEl.classList.add('deal-wipe');
        cardEl.style.animationDelay = `${idx * GAME_CONSTANTS.ANIM_DURATION_DEAL_STEP_MS}ms`;
      }

      cardEl.innerHTML = createCardInner(card, false);

      cardEl.addEventListener('click', () => {
        if (cardEl.dataset.swiped === 'true') {
          cardEl.dataset.swiped = 'false';
          return;
        }
        this.onHandCardClick(card.id, cardEl);
      });

      let touchStartX = 0;
      let touchStartY = 0;
      let touchStartTime = 0;
      let isTouchActive = false;

      cardEl.addEventListener(
        'touchstart',
        (e) => {
          if (e.touches.length !== 1) return;
          const t = e.touches[0];
          touchStartX = t.clientX;
          touchStartY = t.clientY;
          touchStartTime = Date.now();
          isTouchActive = true;
          cardEl.dataset.swiped = 'false';
          cardEl.classList.add('touching');
          store.touchDraggedCardId = card.id;
        },
        { passive: true }
      );

      cardEl.addEventListener(
        'touchmove',
        (e) => {
          if (!isTouchActive || e.touches.length !== 1) return;
          const t = e.touches[0];
          const dy = t.clientY - touchStartY;
          const dx = t.clientX - touchStartX;

          if (dy < -10 && Math.abs(dy) > Math.abs(dx)) {
            cardEl.classList.add('swiping-up');
            cardEl.style.transform = `translateY(${Math.max(dy, -55)}px) scale(1.05)`;
            this.dom.middleDottedDropBox?.classList.add('drag-over');
          }
        },
        { passive: true }
      );

      cardEl.addEventListener('touchend', (e) => {
        if (!isTouchActive) return;
        isTouchActive = false;
        cardEl.classList.remove('touching', 'swiping-up');
        cardEl.style.transform = '';
        this.dom.middleDottedDropBox?.classList.remove('drag-over');

        const touch = e.changedTouches[0];
        const dy = touch.clientY - touchStartY;
        const dx = touch.clientX - touchStartX;
        const dt = Date.now() - touchStartTime;

        const elemUnder = document.elementFromPoint(touch.clientX, touch.clientY);
        const isOverDropBox =
          elemUnder && (elemUnder === this.dom.middleDottedDropBox || this.dom.middleDottedDropBox.contains(elemUnder));
        const isUpwardFlick = dy < -32 || (dy < -18 && dt < 280 && Math.abs(dy) > Math.abs(dx));

        if (isOverDropBox || isUpwardFlick) {
          cardEl.dataset.swiped = 'true';
          setTimeout(() => {
            cardEl.dataset.swiped = 'false';
          }, 300);
          this.onHandCardClick(card.id, cardEl);
        } else if (
          elemUnder &&
          (elemUnder === this.dom.discardStackPile || this.dom.discardStackPile.contains(elemUnder))
        ) {
          cardEl.dataset.swiped = 'true';
          setTimeout(() => {
            cardEl.dataset.swiped = 'false';
          }, 300);
          const topDiscard = store.gameState?.topDiscard;
          if (isDropPhase && topDiscard && (card.rank === topDiscard.rank || (card.isWild && topDiscard.isWild))) {
            this.executeSlash([card.id]);
          }
        }
        store.touchDraggedCardId = null;
      });

      if (isDropPhase) {
        cardEl.setAttribute('draggable', 'true');
        cardEl.addEventListener('dragstart', (e) => {
          cardEl.classList.add('dragging');
          e.dataTransfer.setData('text/plain', card.id);
        });
        cardEl.addEventListener('dragend', () => {
          cardEl.classList.remove('dragging');
          this.dom.middleDottedDropBox.classList.remove('drag-over');
        });
      }

      this.dom.myHandCards.appendChild(cardEl);
    });

    // Empty tray slots up to 7 cards (matches authentic tablet/mobile card tray look)
    const totalTraySlots = Math.max(visibleHand.length, 7);
    for (let s = visibleHand.length; s < totalTraySlots; s++) {
      const slot = document.createElement('div');
      slot.className = 'hand-slot-ghost';
      this.dom.myHandCards.appendChild(slot);
    }

    if (store.isRoundDealAnimationActive) {
      setTimeout(() => {
        store.isRoundDealAnimationActive = false;
      }, visibleHand.length * GAME_CONSTANTS.ANIM_DURATION_DEAL_STEP_MS + 400);
    }
  }

  updateActionUI() {
    if (!store.gameState) return;
    const isMyTurn = store.gameState.currentTurnPlayerId === store.myPlayerId;
    const turnPhase = store.gameState.turnPhase;
    const myPlayer = store.gameState.players.find((p) => p.id === store.myPlayerId);

    this.dom.drawPileBtn.classList.remove('can-draw');
    this.dom.discardStackPile.classList.remove('can-draw');
    this.renderMiddleDropBox(isMyTurn, turnPhase);

    if (!isMyTurn || myPlayer?.eliminated || myPlayer?.waitingNextRound) {
      store.lastTurnPlayerId = null;
      store.stagedCards = [];
      this.renderMiddleDropBox(false, turnPhase);

      if (this.dom.turnStatusBadge) {
        this.dom.turnStatusBadge.className = 'turn-status-badge';
        if (myPlayer?.waitingNextRound) {
          this.dom.turnStatusBadge.innerText = 'Spectating this round 👁️';
        } else {
          this.dom.turnStatusBadge.innerText = myPlayer?.eliminated
            ? 'Eliminated 💀'
            : `Waiting for ${store.gameState.currentTurnPlayerName}…`;
        }
      }

      if (this.dom.cornerActionButton) {
        this.dom.cornerActionButton.style.display = 'none';
        this.dom.cornerActionButton.onclick = null;
      }

      if (this.dom.callShowBtn) this.dom.callShowBtn.style.display = 'none';
      if (this.dom.slashBtn) this.dom.slashBtn.style.display = 'none';
      if (this.dom.dropCardsBtn) this.dom.dropCardsBtn.style.display = 'none';
      return;
    }

    if (store.lastTurnPlayerId !== store.myPlayerId) {
      nativeBridge.triggerHaptic('turn');
      store.lastTurnPlayerId = store.myPlayerId;
    }

    if (this.dom.turnStatusBadge) {
      this.dom.turnStatusBadge.className = 'turn-status-badge my-turn';
    }

    const myCurrentScore = myPlayer.handScore !== null ? myPlayer.handScore : calculateHandScore(myPlayer.hand);
    const topDiscard = store.gameState.topDiscard;
    const isCardMatch = (c) => topDiscard && (c.rank === topDiscard.rank || (c.isWild && topDiscard.isWild));

    if (store.stagedCards.length > 0) {
      if (this.dom.turnStatusBadge) this.dom.turnStatusBadge.innerText = 'Tap Left Deck or Discard to Draw';
      this.dom.drawPileBtn.classList.add('can-draw');
      this.dom.discardStackPile.classList.add('can-draw');

      const stagedMatchesDiscard = Boolean(topDiscard) && store.stagedCards.every(isCardMatch);

      if (this.dom.cornerActionButton) {
        if (stagedMatchesDiscard) {
          this.dom.cornerActionButton.style.display = 'inline-flex';
          this.dom.cornerActionButton.className = 'corner-action-btn btn-slash';
          this.dom.cornerActionButton.innerHTML = 'Slash';
          this.dom.cornerActionButton.onclick = () => this.executeSlash(store.stagedCards.map((c) => c.id));
        } else {
          this.dom.cornerActionButton.style.display = 'none';
          this.dom.cornerActionButton.onclick = null;
        }
      }

      if (this.dom.callShowBtn) this.dom.callShowBtn.style.display = 'none';
      if (this.dom.slashBtn) this.dom.slashBtn.style.display = stagedMatchesDiscard ? 'inline-flex' : 'none';
      if (this.dom.dropCardsBtn) this.dom.dropCardsBtn.style.display = 'none';
      return;
    }

    if (turnPhase === 'DROP') {
      if (this.dom.turnStatusBadge) this.dom.turnStatusBadge.innerText = 'Your Turn: Tap Card(s) to Drop';

      if (this.dom.cornerActionButton) {
        if (myCurrentScore <= GAME_CONSTANTS.SHOW_THRESHOLD) {
          this.dom.cornerActionButton.style.display = 'inline-flex';
          this.dom.cornerActionButton.className = 'corner-action-btn btn-show';
          this.dom.cornerActionButton.innerHTML = 'Show';
          this.dom.cornerActionButton.onclick = () => this.declareShow();
        } else if (myPlayer.hand.some(isCardMatch)) {
          this.dom.cornerActionButton.style.display = 'inline-flex';
          this.dom.cornerActionButton.className = 'corner-action-btn btn-slash';
          this.dom.cornerActionButton.innerHTML = 'Slash';
          this.dom.cornerActionButton.onclick = () => this.executeSlash();
        } else {
          this.dom.cornerActionButton.style.display = 'none';
          this.dom.cornerActionButton.onclick = null;
        }
      }

      if (this.dom.callShowBtn) {
        if (myCurrentScore <= GAME_CONSTANTS.SHOW_THRESHOLD) {
          this.dom.callShowBtn.style.display = 'inline-flex';
          if (this.dom.callShowPoints) this.dom.callShowPoints.innerText = myCurrentScore;
        } else {
          this.dom.callShowBtn.style.display = 'none';
        }
      }

      if (this.dom.slashBtn) {
        if (
          store.gameState.topDiscard &&
          myPlayer.hand.some(
            (c) => c.rank === store.gameState.topDiscard.rank || (c.isWild && store.gameState.topDiscard.isWild)
          )
        ) {
          this.dom.slashBtn.style.display = 'inline-flex';
          if (this.dom.slashRankText) this.dom.slashRankText.innerText = store.gameState.topDiscard.rank;
        } else {
          this.dom.slashBtn.style.display = 'none';
        }
      }

      if (this.dom.dropCardsBtn) this.dom.dropCardsBtn.style.display = 'none';
    } else if (turnPhase === 'DRAW') {
      if (this.dom.turnStatusBadge) this.dom.turnStatusBadge.innerText = 'Tap Left Deck or Discard to Draw';
      this.dom.drawPileBtn.classList.add('can-draw');
      this.dom.discardStackPile.classList.add('can-draw');

      if (this.dom.cornerActionButton) this.dom.cornerActionButton.style.display = 'none';
      if (this.dom.callShowBtn) this.dom.callShowBtn.style.display = 'none';
      if (this.dom.slashBtn) this.dom.slashBtn.style.display = 'none';
      if (this.dom.dropCardsBtn) this.dom.dropCardsBtn.style.display = 'none';
    }
  }

  showPlayerEmoji(playerId, emoji) {
    const target =
      playerId === store.myPlayerId
        ? this.dom.myAvatarBox
        : document.getElementById(`oppSlot_${playerId}`);
    if (target) spawnFloatingEmoji(target, emoji);
  }

  handleRoundEnded(results, isGameOver) {
    if (!results) return;
    if (store.spectatingRoundOver) return;

    const roundKey = `${results.roundNumber || store.gameState?.roundNumber}_${results.caller?.id}_${results.isGoodShow}`;
    if (store.lastShownResultsKey === roundKey) {
      if (this.dom.resultsModal.style.display !== 'none') {
        this.showResultsModal(results, isGameOver);
      }
      return;
    }
    store.lastShownResultsKey = roundKey;

    if (this.outcomeTimer) clearTimeout(this.outcomeTimer);

    const isSelfEliminated = results.newlyEliminated?.some((p) => p.id === store.myPlayerId);
    const isSelfWinner = results.roundWinner?.id === store.myPlayerId;
    const isSelfPenalty = results.penaltyPlayerId === store.myPlayerId;

    if (results.isGoodShow) {
      soundFx.playGoodShow();
      soundFx.playChipClink();
      if (isSelfWinner) launchCelebrationConfetti();
    } else {
      soundFx.playBadShow();
    }

    if (this.dom.outcomeCallout) {
      let emoji = '😞';
      let label = 'You Lost!';
      let tone = 'loss';
      if (isSelfEliminated) {
        emoji = '🤡';
        label = 'You are eliminated!';
        tone = 'elim';
      } else if (isSelfWinner) {
        emoji = '👑';
        label = 'You Won the Round!';
        tone = 'win';
      } else if (isSelfPenalty) {
        emoji = '💥';
        label = 'Wrong Show! (+40 Penalty)';
        tone = 'elim';
      }
      this.dom.outcomeCalloutEmoji.innerText = emoji;
      this.dom.outcomeCalloutText.innerText = label;
      this.dom.outcomeCallout.className = `outcome-callout ${tone}`;
      this.dom.outcomeCallout.style.display = 'flex';
    }

    this.outcomeTimer = setTimeout(() => {
      if (this.dom.outcomeCallout) this.dom.outcomeCallout.style.display = 'none';
      this.showResultsModal(results, isGameOver);
    }, 1350);
  }

  _renderMiniCardsHtml(hand) {
    if (!Array.isArray(hand) || hand.length === 0) return '<span style="opacity:0.5;">—</span>';
    return `<div class="mini-cards-strip">${hand
      .map(
        (card) => `
          <div class="mini-result-card single-card ${card.color} ${card.isWild ? 'wild-joker-card' : ''}">
            ${createCardInner(card, false)}
          </div>`
      )
      .join('')}</div>`;
  }

  showResultsModal(results, isGameOver) {
    if (!results) return;
    this.dom.resultsModal.style.display = 'flex';

    if (results.isGoodShow) {
      this.dom.resultsTitle.innerText = `👑 Good Show by ${results.caller.name}!`;
      this.dom.resultsTitle.style.color = 'var(--gold)';
      this.dom.resultsSubtitle.innerText = `${results.caller.name} had the lowest hand (${results.caller.score} pts) and scored 0!`;
    } else {
      this.dom.resultsTitle.innerText = '❌ Bad Show! Penalty (+40 pts)';
      this.dom.resultsTitle.style.color = 'var(--danger)';
      this.dom.resultsSubtitle.innerText = `${results.caller.name} called Show with ${results.caller.score} pts, but was tied or beaten! Takes +40 penalty.`;
    }

    this.dom.resultsTableBody.innerHTML = '';
    results.details.forEach((item) => {
      const tr = document.createElement('tr');
      const isWinnerRow = item.isWinner || item.id === results.roundWinner?.id;
      const isPenaltyRow = item.isPenalty || item.id === results.penaltyPlayerId;
      const isSelfRow = item.id === store.myPlayerId;
      if (isWinnerRow) tr.className = 'winner-row';
      if (isPenaltyRow) tr.className = 'penalty-row';

      const showedNote = item.showed || item.id === results.caller?.id ? '<div class="cell-subtag">(Showed)</div>' : '';
      const penaltyNote = isPenaltyRow ? '<div class="cell-subtag penalty">(Penalty)</div>' : '';

      tr.innerHTML = `
        <td class="${isSelfRow ? 'self-name-highlight' : ''}">
          ${item.name} ${item.eliminated ? '💀' : ''}
        </td>
        <td>${this._renderMiniCardsHtml(item.hand)}</td>
        <td><strong>${item.handScore}</strong>${showedNote}</td>
        <td style="color:${item.roundPoints === 0 ? '#5ef29d' : item.roundPoints >= 40 ? '#ff6b6b' : '#fff'};">
          <strong>${item.roundPoints}</strong>${penaltyNote}
        </td>
        <td><strong>${item.totalScore}</strong></td>
      `;
      this.dom.resultsTableBody.appendChild(tr);
    });

    if (results.newlyEliminated?.length > 0) {
      const names = results.newlyEliminated.map((p) => p.name).join(', ');
      this.dom.eliminatedNotice.innerText = `🤡 Eliminated this round: ${names}`;
    } else {
      this.dom.eliminatedNotice.innerText = '';
    }

    const myPlayer = store.gameState?.players.find((p) => p.id === store.myPlayerId);
    if (this.dom.closeResultsSpectateBtn) {
      this.dom.closeResultsSpectateBtn.style.display = myPlayer?.eliminated && !isGameOver ? 'inline-flex' : 'none';
    }

    if (isGameOver) {
      if (results.champion?.id === store.myPlayerId) {
        soundFx.playChipClink();
        launchCelebrationConfetti();
      }
      this.dom.resultsTitle.innerText = `🏆 GAME OVER - ${results.champion ? results.champion.name : 'Winner'} Wins!`;
      this.dom.resultsSubtitle.innerText = 'The last player standing has won the table!';
      this.dom.hostNextRoundContainer.style.display = 'none';
      this.dom.nonHostNextRoundMessage.style.display = 'block';
      this.dom.nonHostNextRoundMessage.innerText = 'Match finished. Leave table to start a new game.';
    } else if (store.isHost) {
      this.dom.hostNextRoundContainer.style.display = 'block';
      this.dom.nonHostNextRoundMessage.style.display = 'none';
    } else {
      this.dom.hostNextRoundContainer.style.display = 'none';
      this.dom.nonHostNextRoundMessage.style.display = 'block';
      this.dom.nonHostNextRoundMessage.innerText = '⏳ Waiting for host to start next round…';
    }
  }

  openScoreMatrix() {
    const state = store.gameState;
    if (!state || !this.dom.scoreMatrixModal) return;

    this.dom.matrixRoundTitle.innerText = `Round ${state.roundNumber || 1}`;
    this.dom.matrixScoreLimit.innerText = `Score Limit: ${state.eliminationScore}`;

    const players = state.players || [];
    const history = state.roundHistory || [];

    this.dom.scoreMatrixHead.innerHTML = `
      <tr>
        <th>Round</th>
        ${players
          .map((p) => `<th class="${p.id === store.myPlayerId ? 'self-name-highlight' : ''}">${p.name}</th>`)
          .join('')}
      </tr>
    `;

    if (history.length === 0) {
      this.dom.scoreMatrixBody.innerHTML = `
        <tr>
          <td colspan="${players.length + 1}" style="padding:18px; color:rgba(255,255,255,0.6);">
            No completed rounds yet — finish Round 1 to populate round scores.
          </td>
        </tr>
      `;
    } else {
      this.dom.scoreMatrixBody.innerHTML = history
        .map((entry, idx) => {
          const isLatest = idx === history.length - 1;
          return `
            <tr class="${isLatest ? 'matrix-latest-row' : ''}">
              <td><strong>${entry.roundNumber}</strong></td>
              ${players
                .map((p) => {
                  const rec = entry.scoresByPlayerId?.[p.id];
                  if (!rec) return '<td style="opacity:0.4;">—</td>';
                  const cls = rec.isWinner ? 'matrix-zero' : rec.isPenalty ? 'matrix-penalty' : '';
                  return `<td class="${cls}">${rec.roundPoints}</td>`;
                })
                .join('')}
            </tr>
          `;
        })
        .join('');
    }

    this.dom.scoreMatrixFoot.innerHTML = `
      <tr class="matrix-total-row">
        <td><strong>Total</strong></td>
        ${players
          .map(
            (p) =>
              `<td class="${p.eliminated ? 'matrix-elim-total' : ''}"><strong>${p.score}</strong>${p.eliminated ? ' 💀' : ''}</td>`
          )
          .join('')}
      </tr>
    `;

    this.dom.scoreMatrixModal.style.display = 'flex';
    nativeBridge.triggerHaptic('tap');
  }
}
