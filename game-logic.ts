import {
GamePhase,
CardColor,
Team,
Card,
Bet,
GameState,
Bets,
BetsNumericValue,
CARDS_PER_PLAYER,
MAX_PLAYERS,
CARD_VALUES,
CARD_COLORS,
BONHOMME_ROUGE_POINTS,
BONHOMME_BRUN_POINTS,
BASE_TRICK_POINTS,
Player as GamePlayerType // Alias Player to avoid conflict
} from './game-types'

// Team and seat selection logic
export function canSelectTeam(gameState: GameState, playerId: string, team: Team): boolean {
const players = Object.values(gameState.players)
const teamACount = players.filter(p => p.team === Team.A).length
const teamBCount = players.filter(p => p.team === Team.B).length

// Each team can have max 2 players
if (team === Team.A && teamACount >= 2) return false
if (team === Team.B && teamBCount >= 2) return false

return true
}

export function selectTeam(gameState: GameState, playerId: string, team: Team): GameState {
if (!canSelectTeam(gameState, playerId, team)) {
throw new Error('Cannot select this team')
}

return {
...gameState,
players: {
  ...gameState.players,
  [playerId]: {
    ...gameState.players[playerId],
    team
  }
}
}
}

export function canSelectSeat(gameState: GameState, playerId: string, seatPosition: number): boolean {
if (seatPosition < 0 || seatPosition >= MAX_PLAYERS) return false

const players = Object.values(gameState.players)
const seatTaken = players.some(p => p.seatPosition === seatPosition)

return !seatTaken
}

export function selectSeat(gameState: GameState, playerId: string, seatPosition: number): GameState {
if (!canSelectSeat(gameState, playerId, seatPosition)) {
throw new Error('Seat is already taken')
}

return {
...gameState,
players: {
  ...gameState.players,
  [playerId]: {
    ...gameState.players[playerId],
    seatPosition
  }
}
}
}

// Check if all players are ready for next phase
export function areAllPlayersReady(gameState: GameState): boolean {
const players = Object.values(gameState.players)
return players.length === MAX_PLAYERS && players.every(p => p.isReady)
}

export function areTeamsBalanced(gameState: GameState): boolean {
const players = Object.values(gameState.players)
const teamACount = players.filter(p => p.team === Team.A).length
const teamBCount = players.filter(p => p.team === Team.B).length

return teamACount === 2 && teamBCount === 2
}

export function areSeatsSelected(gameState: GameState): boolean {
const players = Object.values(gameState.players)
return players.every(p => p.seatPosition !== undefined)
}

// Generate turn order based on seat positions
export function generateTurnOrder(gameState: GameState): string[] {
const players = Object.values(gameState.players)
return players
.sort((a, b) => (a.seatPosition || 0) - (b.seatPosition || 0))
.map(p => p.id)
}

