import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {
  ALICE,
  ALICE_SOFT,
  BOB,
  BOB_SOFT,
  Cross,
  DrawLine,
  FigmaHandDrawnOpening,
  GREEN,
  GREEN_SOFT,
  HAND,
  HAND_DRAWN_OPENING_FRAMES,
  INK,
  InkText,
  MUTED,
  PAPER,
  Pill,
  progress,
  PURPLE,
  RED,
  Sticky,
  YELLOW,
} from './HandDrawnOpening.jsx';
import {FPS, TIMELINE, TOTAL_FRAMES} from './timeline.js';
import {SystemMapOutro, SYSTEM_MAP_OUTRO_FRAMES} from './SystemMapOutro.jsx';
import {OPENING_AUDIO_TIMELINE, VOICE_BY_KEY, voiceKeyForTake} from './audioTimeline.js';

const REMAINING = TIMELINE.filter((take) => take.id >= 6);
const REMAINING_START = REMAINING[0].from;
const HAND_DRAWN_STORY_FRAMES = HAND_DRAWN_OPENING_FRAMES + TOTAL_FRAMES - REMAINING_START;
export const HAND_DRAWN_FULL_FRAMES = HAND_DRAWN_STORY_FRAMES + SYSTEM_MAP_OUTRO_FRAMES;

const CHAPTERS = {
  6: 'REAL-TIME ORDER',
  10: 'RESPONSIVE CLIENTS',
  14: 'SURVIVING FAILURE',
};

const chapterFor = (id) => {
  const start = Object.keys(CHAPTERS).map(Number).filter((value) => value <= id).at(-1);
  return CHAPTERS[start];
};

const reveal = (p, at, span = 0.12) => progress(p, at, at + span);

const BoardNode = ({x, y, width = 230, height = 112, title, subtitle, color = INK, soft = '#FFFDF7', opacity = 1, rotate = 0, dark = false}) => (
  <div style={{position: 'absolute', left: x, top: y, width, height, padding: '16px 18px', boxSizing: 'border-box', background: dark ? '#28241F' : soft, border: `3px solid ${dark ? '#28241F' : color}`, boxShadow: '7px 8px 0 rgba(59,51,41,.14)', transform: `rotate(${rotate}deg)`, opacity}}>
    <div style={{fontFamily: HAND, fontSize: 23, fontWeight: 900, color: dark ? '#FFF8E8' : INK, lineHeight: 1.12}}>{title}</div>
    {subtitle ? <div style={{fontFamily: HAND, fontSize: 16, color: dark ? '#D7CFBE' : MUTED, lineHeight: 1.3, marginTop: 9}}>{subtitle}</div> : null}
  </div>
);

const Property = ({x, y, label, value, color = PURPLE, opacity = 1, rotate = 0, width = 230}) => (
  <div style={{position: 'absolute', left: x, top: y, width, padding: '10px 14px', boxSizing: 'border-box', border: `3px solid ${color}`, background: '#FFFDF7', transform: `rotate(${rotate}deg)`, opacity, fontFamily: HAND, boxShadow: '4px 5px 0 rgba(57,49,40,.1)'}}>
    <span style={{fontSize: 16, color: MUTED}}>{label}</span>
    <span style={{fontSize: 20, fontWeight: 900, color, marginLeft: 9}}>{value}</span>
  </div>
);

