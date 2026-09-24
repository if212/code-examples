# Round 5 eval (frozen package sha 089fa30f..., 2026-09-23)
| id | abs (r5) | abs (r3) | pair new vs base | margin |
|---|---|---|---|---|
| ecommerce-arch | 6.0 | 6.5 | 8.0 vs 5.8 new | clear |
| oauth-sequence | 6.0 | 7.0 | 7.7 vs 6.0 new | clear |
| snowflake-pipeline | 6.0 | 5.5 | 7.8 vs 5.6 new | clear |
| saas-erd | 6.5 | 6.5 | 8.6 vs 6.2 new | decisive |
| cicd-flow | 7.0 | 6.0 | 7.8 vs 7.0 new | clear |
| k8s-topology | 6.5 | 6.3 | 8.0 vs 5.5 new | clear |
| order-state | 7.5 | 6.5 | 8.6 vs 6.2 new | clear |
| rag-pipeline (held-out) | 5.5 | 6.5 | 7.8 vs 6.3 new | clear |
| c4-container (held-out) | 6.5 | 6.0 | 8.5 vs 4.5 new | decisive |
| saga-sequence (held-out) | 6.0 | 6.0 | 7.7 vs 6.7 new | clear |
| retry-code (new) | 7.0 | - | - | - |
| jwt-calls (new) | 7.0 | - | - | - |
Benchmarks: abs mean 6.35 (r3 6.28, baseline 5.26); pairwise 10/10 new (r3 9/10); mean pair score new 8.05 vs base 5.98.
Details: all.txt (RUN friction, JUDGE defects with root causes, PAIR reasons). Renders: ../new/<id>/.
