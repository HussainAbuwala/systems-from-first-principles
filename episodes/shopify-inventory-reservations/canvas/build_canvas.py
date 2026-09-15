"""Generate the editable canvas, offline presenter, and aligned recording script.
Run: python3 episodes/shopify-inventory-reservations/canvas/build_canvas.py
Standard library only. Edit scene content below, then regenerate all three outputs.
"""
from pathlib import Path
import json, html, random
ROOT = Path(__file__).resolve().parent
INK='#263442'; BLUE='#2463a0'; ORANGE='#ab571c'; RED='#b13c41'; GREEN='#317156'; MUTED='#687583'
PAPER='#fcfbf7'; PALE='#eef3f7'
rng=random.Random(42)
scenes=[]; elements=[]
# Standard Helvetica advance widths (1/1000 em), matching fontFamily 2.
# Use metric-based bounds instead of a character-count estimate that clips long labels.
ADV = dict(zip('ABCDEFGHIJKLMNOPQRSTUVWXYZ', [667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611]))
ADV.update(zip('abcdefghijklmnopqrstuvwxyz', [556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500]))
ADV.update({c:556 for c in '0123456789'})
ADV.update({' ':278,'.':278,',':278,':':278,';':278,'!':278,'?':556,'/':278,'-':333,'+':584,'=':584,'>':584,'<':584,'(':333,')':333,"'":191,'’':222,'—':1000,'·':278,'≠':584})
def text_width(line, size):
    return sum(ADV.get(c,667) for c in line)*size/1000+2


def scene(title, question, narration, cue, checkpoint=False, appendix=False):
    n=len(scenes)+1
    s=dict(n=n,title=title,question=question,narration=narration,cue=cue,checkpoint=checkpoint,appendix=appendix,shapes=[])
    scenes.append(s)
    label=('OPTIONAL NOTE' if appendix else 'BUILD '+str(n).zfill(2))
    txt(48,28,label,18,MUTED)
    txt(48,69,title,40)
    txt(48,145,'Shopify checkpoint · our illustration' if checkpoint else 'Our reconstruction',18,MUTED)
    box(48,544,1104,80,'', '#f7e9df', border='#e5c5ae')
    txt(72,559,question,25,ORANGE,reveal=True)
    txt(48,643,'SYSTEMS FROM FIRST PRINCIPLES   /   TWO BUYERS, ONE LAST PAIR',13,MUTED)
    txt(1100,641,f'{n:02}',17,MUTED)
    return s

def txt(x,y,t,size=28,color=INK,reveal=False):
    scenes[-1]['shapes'].append(dict(kind='text',x=x,y=y,text=t,size=size,color=color,reveal=reveal))
def box(x,y,w,h,t='',fill=PALE,border=INK,size=28):
    scenes[-1]['shapes'].append(dict(kind='rect',x=x,y=y,w=w,h=h,fill=fill,color=border))
    if t:txt(x+20,y+(h-len(t.splitlines())*size*1.25)/2,t,size,border)
def arrow(x,y,x2,y2,color=INK):
    scenes[-1]['shapes'].append(dict(kind='arrow',x=x,y=y,w=x2-x,h=y2-y,color=color))
def cols(a,b,c=None):
    if c is None:
        box(60,220,480,215,a,size=29);box(660,220,480,215,b,size=29);arrow(555,327,640,327)
    else:
        for x,t in zip([60,445,830],[a,b,c]):box(x,235,310,170,t,size=28)
        arrow(382,320,429,320);arrow(767,320,814,320)

scene('Two buyers. One last pair.', 'What is the smallest store we could build?',
'''Alice and Bob both press Buy. The store accepts both orders. But there is only one pair left. Someone is going to be disappointed.

Let’s build this store from a blank page. We’ll start with the simplest thing that could work, break it, and add only what we need next. Along the way, we’ll compare our choices with failures Shopify has written about. This is our reconstruction, not their development timeline.''',
'Point to each accepted order, then the single pair. Reveal the question; do not zoom out to later frames.')
box(70,240,290,150,'Alice\nOrder accepted','#eaf2fc',BLUE);box(840,240,290,150,'Bob\nOrder accepted','#fff0de',ORANGE)
box(460,260,280,130,'Stock: 1 pair',size=32);arrow(375,310,445,310,BLUE);arrow(825,310,755,310,ORANGE)
txt(395,459,'Two promises. One unit.',32,RED)

