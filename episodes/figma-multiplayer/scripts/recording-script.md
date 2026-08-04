# Recording script: Figma multiplayer

This version contains only words intended to be spoken. Record each take as a separate audio file. A take can be repeated without restarting the whole section.

The animation is now synchronized to the completed recordings and runs 12:47. Each visual scene follows the corresponding cleaned voice take, with a short breathing gap before the next take.

## Recording convention

Use filenames in this format:

```text
figma-01-hook-a.wav
figma-01-hook-b.wav
figma-02-promise-a.wav
figma-10-lag-a.wav
figma-12-flicker-part1-a.wav
```

Long visual scenes are divided into `part1` and `part2` recording chunks. Increment the final letter when repeating a chunk. Do not delete unsuccessful takes until the edited episode is complete.

Before each take:

1. Leave two seconds of silence.
2. Say the take number if it helps you organize recordings; it can be cut later.
3. Speak slightly slower than normal conversation.
4. Leave one second of silence after the final sentence.

## Pronunciation

- **WebSocket:** “web socket”
- **DynamoDB:** “dye-nuh-mo D-B”
- **S3:** “S three”
- **authoritative:** “uh-thor-uh-tay-tiv”
- **idempotency:** not used in this episode

---

## Take 01A — See multiplayer working

**Target:** 35–40 seconds
**Delivery:** Curious and conversational. Let “what the document actually is” land as the central mystery.
**Visual cue:** A polished Figma-like canvas appears. Alice moves a selected button while Bob changes its fill; both edits combine instantly, presence cursors remain visible, and the interface reports that the changes are synchronized. The UI then freezes on the shared document question and transitions into the hand-drawn notebook.

Figma makes multiplayer editing feel almost invisible. Alice moves a shape, Bob changes its color, and both edits appear instantly.

But beneath that smooth interaction is a difficult question: when many people change the same file at nearly the same time, how does Figma decide what the document actually is?

Today, we'll build that system from first principles. We'll start with the simplest design, break it, and let each failure reveal the next piece of the architecture.

So let's begin with one rectangle, two people, and a conflict.

## Take 01B — The conflict

**Target:** 30–35 seconds
**Delivery:** Curious and energetic. Pause after “Who wins?”
**Visual cue:** Alice and Bob edit the same rectangle.

Alice and Bob are editing the same design. Alice moves this rectangle to the left. At almost the same moment, Bob changes it from blue to orange.

Those edits don't sound incompatible. We probably want to keep both.

But now Alice changes the rectangle to green while Bob changes that same rectangle to red. Their requests cross somewhere on the network. Alice sees green. Bob sees red.

Who wins?

## Take 02 — The promise

**Target:** 35–45 seconds
**Delivery:** Direct and confident.
**Visual cue:** Three cards appear in order—simplest design, failure appears, smallest fix—followed by a clipping labeled as public Figma engineering evidence, historical snapshots from 2016–2022, documented material, and teaching model.

To answer that question, we'll use the same pattern throughout this video.

Start with the simplest reasonable design. Add one real requirement. Watch where it fails. Then add the smallest fix that failure demands.

At every step, we'll compare our design with what Figma engineers described publicly. Those posts are historical snapshots published between 2016 and 2022.

Whenever we use a simplified teaching model, we'll label it—because it is not a claim about Figma's private architecture today.

With that boundary clear, let's start with the smallest system that could possibly work.

## Take 03 — The simplest save model

**Target:** 25–30 seconds
**Delivery:** Calm; make the design sound reasonable.
**Visual cue:** One client downloads version one and uploads version two.

First, let's remove Bob for a moment.

Alice opens a design. Her browser downloads version one of the document. She edits it locally, and every so often the browser uploads the entire document as version two.

This is not a bad first design. It is easy to understand, and with one editor, it works. The interesting part begins the moment a second editor arrives.

## Take 04 — Overwriting work

**Target:** 40–50 seconds
**Delivery:** Build tension as Alice's change disappears.
**Visual cue:** Alice and Bob both branch from version one.

So now Bob opens the same file. Alice and Bob both download version one. Alice moves the rectangle and uploads her version. Then Bob changes the label and uploads his version—but Bob's document started from the old version one.

The store now contains Bob's label change, but Alice's movement is gone. Bob didn't intentionally delete it. His snapshot simply never contained it.

Figma says its original saving model worked this way, and documented the resulting overwrite and stale-version problems. That failure tells us exactly what to change next: stop treating every save as a replacement for the whole document.

## Take 05 — Send changes, not snapshots

**Target:** 30–35 seconds
**Delivery:** Present the WebSocket as an improvement, not the final answer.
**Visual cue:** The complete-document transfer is crossed out. A persistent WebSocket opens, Alice's position packet and Bob's fill packet cross the connection, and both clients retain both edits.

Instead of repeatedly uploading the whole document, let's keep a WebSocket connection open and send small changes as they happen.

