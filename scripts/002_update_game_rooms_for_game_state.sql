ALTER TABLE game_rooms
ADD COLUMN current_trick_cards JSONB DEFAULT '[]'::jsonb,
ADD COLUMN current_turn_player_id VARCHAR(255),
ADD COLUMN deck JSONB DEFAULT '[]'::jsonb;

-- Note: If you have existing data in the 'players' column that doesn't include the 'hand' array,
-- you might need a separate migration to update that data.
-- For new projects, the 'players' JSONB structure will now implicitly include 'hand: []'
-- when new players are added or games are created.
