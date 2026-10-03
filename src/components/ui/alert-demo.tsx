/**
 * @debug
 * PRESERVED FOR UI COMPONENT SHOWCASE
 * Visual testing playground for alert-1 components.
 * DO NOT DELETE — Zero deletion policy.
 */
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert-1';
import { Bell, CircleAlert, CircleCheck, MessageSquareWarning, ShieldAlert, TriangleAlert } from 'lucide-react';

export default function AlertDemo() {
  return (
     <div className="flex flex-col gap-5 p-10 w-full mx-auto max-w-[600px] min-h-screen justify-center items-center">
      <Alert appearance="light" close={true}>
        <AlertIcon>
          <CircleAlert />
        </AlertIcon>
        <AlertTitle>This is a default alert</AlertTitle>
      </Alert>

      <Alert variant="primary" appearance="light" close={true}>
        <AlertIcon>
          <MessageSquareWarning />
        </AlertIcon>
        <AlertTitle>This is a primary alert</AlertTitle>
      </Alert>

      <Alert variant="success" appearance="light" close={true}>
        <AlertIcon>
          <CircleCheck />
        </AlertIcon>
        <AlertTitle>This is a success alert</AlertTitle>
      </Alert>

      <Alert variant="destructive" appearance="light" close={true}>
        <AlertIcon>
          <TriangleAlert />
        </AlertIcon>
        <AlertTitle>This is a destructive alert</AlertTitle>
      </Alert>

      <Alert variant="info" appearance="light" close={true}>
        <AlertIcon>
          <Bell />
        </AlertIcon>
        <AlertTitle>This is an info alert</AlertTitle>
      </Alert>

      <Alert variant="warning" appearance="light" close={true}>
        <AlertIcon>
          <ShieldAlert />
        </AlertIcon>
        <AlertTitle>This is a warning alert</AlertTitle>
      </Alert>
    </div>
  );
}
