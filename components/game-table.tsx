'use client';

import { useState, useEffect, useCallback } from 'react';
import { CardComponent } from './card-component';
import { PlayerHand } from './player-hand';
import { Button } from '@/components/ui/button';
import { OpponentHand } from './opponent-hand';
import { OnlineStatusIndicator } from './online-status-indicator';
import { PlayerPresenceIndicator } from './player-presence-indicator';
import { supabase } from '@/lib/supabase';
import { usePlayerPresence } from '@/hooks/use-player-presence';
import {
getGameState,
startGame,
playCard as serverPlayCard,
selectTeamAction,
selectSeatAction,
setPlayerReadyAction,
placeBetAction,
addBotToGame,
triggerBotTurn,
} from '@/actions/game';
import {
GamePhase,
CardColor,
Team,
GameState,
Bets,
MAX_PLAYERS
} from '@/game-types';
import { getAllBets } from '@/game-logic';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface GameTableProps {
gameId: string;
playerId: string;
playerName: string;
}

export function GameTable({ gameId, playerId, playerName }: GameTableProps) {
const [game, setGame] = useState<GameState | null>(null);
const [loading, setLoading] = useState(true);
const [message, setMessage] = useState<string>('');
const [trickWinner, setTrickWinner] = useState<string | null>(null);
const [realtimeStatus, setRealtimeStatus] = useState<string>('connecting');
const [isTrumpBet, setIsTrumpBet] = useState<boolean>(false);
const [isBotTurnPending, setIsBotTurnPending] = useState<boolean>(false);
const [showBotView, setShowBotView] = useState<boolean>(false);

const toggleBotView = () => {
  setShowBotView(!showBotView);
};

const { onlinePlayers, isOnline, totalOnline } = usePlayerPresence(gameId, playerId, playerName);

const fetchAndUpdateGameState = useCallback(async (isInitialLoad = false) => {
  if (isInitialLoad) {
    setLoading(true);
  }
  
  const latestGame = await getGameState(gameId);
  if (latestGame) {
    setGame(latestGame);
    setMessage(`Game ${gameId} - Phase: ${latestGame.phase}`);

    const currentTurnPlayer = latestGame.players[latestGame.currentTurn];
    if (latestGame.phase === GamePhase.CARDS && currentTurnPlayer?.id === playerId) {
      setMessage("It's your turn to play a card!");
    } else if (latestGame.phase === GamePhase.BETS && currentTurnPlayer?.id === playerId) {
      setMessage("It's your turn to place a bet!");
    } else if (latestGame.phase === GamePhase.WAITING) {
      setMessage(
        `Waiting for players (${Object.values(latestGame.players).length}/${MAX_PLAYERS})...`
      );
    } else if (latestGame.phase === GamePhase.TRICK_SCORING) {
      setMessage('Trick complete! Scoring...');
      setTrickWinner(null);
    } else if (latestGame.phase === GamePhase.ROUND_END) {
      setMessage('Round complete! New round starting...');
    } else if (latestGame.phase === GamePhase.GAME_END) {
      setMessage('Game Over!');
    } else if (currentTurnPlayer?.isBot && (latestGame.phase === GamePhase.BETS || latestGame.phase === GamePhase.CARDS)) {
      setMessage(`It's ${currentTurnPlayer.name}'s (Bot) turn. Click 'Trigger Bot Action' to continue.`);
    }
  } else {
    setMessage('Failed to load game state.');
  }
  
  if (isInitialLoad) {
    setLoading(false);
  }
  setIsBotTurnPending(false);
}, [gameId, playerId]);

useEffect(() => {
  fetchAndUpdateGameState(true);

  const channel = supabase
    .channel(`game_room:${gameId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'game_rooms',
        filter: `id=eq.${gameId}`,
      },
      (payload) => {
        fetchAndUpdateGameState(false);
      }
    )
    .subscribe((status) => {
      setRealtimeStatus(status);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}, [gameId, fetchAndUpdateGameState]);

const handleStartGame = async () => {
  setMessage('Starting game...');
  const result = await startGame(gameId);
  if (result.success) {
    setMessage('Game started! Dealing cards...');
  } else {
    setMessage(`Failed to start game: ${result.message || 'Unknown error'}`);
  }
};

const handleCardPlay = async (cardId: string) => {
  if (!game || game.currentTurn !== playerId || game.phase !== GamePhase.CARDS) {
    setMessage("It's not your turn or not the card playing phase.");
    return;
  }

  setMessage('Playing card...');
  const result = await serverPlayCard(gameId, playerId, cardId);
  if (result.success) {
    setMessage('Card played!');
  } else {
    setMessage(`Failed to play card: ${result.message}`);
  }
};

const handleSelectTeam = async (team: Team) => {
  setMessage(`Selecting team ${team}...`);
  const result = await selectTeamAction(gameId, playerId, team);
  if (result.success) {
    setMessage(`Joined Team ${team}!`);
  } else {
    setMessage(`Failed to select team: ${result.message}`);
  }
};

const handleSelectSeat = async (seatPosition: number) => {
  setMessage(`Selecting seat ${seatPosition}...`);
  const result = await selectSeatAction(gameId, playerId, seatPosition);
  if (result.success) {
    setMessage(`Selected seat ${seatPosition}!`);
  } else {
    setMessage(`Failed to select seat: ${result.message}`);
  }
};

const handleSetReady = async (isReady: boolean) => {
  setMessage(isReady ? 'Setting ready...' : 'Unsetting ready...');
  const result = await setPlayerReadyAction(gameId, playerId, isReady);
  if (result.success) {
    setMessage(isReady ? 'You are ready!' : 'You are not ready.');
  } else {
    setMessage(`Failed to set ready status: ${result.message}`);
  }
};

const handlePlaceBet = async (betValue: Bets) => {
  if (!game || game.currentTurn !== playerId || game.phase !== GamePhase.BETS) {
    setMessage("It's not your turn or not the betting phase.");
    return;
  }
  setMessage(`Placing bet ${betValue} ${isTrumpBet ? 'with trump' : 'no trump'}...`);
  const result = await placeBetAction(gameId, playerId, betValue, isTrumpBet);
  if (result.success) {
    setMessage('Bet placed!');
    setIsTrumpBet(false);
  } else {
    setMessage(`Failed to place bet: ${result.message}`);
  }
};

const handleAddBot = async () => {
  setMessage('Adding bot...');
  const result = await addBotToGame(gameId);
  if (result.success) {
    setMessage('Bot added!');
  } else {
    setMessage(`Failed to add bot: ${result.message}`);
  }
};

const handleTriggerBotTurn = async () => {
  if (!game) return;
  setIsBotTurnPending(true);
  setMessage(`Triggering ${game.players[game.currentTurn]?.name}'s (Bot) turn...`);
  const result = await triggerBotTurn(gameId);
  if (result.success) {
    await fetchAndUpdateGameState(false);
  } else {
    setMessage(`Failed to trigger bot turn: ${result.message}`);
  }
  setIsBotTurnPending(false);
};

const handleManualRefresh = () => {
  fetchAndUpdateGameState(false);
};

const handleTrumpBetChange = (checked: boolean | 'indeterminate') => {
  setIsTrumpBet(checked === true);
};

const handleBotCardPlay = async (botId: string, cardId: string) => {
  if (!game || game.currentTurn !== botId || game.phase !== GamePhase.CARDS) {
    setMessage("It's not this bot's turn or not the card playing phase.");
    return;
  }

  setMessage(`Playing card for ${game.players[botId]?.name}...`);
  const result = await serverPlayCard(gameId, botId, cardId);
  if (result.success) {
    setMessage(`Card played for ${game.players[botId]?.name}!`);
  } else {
    setMessage(`Failed to play card for ${game.players[botId]?.name}: ${result.message}`);
  }
};

const handleBotPlaceBet = async (botId: string, betValue: Bets, trump: boolean = false) => {
  if (!game || game.currentTurn !== botId || game.phase !== GamePhase.BETS) {
    setMessage("It's not this bot's turn or not the betting phase.");
    return;
  }
  setMessage(`Placing bet for ${game.players[botId]?.name}: ${betValue} ${trump ? 'with trump' : 'no trump'}...`);
  const result = await placeBetAction(gameId, botId, betValue, trump);
  if (result.success) {
    setMessage(`Bet placed for ${game.players[botId]?.name}!`);
  } else {
    setMessage(`Failed to place bet for ${game.players[botId]?.name}: ${result.message}`);
  }
};

if (loading) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
      <p className="text-xl">Loading game...</p>
    </div>
  );
}

if (!game) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
      <p className="text-xl">Game not found or an error occurred.</p>
    </div>
  );
}

