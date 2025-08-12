'use server'

import { supabase } from '@/lib/supabase'; // Use Supabase client for DB operations
import { generateUUID } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import {
GamePhase, CardColor, Team, Card, Bet, GameState, Bets, BetsNumericValue,
CARDS_PER_PLAYER, MAX_PLAYERS, CARD_VALUES, CARD_COLORS,
BONHOMME_ROUGE_POINTS, BONHOMME_BRUN_POINTS, BASE_TRICK_POINTS, Player as GamePlayerType // Alias Player to avoid conflict
} from '@/game-types';
import {
createDeck, shuffleDeck, dealCards, canPlayCard,
playCard as logicPlayCard, // <--- RENAMED HERE
isTrickComplete, processTrickWin, areAllPlayersReady, generateTurnOrder,
canSelectTeam, selectTeam, canSelectSeat, selectSeat,
canPlaceBet, placeBet, areAllBetsPlaced, getHighestBet,
isRoundComplete, processRoundEnd, calculateRoundScores,
getBotPlay, // ADDED: Import bot card playing logic
getBotBet, // ADDED: Import bot betting logic
} from '@/game-logic';

// Update GameRoom to store the entire GameState as JSONB
interface GameRoomDB {
id: string;
name: string;
state: GameState; // This column will store the entire game state
created_at: Date;
}

// Helper to generate a unique game ID
async function generateGameId(): Promise<string> {
const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ00123456789';
let result = '';
for (let i = 0; i < 6; i++) {
result += characters.charAt(Math.floor(Math.random() * characters.length));
}
// Check uniqueness against the database
const { data: existingGame } = await supabase.from('game_rooms').select('id').eq('id', result).single();
if (existingGame) {
return generateGameId(); // Recurse if ID already exists
}
return result;
}

/**
* Handles bot actions in the WAITING phase: selecting team, seat, and setting ready.
* Modifies the gameState directly.
*/
function handleBotWaitingPhaseActions(gameState: GameState): GameState {
let updatedGameState = { ...gameState };
const playersArray = Object.values(updatedGameState.players);

// Get available teams and seats
const teamACount = playersArray.filter(p => p.team === Team.A).length;
const teamBCount = playersArray.filter(p => p.team === Team.B).length;
const occupiedSeats = new Set(playersArray.map(p => p.seatPosition).filter(s => s !== undefined));

for (const playerId in updatedGameState.players) {
const player = updatedGameState.players[playerId];

if (player.isBot) {
let botUpdated = false;

// 1. Select Team
if (player.team === undefined) {
if (teamACount < 2) {
updatedGameState = selectTeam(updatedGameState, player.id, Team.A);
botUpdated = true;
} else if (teamBCount < 2) {
updatedGameState = selectTeam(updatedGameState, player.id, Team.B);
botUpdated = true;
}
}

// Re-fetch player after potential team update
const currentBotState = updatedGameState.players[playerId];

// 2. Select Seat
if (currentBotState.seatPosition === undefined) {
for (let i = 0; i < MAX_PLAYERS; i++) {
if (!occupiedSeats.has(i)) {
  updatedGameState = selectSeat(updatedGameState, player.id, i);
  occupiedSeats.add(i); // Mark as occupied for subsequent bots
  botUpdated = true;
  break;
}
}
}

// Re-fetch player after potential seat update
const currentBotStateAfterSeat = updatedGameState.players[playerId];

// 3. Set Ready
if (!currentBotStateAfterSeat.isReady && currentBotStateAfterSeat.team !== undefined && currentBotStateAfterSeat.seatPosition !== undefined) {
updatedGameState.players[playerId] = { ...currentBotStateAfterSeat, isReady: true };
botUpdated = true;
}
}
}
return updatedGameState;
}

