import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {
  ALICE,
  BOB,
  GREEN,
  HAND,
  INK,
  MUTED,
  PAPER,
  progress,
} from './HandDrawnOpening.jsx';
import {FPS} from './timeline.js';
import {OUTRO_VOICE_FRAMES} from './audioTimeline.js';

export const SYSTEM_MAP_OUTRO_FRAMES = OUTRO_VOICE_FRAMES;

const BOARD_WIDTH = 2200;
const BOARD_HEIGHT = 1200;

const BranchLine = ({x1, y1, x2, y2, amount, color, width = 7}) => {
  const length = Math.hypot(x2 - x1, y2 - y1);
  return (
    <svg style={{position: 'absolute', inset: 0, overflow: 'visible'}} width={BOARD_WIDTH} height={BOARD_HEIGHT}>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={length}
        strokeDashoffset={length * (1 - amount)}
        opacity={amount}
      />
    </svg>
  );
};

const ScreenshotCard = ({x, y, width = 300, label, src, color, shown, highlight, rotate = 0}) => {
  const height = width * 0.5625;
  const scale = interpolate(highlight, [0, 1], [0.96, 1.035]);
  const opacity = shown * interpolate(highlight, [0, 1], [0.42, 1]);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        padding: 9,
        paddingBottom: 0,
        boxSizing: 'border-box',
        background: '#FFFDF8',
        border: `5px solid ${color}`,
        boxShadow: highlight > 0.65
          ? `0 0 0 10px ${color}2E, 13px 15px 0 rgba(55,48,38,.17)`
          : '9px 11px 0 rgba(55,48,38,.12)',
        transform: `rotate(${rotate}deg) scale(${scale})`,
        opacity,
        transformOrigin: 'center',
        filter: `grayscale(${(1 - highlight) * 0.55}) brightness(${0.88 + highlight * 0.12})`,
      }}
    >
      <div style={{height, overflow: 'hidden', border: `2px solid ${INK}`, background: PAPER}}>
        <Img src={staticFile(`system-map/${src}`)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
      </div>
      <div style={{height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', color: INK, fontFamily: HAND, fontSize: 22, fontWeight: 900, textAlign: 'center'}}>{label}</div>
    </div>
  );
};

const GroupLabel = ({x, y, children, color, shown, highlight, rotate = 0}) => (
  <div style={{position: 'absolute', left: x, top: y, padding: '8px 16px', borderRadius: 999, background: '#FFFDF8', border: `4px solid ${color}`, color, fontFamily: HAND, fontSize: 25, letterSpacing: 1.4, fontWeight: 900, opacity: shown * interpolate(highlight, [0, 1], [.55, 1]), transform: `rotate(${rotate}deg) scale(${interpolate(highlight, [0, 1], [.97, 1.04])})`}}>{children}</div>
);

const Tape = ({x, y, rotate = 0}) => (
  <div style={{position: 'absolute', left: x, top: y, width: 150, height: 38, background: 'rgba(255,226,139,.72)', border: '1px solid rgba(150,120,58,.25)', transform: `rotate(${rotate}deg)`}} />
);

const focus = (frame, start, end, finalAll) => Math.max(
  finalAll,
  interpolate(frame, [start - 45, start, end, end + 70], [0, 1, 1, 0.18], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }),
);

