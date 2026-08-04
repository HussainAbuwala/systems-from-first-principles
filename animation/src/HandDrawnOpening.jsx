import React from 'react';
import {AbsoluteFill, interpolate, interpolateColors, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {OPENING_AUDIO_TIMELINE, OPENING_VOICE_FRAMES} from './audioTimeline.js';

const NOTEBOOK_BASE_FRAMES = 90 * 24;
const TRANSPORT_SCENE_FRAMES = 18 * 24;
const NOTEBOOK_OPENING_FRAMES = NOTEBOOK_BASE_FRAMES + TRANSPORT_SCENE_FRAMES;
const PRODUCT_INTRO_FRAMES = 26 * 24;
const INTRO_CROSSFADE_FRAMES = 36;
const LEGACY_OPENING_FRAMES = NOTEBOOK_OPENING_FRAMES + PRODUCT_INTRO_FRAMES - INTRO_CROSSFADE_FRAMES;
export const HAND_DRAWN_OPENING_FRAMES = OPENING_VOICE_FRAMES;

const LEGACY_SEGMENT_BOUNDARIES = [0, PRODUCT_INTRO_FRAMES - INTRO_CROSSFADE_FRAMES, 973, 1363, 1793, 2748, LEGACY_OPENING_FRAMES];

const mapOpeningFrame = (actualFrame) => {
  const index = Math.min(
    OPENING_AUDIO_TIMELINE.length - 1,
    Math.max(0, OPENING_AUDIO_TIMELINE.findIndex((take) => actualFrame < take.from + take.segmentFrames)),
  );
  const take = OPENING_AUDIO_TIMELINE[index];
  const amount = Math.max(0, Math.min(1, (actualFrame - take.from) / Math.max(1, take.segmentFrames - 1)));
  return interpolate(amount, [0, 1], [LEGACY_SEGMENT_BOUNDARIES[index], LEGACY_SEGMENT_BOUNDARIES[index + 1]]);
};

export const PAPER = '#F5F0E2';
export const INK = '#27231F';
export const MUTED = '#746B5B';
export const ALICE = '#4285FF';
export const ALICE_SOFT = '#DDE9FF';
export const BOB = '#FF65A3';
export const BOB_SOFT = '#FFE0EC';
export const RED = '#FF5C63';
export const GREEN = '#20946B';
export const GREEN_SOFT = '#DDF3E8';
export const PURPLE = '#7659D7';
export const YELLOW = '#FFE49A';
export const HAND = 'Chalkboard, "Bradley Hand", cursive';

const clamp = (value) => Math.max(0, Math.min(1, value));
export const progress = (frame, start, end) => clamp(interpolate(frame, [start, end], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));

export const InkText = ({children, x, y, size = 28, color = INK, rotate = 0, opacity = 1, width, align = 'left', style = {}}) => (
  <div style={{position: 'absolute', left: x, top: y, width, color, opacity, transform: `rotate(${rotate}deg)`, transformOrigin: 'left center', fontFamily: HAND, fontSize: size, lineHeight: 1.22, fontWeight: 800, textAlign: align, ...style}}>{children}</div>
);

export const DrawLine = ({x1, y1, x2, y2, p, color = INK, width = 4, dashed = false, arrow = false}) => {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  return (
    <>
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width="5500" height="900">
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
          strokeDasharray={dashed ? '12 10' : length}
          strokeDashoffset={dashed ? 0 : length * (1 - p)}
          opacity={p}
        />
      </svg>
      {arrow && p > 0.82 ? (
        <div style={{position: 'absolute', left: x2 - 9, top: y2 - 10, width: 0, height: 0, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderLeft: `18px solid ${color}`, transform: `rotate(${angle}rad)`, transformOrigin: '9px 10px', opacity: progress(p, 0.82, 1)}} />
      ) : null}
    </>
  );
};

export const Sticky = ({x, y, width = 260, height = 160, color = YELLOW, title, children, rotate = 0, opacity = 1, border = INK}) => (
  <div style={{position: 'absolute', left: x, top: y, width, height, padding: 20, boxSizing: 'border-box', background: color, border: `3px solid ${border}`, boxShadow: '7px 8px 0 rgba(65,57,45,.16)', transform: `rotate(${rotate}deg)`, opacity}}>
    {title ? <div style={{fontFamily: HAND, fontSize: 25, fontWeight: 900, color: INK}}>{title}</div> : null}
    <div style={{fontFamily: HAND, fontSize: 18, lineHeight: 1.42, color: '#403A32', marginTop: title ? 10 : 0}}>{children}</div>
  </div>
);

export const DoodleCanvas = ({x, y, owner, color, soft, shapeX = 82, shapeColor = color, shapeLabel = 'Checkout', cursorX = 240, cursorY = 175, opacity = 1}) => (
  <div style={{position: 'absolute', left: x, top: y, width: 420, height: 300, background: '#FFFDF7', border: `4px solid ${INK}`, boxShadow: '8px 9px 0 rgba(55,48,38,.13)', transform: 'rotate(-.4deg)', opacity}}>
    <div style={{height: 47, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `3px solid ${INK}`, background: soft}}>
      <span style={{fontFamily: HAND, fontSize: 21, fontWeight: 900, color: INK}}>{owner}</span>
      <span style={{fontFamily: HAND, fontSize: 15, fontWeight: 800, color}}>editing</span>
    </div>
    <div style={{position: 'absolute', inset: '50px 0 0', backgroundImage: 'radial-gradient(#D8CDB7 1px, transparent 1px)', backgroundSize: '21px 21px'}}>
      <div style={{position: 'absolute', left: shapeX, top: 83, width: 145, height: 76, borderRadius: 12, background: shapeColor, border: `3px solid ${INK}`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: HAND, fontSize: 18, fontWeight: 900, boxShadow: '4px 5px 0 rgba(45,40,34,.16)'}}>{shapeLabel}</div>
      <div style={{position: 'absolute', left: cursorX, top: cursorY, color, fontSize: 31, transform: 'rotate(-20deg)'}}>➤</div>
    </div>
  </div>
);

export const Pill = ({x, y, children, color, background = '#FFFDF7', opacity = 1, rotate = 0}) => (
  <div style={{position: 'absolute', left: x, top: y, padding: '7px 12px', borderRadius: 999, border: `3px solid ${color}`, background, color, fontFamily: HAND, fontSize: 17, fontWeight: 900, transform: `rotate(${rotate}deg)`, opacity}}>{children}</div>
);

export const Cross = ({x, y, width, height, p, color = RED}) => (
  <>
    <DrawLine x1={x} y1={y} x2={x + width} y2={y + height} p={p} color={color} width={8} />
    <DrawLine x1={x + width} y1={y} x2={x} y2={y + height} p={p} color={color} width={8} />
  </>
);

export const SceneTitle = ({x, eyebrow, title, width = 1050}) => (
  <>
    <InkText x={x} y={28} size={18} color={MUTED} style={{letterSpacing: 2}}>{eyebrow}</InkText>
    <InkText x={x} y={56} size={42} width={width}>{title}</InkText>
  </>
);

const UI_FONT = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const FigmaCursor = ({x, y, name, color, opacity = 1, scale = 1}) => (
  <div style={{position: 'absolute', left: x, top: y, opacity, transform: `scale(${scale})`, transformOrigin: 'top left', zIndex: 20}}>
    <div style={{fontSize: 34, lineHeight: 1, color, transform: 'rotate(-22deg)', filter: 'drop-shadow(0 2px 1px rgba(0,0,0,.2))'}}>➤</div>
    <div style={{position: 'absolute', left: 21, top: 25, padding: '5px 9px', borderRadius: 5, background: color, color: 'white', fontFamily: UI_FONT, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 3px 9px rgba(0,0,0,.18)'}}>{name}</div>
  </div>
);

const SelectionHandle = ({left, top}) => (
  <div style={{position: 'absolute', left, top, width: 8, height: 8, border: '2px solid #0D99FF', background: 'white', transform: 'translate(-50%, -50%)'}} />
);

const FigmaLiveDemo = ({frame}) => {
  const appIn = spring({frame, fps: 24, config: {damping: 18, stiffness: 95}});
  const move = progress(frame, 55, 170);
  const bobMove = progress(frame, 75, 150);
  const fill = progress(frame, 165, 245);
  const synced = progress(frame, 225, 275);
  const question = progress(frame, 315, 410);
  const method = progress(frame, 420, 555);
  const questionOpacity = question * (1 - progress(frame, 405, 450));
  const activityOpacity = synced * (1 - progress(frame, 292, 335));
  const cursorFade = 1 - progress(frame, 285, 335);
  const shapeLeft = interpolate(move, [0, 1], [260, 145]);
  const shapeColor = interpolateColors(fill, [0, 1], ['#5B8FF9', '#F28B38']);
  const aliceX = 310 + shapeLeft + 140;
  const bobX = interpolate(bobMove, [0, 1], [865, 1120]);
  const bobY = interpolate(bobMove, [0, 1], [435, 291]);
  const pulse = 1 + Math.sin(frame / 6) * 0.035;
  const overlayIn = Math.max(question, method);

  return (
    <AbsoluteFill style={{background: '#202124', fontFamily: UI_FONT, opacity: appIn}}>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${interpolate(appIn, [0, 1], [.975, 1])})`, transformOrigin: 'center'}}>
        <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 52, background: '#2C2C2C', color: '#F5F5F5', display: 'flex', alignItems: 'center', boxShadow: '0 1px 0 rgba(0,0,0,.45)', zIndex: 10}}>
          <div style={{width: 230, height: '100%', display: 'flex', alignItems: 'center', gap: 13, paddingLeft: 18, boxSizing: 'border-box'}}>
            <div style={{width: 25, height: 30, position: 'relative'}}>
              <span style={{position: 'absolute', left: 0, top: 0, width: 12, height: 12, borderRadius: '7px 0 0 7px', background: '#F24E1E'}} />
              <span style={{position: 'absolute', left: 12, top: 0, width: 12, height: 12, borderRadius: '0 7px 7px 0', background: '#FF7262'}} />
              <span style={{position: 'absolute', left: 0, top: 12, width: 12, height: 12, borderRadius: '7px 0 0 7px', background: '#A259FF'}} />
              <span style={{position: 'absolute', left: 12, top: 12, width: 12, height: 12, borderRadius: '50%', background: '#1ABCFE'}} />
              <span style={{position: 'absolute', left: 0, top: 24, width: 12, height: 12, borderRadius: '7px 0 7px 7px', background: '#0ACF83'}} />
            </div>
            <span style={{fontSize: 14, fontWeight: 650}}>Checkout flow</span>
          </div>
          <div style={{position: 'absolute', left: 500, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 8px', borderRadius: 7, background: '#383838'}}>
            {['↖', '□', '○', 'T', '✎'].map((item, index) => <span key={item} style={{width: 34, height: 30, borderRadius: 5, display: 'grid', placeItems: 'center', background: index === 0 ? '#0D99FF' : 'transparent', fontSize: index === 3 ? 15 : 18}}>{item}</span>)}
          </div>
          <div style={{position: 'absolute', right: 18, display: 'flex', alignItems: 'center'}}>
            <div style={{width: 30, height: 30, borderRadius: '50%', background: ALICE, border: '2px solid #2C2C2C', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800}}>A</div>
            <div style={{width: 30, height: 30, marginLeft: -7, borderRadius: '50%', background: BOB, border: '2px solid #2C2C2C', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800}}>B</div>
            <div style={{marginLeft: 12, padding: '7px 12px', borderRadius: 7, background: '#0D99FF', fontSize: 13, fontWeight: 700}}>Share</div>
          </div>
        </div>

        <div style={{position: 'absolute', left: 0, top: 52, bottom: 0, width: 230, background: '#FFFFFF', borderRight: '1px solid #D8D8D8', color: '#333'}}>
          <div style={{height: 43, display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid #E7E7E7', fontSize: 12, fontWeight: 700}}>Layers <span style={{marginLeft: 'auto', color: '#888'}}>Assets</span></div>
          <div style={{padding: '14px 8px', fontSize: 12}}>
            <div style={{padding: '8px 10px', color: '#777'}}>⌄ &nbsp; Checkout</div>
            <div style={{padding: '8px 10px 8px 30px', color: '#777'}}>▧ &nbsp; Product card</div>
            <div style={{padding: '8px 10px 8px 48px', background: '#E5F4FF', color: '#111', borderRadius: 4}}>◇ &nbsp; Buy button</div>
            <div style={{padding: '8px 10px 8px 48px', color: '#777'}}>T &nbsp; Pay now</div>
          </div>
        </div>

        <div style={{position: 'absolute', left: 230, right: 270, top: 52, bottom: 0, background: '#E6E6E6', overflow: 'hidden'}}>
          <div style={{position: 'absolute', left: 80, top: 70, width: 700, height: 485, background: '#FFFFFF', boxShadow: '0 2px 18px rgba(0,0,0,.14)'}}>
            <div style={{position: 'absolute', left: 55, top: 46, color: '#222', fontSize: 25, fontWeight: 760}}>Everything you need.</div>
            <div style={{position: 'absolute', left: 55, top: 84, color: '#777', fontSize: 13}}>A collaborative checkout concept</div>
            <div style={{position: 'absolute', left: 55, top: 130, width: 590, height: 225, borderRadius: 18, background: '#F6F3EE'}}>
              <div style={{position: 'absolute', left: 35, top: 35, width: 145, height: 145, borderRadius: 14, background: 'linear-gradient(145deg,#FFE29D,#F5A9A9)'}} />
              <div style={{position: 'absolute', left: 215, top: 45, fontSize: 18, fontWeight: 750, color: '#222'}}>Orbit desk lamp</div>
              <div style={{position: 'absolute', left: 215, top: 80, width: 245, color: '#777', fontSize: 13, lineHeight: 1.5}}>Warm light, compact profile, and one very optimistic checkout flow.</div>
              <div style={{position: 'absolute', left: 215, top: 135, color: '#222', fontSize: 19, fontWeight: 780}}>$89</div>
            </div>
            <div style={{position: 'absolute', left: shapeLeft, top: 385, width: 170, height: 58, borderRadius: 10, background: shapeColor, color: 'white', display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 760, boxShadow: '0 5px 14px rgba(61,74,98,.22)'}}>Pay now</div>
            <div style={{position: 'absolute', left: shapeLeft - 3, top: 382, width: 176, height: 64, border: '2px solid #0D99FF', boxSizing: 'border-box'}}>
              <SelectionHandle left={0} top={0} /><SelectionHandle left="100%" top={0} /><SelectionHandle left={0} top="100%" /><SelectionHandle left="100%" top="100%" />
            </div>
          </div>
          <div style={{position: 'absolute', left: 99, top: 565, display: 'flex', gap: 8, opacity: activityOpacity}}>
            <div style={{padding: '7px 11px', borderRadius: 7, background: '#FFFFFF', boxShadow: '0 3px 12px rgba(0,0,0,.14)', color: '#555', fontSize: 12}}><b style={{color: ALICE}}>Alice</b> moved Buy button</div>
            <div style={{padding: '7px 11px', borderRadius: 7, background: '#FFFFFF', boxShadow: '0 3px 12px rgba(0,0,0,.14)', color: '#555', fontSize: 12}}><b style={{color: BOB}}>Bob</b> changed Fill</div>
            <div style={{padding: '7px 11px', borderRadius: 7, background: '#E4F8ED', color: '#167A50', fontSize: 12, fontWeight: 750, transform: `scale(${pulse})`}}>● Live · synced</div>
          </div>
        </div>

        <div style={{position: 'absolute', right: 0, top: 52, bottom: 0, width: 270, background: '#FFFFFF', borderLeft: '1px solid #D8D8D8', color: '#333'}}>
          <div style={{height: 43, display: 'flex', alignItems: 'center', gap: 24, padding: '0 16px', borderBottom: '1px solid #E7E7E7', fontSize: 12, fontWeight: 700}}><span style={{color: '#0D99FF'}}>Design</span><span>Prototype</span></div>
          <div style={{padding: 16, fontSize: 12}}>
            <div style={{fontWeight: 700, marginBottom: 13}}>Frame</div>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20}}><span style={{padding: 8, background: '#F4F4F4', borderRadius: 5}}>X&nbsp;&nbsp; {Math.round(260 - move * 115)}</span><span style={{padding: 8, background: '#F4F4F4', borderRadius: 5}}>Y&nbsp;&nbsp; 385</span></div>
            <div style={{height: 1, background: '#E6E6E6', margin: '0 -16px 17px'}} />
            <div style={{fontWeight: 700, marginBottom: 12}}>Fill</div>
            <div style={{height: 38, border: '1px solid #DDD', borderRadius: 6, display: 'flex', alignItems: 'center', padding: '0 9px', gap: 9}}><span style={{width: 20, height: 20, borderRadius: 4, background: shapeColor}} /><span style={{fontFamily: 'ui-monospace, monospace'}}>{fill > .55 ? 'F28B38' : '5B8FF9'}</span><span style={{marginLeft: 'auto', color: '#888'}}>100%</span></div>
            <div style={{height: 1, background: '#E6E6E6', margin: '18px -16px'}} />
            <div style={{fontWeight: 700, marginBottom: 12}}>Corner radius</div>
            <div style={{padding: 9, background: '#F4F4F4', borderRadius: 5}}>⌜&nbsp;&nbsp;10</div>
          </div>
        </div>

        <FigmaCursor x={aliceX} y={545} name="Alice" color={ALICE} opacity={progress(frame, 28, 65) * cursorFade} />
        <FigmaCursor x={bobX} y={bobY} name="Bob" color={BOB} opacity={progress(frame, 75, 125) * cursorFade} />

        <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 220, background: `linear-gradient(0deg, rgba(20,20,24,${.91 * overlayIn}), rgba(20,20,24,0))`, pointerEvents: 'none'}} />
        <div style={{position: 'absolute', left: 250, right: 290, bottom: 50, textAlign: 'center', color: 'white', opacity: questionOpacity}}>
          <div style={{fontSize: 37, lineHeight: 1.16, fontWeight: 820}}>But when edits cross on the network,<br/>what is the document?</div>
        </div>
        <div style={{position: 'absolute', left: 255, right: 290, bottom: 46, color: 'white', opacity: method}}>
          <div style={{textAlign: 'center', fontSize: 15, letterSpacing: 3, fontWeight: 800, color: '#FFDA79'}}>BUILDING FROM FIRST PRINCIPLES</div>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 14}}>
            {['Simplest design', 'Watch it fail', 'Add the next piece'].map((label, index) => <React.Fragment key={label}><div style={{padding: '12px 17px', borderRadius: 9, background: index === 1 ? '#49272A' : '#263C34', border: `1px solid ${index === 1 ? '#FF7A82' : '#5DD39E'}`, fontSize: 17, fontWeight: 760}}>{label}</div>{index < 2 ? <span style={{fontSize: 25, color: '#BDBDBD'}}>→</span> : null}</React.Fragment>)}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const FigmaHandDrawnOpening = () => {
  const actualFrame = useCurrentFrame();
  const rawFrame = mapOpeningFrame(actualFrame);
  const {fps} = useVideoConfig();
  const notebookStart = PRODUCT_INTRO_FRAMES - INTRO_CROSSFADE_FRAMES;
  const notebookOpacity = progress(rawFrame, notebookStart, PRODUCT_INTRO_FRAMES);
  const productOpacity = 1 - notebookOpacity;
  const frame = Math.max(0, rawFrame - notebookStart);

  const cameraX = interpolate(
    frame,
    [0, 290, 385, 680, 775, 1110, 1205, 1850, 2060, NOTEBOOK_BASE_FRAMES, NOTEBOOK_OPENING_FRAMES],
    [0, 0, 1300, 1300, 2600, 2600, 3900, 3900, 4500, 5800, 5800],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );
  const cameraScale = 1;

  const hook = frame;
  const promise = frame - 385;
  const simple = frame - 775;
  const overwrite = frame - 1205;
  const transport = frame - NOTEBOOK_BASE_FRAMES;

  const hookEntry = spring({frame: hook, fps, config: {damping: 16, stiffness: 105}});
  const compatible = progress(hook, 75, 170);
  const conflict = progress(hook, 175, 255);
  const aliceHookX = interpolate(progress(hook, 55, 145), [0, 1], [88, 40]);

  const pathDraw = progress(promise, 25, 180);
  const evidenceIn = spring({frame: promise - 155, fps, config: {damping: 18, stiffness: 95}});

  const simpleDownload = progress(simple, 55, 155);
  const simpleEdit = progress(simple, 145, 230);
  const simpleUpload = progress(simple, 225, 320);

  const branch = progress(overwrite, 35, 150);
  const aliceSave = progress(overwrite, 170, 310);
  const bobSave = progress(overwrite, 320, 475);
  const lost = progress(overwrite, 475, 590);
  const fixHint = progress(overwrite, 650, 825);

  const transportEntry = progress(frame, 2060, NOTEBOOK_BASE_FRAMES);
  const wholeFileOut = progress(transport, 5, 70);
  const socketOpen = progress(transport, 55, 120);
  const aliceTransport = progress(transport, 105, 230);
  const bobTransport = progress(transport, 165, 290);
  const transportCombined = progress(transport, 270, 340);
  const transportQuestion = progress(transport, 335, 410);

  return (
    <AbsoluteFill style={{background: '#202124', overflow: 'hidden'}}>
      <AbsoluteFill style={{opacity: productOpacity}}>
        <FigmaLiveDemo frame={rawFrame} />
      </AbsoluteFill>
      <AbsoluteFill style={{background: PAPER, overflow: 'hidden', opacity: notebookOpacity}}>
      <div style={{position: 'absolute', inset: 0, opacity: 0.52, backgroundImage: 'radial-gradient(#C8BDA6 1px, transparent 1px)', backgroundSize: '22px 22px'}} />
      <div style={{position: 'absolute', left: 0, top: 0, width: 7200, height: 900, transform: `translateX(${-cameraX}px) scale(${cameraScale})`, transformOrigin: 'top left'}}>

        {/* Scene 1: conflict hook */}
        <div style={{position: 'absolute', inset: 0, opacity: frame < 385 ? 1 : 0}}>
        <SceneTitle x={48} eyebrow="THE UNPLANNED STACK" title="Two people. One rectangle. Who wins?" />
        <DoodleCanvas x={45} y={155} owner="Alice" color={ALICE} soft={ALICE_SOFT} shapeX={aliceHookX} shapeColor={conflict > 0.25 ? GREEN : ALICE} cursorX={200 - compatible * 45} cursorY={165} opacity={hookEntry} />
        <DoodleCanvas x={815} y={155} owner="Bob" color={BOB} soft={BOB_SOFT} shapeX={88} shapeColor={conflict > 0.25 ? RED : compatible > 0.3 ? '#F18C35' : BOB} cursorX={38} cursorY={165} opacity={hookEntry} />
        <DrawLine x1={465} y1={305} x2={815} y2={305} p={compatible} color={MUTED} width={3} dashed />
        {conflict < 0.25 ? (
          <>
            <Pill x={475} y={235} color={ALICE} opacity={compatible} rotate={-2}>position = left</Pill>
            <Pill x={625} y={338} color={BOB} opacity={compatible} rotate={2}>fill = orange</Pill>
            <InkText x={515} y={420} size={26} color={GREEN} opacity={compatible}>different properties → keep both ✓</InkText>
          </>
        ) : (
          <>
            <Pill x={475} y={235} color={GREEN} opacity={conflict} rotate={-2}>fill = green</Pill>
            <Pill x={645} y={338} color={RED} opacity={conflict} rotate={2}>fill = red</Pill>
            <InkText x={520} y={420} size={30} color={RED} opacity={conflict}>same property → real conflict</InkText>
          </>
        )}
        <InkText x={438} y={500} size={54} color={RED} rotate={-2} opacity={progress(hook, 235, 285)}>WHO DECIDES?</InkText>
        <DrawLine x1={433} y1={565} x2={820} y2={565} p={progress(hook, 240, 285)} color={RED} width={7} />
        </div>

        {/* Scene 2: promise and evidence */}
        <div style={{position: 'absolute', inset: 0, opacity: frame >= 300 && frame < 775 ? 1 : 0}}>
        <SceneTitle x={1360} eyebrow="OUR METHOD" title="Build it. Break it. Add only what the failure demands." width={760} />
        {[
          {x: 1390, n: '1', label: 'simplest design', color: YELLOW},
          {x: 1660, n: '2', label: 'failure appears', color: '#FFD9DC'},
          {x: 1930, n: '3', label: 'smallest fix', color: GREEN_SOFT},
        ].map((step, index) => (
          <React.Fragment key={step.n}>
            <Sticky x={step.x} y={235} width={215} height={150} color={step.color} title={`${step.n}. ${step.label}`} opacity={pathDraw > index * 0.27 ? 1 : 0.2} rotate={index === 1 ? 1.5 : -1}>
              {index === 0 ? 'Make the first reasonable choice.' : index === 1 ? 'Apply one more real requirement.' : 'Pay for complexity only when needed.'}
            </Sticky>
            {index < 2 ? <DrawLine x1={step.x + 215} y1={310} x2={step.x + 265} y2={310} p={progress(pathDraw, index * 0.28, index * 0.28 + 0.3)} color={PURPLE} width={5} arrow /> : null}
          </React.Fragment>
        ))}
        <div style={{position: 'absolute', left: 2155, top: 180, width: 365, padding: 24, background: '#FFFDF8', border: `3px solid ${INK}`, boxShadow: '9px 10px 0 rgba(60,52,42,.16)', transform: `translateY(${interpolate(evidenceIn, [0, 1], [55, 0])}px) rotate(1deg)`, opacity: evidenceIn}}>
          <div style={{fontFamily: HAND, fontSize: 17, fontWeight: 900, color: PURPLE, letterSpacing: 1}}>PUBLIC ENGINEERING EVIDENCE</div>
          <div style={{fontFamily: HAND, fontSize: 27, lineHeight: 1.28, fontWeight: 900, color: INK, marginTop: 14}}>Figma engineering posts</div>
          <div style={{fontFamily: HAND, fontSize: 21, color: MUTED, marginTop: 8}}>Historical snapshots • 2016–2022</div>
          <div style={{display: 'flex', gap: 8, marginTop: 20}}>
            <span style={{padding: '6px 9px', background: GREEN_SOFT, color: GREEN, fontFamily: HAND, fontWeight: 900}}>DOCUMENTED</span>
            <span style={{padding: '6px 9px', background: '#EEE7FF', color: PURPLE, fontFamily: HAND, fontWeight: 900}}>TEACHING MODEL</span>
          </div>
        </div>
        <InkText x={1470} y={470} size={27} color={MUTED} width={850} align="center" opacity={pathDraw}>We’ll reconstruct the decisions—not pretend we know Figma’s private architecture today.</InkText>
        </div>

        {/* Scene 3: simplest save model */}
        <div style={{position: 'absolute', inset: 0, opacity: frame >= 680 && frame < 1205 ? 1 : 0}}>
        <SceneTitle x={2650} eyebrow="LEVEL 0 / ONE EDITOR" title="Start with the simplest save model." />
        <DoodleCanvas x={2665} y={180} owner="Alice" color={ALICE} soft={ALICE_SOFT} shapeX={80 + simpleEdit * 95} cursorX={205 + simpleEdit * 70} cursorY={160} />
        <Sticky x={3515} y={235} width={265} height={185} color={YELLOW} title={simpleUpload > 0.75 ? 'document v2' : 'document v1'} rotate={1}>
          complete file<br/>
          {simpleUpload > 0.75 ? 'rectangle moved' : 'shared starting state'}
        </Sticky>
        <DrawLine x1={3515} y1={285} x2={3090} y2={285} p={simpleDownload} color={PURPLE} width={5} arrow />
        <Pill x={3240} y={235} color={PURPLE} opacity={simpleDownload}>download full file</Pill>
        <DrawLine x1={3090} y1={385} x2={3515} y2={385} p={simpleUpload} color={ALICE} width={5} arrow />
        <Pill x={3232} y={398} color={ALICE} opacity={simpleUpload}>upload full file</Pill>
        <InkText x={2930} y={520} size={38} color={GREEN} opacity={progress(simple, 270, 330)}>Simple. Understandable. Works beautifully—with one editor. ✓</InkText>
        </div>

        {/* Scene 4: overwrite failure */}
        <div style={{position: 'absolute', inset: 0, opacity: frame >= 1110 && frame < NOTEBOOK_BASE_FRAMES ? 1 : 0}}>
        <SceneTitle x={3950} eyebrow="ONE NEW REQUIREMENT" title="Now Bob opens the same document." />
        <Sticky x={4380} y={115} width={270} height={140} color={YELLOW} title="document v1" opacity={branch} rotate={-1}>shared starting point</Sticky>
        <DrawLine x1={4440} y1={255} x2={4140} y2={335} p={branch} color={ALICE} width={5} arrow />
        <DrawLine x1={4590} y1={255} x2={4890} y2={335} p={branch} color={BOB} width={5} arrow />
        <Sticky x={3955} y={325} width={300} height={165} color={ALICE_SOFT} title="Alice’s v2-A" opacity={branch} rotate={-1.5}>rectangle moved<br/>x = 200</Sticky>
        <Sticky x={4830} y={325} width={300} height={165} color={BOB_SOFT} title="Bob’s v2-B" opacity={branch} rotate={1.5}>label changed<br/>still has x = 100</Sticky>
        <DrawLine x1={4255} y1={420} x2={4450} y2={565} p={aliceSave} color={ALICE} width={5} arrow />
        <InkText x={4120} y={505} size={22} color={ALICE} opacity={aliceSave}>Alice saves first</InkText>
        <DrawLine x1={4830} y1={420} x2={4650} y2={565} p={bobSave} color={BOB} width={5} arrow />
        <InkText x={4760} y={505} size={22} color={BOB} opacity={bobSave}>Bob saves later</InkText>
        <Sticky x={4390} y={530} width={310} height={135} color={lost > 0.25 ? '#FFD7DA' : aliceSave > 0.6 ? ALICE_SOFT : YELLOW} title={lost > 0.25 ? 'stored v2-B' : aliceSave > 0.6 ? 'stored v2-A' : 'stored v1'} border={lost > 0.25 ? RED : INK}>
          {lost > 0.25 ? 'label changed • Alice’s movement absent' : aliceSave > 0.6 ? 'rectangle moved' : 'starting snapshot'}
        </Sticky>
        <Cross x={3950} y={320} width={310} height={180} p={lost} />
        <InkText x={4245} y={275} size={48} color={RED} rotate={-2} opacity={lost}>SILENT OVERWRITE</InkText>

        {fixHint > 0.08 ? (
          <div style={{position: 'absolute', left: 5280, top: 120, width: 410, height: 520, padding: 26, boxSizing: 'border-box', background: '#25221E', color: '#FFF9EA', border: `4px solid ${INK}`, boxShadow: '9px 10px 0 rgba(55,48,39,.17)', transform: `translateX(${interpolate(fixHint, [0, 1], [110, 0])}px) rotate(.6deg)`, opacity: fixHint}}>
            <div style={{fontFamily: HAND, color: '#FFCB58', fontSize: 18, fontWeight: 900, letterSpacing: 1}}>THE FAILURE TELLS US WHAT TO CHANGE</div>
            <div style={{fontFamily: HAND, fontSize: 36, lineHeight: 1.25, fontWeight: 900, marginTop: 22}}>Stop replacing the whole document.</div>
            <div style={{marginTop: 34, padding: 18, background: '#353027', border: '2px solid #FFF9EA'}}>
              <div style={{fontFamily: HAND, fontSize: 17, color: '#BDB5A4'}}>Instead, send:</div>
              <div style={{fontFamily: HAND, fontSize: 24, color: '#7FADFF', fontWeight: 900, marginTop: 12}}>shape-7.position = 200</div>
              <div style={{fontFamily: HAND, fontSize: 24, color: '#FF86B8', fontWeight: 900, marginTop: 10}}>shape-7.label = “Pay now”</div>
            </div>
            <div style={{fontFamily: HAND, fontSize: 25, lineHeight: 1.35, marginTop: 28, color: '#D8D0BF'}}>Send changes—not snapshots.</div>
          </div>
        ) : null}
        </div>

        {/* Scene 5: persistent transport and small edit packets */}
        <div style={{position: 'absolute', inset: 0, opacity: frame >= 2060 ? transportEntry : 0}}>
        <SceneTitle x={5850} eyebrow="THE FIRST IMPROVEMENT" title="Keep the connection open. Send the change." width={1050} />

        <DoodleCanvas
          x={5840}
          y={170}
          owner="Alice"
          color={ALICE}
          soft={ALICE_SOFT}
          shapeX={82 - 42 * progress(transport, 70, 125)}
          shapeColor={bobTransport > .82 ? '#F18C35' : ALICE}
          cursorX={205 - 42 * progress(transport, 70, 125)}
          cursorY={165}
        />
        <DoodleCanvas
          x={6640}
          y={170}
          owner="Bob"
          color={BOB}
          soft={BOB_SOFT}
          shapeX={82 - 42 * progress(aliceTransport, .72, .96)}
          shapeColor={progress(transport, 125, 180) > .35 ? '#F18C35' : ALICE}
          cursorX={38}
          cursorY={165}
        />

        <div style={{position: 'absolute', left: 6290, top: 170, width: 220, height: 115, padding: 16, boxSizing: 'border-box', background: YELLOW, border: `3px solid ${INK}`, boxShadow: '6px 7px 0 rgba(55,48,38,.13)', opacity: 1 - wholeFileOut, transform: 'rotate(-1deg)'}}>
          <div style={{fontFamily: HAND, fontSize: 16, color: MUTED}}>old transfer</div>
          <div style={{fontFamily: HAND, fontSize: 22, fontWeight: 900, color: INK, marginTop: 8}}>complete document v2</div>
          <Cross x={0} y={0} width={220} height={115} p={wholeFileOut} color={RED} />
        </div>

        <Pill x={6278} y={174} color={PURPLE} background="#EEE7FF" opacity={socketOpen}>WebSocket stays open</Pill>
        <DrawLine x1={6260} y1={322} x2={6640} y2={322} p={socketOpen} color={PURPLE} width={5} dashed />
        <DrawLine x1={6640} y1={385} x2={6260} y2={385} p={socketOpen} color={PURPLE} width={5} dashed />

        <div style={{position: 'absolute', left: interpolate(aliceTransport, [0, 1], [6100, 6485]), top: 292, padding: '9px 12px', border: `3px solid ${ALICE}`, background: '#FFFDF7', color: ALICE, fontFamily: HAND, fontSize: 18, fontWeight: 900, opacity: aliceTransport, whiteSpace: 'nowrap', boxShadow: '4px 5px 0 rgba(55,48,38,.1)'}}>shape-7.position = left</div>
        <div style={{position: 'absolute', left: interpolate(bobTransport, [0, 1], [6600, 6175]), top: 355, padding: '9px 12px', border: `3px solid ${BOB}`, background: '#FFFDF7', color: BOB, fontFamily: HAND, fontSize: 18, fontWeight: 900, opacity: bobTransport, whiteSpace: 'nowrap', boxShadow: '4px 5px 0 rgba(55,48,38,.1)'}}>shape-7.fill = orange</div>

        <InkText x={6138} y={505} size={29} color={GREEN} opacity={transportCombined}>Both clients keep position + fill ✓</InkText>
        <InkText x={6035} y={555} size={25} color={MUTED} opacity={transportQuestion}>Faster transport—but will every client apply conflicting packets in the same order?</InkText>
        </div>
      </div>

      <div style={{position: 'absolute', left: 38, bottom: 26, fontFamily: HAND, fontSize: 17, color: MUTED}}>SYSTEMS FROM FIRST PRINCIPLES • HAND-DRAWN PRODUCTION TEST</div>
      <div style={{position: 'absolute', right: 38, bottom: 26, fontFamily: HAND, fontSize: 17, color: MUTED}}>{Math.min(100, Math.round((actualFrame / HAND_DRAWN_OPENING_FRAMES) * 100))}%</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
