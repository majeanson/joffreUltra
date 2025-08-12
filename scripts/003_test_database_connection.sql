-- Test script to verify database connection and table structure
SELECT 'Database connection successful' as status;

-- Check if game_rooms table exists and show its structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'game_rooms'
ORDER BY ordinal_position;

-- Show any existing rows in game_rooms table
SELECT id, name, created_at, 
       jsonb_pretty(state) as formatted_state
FROM game_rooms
ORDER BY created_at DESC
LIMIT 5;

-- Test inserting a sample row
INSERT INTO game_rooms (id, name, state)
VALUES (
  'TEST01',
  'Test Game',
  '{"phase": "waiting", "round": 1, "currentTurn": "", "dealer": "", "starter": "", "players": {"test-player-1": {"id": "test-player-1", "name": "Test Player", "isReady": false}}, "bets": {}, "playedCards": {}, "playerHands": {}, "wonTricks": {}, "scores": {"test-player-1": 0}, "turnOrder": []}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  state = EXCLUDED.state;

-- Verify the test row was inserted
SELECT id, name, jsonb_pretty(state) as formatted_state
FROM game_rooms
WHERE id = 'TEST01';

-- Clean up test data
DELETE FROM game_rooms WHERE id = 'TEST01';

SELECT 'Test completed successfully' as final_status;
