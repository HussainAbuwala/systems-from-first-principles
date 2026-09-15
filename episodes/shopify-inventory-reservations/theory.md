# Two buyers, one last pair — presenter’s theory guide

The episode is a reconstruction: **we try a small design, see it fail, and change only what that failure requires.** Shopify is a real-world checkpoint along the way, not an architecture we reveal at the start. Our order is not Shopify’s development history.

Use [the recording script](scripts/recording-script.md) on camera. This document explains the reasoning behind it. Frame numbers match the [canvas](canvas/two-buyers-one-last-pair.excalidraw). The last three frames are optional technical notes.

## Our model and its limits

We sell one sneaker variant from one location, with overselling disabled. Inventory is accurate, every sale uses the same reservation authority, and stock adjustments are coordinated with it. These assumptions matter: correct checkout code cannot fix an incorrect warehouse count.

The rule is: **a unit cannot be promised to two active checkouts.** A hold is a promise; a completed sale is a commitment. We also want to avoid rejecting buyers when stock is available.

This is an inventory episode, not a complete payment implementation. Putting inventory records in one database does **not** put a card provider inside its transaction. Payment retries, uncertain results and late callbacks still need a recovery protocol. We explain that boundary rather than promise that nobody can ever need a refund.

## 01–02 · Start with one number, then race two shoppers

Build the store that seems sufficient for a quiet afternoon:

```text
read available quantity
if quantity > 0:
    accept the order
    write quantity - 1
```

With sequential requests, Alice reads 1, writes 0, and Bob is refused. Now overlap the requests. Alice reads 1; Bob reads 1; Alice writes 0; Bob writes 0. Both orders were accepted. The stored quantity is still zero, so a nonnegative counter alone does not prove correctness.

This is our invented failure demonstration. Keep payment out of this first example: the bug already exists in how we promise stock. Name the **race condition** only after the audience sees the two reads.

**Question that earns the next change:** can the check and the subtraction be one indivisible decision?

## 03 · Make the stock decision atomic

For an InnoDB table with a unique indexed item ID, a short committed statement can do this:

```sql
UPDATE inventory
SET available = available - 1
WHERE item_id = 42 AND available > 0;
```

One affected row means this request acquired availability; zero means it did not. Check the affected-row result and successful commit before reporting success. Errors and timeouts are not “sold out.” A lost response may mean a commit succeeded; retries need an operation identifier, not another blind decrement.

With two successful database requests competing for the last unit, the database orders their changes. The second cannot spend the same availability. An **atomic operation** is all-or-nothing; a **transaction** lets several database changes succeed or roll back together. Exclusive row locks last until transaction end, not merely until an individual SQL statement returns.

This is a useful design. It does not become wrong just because a larger company needs something else.

**Next failure:** we have allocated stock, but the buyer has not paid yet.

## 04–05 · Payment introduces time, so remember a hold

Subtract after payment and two people may pay before only one acquires stock. The atomic stock decision still works, but a buyer needs compensation. Subtract before payment and an abandoned checkout can strand availability unless we remember how to return it.

“Just add it back on failure” is a reasonable next thought. Then ask: what if the server crashes before adding it back? We need a durable record of who has the unit and whether the hold is still active. That record is a **reservation**.

In our simplified model, hold creation atomically checks availability and records an owner and expiry. After that short transaction commits, we call the payment provider. A later short transaction either claims the hold or releases it.

| Example state | Unsold stock | Active holds | Available to promise |
| --- | ---: | ---: | ---: |
| Before Alice starts | 1 | 0 | 1 |
| Alice holds the pair | 1 | 1 | 0 |
| Alice succeeds | 0 | 0 | 0 |
| Or Alice fails and releases | 1 | 0 | 1 |

The final two rows are alternative outcomes. “Unsold stock” is a simplified ledger balance, not a claim that a physical pair has already left the warehouse.

