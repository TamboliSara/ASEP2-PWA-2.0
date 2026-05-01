import { SlideConfirm } from "./SlideConfirm";

export function SlideToRetrieve({ disabled, onConfirm }: { disabled?: boolean; onConfirm: () => void }) {
  return <SlideConfirm disabled={disabled} label="Slide to retrieve" completedLabel="Receiver acknowledged" onConfirm={onConfirm} />;
}
