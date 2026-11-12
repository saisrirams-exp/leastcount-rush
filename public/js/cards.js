/**
 * Playing Card Model & Authentic SVG Artwork Renderer
 */

const SUIT_ORDER = { '♣': 1, '♦': 2, '♥': 3, '♠': 4, '★': 5, '?': 6 };

export function getRankSortWeight(rank) {
  if (rank === 'JOKER') return 0;
  if (rank === 'A') return 1;
  if (rank === 'J') return 11;
  if (rank === 'Q') return 12;
  if (rank === 'K') return 13;
  const num = parseInt(rank, 10);
  return Number.isNaN(num) ? 0 : num;
}

export function sortCardsArray(cards, ascending = true) {
  if (!Array.isArray(cards)) return cards;
  return cards.sort((a, b) => {
    const isWildA = Boolean(a.isWild || a.isJoker || a.rank === 'JOKER');
    const isWildB = Boolean(b.isWild || b.isJoker || b.rank === 'JOKER');
    if (isWildA !== isWildB) return isWildA ? -1 : 1;

    const rvA = getRankSortWeight(a.rank);
    const rvB = getRankSortWeight(b.rank);
    if (rvA !== rvB) return ascending ? rvA - rvB : rvB - rvA;

    return (SUIT_ORDER[a.suit] || 0) - (SUIT_ORDER[b.suit] || 0);
  });
}

export function calculateHandScore(cards) {
  if (!Array.isArray(cards) || cards.length === 0) return 0;
  return cards.reduce((sum, c) => sum + (c.isWild || c.isJoker ? 0 : (c.points || 0)), 0);
}

export function getCourtSvg(rank, suit, isRed) {
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

export function getSuitSvg(suit, color, cls = 'suit-svg') {
  const paths = {
    '♥': 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
    '♦': 'M12 2L20 12L12 22L4 12Z',
    '♠': 'M12 2C9 6.5 3.5 10.2 3.5 14.5C3.5 17.5 6 19.5 8.5 19.5C10.1 19.5 11.2 18.6 11.7 17.6C11.4 19.6 10.4 21 9 22H15C13.6 21 12.6 19.6 12.3 17.6C12.8 18.6 13.9 19.5 15.5 19.5C18 19.5 20.5 17.5 20.5 14.5C20.5 10.2 15 6.5 12 2Z',
    '♣': 'M12 2.5C9.7 2.5 7.9 4.3 7.9 6.6C7.9 7.8 8.4 8.9 9.2 9.6C8.5 9.3 7.7 9.1 6.8 9.1C4.5 9.1 2.7 10.9 2.7 13.2C2.7 15.5 4.5 17.3 6.8 17.3C8.5 17.3 10 16.3 10.7 14.8C10.4 17.5 9.4 19.9 7.8 21.5H16.2C14.6 19.9 13.6 17.5 13.3 14.8C14 16.3 15.5 17.3 17.2 17.3C19.5 17.3 21.3 15.5 21.3 13.2C21.3 10.9 19.5 9.1 17.2 9.1C16.3 9.1 15.5 9.3 14.8 9.6C15.6 8.9 16.1 7.8 16.1 6.6C16.1 4.3 14.3 2.5 12 2.5Z',
    '★': 'M12 2L14.9 8.6L22 9.3L16.6 14L18.2 21L12 17.3L5.8 21L7.4 14L2 9.3L9.1 8.6Z'
  };
  const d = paths[suit] || paths['★'];
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="${color}"/></svg>`;
}

export function createCardInner(card, isTableJoker = false) {
  if (!card || card.rank === '?') {
    return `<div style="margin:auto; font-size:24px; color:#555;">🂠</div>`;
  }

  const isJoker = card.isJoker || card.rank === 'JOKER';
  const isWild = Boolean(card.isWild);
  const isRed = card.color === 'red' || card.suit === '♥' || card.suit === '♦';
  const suitIcon = isJoker ? '★' : (card.suit || '♠');
  const rankText = isJoker ? 'JKR' : card.rank;
  const suitColor = isJoker ? '#9a3412' : isRed ? '#d61f2c' : '#14141b';

  let centerContent = '';
  if (isJoker) {
    centerContent = `
      <div class="joker-center-art">
        <span class="joker-hat-emoji">🃏</span>
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
    centerContent = `
      <div class="number-center-suit">
        ${getSuitSvg(suitIcon, suitColor, 'center-suit-svg')}
      </div>
    `;
  }

  const wildBadge = isWild || isTableJoker ? `<div class="card-wild-star-badge">★ WILD</div>` : '';

  return `
    <div class="card-index top-left" style="color:${suitColor} !important;">
      <span class="index-rank" style="color:${suitColor} !important;">${rankText}</span>
      <span class="index-suit">${getSuitSvg(suitIcon, suitColor, 'index-suit-svg')}</span>
    </div>
    ${centerContent}
    ${wildBadge}
    <div class="card-index bottom-right" style="color:${suitColor} !important;">
      <span class="index-rank" style="color:${suitColor} !important;">${rankText}</span>
      <span class="index-suit">${getSuitSvg(suitIcon, suitColor, 'index-suit-svg')}</span>
    </div>
  `;
}
