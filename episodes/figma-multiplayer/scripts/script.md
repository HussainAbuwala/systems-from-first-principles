# Script draft: Figma multiplayer

## Working title

**How Figma Multiplayer Evolved: From Overwritten Files to Real-Time Collaboration**

## Draft notes

- Target delivery: conversational, approximately 135–145 words per minute.
- This is a first narration draft. Animation timing should be adjusted after a recorded scratch read.
- Bracketed evidence IDs are production notes and are not spoken.

## 00:00 — Two people, one rectangle

**Narration**

Alice and Bob are editing the same design. Alice moves this rectangle to the left. At almost the same moment, Bob changes it from blue to orange.

Those edits don't sound incompatible. We probably want to keep both.

But now Alice changes the rectangle to green while Bob changes that same rectangle to red. Their requests cross somewhere on the network. Alice sees green. Bob sees red.

Who wins?

And how do we make both screens agree without forcing either person to wait for the network every time they move their mouse?

Today, we're going to build a multiplayer editor from the simplest possible solution. We'll break it one requirement at a time, and then compare what we build with architecture Figma has described publicly.

One important note: those articles are snapshots published between 2016 and 2022. When something comes directly from Figma, I'll say so. Our teaching models are not claims about Figma's private architecture today.

**Visual**

Play storyboard scenes 01–03. Freeze the first conflict before revealing the winner.

**Evidence:** F06 and the repository evidence policy.

## 01:05 — Level 0: Save the entire document

**Narration**

Let's remove Bob for a moment.

Alice opens a design. Her browser downloads version one of the document. She edits it locally, and every so often the browser uploads the entire document as version two.

This is not a bad first design. It is easy to understand, and with one editor, it works.

Now Bob opens the same file. Alice and Bob both download version one. Alice moves the rectangle and uploads her version. Then Bob changes the label and uploads his version—but Bob's document started from the old version one.

The store now contains Bob's label change, but Alice's movement is gone. Bob didn't intentionally delete it. His snapshot simply never contained it.

Figma says its original saving model worked this way: download the document, edit locally in the browser, and periodically upload the whole document. As team features grew, people could overwrite one another or open a link and see an old version because saving had not finished.

So our first requirement is clear: collaborators cannot replace the shared file with isolated snapshots.

**Visual**

Play scenes 04–05 and diagram `01-whole-document-overwrite.mmd`.

**Evidence:** F01, F02.

## 02:15 — Level 1: Send changes instead of snapshots

**Narration**

Instead of repeatedly uploading the whole document, let's keep a WebSocket connection open and send small changes as they happen.

Alice moves shape seven, so her client sends: shape seven, position, new coordinates. Bob changes its fill, so his client sends: shape seven, fill, orange.

This is faster and avoids replacing the entire file. But WebSockets only move messages. They do not decide what concurrent messages mean.

If Alice and Bob send conflicting edits, network delay can make those messages arrive in different orders. If each browser makes its own decision, their documents can still diverge.

We improved the transport. We have not solved collaboration.

**Visual**

Play scenes 06–07. Let packets cross and show different final colors on the clients.

**Evidence:** F03 for WebSockets; packet ordering demonstration is P02.

## 03:20 — Level 2: Give the document an authority

**Narration**

Let's add one authority for this document. Every connected editor sends changes to it. The authority validates each change, places accepted changes in an order, updates its document state, and broadcasts the result.

Now the browsers do not need to agree on which packet crossed the internet first. They only need to converge on the order accepted by the authority.

In Figma's publicly described design, clients communicate with a cluster of servers over WebSockets. Figma described each active document as being handled by its own Multiplayer process, and later described Multiplayer as authoritative for validation, ordering, and conflict resolution.

That does not eliminate conflicts. It gives us one place to define them.

**Visual**

Play scene 08. Add sequence numbers only after packets reach the authority.

**Evidence:** F03, F05.

## 04:30 — Level 3: What exactly is a conflict?

**Narration**

Return to our first example. Alice changes the rectangle's position. Bob changes its fill.

Both edits refer to shape seven, but they touch different properties. The authority can keep both: the rectangle moves and becomes orange.

Now both people edit the fill property. This is a real conflict. In the model Figma described, the server keeps the latest value it accepted for that property on that object. If green is accepted and red is accepted afterward, red becomes the shared value.

This resembles a last-writer-wins register, but there is an important detail: the server defines the order. Clients do not need synchronized clocks to determine which timestamp is later.

There is still a deliberate tradeoff. If two people edit the same text value simultaneously, Figma's property-level rule does not merge their characters into one perfect sentence. The result is one accepted property value or the other. Figma chose a conflict boundary that fits many graphical operations.

With the server defining the order, every connected client can eventually agree on the same final value. We have solved agreement—but agreement alone does not make the editor feel responsive.

**Visual**

Play scenes 09–10 and the accepted flow in `02-authoritative-edit-flow.mmd`.

**Evidence:** F05, F06.

## 05:00 — Level 4: Don't wait for the network

**Narration**

Suppose Alice drags the rectangle and her browser waits for the server before moving it on screen. Even a modest network delay makes the object trail behind her cursor. For a design tool, that interaction is unusable.

So Alice's client applies the movement immediately. Locally, the new position is pending. The change travels to the authority, and when the accepted update returns, it becomes confirmed.

This is an optimistic update: show the best state we currently know instead of waiting for certainty.

But optimism creates a subtle bug. Suppose the server has confirmed the rectangle at position 100. Alice drags it to 200, and her client displays that movement immediately as a pending local change. Before it is acknowledged, an older server position—130—arrives.

A naive client paints every arriving server value, so the rectangle moves from 100 to 200, jumps backward to 130, and returns to 200 after Alice's movement is accepted. That temporary backward jump is the flicker.

