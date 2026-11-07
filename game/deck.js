// Deck management for Least Count Rush (supports 6 to 15 players with 2 to 4 decks)

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Point values based on Least Count rules:
// Ace = 1, Numbers 2-9 = face value, Jokers/Wilds = 0.
// Face Card Scoring Modes:
// - STANDARD_10 (Default Play Store style): 10, J, Q, K = 10 pts each
// - CLASSIC_13 (Indian Classic style): 10 = 10, J = 11, Q = 12, K = 13
function getCardPointValue(rank, wildJokerRank = null, faceCardScoring = 'STANDARD_10') {
  if (rank === 'JOKER') return 0;
  if (wildJokerRank && rank === wildJokerRank) return 0;
  if (rank === 'A') return 1;
  if (faceCardScoring === 'CLASSIC_13') {
    if (rank === 'J') return 11;
    if (rank === 'Q') return 12;
    if (rank === 'K') return 13;
  } else {
    // STANDARD_10 (10, J, Q, K are 10 points each)
    if (['10', 'J', 'Q', 'K'].includes(rank)) return 10;
  }
  return parseInt(rank, 10) || 0;
}

function applyWildJokerToCard(card, wildJokerRank, faceCardScoring = 'STANDARD_10') {
  if (!card) return card;
  if (card.isJoker || (wildJokerRank && card.rank === wildJokerRank)) {
    card.isWild = true;
    card.points = 0;
  } else {
    card.isWild = false;
    card.points = getCardPointValue(card.rank, null, faceCardScoring);
  }
  return card;
}

/**
 * Calculates number of standard decks needed based on max player capacity.
 * 6 - 7 players: 2 decks (108 cards)
 * 8 - 11 players: 3 decks (162 cards)
 * 12 - 15 players: 4 decks (216 cards)
 */
function getDeckCountForPlayerCapacity(maxPlayers) {
  if (maxPlayers <= 7) return 2;
  if (maxPlayers <= 11) return 3;
  return 4; // 12 to 15 players
}

/**
 * Creates and shuffles a multi-deck shoe with jokers.
 */
function createShoe(deckCount = 2, includeJokers = true, faceCardScoring = 'STANDARD_10') {
  const cards = [];
  let cardId = 1;

  for (let d = 0; d < deckCount; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({
          id: `c_${cardId++}`,
          rank,
          suit,
          color: (suit === '♥' || suit === '♦') ? 'red' : 'black',
          points: getCardPointValue(rank, null, faceCardScoring),
          isJoker: false
        });
      }
    }
    if (includeJokers) {
      cards.push({
        id: `c_${cardId++}`,
        rank: 'JOKER',
        suit: '★',
        color: 'gold',
        points: 0,
        isJoker: true
      });
      cards.push({
        id: `c_${cardId++}`,
        rank: 'JOKER',
        suit: '★',
        color: 'gold',
        points: 0,
        isJoker: true
      });
    }
  }

  // Fisher-Yates Shuffle
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  return cards;
}

/**
 * Calculates the total sum of points for an array of cards.
 */
function calculateHandScore(hand) {
  if (!hand || !Array.isArray(hand)) return 0;
  return hand.reduce((sum, card) => sum + (card.points || 0), 0);
}

/**
 * Validates if the selected cards can be dropped together.
 * In Least Count, you can drop 1 card OR multiple cards of the SAME rank (e.g., pairs, triples, quads).
 */
function isValidDrop(cards) {
  if (!cards || cards.length === 0) return false;
  if (cards.length === 1) return true;
  
  // All cards have the same rank OR all are wild/jokers (0 points)
  const firstRank = cards[0].rank;
  const allSameRank = cards.every(c => c.rank === firstRank);
  if (allSameRank) return true;

  const allWild = cards.every(c => c.isWild || c.isJoker || c.rank === 'JOKER');
  return allWild;
}

module.exports = {
  SUITS,
  RANKS,
  getCardPointValue,
  applyWildJokerToCard,
  getDeckCountForPlayerCapacity,
  createShoe,
  calculateHandScore,
  isValidDrop
};
