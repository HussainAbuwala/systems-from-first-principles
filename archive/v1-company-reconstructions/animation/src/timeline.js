import {VOICE_BY_KEY, voiceKeyForTake} from './audioTimeline.js';

export const FPS = 24;
export const WIDTH = 1280;
export const HEIGHT = 720;

export const TAKES = [
  {id: 1, seconds: 13, title: 'The conflict', kind: 'conflict', prompt: 'Two people change one rectangle. Which edits can coexist—and who decides?'},
  {id: 2, seconds: 11, title: 'The promise', kind: 'promise', prompt: 'Build from the simplest save model, break it, and evolve it using public Figma evidence.'},
  {id: 3, seconds: 11, title: 'The simplest save model', kind: 'simple-save', prompt: 'One editor downloads a document, edits locally, and replaces the stored file.'},
  {id: 4, seconds: 14, title: 'Overwriting work', kind: 'overwrite', prompt: 'Alice and Bob branch from version 1. Bob’s later snapshot silently removes Alice’s change.'},
  {id: 5, seconds: 12, title: 'Send changes, not snapshots', kind: 'websocket', prompt: 'A persistent connection carries small property updates instead of complete documents.'},
  {id: 6, seconds: 10, title: 'Transport is not collaboration', kind: 'divergence', prompt: 'WebSockets move messages, but different arrival orders can still produce different states.'},
  {id: 7, seconds: 13, title: 'Give the document an authority', kind: 'authority', prompt: 'One Multiplayer instance validates and orders every accepted update for the document.'},
  {id: 8, seconds: 11, title: 'Independent properties', kind: 'independent', prompt: 'Position and fill belong to the same object, but they do not conflict with each other.'},
  {id: 9, seconds: 12, title: 'Last accepted value', kind: 'last-writer', prompt: 'Two fill changes conflict. The server’s later accepted value becomes shared state.'},
  {id: 10, seconds: 10, title: 'Waiting feels broken', kind: 'lag', prompt: 'If movement waits for a network round trip, the object visibly trails the cursor.'},
  {id: 11, seconds: 11, title: 'Optimistic local editing', kind: 'optimistic', prompt: 'Apply locally now; turn pending state into confirmed state after acknowledgement.'},
  {id: 12, part: 'A', seconds: 14, title: 'The backward jump', kind: 'flicker-broken', prompt: 'A naive client paints an older server value over a newer local move, so the rectangle jumps 200 → 130 → 200.'},
  {id: 12, part: 'B', seconds: 14, title: 'Keep pending state on top', kind: 'flicker-safe', prompt: 'Confirmed state can update underneath while the newer pending local position remains visible until acknowledgement.'},
  {id: 13, seconds: 13, title: 'Working offline', kind: 'offline', prompt: 'Bob edits offline, then downloads fresh state and replays his queued operations.'},
  {id: 14, seconds: 11, title: 'Fast state is volatile', kind: 'volatile', prompt: 'Active state lives in memory; complete compressed checkpoints go to durable storage.'},
  {id: 15, seconds: 20, title: 'The checkpoint gap', kind: 'checkpoint-gap', prompt: 'A crash exposes the gap; checkpointing every edit rewrites the complete file, while batching recreates the gap.'},
  {id: 16, seconds: 14, title: 'Add a journal', kind: 'journal', prompt: 'Persist small sequenced changes frequently; recover with a checkpoint plus replay.'},
];

let cursor = 0;
export const TIMELINE = TAKES.map((take) => {
  const voice = VOICE_BY_KEY[voiceKeyForTake(take)];
  const durationInFrames = voice?.segmentFrames ?? take.seconds * FPS;
  const item = {...take, from: cursor, durationInFrames};
  cursor += durationInFrames;
  return item;
});

export const TOTAL_FRAMES = cursor;
export const TOTAL_SECONDS = TOTAL_FRAMES / FPS;
