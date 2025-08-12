'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOnlineStatus } from './use-online-status';

interface PlayerPresence {
playerId: string;
playerName: string;
gameId: string;
lastSeen: string;
isOnline: boolean;
}

export function usePlayerPresence(gameId: string, playerId: string, playerName: string) {
const [onlinePlayers, setOnlinePlayers] = useState<Record<string, PlayerPresence>>({});
const [presenceChannel, setPresenceChannel] = useState<any>(null);
const isOnline = useOnlineStatus();

const updatePresence = useCallback(async () => {
  if (!presenceChannel || !isOnline) return;

  const presenceData = {
    playerId,
    playerName,
    gameId,
    lastSeen: new Date().toISOString(),
    isOnline: true,
  };

  await presenceChannel.track(presenceData);
}, [presenceChannel, playerId, playerName, gameId, isOnline]);

useEffect(() => {
  if (!gameId || !playerId || !playerName) return;

  // Create presence channel
  const channel = supabase.channel(`presence:${gameId}`, {
    config: {
      presence: {
        key: playerId, // Use playerId as the unique key
      },
    },
  });

  // Handle presence sync (when someone joins/leaves)
  channel.on('presence', { event: 'sync' }, () => {
    const presenceState = channel.presenceState();
    
    const players: Record<string, PlayerPresence> = {};
    
    Object.entries(presenceState).forEach(([key, presences]) => {
      if (presences && presences.length > 0) {
        const presence = presences[0] as PlayerPresence;
        players[key] = {
          ...presence,
          isOnline: true,
        };
      }
    });
    
    setOnlinePlayers(players);
  });

  // Handle when someone joins
  channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
  });

  // Handle when someone leaves
  channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
  });

  // Subscribe to the channel
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      setPresenceChannel(channel);
      // Track our presence once subscribed
      await channel.track({
        playerId,
        playerName,
        gameId,
        lastSeen: new Date().toISOString(),
        isOnline: true,
      });
    }
  });

  // Cleanup function
  return () => {
    if (channel) {
      channel.untrack();
      supabase.removeChannel(channel);
    }
    setPresenceChannel(null);
    setOnlinePlayers({});
  };
}, [gameId, playerId, playerName]);

// Update presence when online status changes
useEffect(() => {
  if (isOnline) {
    updatePresence();
  } else if (presenceChannel) {
    // When going offline, untrack presence
    presenceChannel.untrack();
  }
}, [isOnline, updatePresence, presenceChannel]);

// Periodic presence update (heartbeat)
useEffect(() => {
  if (!isOnline || !presenceChannel) return;

  const interval = setInterval(() => {
    updatePresence();
  }, 30000); // Update every 30 seconds

  return () => clearInterval(interval);
}, [isOnline, updatePresence, presenceChannel]);

return {
  onlinePlayers,
  isOnline,
  totalOnline: Object.keys(onlinePlayers).length,
};
}
