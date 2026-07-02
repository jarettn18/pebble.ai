/** Viewport width (px) at or above which the demo simulator frame is shown. */
export const FRAME_BREAKPOINT = 600;

/** Width (px) of the simulator phone card. Shared so overlays can match it. */
export const FRAME_WIDTH = 390;

/**
 * Pure decision: should the demo simulator frame wrap the app?
 * Only when demo mode is active and the viewport is wide enough to have room
 * around a phone-width card. Narrow viewports (real phones) render full-bleed.
 */
export function shouldShowFrame(
  isDemo: boolean,
  width: number,
  breakpoint: number = FRAME_BREAKPOINT
): boolean {
  return isDemo && width >= breakpoint;
}
