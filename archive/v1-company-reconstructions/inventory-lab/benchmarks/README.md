# Inventory benchmark evidence

These JSON artifacts were generated on September 15, 2026 by `scripts/run-load-experiment.mjs` from one load-generator process in Toronto. The target was the isolated `systems-from-first-principles-benchmark` Cloudflare Worker and its dedicated D1 database in the ENAM region.

The hot-product scenarios use the crash-safe `transactional_hold` path from Stage 06 with 50 units, 100 buyers, and one unit requested per buyer. Each concurrency level was run three times. The website displays the median of the three measurements for each metric. Server percentiles include all 100 completed requests: 50 accepted transactions and 50 out-of-stock decisions.

| Concurrent requests | Median throughput | Median client p95 | Median server p95 |
| ---: | ---: | ---: | ---: |
| 5 | 32.9 req/s | 237.3 ms | 210.0 ms |
| 20 | 88.8 req/s | 318.3 ms | 282.0 ms |
| 50 | 109.4 req/s | 559.4 ms | 523.0 ms |

Every run returned zero request errors and conserved all 50 inventory units. The mixed-quantity scenario used 150 units and 100 buyers requesting quantities from 1 through 5. Every run committed exactly 150 units without negative stock.

The key-distribution comparison keeps 50 units, 100 buyers, concurrency 50, the Worker and the D1 database fixed. One workload targets one product with 50 units; the other sends ten requests to each of ten products with five units each.

| Products | Median throughput | Median client p95 | Median server p95 |
| ---: | ---: | ---: | ---: |
| 1 | 109.4 req/s | 559.4 ms | 523.0 ms |
| 10 | 126.4 req/s | 454.5 ms | 408.0 ms |

The ten-product median improved, but one of its three runs was substantially slower than the other two. That first attempt was too short and mixed accepted transactions, rejected requests, and educational trace writes, so it generated a hypothesis rather than a capacity conclusion.

## Stronger paired experiment

`strong-success-c50.json` contains the follow-up experiment. Each scenario has 1,000 buyers, 1,000 units and concurrency 50, so all 1,000 requests execute the same successful reservation transaction. Performance requests disable the educational event-trace writes. Ten one-product/ten-product pairs were run, reversing their order every pair. This produced 20,000 measured requests and 20,000 operation-level timing samples.

| Products | Median throughput | Median client p95 | Median server p95 | Median transaction p95 |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 160.4 req/s | 511.0 ms | 461.5 ms | 291.5 ms |
| 10 | 159.6 req/s | 483.7 ms | 455.0 ms | 273.0 ms |

The paired mean throughput change for ten products was +0.8%, with a bootstrap 95% interval from −4.1% to +6.0%; ten products won only 3 of 10 throughput pairs. Client p95 moved in a promising direction, winning 8 of 10 pairs, but its interval also crossed zero (−11.6% to +3.5%). The transaction p95 interval was much wider (−20.1% to +20.1%).

All 20 runs returned zero errors, recorded timing for every request and conserved all 20,000 inventory units. The stronger result does not reproduce the first attempt's throughput improvement. Distributing records inside one D1 database does not create a reliable increase in write capacity for this workload.

## Database partitioning experiment

`strong-database-shards-c50.json` keeps the stronger experiment's ten products, 1,000 buyers, 1,000 units, concurrency 50, successful transaction path and trace-free measurement. It changes one architectural variable: all ten products share one D1 database, or the same products are routed round-robin across four independent D1 databases. Ten alternating pairs produced another 20,000 measured requests.

| Databases | Median throughput | Median client p95 | Median server p95 | Median transaction p95 |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 187.0 req/s | 408.0 ms | 367.5 ms | 192.5 ms |
| 4 | 278.7 req/s | 299.6 ms | 271.0 ms | 132.5 ms |

Four databases increased paired mean throughput by 48.6%, with a bootstrap 95% interval from +42.7% to +54.0%, and won all 10 throughput pairs. Client p95 fell by 25.1% on average (95% interval −33.0% to −17.6%) and improved in all 10 pairs. Transaction p95 fell by 30.5% on average (95% interval −40.2% to −19.5%) and improved in 9 of 10 pairs.

All 20 runs returned zero errors, captured timing for every request and conserved all 20,000 units. Combined with the one-database row-distribution result, this shows that the shared D1 database was a material bottleneck for this workload. Partitioning also introduces product-to-database routing and makes operations spanning several shards more complex.

These are exploratory, client-observed measurements from this deployment and workload. They are not a general capacity claim for Cloudflare Workers or D1.