**Do not draw a database lock lasting throughout payment.** The durable hold outlives the short lock used to create it. A retry of the same claim/release must not consume or return inventory twice. Claim and expiry must compete for the same active state so only one wins. A late payment result after expiry cannot simply claim a unit already reassigned; it requires reconciliation or compensation. These are our design requirements, not disclosed Shopify internals.

**Next question:** how does this behave when many people buy the same product?

## 06 · Make the workload bigger, not the rules different

Explicitly change the example: **100 pairs, thousands of shoppers.** One last pair cannot demonstrate parallel successful sales; there is only one unit to give out.

Our first reservation implementation updates one aggregate item row on every hold. Even short transactions must take turns there. If each visit held the lock for an illustrative 2 ms, that single serialization point could serve at most roughly 500 such visits per second before other costs. This is arithmetic for intuition, not a benchmark or Shopify measurement.

Start by shortening transactions and measuring contention. Only after the single row actually limits the target workload do we try a different representation. Extra application servers do not create another copy of that authoritative lock.

**Next experiment:** could a fast in-memory store handle the busy reservation counter?

## 07–08 · Try Redis, then crash between two writes

In our experiment, Redis manages availability and holds, while MySQL keeps permanent inventory records. Reserving requires **check-positive-and-decrement atomically**, with ownership and retry handling. A bare `DECR` can go below zero; “every command is atomic” does not make an arbitrary multi-command program safe. A server-side script is one possible teaching implementation, not a claim about Shopify’s implementation.

Redis also serializes work. We are testing whether its short operations meet our load target, not claiming that Redis eliminates waiting.

Use one concrete claim failure, with an explicit simplified representation:

```text
available = MySQL unsold stock - Redis active holds
before claim: 1 - 1 = 0
payment has succeeded
remove Redis hold: 1 - 0 = 1
CRASH before deducting MySQL stock
another checkout can now acquire the same unit
```

Reverse those last two writes and a crash can hide availability instead. With two units, one held: deducting the sold unit leaves `1 - 1 = 0` until cleanup, despite another unit being available. These are illustrative interleavings, not Shopify’s exact counter algorithm.

A retry/reconciliation protocol could repair disagreement. Moving related inventory changes into one database is another option. The point is the extra correctness work created by the boundary, not that distributed consistency is impossible.

**Next objection:** returning to MySQL seems to bring back the hot row. Must every shopper change the same row?

## 09–10 · Change the representation before changing the database

Draw three sellable units as three separate rows. These are interchangeable stock permits, not individually tracked shoes. Alice can acquire row A while Bob acquires row B.

First show ordinary locking: Bob tries A while Alice is using it, even though B is free. Now introduce **`SKIP LOCKED`**: choose another unlocked candidate instead of waiting for A. Its value is visible before its name appears.

```sql
-- Teaching sketch, not production SQL or Shopify's schema.
BEGIN;
SELECT unit_id FROM available_units
WHERE item_id = 42
ORDER BY unit_id
LIMIT 1
FOR UPDATE SKIP LOCKED;
-- If one row was returned, delete that selected row
-- and create this checkout's durable hold in the SAME transaction.
COMMIT;
```

The application must branch on the result; no returned row means no hold was acquired. **It does not prove sold out:** candidates may be locked or the ready pool may need refill. Do not insert a hold with no unit. Multi-unit requests must acquire the full requested amount or roll back the partial acquisition before retrying.

[MySQL’s locking-read documentation](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking-reads.html) describes this deliberately incomplete view as useful for queue-like work; only row-lock waits are skipped. It does not remove all locks, guarantee fairness, or turn the query into an authoritative stock count.

With only one unit left, only one shopper can acquire it. Splitting rows improves concurrency when different units exist; it never creates more stock.

## 11 · Separate “reserve” from “claim” visually

Keep the following three boxes distinct:

1. **Reserve transaction:** consume an available unit row and record a hold, then commit.
2. **Payment:** an external operation with its own failures.
3. **Claim transaction:** validate the active hold, deduct the inventory ledger and end the hold, then commit.

