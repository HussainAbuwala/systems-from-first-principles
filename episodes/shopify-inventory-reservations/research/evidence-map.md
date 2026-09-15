# Evidence notes — checked 2026-09-14

Our worked examples, transitions, diagrams and simplified algorithms are **proposed**, not recovered Shopify code or chronology. “Documented checkpoint” on the canvas points here; it does not authenticate every visual detail.

## Shopify checkpoint summary

Source: Emilie Noel, [We replaced Redis with MySQL for inventory reservations—and it scaled](https://shopify.engineering/scaling-inventory-reservations), May 12, 2026. This is a dated account, not proof of the complete current architecture.

| Frames | Documented checkpoint |
| --- | --- |
| 05–08 | Holds cover payment; successful payment leads to an inventory claim. Redis reservations and MySQL inventory created a split-write risk. An earlier single-row MySQL attempt encountered contention. |
| 09–12 | Unit rows use `SKIP LOCKED`. The ready pool caps at 1,000 per item/location. Exhaustion triggers inline refill with one replenisher; competing reservations wait. |
| 13 | Caller-attributed connection measurements exposed long-held sessions elsewhere in checkout. Cleanup and concurrency tuning restored headroom. |
| 14 | Dual writes enabled comparison, then gradual pod rollout. Redis remained available for rollback while dual writes continued. |
| 16–18 | Composite keys reduced index locking; transaction-scoped `READ COMMITTED` addressed refill-blocking gap locks; reserve deletes unit rows before inserting reservation records. |

## Mechanism references

- [MySQL: locking reads](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking-reads.html): skipped candidates are omitted, not proven absent; applies to row locks.
- [MySQL: isolation levels](https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-isolation-levels.html): locking depends on index access and isolation; `READ COMMITTED` retains some constraint-related gap locks.
- [MySQL: deadlock handling](https://dev.mysql.com/doc/refman/8.0/en/innodb-deadlocks-handling.html): consistent ordering and short transactions reduce risk; retries remain necessary.

## Attribution boundaries

Do not attribute our hold schema, expiry protocol, Redis script, exact crash arithmetic, connection-slot drawing, or generic deadlock cycle to Shopify. The post does not supply a complete payment recovery or inventory-adjustment protocol. Do not infer `inventory_group_id` means location. Do not present a stock pool as additional inventory.
