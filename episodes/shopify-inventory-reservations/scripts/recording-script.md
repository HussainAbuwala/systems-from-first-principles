# Recording script — Two buyers, one last pair

Generated from [the canvas source](../canvas/build_canvas.py). Edit its scene narration and regenerate to keep this script and the presenter view aligned.

Main route: frames 01–15, roughly 10–12 minutes with pointing and pauses. Frames 16–18 are optional inserts after frame 12. Read each frame’s narration, then reveal its question and pause before advancing. The question strip is a prompt, not an extra paragraph to read verbatim.

Use the offline [presenter](../canvas/presenter.html) or the editable [Excalidraw canvas](../canvas/two-buyers-one-last-pair.excalidraw). Start on frame 01; save the full-canvas zoom-out for frame 15.

## 01 · Two buyers. One last pair.

**Point / do:** Point to each accepted order, then the single pair. Reveal the question; do not zoom out to later frames.

Alice and Bob both press Buy. The store accepts both orders. But there is only one pair left. Someone is going to be disappointed.

Let’s build this store from a blank page. We’ll start with the simplest thing that could work, break it, and add only what we need next. Along the way, we’ll compare our choices with failures Shopify has written about. This is our reconstruction, not their development timeline.

**Reveal / bridge:** What is the smallest store we could build?

## 02 · One number seems enough.

**Point / do:** Trace down the timeline slowly. Pause after both reads before tracing the writes.

Our first version stores one number. Read it. If it is positive, accept the order and subtract one.

With one shopper at a time, that works. Alice sees one; after her purchase, Bob sees zero. Now let’s overlap them. Alice reads one. Before she writes anything, Bob reads one too. Alice accepts her order and writes zero. Bob does exactly the same.

Two orders, one pair, and the database still says zero. The number looks fine. The promises are wrong. This is a race condition: our check and our change were separate steps.

**Reveal / bridge:** Both read 1. Both write 0. Which step must become indivisible?

## 03 · Check and subtract together.

**Point / do:** Trace the condition before the subtraction. Call this an atomic stock decision, not a completed purchase.

Let the database check and subtract in one operation. Only subtract if availability is still positive.

Alice’s update changes one row. Bob’s competing update cannot reuse that same availability. It changes zero rows. We check that result and the successful commit before promising anything.

We have fixed the stock race. But we have not finished checkout. Alice still needs to pay.

**Reveal / bridge:** We acquired stock. But what if payment fails?

## 04 · Payment takes time.

**Point / do:** Treat “add it back” as a sensible intermediate idea. Let the server-crash question motivate durable state.

When should we subtract? After payment sounds natural, until two people pay and only one gets the stock. The other needs a refund.

Before payment avoids that, but now Alice closes her tab. We have removed availability without making a sale.

So, add it back when she fails? Yes—but what if our server crashes before doing that? We need to remember who we set the unit aside for, so we can finish or undo that promise later.

**Reveal / bridge:** If we promise stock before payment, how do we remember the promise?

## 05 · Remember a temporary hold.

**Point / do:** Follow one branch, then reset and follow the other. The two outcomes are alternatives.

That remembered promise is a reservation. In a short database transaction, we take one unit of availability and record Alice’s hold. Then we commit and release the database lock.

Payment happens after that. If it succeeds, another short transaction turns the hold into a sale. If it fails, we release the hold. An abandoned hold needs expiry and recovery.

Notice the distinction: the hold lasts while Alice pays. The database lock does not. And claim and release must be safe to retry, so the same pair is not deducted or returned twice.

**Reveal / bridge:** Works for two shoppers. What happens during a flash sale?

## 06 · Now sell 100 pairs to thousands.

**Point / do:** Explicitly announce the new stock count. Do not imply that one last pair permits parallel winners.

Let’s change the workload. We have a hundred pairs and thousands of shoppers. This is no longer just a race for one unit.

