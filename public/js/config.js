/**
 * Application Configuration & Runtime Environment Detection
 * Automatically routes Socket.IO and invite URLs appropriately when running in
 * Express Web Dev, Render Cloud Production, or Capacitor Native Android APK.
 */

export const PRODUCTION_SERVER_URL = 'https://leastcount-rush.onrender.com';

export function isNativeApp() {
  return Boolean(
    window.Capacitor &&
    typeof window.Capacitor.isNativePlatform === 'function' &&
    window.Capacitor.isNativePlatform()
  );
}

export function getSocketServerUrl() {
  // Custom override if user/developer tests against LAN server from mobile
  const customOverride = localStorage.getItem('leastcount_server_url');
  if (customOverride && /^https?:\/\//i.test(customOverride)) {
    return customOverride;
  }

  // Native Android APK serves HTML locally via capacitor://localhost or https://localhost
  if (isNativeApp()) {
    return PRODUCTION_SERVER_URL;
  }

  const origin = window.location.origin;
  if (
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'file:' ||
    (window.location.hostname === 'localhost' && window.location.port !== '3000')
  ) {
    return PRODUCTION_SERVER_URL;
  }

  // Default web hosting: connect directly to same origin
  return origin;
}

export function getPublicWebUrl() {
  if (isNativeApp() || window.location.protocol === 'capacitor:' || window.location.protocol === 'file:') {
    return PRODUCTION_SERVER_URL;
  }
  return window.location.origin;
}

export const STORAGE_KEYS = {
  PLAYER_ID: 'leastcount_user_id',
  PLAYER_NAME: 'leastcount_player_name',
  AVATAR: 'leastcount_avatar',
  CURRENT_ROOM: 'leastcount_current_room',
  AUTO_SORT: 'leastcount_autosort',
  SOUND_MUTED: 'leastcount_sound_muted',
  SERVER_URL: 'leastcount_server_url'
};

export const GAME_CONSTANTS = {
  MIN_PLAYERS: 6,
  MAX_PLAYERS: 15,
  DEFAULT_MAX_PLAYERS: 10,
  DEFAULT_ELIM_SCORE: 150,
  DEFAULT_TURN_SECONDS: 12,
  SHOW_THRESHOLD: 10,
  ANIM_DURATION_DROP_MS: 210,
  ANIM_DURATION_DRAW_MS: 230,
  ANIM_DURATION_DEAL_STEP_MS: 65
};