/**
* Handles a single bot turn for betting or card playing phases.
* Does NOT recursively call itself.
*/
async function processSingleBotTurn(gameState: GameState): Promise<GameState> {
let updatedGameState = { ...gameState };
const currentTurnPlayer = updatedGameState.players[updatedGameState.currentTurn];

if (!currentTurnPlayer || !currentTurnPlayer.isBot) {
return updatedGameState;
}

// Add a small delay for bot actions to make them observable
await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay

if (updatedGameState.phase === GamePhase.BETS) {
const botBet = getBotBet(updatedGameState, currentTurnPlayer.id);

try {
updatedGameState = placeBet(updatedGameState, currentTurnPlayer.id, botBet.betValue, botBet.trump);
} catch (error) {
throw error; // RE-THROW THE ERROR
}
} else if (updatedGameState.phase === GamePhase.CARDS) {
const cardToPlay = getBotPlay(updatedGameState, currentTurnPlayer.id);
if (cardToPlay) {
try {
updatedGameState = logicPlayCard(updatedGameState, currentTurnPlayer.id, cardToPlay);

// Check if trick is complete after bot plays
if (isTrickComplete(updatedGameState)) {
updatedGameState = processTrickWin(updatedGameState);

// If round is complete after processing trick win
if (isRoundComplete(updatedGameState)) {
  updatedGameState = processRoundEnd(updatedGameState);
}
}
} catch (error) {
throw error; // RE-THROW THE ERROR
}
} else {
const errorMessage = `🤖 Bot ${currentTurnPlayer.name} could not determine a card to play. This indicates a logic error.`;
throw new Error(errorMessage); // RE-THROW THE ERROR
}
}
return updatedGameState;
}


export async function createGame(formData: FormData): Promise<{ success: boolean; message?: string; gameId?: string; playerId?: string; playerName?: string }> {
const gameName = formData.get('gameName') as string;
const playerName = formData.get('playerName') as string;

if (!gameName || gameName.trim() === '') {
return { success: false, message: 'Game name cannot be empty.' };
}
if (!playerName || playerName.trim() === '') {
return { success: false, message: 'Player name cannot be empty.' };
}

try {
const gameId = await generateGameId();
const playerId = generateUUID();

const initialPlayer: GamePlayerType = { id: playerId, name: playerName, isReady: false, isBot: false }; // isBot: false for human

let initialGameState: GameState = {
phase: GamePhase.WAITING,
round: 1,
currentTurn: '',
dealer: '',
starter: '',
players: { [playerId]: initialPlayer },
bets: {},
playedCards: {},
playerHands: {},
wonTricks: {},
scores: { [playerId]: 0 },
turnOrder: [],
};

// Process bot actions if any bots were implicitly added (not applicable here, but good to keep consistent)
initialGameState = handleBotWaitingPhaseActions(initialGameState);

const { data, error } = await supabase.from('game_rooms').insert({
id: gameId,
name: gameName,
state: initialGameState,
}).select().single();

if (error) {
throw error;
}

return { success: true, gameId, playerId, playerName };
} catch (error) {
return { success: false, message: `Failed to create game: ${error instanceof Error ? error.message : String(error)}` };
}
}

export async function joinGame(formData: FormData): Promise<{ success: boolean; message?: string; gameId?: string; playerId?: string; playerName?: string }> {
const gameId = formData.get('gameId') as string;
const playerName = formData.get('playerName') as string;

if (!gameId || gameId.trim() === '') {
return { success: false, message: 'Game ID cannot be empty.' };
}
if (!playerName || playerName.trim() === '') {
return { success: false, message: 'Player name cannot be empty.' };
}

try {
const { data: gameDB, error: fetchError } = await supabase.from('game_rooms').select('id, name, state').eq('id', gameId.toUpperCase()).single();

if (fetchError || !gameDB) {
return { success: false, message: 'Game not found.' };
}

let gameState: GameState = gameDB.state;
const currentPlayers = Object.values(gameState.players);

if (currentPlayers.length >= MAX_PLAYERS) {
return { success: false, message: 'Game is full.' };
}

if (currentPlayers.some(p => p.name === playerName)) {
return { success: false, message: 'Player name already taken in this game.' };
}

const playerId = generateUUID();
const newPlayer: GamePlayerType = { id: playerId, name: playerName, isReady: false, isBot: false }; // isBot: false for human

gameState = {
...gameState,
players: {
...gameState.players,
[playerId]: newPlayer
},
scores: {
...gameState.scores,
[playerId]: 0
}
};

// Process bot actions after a human joins
gameState = handleBotWaitingPhaseActions(gameState);

const { error: updateError } = await supabase.from('game_rooms').update({ state: gameState }).eq('id', gameId.toUpperCase());

if (updateError) {
throw updateError;
}

return { success: true, gameId, playerId, playerName };
} catch (error) {
return { success: false, message: `Failed to join game: ${error instanceof Error ? error.message : String(error)}` };
}
}

