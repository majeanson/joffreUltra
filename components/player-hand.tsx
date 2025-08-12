"use client";

import { CardComponent } from "./card-component";
import { Card } from "@/game-types"; // Import the new Card interface

interface PlayerHandProps {
  cards: Card[];
  onCardPlay: (cardId: string) => void;
  canPlay: boolean;
}

export function PlayerHand({ cards, onCardPlay, canPlay }: PlayerHandProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2 p-4 bg-gray-700 rounded-lg shadow-inner">
      {cards.length === 0 ? (
        <p className="text-gray-400">Your hand is empty.</p>
      ) : (
        cards.map((card) => (
          <CardComponent
            key={card.id}
            color={card.color} // Use new color prop
            value={card.value} // Use new value prop
            onClick={() => canPlay && onCardPlay(card.id)}
            className={canPlay ? "cursor-pointer" : "cursor-not-allowed opacity-50"}
          />
        ))
      )}
    </div>
  );
}
