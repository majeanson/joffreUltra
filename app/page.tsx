'use client'

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState, useCallback } from "react"; // ADDED useCallback
import { createGame, joinGame, getAvailableGames, rejoinGame } from "@/actions/game";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase"; // IMPORTED supabase

// Define the GameRoom interface to match the server action's return type
interface GameRoom {
id: string;
name: string;
players: { id: string; name: string }[];
status: 'waiting' | 'in-progress' | 'finished';
createdAt: Date;
}

// Helper to store player/game info in local storage
const storePlayerInfo = (gameId: string, playerId: string, playerName: string) => {
localStorage.setItem('lastGameId', gameId);
localStorage.setItem('lastPlayerId', playerId);
localStorage.setItem('lastPlayerName', playerName);
};

// Helper to retrieve player/game info from local storage
const getPlayerInfo = () => {
if (typeof window === 'undefined') return null; // Ensure running in browser
const gameId = localStorage.getItem('lastGameId');
const playerId = localStorage.getItem('lastPlayerId');
const playerName = localStorage.getItem('lastPlayerName');
return gameId && playerId && playerName ? { gameId, playerId, playerName } : null;
};

function CreateGameForm() {
const router = useRouter();
const [state, setState] = useState<{ success: boolean; message?: string; gameId?: string; playerId?: string; playerName?: string } | null>(null);
const [pending, setPending] = useState(false);

const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
event.preventDefault(); // Prevent default form submission
setPending(true);
const formData = new FormData(event.currentTarget); // Manually create FormData
const result = await createGame(formData); // Call the server action directly
setState(result);
setPending(false);
};

useEffect(() => {
if (state?.success && state.gameId && state.playerId && state.playerName) {
  storePlayerInfo(state.gameId, state.playerId, state.playerName);
  router.push(`/game?id=${state.gameId}&playerId=${state.playerId}&playerName=${encodeURIComponent(state.playerName)}`);
}
}, [state, router]);

return (
<form onSubmit={handleSubmit} className="space-y-4">
  <h2 className="text-xl font-semibold text-white">Create New Game</h2>
  <div>
    <Label htmlFor="create-game-name" className="text-gray-300">Game Name</Label>
    <Input
      id="create-game-name"
      name="gameName"
      placeholder="My Awesome Game"
      required
      className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
    />
  </div>
  <div>
    <Label htmlFor="create-player-name" className="text-gray-300">Your Name</Label>
    <Input
      id="create-player-name"
      name="playerName"
      placeholder="Player One"
      required
      className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
    />
  </div>
  <Button
    type="submit"
    className="w-full bg-green-600 hover:bg-green-700 text-white"
    disabled={pending}
  >
    {pending ? 'Creating...' : 'Create Game'}
  </Button>
  {state?.message && <p className="text-red-400 text-sm">{state.message}</p>}
</form>
);
}

function JoinGameForm() {
const router = useRouter();
const [state, setState] = useState<{ success: boolean; message?: string; gameId?: string; playerId?: string; playerName?: string } | null>(null);
const [pending, setPending] = useState(false);

const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
event.preventDefault();
setPending(true);
const formData = new FormData(event.currentTarget);
const result = await joinGame(formData);
setState(result);
setPending(false);
};

useEffect(() => {
if (state?.success && state.gameId && state.playerId && state.playerName) {
  storePlayerInfo(state.gameId, state.playerId, state.playerName);
  router.push(`/game?id=${state.gameId}&playerId=${state.playerId}&playerName=${encodeURIComponent(state.playerName)}`);
}
}, [state, router]);

return (
<form onSubmit={handleSubmit} className="space-y-4">
  <h2 className="text-xl font-semibold text-white">Join Existing Game</h2>
  <div>
    <Label htmlFor="join-game-id" className="text-gray-300">Game ID</Label>
    <Input
      id="join-game-id"
      name="gameId"
      placeholder="ABCDEF"
      required
      className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
    />
  </div>
  <div>
    <Label htmlFor="join-player-name" className="text-gray-300">Your Name</Label>
    <Input
      id="join-player-name"
      name="playerName"
      placeholder="Player Two"
      required
      className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
    />
  </div>
  <Button
    type="submit"
    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
    disabled={pending}
  >
    {pending ? 'Joining...' : 'Join Game'}
  </Button>
  {state?.message && <p className="text-red-400 text-sm">{state.message}</p>}
</form>
);
}

