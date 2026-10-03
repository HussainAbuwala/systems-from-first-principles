import React from 'react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  interpolateColors,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  ALICE,
  ALICE_SOFT,
  BOB,
  BOB_SOFT,
  GREEN,
  GREEN_SOFT,
  HAND,
  INK,
  MUTED,
  PAPER,
  PURPLE,
  RED,
} from './HandDrawnOpening.jsx';

export const FIGMA_SHORT_FPS = 24;
export const FIGMA_SHORT_FRAMES = 51 * FIGMA_SHORT_FPS;

const ORANGE = '#F28B38';
const PURPLE_SOFT = '#EEE7FF';
const WHITE = '#FFFDF7';

const clamp = (value) => Math.max(0, Math.min(1, value));
const progress = (frame, start, end) => clamp(interpolate(
  frame,
  [start, end],
  [0, 1],
  {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
));

const sceneOpacity = (frame, start, end, fade = 12) => interpolate(
  frame,
  [start, start + fade, end - fade, end],
  [0, 1, 1, 0],
  {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
);

const Paper = ({children}) => (
  <AbsoluteFill style={{background: PAPER, overflow: 'hidden'}}>
    <div style={{
      position: 'absolute',
      inset: 0,
      opacity: 0.58,
      backgroundImage: 'radial-gradient(#C8BDA6 1.35px, transparent 1.35px)',
      backgroundSize: '25px 25px',
    }} />
    <div style={{position: 'absolute', inset: 0}}>{children}</div>
  </AbsoluteFill>
);

const Ink = ({children, x, y, size = 64, color = INK, width, align = 'left', opacity = 1, rotate = 0, style = {}}) => (
  <div style={{
    position: 'absolute',
    left: x,
    top: y,
    width,
    color,
    opacity,
    transform: `rotate(${rotate}deg)`,
    transformOrigin: 'left center',
    fontFamily: HAND,
    fontSize: size,
    fontWeight: 900,
    lineHeight: 1.08,
    textAlign: align,
    ...style,
  }}>{children}</div>
);

const Tag = ({children, x = 64, y = 60, color = PURPLE, background = PURPLE_SOFT, opacity = 1}) => (
  <div style={{
    position: 'absolute',
    left: x,
    top: y,
    padding: '13px 23px 11px',
    border: `4px solid ${color}`,
    borderRadius: 999,
    background,
    color,
    opacity,
    fontFamily: HAND,
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: 1.3,
    boxShadow: '5px 6px 0 rgba(55,48,38,.11)',
  }}>{children}</div>
);

const Card = ({x, y, width, height, color = INK, background = WHITE, children, opacity = 1, rotate = 0, radius = 4}) => (
  <div style={{
    position: 'absolute',
    left: x,
    top: y,
    width,
    height,
    boxSizing: 'border-box',
    padding: 24,
    border: `4px solid ${color}`,
    borderRadius: radius,
    background,
    boxShadow: '9px 11px 0 rgba(55,48,38,.13)',
    opacity,
    transform: `rotate(${rotate}deg)`,
  }}>{children}</div>
);

const Shape = ({x, y, width = 260, height = 135, color = ALICE, label = '', opacity = 1}) => (
  <div style={{
    position: 'absolute',
    left: x,
    top: y,
    width,
    height,
    borderRadius: 24,
    background: color,
    border: `5px solid ${INK}`,
    boxShadow: '9px 11px 0 rgba(45,40,34,.15)',
    display: 'grid',
    placeItems: 'center',
    color: WHITE,
    fontFamily: HAND,
    fontSize: 34,
    fontWeight: 900,
    opacity,
  }}>{label}</div>
);

const Cursor = ({x, y, name, color, opacity = 1, scale = 1}) => (
  <div style={{position: 'absolute', left: x, top: y, opacity, transform: `scale(${scale}) rotate(-18deg)`, transformOrigin: 'top left', zIndex: 10}}>
    <div style={{fontSize: 82, lineHeight: 1, color, filter: 'drop-shadow(0 4px 0 white) drop-shadow(0 6px 2px rgba(0,0,0,.23))'}}>➤</div>
    <div style={{
      position: 'absolute',
      left: 48,
      top: 58,
      padding: '9px 15px',
      borderRadius: 8,
      background: color,
      color: 'white',
      fontFamily: HAND,
      fontSize: 25,
      fontWeight: 900,
      whiteSpace: 'nowrap',
      transform: 'rotate(18deg)',
    }}>{name}</div>
  </div>
);

const Line = ({x1, y1, x2, y2, p, color = INK, width = 7, dashed = false, arrow = true}) => {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  return (
    <>
      <svg width="1080" height="1920" style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
          strokeDasharray={dashed ? '18 15' : length}
          strokeDashoffset={dashed ? 0 : length * (1 - p)}
          opacity={p}
        />
      </svg>
      {arrow && p > 0.84 ? <div style={{
        position: 'absolute',
        left: x2 - 13,
        top: y2 - 14,
        width: 0,
        height: 0,
        borderTop: '14px solid transparent',
        borderBottom: '14px solid transparent',
        borderLeft: `25px solid ${color}`,
        transform: `rotate(${angle}rad)`,
        transformOrigin: '13px 14px',
        opacity: progress(p, 0.84, 1),
      }} /> : null}
    </>
  );
};

const Stamp = ({children, x, y, color = GREEN, opacity = 1, rotate = -2}) => (
  <div style={{
    position: 'absolute',
    left: x,
    top: y,
    padding: '13px 21px 10px',
    border: `6px double ${color}`,
    background: WHITE,
    color,
    opacity,
    transform: `rotate(${rotate}deg)`,
    fontFamily: HAND,
    fontSize: 31,
    fontWeight: 900,
    boxShadow: '5px 6px 0 rgba(55,48,38,.1)',
  }}>{children}</div>
);

const captions = [
  [0, 75, 'Two people edit the same Figma shape at almost the same time.'],
  [75, 190, 'Alice moves it. Bob changes its color.'],
  [190, 280, 'Easy — keep both.'],
  [280, 405, 'But now they both change the same fill property.'],
  [405, 460, 'Who wins?'],
  [460, 575, 'Both edits travel over WebSockets.'],
  [575, 680, 'Network delay can change their arrival order.'],
  [680, 770, 'Real-time does not mean collaborative.'],
  [770, 895, 'One authority validates and orders every change.'],
  [895, 980, 'Different properties? Keep both.'],
  [980, 1070, 'Same property? The last server-accepted value is shared.'],
  [1070, 1135, 'Now everyone can agree.'],
  [1135, 1185, 'But agreement is only one-third.'],
  [1185, 1224, 'Instant? Offline? Crash recovery? Full system linked below.'],
];

const Caption = ({frame}) => {
  const active = captions.find(([start, end]) => frame >= start && frame < end);
  if (!active) return null;
  const [start, end, text] = active;
  const enter = spring({frame: frame - start, fps: FIGMA_SHORT_FPS, config: {damping: 18, stiffness: 150}});
  const opacity = sceneOpacity(frame, start, end, 5);
  return (
    <div style={{
      position: 'absolute',
      left: 70,
      right: 125,
      bottom: 190,
      minHeight: 175,
      padding: '28px 34px',
      boxSizing: 'border-box',
      borderRadius: 24,
      background: 'rgba(39,35,31,.95)',
      border: '3px solid rgba(255,255,255,.22)',
      boxShadow: '0 14px 40px rgba(38,31,23,.24)',
      color: '#FFF9ED',
      fontFamily: HAND,
      fontSize: 47,
      fontWeight: 900,
      lineHeight: 1.16,
      textAlign: 'center',
      opacity,
      transform: `translateY(${interpolate(enter, [0, 1], [24, 0])}px)`,
      display: 'grid',
      placeItems: 'center',
      zIndex: 50,
    }}>{text}</div>
  );
};

const CompatibleScene = ({frame}) => {
  const opacity = sceneOpacity(frame, 0, 290);
  const move = progress(frame, 78, 175);
  const fill = progress(frame, 150, 225);
  const result = progress(frame, 205, 260);
  const shapeX = interpolate(move, [0, 1], [225, 425]);
  const shapeColor = interpolateColors(fill, [0, 1], [ALICE, ORANGE]);
  return (
    <div style={{position: 'absolute', inset: 0, opacity}}>
      <Tag>FIGMA MULTIPLAYER</Tag>
      <Ink x={62} y={145} size={82} width={950}>TWO PEOPLE.<br/><span style={{color: PURPLE}}>ONE SHAPE.</span></Ink>
      <Card x={72} y={380} width={936} height={910} color={INK}>
        <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 82, background: '#2C2C2C', color: WHITE, display: 'flex', alignItems: 'center', padding: '0 28px', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif', fontSize: 27, fontWeight: 800}}>Checkout flow <span style={{marginLeft: 'auto', color: '#80C7FF'}}>● Live</span></div>
        <div style={{position: 'absolute', left: 45, right: 45, top: 130, bottom: 55, background: '#F7F7F7', border: '2px solid #D6D6D6', backgroundImage: 'radial-gradient(#D8D0C4 1.2px, transparent 1.2px)', backgroundSize: '24px 24px'}}>
          <Shape x={shapeX} y={300} color={shapeColor} label="Pay now" />
          <Cursor x={interpolate(move, [0, 1], [125, 345])} y={560} name="Alice" color={ALICE} opacity={progress(frame, 30, 70) * (1 - result)} />
          <Cursor x={interpolate(fill, [0, 1], [710, 600])} y={215} name="Bob" color={BOB} opacity={progress(frame, 70, 115) * (1 - result)} />
          <div style={{position: 'absolute', left: 90, top: 75, padding: '15px 20px', borderRadius: 12, background: ALICE_SOFT, border: `3px solid ${ALICE}`, color: ALICE, fontFamily: HAND, fontSize: 29, fontWeight: 900, opacity: move}}>POSITION ✓</div>
          <div style={{position: 'absolute', right: 80, top: 75, padding: '15px 20px', borderRadius: 12, background: BOB_SOFT, border: `3px solid ${BOB}`, color: BOB, fontFamily: HAND, fontSize: 29, fontWeight: 900, opacity: fill}}>FILL ✓</div>
          <Stamp x={330} y={560} opacity={result} color={GREEN}>KEEP BOTH</Stamp>
        </div>
      </Card>
    </div>
  );
};

const ConflictScene = ({frame}) => {
  const start = 270;
  const opacity = sceneOpacity(frame, start, 470);
  const local = frame - start;
  const cardsIn = spring({frame: local - 12, fps: FIGMA_SHORT_FPS, config: {damping: 17, stiffness: 115}});
  const question = progress(local, 105, 155);
  return (
    <div style={{position: 'absolute', inset: 0, opacity}}>
      <Tag color={RED} background="#FFDADC">A REAL CONFLICT</Tag>
      <Ink x={60} y={150} size={75} width={950}>SAME SHAPE.<br/><span style={{color: RED}}>SAME PROPERTY.</span></Ink>
      <Card x={60} y={430} width={455} height={760} color={ALICE} background={ALICE_SOFT} rotate={-1} opacity={cardsIn}>
        <Ink x={28} y={25} size={46} color={ALICE}>ALICE</Ink>
        <Shape x={72} y={245} width={260} height={150} color={GREEN} label="GREEN" />
        <Cursor x={240} y={480} name="Alice" color={ALICE} scale={.9} />
        <Ink x={48} y={620} size={31} color={MUTED}>fill = green</Ink>
      </Card>
      <Card x={565} y={430} width={455} height={760} color={BOB} background={BOB_SOFT} rotate={1} opacity={cardsIn}>
        <Ink x={28} y={25} size={46} color={BOB}>BOB</Ink>
        <Shape x={72} y={245} width={260} height={150} color={RED} label="RED" />
        <Cursor x={230} y={480} name="Bob" color={BOB} scale={.9} />
        <Ink x={58} y={620} size={31} color={MUTED}>fill = red</Ink>
      </Card>
      <div style={{position: 'absolute', left: 444, top: 750, width: 190, height: 190, borderRadius: '50%', background: INK, border: `8px solid ${PAPER}`, display: 'grid', placeItems: 'center', color: '#FFE49A', fontFamily: HAND, fontSize: 130, fontWeight: 900, opacity: question, transform: `scale(${.82 + question * .18})`}}>?</div>
    </div>
  );
};

const TransportScene = ({frame}) => {
  const start = 450;
  const opacity = sceneOpacity(frame, start, 700);
  const local = frame - start;
  const first = progress(local, 25, 115);
  const second = progress(local, 75, 170);
  const broken = progress(local, 145, 215);
  return (
    <div style={{position: 'absolute', inset: 0, opacity}}>
      <Tag color={ALICE} background={ALICE_SOFT}>WEBSOCKET ≠ COLLABORATION</Tag>
      <Ink x={60} y={145} size={72} width={950}>MESSAGES CAN<br/><span style={{color: RED}}>ARRIVE OUT OF ORDER.</span></Ink>
      <Card x={70} y={430} width={390} height={300} color={ALICE} background={ALICE_SOFT}>
        <Ink x={28} y={28} size={42} color={ALICE}>ALICE SEES</Ink>
        <Shape x={58} y={125} width={225} height={115} color={RED} label="RED" opacity={broken} />
      </Card>
      <Card x={620} y={430} width={390} height={300} color={BOB} background={BOB_SOFT}>
        <Ink x={28} y={28} size={42} color={BOB}>BOB SEES</Ink>
        <Shape x={58} y={125} width={225} height={115} color={GREEN} label="GREEN" opacity={broken} />
      </Card>
      <Card x={100} y={865} width={350} height={125} color={GREEN} background={GREEN_SOFT} rotate={-2} opacity={first}><Ink x={22} y={30} size={35} color={GREEN}>fill = green</Ink></Card>
      <Card x={630} y={1040} width={350} height={125} color={RED} background="#FFDADC" rotate={2} opacity={second}><Ink x={28} y={30} size={35} color={RED}>fill = red</Ink></Card>
      <Line x1={440} y1={910} x2={720} y2={715} p={first} color={GREEN} dashed />
      <Line x1={650} y1={1095} x2={360} y2={715} p={second} color={RED} dashed />
      <Ink x={175} y={1260} size={54} width={760} align="center" color={RED} opacity={broken}>SAME EDITS ≠ SAME RESULT</Ink>
    </div>
  );
};

const AuthorityScene = ({frame}) => {
  const start = 680;
  const opacity = sceneOpacity(frame, start, 940);
  const local = frame - start;
  const input = progress(local, 20, 95);
  const greenAccepted = progress(local, 75, 135);
  const redAccepted = progress(local, 120, 180);
  const result = progress(local, 175, 230);
  return (
    <div style={{position: 'absolute', inset: 0, opacity}}>
      <Tag color={PURPLE} background={PURPLE_SOFT}>ONE DOCUMENT AUTHORITY</Tag>
      <Ink x={60} y={145} size={76} width={950}>THE SERVER DEFINES<br/><span style={{color: PURPLE}}>ONE ACCEPTED ORDER.</span></Ink>
      <Card x={80} y={430} width={360} height={150} color={GREEN} background={GREEN_SOFT} rotate={-2} opacity={input}><Ink x={28} y={42} size={39} color={GREEN}>fill = green</Ink></Card>
      <Card x={640} y={430} width={360} height={150} color={RED} background="#FFDADC" rotate={2} opacity={input}><Ink x={32} y={42} size={39} color={RED}>fill = red</Ink></Card>
      <Line x1={270} y1={580} x2={455} y2={760} p={input} color={GREEN} />
      <Line x1={810} y1={580} x2={625} y2={760} p={input} color={RED} />
      <Card x={310} y={760} width={460} height={355} color={PURPLE} background={PURPLE_SOFT}>
        <Ink x={58} y={35} size={51} color={PURPLE}>AUTHORITY</Ink>
        <div style={{position: 'absolute', left: 52, top: 140, width: 355, display: 'flex', flexDirection: 'column', gap: 20}}>
          <div style={{padding: 15, border: `4px solid ${GREEN}`, background: WHITE, color: GREEN, fontFamily: HAND, fontSize: 34, fontWeight: 900, opacity: greenAccepted}}>#43 &nbsp; GREEN</div>
          <div style={{padding: 15, border: `4px solid ${RED}`, background: WHITE, color: RED, fontFamily: HAND, fontSize: 34, fontWeight: 900, opacity: redAccepted}}>#44 &nbsp; RED</div>
        </div>
      </Card>
      <Line x1={540} y1={1115} x2={540} y2={1275} p={result} color={PURPLE} width={9} />
      <Shape x={365} y={1280} width={350} height={160} color={RED} label="SHARED: RED" opacity={result} />
    </div>
  );
};

const RuleScene = ({frame}) => {
  const start = 920;
  const opacity = sceneOpacity(frame, start, 1090);
  const local = frame - start;
  const left = progress(local, 5, 70);
  const right = progress(local, 65, 140);
  return (
    <div style={{position: 'absolute', inset: 0, opacity}}>
      <Tag color={GREEN} background={GREEN_SOFT}>THE PROPERTY-LEVEL RULE</Tag>
      <Ink x={60} y={150} size={78} width={950}>WHICH EDITS<br/><span style={{color: GREEN}}>CAN SURVIVE?</span></Ink>
      <Card x={60} y={450} width={455} height={780} color={ALICE} background={ALICE_SOFT} opacity={left} rotate={-1}>
        <Ink x={30} y={32} size={45} color={ALICE}>DIFFERENT</Ink>
        <Ink x={30} y={90} size={37} color={MUTED}>properties</Ink>
        <div style={{position: 'absolute', left: 45, top: 220, width: 340, padding: 20, border: `4px solid ${ALICE}`, background: WHITE, fontFamily: HAND, fontSize: 31, fontWeight: 900, color: ALICE}}>Alice: position</div>
        <div style={{position: 'absolute', left: 45, top: 345, width: 340, padding: 20, border: `4px solid ${BOB}`, background: WHITE, fontFamily: HAND, fontSize: 31, fontWeight: 900, color: BOB}}>Bob: fill</div>
        <Stamp x={83} y={560} color={GREEN}>KEEP BOTH ✓</Stamp>
      </Card>
      <Card x={565} y={450} width={455} height={780} color={RED} background="#FFDADC" opacity={right} rotate={1}>
        <Ink x={30} y={32} size={45} color={RED}>SAME</Ink>
        <Ink x={30} y={90} size={37} color={MUTED}>property</Ink>
        <div style={{position: 'absolute', left: 45, top: 220, width: 340, padding: 20, border: `4px solid ${GREEN}`, background: WHITE, fontFamily: HAND, fontSize: 31, fontWeight: 900, color: GREEN}}>#43 green</div>
        <div style={{position: 'absolute', left: 45, top: 345, width: 340, padding: 20, border: `4px solid ${RED}`, background: WHITE, fontFamily: HAND, fontSize: 31, fontWeight: 900, color: RED}}>#44 red</div>
        <Stamp x={82} y={560} color={RED}>LATER WINS</Stamp>
      </Card>
    </div>
  );
};

const SuspenseScene = ({frame}) => {
  const start = 1070;
  const opacity = sceneOpacity(frame, start, FIGMA_SHORT_FRAMES, 8);
  const local = frame - start;
  const zoom = spring({frame: local, fps: FIGMA_SHORT_FPS, config: {damping: 20, stiffness: 70}});
  const questions = progress(local, 45, 105);
  const cta = progress(local, 95, 145);
  return (
    <div style={{position: 'absolute', inset: 0, opacity, transform: `scale(${interpolate(zoom, [0, 1], [1.12, 1])})`}}>
      <Tag color={PURPLE} background={PURPLE_SOFT}>ZOOMING OUT</Tag>
      <Ink x={55} y={145} size={80} width={970}>AGREEMENT WAS<br/><span style={{color: RED}}>ONLY STEP ONE.</span></Ink>
      <div style={{position: 'absolute', left: 205, top: 465, width: 670, height: 270, borderRadius: '50%', background: INK, color: WHITE, display: 'grid', placeItems: 'center', textAlign: 'center', border: `8px solid ${PAPER}`, boxShadow: '11px 13px 0 rgba(55,48,38,.15)', fontFamily: HAND, fontSize: 61, fontWeight: 900}}>ONE SHARED<br/>ORDER <span style={{color: '#70D6A9'}}>✓</span></div>
      <Line x1={540} y1={735} x2={260} y2={980} p={questions} color={BOB} width={8} />
      <Line x1={540} y1={735} x2={540} y2={1060} p={questions} color={PURPLE} width={8} />
      <Line x1={540} y1={735} x2={820} y2={980} p={questions} color={GREEN} width={8} />
      <Card x={65} y={980} width={330} height={240} color={BOB} background={BOB_SOFT} opacity={questions} rotate={-2}><Ink x={28} y={35} size={43} color={BOB}>INSTANT UI?</Ink><Ink x={28} y={112} size={66} color={INK}>?</Ink></Card>
      <Card x={375} y={1080} width={330} height={240} color={PURPLE} background={PURPLE_SOFT} opacity={questions}><Ink x={28} y={35} size={43} color={PURPLE}>OFFLINE?</Ink><Ink x={28} y={112} size={66} color={INK}>?</Ink></Card>
      <Card x={685} y={980} width={330} height={240} color={GREEN} background={GREEN_SOFT} opacity={questions} rotate={2}><Ink x={25} y={35} size={40} color={GREEN}>CRASH?</Ink><Ink x={28} y={112} size={66} color={INK}>?</Ink></Card>
      <div style={{position: 'absolute', left: 105, right: 155, top: 1390, padding: '26px 30px', border: `5px solid ${INK}`, background: '#FFE49A', boxShadow: '8px 9px 0 rgba(55,48,38,.14)', color: INK, fontFamily: HAND, fontSize: 47, fontWeight: 900, textAlign: 'center', opacity: cta, transform: 'rotate(-1deg)'}}>FULL SYSTEM LINKED BELOW ↓</div>
    </div>
  );
};

export const FigmaMultiplayerShort = ({withMusic = true}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  return (
    <Paper>
      <CompatibleScene frame={frame} />
      <ConflictScene frame={frame} />
      <TransportScene frame={frame} />
      <AuthorityScene frame={frame} />
      <RuleScene frame={frame} />
      <SuspenseScene frame={frame} />
      <Caption frame={frame} />
      <div style={{position: 'absolute', left: 55, bottom: 62, color: MUTED, fontFamily: HAND, fontSize: 25, fontWeight: 900, letterSpacing: 1.2}}>SYSTEMS FROM FIRST PRINCIPLES</div>
      {withMusic ? <Audio
        src={staticFile('audio/music/ambient-bed.wav')}
        loop
        volume={(audioFrame) => interpolate(
          audioFrame,
          [0, 36, durationInFrames - 70, durationInFrames],
          [0, .34, .34, 0],
          {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
        )}
      /> : null}
    </Paper>
  );
};