Alice moves shape seven, so her client sends: shape seven, position, new coordinates. Bob changes its fill, so his client sends: shape seven, fill, orange.

This is faster and avoids replacing the entire file. The next question is whether faster transport is enough to make the two copies agree.

## Take 06 — Transport is not collaboration

**Target:** 25–30 seconds
**Delivery:** Emphasize the final two sentences.
**Visual cue:** Conflicting packets arrive in different orders.

It is not enough. If Alice and Bob send conflicting edits, network delay can make those messages arrive in different orders. If each browser applies whichever packet it sees last, their documents can diverge even though both received the same edits.

WebSockets moved the messages. They did not define one shared order. We improved the transport; we have not solved collaboration.

## Take 07 — Give the document an authority

**Target:** 40–45 seconds
**Delivery:** Explanatory and deliberate.
**Visual cue:** Insert the Multiplayer authority and add sequence numbers.

To remove that ambiguity, let's add one authority for this document. Every connected editor sends changes to it. The authority validates each change, places accepted changes in an order, updates its document state, and broadcasts the result.

Now the browsers do not need to agree on which packet crossed the internet first. They only need to converge on the order accepted by the authority.

Figma later described Multiplayer as authoritative for validation, ordering, and conflict resolution. Once everyone agrees on the order, we can ask a more precise question: which edits actually conflict?

## Take 08 — Independent properties

**Target:** 25–30 seconds
**Delivery:** Light, as if solving the first puzzle.
**Visual cue:** Position and fill property chips travel independently.

Return to our first example. Alice changes the rectangle's position while Bob changes its fill.

Both edits refer to shape seven, but they touch different properties. The authority can keep both: the rectangle moves and becomes orange.

Now both people edit the fill property. This is a real conflict, so ordering alone is not enough; we also need a rule for choosing the shared value.

## Take 09 — Last accepted value

**Target:** 35–45 seconds
**Delivery:** Technical but unhurried.
**Visual cue:** Green receives sequence 43, red receives sequence 44.

For that same-property conflict, the model Figma described keeps the latest value the server accepted for that property on that object. If green is accepted and red is accepted afterward, red becomes the shared value.

This resembles a last-writer-wins register, but there is an important detail: the server defines the order. Clients do not need synchronized clocks to determine which timestamp is later.

With the server defining the order, every connected client can eventually agree on the same final value. We have solved agreement—but agreement alone does not make the editor feel responsive.

## Take 10 — Waiting feels broken

**Target:** 25–30 seconds
**Delivery:** Make the lag sound visibly frustrating.
**Visual cue:** Rectangle trails behind Alice's cursor.

Suppose Alice drags the rectangle and her browser waits for the server before moving it on screen. Even a modest network delay makes the object trail behind her cursor. For a design tool, that interaction is unusable. So the client cannot wait for certainty before drawing Alice's change.

## Take 11 — Optimistic local editing

**Target:** 25–30 seconds
**Delivery:** Crisp; pause between “pending” and “confirmed.”
**Visual cue:** Pending clock changes to an accepted check.

Instead, Alice's client applies the movement immediately. Locally, the new position is pending. The change travels to the authority, and when the accepted update returns, it becomes confirmed.

This is an optimistic update: show the best state we currently know instead of waiting for certainty.

But keeping pending and confirmed state at the same time creates a subtle bug.

## Take 12A — The backward jump

**Target:** 45–55 seconds
**Delivery:** Count through 100, 200, 130, and 200 slowly.
**Visual cue:** The broken client jumps from 200 to 130 and later returns to 200.

Let’s use actual positions. The server has confirmed the rectangle at position one hundred. Alice drags it to two hundred, and her client shows that movement immediately. Position two hundred is visible, but it is still pending.

Before Alice’s movement is acknowledged, an older server position—one hundred and thirty—arrives. A naive client displays it immediately. The rectangle jumps from two hundred back to one hundred and thirty, then returns to two hundred when Alice’s movement is accepted. That temporary backward jump is the flicker.

The problem is now visible. The next question is how to accept server updates without letting an older value cover a newer local intention.

## Take 12B — Keep pending state on top

**Target:** 40–45 seconds
**Delivery:** Explain the two layers slowly: confirmed underneath, pending on top.
**Visual cue:** The corrected client keeps confirmed 130 underneath pending 200 until acknowledgement.

Figma described preventing that flicker by suppressing incoming changes that conflict with newer unacknowledged local changes. The client can remember confirmed position one hundred and thirty underneath, while keeping Alice’s pending position two hundred visually on top. When Alice’s update is accepted, two hundred becomes confirmed and the pending layer disappears.

The server is not ignored forever. If Alice’s edit is rejected, or a later accepted update wins, the client must display the real shared result.

So far, this optimistic model assumes the connection eventually answers. What happens if the connection disappears completely?

