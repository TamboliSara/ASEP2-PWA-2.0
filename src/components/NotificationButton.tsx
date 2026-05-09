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
    <div className={cn("fixed top-8 right-8 z-[1001]", className)}>
      <Button
        variant="primary"
        size="icon"
        shape="circle"
        className="relative shadow-2xl hover:scale-110 transition-transform active:scale-95 bg-accent text-white border-none h-14 w-14"
        onClick={onClick}
      >
        <Bell className="size-6" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-[11px] font-black text-white ring-4 ring-white shadow-lg animate-in zoom-in-50 duration-300">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </Button>
    </div>
  );
}
