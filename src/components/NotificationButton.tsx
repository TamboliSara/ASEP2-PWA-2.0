import React from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button-1';
import { cn } from '@/lib/utils';

interface NotificationButtonProps {
  className?: string;
  count?: number;
  onClick?: () => void;
}

export function NotificationButton({ className, count = 0, onClick }: NotificationButtonProps) {
  return (
    <div className={cn("fixed top-6 right-6 z-[1001]", className)}>
      <Button
        variant="primary"
        size="icon"
        shape="circle"
        className="relative shadow-2xl hover:scale-110 transition-transform active:scale-95 bg-accent text-white border-none"
        onClick={onClick}
      >
        <Bell className="size-5" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground ring-2 ring-background rotate-0 transform-none">
            {count}
          </span>
        )}
      </Button>
    </div>
  );
}