The related inventory writes within each transaction succeed or roll back together. There is no transaction held open across all three boxes. This removes our split inventory-state commit gap; it does not make payment and inventory one atomic operation.

Also avoid updating the same hot aggregate counter on every reserve while claiming to have removed that bottleneck. Our row permits replace that reserve-path update. Ledger changes, refill and other paths can still serialize and need measurement.

## 12 · More inventory creates another problem: too many rows

A row for every unit is easy to explain, but the working set can grow unnecessarily. Introduce a **small ready pool** only now. Like a shelf refilled from a storeroom, it holds some available permits, not all stock.

The pool is a subset of unpromised inventory. Never add pool rows to the ledger balance, and never refill from a raw stock count without accounting for existing permits and active holds. That would manufacture availability. Our model serializes refill per item/location and calculates only missing backed permits; concurrent claim, release and stock changes must preserve that invariant.

An empty shelf is different from an empty warehouse. Resolve whether units are temporarily busy, need refill, or are truly unavailable before reporting sold out. The source-specific cap and fallback are in [the evidence notes](research/evidence-map.md); the cap is a measured choice, not a universal constant.

## 13 · A realistic final failure: the checkout path still stalls

Our load test now includes the rest of checkout. Individual reservation queries look fast, but requests queue before getting a database connection. A **connection pool** is a shared, limited set of database sessions. A fast query cannot start if another operation is holding every session.

Draw three occupied connection slots and one waiting reservation. Then label the owners. The next change is visibility into connection hold time by caller, followed by shortening the work that holds sessions too long. More database CPU alone may not resolve that wait.

Make this the main operational lesson. Exact index layouts and isolation terminology belong in the appendix. “Load test” should feel like the next experiment in our build, not a montage of terms.

## 14–15 · Replacing a running system is another design problem

A working prototype is not yet a safe replacement. Ask how to compare outcomes while one authority continues serving buyers. Shadow execution, gradual exposure and a maintained rollback path are the mechanisms to introduce here. A shadow discrepancy is evidence to investigate, not an instruction to merge two independent inventory decisions.

End by retracing the failures. Do not claim this architecture is inevitable or finished. We have earned each piece under the constraints we introduced, and the next workload change might make us revisit it.

## Optional frames 16–18 · Database details, after the main story

- **Index path:** a logical row can involve multiple index records. Explain why the access path affects lock work; avoid the blanket claim that adding columns to any primary key always gives exactly one lock.
- **Empty-range locking:** an empty locking query may still protect the searched range. `READ COMMITTED` changes those protections. It retains gap locks for foreign-key and duplicate-key checks; isolation is not a simple “stricter means everything locks more” ladder. See [MySQL’s isolation reference](https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-isolation-levels.html).
- **Deadlock:** use generic transactions T1 and T2 holding row A/B in opposite orders. Do not label that invented cycle as Shopify’s precise reserve/claim trace. Consistent ordering reduces cycles; production code must still handle transaction rollback and retry. See [MySQL’s deadlock guidance](https://dev.mysql.com/doc/refman/8.0/en/innodb-deadlocks-handling.html).

## Answers to keep ready

**Why not a queue?** A queue can serialize allocation correctly, and admission control can protect capacity. Batching or partitioning may make it practical. It has latency and throughput tradeoffs; it is not inherently incapable of deciding who gets stock.

**Why not optimistic locking?** It can work. A hot versioned row still has one successful modification at a time, with conflicts and retries to measure.

**Why not just keep Redis?** Also viable with the right recovery protocol. Our experiment asks whether inventory-local transactions can simplify the correctness work while meeting throughput needs.

**Does this guarantee exactly-once payment?** No. Repeated requests, lost acknowledgements, expiry and payment recovery require explicit handling outside the row-selection idea.

**Did Shopify build it in this order?** No. The reconstruction is ours. Only the dated facts in the evidence notes are attributed to Shopify.
