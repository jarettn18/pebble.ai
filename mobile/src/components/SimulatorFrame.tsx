import { ReactNode } from "react";

/**
 * Native (and default) implementation: pass-through. The demo simulator frame
 * only exists on web — see SimulatorFrame.web.tsx.
 */
export default function SimulatorFrame({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
