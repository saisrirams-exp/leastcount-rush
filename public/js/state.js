/**
 * Centralized Reactive Client State Store
 */
import { GAME_CONSTANTS, STORAGE_KEYS, isNativeApp } from './config.js';

function getIdentityStorage() {
  // Native APK remembers player identity across restarts; web browser uses per-tab sessionStorage
  return isNativeApp() ? localStorage : sessionStorage;
}

function resolvePersistentPlayerId() {
  const store = getIdentityStorage();
  let id = store.getItem(STORAGE_KEYS.PLAYER_ID);
  if (!id) {
    id = 'usr_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    store.setItem(STORAGE_KEYS.PLAYER_ID, id);
  }
  return id;
}

export class GameStateStore {
  constructor() {
    this.persistentPlayerId = resolvePersistentPlayerId();
    this.myPlayerId = this.persistentPlayerId;
    this.currentRoomCode = null;
    this.gameState = null;
    this.isHost = false;
    this.stagedCards = [];
    this.touchDraggedCardId = null;

    this.myAvatar = localStorage.getItem(STORAGE_KEYS.AVATAR) || '👑';
    this.isAutoSortEnabled = localStorage.getItem(STORAGE_KEYS.AUTO_SORT) !== 'false';
    this.selectedElimScore = GAME_CONSTANTS.DEFAULT_ELIM_SCORE;
    this.selectedTurnDuration = GAME_CONSTANTS.DEFAULT_TURN_SECONDS;
    this.selectedFaceScore = 'STANDARD_10';

    this.isForceRotated = false;
    this.lastTurnPlayerId = null;
    this.lastObservedRoundNumber = null;
    this.isRoundDealAnimationActive = false;
    this.lastObservedActionKey = null;
    this.lastShownResultsKey = null;
    this.spectatingRoundOver = false;
  }

  savePlayerId(id) {
    this.myPlayerId = id;
    this.persistentPlayerId = id;
    getIdentityStorage().setItem(STORAGE_KEYS.PLAYER_ID, id);
  }

  setRoomCode(code) {
    this.currentRoomCode = code;
    if (code) {
      sessionStorage.setItem(STORAGE_KEYS.CURRENT_ROOM, code);
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.CURRENT_ROOM);
    }
  }

  getSavedRoomCode() {
    return this.currentRoomCode || sessionStorage.getItem(STORAGE_KEYS.CURRENT_ROOM);
  }

  resetRoomSession() {
    this.setRoomCode(null);
    this.gameState = null;
    this.isHost = false;
    this.stagedCards = [];
    this.isForceRotated = false;
    this.lastTurnPlayerId = null;
    this.lastObservedRoundNumber = null;
    this.lastObservedActionKey = null;
    this.isRoundDealAnimationActive = false;
    this.lastShownResultsKey = null;
    this.spectatingRoundOver = false;
  }
}

export const store = new GameStateStore();