// Betting logic
export function canPlaceBet(
gameState: GameState,
playerId: string,
bet: Omit<Bet, 'playerId' | 'timestamp'>
): boolean {
console.log(`DEBUG: [canPlaceBet] Checking bet for Player: ${playerId}, Bet: ${JSON.stringify(bet)}`);
console.log(`DEBUG: [canPlaceBet] Current Game State Phase: ${gameState.phase}, Current Turn: ${gameState.currentTurn}`);
console.log(`DEBUG: [canPlaceBet] Player's existing bet: ${JSON.stringify(gameState.bets[playerId])}`);

// Must be player's turn
if (gameState.currentTurn !== playerId) {
  console.log(`DEBUG: [canPlaceBet] Reason: Not player's turn. Current: ${gameState.currentTurn}, Player: ${playerId}`);
  return false;
}
// Must be in betting phase
if (gameState.phase !== GamePhase.BETS) {
  console.log(`DEBUG: [canPlaceBet] Reason: Not in betting phase. Current: ${gameState.phase}`);
  return false;
}
// Player must not have already bet
if (gameState.bets[playerId]) {
  console.log(`DEBUG: [canPlaceBet] Reason: Player already placed a bet.`);
  return false;
}
// Bet must be valid
if (!bet || bet.betValue === undefined || bet.value === undefined) {
  console.log(`DEBUG: [canPlaceBet] Reason: Invalid bet object.`);
  return false;
}

const existingBets = Object.values(gameState.bets).filter((b): b is Bet => b !== null && b !== undefined)
const highestBet = existingBets.length > 0 ? getHighestBet(existingBets) : null;
const betsPlacedCount = Object.keys(gameState.bets).filter(id => gameState.bets[id] !== undefined).length;
const isLastToBet = betsPlacedCount === gameState.turnOrder.length - 1; // True if this player is the last one to place a bet

console.log(`DEBUG: [canPlaceBet] Highest existing bet: ${highestBet ? JSON.stringify(highestBet) : 'None'}`);
console.log(`DEBUG: [canPlaceBet] Bets placed count: ${betsPlacedCount}, Total players: ${gameState.turnOrder.length}, Is last to bet: ${isLastToBet}`);

// Skip bet validation
if (bet.betValue === Bets.SKIP) {
  const isValidSkip = validateSkipBet(existingBets, gameState.turnOrder || [], playerId, gameState.bets);
  console.log(`DEBUG: [canPlaceBet] Skip bet validation result: ${isValidSkip}`);
  return isValidSkip;
}

// Regular bet validation
const isValidRegular = validateRegularBet(bet, highestBet, isLastToBet);
console.log(`DEBUG: [canPlaceBet] Regular bet validation result: ${isValidRegular}`);
return isValidRegular;
}

/**
* Validates if a skip bet is allowed
*/
function validateSkipBet(
existingBets: Bet[],
turnPlayerIds: string[],
playerId: string,
playerBets: Record<string, Bet>
): boolean {
const betsPlaced = Object.keys(playerBets).filter(id => playerBets[id] !== undefined).length;
const isLastToBet = betsPlaced === turnPlayerIds.length - 1;

// Last player can't skip if everyone else has skipped (someone must bet)
if (isLastToBet) {
const hasRealBet = existingBets.some(bet => bet.betValue !== Bets.SKIP);
if (!hasRealBet) {
  return false; // Last player must bet if no one else has
}
}
// All other players (including first player) can always skip
return true;
}

/**
* Validates if a regular (non-skip) bet is allowed
*/
function validateRegularBet(bet: Omit<Bet, 'playerId' | 'timestamp'>, highestBet: Bet | null, isLastToBet: boolean): boolean {
// If no existing bets, any bet 7+ is valid (minimum bet is 7)
if (!highestBet) {
const result = bet.value >= 7;
return result;
}

// Skip bets don't count as "real" bets for comparison
if (highestBet.betValue === Bets.SKIP) {
const result = bet.value >= 7;
return result;
}

// Must bet higher than current highest
if (bet.value > highestBet.value) {
return true;
}

// If values are equal:
if (bet.value === highestBet.value) {
// Rule 1: No-trump beats trump (e.g., 7 no-trump beats 7 trump)
if (!bet.trump && highestBet.trump) {
  return true;
}
// Rule 2: Last player can equalize (if trump status is the same)
// This means the last player can match the highest bet if it's not an "upgrade" from trump to no-trump.
if (isLastToBet && bet.trump === highestBet.trump) {
  return true;
}
}

return false;
}

/**
* Gets all possible bet values
*/
export function getAllBets(): Omit<Bet, 'playerId' | 'timestamp'>[] {
return Object.values(Bets).map(betValue => ({
betValue,
value: BetsNumericValue[betValue],
trump: false // Skip is always no-trump, others default to no-trump (can be changed)
}))
}

