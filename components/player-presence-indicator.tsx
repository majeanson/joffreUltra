interface PlayerPresenceIndicatorProps {
  isOnline: boolean;
  lastSeen?: string;
  className?: string;
}

export function PlayerPresenceIndicator({ 
  isOnline, 
  lastSeen, 
  className = '' 
}: PlayerPresenceIndicatorProps) {
  const getLastSeenText = () => {
    if (isOnline) return 'Online';
    if (!lastSeen) return 'Offline';
    
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - lastSeenDate.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div
        className={`w-2 h-2 rounded-full ${
          isOnline ? 'bg-green-500' : 'bg-gray-500'
        }`}
      />
      <span className={`text-xs ${isOnline ? 'text-green-400' : 'text-gray-400'}`}>
        {getLastSeenText()}
      </span>
    </div>
  );
}
