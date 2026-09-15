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

The ten-product median improved, but one of its three runs was substantially slower than the other two. The result is directional evidence that key distribution matters, not proof that one inventory row is the only bottleneck.

These are exploratory, client-observed measurements. They show that the test harness works and motivate the next controlled experiment. They are not a general capacity claim for Cloudflare Workers or D1.
