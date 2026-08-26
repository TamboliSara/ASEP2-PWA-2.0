import { type PropsWithChildren, type CSSProperties } from "react";

export function SurfaceCard({ children, className = "", style }: PropsWithChildren<{ className?: string; style?: CSSProperties }>) {
  return (
    <section 
      className={`glass-panel surface-card is-revealed ${className}`.trim()}
      style={style}
    >
      {children}
    </section>
  );
}
