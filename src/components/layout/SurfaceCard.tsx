import { type PropsWithChildren, type CSSProperties } from "react";

export function SurfaceCard({ children, className = "", style, id }: PropsWithChildren<{ className?: string; style?: CSSProperties; id?: string }>) {
  return (
    <section 
      id={id}
      className={`glass-panel surface-card is-revealed ${className}`.trim()}
      style={style}
    >
      {children}
    </section>
  );
}