scene('One number seems enough.', 'Both read 1. Both write 0. Which step must become indivisible?',
'''Our first version stores one number. Read it. If it is positive, accept the order and subtract one.

With one shopper at a time, that works. Alice sees one; after her purchase, Bob sees zero. Now let’s overlap them. Alice reads one. Before she writes anything, Bob reads one too. Alice accepts her order and writes zero. Bob does exactly the same.

Two orders, one pair, and the database still says zero. The number looks fine. The promises are wrong. This is a race condition: our check and our change were separate steps.''',
'Trace down the timeline slowly. Pause after both reads before tracing the writes.')
box(65,220,335,260,'read quantity\nif positive:\n  accept order\n  write quantity - 1',size=26)
txt(455,220,'TIME',18,MUTED);txt(555,220,'ALICE',22,BLUE);txt(820,220,'BOB',22,ORANGE)
for y,a,b in [(270,'reads 1',''),(320,'','reads 1'),(370,'writes 0',''),(420,'','writes 0')]:
    txt(555,y,a,29,BLUE);txt(820,y,b,29,ORANGE)
arrow(475,270,475,468,MUTED)

scene('Check and subtract together.', 'We acquired stock. But what if payment fails?',
'''Let the database check and subtract in one operation. Only subtract if availability is still positive.

Alice’s update changes one row. Bob’s competing update cannot reuse that same availability. It changes zero rows. We check that result and the successful commit before promising anything.

We have fixed the stock race. But we have not finished checkout. Alice still needs to pay.''',
'Trace the condition before the subtraction. Call this an atomic stock decision, not a completed purchase.')
box(60,225,630,235,'UPDATE inventory\nSET available = available - 1\nWHERE item_id = 42\n  AND available > 0;',size=28)
box(765,225,375,100,'Alice: acquired 1','#eaf2fc',BLUE,28);box(765,360,375,100,'Bob: acquired 0','#fff0de',ORANGE,28)

scene('Payment takes time.', 'If we promise stock before payment, how do we remember the promise?',
'''When should we subtract? After payment sounds natural, until two people pay and only one gets the stock. The other needs a refund.

Before payment avoids that, but now Alice closes her tab. We have removed availability without making a sale.

So, add it back when she fails? Yes—but what if our server crashes before doing that? We need to remember who we set the unit aside for, so we can finish or undo that promise later.''',
'Treat “add it back” as a sensible intermediate idea. Let the server-crash question motivate durable state.')
box(60,230,510,250,'SUBTRACT AFTER PAYMENT\n\nAlice pays. Bob pays.\nOnly one gets stock.','#fff0de',ORANGE,28)
box(630,230,510,250,'SUBTRACT BEFORE PAYMENT\n\nAlice abandons checkout.\nAvailability stays missing.','#fcebed',RED,28)

scene('Remember a temporary hold.', 'Works for two shoppers. What happens during a flash sale?',
'''That remembered promise is a reservation. In a short database transaction, we take one unit of availability and record Alice’s hold. Then we commit and release the database lock.

Payment happens after that. If it succeeds, another short transaction turns the hold into a sale. If it fails, we release the hold. An abandoned hold needs expiry and recovery.

Notice the distinction: the hold lasts while Alice pays. The database lock does not. And claim and release must be safe to retry, so the same pair is not deducted or returned twice.''',
'Follow one branch, then reset and follow the other. The two outcomes are alternatives.',True)
box(60,275,240,135,'Available\n1 pair');box(450,275,270,135,'Held for Alice\n0 available','#eaf2fc',BLUE)
box(870,215,270,110,'Claim\nSale recorded','#e9f3eb',GREEN);box(870,390,270,110,'Release\nAvailable again')
arrow(318,340,433,340);arrow(740,312,853,270,GREEN);arrow(740,365,853,440)
txt(60,458,'Short DB lock  ≠  payment-length hold',28,BLUE)

