/**
 * Hardware-Accelerated Card Wipe Flight & Particle Celebration Engine
 */
import { soundFx } from './sound.js';

export function flyCardWipe(from, to, cardHtml, options = {}) {
  const fromRect = from instanceof HTMLElement ? from.getBoundingClientRect() : from;
  const toRect = to instanceof HTMLElement ? to.getBoundingClientRect() : to;
  if (!fromRect || !toRect || fromRect.width === 0 || toRect.width === 0) {
    if (options.onComplete) options.onComplete();
    return;
  }

  const duration = options.duration || 240;
  const flyingEl = document.createElement('div');
  flyingEl.className = `flying-card-wipe single-card ${options.cardClass || ''}`;
  flyingEl.innerHTML = cardHtml || '';

  flyingEl.style.left = `${fromRect.left}px`;
  flyingEl.style.top = `${fromRect.top}px`;
  flyingEl.style.width = `${fromRect.width}px`;
  flyingEl.style.height = `${fromRect.height}px`;
  flyingEl.style.setProperty('--fly-duration', `${duration}ms`);
  flyingEl.style.transform = `scale(1) rotate(${options.fromRotate || 0}deg)`;

  document.body.appendChild(flyingEl);
  soundFx.playCardWhoosh();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const deltaX = toRect.left - fromRect.left + (toRect.width - fromRect.width) / 2;
      const deltaY = toRect.top - fromRect.top + (toRect.height - fromRect.height) / 2;
      const scale = toRect.width / fromRect.width;
      const toRotate = options.toRotate !== undefined ? options.toRotate : Math.random() * 8 - 4;

      flyingEl.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scale}) rotate(${toRotate}deg)`;
      if (options.fadeOut) flyingEl.style.opacity = '0';
    });
  });

  setTimeout(() => {
    if (flyingEl.parentNode) flyingEl.parentNode.removeChild(flyingEl);
    if (options.onComplete) options.onComplete();
  }, duration + 25);
}

export function flyOpponentGhostCard(fromEl, toEl, onComplete) {
  if (!fromEl || !toEl) {
    if (onComplete) onComplete();
    return;
  }
  const fromRect = fromEl.getBoundingClientRect();
  const toRect = toEl.getBoundingClientRect();
  if (fromRect.width === 0 || toRect.width === 0) {
    if (onComplete) onComplete();
    return;
  }

  const ghostEl = document.createElement('div');
  ghostEl.className = 'opponent-ghost-card';
  ghostEl.innerHTML = '🂠';

  const startX = fromRect.left + fromRect.width / 2 - 19;
  const startY = fromRect.top + fromRect.height / 2 - 27;
  const targetX = toRect.left + toRect.width / 2 - 19;
  const targetY = toRect.top + toRect.height / 2 - 27;

  ghostEl.style.left = `${startX}px`;
  ghostEl.style.top = `${startY}px`;
  ghostEl.style.setProperty('--fly-duration', '290ms');

  document.body.appendChild(ghostEl);
  soundFx.playCardWhoosh();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      ghostEl.style.transform = `translate(${targetX - startX}px, ${targetY - startY}px) scale(0.9) rotate(${Math.random() * 16 - 8}deg)`;
    });
  });

  setTimeout(() => {
    if (ghostEl.parentNode) ghostEl.parentNode.removeChild(ghostEl);
    if (onComplete) onComplete();
  }, 310);
}

export function flyOpponentPlayCards(fromEl, toEl, cards, renderCardFn) {
  if (!fromEl || !toEl || !Array.isArray(cards) || cards.length === 0) return;
  const fromRect = fromEl.getBoundingClientRect();
  const toRect = toEl.getBoundingClientRect();
  if (fromRect.width === 0 || toRect.width === 0) return;

  cards.slice(0, 4).forEach((card, idx) => {
    const el = document.createElement('div');
    const isRed = card.color === 'red' || card.suit === '♥' || card.suit === '♦';
    el.className = `flying-card-wipe single-card ${isRed ? 'red' : 'black'} ${card.isWild ? 'wild-joker-card' : ''}`;
    el.innerHTML = renderCardFn(card, false);

    const w = 52;
    const h = 76;
    const startX = fromRect.left + fromRect.width / 2 - w / 2 + idx * 8;
    const startY = fromRect.top + fromRect.height / 2 - h / 2;
    const fanOffset = (idx - (cards.length - 1) / 2) * 18;
    const targetX = toRect.left + toRect.width / 2 - w / 2 + fanOffset;
    const targetY = toRect.top + toRect.height / 2 - h / 2;

    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.left = `${startX}px`;
    el.style.top = `${startY}px`;
    el.style.setProperty('--fly-duration', '320ms');
    el.style.transform = 'scale(0.55) rotate(-6deg)';
    el.style.opacity = '0.9';

    document.body.appendChild(el);
    if (idx === 0) soundFx.playCardDrop();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transform = `translate(${targetX - startX}px, ${targetY - startY}px) scale(1) rotate(${fanOffset * 0.15}deg)`;
        el.style.opacity = '1';
      });
    });

    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 140);
    }, 360 + idx * 45);
  });
}

export function spawnFloatingEmoji(targetEl, emoji) {
  if (!targetEl || !emoji) return;
  const rect = targetEl.getBoundingClientRect();
  if (rect.width === 0) return;

  const bubble = document.createElement('div');
  bubble.className = 'floating-emoji-burst';
  bubble.textContent = emoji;
  bubble.style.left = `${rect.left + rect.width / 2}px`;
  bubble.style.top = `${rect.top}px`;
  document.body.appendChild(bubble);

  setTimeout(() => bubble.remove(), 2200);
}

export function launchCelebrationConfetti() {
  const canvas = document.getElementById('celebrationCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';

  const colors = ['#f5c542', '#d4af37', '#e63946', '#2ecc71', '#3498db', '#ffffff', '#ffd166'];
  const particles = [];
  const particleCount = Math.min(80, Math.floor(window.innerWidth / 12));

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: canvas.width * (0.35 + Math.random() * 0.3),
      y: canvas.height * 0.42,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.75) * 15,
      size: Math.random() * 8 + 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 12,
      opacity: 1,
      gravity: 0.28,
      drag: 0.96
    });
  }

  const startTime = Date.now();
  function animate() {
    const elapsed = Date.now() - startTime;
    if (elapsed > 3000) {
      canvas.style.display = 'none';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.vRot;
      if (elapsed > 1800) {
        p.opacity = Math.max(0, 1 - (elapsed - 1800) / 1200);
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    });

    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}