Our first reservation design still updates one item row for every hold. Each update is short, but all of them have to take turns on that row. Under enough load, the line grows faster than it clears.

We should first shorten the transactions and measure the wait. But if this row still limits us, adding application servers just sends more requests into the same line. Shopify reports contention in a single-row MySQL attempt too. We are meeting that failure here in our teaching order.

**Reveal / bridge:** One row is the measured bottleneck. Could a faster counter help?

## 07 · Try a fast counter in Redis.

**Point / do:** Draw both stores as inventory state. Redis is an experiment earned by the preceding measurement.

Let’s try an in-memory store for the busy reservation counter. MySQL keeps our permanent stock records; Redis manages the holds.

We still need an atomic check-and-take operation. A bare decrement is not enough: it can take the counter below zero. We also still have to remember ownership and handle retries.

Suppose this meets our speed target. Now Alice pays. We need to update the permanent stock record and clear her hold. Those changes are in two systems. This is the split-state risk Shopify describes in its previous design.

**Reveal / bridge:** Payment succeeds. Now two inventory records must change.

## 08 · Crash between the two writes.

**Point / do:** Trace 1 minus 1, then 1 minus 0. This arithmetic is our illustration, not Shopify’s exact Redis algorithm.

Here is a simplified way to see the danger. Availability is unsold stock minus active holds. We have one unit and Alice holds it, so availability is zero.

Alice pays. We clear her hold first. But before we deduct the sold unit from MySQL, the server crashes. Now the calculation says one unit is available again. Another checkout can promise the same pair.

Reversing the writes can hide stock after a crash instead. We could build a repair protocol. Or we could put the inventory changes together. But didn’t one database already give us that awful line?

**Reveal / bridge:** Can the hold and the stock ledger change in one transaction?

## 09 · Must every buyer touch one row?

**Point / do:** Introduce separate rows first. Do not name SKIP LOCKED until the next frame.

Maybe the problem was not simply that we used MySQL. Maybe it was what we asked everyone to update.

Instead of one row saying three units, let’s represent three available units with three rows. These are stock permits, not serial numbers on individual shoes.

Alice can take one, Bob another. But with ordinary locking, Bob might try the row Alice is already working on and wait—even while another candidate is free. Can he use that other row?

**Reveal / bridge:** There is another free unit. Why should Bob wait for Alice’s row?

## 10 · Skip busy rows. Take a free one.

**Point / do:** Point at A, skip to B, then contrast the temporary row lock with the recorded hold.

That is what SKIP LOCKED gives us. While Alice’s transaction locks A, Bob skips it and selects B. Separate buyers can acquire separate units without waiting for the same row.

It does not create stock. With one unit left, there is still only one winner. And getting no rows back does not prove sold out: some candidates may just be busy.

The lock only protects this short transaction. Before releasing it, we need to turn the selected unit into a durable hold.

**Reveal / bridge:** A short lock chose the unit. What remembers it after commit?

## 11 · Two short transactions. Payment between.

**Point / do:** Trace left to right. Emphasize the two COMMIT boundaries and payment outside both boxes.

In the reserve transaction, remove the selected available row and create the hold together. Commit. The database lock is gone; the hold remains.

Then call the payment provider. Later, the claim transaction validates the active hold, deducts the stock ledger and ends the hold together.

The inventory records now change atomically within each transaction. Payment is still outside. Lost responses, retries and late payment results still need recovery. We have solved one specific consistency gap, not every checkout failure.

**Reveal / bridge:** Correct inventory transitions. But do we need a row for all stock?

## 12 · Keep a small pool ready.

**Point / do:** Distinguish permits from additional inventory. Source cap and refill details are in the evidence notes.

A row per unit gave us concurrency. But storing every unit that way can make the working table much larger than it needs to be.

Keep a small pool of available permits ready, and refill it from inventory that has not already been promised. Think shelf and storeroom. The shelf is part of the stock, not extra stock.

