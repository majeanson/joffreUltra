import { CardComponent } from "./card-component";
import { CardColor } from "@/game-types"; // Import CardColor for dummy card

interface OpponentHandProps {
  cardCount: number;
  playerName: string;
  isCurrentPlayer: boolean;
}

export function OpponentHand({ cardCount, playerName, isCurrentPlayer }: OpponentHandProps) {
  const maxDisplayCards = 13; // Max cards in a standard hand
  const displayCount = Math.min(cardCount, maxDisplayCards);

  return (
    <div className="flex flex-col items-center">
      <p className={`text-gray-400 mb-1 ${isCurrentPlayer ? 'font-bold text-yellow-300' : ''}`}>
        {playerName} ({cardCount} cards)
      </p>
      <div className="relative w-40 h-28"> {/* Container for fanned cards */}
        {Array.from({ length: displayCount }).map((_, index) => (
          <CardComponent
            key={index}
            color={CardColor.BLUE} // Dummy color, as it's face down
            value={0} // Dummy value
            isFaceUp={false}
            className="absolute w-16 h-24 sm:w-16 sm:h-24"
            style={{
              left: `${index * (100 / (displayCount > 1 ? displayCount - 1 : 1))}%`, // Distribute horizontally
              transform: `translateX(-${index * 50}%) rotate(${index * 2 - (displayCount - 1) * 1}deg)`, // Fan out
              transformOrigin: 'bottom center',
              zIndex: index,
            }}
          />
        ))}
      </div>
    </div>
  );
}