export function placeBet(gameState: GameState, playerId: string, betValue: Bets, trump: boolean): GameState {
const bet: Bet = {
playerId,
betValue,
value: BetsNumericValue[betValue],
trump,
timestamp: new Date()
}

if (!canPlaceBet(gameState, playerId, bet)) {
throw new Error('Cannot place this bet')
}

const newGameState = {
...gameState,
bets: {
  ...gameState.bets,
  [playerId]: bet
}
}
return newGameState
}

/**
* Finds the highest bet among all placed bets
*/
export function getHighestBet(bets: Bet[]): Bet | null {
if (bets.length === 0) return null

const result = bets.reduce((highest, current) => {
// Compare values first - higher value always wins
if (current.value > highest.value) {
  return current
}
if (current.value < highest.value) {
  return highest
}

// If values are equal, no-trump beats trump (7 no-trump > 7 trump)
if (current.value === highest.value) {
  if (!current.trump && highest.trump) {
    return current
  }
  if (current.trump && !highest.trump) {
    return highest
  }
}

// If we get here, they're equal in all aspects
return highest
}, bets[0])

return result
}

export function areAllBetsPlaced(gameState: GameState): boolean {
const playerIds = gameState.turnOrder;
console.log(`DEBUG: areAllBetsPlaced - Player IDs in turn order: ${playerIds.join(', ')}`);
console.log(`DEBUG: areAllBetsPlaced - Current bets: ${JSON.stringify(gameState.bets, null, 2)}`);

const playersWithBets = new Set(Object.keys(gameState.bets));
const playersMissingBets = playerIds.filter(id => !playersWithBets.has(id));

if (playersMissingBets.length > 0) {
  console.log(`DEBUG: areAllBetsPlaced - Players still missing bets: ${playersMissingBets.join(', ')}`);
}

const allPlaced = playerIds.every(id => gameState.bets[id] !== undefined);
console.log(`DEBUG: areAllBetsPlaced - All bets placed: ${allPlaced}`);
return allPlaced;
}

// Card dealing logic
export function createDeck(): Card[] {
const deck: Card[] = []
let cardId = 0

for (const color of CARD_COLORS) {
for (const value of CARD_VALUES) {
  deck.push({
    id: `${color}-${value}-${cardId++}`,
    color,
    value,
    playerId: '', // Will be assigned when dealt
    trickNumber: 0,
    playOrder: 0
  })
}
}

return deck
}

export function shuffleDeck(deck: Card[]): Card[] {
const shuffled = [...deck]
for (let i = shuffled.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1))
;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
}
return shuffled
}

export function dealCards(gameState: GameState): GameState {
const deck = shuffleDeck(createDeck())
const playerHands: Record<string, Card[]> = {}

// Deal cards to each player
gameState.turnOrder.forEach((playerId, playerIndex) => {
playerHands[playerId] = []
for (let cardIndex = 0; cardIndex < CARDS_PER_PLAYER; cardIndex++) {
  const deckIndex = playerIndex * CARDS_PER_PLAYER + cardIndex
  const card = { ...deck[deckIndex], playerId } // Assign playerId to card
  playerHands[playerId].push(card)
}
})

return {
...gameState,
playerHands,
playedCards: {}, // Reset played cards for new round
wonTricks: gameState.turnOrder.reduce((acc, id) => ({ ...acc, [id]: 0 }), {}), // Reset won tricks
}
}

// Card playing logic
export function canPlayCard(gameState: GameState, playerId: string, card: Card): boolean {
if (gameState.phase !== GamePhase.CARDS) {
return false
}
if (gameState.currentTurn !== playerId) {
return false
}

const playerHand = gameState.playerHands[playerId] || []
const hasCard = playerHand.some(c => c.id === card.id)
if (!hasCard) {
return false
}

const playedCards = Object.values(gameState.playedCards).sort((a, b) => a.playOrder - b.playOrder)
const firstCard = playedCards[0]

// If this is the first card of the trick, any card can be played
if (!firstCard) {
return true
}

// Must follow suit if possible, but trump cards can always be played
const firstColor = firstCard.color
const trump = gameState.trump

const cardsOfFirstColor = playerHand.filter(c => c.color === firstColor)
const hasColorInHand = cardsOfFirstColor.length > 0

// Check if the card being played is trump
const isPlayingTrump = trump && card.color === trump

// Can play if:
// 1. Same color as first card (following suit)
// 2. Don't have any cards of the first color (can't follow suit)
// 3. Playing a trump card (trump can always be played)
const canPlay = card.color === firstColor || !hasColorInHand || isPlayingTrump

return canPlay
}