## Take 13 — Working offline

**Target:** 30–35 seconds
**Delivery:** Steady and visual.
**Visual cue:** Bob disconnects, continues editing, then reconnects.

Now Bob's connection disappears. He keeps working, so his browser accumulates local edits. Meanwhile, Alice changes the online document.

When Bob reconnects, Figma described a straightforward recovery model: download a fresh copy of the document, reapply Bob's offline edits on top of that state, and then resume normal synchronization.

Those replayed edits still follow the same conflict rules. They can make every client agree again, but if Alice and Bob changed the same property, one accepted value still wins. Agreement does not preserve every person's intention.

Now we know how active clients agree and recover after a disconnection. But what happens if the server process holding their accepted work crashes?

## Take 14 — Fast state is volatile

**Target:** 25–35 seconds
**Delivery:** Transition into a more serious reliability tone.
**Visual cue:** Zoom inside the in-memory Multiplayer process.

So far, we have focused on making active editors agree. Now we need to make their work survive failure.

Figma described Multiplayer as holding the active document in memory for speed. Every 30 to 60 seconds, it encoded and compressed the complete file and uploaded a checkpoint to S three. That interval creates a new gap between the latest durable checkpoint and the state currently in memory.

## Take 15 — The checkpoint gap

**Target:** 55–65 seconds
**Delivery:** Count the edits clearly, then make each rejected alternative feel like the natural next question.
**Visual cue:** Checkpoint 100, edits 101 through 105, and a crash. The same frame then tests checkpointing after every edit, batching checkpoints, and finally changing the durability unit to small deltas.

Imagine the latest checkpoint represents edit one hundred. The authority accepts edits one hundred and one through one hundred and five—and then the process crashes before the next checkpoint.

If recovery loads only checkpoint one hundred, those recent edits are missing. In the checkpoint-centric architecture Figma described, a crash could lose up to roughly 60 seconds of server-side work.

The obvious solution is to checkpoint more frequently. But every checkpoint contains the complete file. Creating one after every small edit would repeatedly encode, compress, transfer, and store the entire document.

To be clear, checkpointing after every edit is our design alternative—not a claim about what Figma implemented.

We could batch several edits into one checkpoint, but then we recreate the original gap: until that checkpoint is written, the latest edits exist only in memory.

So we need a smaller unit of durability. Instead of repeatedly saving the complete document, we need to persist the incremental changes between checkpoints.

## Take 16 — Add a journal

**Target:** 40–45 seconds
**Delivery:** Clear and procedural.
**Visual cue:** Frequent sequence batches flow to the journal.

That smaller unit is the journal entry. Instead of writing the whole file more often, write the small changes between checkpoints.

Figma added a durable journal backed by Dynamo D-B. Accepted edits receive increasing sequence numbers, and batches of incremental changes are written much more frequently than complete checkpoints.

Recovery now has two parts. Load checkpoint one hundred. Then query the journal for entries newer than one hundred and replay edits one hundred and one through one hundred and five.

With a complete checkpoint as the durable base and the journal preserving the small changes after it, we now have the final piece. Let’s zoom out and rebuild the whole system from the failures that led us here.

## Take 17 — Zoom out and rebuild the system

**Target:** 55–65 seconds
**Delivery:** Reflective at first, then rhythmic as each branch appears. Pause briefly before the final question.
**Visual cue:** The camera pulls away from the center problem. Actual miniature frames from earlier scenes appear one by one. The real-time-order group is highlighted first, then responsive clients, then durability. At the end, all three groups are bright together.

The problem was never just how to send real-time messages. It was how many people could edit one shared file quickly, consistently, and without losing accepted work.

First, we needed one shared order. Complete-document uploads overwrote concurrent work, so we sent small changes instead. WebSockets moved those changes quickly, but only an authoritative Multiplayer process could sequence them and resolve property-level conflicts consistently.

Second, we needed the editor to feel immediate. Waiting for the server created visible lag, so clients applied changes optimistically. Keeping pending state above confirmed state prevented the backward flicker, while fresh state plus replay let an offline client reconnect.

Third, accepted work had to survive a process crash. In-memory state was fast, and complete checkpoints gave recovery a durable base, but the time between checkpoints left a loss window. Persisting small sequenced changes in a journal filled much of that gap, so recovery became: load the checkpoint, then replay the journal.

One problem created three responsibilities: order, responsiveness, and durability. These components are not a random technology list. Each one was earned by a failure in the simpler design.

That is Figma multiplayer, built from first principles. Which part would you design differently?

---

## After recording

- Keep the microphone position and input level unchanged across takes.
- Export unprocessed WAV files when possible; preserve the originals.
- Mark the preferred version of each take only after listening through headphones.
- Do not remove every breath or pause—the delivery should still sound human.
- Record replacement sentences rather than trying to digitally repair unclear words.
- Record ten seconds of room tone for use between edited takes.
