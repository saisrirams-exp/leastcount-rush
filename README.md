# 🃏 Least Count Rush (6 to 15 Players)

A real-time multiplayer card game based on the classic South Asian lowest-hand game (related to *Dhumbal*, *Yaniv*, and *Jhyap*), specially engineered for **6 to 15 players**.

---

## 🌟 Key Features

1. **Custom Table Capacity (6 to 15 Players):**
   - The host chooses anywhere from **6 to 15 players** using a visual slider.
   - **Dynamic Deck Shoe Scaling:**
     - **6 – 7 Players:** 2 Decks (108 cards + Jokers)
     - **8 – 11 Players:** 3 Decks (162 cards + Jokers)
     - **12 – 15 Players:** 4 Decks (216 cards + Jokers)
2. **Instant Friend Invites:**
   - One-click invite links (`http://localhost:3000/?room=CODE`) and 5-letter room codes.
   - Works directly in mobile browsers (iOS Safari, Android Chrome) and desktop browsers with **zero install** and no sign-up wall.
3. **AI Bot Simulation (Instant Solo Testing):**
   - Host can click **"+ Add 1 Bot"** or **"⚡ Fill with Bots to Max"** to instantly test 6-player, 10-player, or 15-player matches.
4. **Fast "Rush" Turn Timer:**
   - Configurable turn speeds (8s Blitz, 12s Balanced, 18s Classic) with auto-play fallback if a player times out.
5. **Anti-Cheat Server-Authoritative Engine:**
   - Card values in opponents' hands are masked on the server until the round-end Showdown.
6. **Built-in Web Audio API SFX:**
   - Authentic card drop, card draw, Good Show fanfare, Bad Show buzzer, and timer ticks with zero external sound asset dependencies.

---

## 📜 Game Rules

* **Objective:** Keep the total point sum of your 5 cards as low as possible.
* **Point Values:**
  * **Jokers:** `0 points` (golden cards)
  * **Ace:** `1 point`
  * **2 to 10:** Face value (`2` to `10 points`)
  * **Jack:** `11 points`
  * **Queen:** `12 points`
  * **King:** `13 points`
* **On Your Turn:**
  1. **Drop:** Discard 1 card, OR multiple cards of the exact same rank (e.g., pair of 8s, three Kings).
  2. **Draw:** Pick 1 card from either the face-down Draw Pile or the face-up Discard Pile.
* **Calling "SHOW":**
  * If you believe your hand sum is the lowest at the table, declare **SHOW** before dropping cards.
  * **Good Show:** If your score is strictly lower than every opponent, you score **0 points**! All others add their hand total.
  * **Bad Show:** If anyone ties or beats you, you receive a flat **+40 penalty**, and the true lowest player scores 0 points.
* **Knockout / Elimination:**
  * Players reaching the target score (100, 150, or 200 points) are eliminated.
  * The last player standing wins!

---

## 🚀 How to Run Locally

1. Open your terminal in this directory:
   ```bash
   npm start
   ```
   *(or `node server.js`)*
2. Open your browser:
   ```
   http://localhost:3000
   ```
3. Click **"Create Table"**, slide the player capacity anywhere from **6 to 15**, and click **Create**.
4. Test with bots by clicking **"⚡ Fill with Bots to Max"** and **"Start Game"**!

---

## 🌐 Playing with Friends Remotely (Any Network / Not on Same Wi-Fi)

Your friends do **not** need to be on the same Wi-Fi. You can share your game with friends anywhere via the built-in Cloudflare tunnel:

1. **Start the game server:**
   ```bash
   node server.js
   ```
2. **Open a second terminal and run Cloudflare Tunnel:**
   ```powershell
   .\cloudflared.exe tunnel --url http://localhost:3000
   ```
3. Cloudflare will give you an instant `https://....trycloudflare.com` link.
4. Send that link to your friends—they can play on mobile data (4G/5G) or any home Wi-Fi with zero setup!

---

## 🏗️ Modular Architecture (Vanilla HTML5 / CSS3 / ES6+ Modules)

The frontend is cleanly organized without heavy runtime frameworks:

* `public/js/config.js` — Environment routing (auto-connects native APKs to the live cloud multiplayer server)
* `public/js/state.js` — Client state & identity persistence
* `public/js/cards.js` — Card scoring, ascending sorter, and royal SVG card art
* `public/js/animations.js` — 60fps GPU wipe flight transitions, opponent trails & confetti physics
* `public/js/sound.js` — Procedural Web Audio API synthesizer with persistent mute state
* `public/js/native-bridge.js` — Capacitor Android native plugins (Haptics, ScreenOrientation, Share Sheet, Back Button, Deep Links, SplashScreen, StatusBar)
* `public/js/ui.js` — Table renderer, perimeter arc layout, touch upward flick-to-drop & drag controller
* `public/js/main.js` — App bootstrap & Socket.IO event wiring

---

## 📱 Building Android APK / Play Store AAB (Capacitor + Android Studio)

This project includes a native Android Gradle project configured for horizontal landscape play (`android/`).

### Sync Web Changes to Android
```bash
npm run mobile:sync
```

### Build a Debug APK
```bash
npm run mobile:apk
```
The compiled APK will be generated at:
`android/app/build/outputs/apk/debug/app-debug.apk`

### Open in Android Studio (For Play Store Signed `.aab`)
```bash
npm run mobile:open
```
In Android Studio: **Build > Generate Signed App Bundle / APK > Android App Bundle** to export the `.aab` for Google Play Console.
