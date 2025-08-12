-- This script will drop the existing game_rooms table if it exists
-- and then recreate it with the new 'state' JSONB column.
-- WARNING: This will delete all existing game data!

DROP TABLE IF EXISTS game_rooms;

CREATE TABLE IF NOT EXISTS game_rooms (
    id VARCHAR(6) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    -- The 'state' column will store the entire game state as a JSONB object
    state JSONB NOT NULL DEFAULT '{ "phase": "waiting", "round": 1, "currentTurn": "", "dealer": "", "starter": "", "players": {}, "bets": {}, "playedCards": {}, "playerHands": {}, "wonTricks": {}, "scores": {}, "turnOrder": [] }'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