export const SystemMapOutro = () => {
  const frame = useCurrentFrame();
  const zoom = progress(frame, 20, 250);
  const orderShown = progress(frame, 205, 300);
  const responsiveShown = progress(frame, 690, 785);
  const durabilityShown = progress(frame, 1120, 1215);
  const finalAll = progress(frame, 1640, 1760);
  const ending = progress(frame, 1680, 1900);

  const orderFocus = focus(frame, 240, 675, finalAll);
  const responsiveFocus = focus(frame, 720, 1110, finalAll);
  const durabilityFocus = focus(frame, 1150, 1635, finalAll);

  const scale = interpolate(zoom, [0, 1], [1.18, 0.55]);
  const translateX = interpolate(zoom, [0, 1], [-690, 35]);
  const translateY = interpolate(zoom, [0, 1], [-360, 30]);
  const card = (groupShown, index) => progress(groupShown, index * 0.2, index * 0.2 + 0.55);

  const activeTitle = frame < 690
    ? '1 • ESTABLISH ONE ACCEPTED ORDER'
    : frame < 1120
      ? '2 • KEEP CLIENTS RESPONSIVE'
      : frame < 1640
        ? '3 • MAKE ACCEPTED WORK SURVIVE'
        : 'THE COMPLETE SYSTEM';

  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#B9A98A'}}>
      <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 45%, #D8CCB4 0%, #A49477 82%)'}} />
      <div style={{position: 'absolute', left: translateX, top: translateY, width: BOARD_WIDTH, height: BOARD_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left'}}>
        <div style={{position: 'absolute', inset: 0, background: PAPER, border: `6px solid ${INK}`, boxShadow: '28px 32px 0 rgba(55,44,31,.22)', backgroundImage: 'radial-gradient(#C8BDA6 1.4px, transparent 1.4px)', backgroundSize: '28px 28px'}} />

        {Array.from({length: 13}).map((_, index) => (
          <React.Fragment key={index}>
            <div style={{position: 'absolute', left: -21, top: 63 + index * 86, width: 55, height: 20, borderRadius: 999, border: `6px solid ${INK}`, background: '#B9A98A'}} />
            <div style={{position: 'absolute', left: 24, top: 65 + index * 86, width: 18, height: 18, borderRadius: '50%', background: '#B9A98A', border: `3px solid ${INK}`}} />
          </React.Fragment>
        ))}

        <Tape x={1010} y={-10} rotate={-2} />
        <Tape x={1045} y={1168} rotate={2} />

        <div style={{position: 'absolute', left: 650, top: 34, width: 900, textAlign: 'center', fontFamily: HAND, color: INK, opacity: zoom}}>
          <div style={{fontSize: 23, letterSpacing: 3, color: MUTED, fontWeight: 900}}>FIGMA MULTIPLAYER • ZOOMING OUT</div>
          <div style={{fontSize: 43, fontWeight: 900, marginTop: 3}}>Rebuild the system from every failure</div>
        </div>

        <BranchLine x1={800} y1={520} x2={510} y2={385} amount={orderShown} color={ALICE} />
        <BranchLine x1={1400} y1={520} x2={1690} y2={385} amount={responsiveShown} color={BOB} />
        <BranchLine x1={1100} y1={750} x2={1100} y2={895} amount={durabilityShown} color={GREEN} />

        <BranchLine x1={510} y1={385} x2={200} y2={310} amount={card(orderShown, 0)} color={ALICE} width={4} />
        <BranchLine x1={510} y1={385} x2={510} y2={310} amount={card(orderShown, 1)} color={ALICE} width={4} />
        <BranchLine x1={510} y1={385} x2={820} y2={310} amount={card(orderShown, 2)} color={ALICE} width={4} />

        <BranchLine x1={1690} y1={385} x2={1380} y2={310} amount={card(responsiveShown, 0)} color={BOB} width={4} />
        <BranchLine x1={1690} y1={385} x2={1690} y2={310} amount={card(responsiveShown, 1)} color={BOB} width={4} />
        <BranchLine x1={1690} y1={385} x2={2000} y2={310} amount={card(responsiveShown, 2)} color={BOB} width={4} />

        <BranchLine x1={1100} y1={895} x2={700} y2={960} amount={card(durabilityShown, 0)} color={GREEN} width={4} />
        <BranchLine x1={1100} y1={895} x2={1100} y2={960} amount={card(durabilityShown, 1)} color={GREEN} width={4} />
        <BranchLine x1={1100} y1={895} x2={1500} y2={960} amount={card(durabilityShown, 2)} color={GREEN} width={4} />

        <div style={{position: 'absolute', left: 750, top: 440, width: 700, height: 320, borderRadius: '50%', background: '#28241F', border: `8px solid ${INK}`, boxShadow: '16px 18px 0 rgba(55,48,38,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px 58px', boxSizing: 'border-box', transform: `scale(${interpolate(progress(frame, 0, 65), [0, 1], [.84, 1])})`}}>
          <div>
            <div style={{fontFamily: HAND, color: '#FFCB58', fontSize: 24, letterSpacing: 2, fontWeight: 900}}>THE PROBLEM</div>
            <div style={{fontFamily: HAND, color: '#FFF8E8', fontSize: 38, lineHeight: 1.08, fontWeight: 900, marginTop: 10}}>How can many people edit one file—quickly, consistently, and without losing work?</div>
            <div style={{fontFamily: HAND, color: '#FFCB58', fontSize: 22, lineHeight: 1.05, fontWeight: 900, marginTop: 9, opacity: ending}}>ORDER • RESPONSIVENESS • DURABILITY</div>
          </div>
        </div>

        <GroupLabel x={385} y={365} color={ALICE} shown={orderShown} highlight={orderFocus} rotate={-2}>REAL-TIME ORDER</GroupLabel>
        <ScreenshotCard x={45} y={125} label="Send small changes" src="order-websocket.png" color={ALICE} shown={card(orderShown, 0)} highlight={orderFocus} rotate={-2} />
        <ScreenshotCard x={355} y={105} label="Authority + sequence" src="order-authority.png" color={ALICE} shown={card(orderShown, 1)} highlight={orderFocus} rotate={1} />
        <ScreenshotCard x={665} y={130} label="Resolve property conflicts" src="order-conflict.png" color={ALICE} shown={card(orderShown, 2)} highlight={orderFocus} rotate={-1} />

        <GroupLabel x={1555} y={365} color={BOB} shown={responsiveShown} highlight={responsiveFocus} rotate={2}>RESPONSIVE CLIENTS</GroupLabel>
        <ScreenshotCard x={1235} y={130} label="Expose visible lag" src="responsive-lag.png" color={BOB} shown={card(responsiveShown, 0)} highlight={responsiveFocus} rotate={1} />
        <ScreenshotCard x={1545} y={105} label="Pending over confirmed" src="responsive-pending.png" color={BOB} shown={card(responsiveShown, 1)} highlight={responsiveFocus} rotate={-1} />
        <ScreenshotCard x={1855} y={125} label="Fresh state + replay" src="responsive-offline.png" color={BOB} shown={card(responsiveShown, 2)} highlight={responsiveFocus} rotate={2} />

        <GroupLabel x={985} y={850} color={GREEN} shown={durabilityShown} highlight={durabilityFocus} rotate={-1}>SURVIVE FAILURE</GroupLabel>
        <ScreenshotCard x={535} y={925} label="Complete checkpoints" src="durability-checkpoint.png" color={GREEN} shown={card(durabilityShown, 0)} highlight={durabilityFocus} rotate={-1} />
        <ScreenshotCard x={950} y={940} label="Expose the gap" src="durability-gap.png" color={GREEN} shown={card(durabilityShown, 1)} highlight={durabilityFocus} rotate={1} />
        <ScreenshotCard x={1365} y={925} label="Checkpoint + journal" src="durability-journal.png" color={GREEN} shown={card(durabilityShown, 2)} highlight={durabilityFocus} rotate={-1} />

      </div>

      <div style={{position: 'absolute', left: 0, right: 0, top: 17, textAlign: 'center', color: '#FFF8E8', fontFamily: HAND, fontSize: 20, letterSpacing: 1.6, fontWeight: 900, opacity: zoom}}>{activeTitle}</div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 17, textAlign: 'center', color: '#FFF8E8', fontFamily: HAND, fontSize: 18, fontWeight: 900, opacity: ending * .9}}>SYSTEMS FROM FIRST PRINCIPLES</div>
    </AbsoluteFill>
  );
};