export function playCard(gameState: GameState, playerId: string, card: Card): GameState {
if (!canPlayCard(gameState, playerId, card)) {
throw new Error('Cannot play this card')
}

const playerHand = gameState.playerHands[playerId] || []
const newHand = playerHand.filter(c => c.id !== card.id)

const playedCards = Object.values(gameState.playedCards)
const playOrder = playedCards.length + 1

const playedCard = {
...card,
playOrder,
trickNumber: gameState.round // Assign current round as trick number
}

const newGameState = {
...gameState,
playerHands: {
  ...gameState.playerHands,
  [playerId]: newHand
},
playedCards: {
  ...gameState.playedCards,
  [playerId]: playedCard
}
}

// Set trump on first card if highest bet was with trump
if (playedCards.length === 0 && newGameState.highestBet?.trump) {
newGameState.trump = card.color
}

// Move to next player
const currentIndex = newGameState.turnOrder.indexOf(playerId)
const nextIndex = (currentIndex + 1) % newGameState.turnOrder.length
newGameState.currentTurn = newGameState.turnOrder[nextIndex]

return newGameState
}

export function getWinningCard(cards: Card[], trump?: CardColor): Card | null {
if (cards.length === 0) return null

const leadColor = cards[0].color

return cards.reduce((best, current) => {
const bestIsTrump = best.color === trump
const currentIsTrump = current.color === trump

// Trump beats non-trump
if (currentIsTrump && !bestIsTrump) return current
if (!currentIsTrump && bestIsTrump) return best

// Following lead suit beats non-lead suit (when no trump involved)
const bestFollowsLead = best.color === leadColor
const currentFollowsLead = current.color === leadColor

if (currentFollowsLead && !bestFollowsLead) return current
if (!currentFollowsLead && bestFollowsLead) return best

// Higher value wins within same category
return current.value > best.value ? current : best
}, cards[0])
}

export function calculateTrickPoints(cards: Card[]): number {
let points = BASE_TRICK_POINTS
const hasBonhommeRouge = cards.some(c => c.color === CardColor.RED && c.value === 0)
const hasBonhommeBrun = cards.some(c => c.color === CardColor.BROWN && c.value === 0)

if (hasBonhommeRouge) points += BONHOMME_ROUGE_POINTS
if (hasBonhommeBrun) points += BONHOMME_BRUN_POINTS

return points
}

export function isTrickComplete(gameState: GameState): boolean {
const playedCards = Object.values(gameState.playedCards)
return playedCards.length === gameState.turnOrder.length
}

export function isRoundComplete(gameState: GameState): boolean {
// Round is complete when all players have no cards left
return gameState.turnOrder.every(playerId => {
const hand = gameState.playerHands[playerId] || []
return hand.length === 0
})
}

export function processTrickWin(gameState: GameState): GameState {
if (!isTrickComplete(gameState)) {
throw new Error('Trick is not complete')
}

const playedCards = Object.values(gameState.playedCards).sort((a, b) => a.playOrder - b.playOrder)
const winningCard = getWinningCard(playedCards, gameState.trump)

if (!winningCard) {
throw new Error('No winning card found')
}

const winningPlayerId = winningCard.playerId
const points = calculateTrickPoints(playedCards)

const newGameState = {
...gameState,
wonTricks: {
  ...gameState.wonTricks,
  [winningPlayerId]: (gameState.wonTricks[winningPlayerId] || 0) + points
},
playedCards: {}, // Clear played cards for next trick
currentTurn: winningPlayerId, // Winner starts next trick
starter: winningPlayerId // Winner starts next trick
}

// If round is complete, move to scoring phase
if (isRoundComplete(newGameState)) {
newGameState.phase = GamePhase.TRICK_SCORING
}

return newGameState
}