export async function rejoinGame(gameId: string, playerId: string, playerName: string): Promise<{ success: boolean; message?: string; gameId?: string; playerId?: string; playerName?: string }> {
if (!gameId || !playerId || !playerName) {
return { success: false, message: 'Missing game or player information.' };
}

try {
const { data: gameDB, error: fetchError } = await supabase.from('game_rooms').select('id, name, state').eq('id', gameId.toUpperCase()).single();

if (fetchError || !gameDB) {
return { success: false, message: 'Game not found.' };
}

const gameState: GameState = gameDB.state;
const playerExists = gameState.players[playerId] && gameState.players[playerId].name === playerName;

if (!playerExists) {
return { success: false, message: 'Player not found in this game with provided credentials.' };
}

return { success: true, gameId, playerId, playerName };
} catch (error) {
return { success: false, message: 'Failed to rejoin game. Please try again.' };
}
}

export async function getAvailableGames(): Promise<Array<{ id: string; name: string; players: GamePlayerType[]; status: GamePhase; createdAt: Date }>> {
try {
const now = new Date();
const { data: activeGames, error } = await supabase.from('game_rooms')
.select('id, name, state, created_at')
.gte('created_at', new Date(now.getTime() - 3600000).toISOString()) // Games created in last hour
.order('created_at', { ascending: false });

if (error) {
throw error;
}

// Filter in application code
return activeGames
.filter(gameDB =>
gameDB.state.phase === GamePhase.WAITING &&
Object.keys(gameDB.state.players).length < MAX_PLAYERS
)
.map(gameDB => ({
id: gameDB.id,
name: gameDB.name,
players: Object.values(gameDB.state.players),
status: gameDB.state.phase,
createdAt: new Date(gameDB.created_at), // Ensure createdAt is a Date object
}));
} catch (error) {
return [];
}
}

// New Server Action: Fetch a single game's state
export async function getGameState(gameId: string): Promise<GameState | null> {
try {
const { data, error } = await supabase.from('game_rooms').select('state').eq('id', gameId.toUpperCase()).single();
if (error) {
throw error;
}
return data?.state || null;
} catch (error) {
return null;
}
}

// New Server Action: Start Game (Deal Cards)
export async function startGame(gameId: string): Promise<{ success: boolean; message?: string }> {
try {
let gameState = await getGameState(gameId);
if (!gameState) {
return { success: false, message: 'Game not found.' };
}
if (gameState.phase !== GamePhase.WAITING) {
return { success: false, message: 'Game has already started or finished.' };
}
const playersInGame = Object.values(gameState.players);
if (playersInGame.length < MAX_PLAYERS) {
return { success: false, message: `Need ${MAX_PLAYERS} players to start.` };
}
if (!areAllPlayersReady(gameState)) {
return { success: false, message: 'Not all players are ready.' };
}

// Generate turn order based on seat positions
const turnOrder = generateTurnOrder(gameState);
if (turnOrder.length !== MAX_PLAYERS) {
return { success: false, message: 'Invalid seat positions for all players.' };
}

// Set initial dealer and starter (e.g., first player in turn order is dealer, next is starter)
const initialDealerId = turnOrder[0];
const initialStarterId = turnOrder[1]; // Player after dealer starts first round

// Deal cards
let newGameState = {
...gameState,
turnOrder: turnOrder,
dealer: initialDealerId,
starter: initialStarterId,
currentTurn: initialStarterId, // Starter takes first turn
phase: GamePhase.BETS, // Move to betting phase after dealing
round: 1, // Start round 1
bets: {}, // Reset bets for new round
highestBet: undefined,
trump: undefined,
playedCards: {},
wonTricks: turnOrder.reduce((acc, id) => ({ ...acc, [id]: 0 }), {}),
scores: turnOrder.reduce((acc, id) => ({ ...acc, [id]: 0 }), {}), // Initialize scores
};
newGameState = dealCards(newGameState); // This updates playerHands

// No automatic bot turn here. It will be triggered by the client.

const { error } = await supabase.from('game_rooms').update({ state: newGameState }).eq('id', gameId.toUpperCase());

if (error) {
throw error;
}

return { success: true };
} catch (error) {
return { success: false, message: 'Failed to start game. Please try again.' };
}
}

