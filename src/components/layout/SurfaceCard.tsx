import { type PropsWithChildren } from "react";

export function SurfaceCard({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return (
    <section 
      className={`glass-panel surface-card is-revealed ${className}`.trim()}
    >
      {children}
    </section>
  );
}