scene('Now sell 100 pairs to thousands.', 'One row is the measured bottleneck. Could a faster counter help?',
'''Let’s change the workload. We have a hundred pairs and thousands of shoppers. This is no longer just a race for one unit.

Our first reservation design still updates one item row for every hold. Each update is short, but all of them have to take turns on that row. Under enough load, the line grows faster than it clears.

We should first shorten the transactions and measure the wait. But if this row still limits us, adding application servers just sends more requests into the same line. Shopify reports contention in a single-row MySQL attempt too. We are meeting that failure here in our teaching order.''',
'Explicitly announce the new stock count. Do not imply that one last pair permits parallel winners.',True)
for x in [70,210,350,490]:box(x,270,110,90,'Buy', '#eaf2fc',BLUE,24)
arrow(635,315,790,315);box(820,255,320,150,'One item row\n100 pairs',size=32)
txt(75,423,'Every reservation takes a turn here.',32)

scene('Try a fast counter in Redis.', 'Payment succeeds. Now two inventory records must change.',
'''Let’s try an in-memory store for the busy reservation counter. MySQL keeps our permanent stock records; Redis manages the holds.

We still need an atomic check-and-take operation. A bare decrement is not enough: it can take the counter below zero. We also still have to remember ownership and handle retries.

Suppose this meets our speed target. Now Alice pays. We need to update the permanent stock record and clear her hold. Those changes are in two systems. This is the split-state risk Shopify describes in its previous design.''',
'Draw both stores as inventory state. Redis is an experiment earned by the preceding measurement.',True)
box(70,285,265,145,'Checkout');box(720,215,400,120,'Redis\navailability + holds','#fff0de',ORANGE)
box(720,385,400,120,'MySQL\nunsold stock')
arrow(355,320,700,275,ORANGE);arrow(355,365,700,445)
txt(380,225,'reserve',25,ORANGE);txt(380,452,'claim after payment',25)

scene('Crash between the two writes.', 'Can the hold and the stock ledger change in one transaction?',
'''Here is a simplified way to see the danger. Availability is unsold stock minus active holds. We have one unit and Alice holds it, so availability is zero.

Alice pays. We clear her hold first. But before we deduct the sold unit from MySQL, the server crashes. Now the calculation says one unit is available again. Another checkout can promise the same pair.

Reversing the writes can hide stock after a crash instead. We could build a repair protocol. Or we could put the inventory changes together. But didn’t one database already give us that awful line?''',
'Trace 1 minus 1, then 1 minus 0. This arithmetic is our illustration, not Shopify’s exact Redis algorithm.',True)
cols('BEFORE CLAIM\nStock 1 - holds 1\nAvailable: 0','CLEAR HOLD\nStock 1 - holds 0\nAvailable: 1','CRASH\nStock deduction\nnever happens')
txt(75,452,'Payment succeeded; inventory state disagrees.',30,RED)

scene('Must every buyer touch one row?', 'There is another free unit. Why should Bob wait for Alice’s row?',
'''Maybe the problem was not simply that we used MySQL. Maybe it was what we asked everyone to update.

Instead of one row saying three units, let’s represent three available units with three rows. These are stock permits, not serial numbers on individual shoes.

Alice can take one, Bob another. But with ordinary locking, Bob might try the row Alice is already working on and wait—even while another candidate is free. Can he use that other row?''',
'Introduce separate rows first. Do not name SKIP LOCKED until the next frame.')
box(60,255,290,180,'One item row\nquantity: 3');arrow(370,340,545,340)
for y,t,fill,col in [(210,'A: Alice is locking it','#eaf2fc',BLUE),(320,'B: free',PALE,INK),(430,'C: free',PALE,INK)]:box(600,y,530,80,t,fill,col,28)

scene('Skip busy rows. Take a free one.', 'A short lock chose the unit. What remembers it after commit?',
'''That is what SKIP LOCKED gives us. While Alice’s transaction locks A, Bob skips it and selects B. Separate buyers can acquire separate units without waiting for the same row.

It does not create stock. With one unit left, there is still only one winner. And getting no rows back does not prove sold out: some candidates may just be busy.

The lock only protects this short transaction. Before releasing it, we need to turn the selected unit into a durable hold.''',
'Point at A, skip to B, then contrast the temporary row lock with the recorded hold.',True)
box(60,240,265,100,'Alice', '#eaf2fc',BLUE);box(60,390,265,100,'Bob','#fff0de',ORANGE)
box(730,230,400,80,'A: locked by Alice','#eaf2fc',BLUE);box(730,365,400,80,'B: Bob takes this','#fff0de',ORANGE)
arrow(345,287,705,268,BLUE);arrow(345,434,705,405,ORANGE)
txt(385,324,'SKIP LOCKED',30);txt(730,480,'No row ≠ sold out',25,RED)

