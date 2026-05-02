import React from 'react';
import { Alert, AlertContent, AlertDescription, AlertIcon, AlertTitle } from '@/components/ui/alert-1';
import { 
  Bell, 
  CircleCheck, 
  TriangleAlert, 
  Info, 
  Zap, 
  Package, 
  ThermometerSnowflake 
} from 'lucide-react';
import { motion } from 'framer-motion';

const MOCK_NOTIFICATIONS = [
  {
    id: 1,
    variant: 'destructive',
    appearance: 'solid',
    icon: <ThermometerSnowflake />,
    title: 'Temperature Anomaly',
    description: 'Unit 1 temperature rose above 5°C. Immediate check recommended.',
    time: '2 mins ago'
  },
  {
    id: 2,
    variant: 'success',
    appearance: 'light',
    icon: <Zap />,
    title: 'Sanitization Complete',
    description: 'Locker Unit 4 successfully completed UV-C sanitization cycle.',
    time: '15 mins ago'
  },
  {
    id: 3,
    variant: 'warning',
    appearance: 'light',
    icon: <TriangleAlert />,
    title: 'Expiration Warning',
    description: 'Donation in Unit 2 is near its expiration limit (2 hours left).',
    time: '45 mins ago'
  },
  {
    id: 4,
    variant: 'primary',
    appearance: 'solid',
    icon: <Package />,
    title: 'New Donation',
    description: 'A new donation of fresh produce is available for pickup in Unit 7.',
    time: '1 hour ago'
  },
  {
    id: 5,
    variant: 'info',
    appearance: 'outline',
    icon: <Info />,
    title: 'System Maintenance',
    description: 'Scheduled maintenance tonight at 2:00 AM. System will be offline for 30 mins.',
    time: '3 hours ago'
  }
];

export { MOCK_NOTIFICATIONS };

interface NotificationPanelProps {
  notifications: typeof MOCK_NOTIFICATIONS;
  onClearAll: () => void;
  onCloseNotif: (id: number) => void;
  onClose: () => void;
}

export function NotificationPanel({ notifications, onClearAll, onCloseNotif, onClose }: NotificationPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10, filter: 'blur(10px)' }}
      animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 0.95, y: 10, filter: 'blur(10px)' }}
      className="fixed top-20 right-6 z-[1002] w-[400px] max-h-[600px] overflow-hidden flex flex-col rounded-3xl border border-line bg-panel/95 dark:bg-panel/80 backdrop-blur-2xl shadow-2xl"
    >
      <div className="p-4 border-b border-line flex justify-between items-center bg-panel-elevated/50 dark:bg-panel/50">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-accent/10 text-accent">
            <Bell className="size-4" />
          </div>
          <h3 className="font-bold text-lg">System Alerts</h3>
        </div>
        <button 
          onClick={onClearAll}
          className="text-xs font-semibold px-3 py-1.5 rounded-full bg-muted/20 hover:bg-muted/40 transition-colors"
        >
          Clear All
        </button>
      </div>

      <div className="overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {notifications.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center gap-3 opacity-40">
            <Bell className="size-10" />
            <p className="text-sm font-medium">No new notifications</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <Alert 
              key={notif.id} 
              variant={notif.variant as any} 
              appearance="light" 
              close={true}
              onClose={() => onCloseNotif(notif.id)}
              className="shadow-sm border-line/40 dark:border-line/10 bg-white/80 dark:bg-white/5 hover:bg-white/90 dark:hover:bg-white/10 transition-all duration-300"
            >
              <AlertIcon>
                {notif.icon}
              </AlertIcon>
              <AlertContent>
                <div className="flex justify-between items-start gap-2">
                  <AlertTitle className="font-bold text-[15px] leading-tight">{notif.title}</AlertTitle>
                  <span className="text-[10px] font-medium opacity-50 whitespace-nowrap mt-0.5">{notif.time}</span>
                </div>
                <AlertDescription className="text-sm opacity-90 leading-snug">
                  {notif.description}
                </AlertDescription>
              </AlertContent>
            </Alert>
          ))
        )}
      </div>
    </motion.div>
  );
}
