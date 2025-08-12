import { cn } from "@/lib/utils";
import { CardColor } from "@/game-types"; // Import CardColor

interface CardProps {
  color: CardColor; // Changed from suit
  value: number; // Changed from rank
  isFaceUp?: boolean;
  onClick?: () => void;
  className?: string;
}

export function CardComponent({ color, value, isFaceUp = true, onClick, className }: CardProps) {
  const colorClass = {
    [CardColor.RED]: "border-red-500 text-red-600",
    [CardColor.BLUE]: "border-blue-500 text-blue-600",
    [CardColor.GREEN]: "border-green-500 text-green-600",
    [CardColor.BROWN]: "border-amber-800 text-amber-900", // Using amber for brown
  }[color];

  const valueDisplay = value.toString(); // Display value as string

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-16 h-24 sm:w-20 sm:h-28 md:w-24 md:h-32 rounded-md shadow-md flex flex-col justify-between p-2 border-2",
        colorClass,
        "bg-white transition-transform duration-100 hover:scale-105 active:scale-95",
        !isFaceUp && "bg-gray-700 border-gray-900",
        className
      )}
      disabled={!onClick}
    >
      {isFaceUp ? (
        <>
          <div className={cn("font-bold text-lg", colorClass)}>
            {valueDisplay}
          </div>
          <div className={cn("absolute inset-0 flex items-center justify-center text-5xl", colorClass)}>
            {valueDisplay}
          </div>
          <div className={cn("self-end font-bold text-lg transform rotate-180", colorClass)}>
            {valueDisplay}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-full text-gray-500 text-2xl">
          ?
        </div>
      )}
    </button>
  );
}