function RejoinGameSection() {
const router = useRouter();
const [lastGameInfo, setLastGameInfo] = useState<{ gameId: string; playerId: string; playerName: string } | null>(null);
const [rejoinState, setRejoinState] = useState<{ success: boolean; message?: string; gameId?: string; playerId?: string; playerName?: string } | null>(null);
const [pending, setPending] = useState(false);

useEffect(() => {
setLastGameInfo(getPlayerInfo());
}, []);

useEffect(() => {
if (rejoinState?.success && rejoinState.gameId && rejoinState.playerId && rejoinState.playerName) {
  storePlayerInfo(rejoinState.gameId, rejoinState.playerId, rejoinState.playerName);
  router.push(`/game?id=${rejoinState.gameId}&playerId=${rejoinState.playerId}&playerName=${encodeURIComponent(rejoinState.playerName)}`);
}
}, [rejoinState, router]);

if (!lastGameInfo) {
return null;
}

const handleRejoin = async () => {
if (lastGameInfo) {
  setPending(true);
  const result = await rejoinGame(lastGameInfo.gameId, lastGameInfo.playerId, lastGameInfo.playerName);
  setRejoinState(result);
  setPending(false);
}
};

return (
<div className="border-t border-gray-700 pt-8 space-y-4">
  <h2 className="text-xl font-semibold text-white">Continue Last Game</h2>
  <p className="text-gray-400 text-sm">
    You were last in game <span className="font-medium">{lastGameInfo.gameId}</span> as <span className="font-medium">{lastGameInfo.playerName}</span>.
  </p>
  <Button
    onClick={handleRejoin}
    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
    disabled={pending}
  >
    {pending ? 'Rejoining...' : 'Rejoin Game'}
  </Button>
  {rejoinState?.message && <p className="text-red-400 text-sm">{rejoinState.message}</p>}
</div>
);
}


export default function HomePage() {
const router = useRouter();
const [availableGames, setAvailableGames] = useState<GameRoom[]>([]);
const [loadingGames, setLoadingGames] = useState(true);

// Use useCallback to memoize the fetch function
const fetchGames = useCallback(async () => {
setLoadingGames(true);
try {
  const games = await getAvailableGames();
  setAvailableGames(games);
} catch (error) {
  console.error('Error fetching available games:', error);
  setAvailableGames([]);
} finally {
  setLoadingGames(false);
}
}, []); // Empty dependency array means this function is created once

useEffect(() => {
fetchGames(); // Initial fetch

// Add a global Realtime listener to detect any database changes
// Place this inside the `useEffect` hook, before the `channel` variable is defined.

// Set up a global Supabase Realtime subscription for ALL public schema changes
const globalChannel = supabase
  .channel('public:all_changes_monitor') // A unique channel name
  .on(
    'postgres_changes',
    {
      event: '*', // Listen for all events
      schema: 'public', // Listen across the entire public schema
    },
    () => {
    }
  )
  .subscribe(() => {
  });

// Set up Supabase Realtime subscription for game_rooms table
const channel = supabase
  .channel('public:game_rooms') // Subscribe to all changes in public.game_roomss
  .on(
    'postgres_changes',
    {
      event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
      schema: 'public',
      table: 'game_rooms',
    },
    () => {
      // Re-fetch games whenever there's a change in the game_rooms table
      fetchGames();
    }
  )
  .subscribe(() => {
  });

// Cleanup function to unsubscribe when the component unmounts
return () => {
  supabase.removeChannel(channel);
  supabase.removeChannel(globalChannel); // NEW: Cleanup for global monitor
};
}, [fetchGames]); // Depend on fetchGames to ensure it's always the latest version

// New function to handle joining an available game
const handleJoinAvailableGame = async (e: React.FormEvent<HTMLFormElement>) => {
e.preventDefault();
const formData = new FormData(e.currentTarget);
const playerName = getPlayerInfo()?.playerName || "Guest";
formData.set('playerName', playerName); // Ensure playerName is set
const result = await joinGame(formData);
if (result.success && result.gameId && result.playerId && result.playerName) {
  storePlayerInfo(result.gameId, result.playerId, result.playerName);
  router.push(`/game?id=${result.gameId}&playerId=${result.playerId}&playerName=${encodeURIComponent(result.playerName)}`);
} else if (result.message) {
  alert(result.message); // Simple alert for join errors
}
};

return (
<div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-4 text-white">
  <Card className="w-full max-w-md bg-gray-800 text-white shadow-lg">
    <CardHeader className="text-center">
      <CardTitle className="text-3xl font-bold">Trick-Taking Game</CardTitle>
      <CardDescription className="text-gray-400">
        Join a game or create a new one.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-8">
      <CreateGameForm />

      <div className="border-t border-gray-700 pt-8">
        <JoinGameForm />
      </div>

      <RejoinGameSection />

      <div className="border-t border-gray-700 pt-8">
        <h2 className="text-xl font-semibold text-white mb-4">Available Games</h2>
        {loadingGames ? (
          <p className="text-gray-400">Loading games...</p>
        ) : availableGames.length === 0 ? (
          <p className="text-gray-400">No active games available. Create one!</p>
        ) : (
          <ul className="space-y-2">
            {availableGames.map((game) => (
              <li key={game.id} className="bg-gray-700 p-3 rounded-md flex justify-between items-center">
                <div>
                  <p className="font-medium">{game.name} <span className="text-gray-400 text-sm">({game.id})</span></p>
                  <p className="text-gray-400 text-sm">{game.players.length}/4 players</p>
                </div>
                <form onSubmit={handleJoinAvailableGame}>
                  <input type="hidden" name="gameId" value={game.id} />
                  <Button type="submit" size="sm" className="bg-purple-600 hover:bg-purple-700 text-white">
                    Join
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-gray-700 pt-8">
        <h2 className="text-xl font-semibold mb-2 text-white">How to Play</h2>
        <p className="text-gray-400 text-sm">
          This is a trick-taking card game. Players play cards in turns, and the highest card of the leading suit (or a trump card) wins the trick. The goal is to win a certain number of tricks or points.
        </p>
      </div>
    </CardContent>
  </Card>
</div>
);
}