scene('Two short transactions. Payment between.', 'Correct inventory transitions. But do we need a row for all stock?',
'''In the reserve transaction, remove the selected available row and create the hold together. Commit. The database lock is gone; the hold remains.

Then call the payment provider. Later, the claim transaction validates the active hold, deducts the stock ledger and ends the hold together.

The inventory records now change atomically within each transaction. Payment is still outside. Lost responses, retries and late payment results still need recovery. We have solved one specific consistency gap, not every checkout failure.''',
'Trace left to right. Emphasize the two COMMIT boundaries and payment outside both boxes.')
box(60,225,370,265,'1 / RESERVE IN DB\n\nTake unit row\nCreate durable hold\nCOMMIT', '#eaf2fc',BLUE,27)
box(490,300,220,115,'2 / PAYMENT\nExternal', '#fff0de',ORANGE,25)
box(770,225,370,265,'3 / CLAIM IN DB\n\nDeduct stock\nEnd active hold\nCOMMIT','#e9f3eb',GREEN,27)
arrow(443,357,475,357);arrow(725,357,755,357)

scene('Keep a small pool ready.', 'If the pool empties, is the warehouse really empty?',
'''A row per unit gave us concurrency. But storing every unit that way can make the working table much larger than it needs to be.

Keep a small pool of available permits ready, and refill it from inventory that has not already been promised. Think shelf and storeroom. The shelf is part of the stock, not extra stock.

An empty pool must trigger a check or refill path, not an automatic sold-out message. Shopify documents an inline refill fallback with one replenisher while other requests wait. Their cap was a thousand rows per item and location, chosen from observed load. Our cap would need measurement too. That wait is a deliberate tradeoff when the ready pool runs dry.''',
'Distinguish permits from additional inventory. Source cap and refill details are in the evidence notes.',True)
box(60,245,310,225,'Inventory ledger\n\nUnpromised stock',size=28);arrow(390,350,570,350)
txt(406,288,'refill',24)
for i in range(4):box(610+i*130,260,105,105,'1',size=32)
txt(610,400,'Ready permits',30);txt(610,453,'Empty pool ≠ sold out',28,RED)

scene('Fast query. No connection available.', 'What is holding the connections, and for how long?',
'''Now we load-test the whole checkout. Our reservation query is fast, but checkout still stalls.

Look earlier in the request: it is waiting for a database connection. These sessions are shared and limited. Other checkout work is holding them too long. A fast query cannot run without a slot.

Shopify found this problem outside the reservation code. So the next thing we add is measurement: who holds each connection, and for how long? Then we shorten the work responsible. This is the kind of finding that changes a design because we observed the whole system, not because we guessed another database feature.''',
'Trace the waiting request to occupied slots before discussing CPU. Keep exact metrics off the main canvas.',True)
box(60,290,310,145,'Reservation\nwaiting for a slot','#fff0de',ORANGE);arrow(390,362,540,362)
for y,t in [(225,'Connection 1: checkout work'),(325,'Connection 2: checkout work'),(425,'Connection 3: checkout work')]:box(575,y,565,75,t,size=26)

scene('How do we replace it while open?', 'Compare outcomes. Expand gradually. Keep a tested way back.',
'''The new design passes our tests. But the existing store is still taking orders. We cannot turn a prototype into the authority just because the diagram looks convincing.

Run the new path alongside the old one and compare business outcomes. Keep one authority for serving buyers. Investigate disagreements. Then change the authority gradually, with a maintained way back if the new path misbehaves.

That is the rollout pattern Shopify describes. Shipping the replacement is another problem we have to solve. It deserves the same small-step approach as building it.''',
'Explain authority for reservations; the permanent inventory ledger is not being declared Redis.',True)
box(60,280,280,140,'Live checkout');box(760,215,380,120,'Old path\nserves buyers','#eaf2fc',BLUE);box(760,385,380,120,'New path\ncompare outcomes')
arrow(360,320,740,275,BLUE);arrow(360,370,740,440);txt(400,225,'one authority',26,BLUE)

