# Side Panel Voice-to-Voice — Design

**Date:** 2026-06-04
**Status:** Approved

## Problem

The main chat (`ChatInterface.tsx`) has a realtime voice-to-voice button (the
`RealtimeVoice` component — OpenAI Realtime API). The side panel chat
(`ChatPanel.tsx`) does not. Goal: add voice-to-voice to the side panel, styled
to match its more compact toolbar.

## Constraints

- The side panel toolbar uses compact buttons (`p-1.5`, icon `w-4 h-4`, no
  border). The main chat uses larger bordered buttons (`p-2.5`, icon
  `w-5 h-5`). `RealtimeVoice` currently hardcodes the main-chat sizing.
- The main chat's appearance must stay unchanged.

## Design

### 1. Add a `compact` size variant to `RealtimeVoice`

`components/chat/RealtimeVoice.tsx`

- Add optional prop `compact?: boolean` (default `false` → main chat unchanged).
- When `compact`, the phone button uses side-panel sizing: `p-1.5`, icon
  `w-4 h-4`, no border. When not compact, it keeps the current `p-2.5`,
  `w-5 h-5`, bordered styling.
- Status colors (idle / connecting / listening / speaking) are identical in
  both variants — only padding, icon size, and the border differ.
- The voice-picker dropdown and chevron logic are unchanged; they already work
  at either size.

### 2. Wire it into the side panel

`components/chat/ChatPanel.tsx`

- Import `RealtimeVoice`.
- Render `<RealtimeVoice compact />` in the toolbar between the mic button and
  the TTS/speaker button — the same position it occupies in the main chat.

## Reused for free

The component is self-contained: WebSocket session, microphone capture, audio
playback, voice selection (localStorage `realtime-voice`), and in-session tool
execution all come along. Backend `/api/realtime/session` and
`/api/tools/execute` already exist and need no changes.

## Out of scope

- No camera button in the side panel (not requested).

## Testing

- Compact phone button renders at the correct size next to the other side-panel
  buttons.
- Clicking starts a session: mic permission → listening → agent responds with
  audio.
- Ending the session cleans up (mic + WebSocket released).
- The main chat's voice button is visually unchanged.