// New Server Action: Play Card
export async function playCard(gameId: string, playerId: string, cardId: string): Promise<{ success: boolean; message?: string }> {
try {
let gameState = await getGameState(gameId);
if (!gameState) {
return { success: false, message: 'Game not found.' };
}

const playerHand = gameState.playerHands[playerId] || [];
const cardToPlay = playerHand.find(c => c.id === cardId);

if (!cardToPlay) {
return { success: false, message: 'Card not found in your hand.' };
}

// Use game logic to validate and play card
if (!canPlayCard(gameState, playerId, cardToPlay)) {
return { success: false, message: 'Invalid card play.' };
}

let newGameState = logicPlayCard(gameState, playerId, cardToPlay);

// Check if trick is complete after playing the card
if (isTrickComplete(newGameState)) {
newGameState = processTrickWin(newGameState);

// If round is complete after processing trick win
if (isRoundComplete(newGameState)) {
newGameState = processRoundEnd(newGameState);
}
}

// No automatic bot turn here. It will be triggered by the client.

const { error } = await supabase.from('game_rooms').update({ state: newGameState }).eq('id', gameId.toUpperCase());

if (error) {
throw error;
}

return { success: true };
} catch (error) {
return { success: false, message: `Failed to play card: ${error instanceof Error ? error.message : String(error)}` };
}
}

// New Server Action: Select Team
export async function selectTeamAction(gameId: string, playerId: string, team: Team): Promise<{ success: boolean; message?: string }> {
try {
let gameState = await getGameState(gameId);
if (!gameState) {
return { success: false, message: 'Game not found.' };
}
if (gameState.phase !== GamePhase.WAITING) {
return { success: false, message: 'Cannot select team in current phase.' };
}

let newGameState = selectTeam(gameState, playerId, team);

// Process bot actions after a human selects team
newGameState = handleBotWaitingPhaseActions(newGameState);

const { error } = await supabase.from('game_rooms').update({ state: newGameState }).eq('id', gameId.toUpperCase());

if (error) {
throw error;
}

revalidatePath('/'); // ADDED: Revalidate the home page to show updated player info

return { success: true };
} catch (error) {
return { success: false, message: `Failed to select team: ${error instanceof Error ? error.message : String(error)}` };
}
}

// New Server Action: Select Seat
export async function selectSeatAction(gameId: string, playerId: string, seatPosition: number): Promise<{ success: boolean; message?: string }> {
try {
let gameState = await getGameState(gameId);
if (!gameState) return { success: false, message: 'Game not found.' };
if (gameState.phase !== GamePhase.WAITING) return { success: false, message: 'Cannot select seat in current phase.' };

let newGameState = selectSeat(gameState, playerId, seatPosition);

// Process bot actions after a human selects seat
newGameState = handleBotWaitingPhaseActions(newGameState);

const { error } = await supabase.from('game_rooms').update({ state: newGameState }).eq('id', gameId.toUpperCase());

if (error) {
throw error;
}
revalidatePath('/'); // ADDED: Revalidate the home page to show updated player info

return { success: true };
} catch (error) {
return { success: false, message: `Failed to select seat: ${error instanceof Error ? error.message : String(error)}` };
}
}

// New Server Action: Set Player Ready
export async function setPlayerReadyAction(gameId: string, playerId: string, isReady: boolean): Promise<{ success: boolean; message?: string }> {
try {
let gameState = await getGameState(gameId);
if (!gameState) return { success: false, message: 'Game not found.' };
if (gameState.phase !== GamePhase.WAITING) return { success: false, message: 'Cannot change ready status in current phase.' };

const player = gameState.players[playerId];
if (!player) return { success: false, message: 'Player not found.' };

const newPlayers = {
...gameState.players,
[playerId]: { ...player, isReady }
};

let newGameState = {
...gameState,
players: newPlayers
};

// Process bot actions after a human sets ready
newGameState = handleBotWaitingPhaseActions(newGameState);

const { error } = await supabase.from('game_rooms').update({ state: newGameState }).eq('id', gameId.toUpperCase());

if (error) {
throw error;
}
return { success: true };
} catch (error) {
return { success: false, message: `Failed to set ready status: ${error instanceof Error ? error.message : String(error)}` };
}
}

