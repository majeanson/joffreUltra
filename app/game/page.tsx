import { GameTable } from "@/components/game-table";

export const dynamic = 'force-dynamic';

interface GameSearchParams {
  id?: string;
  playerId?: string;
  playerName?: string;
}

interface GamePageProps {
  searchParams: Promise<GameSearchParams>;
}

export default async function GamePage({ searchParams }: GamePageProps) {
  const { id: gameId, playerId, playerName } = await searchParams; 

  const playerNameToUse = playerName ? decodeURIComponent(playerName) : "";

  if (!gameId || !playerId || !playerName) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        <p className="text-xl">Missing game or player information. Please join or create a game from the lobby.</p>
      </div>
    );
  }

  return <GameTable gameId={gameId} playerId={playerId} playerName={playerNameToUse} />;
}
