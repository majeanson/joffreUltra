import { useOnlineStatus } from '@/hooks/use-online-status';

interface OnlineStatusIndicatorProps {
  className?: string;
}

export function OnlineStatusIndicator({ className = '' }: OnlineStatusIndicatorProps) {
  const isOnline = useOnlineStatus();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className={`w-3 h-3 rounded-full ${
          isOnline ? 'bg-green-500' : 'bg-red-500'
        }`}
      />
      <span className={`text-sm ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
        {isOnline ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}