// New Server Action: Place Bet
export async function placeBetAction(gameId: string, playerId: string, betValue: Bets, trump: boolean): Promise<{ success: boolean; message?: string }> {
try {
  let gameState = await getGameState(gameId);
  if (!gameState) return { success: false, message: 'Game not found.' };

  let newGameState = placeBet(gameState, playerId, betValue, trump);
  console.log(`DEBUG: In placeBetAction - Checking if all bets are placed. Current phase: ${newGameState.phase}`);
  console.log(`DEBUG: In placeBetAction - New game state bets: ${JSON.stringify(newGameState.bets, null, 2)}`);
  console.log(`DEBUG: In placeBetAction - New game state turn order: ${newGameState.turnOrder.join(', ')}`);
  console.log(`DEBUG: In placeBetAction - Result of areAllBetsPlaced: ${areAllBetsPlaced(newGameState)}`);
  console.log(`DEBUG: In placeBetAction - Bets count: ${Object.keys(newGameState.bets).length}, Turn order length: ${newGameState.turnOrder.length}`);

  // If all bets are placed, transition to CARDS phase
  if (areAllBetsPlaced(newGameState)) {
    const highestBet = getHighestBet(Object.values(newGameState.bets).filter((b): b is Bet => b !== null && b !== undefined));
    if (highestBet) {
      newGameState.highestBet = highestBet;
      newGameState.trump = undefined;
      newGameState.phase = GamePhase.CARDS;
      newGameState.currentTurn = highestBet.playerId; // Highest bettor plays first card
      console.log(`DEBUG: All bets placed. Transitioning to CARDS phase. Highest bettor: ${highestBet.playerId}`);
    } else {
      return { success: false, message: 'Could not determine highest bet after all players bet.' };
    }
  } else {
    // If not all bets are placed, move to the next player in the turn order
    const currentIndex = newGameState.turnOrder.indexOf(playerId);
    const nextIndex = (currentIndex + 1) % newGameState.turnOrder.length;
    newGameState.currentTurn = newGameState.turnOrder[nextIndex];
    console.log(`DEBUG: Not all bets placed. Moving turn to next player: ${newGameState.currentTurn}`);
  }

  const { error } = await supabase.from('game_rooms').update({ state: newGameState }).eq('id', gameId.toUpperCase());

  if (error) {
    throw error;
  }
  return { success: true };
} catch (error) {
  return { success: false, message: `Failed to place bet: ${error instanceof Error ? error.message : String(error)}` };
}
}

// New Server Action: Add Bot to Game
export async function addBotToGame(gameId: string): Promise<{ success: boolean; message?: string }> {
try {
let gameState = await getGameState(gameId);
if (!gameState) {
return { success: false, message: 'Game not found.' };
}
const currentPlayers = Object.values(gameState.players);

if (currentPlayers.length >= MAX_PLAYERS) {
return { success: false, message: 'Game is full, cannot add more bots.' };
}

const botId = generateUUID();
const botName = `Bot ${Math.floor(Math.random() * 1000)}`; // Simple bot naming

const newBot: GamePlayerType = {
id: botId,
name: botName,
isReady: false,
isBot: true, // Mark as bot
};

gameState = {
...gameState,
players: {
...gameState.players,
[botId]: newBot,
},
scores: {
...gameState.scores,
[botId]: 0,
},
};

// Immediately process bot actions for the newly added bot (and any existing ones)
gameState = handleBotWaitingPhaseActions(gameState);

const { error } = await supabase.from('game_rooms').update({ state: gameState }).eq('id', gameId.toUpperCase());

if (error) {
throw error;
}

revalidatePath('/');

return { success: true };
} catch (error) {
return { success: false, message: `Failed to add bot: ${error instanceof Error ? error.message : String(error)}` };
}
}

// NEW SERVER ACTION: Trigger a single bot's turn
export async function triggerBotTurn(gameId: string): Promise<{ success: boolean; message?: string }> {
try {
let gameState = await getGameState(gameId);
if (!gameState) {
return { success: false, message: 'Game not found.' };
}

const currentTurnPlayer = gameState.players[gameState.currentTurn];
if (!currentTurnPlayer || !currentTurnPlayer.isBot) {
return { success: false, message: "It's not a bot's turn." };
}

// Self-correction for inconsistent state: If current player already has a bet,
// it means the turn should have already advanced. Force advance the turn.
if (gameState.bets[currentTurnPlayer.id]) {
const currentIndex = gameState.turnOrder.indexOf(currentTurnPlayer.id);
const nextIndex = (currentIndex + 1) % gameState.turnOrder.length;
gameState.currentTurn = gameState.turnOrder[nextIndex];

const { error } = await supabase.from('game_rooms').update({ state: gameState }).eq('id', gameId.toUpperCase());
if (error) {
throw error;
}
return { success: true, message: "Inconsistent state corrected, turn advanced." };
}

if (gameState.phase !== GamePhase.BETS && gameState.phase !== GamePhase.CARDS) {
return { success: false, message: "Bots only play in betting or card phases." };
}

// Process the single bot turn
const newGameState = await processSingleBotTurn(gameState);

// Persist the updated state to the database
const { error } = await supabase.from('game_rooms').update({ state: newGameState }).eq('id', gameId.toUpperCase());

if (error) {
throw error;
}

return { success: true };
} catch (error) {
return { success: false, message: `Failed to trigger bot turn: ${error instanceof Error ? error.message : String(error)}` };
}
}
