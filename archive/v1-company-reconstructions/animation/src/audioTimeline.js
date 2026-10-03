export const AUDIO_FPS = 24;
export const VOICE_GAP_FRAMES = 12;

const definitions = [
  ['01A', 1140],
  ['01B', 663],
  ['02', 858],
  ['03', 628],
  ['04', 998],
  ['05', 689],
  ['06', 723],
  ['07', 1036],
  ['08', 565],
  ['09', 917],
  ['10', 494],
  ['11', 731],
  ['12A', 1128],
  ['12B', 1044],
  ['13', 1244],
  ['14', 638],
  ['15', 1552],
  ['16', 1103],
  ['17', 2040],
];

export const VOICE_TAKES = definitions.map(([key, audioFrames]) => ({
  key,
  audioFrames,
  segmentFrames: audioFrames + VOICE_GAP_FRAMES,
  src: `audio/voice/take-${key}.wav`,
}));

export const VOICE_BY_KEY = Object.fromEntries(VOICE_TAKES.map((take) => [take.key, take]));

export const voiceKeyForTake = (take) => `${String(take.id).padStart(2, '0')}${take.part ?? ''}`;

export const OPENING_AUDIO_KEYS = ['01A', '01B', '02', '03', '04', '05'];

let openingCursor = 0;
export const OPENING_AUDIO_TIMELINE = OPENING_AUDIO_KEYS.map((key) => {
  const take = VOICE_BY_KEY[key];
  const item = {...take, from: openingCursor};
  openingCursor += take.segmentFrames;
  return item;
});

export const OPENING_VOICE_FRAMES = openingCursor;
export const OUTRO_VOICE_FRAMES = VOICE_BY_KEY['17'].segmentFrames;