const yourPlayer = game.players[playerId];
const otherPlayers = Object.values(game.players).filter((p) => p.id !== playerId);

const sortedOtherPlayers = otherPlayers.sort(
  (a, b) => (a.seatPosition || 0) - (b.seatPosition || 0)
);

const opponent1 = sortedOtherPlayers[0];
const opponent2 = sortedOtherPlayers[1];
const opponent3 = sortedOtherPlayers[2];

const currentTrickCardsArray = Object.values(game.playedCards).sort(
  (a, b) => a.playOrder - b.playOrder
);

const isCurrentTurnBot = game.currentTurn && game.players[game.currentTurn]?.isBot;
const isBettingOrCardsPhase = game.phase === GamePhase.BETS || game.phase === GamePhase.CARDS;

return (
  <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
    <h1 className="text-4xl font-bold mb-6">Trick-Taking Game (ID: {gameId})</h1>

    <div className="mb-4 text-lg text-gray-300">{message}</div>
    <div className="mb-4 text-lg text-gray-300">Phase: {game.phase.replace(/_/g, ' ')}</div>
    {game.currentTurn && (
      <div className="mb-4 text-lg text-gray-300">
        Current Turn: {game.players[game.currentTurn]?.name || 'N/A'}
      </div>
    )}
    {game.trump && (
      <div className="mb-4 text-lg text-gray-300">
        Current Trump:{' '}
        <span
          className={`font-bold ${
            game.trump === CardColor.RED || game.trump === CardColor.BROWN
              ? 'text-red-400'
              : 'text-blue-400'
          }`}
        >
          {game.trump}
        </span>
      </div>
    )}

    <div className="mb-4 flex items-center gap-4 text-sm text-gray-400">
      <OnlineStatusIndicator />
      <span>Realtime: {realtimeStatus}</span>
      <span>Online Players: {totalOnline}</span>
      <Button
        onClick={handleManualRefresh}
        size="sm"
        variant="outline"
        className="text-xs"
      >
        Refresh
      </Button>
    </div>

    {/* Player List in Waiting Phase */}
    {game.phase === GamePhase.WAITING && (
      <div className="w-full max-w-md bg-gray-800 rounded-lg p-4 shadow-lg mb-8">
        <h2 className="text-xl font-semibold mb-4 text-center">Players in Lobby</h2>
        <ul className="space-y-2">
          {Object.values(game.players).map((player) => {
            const playerPresence = onlinePlayers[player.id];
            const isPlayerOnline = playerPresence?.isOnline || false;
            
            return (
              <li
                key={player.id}
                className="flex justify-between items-center bg-gray-700 p-3 rounded-md"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {player.name} {player.id === playerId && '(You)'} {player.isBot && '(Bot)'}
                  </span>
                  <PlayerPresenceIndicator
                    isOnline={isPlayerOnline}
                    lastSeen={playerPresence?.lastSeen}
                  />
                </div>
                <div className="text-sm text-gray-400">
                  {player.team && <span className="mr-2">Team: {player.team}</span>}
                  {player.seatPosition !== undefined && (
                    <span className="mr-2">Seat: {player.seatPosition + 1}</span>
                  )}
                  {player.isReady ? (
                    <span className="text-green-400">Ready</span>
                  ) : (
                    <span className="text-yellow-400">Not Ready</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {Object.values(game.players).length < MAX_PLAYERS && (
          <Button
            onClick={handleAddBot}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white mt-4"
          >
            Add Bot
          </Button>
        )}
      </div>
    )}

    {/* Opponent Hands and Play Area */}
    <div className="grid grid-cols-3 gap-4 w-full max-w-4xl mb-8">
      {/* Opponent 1 (top-left) */}
      {opponent1 && (
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-gray-300">{opponent1.name} {opponent1.isBot && '(Bot)'}</span>
            <PlayerPresenceIndicator
              isOnline={onlinePlayers[opponent1.id]?.isOnline || false}
              lastSeen={onlinePlayers[opponent1.id]?.lastSeen}
            />
          </div>
          <OpponentHand
            playerName={opponent1.name}
            cardCount={game.playerHands[opponent1.id]?.length || 0}
            isCurrentPlayer={game.currentTurn === opponent1.id}
          />
        </div>
      )}
      {!opponent1 && (
        <div className="flex flex-col items-center text-gray-600">Waiting for Player...</div>
      )}

      {/* Play Area */}
      <div className="flex flex-col items-center justify-center bg-gray-800 rounded-lg p-4 shadow-lg min-h-[150px]">
        <h2 className="text-xl font-semibold mb-2">Cards in Play</h2>
        <div className="flex gap-2">
          {currentTrickCardsArray.length === 0 ? (
            <p className="text-gray-500">No cards played yet.</p>
          ) : (
            currentTrickCardsArray.map((pc) => (
              <CardComponent key={pc.id} color={pc.color} value={pc.value} className="w-16 h-24" />
            ))
          )}
        </div>
        {trickWinner && (
          <p className="mt-2 text-green-400 font-semibold">
            Trick won by: {game.players[trickWinner]?.name}
          </p>
        )}
      </div>

      {/* Opponent 2 (top-right) */}
      {opponent2 && (
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-gray-300">{opponent2.name} {opponent2.isBot && '(Bot)'}</span>
            <PlayerPresenceIndicator
              isOnline={onlinePlayers[opponent2.id]?.isOnline || false}
              lastSeen={onlinePlayers[opponent2.id]?.lastSeen}
            />
          </div>
          <OpponentHand
            playerName={opponent2.name}
            cardCount={game.playerHands[opponent2.id]?.length || 0}
            isCurrentPlayer={game.currentTurn === opponent2.id}
          />
        </div>
      )}
      {!opponent2 && (
        <div className="flex flex-col items-center text-gray-600">Waiting for Player...</div>
      )}
    </div>

    {/* Opponent 3 (bottom-left, assuming 4 players total) */}
    <div className="flex flex-col items-center mb-8">
      {opponent3 && (
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-gray-300">{opponent3.name} {opponent3.isBot && '(Bot)'}</span>
            <PlayerPresenceIndicator
              isOnline={onlinePlayers[opponent3.id]?.isOnline || false}
              lastSeen={onlinePlayers[opponent3.id]?.lastSeen}
            />
          </div>
          <OpponentHand
            playerName={opponent3.name}
            cardCount={game.playerHands[opponent3.id]?.length || 0}
            isCurrentPlayer={game.currentTurn === opponent3.id}
          />
        </div>
      )}
      {!opponent3 && (
        <div className="flex flex-col items-center text-gray-600">Waiting for Player...</div>
      )}
    </div>

    {/* Your Hand */}
    <div className="w-full max-w-4xl bg-gray-800 rounded-lg p-4 shadow-lg">
      <h2 className="text-xl font-semibold mb-2 text-center">Your Hand ({playerName})</h2>
      {yourPlayer && (
        <PlayerHand
          cards={game.playerHands[playerId] || []}
          onCardPlay={handleCardPlay}
          canPlay={game.currentTurn === playerId && game.phase === GamePhase.CARDS}
        />
      )}
    </div>

    <div className="mt-8 flex gap-4">
      {game.phase === GamePhase.WAITING && (
        <>
          {/* Team Selection */}
          <div className="flex flex-col gap-2">
            <p className="text-gray-300">Select Team:</p>
            <Button
              onClick={() => handleSelectTeam(Team.A)}
              disabled={yourPlayer?.team === Team.A}
            >
              Team A
            </Button>
            <Button
              onClick={() => handleSelectTeam(Team.B)}
              disabled={yourPlayer?.team === Team.B}
            >
              Team B
            </Button>
          </div>

          {/* Seat Selection */}
          <div className="flex flex-col gap-2">
            <p className="text-gray-300">Select Seat:</p>
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3].map((seat) => (
                <Button
                  key={seat}
                  onClick={() => handleSelectSeat(seat)}
                  disabled={
                    yourPlayer?.seatPosition === seat ||
                    Object.values(game.players).some(
                      (p) => p.seatPosition === seat && p.id !== playerId
                    )
                  }
                >
                  Seat {seat + 1}
                </Button>
              ))}
            </div>
          </div>

          {/* Ready Button */}
          <Button
            onClick={() => handleSetReady(!yourPlayer?.isReady)}
            className={
              yourPlayer?.isReady
                ? 'bg-yellow-600 hover:bg-yellow-700'
                : 'bg-green-600 hover:bg-green-700'
            }
          >
            {yourPlayer?.isReady ? 'Unready' : 'Ready'}
          </Button>

          {/* Start Game Button */}
          {Object.values(game.players).length === MAX_PLAYERS &&
            Object.values(game.players).every(
              (p) => p.isReady && p.team && p.seatPosition !== undefined
            ) && (
              <Button
                onClick={handleStartGame}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                Start Game
              </Button>
            )}
        </>
      )}

      {game.phase === GamePhase.BETS && game.currentTurn === playerId && (
        <div className="flex flex-col gap-4 w-full max-w-md bg-gray-800 rounded-lg p-6 shadow-lg">
          <h3 className="text-2xl font-bold text-white text-center mb-4">Place Your Bet</h3>
          
          {/* Current Highest Bet Display */}
          {game.highestBet && game.highestBet.betValue !== Bets.SKIP && (
            <p className="text-lg text-gray-300 text-center mb-4">
              Current Highest: <span className="font-semibold text-yellow-300">{game.highestBet.betValue}</span> by{' '}
              <span className="font-semibold text-yellow-300">{game.players[game.highestBet.playerId]?.name}</span>{' '}
              {game.highestBet.trump ? '(Trump)' : '(No Trump)'}
            </p>
          )}
          {game.highestBet && game.highestBet.betValue === Bets.SKIP && (
            <p className="text-lg text-gray-300 text-center mb-4">
              Current Highest: <span className="font-semibold text-yellow-300">SKIP</span>
            </p>
          )}
          {!game.highestBet && (
            <p className="text-lg text-gray-300 text-center mb-4">No bets placed yet. Minimum bet is 7.</p>
          )}

          {/* Display all placed bets */}
          <div className="mb-4">
            <h4 className="text-md font-semibold text-gray-200 mb-2">All Placed Bets:</h4>
            <ul className="space-y-1 text-sm text-gray-400">
              {Object.values(game.bets)
                .sort((a, b) => {
                  const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                  const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                  return timeA - timeB;
                })
                .map((bet) => (
                  <li key={bet.playerId} className={bet.playerId === game.highestBet?.playerId ? "font-bold text-green-400" : ""}>
                    {game.players[bet.playerId]?.name}: {bet.betValue} {bet.trump ? '(Trump)' : '(No Trump)'}
                    {bet.playerId === game.highestBet?.playerId && " (Highest)"}
                  </li>
                ))}
            </ul>
          </div>

          {/* Bet Buttons */}
          <div className="grid grid-cols-3 gap-3">
            {Object.values(Bets).map((bet) => {
              if (bet === Bets.SKIP) return null; 
              return (
                <Button 
                  key={bet} 
                  onClick={() => handlePlaceBet(bet)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-lg py-3"
                >
                  {bet.toUpperCase()}
                </Button>
              );
            })}
          </div>

          {/* Trump Checkbox */}
          <div className="flex items-center justify-center space-x-2 mt-4">
            <Checkbox 
              id="trump-bet" 
              checked={isTrumpBet} 
              onCheckedChange={handleTrumpBetChange} 
              className="w-5 h-5 border-gray-400 data-[state=checked]:bg-blue-500 data-[state=checked]:text-white"
            />
            <Label htmlFor="trump-bet" className="text-gray-300 text-lg cursor-pointer">
              Bet with Trump
            </Label>
          </div>

          {/* Skip Bet Button */}
          <Button 
            onClick={() => handlePlaceBet(Bets.SKIP)}
            className="w-full bg-red-600 hover:bg-red-700 text-white text-lg py-3 mt-4"
          >
            SKIP BET
          </Button>
        </div>
      )}

      {/* NEW: Trigger Bot Action Button */}
      {isCurrentTurnBot && isBettingOrCardsPhase && (
        <Button
          onClick={handleTriggerBotTurn}
          disabled={isBotTurnPending}
          className="bg-yellow-600 hover:bg-yellow-700 text-white text-lg py-3 mt-4"
        >
          {isBotTurnPending ? 'Bot Thinking...' : `Trigger ${game.players[game.currentTurn]?.name}'s Action`}
        </Button>
      )}
    </div>
  </div>
);
}
