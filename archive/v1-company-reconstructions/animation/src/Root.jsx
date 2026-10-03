import React from 'react';
import {Composition} from 'remotion';
import {FigmaHandDrawnFullEpisode, HAND_DRAWN_FULL_FRAMES} from './HandDrawnFullEpisode.jsx';
import {SystemMapOutro, SYSTEM_MAP_OUTRO_FRAMES} from './SystemMapOutro.jsx';
import {FigmaMultiplayerShort, FIGMA_SHORT_FPS, FIGMA_SHORT_FRAMES} from './FigmaMultiplayerShort.jsx';
import {FPS, HEIGHT, WIDTH} from './timeline.js';

export const VideoRoot = () => (
  <>
    <Composition id="FigmaHandDrawnFullEpisode" component={FigmaHandDrawnFullEpisode} durationInFrames={HAND_DRAWN_FULL_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="FigmaHandDrawnNarrated" component={FigmaHandDrawnFullEpisode} durationInFrames={HAND_DRAWN_FULL_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={{includeVoice: true, withMusic: false}} />
    <Composition id="FigmaHandDrawnNarratedMusic" component={FigmaHandDrawnFullEpisode} durationInFrames={HAND_DRAWN_FULL_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={{includeVoice: true, withMusic: true}} />
    <Composition id="FigmaSystemMapOutro" component={SystemMapOutro} durationInFrames={SYSTEM_MAP_OUTRO_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="FigmaMultiplayerShort" component={FigmaMultiplayerShort} durationInFrames={FIGMA_SHORT_FRAMES} fps={FIGMA_SHORT_FPS} width={1080} height={1920} />
  </>
);