// Round scoring logic
export function calculateRoundScores(gameState: GameState): { teamAScore: number; teamBScore: number; bettingTeamWon: boolean } {
if (!gameState.highestBet) {
throw new Error('No highest bet found')
}

const highestBet = gameState.highestBet
const bettingPlayerId = highestBet.playerId
const bettingPlayerTeam = gameState.players[bettingPlayerId].team

if (!bettingPlayerTeam) {
throw new Error('Betting player has no team')
}

// Get all players in each team
const teamAPlayers = Object.values(gameState.players).filter(p => p.team === Team.A)
const teamBPlayers = Object.values(gameState.players).filter(p => p.team === Team.B)

// Calculate total tricks won by each team
const teamATricks = teamAPlayers.reduce((sum, player) => sum + (gameState.wonTricks[player.id] || 0), 0)
const teamBTricks = teamBPlayers.reduce((sum, player) => sum + (gameState.wonTricks[player.id] || 0), 0)

const bettingTeamTricks = bettingPlayerTeam === Team.A ? teamATricks : teamBTricks
const defendingTeamTricks = bettingPlayerTeam === Team.A ? teamBTricks : teamATricks

const bettingTeamWon = bettingTeamTricks >= highestBet.value

let bettingTeamScore = 0
let defendingTeamScore = 0

if (bettingTeamWon) {
// Betting team made their bet
const extraTricks = bettingTeamTricks - highestBet.value
bettingTeamScore = highestBet.value + (extraTricks * (highestBet.trump ? 1 : 2)) // Base bet value + extra tricks
defendingTeamScore = defendingTeamTricks
} else {
// Betting team failed their bet
bettingTeamScore = -highestBet.value // Lose the bet value
defendingTeamScore = defendingTeamTricks
}

return {
teamAScore: bettingPlayerTeam === Team.A ? bettingTeamScore : defendingTeamScore,
teamBScore: bettingPlayerTeam === Team.B ? bettingTeamScore : defendingTeamScore,
bettingTeamWon
}
}

export function processRoundEnd(gameState: GameState): GameState {
const { teamAScore, teamBScore } = calculateRoundScores(gameState)

// Update scores
const newScores = { ...gameState.scores }
Object.values(gameState.players).forEach(player => {
if (player.team === Team.A) {
  newScores[player.id] = (newScores[player.id] || 0) + teamAScore
} else if (player.team === Team.B) {
  newScores[player.id] = (newScores[player.id] || 0) + teamBScore
}
})

// Reset for next round
const newGameState = {
...gameState,
scores: newScores,
round: gameState.round + 1,
phase: GamePhase.BETS, // Assuming next round starts with bets
playedCards: {},
wonTricks: gameState.turnOrder.reduce((acc, id) => ({ ...acc, [id]: 0 }), {}),
bets: {},
highestBet: undefined,
trump: undefined
}

// Deal new cards
const gameStateWithCards = dealCards(newGameState)

// Set new dealer and starter (rotate)
const currentDealerIndex = gameState.turnOrder.indexOf(gameState.dealer)
const newDealerIndex = (currentDealerIndex + 1) % gameState.turnOrder.length
const newStarterIndex = (newDealerIndex + 1) % gameState.turnOrder.length // Player after new dealer starts

gameStateWithCards.dealer = gameState.turnOrder[newDealerIndex]
gameStateWithCards.starter = gameState.turnOrder[newStarterIndex]
gameStateWithCards.currentTurn = gameStateWithCards.starter // New starter takes first turn

return gameStateWithCards
}

