// Deck management for Least Count Rush (supports 6 to 15 players with 2 to 4 decks)

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Point values based on Least Count standard rules:
// Ace = 1, Numbers = face value (2-10), Jack = 11, Queen = 12, King = 13, Jokers = 0
function getCardPointValue(rank, wildJokerRank = null) {
  if (rank === 'JOKER') return 0;
  if (wildJokerRank && rank === wildJokerRank) return 0;
  if (rank === 'A') return 1;
  if (rank === 'J') return 11;
  if (rank === 'Q') return 12;
  if (rank === 'K') return 13;
  return parseInt(rank, 10);
}

function applyWildJokerToCard(card, wildJokerRank) {
  if (!card) return card;
  if (card.isJoker || (wildJokerRank && card.rank === wildJokerRank)) {
    card.isWild = true;
    card.points = 0;
  } else {
    card.isWild = false;
    card.points = getCardPointValue(card.rank);
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
function createShoe(deckCount = 2, includeJokers = true) {
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
          points: getCardPointValue(rank),
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
  
  // Multiple cards must all have the same rank (or all be jokers)
  const firstRank = cards[0].rank;
  return cards.every(c => c.rank === firstRank);
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