scene('Every piece has a reason.', 'Build something small. Observe the failure. Earn the next change.',
'''We started with a number. Two shoppers raced, so we made the stock decision atomic. Payment took time, so we remembered a hold. A hot row limited throughput, so we tried a faster counter. Two stores could disagree, so we brought inventory changes together and changed how we represented available units.

More stock earned a bounded pool. A wider load test exposed shared connections. A running store earned a gradual rollout.

We did not know this diagram at the start. And it is not the only possible answer. Every piece has a job because we can point to the failure that made us add it. That is how we will keep building systems from first principles.''',
'Only now zoom out. Trace failures before naming their fixes. Finish without presenting this as the inevitable final architecture.')
for x,y,a,b in [(60,205,'Two shoppers race','Atomic stock decision'),(640,205,'Payment takes time','Durable hold'),(60,285,'One row becomes a line','Try a faster reserve path'),(640,285,'Two stores disagree','Commit inventory changes together'),(60,365,'Too many unit rows','Bounded ready pool'),(640,365,'Ready pool empties','Check stock and refill'),(60,445,'Checkout still stalls','Measure shared connections'),(640,445,'Replacing a live store','Shadow + gradual rollout')]:
    txt(x,y,a,25,MUTED);txt(x,y+36,b,29)

scene('Optional: the index path takes locks.', 'Measure the access path before changing the key.',
'''A logical row can involve more than one index record. Follow the lookup path: a secondary index leads to the clustered primary-key record. That can mean more locking work than the drawing suggests. A primary key aligned with the query can change that path. The exact effect depends on the schema and query; it is not a universal one-lock guarantee.''',
'Optional insert after frame 12. Keep detailed schema in study notes.',True,True)
cols('Secondary index\nFind candidate','Primary-key record\nReach the row');txt(85,468,'One logical row can involve multiple index records.',29)

scene('Optional: nothing found can still lock.', 'An empty result does not necessarily mean no locks were taken.',
'''A locking query may protect the range where matching rows would appear, even when it returns no rows. That can obstruct a refill trying to insert there. Isolation settings affect this behavior. READ COMMITTED avoids the relevant search gap locking, but still has gap locks for some constraint checks. Change isolation for the transaction deliberately, not as a blanket speed switch.''',
'Optional insert after frame 12. Do not say READ COMMITTED removes every gap lock.',True,True)
box(65,240,470,215,'Search an empty range\n\nRange protected', '#fff0de',ORANGE)
box(670,240,470,215,'Refill needs to insert\n\nWaits on that range');arrow(650,350,560,350,RED)

scene('Optional: two transactions form a cycle.', 'Use consistent lock order, and still handle deadlock retries.',
'''Here is a generic deadlock, not Shopify’s exact transaction trace. Transaction one holds A and wants B. Transaction two holds B and wants A. Neither can complete while the other holds its lock. The database can choose a victim and roll back its transaction. A consistent acquisition order reduces these cycles, but we still need retry handling.''',
'Generic row-lock example. Avoid describing whole tables as locked.',True,True)
box(60,260,440,190,'T1\nHolds row A\nWants row B','#eaf2fc',BLUE)
box(700,260,440,190,'T2\nHolds row B\nWants row A','#fff0de',ORANGE)
arrow(515,305,685,305,BLUE);arrow(685,405,515,405,ORANGE)