/**
* Bot AI: Determines which card a bot should play.
* Simple strategy:
* 1. If it's the first card of the trick, play a random card.
* 2. If not the first card:
*    a. Try to play a card of the leading suit.
*    b. If no leading suit cards, try to play a trump card.
*    c. Otherwise, play any other card.
*/
export function getBotPlay(gameState: GameState, botId: string): Card | null {
const botHand = gameState.playerHands[botId] || [];
if (botHand.length === 0) {
return null;
}

const playedCards = Object.values(gameState.playedCards).sort((a, b) => a.playOrder - b.playOrder);
const firstCard = playedCards[0];
const leadColor = firstCard?.color;
const trumpColor = gameState.trump;

// Filter for playable cards based on current game state
const playableCards = botHand.filter(card => canPlayCard(gameState, botId, card));

if (playableCards.length === 0) {
return null; // Should not happen if canPlayCard logic is correct
}

// Strategy 1: If first card of trick, play a random playable card
if (!firstCard) {
return playableCards[Math.floor(Math.random() * playableCards.length)];
}

// Strategy 2: Try to follow suit
const cardsOfLeadColor = playableCards.filter(card => card.color === leadColor);
if (cardsOfLeadColor.length > 0) {
// Play highest card of lead color
return cardsOfLeadColor.sort((a, b) => b.value - a.value)[0];
}

// Strategy 3: If cannot follow suit, try to play a trump card
const trumpCards = playableCards.filter(card => card.color === trumpColor);
if (trumpCards.length > 0) {
// Play highest trump card
return trumpCards.sort((a, b) => b.value - a.value)[0];
}

// Strategy 4: If cannot follow suit and no trump, play any other playable card (e.g., lowest value)
return playableCards.sort((a, b) => a.value - b.value)[0];
}

/**
* Bot AI: Determines which bet a bot should place.
* Simple strategy:
* 1. If no bets, bet 7 no-trump.
* 2. If there's a bet, try to beat it with a slightly higher no-trump bet.
* 3. If cannot beat, skip.
*/
export function getBotBet(gameState: GameState, botId: string): { betValue: Bets; trump: boolean } {
const existingBets = Object.values(gameState.bets).filter((b): b is Bet => b !== null && b !== undefined);
const highestBet = existingBets.length > 0 ? getHighestBet(existingBets) : null;

const allPossibleBets = Object.values(BetsNumericValue)
.filter(value => value > 0) // Exclude SKIP's numeric value (0) for initial consideration
.sort((a, b) => a - b); // Sort numerically ascending

// Determine if this bot is the last to bet and if no real bets have been placed
const betsPlacedCount = Object.keys(gameState.bets).filter(id => gameState.bets[id] !== undefined).length;
const currentBotIndex = gameState.turnOrder.indexOf(botId);
const isLastToBet = betsPlacedCount === gameState.turnOrder.length - 1;
const hasRealBetAmongExisting = existingBets.some(bet => bet.betValue !== Bets.SKIP);

if (isLastToBet && !hasRealBetAmongExisting) {
return { betValue: Bets.SEVEN, trump: false };
}

// Try to find the lowest valid bet that is higher than the current highest
for (const betValueNum of allPossibleBets) {
const betEnum = Object.keys(BetsNumericValue).find(key => BetsNumericValue[key as Bets] === betValueNum) as Bets;
if (!betEnum) continue;

// Try with no-trump first
let potentialBet: Omit<Bet, 'playerId' | 'timestamp'> = {
  betValue: betEnum,
  value: betValueNum,
  trump: false
};
if (canPlaceBet(gameState, botId, potentialBet)) {
  return { betValue: betEnum, trump: false };
}

// Then try with trump if no-trump didn't work for the same value
potentialBet = {
  betValue: betEnum,
  value: betValueNum,
  trump: true
};
if (canPlaceBet(gameState, botId, potentialBet)) {
  return { betValue: betEnum, trump: true };
}
}

// If no higher bet can be placed, or if all other options failed, default to SKIP.
return { betValue: Bets.SKIP, trump: false };
}