An empty pool must trigger a check or refill path, not an automatic sold-out message. Shopify documents an inline refill fallback with one replenisher while other requests wait. Their cap was a thousand rows per item and location, chosen from observed load. Our cap would need measurement too. That wait is a deliberate tradeoff when the ready pool runs dry.

**Reveal / bridge:** If the pool empties, is the warehouse really empty?

## 13 · Fast query. No connection available.

**Point / do:** Trace the waiting request to occupied slots before discussing CPU. Keep exact metrics off the main canvas.

Now we load-test the whole checkout. Our reservation query is fast, but checkout still stalls.

Look earlier in the request: it is waiting for a database connection. These sessions are shared and limited. Other checkout work is holding them too long. A fast query cannot run without a slot.

Shopify found this problem outside the reservation code. So the next thing we add is measurement: who holds each connection, and for how long? Then we shorten the work responsible. This is the kind of finding that changes a design because we observed the whole system, not because we guessed another database feature.

**Reveal / bridge:** What is holding the connections, and for how long?

## 14 · How do we replace it while open?

**Point / do:** Explain authority for reservations; the permanent inventory ledger is not being declared Redis.

The new design passes our tests. But the existing store is still taking orders. We cannot turn a prototype into the authority just because the diagram looks convincing.

Run the new path alongside the old one and compare business outcomes. Keep one authority for serving buyers. Investigate disagreements. Then change the authority gradually, with a maintained way back if the new path misbehaves.

That is the rollout pattern Shopify describes. Shipping the replacement is another problem we have to solve. It deserves the same small-step approach as building it.

**Reveal / bridge:** Compare outcomes. Expand gradually. Keep a tested way back.

## 15 · Every piece has a reason.

**Point / do:** Only now zoom out. Trace failures before naming their fixes. Finish without presenting this as the inevitable final architecture.

We started with a number. Two shoppers raced, so we made the stock decision atomic. Payment took time, so we remembered a hold. A hot row limited throughput, so we tried a faster counter. Two stores could disagree, so we brought inventory changes together and changed how we represented available units.

More stock earned a bounded pool. A wider load test exposed shared connections. A running store earned a gradual rollout.

We did not know this diagram at the start. And it is not the only possible answer. Every piece has a job because we can point to the failure that made us add it. That is how we will keep building systems from first principles.

**Reveal / bridge:** Build something small. Observe the failure. Earn the next change.

## 16 · Optional: the index path takes locks.

**Point / do:** Optional insert after frame 12. Keep detailed schema in study notes.

A logical row can involve more than one index record. Follow the lookup path: a secondary index leads to the clustered primary-key record. That can mean more locking work than the drawing suggests. A primary key aligned with the query can change that path. The exact effect depends on the schema and query; it is not a universal one-lock guarantee.

**Reveal / bridge:** Measure the access path before changing the key.

## 17 · Optional: nothing found can still lock.

**Point / do:** Optional insert after frame 12. Do not say READ COMMITTED removes every gap lock.

A locking query may protect the range where matching rows would appear, even when it returns no rows. That can obstruct a refill trying to insert there. Isolation settings affect this behavior. READ COMMITTED avoids the relevant search gap locking, but still has gap locks for some constraint checks. Change isolation for the transaction deliberately, not as a blanket speed switch.

**Reveal / bridge:** An empty result does not necessarily mean no locks were taken.

## 18 · Optional: two transactions form a cycle.

**Point / do:** Generic row-lock example. Avoid describing whole tables as locked.

Here is a generic deadlock, not Shopify’s exact transaction trace. Transaction one holds A and wants B. Transaction two holds B and wants A. Neither can complete while the other holds its lock. The database can choose a victim and roll back its transaction. A consistent acquisition order reduces these cycles, but we still need retry handling.

**Reveal / bridge:** Use consistent lock order, and still handle deadlock retries.