# Export each scene as a real 16:9 Excalidraw frame; appendix lives on a second row.
for s in scenes:
    n=s['n']; ox=((n-1)%15)*1320; oy=0 if n<=15 else 850; fid=f'frame-{n:02}'
    def base(kind,x,y,w,h):
        return dict(id=f'e{len(elements):04}',type=kind,x=x+ox,y=y+oy,width=w,height=h,angle=0,
          strokeColor=INK,backgroundColor='transparent',fillStyle='solid',strokeWidth=2,strokeStyle='solid',
          roughness=1,opacity=100,groupIds=[],frameId=fid,roundness=None,seed=rng.randrange(1,2**30),
          version=1,versionNonce=rng.randrange(1,2**30),isDeleted=False,boundElements=[],updated=1789344000000,
          link=None,locked=False)
    f=base('frame',0,0,1200,675);f.update(id=fid,frameId=None,name=f"{n:02} · {s['title']}");elements.append(f)
    for q in s['shapes']:
        kind=q['kind'];x=q['x'];y=q['y']
        if kind=='text':
            size=q['size'];lines=q['text'].split('\n');w=max(text_width(line,size) for line in lines);h=len(lines)*size*1.25
            e=base('text',x,y,w,h);e.update(text=q['text'],originalText=q['text'],fontSize=size,fontFamily=2,textAlign='left',verticalAlign='top',containerId=None,autoResize=True,lineHeight=1.25,strokeColor=q['color'])
        elif kind=='rect':
            e=base('rectangle',x,y,q['w'],q['h']);e.update(backgroundColor=q['fill'],strokeColor=q['color'],roundness={'type':3})
        else:
            e=base('arrow',x,y,abs(q['w']),abs(q['h']));e.update(points=[[0,0],[q['w'],q['h']]],lastCommittedPoint=None,startBinding=None,endBinding=None,startArrowhead=None,endArrowhead='arrow',elbowed=False,strokeColor=q['color'])
        elements.append(e)
canvas=dict(type='excalidraw',version=2,source='https://excalidraw.com',elements=elements,
 appState=dict(viewBackgroundColor=PAPER,gridSize=None,scrollX=40,scrollY=40,zoom={'value':0.75},frameRendering={'enabled':True,'clip':True,'name':True,'outline':True}),files={})
(ROOT/'two-buyers-one-last-pair.excalidraw').write_text(json.dumps(canvas,indent=2)+'\n')

# SVG is a lightweight preview of exactly the same positions and wording.
def svg(s):
    out=['<svg viewBox="0 0 1200 675" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'+html.escape(s['title'])+'">',f'<rect width="1200" height="675" fill="{PAPER}"/>']
    out.append('<defs><marker id="tip" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="context-stroke" stroke-width="1.5"/></marker></defs>')
    for q in s['shapes']:
        x,y=q['x'],q['y'];kind=q['kind'];c=q['color']
        if kind=='text':
            attr=' class="question"' if q.get('reveal') else ''
            for i,line in enumerate(q['text'].split('\n')):
                out.append(f'<text{attr} x="{x}" y="{y+q["size"]*(1+i*1.25)}" font-size="{q["size"]}" fill="{c}">{html.escape(line)}</text>')
        elif kind=='rect':out.append(f'<rect x="{x}" y="{y}" width="{q["w"]}" height="{q["h"]}" rx="12" fill="{q["fill"]}" stroke="{c}" stroke-width="2"/>')
        else:out.append(f'<path d="M {x} {y} l {q["w"]} {q["h"]}" stroke="{c}" stroke-width="2.5" fill="none" marker-end="url(#tip)"/>')
    return ''.join(out)+'</svg>'
