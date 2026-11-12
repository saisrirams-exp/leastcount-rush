/**
 * Capacitor Native Bridge Service
 * Safely interacts with Android native hardware features (Haptics, ScreenOrientation,
 * SplashScreen, StatusBar, Share Sheet, Hardware Back Button, Deep Links) with
 * automatic progressive fallbacks for standard mobile/desktop browsers.
 */
import { isNativeApp } from './config.js';

class NativeBridgeService {
  constructor() {
    this._initialized = false;
  }

  get plugins() {
    return window.Capacitor?.Plugins || {};
  }

  /**
   * Initialize native UI chrome, back-button routing, and deep links.
   */
  init({ onBackButton, onDeepLinkRoom } = {}) {
    if (this._initialized) return;
    this._initialized = true;

    const { SplashScreen, StatusBar, App } = this.plugins;

    // Configure immersive dark status bar & hide splash screen smoothly
    if (isNativeApp()) {
      try {
        StatusBar?.setBackgroundColor?.({ color: '#120624' }).catch(() => {});
        StatusBar?.setStyle?.({ style: 'DARK' }).catch(() => {});
        StatusBar?.hide?.().catch(() => {});
      } catch (e) {}

      try {
        SplashScreen?.hide?.({ fadeOutDuration: 250 }).catch(() => {});
      } catch (e) {}

      // Lock horizontal orientation proactively in native APK
      this.lockLandscape().catch(() => {});

      // Handle Android Hardware Back button intelligently
      if (App?.addListener) {
        App.addListener('backButton', () => {
          if (typeof onBackButton === 'function') {
            onBackButton();
          }
        });

        // Handle deep links like leastcountrush://join?room=ABCDE or https://leastcount-rush.onrender.com/?room=ABCDE
        App.addListener('appUrlOpen', (event) => {
          try {
            const parsed = new URL(event.url);
            const roomCode = parsed.searchParams.get('room');
            if (roomCode && typeof onDeepLinkRoom === 'function') {
              onDeepLinkRoom(roomCode.toUpperCase().trim());
            }
          } catch (e) {}
        });
      }
    }
  }

  /**
   * Lock screen orientation to Landscape on Android/iOS or compatible browsers.
   */
  async lockLandscape() {
    const { ScreenOrientation } = this.plugins;
    try {
      if (isNativeApp() && ScreenOrientation?.lock) {
        await ScreenOrientation.lock({ orientation: 'landscape' });
        return true;
      }
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape');
        return true;
      }
    } catch (e) {}
    return false;
  }

  /**
   * Toggle immersive fullscreen + status bar state during active gameplay.
   */
  async setImmersiveGameplay(active) {
    if (!isNativeApp()) return;
    const { StatusBar } = this.plugins;
    try {
      if (active) {
        await StatusBar?.hide?.();
      } else {
        await StatusBar?.show?.();
      }
    } catch (e) {}
  }

  /**
   * Tactical Haptics using Capacitor Haptics on native Android or Web Vibration API.
   */
  triggerHaptic(type = 'tap') {
    const { Haptics } = this.plugins;

    if (isNativeApp() && Haptics) {
      try {
        if (type === 'tap' || type === 'drop') {
          Haptics.impact({ style: type === 'drop' ? 'MEDIUM' : 'LIGHT' }).catch(() => {});
        } else if (type === 'draw') {
          Haptics.impact({ style: 'LIGHT' }).catch(() => {});
        } else if (type === 'slash') {
          Haptics.impact({ style: 'HEAVY' }).catch(() => {});
        } else if (type === 'show') {
          Haptics.notification({ type: 'SUCCESS' }).catch(() => {});
        } else if (type === 'turn') {
          Haptics.notification({ type: 'WARNING' }).catch(() => {});
        }
        return;
      } catch (e) {}
    }

    // Browser Fallback (Web Vibration API)
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

  /**
   * Native Android Share Sheet or Web Share API fallback.
   */
  async shareTableInvite({ title, text, url, onCopyFallback }) {
    const { Share } = this.plugins;

    if (isNativeApp() && Share?.share) {
      try {
        await Share.share({ title, text, url, dialogTitle: 'Invite Friends to Table' });
        return true;
      } catch (e) {}
    }

    if (navigator.share && navigator.canShare && navigator.canShare({ title, text, url })) {
      try {
        await navigator.share({ title, text, url });
        return true;
      } catch (e) {}
    }

    if (typeof onCopyFallback === 'function') {
      onCopyFallback();
    }
    return false;
  }

  /**
   * Exit native Android app gracefully when on Home screen.
   */
  exitApp() {
    if (isNativeApp() && this.plugins.App?.exitApp) {
      this.plugins.App.exitApp();
    }
  }
}

export const nativeBridge = new NativeBridgeService();
