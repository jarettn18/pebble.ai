# Demo Simulator Frame — Design

## Problem

The Pebble web build reuses the React Native mobile components. On a desktop-width
browser these components stretch to full width and look wrong. The public demo
(`?demo=1`) is served on the web, so demo viewers see this stretched layout.

## Goal

When demo mode is active on a wide web viewport, render the app inside a centered,
phone-width card ("simulator frame") so the mobile components render at their
intended width. Native builds and normal (non-demo) web usage are unaffected.

## Scope

- **Demo mode only.** The frame appears only when `isDemoMode()` is true. Normal
  web usage is unchanged.
- **Responsive.** On a genuinely narrow viewport (a real phone opening the demo
  link) the app renders full-bleed as today. The frame only applies when the
  viewport is wide enough to have room around it.
- **Style: simple card.** Centered phone-width column with rounded corners and a
  soft shadow on a neutral background. No device bezel / notch.

## Approach

A web-only wrapper component with platform splitting, following the existing
`.web` convention in the repo (e.g. `mobile/src/hooks/usePlaidLink.web.ts`).

### Files

- `mobile/src/components/SimulatorFrame.tsx` (native + default): pass-through.
  Renders `children` directly. Zero effect on iOS/Android.
- `mobile/src/components/SimulatorFrame.web.tsx`: the real logic.
- `mobile/src/components/simulatorFrame.ts` (or inline pure helper): a pure
  `shouldShowFrame(isDemo: boolean, width: number): boolean` decision, unit-tested.

### Web logic

- If `isDemoMode()` is false → pass-through, no frame.
- If in demo mode, read viewport width via `useWindowDimensions()`:
  - **Wide** (`width >= 600`): render an outer full-viewport `View`
    (neutral background `#e5e7eb`, centered horizontally and vertically)
    containing an inner phone-shaped `View`:
    - width: `390`
    - height: `min(844, viewport height)`
    - border radius: `40`
    - soft shadow
    - `overflow: "hidden"`

    Children render inside the inner view.
  - **Narrow** (`width < 600`): pass-through / full-bleed, as today.

### Wiring

In `mobile/app/_layout.tsx`, wrap the `<AuthGate />` content with
`<SimulatorFrame>`. Single insertion point.

## Known caveat

`@gorhom/bottom-sheet` (`ChatSheet`) and `GlobalChatFAB` may portal or position
relative to the true viewport rather than the frame on web, so the chat sheet
could render outside the card. Verify when running the demo; if it escapes,
constrain it. The chat input is already disabled in demo mode, so the sheet is
read-only.

## Testing

- Extract the "should show frame" decision into a pure helper
  (`shouldShowFrame`) and cover it with vitest (demo on/off × wide/narrow),
  matching the existing `mobile/src/api/demo/*.test.ts` pattern.
- The view rendering is presentational and verified manually in the browser.

## Constants (adjustable)

| Value            | Default   |
|------------------|-----------|
| Width breakpoint | `600px`   |
| Frame width      | `390px`   |
| Frame max height | `844px`   |
| Corner radius    | `40px`    |
| Backdrop color   | `#e5e7eb` |