const Shape = ({x, y, width = 125, height = 70, color = ALICE, label = '', opacity = 1, rotate = 0, circle = false}) => (
  <div style={{position: 'absolute', left: x, top: y, width: circle ? height : width, height, borderRadius: circle ? '50%' : 12, background: color, border: `3px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFDF7', fontFamily: HAND, fontSize: 18, fontWeight: 900, boxShadow: '5px 6px 0 rgba(45,40,34,.14)', transform: `rotate(${rotate}deg)`, opacity}}>{label}</div>
);

const ServerStamp = ({x, y, children, color = GREEN, opacity = 1, rotate = -2}) => (
  <div style={{position: 'absolute', left: x, top: y, padding: '8px 13px', border: `4px double ${color}`, color, background: '#FFFDF7', fontFamily: HAND, fontSize: 19, fontWeight: 900, transform: `rotate(${rotate}deg)`, opacity}}>{children}</div>
);

const MiniCanvas = ({x, y, owner, color, value, opacity = 1, width = 300}) => (
  <div style={{position: 'absolute', left: x, top: y, width, height: 250, border: `3px solid ${INK}`, background: '#FFFDF7', boxShadow: '7px 8px 0 rgba(55,48,38,.13)', opacity}}>
    <div style={{height: 40, padding: '0 13px', display: 'flex', alignItems: 'center', borderBottom: `3px solid ${INK}`, background: color === ALICE ? ALICE_SOFT : color === BOB ? BOB_SOFT : GREEN_SOFT, fontFamily: HAND, fontWeight: 900, fontSize: 18}}>{owner}</div>
    <div style={{position: 'absolute', left: 0, right: 0, top: 43, bottom: 0, backgroundImage: 'radial-gradient(#D8CDB7 1px, transparent 1px)', backgroundSize: '20px 20px'}}>
      <Shape x={82} y={72} width={135} color={value} label={value === RED ? 'red' : value === GREEN ? 'green' : 'shape'} />
    </div>
  </div>
);

const NotebookScene = ({take, children}) => {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [0, 8, take.durationInFrames - 8, take.durationInFrames], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const sceneProgress = frame / Math.max(1, take.durationInFrames - 1);
  const cameraY = interpolate(sceneProgress, [0, 1], [8, -4]);
  const fullProgress = (HAND_DRAWN_OPENING_FRAMES + take.from - REMAINING_START + frame) / HAND_DRAWN_FULL_FRAMES;
  return (
    <AbsoluteFill style={{background: PAPER, overflow: 'hidden', opacity: fade}}>
      <div style={{position: 'absolute', inset: 0, opacity: 0.54, backgroundImage: 'radial-gradient(#C8BDA6 1px, transparent 1px)', backgroundSize: '22px 22px'}} />
      <div style={{position: 'absolute', inset: 0, transform: `translateY(${cameraY}px)`}}>
        <InkText x={42} y={26} size={17} color={MUTED} style={{letterSpacing: 1.8}}>{chapterFor(take.id)}</InkText>
        <InkText x={42} y={53} size={40} width={980}>{take.title}</InkText>
        <div style={{position: 'absolute', right: 22, top: 30, width: 174, padding: '8px 10px', boxSizing: 'border-box', borderRadius: 999, border: `3px solid ${PURPLE}`, background: '#EEE7FF', color: PURPLE, fontFamily: HAND, fontSize: 14, fontWeight: 900, textAlign: 'center', whiteSpace: 'nowrap'}}>BUILD → BREAK → FIX</div>
        <div style={{position: 'absolute', left: 30, right: 30, top: 125, height: 525}}>{children(sceneProgress, frame)}</div>
      </div>
      <div style={{position: 'absolute', left: 38, bottom: 24, fontFamily: HAND, fontSize: 16, color: MUTED}}>SYSTEMS FROM FIRST PRINCIPLES • FIGMA MULTIPLAYER</div>
      <div style={{position: 'absolute', right: 38, bottom: 24, fontFamily: HAND, fontSize: 16, color: MUTED}}>{Math.round(fullProgress * 100)}%</div>
    </AbsoluteFill>
  );
};

const divergence = (p) => {
  const packets = reveal(p, 0.13, 0.35);
  const broken = reveal(p, 0.55, 0.2);
  return <>
    <MiniCanvas x={35} y={70} owner="Alice applies: green → red" color={ALICE} value={broken > 0.2 ? RED : GREEN} />
    <MiniCanvas x={885} y={70} owner="Bob applies: red → green" color={BOB} value={broken > 0.2 ? GREEN : RED} />
    <Property x={448} y={100} label="packet A" value="fill = green" color={GREEN} opacity={packets} rotate={-2} />
    <Property x={585} y={210} label="packet B" value="fill = red" color={RED} opacity={packets} rotate={2} />
    <DrawLine x1={450} y1={150} x2={335} y2={210} p={packets} color={GREEN} width={5} arrow />
    <DrawLine x1={815} y1={245} x2={885} y2={210} p={packets} color={RED} width={5} arrow />
    <DrawLine x1={600} y1={150} x2={885} y2={300} p={packets} color={GREEN} width={4} dashed arrow />
    <DrawLine x1={600} y1={245} x2={335} y2={300} p={packets} color={RED} width={4} dashed arrow />
    <InkText x={388} y={390} size={37} color={RED} opacity={broken}>Same messages ≠ same result</InkText>
    <InkText x={420} y={445} size={23} color={MUTED} opacity={broken}>Transport moved the edits. Nobody ordered them.</InkText>
  </>;
};

const authority = (p) => {
  const toServer = reveal(p, 0.08, 0.28);
  const ordered = reveal(p, 0.34, 0.2);
  const broadcast = reveal(p, 0.57, 0.28);
  return <>
    <BoardNode x={35} y={175} title="Alice" subtitle="sends an edit" color={ALICE} soft={ALICE_SOFT} opacity={reveal(p, 0, 0.12)} rotate={-1} />
    <BoardNode x={485} y={120} width={280} height={165} title="Document authority" subtitle="validate → order → apply → broadcast" color={PURPLE} soft="#EEE7FF" opacity={reveal(p, 0.12, 0.14)} />
    <BoardNode x={955} y={175} title="Bob" subtitle="receives accepted order" color={BOB} soft={BOB_SOFT} opacity={reveal(p, 0, 0.12)} rotate={1} />
    <DrawLine x1={265} y1={225} x2={485} y2={190} p={toServer} color={ALICE} width={5} arrow />
    <DrawLine x1={765} y1={190} x2={955} y2={225} p={broadcast} color={GREEN} width={5} arrow />
    <ServerStamp x={510} y={310} color={GREEN} opacity={ordered}>#41 accepted</ServerStamp>
    <ServerStamp x={670} y={365} color={RED} opacity={ordered}>#42 accepted</ServerStamp>
    <InkText x={390} y={440} size={28} color={PURPLE} opacity={broadcast}>Browsers agree on the authority’s order—not network arrival time.</InkText>
  </>;
};

const independent = (p) => {
  const merge = reveal(p, 0.35, 0.35);
  return <>
    <Property x={70} y={125} width={285} label="Alice changes" value="position = 200" color={ALICE} rotate={-2} opacity={reveal(p, 0.05)} />
    <Property x={845} y={125} width={285} label="Bob changes" value="fill = orange" color={BOB} rotate={2} opacity={reveal(p, 0.12)} />
    <DrawLine x1={355} y1={165} x2={510} y2={245} p={merge} color={ALICE} width={5} arrow />
    <DrawLine x1={845} y1={165} x2={690} y2={245} p={merge} color={BOB} width={5} arrow />
    <div style={{position: 'absolute', left: 450, top: 180, width: 300, height: 240, border: `3px solid ${INK}`, background: '#FFFDF7', opacity: merge, boxShadow: '7px 8px 0 rgba(55,48,38,.13)'}}>
      <Shape x={105 + 35 * merge} y={70} width={130} color="#F18C35" label="Checkout" />
    </div>
    <InkText x={448} y={435} size={31} color={GREEN} opacity={merge}>different properties → keep both ✓</InkText>
  </>;
};

const lastWriter = (p) => {
  const greenIn = reveal(p, 0.08, 0.22);
  const redIn = reveal(p, 0.3, 0.22);
  const final = reveal(p, 0.58, 0.22);
  return <>
    <Property x={55} y={105} label="same property" value="fill = green" color={GREEN} opacity={greenIn} rotate={-2} />
    <Property x={55} y={255} label="same property" value="fill = red" color={RED} opacity={redIn} rotate={2} />
    <BoardNode x={470} y={145} width={270} height={165} title="Authority" subtitle="the accepted order is the clock" color={PURPLE} soft="#EEE7FF" />
    <DrawLine x1={285} y1={145} x2={470} y2={195} p={greenIn} color={GREEN} width={5} arrow />
    <DrawLine x1={285} y1={295} x2={470} y2={255} p={redIn} color={RED} width={5} arrow />
    <ServerStamp x={780} y={110} color={GREEN} opacity={greenIn}>#43 green</ServerStamp>
    <ServerStamp x={830} y={210} color={RED} opacity={redIn}>#44 red</ServerStamp>
    <Shape x={985} y={315} width={150} height={85} color={final ? RED : GREEN} label={final ? 'FINAL: RED' : 'GREEN'} opacity={Math.max(greenIn, final)} />
    <InkText x={392} y={415} size={29} color={MUTED} opacity={final}>No synchronized client clocks required.</InkText>
  </>;
};

const lag = (p) => {
  const cursorX = 235 + 620 * p;
  const shapeX = 235 + 620 * Math.max(0, p - 0.28);
  return <>
    <div style={{position: 'absolute', left: 80, top: 80, width: 1040, height: 310, background: '#FFFDF7', border: `3px solid ${INK}`, backgroundImage: 'radial-gradient(#D8CDB7 1px, transparent 1px)', backgroundSize: '21px 21px'}}>
      {[0.2, 0.36, 0.52].map((alpha, i) => <Shape key={i} x={shapeX - 80 * (3 - i)} y={105} width={140} color={ALICE} label="drag" opacity={alpha} />)}
      <Shape x={shapeX} y={105} width={140} color={ALICE} label="drag" />
      <div style={{position: 'absolute', left: cursorX, top: 70, color: RED, fontSize: 52, transform: 'rotate(-20deg)'}}>➤</div>
    </div>
    <InkText x={355} y={420} size={33} color={RED}>waiting for the round trip = visible lag</InkText>
  </>;
};

const optimistic = (p) => {
  const ack = reveal(p, 0.62, 0.22);
  return <>
    <BoardNode x={75} y={150} width={330} height={195} title="Alice’s screen" subtitle="move immediately" color={ALICE} soft={ALICE_SOFT} />
    <Shape x={160 + 75 * reveal(p, 0.12, 0.2)} y={245} color={ALICE} label="x = 200" />
    <Property x={430} y={125} label={ack ? 'acknowledgement' : 'local layer'} value={ack ? '✓ confirmed' : '◷ pending'} color={ack ? GREEN : ALICE} />
    <BoardNode x={855} y={150} width={280} height={195} title="Authority" subtitle={ack ? 'accepted #45' : 'validating update'} color={PURPLE} soft="#EEE7FF" />
    <DrawLine x1={660} y1={165} x2={855} y2={220} p={reveal(p, 0.25, 0.3)} color={ALICE} width={5} arrow />
    <DrawLine x1={855} y1={295} x2={660} y2={265} p={ack} color={GREEN} width={5} arrow />
    <InkText x={310} y={420} size={31} color={GREEN}>Show the best-known state now. Confirm it later.</InkText>
  </>;
};

const flickerBroken = (p) => {
  const localMove = reveal(p, 0.08, 0.2);
  const olderArrival = reveal(p, 0.38, 0.18);
  const acknowledgement = reveal(p, 0.7, 0.18);
  let visibleValue = interpolate(localMove, [0, 1], [100, 200]);
  if (olderArrival > 0) visibleValue = interpolate(olderArrival, [0, 1], [200, 130]);
  if (acknowledgement > 0) visibleValue = interpolate(acknowledgement, [0, 1], [130, 200]);
  const roundedValue = Math.round(visibleValue);
  const visibleHistory = acknowledgement > 0.05
    ? 'Visible: 100 → 200 → 130 → 200'
    : olderArrival > 0.05
      ? 'Visible: 100 → 200 → 130'
      : localMove > 0.05
        ? 'Visible: 100 → 200'
        : 'Visible: 100';
  return <>
    <Pill x={445} y={8} color={RED} background="#FFDADC">NAIVE CLIENT: PAINT EVERY ARRIVAL</Pill>
    <div style={{position: 'absolute', left: 70, top: 70, width: 1060, height: 255, background: '#FFFDF7', border: `3px solid ${INK}`, backgroundImage: 'radial-gradient(#D8CDB7 1px, transparent 1px)', backgroundSize: '21px 21px'}}>
      <Shape x={80 + (visibleValue - 100) * 7.5} y={85} width={140} color={olderArrival > 0.1 && acknowledgement < 0.9 ? RED : BOB} label={`x = ${roundedValue}`} />
    </div>
    <Property x={65} y={360} label="confirmed" value="x = 100" color={PURPLE} width={245} opacity={reveal(p, 0, 0.1)} />
    <Property x={350} y={360} label="local pending" value="x = 200" color={ALICE} width={245} opacity={localMove} />
    <Property x={635} y={360} label="older arrives" value="x = 130" color={RED} width={245} opacity={olderArrival} />
    <Property x={920} y={360} label="accepted" value="x = 200" color={GREEN} width={245} opacity={acknowledgement} />
    <InkText x={365} y={455} size={31} color={RED} opacity={Math.max(localMove, olderArrival)}>{visibleHistory}</InkText>
  </>;
};

const flickerSafe = (p) => {
  const olderArrival = reveal(p, 0.25, 0.2);
  const acknowledgement = reveal(p, 0.7, 0.18);
  const confirmedValue = acknowledgement > 0 ? Math.round(interpolate(acknowledgement, [0, 1], [130, 200])) : olderArrival > 0 ? Math.round(interpolate(olderArrival, [0, 1], [100, 130])) : 100;
  return <>
    <Pill x={430} y={8} color={GREEN} background={GREEN_SOFT}>CORRECTED CLIENT: KEEP LOCAL INTENT ON TOP</Pill>
    <div style={{position: 'absolute', left: 70, top: 70, width: 1060, height: 255, background: '#FFFDF7', border: `3px solid ${INK}`, backgroundImage: 'radial-gradient(#D8CDB7 1px, transparent 1px)', backgroundSize: '21px 21px'}}>
      <Shape x={830} y={85} width={140} color={GREEN} label="visible x = 200" />
      <InkText x={335} y={25} size={23} color={MUTED}>The rectangle never jumps backward.</InkText>
    </div>
    <Property x={145} y={365} label="CONFIRMED • underneath" value={`x = ${confirmedValue}`} color={PURPLE} width={395} opacity={1} />
    <DrawLine x1={540} y1={400} x2={655} y2={400} p={reveal(p, 0.08, 0.14)} color={MUTED} width={4} arrow />
    <Property x={655} y={350} label="PENDING • visually on top" value="x = 200" color={ALICE} width={395} opacity={1 - acknowledgement} rotate={1} />
    <ServerStamp x={710} y={365} color={GREEN} opacity={acknowledgement}>ACKNOWLEDGED • PENDING CLEARED</ServerStamp>
    <InkText x={292} y={460} size={25} color={MUTED} opacity={olderArrival}>Incoming 130 updates confirmed state underneath—not the visible shape.</InkText>
  </>;
};

const offline = (p) => {
  const reconnect = reveal(p, 0.23, 0.16);
  const replay = reveal(p, 0.38, 0.18);
  return <>
    <BoardNode x={40} y={145} title="Bob offline" subtitle="keeps editing locally" color={BOB} soft={BOB_SOFT} rotate={-1} />
    <div style={{position: 'absolute', left: 300, top: 120, color: RED, fontFamily: HAND, fontSize: 64, fontWeight: 900}}>⌁</div>
    <Sticky x={340} y={230} width={240} height={165} color={BOB_SOFT} title="queued edits" rotate={2}>#1 move shape<br/>#2 change label<br/>#3 add star</Sticky>
    <BoardNode x={850} y={90} width={300} height={150} title="Fresh shared state" subtitle="download after reconnect" color={PURPLE} soft="#EEE7FF" opacity={reconnect} />
    <DrawLine x1={850} y1={190} x2={580} y2={265} p={reconnect} color={PURPLE} width={5} arrow />
    <DrawLine x1={580} y1={345} x2={850} y2={330} p={replay} color={BOB} width={5} arrow />
    <BoardNode x={850} y={275} width={300} height={135} title="Replay local edits" subtitle="same conflict rules still apply" color={GREEN} soft={GREEN_SOFT} opacity={replay} />
    <InkText x={337} y={438} size={31} color={GREEN} opacity={replay}>reconnect = fresh state + replay</InkText>
  </>;
};

const convergence = (p) => {
  const agree = reveal(p, 0.22, 0.2);
  const intention = reveal(p, 0.55, 0.18);
  return <>
    <MiniCanvas x={95} y={85} owner="Alice now sees" color={ALICE} value={RED} opacity={agree} />
    <MiniCanvas x={805} y={85} owner="Bob now sees" color={BOB} value={RED} opacity={agree} />
    <DrawLine x1={395} y1={215} x2={805} y2={215} p={agree} color={GREEN} width={5} />
    <ServerStamp x={490} y={155} opacity={agree}>CONVERGED ✓</ServerStamp>
    <Property x={95} y={370} label="Alice intended" value="fill = green" color={GREEN} opacity={intention} />
    <Cross x={88} y={360} width={245} height={70} p={intention} color={RED} />
    <InkText x={425} y={410} size={31} color={INK} opacity={intention}>Agreement does not preserve every human intention.</InkText>
  </>;
};

const documentTree = (p) => {
  const selected = reveal(p, 0.48, 0.18);
  const rows = [
    ['Document', 0], ['Frame', 1], ['Button', 2], ['Text', 3], ['Rectangle', 2],
  ];
  return <>
    <div style={{position: 'absolute', left: 60, top: 50, width: 440, height: 390, padding: 22, boxSizing: 'border-box', background: '#FFFDF7', border: `3px solid ${INK}`, boxShadow: '7px 8px 0 rgba(55,48,38,.13)'}}>
      <InkText x={22} y={18} size={23}>The visible canvas is a tree</InkText>
      {rows.map(([label, depth], i) => <div key={label} style={{position: 'absolute', left: 30 + depth * 48, top: 75 + i * 55, padding: '7px 12px', minWidth: 145, border: `2px solid ${label === 'Button' ? PURPLE : MUTED}`, background: label === 'Button' ? '#EEE7FF' : PAPER, fontFamily: HAND, fontWeight: 900, opacity: reveal(p, i * 0.08, 0.12)}}>↳ {label}</div>)}
    </div>
    <DrawLine x1={500} y1={245} x2={670} y2={245} p={selected} color={PURPLE} width={5} arrow />
    <Sticky x={690} y={80} width={440} height={335} color="#EEE7FF" title="selected object: Button" opacity={selected} rotate={1} border={PURPLE}>
      <div style={{fontSize: 22, lineHeight: 1.75}}>
        id: <b>button-17</b><br/>
        parent: <b>frame-3</b><br/>
        sibling position: <b>2</b><br/>
        fill: <b>#4285FF</b><br/>
        text: <b>“Checkout”</b>
      </div>
    </Sticky>
    <InkText x={355} y={455} size={28} color={GREEN} opacity={selected}>Synchronize structured objects—not pixels.</InkText>
  </>;
};

const structure = (p) => {
  const second = reveal(p, 0.3, 0.14);
  const third = reveal(p, 0.62, 0.14);
  return <>
    <Sticky x={25} y={75} width={355} height={330} color={ALICE_SOFT} title="1. IDs must not collide" rotate={-1}>
      <div style={{fontSize: 22, marginTop: 25}}>Alice creates <b>alice:42</b><br/><br/>Bob creates <b>bob:42</b></div>
      <div style={{fontSize: 23, color: GREEN, fontWeight: 900, marginTop: 28}}>offline-safe ✓</div>
    </Sticky>
    <Sticky x={425} y={75} width={355} height={330} color="#FFDADC" title="2. Parents cannot cycle" rotate={1} opacity={second}>
      <div style={{fontSize: 25, marginTop: 20}}>A → B → A</div>
      <div style={{fontSize: 21, color: RED, fontWeight: 900, marginTop: 110}}>authority rejects cycle</div>
    </Sticky>
    <Cross x={475} y={210} width={235} height={70} p={second} />
    <Sticky x={825} y={75} width={355} height={330} color={GREEN_SOFT} title="3. Layers need order" rotate={-1} opacity={third}>
      <div style={{fontSize: 21, marginTop: 23}}>Rectangle <b>1</b><br/>Text <b>1.5</b><br/>Button <b>2</b></div>
      <div style={{fontSize: 21, color: GREEN, fontWeight: 900, marginTop: 28}}>insert without renumbering</div>
    </Sticky>
  </>;
};

const volatile = (p) => {
  const checkpoint = reveal(p, 0.3, 0.32);
  return <>
    <BoardNode x={90} y={115} width={390} height={240} title="Multiplayer process" subtitle="active document lives in memory" color={RED} soft="#FFDADC" />
    <InkText x={180} y={250} size={38} color={RED}>FAST • VOLATILE</InkText>
    <BoardNode x={800} y={115} width={330} height={240} title="S3 checkpoint" subtitle="encoded + compressed complete file" color={GREEN} soft={GREEN_SOFT} opacity={checkpoint} />
    <DrawLine x1={480} y1={220} x2={800} y2={220} p={checkpoint} color={PURPLE} width={6} arrow />
    <Pill x={530} y={155} color={PURPLE} opacity={checkpoint}>every 30–60 seconds</Pill>
    <InkText x={365} y={410} size={29} color={MUTED} opacity={checkpoint}>Speed and durability now live in different places.</InkText>
  </>;
};

const checkpointGap = (p) => {
  const tradeoff = reveal(p, 0.5, 0.12);
  const edits = Math.min(5, Math.floor(reveal(p, 0.03, 0.2) * 6));
  const crash = reveal(p, 0.22, 0.07);
  const recovered = reveal(p, 0.3, 0.08);
  const writes = Math.min(5, Math.floor(reveal(p, 0.58, 0.18) * 6));
  const batched = reveal(p, 0.72, 0.12);
  const smallerUnit = reveal(p, 0.84, 0.12);
  return <>
    <div style={{position: 'absolute', inset: 0, opacity: 1 - tradeoff}}>
      <ServerStamp x={55} y={175} color={GREEN}>checkpoint 100</ServerStamp>
      <DrawLine x1={235} y1={210} x2={1070} y2={210} p={1} color={MUTED} width={4} />
      {[101, 102, 103, 104, 105].map((n, i) => <React.Fragment key={n}><div style={{position: 'absolute', left: 310 + i * 135, top: 190, width: 23, height: 23, borderRadius: '50%', background: i < edits ? ALICE : '#D8D0C1', border: `3px solid ${INK}`}}/><InkText x={298 + i * 135} y={235} size={18} color={i < edits ? ALICE : MUTED}>{n}</InkText></React.Fragment>)}
      {crash > 0 ? <><InkText x={855} y={110} size={72} color={RED} rotate={-6}>CRASH!</InkText><DrawLine x1={900} y1={165} x2={1035} y2={280} p={crash} color={RED} width={8}/><DrawLine x1={1035} y1={165} x2={900} y2={280} p={crash} color={RED} width={8}/></> : null}
      <BoardNode x={350} y={330} width={510} height={135} title={recovered ? 'Recovery stops at 100' : 'Edits 101–105 exist only in memory'} subtitle={recovered ? 'up to roughly 60 seconds can be missing' : 'the next complete checkpoint has not happened'} color={recovered ? RED : MUTED} soft={recovered ? '#FFDADC' : '#FFFDF7'} opacity={Math.max(0.35, crash)} />
    </div>
    <div style={{position: 'absolute', inset: 0, opacity: tradeoff}}>
      <Pill x={315} y={8} color={PURPLE} background="#EEE7FF">OUR DESIGN ALTERNATIVE • NOT A CLAIM ABOUT FIGMA’S STORAGE LAYOUT</Pill>
      <BoardNode x={30} y={95} width={350} height={285} title="Checkpoint every edit?" subtitle="Each tiny change rewrites the complete encoded, compressed file." color={RED} soft="#FFDADC" />
      <InkText x={132} y={260} size={52} color={RED}>{writes}×</InkText>
      <InkText x={82} y={325} size={19} color={MUTED}>complete-file writes</InkText>
      <DrawLine x1={380} y1={225} x2={440} y2={225} p={batched} color={MUTED} width={4} arrow />
      <BoardNode x={440} y={95} width={350} height={285} title="Batch the checkpoints?" subtitle="Fewer full writes—but accepted edits wait in memory again." color={PURPLE} soft="#EEE7FF" opacity={batched} />
      <InkText x={512} y={280} size={29} color={RED} opacity={batched}>the gap returns</InkText>
      <DrawLine x1={790} y1={225} x2={850} y2={225} p={smallerUnit} color={GREEN} width={5} arrow />
      <BoardNode x={850} y={95} width={350} height={285} title="Change the unit" subtitle="Persist small changes between occasional complete checkpoints." color={GREEN} soft={GREEN_SOFT} opacity={smallerUnit} />
      <InkText x={922} y={280} size={27} color={GREEN} opacity={smallerUnit}>small durable deltas</InkText>
      <InkText x={305} y={430} size={30} color={INK} opacity={smallerUnit}>The journal is the next piece the failure demands.</InkText>
    </div>
  </>;
};

const checkpointSpike = (p) => {
  const writes = Math.min(5, Math.floor(reveal(p, 0.12, 0.55) * 6));
  return <>
    <Pill x={35} y={15} color={PURPLE} background="#EEE7FF">TEACHING MODEL • STORAGE LAYOUT UNSPECIFIED</Pill>
    <BoardNode x={40} y={100} width={300} height={280} title="five tiny edits" subtitle="101 • 102 • 103 • 104 • 105" color={ALICE} soft={ALICE_SOFT} />
    <InkText x={125} y={250} size={56} color={ALICE}>{writes}</InkText>
    <InkText x={84} y={315} size={19} color={MUTED}>accepted edits</InkText>
    <DrawLine x1={340} y1={220} x2={685} y2={220} p={reveal(p, 0.12, 0.5)} color={RED} width={7} arrow />
    <Pill x={395} y={145} color={RED} opacity={reveal(p, 0.18)}>encode + compress + upload</Pill>
    <BoardNode x={700} y={100} width={440} height={280} title="one retained snapshot" subtitle="but the complete file was rewritten after every edit" color={RED} soft="#FFDADC" />
    <InkText x={820} y={235} size={62} color={RED}>{writes}×</InkText>
    <InkText x={775} y={315} size={22} color={MUTED}>complete-file writes</InkText>
    <InkText x={285} y={430} size={29} color={INK}>Count the write work—not only the snapshots left behind.</InkText>
  </>;
};

const journal = (p) => {
  const entries = Math.min(5, Math.floor(reveal(p, 0.12, 0.34) * 6));
  const replay = reveal(p, 0.42, 0.2);
  return <>
    <BoardNode x={40} y={125} width={260} height={180} title="checkpoint 100" subtitle="complete, durable base" color={GREEN} soft={GREEN_SOFT} />
    <div style={{position: 'absolute', left: 385, top: 90, width: 430, height: 270, padding: 20, boxSizing: 'border-box', border: `3px solid ${PURPLE}`, background: '#EEE7FF', boxShadow: '7px 8px 0 rgba(55,48,38,.13)'}}>
      <InkText x={20} y={15} size={25} color={PURPLE}>DynamoDB journal</InkText>
      {[101,102,103,104,105].map((n,i)=><Property key={n} x={25 + (i%2)*190} y={70 + Math.floor(i/2)*58} width={170} label="sequence" value={String(n)} color={i < entries ? PURPLE : MUTED} opacity={i < entries ? 1 : .18}/>) }
    </div>
    <DrawLine x1={300} y1={220} x2={385} y2={220} p={reveal(p, 0.12, 0.2)} color={PURPLE} width={5} arrow />
    <DrawLine x1={815} y1={220} x2={930} y2={220} p={replay} color={GREEN} width={6} arrow />
    <BoardNode x={930} y={125} width={260} height={180} title="recovered 105" subtitle="checkpoint + replay" color={GREEN} soft={GREEN_SOFT} opacity={replay} />
    <InkText x={360} y={410} size={31} color={GREEN} opacity={replay}>small changes become durable without rewriting the file</InkText>
  </>;
};

const splitBrain = (p) => {
  const conflict = reveal(p, 0.22, 0.18);
  const lock = reveal(p, 0.48, 0.18);
  const reject = reveal(p, 0.7, 0.18);
  return <>
    <BoardNode x={70} y={85} width={285} height={145} title="Instance A" subtitle="believes it owns file-7" color={ALICE} soft={ALICE_SOFT} />
    <BoardNode x={70} y={310} width={285} height={145} title="Instance B" subtitle="also believes it owns file-7" color={BOB} soft={BOB_SOFT} opacity={conflict} />
    <BoardNode x={820} y={175} width={330} height={185} title="one journal" subtitle="must have one history" color={PURPLE} soft="#EEE7FF" />
    <DrawLine x1={355} y1={155} x2={820} y2={230} p={conflict} color={ALICE} width={5} arrow />
    <DrawLine x1={355} y1={380} x2={820} y2={300} p={conflict} color={BOB} width={5} arrow />
    <ServerStamp x={490} y={170} color={GREEN} opacity={lock}>ownership lock = A-93</ServerStamp>
    <Cross x={410} y={320} width={345} height={80} p={reject} color={RED} />
    <InkText x={440} y={410} size={27} color={RED} opacity={reject}>B’s conditional write fails: lock no longer matches.</InkText>
  </>;
};

const validation = (p) => {
  const compare = reveal(p, 0.2, 0.24);
  const proof = reveal(p, 0.48, 0.2);
  const results = reveal(p, 0.72, 0.16);
  return <>
    <BoardNode x={35} y={100} width={270} height={170} title="checkpoint A" subtitle="known complete state" color={GREEN} soft={GREEN_SOFT} />
    <BoardNode x={455} y={100} width={300} height={170} title="replay journal" subtitle="apply all sequenced entries" color={PURPLE} soft="#EEE7FF" opacity={compare} />
    <BoardNode x={895} y={100} width={270} height={170} title="checkpoint B" subtitle="next known state" color={GREEN} soft={GREEN_SOFT} opacity={compare} />
    <DrawLine x1={305} y1={185} x2={455} y2={185} p={compare} color={PURPLE} width={5} arrow />
    <DrawLine x1={755} y1={185} x2={895} y2={185} p={compare} color={GREEN} width={5} arrow />
    <ServerStamp x={455} y={300} color={GREEN} opacity={proof}>BYTE-FOR-BYTE MATCH ✓</ServerStamp>
    <InkText x={350} y={365} size={26} color={MUTED} opacity={proof}>~400,000 consecutive validations before gradual rollout</InkText>
    <div style={{position:'absolute',left:180,top:420,width:850,display:'flex',justifyContent:'space-between',opacity:results}}>
      <Pill color={PURPLE} background="#EEE7FF">2.2B+ changes / day</Pill>
      <Pill color={GREEN} background={GREEN_SOFT}>95% persisted ≈ 600 ms</Pill>
      <Pill color={MUTED}>reported in 2022</Pill>
    </div>
  </>;
};

const recap = (p) => {
  const items = [
    ['WebSocket', 'small changes', ALICE, ALICE_SOFT],
    ['Authority', 'one order', PURPLE, '#EEE7FF'],
    ['Optimism', 'instant UI', BOB, BOB_SOFT],
    ['Replay', 'reconnect', '#F18C35', '#FFE6C7'],
    ['Checkpoint', 'complete base', GREEN, GREEN_SOFT],
    ['Journal', 'durable deltas', RED, '#FFDADC'],
  ];
  return <>
    {items.map(([title, subtitle, color, soft], i) => {
      const x = 40 + i * 195;
      const visible = reveal(p, i * 0.12, 0.12);
      return <React.Fragment key={title}>
        <BoardNode x={x} y={150 + (i % 2) * 65} width={165} height={125} title={title} subtitle={subtitle} color={color} soft={soft} opacity={visible} rotate={i%2 ? 1 : -1} />
        {i < items.length - 1 ? <DrawLine x1={x+165} y1={212+(i%2)*65} x2={x+195} y2={212+((i+1)%2)*65} p={visible} color={MUTED} width={3} arrow /> : null}
      </React.Fragment>;
    })}
    <InkText x={285} y={400} size={34} color={INK} opacity={reveal(p, .78, .14)}>Every box is the scar left by an earlier failure.</InkText>
  </>;
};

const tradeoffs = (p) => {
  const cards = [
    {x: 35, title: 'AUTHORITY', gain: 'simple accepted order', cost: 'availability + exclusive ownership', color: PURPLE, soft: '#EEE7FF'},
    {x: 435, title: 'LAST VALUE', gain: 'deterministic conflict rule', cost: 'one intention can be lost', color: RED, soft: '#FFDADC'},
    {x: 835, title: 'JOURNAL', gain: 'smaller durability gap', cost: 'replay + validation + locks', color: GREEN, soft: GREEN_SOFT},
  ];
  return <>
    {cards.map((card, i) => <div key={card.title} style={{position:'absolute',left:card.x,top:75,width:350,height:350,padding:24,boxSizing:'border-box',background:card.soft,border:`3px solid ${card.color}`,boxShadow:'7px 8px 0 rgba(55,48,38,.13)',transform:`rotate(${i===1?1:-1}deg)`,opacity:reveal(p,i*.18,.16)}}>
      <div style={{fontFamily:HAND,fontSize:25,fontWeight:900,color:card.color}}>{card.title}</div>
      <div style={{fontFamily:HAND,fontSize:17,color:MUTED,marginTop:34}}>YOU GAIN</div>
      <div style={{fontFamily:HAND,fontSize:24,fontWeight:900,color:INK,marginTop:8}}>{card.gain}</div>
      <div style={{height:3,background:card.color,marginTop:28,opacity:.7}} />
      <div style={{fontFamily:HAND,fontSize:17,color:MUTED,marginTop:48}}>YOU PAY</div>
      <div style={{fontFamily:HAND,fontSize:23,fontWeight:900,color:INK,marginTop:8}}>{card.cost}</div>
    </div>)}
    <InkText x={270} y={450} size={28} color={MUTED} opacity={reveal(p,.68,.16)}>Production architecture is a negotiated set of tradeoffs.</InkText>
  </>;
};

const resolution = (p) => {
  const compatible = reveal(p, .12, .2);
  const conflict = reveal(p, .42, .2);
  const close = reveal(p, .72, .18);
  return <>
    <div style={{position:'absolute',left:50,top:75,width:500,height:325,background:'#FFFDF7',border:`3px solid ${INK}`,boxShadow:'7px 8px 0 rgba(55,48,38,.13)'}}>
      <InkText x={22} y={20} size={23}>Different properties</InkText>
      <Property x={30} y={80} width={205} label="Alice" value="position" color={ALICE} opacity={compatible}/>
      <Property x={260} y={145} width={205} label="Bob" value="fill" color={BOB} opacity={compatible}/>
      <ServerStamp x={145} y={245} color={GREEN} opacity={compatible}>KEEP BOTH ✓</ServerStamp>
    </div>
    <div style={{position:'absolute',left:650,top:75,width:500,height:325,background:'#FFFDF7',border:`3px solid ${INK}`,boxShadow:'7px 8px 0 rgba(55,48,38,.13)'}}>
      <InkText x={22} y={20} size={23}>Same property</InkText>
      <Property x={30} y={80} width={205} label="#43" value="green" color={GREEN} opacity={conflict}/>
      <Property x={260} y={145} width={205} label="#44" value="red" color={RED} opacity={conflict}/>
      <ServerStamp x={160} y={245} color={RED} opacity={conflict}>RED WINS</ServerStamp>
    </div>
    <InkText x={340} y={430} size={40} color={PURPLE} opacity={close}>Which part would you design differently?</InkText>
  </>;
};

const visuals = {
  divergence,
  authority,
  independent,
  'last-writer': lastWriter,
  lag,
  optimistic,
  'flicker-broken': flickerBroken,
  'flicker-safe': flickerSafe,
  offline,
  volatile,
  'checkpoint-gap': checkpointGap,
  journal,
  'split-brain': splitBrain,
  validation,
  recap,
  tradeoffs,
  resolution,
};

const HandDrawnTake = ({take}) => (
  <NotebookScene take={take}>{(p, frame) => visuals[take.kind](p, frame, take.durationInFrames)}</NotebookScene>
);

const TakeVoice = ({take}) => (
  <Audio
    src={staticFile(take.src)}
    volume={(frame) => interpolate(
      frame,
      [0, 1, Math.max(2, take.audioFrames - 4), take.audioFrames],
      [0, 1, 1, 0],
      {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
    )}
  />
);

const VoiceTrack = () => (
  <>
    <Audio src={staticFile('audio/room-tone.wav')} loop volume={1.4} />
    {OPENING_AUDIO_TIMELINE.map((take) => (
      <Sequence key={take.key} from={take.from} durationInFrames={take.audioFrames}>
        <TakeVoice take={take} />
      </Sequence>
    ))}
    {REMAINING.map((take) => {
      const voice = VOICE_BY_KEY[voiceKeyForTake(take)];
      const from = HAND_DRAWN_OPENING_FRAMES + take.from - REMAINING_START;
      return (
        <Sequence key={`voice-${voice.key}`} from={from} durationInFrames={voice.audioFrames}>
          <TakeVoice take={voice} />
        </Sequence>
      );
    })}
    <Sequence from={HAND_DRAWN_STORY_FRAMES} durationInFrames={VOICE_BY_KEY['17'].audioFrames}>
      <TakeVoice take={VOICE_BY_KEY['17']} />
    </Sequence>
  </>
);

const MusicTrack = () => (
  <Audio
    src={staticFile('audio/music/ambient-bed.wav')}
    volume={(frame) => interpolate(
      frame,
      [0, 72, HAND_DRAWN_FULL_FRAMES - 120, HAND_DRAWN_FULL_FRAMES],
      [0, 0.30, 0.30, 0],
      {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
    )}
  />
);

export const FigmaHandDrawnFullEpisode = ({includeVoice = false, withMusic = false}) => (
  <AbsoluteFill style={{background: PAPER}}>
    <Sequence from={0} durationInFrames={HAND_DRAWN_OPENING_FRAMES} premountFor={FPS}>
      <FigmaHandDrawnOpening />
    </Sequence>
    {REMAINING.map((take) => {
      const from = HAND_DRAWN_OPENING_FRAMES + take.from - REMAINING_START;
      return (
        <Sequence key={`${take.id}${take.part ?? ''}`} from={from} durationInFrames={take.durationInFrames} premountFor={FPS}>
          <HandDrawnTake take={take} />
        </Sequence>
      );
    })}
    <Sequence from={HAND_DRAWN_STORY_FRAMES} durationInFrames={SYSTEM_MAP_OUTRO_FRAMES} premountFor={FPS}>
      <SystemMapOutro />
    </Sequence>
    {withMusic ? <MusicTrack /> : null}
    {includeVoice ? <VoiceTrack /> : null}
  </AbsoluteFill>
);