slides=[dict(title=s['title'],svg=svg(s),notes=s['narration'],cue=s['cue'],appendix=s['appendix']) for s in scenes]
page=r'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Two buyers, one last pair — presenter</title>
<style>*{box-sizing:border-box}body{margin:0;background:#e5e7e8;color:#263442;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:1440px;margin:22px auto;padding:0 20px}#stage{width:min(100%,calc((100vh - 170px)*16/9));margin:0 auto;aspect-ratio:16/9;box-shadow:0 10px 45px #26344220;background:#fcfbf7;border-radius:10px;overflow:hidden}svg{width:100%;height:100%;display:block;font-family:Arial,sans-serif}nav{display:flex;align-items:center;gap:9px;margin:16px 0;flex-wrap:wrap}button,select{font:inherit;padding:9px 12px;border:1px solid #bdc7ce;border-radius:7px;background:#fcfbf7;color:#263442;cursor:pointer}button:focus-visible,select:focus-visible{outline:3px solid #2463a0}#progress{font-variant-numeric:tabular-nums;margin-right:auto}#notes{white-space:pre-wrap;background:#fcfbf7;padding:24px;border-radius:9px;line-height:1.65;font-size:18px;max-width:960px;margin:20px auto}#hint{font-size:14px;color:#536371;margin:10px 0}.concealed .question{visibility:hidden}body.recording{background:#fcfbf7}body.recording main{padding:0;margin:0;width:100vw;max-width:none;height:100vh;display:grid;place-items:center}body.recording #stage{outline:none;width:min(100vw,177.77778vh);box-shadow:none;border-radius:0}body.recording nav,body.recording #hint,body.recording #notes{display:none}#stage:fullscreen{border-radius:0;width:100vw;height:100vh;background:#fcfbf7}</style>
<main><div id="stage" class="concealed" tabindex="0" aria-label="Presentation canvas"></div><nav aria-label="Presentation controls"><button id="prev">← Back</button><button id="next">Reveal / Next →</button><span id="progress" aria-live="polite"></span><select id="jump" aria-label="Choose frame"></select><button id="noteButton">Presenter notes</button><button id="record">Recording view</button><button id="full">Fullscreen</button></nav><p id="hint">Space / →: reveal question, then advance · ←: back · N: notes · R: clean recording view · Esc: exit recording view. Frames 16–18 are optional. Notes stay outside the capture area.</p><div id="notes" hidden></div></main>
<script>const slides=SLIDES;let index=0,revealed=false;const stage=document.getElementById('stage'),notes=document.getElementById('notes'),jump=document.getElementById('jump');slides.forEach((s,i)=>{const o=document.createElement('option');o.value=i;o.textContent=String(i+1).padStart(2,'0')+' · '+s.title;jump.append(o)});function render(){stage.innerHTML=slides[index].svg;stage.classList.toggle('concealed',!revealed);document.getElementById('progress').textContent=(index+1)+' / '+slides.length+(slides[index].appendix?' · optional':'');jump.value=index;notes.textContent='CUE: '+slides[index].cue+'\n\n'+slides[index].notes;location.hash=String(index+1)}function next(){if(!revealed)revealed=true;else if(index<slides.length-1){index++;revealed=false}render()}function prev(){if(revealed)revealed=false;else if(index>0){index--;revealed=true}render()}document.getElementById('next').onclick=()=>{next();stage.focus()};document.getElementById('prev').onclick=()=>{prev();stage.focus()};jump.onchange=()=>{index=Number(jump.value);revealed=false;render();stage.focus()};document.getElementById('noteButton').onclick=()=>notes.hidden=!notes.hidden;document.getElementById('record').onclick=()=>document.body.classList.toggle('recording');document.getElementById('full').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else stage.requestFullscreen?.()};document.addEventListener('keydown',e=>{if(['SELECT','BUTTON'].includes(e.target.tagName)&&[' ','ArrowLeft','ArrowRight'].includes(e.key))return;if([' ','ArrowRight','PageDown'].includes(e.key)){e.preventDefault();next()}else if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();prev()}else if(e.key.toLowerCase()==='n')notes.hidden=!notes.hidden;else if(e.key.toLowerCase()==='r')document.body.classList.toggle('recording');else if(e.key==='Escape')document.body.classList.remove('recording')});const requested=Number(location.hash.slice(1));if(requested>=1&&requested<=slides.length)index=requested-1;render();</script></html>'''.replace('SLIDES',json.dumps(slides).replace('</','<\\/'))
(ROOT/'presenter.html').write_text(page)
script=['# Recording script — Two buyers, one last pair\n', 'Generated from [the canvas source](../canvas/build_canvas.py). Edit its scene narration and regenerate to keep this script and the presenter view aligned.\n', 'Main route: frames 01–15, roughly 10–12 minutes with pointing and pauses. Frames 16–18 are optional inserts after frame 12. Read each frame’s narration, then reveal its question and pause before advancing. The question strip is a prompt, not an extra paragraph to read verbatim.\n', 'Use the offline [presenter](../canvas/presenter.html) or the editable [Excalidraw canvas](../canvas/two-buyers-one-last-pair.excalidraw). Start on frame 01; save the full-canvas zoom-out for frame 15.\n']
for s in scenes:script += [f'## {s["n"]:02} · {s["title"]}\n',f'**Point / do:** {s["cue"]}\n',s['narration']+'\n',f'**Reveal / bridge:** {s["question"]}\n']
(ROOT.parent/'scripts'/'recording-script.md').write_text('\n'.join(script))
print(f'Generated {len(scenes)} frames, {len(elements)} elements, presenter and recording script.')