Figma described preventing it by suppressing incoming changes that conflict with newer unacknowledged local property changes. The client can remember confirmed position 130 underneath while keeping pending position 200 visually on top. Once Alice's update is accepted, 200 becomes confirmed and the pending layer disappears. The server is not ignored forever: rejection or a later winning update must still produce the real shared result.

Responsive collaboration therefore needs two related layers of state: what the authority has confirmed and what the user has done locally but the authority has not confirmed yet.

**Visual**

Play scenes 11–14. Give the backward jump and the confirmed-under-pending fix separate frames. Use a pending clock and accepted check marker; do not suggest that pending state is already durable.

**Evidence:** F07. The latency demonstration is an inferred motivation.

## 06:10 — Level 5: What happens offline?

**Narration**

Now Bob's connection disappears. He keeps working, so his browser accumulates local edits. Meanwhile, Alice changes the online document.

When Bob reconnects, Figma described a straightforward recovery model: download a fresh copy of the document, reapply Bob's offline edits on top of that state, and then resume normal synchronization.

Those replayed edits still follow the same conflict rules. Reconnection can make every client converge, but convergence is not the same as preserving every person's intention. If Alice and Bob changed the same property, one accepted value still wins.

That distinction matters in distributed systems: consistency can tell us that everyone ended with the same answer. It cannot tell us that the answer matches what every human wanted.

**Visual**

Play scenes 15–16. Show offline edits as queued operations, not as a second authoritative document.

**Evidence:** F04; the convergence-versus-intent distinction is I03 applied to offline replay.

## 07:10 — Level 6: Fast state can disappear

**Narration**

So far, we have focused on making active editors agree. Now we need to make their work survive failure.

Figma described Multiplayer as holding the active document in memory for speed. Every 30 to 60 seconds, it encoded and compressed the complete file and uploaded a checkpoint to S3.

Imagine the latest checkpoint represents edit one hundred. The authority accepts edits one hundred and one through one hundred and five—and then the process crashes before the next checkpoint.

If recovery loads only checkpoint one hundred, those recent edits are missing. In the checkpoint-centric architecture Figma described, a crash could lose up to roughly 60 seconds of server-side work.

At this point, we can propose a hypothetical alternative: overwrite the same checkpoint after every edit instead of retaining multiple snapshots. The public material used for this episode does not establish whether Figma overwrote one checkpoint object, retained multiple versions, or used another storage layout.

The hypothetical overwrite could leave one final snapshot in storage. But because each checkpoint is a complete file, it does not eliminate the full-write work. After edit 101, the system encodes, compresses, and uploads the complete file. It repeats that full write after edits 102, 103, 104, and 105. One snapshot may remain, while five complete-file writes still consumed CPU, bandwidth, and storage write capacity.

Combining all five edits into one overwrite reduces that work, but it becomes periodic checkpointing again. Until the combined write occurs, the edits remain only in memory and can disappear in a crash. The number of retained snapshots is not the central issue; the frequency of complete-file writes is. The system needs a way to make small changes durable without rewriting the complete document.

**Visual**

Play scenes 17–18. Clearly distinguish “accepted in memory” from “persisted.”

**Evidence:** F10, F11.

## 08:15 — Level 7: Recover with a journal

**Narration**

Instead of writing the whole file more often, write the small changes between checkpoints.

Figma added a durable journal backed by DynamoDB. Accepted edits receive increasing sequence numbers, and batches of incremental changes are written much more frequently than complete checkpoints.

Recovery now has two parts. Load checkpoint one hundred. Then query the journal for entries newer than one hundred and replay edits one hundred and one through one hundred and five. The replacement instance reconstructs the latest persisted state without needing a complete snapshot for every change.

With a complete checkpoint as the durable base and the journal preserving the small changes after it, we now have the final piece. Let’s zoom out and rebuild the whole system from the failures that led us here.

**Visual**

Play scene 19 and `03-checkpoint-journal-recovery.mmd`.

**Evidence:** F12.

## 09:45 — Zoom out and rebuild the system

**Narration**

The problem was never just how to send real-time messages. It was how many people could edit one shared file quickly, consistently, and without losing accepted work.

First, we needed one shared order. Complete-document uploads overwrote concurrent work, so we sent small changes instead. WebSockets moved those changes quickly, but only an authoritative Multiplayer process could sequence them and resolve property-level conflicts consistently.

Second, we needed the editor to feel immediate. Waiting for the server created visible lag, so clients applied changes optimistically. Keeping pending state above confirmed state prevented the backward flicker, while fresh state plus replay let an offline client reconnect.

Third, accepted work had to survive a process crash. In-memory state was fast, and complete checkpoints gave recovery a durable base, but the time between checkpoints left a loss window. Persisting small sequenced changes in a journal filled much of that gap, so recovery became: load the checkpoint, then replay the journal.

One problem created three responsibilities: order, responsiveness, and durability. These components are not a random technology list. Each one was earned by a failure in the simpler design.

That is Figma multiplayer, built from first principles. Which part would you design differently?

**Visual**

Zoom out from the center problem. Reveal three groups of miniature screenshots from earlier scenes, highlight each group with its narration, and finish with the complete architecture visible.

**Evidence:** F03–F12; final framing is P03.

## Post-recording checklist

- [ ] Record a scratch narration and update timestamps from actual pacing.
- [ ] Confirm every spoken production claim appears in the evidence map.
- [ ] Add on-screen source year when a historical Figma detail first appears.
- [ ] Do not display Figma trademarks or copied product artwork unnecessarily.
- [ ] Cut any mechanism that appears before its motivating failure.
- [ ] Produce short-form scripts only after the long-form timing is stable.
