// Game types and enums for the card game
export enum GamePhase {
  WAITING = 'waiting',
  TEAM_SELECTION = 'team_selection',
  BETS = 'bets',
  CARDS = 'cards',
  TRICK_SCORING = 'trick_scoring',
  ROUND_END = 'round_end',
  GAME_END = 'game_end'
}

export enum CardColor {
  RED = 'red',
  BLUE = 'blue',
  GREEN = 'green',
  BROWN = 'brown'
}

export enum Bets {
  SKIP = 'skip',
  SEVEN = 'seven',
  EIGHT = 'eight',
  NINE = 'nine',
  TEN = 'ten',
  ELEVEN = 'eleven',
  TWELVE = 'twelve',
}

export const BetsNumericValue: Record<Bets, number> = {
  [Bets.SKIP]: 0,
  [Bets.SEVEN]: 7,
  [Bets.EIGHT]: 8,
  [Bets.NINE]: 9,
  [Bets.TEN]: 10,
  [Bets.ELEVEN]: 11,
  [Bets.TWELVE]: 12,
}

export enum Team {
  A = 'A',
  B = 'B'
}

export interface Card {
  id: string
  color: CardColor
  value: number // 0-7
  playerId: string // ID of player holding or who played the card
  trickNumber: number // Which trick this card was played in
  playOrder: number // Order within the trick
}

export interface Bet {
  playerId: string
  betValue: Bets // The bet type (SKIP, SEVEN, EIGHT, etc.)
  value: number // Numeric value from BetsNumericValue
  trump: boolean // true if betting with trump
  timestamp?: Date
}

export interface Player {
  id: string
  name: string
  team?: Team
  seatPosition?: number // 0-3 for 4 players
  isReady: boolean
  isBot: boolean // ADDED: To distinguish between human players and bots
}

export interface GameState {
  phase: GamePhase
  round: number
  currentTurn: string // player ID whose turn it is
  dealer: string // player ID of current dealer
  starter: string // player ID who starts the round

  trump?: CardColor
  highestBet?: Bet
  players: Record<string, Player> // Player IDs mapped to Player objects
  bets: Record<string, Bet> // Player IDs mapped to their bets
  playedCards: Record<string, Card> // Player IDs mapped to the card they played in current trick
  playerHands: Record<string, Card[]> // Player IDs mapped to their hand of cards
  wonTricks: Record<string, number> // Player IDs mapped to points won in tricks
  scores: Record<string, number> // Player IDs mapped to total game scores
  turnOrder: string[] // ordered player IDs
}

export interface TrickResult {
  winningCard: Card
  winningPlayerId: string
  points: number
  cards: Card[]
}

export interface RoundResult {
  bettingTeamWon: boolean
  teamAScore: number
  teamBScore: number
  highestBet: Bet
}

// Constants
export const CARDS_PER_PLAYER = 8
export const MAX_PLAYERS = 4
export const CARD_VALUES = [0, 1, 2, 3, 4, 5, 6, 7]
export const CARD_COLORS = [CardColor.RED, CardColor.BLUE, CardColor.GREEN, CardColor.BROWN]

// Special card points
export const BONHOMME_ROUGE_POINTS = 5 // Red 0
export const BONHOMME_BRUN_POINTS = -3 // Brown 0
export const BASE_TRICK_POINTS = 1
