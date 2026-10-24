# SYNTHETIC — CI fixture only, not real metrics

## Pair model synthetic-fixture (gbdt)

SYNTHETIC DATA — not real metrics. 271 labelled pairs (161 gold) from 80 repositories/runs; metrics are out-of-fold, 5 folds grouped by repository, on gold labels. Calibration ECE 0.05 → 0.06.

| Relation             | Precision | Recall | F1   | Support | Settle threshold |
| -------------------- | --------- | ------ | ---- | ------- | ---------------- |
| duplicate            | 0.79      | 0.92   | 0.85 | 12      | 0.53             |
| independent          | 1.00      | 0.94   | 0.97 | 16      | 0.50             |
| intent_contradiction | 0.86      | 0.86   | 0.86 | 7       | 1.01             |
| ordering_dependency  | 0.65      | 0.73   | 0.69 | 15      | 0.76             |
| overlap_compatible   | 0.94      | 0.92   | 0.93 | 51      | 0.50             |
| repeats_failure      | 1.00      | 1.00   | 1.00 | 18      | 0.50             |
| semantic_conflict    | 0.87      | 0.76   | 0.81 | 17      | 0.50             |
| textual_conflict     | 1.00      | 1.00   | 1.00 | 25      | 0.50             |

Macro-F1 0.888; blocking precision 0.953.
Of 120 gold pairs no rule settles, the model settles 93 (0.78) at accuracy 0.99; that is 93 judge calls (~651.0 s at 7 s each) saved.

Per source (out-of-fold accuracy): synthetic 0.91 (n=161)

Settled without the judge, by source: synthetic 93/120 (accuracy 0.99)

Confusion (rows = truth, columns = predicted): see metrics.json.

### SYNTHETIC replay (not real metrics)

161 pairs scored against gold labels. Blocking = textual, semantic, intent or ordering conflict.

| Architecture    | Blocking precision | Blocking recall | Blocking F1 | Finding F1 | Relation accuracy | Judge calls / pair | Latency / pair |
| --------------- | ------------------ | --------------- | ----------- | ---------- | ----------------- | ------------------ | -------------- |
| rules only      | 1.00               | 0.52            | 0.68        | 0.61       | 0.35              | 0.00               | 0.05 ms        |
| pair model only | 0.95               | 0.95            | 0.95        | 0.97       | 0.91              | 0.00               | 0.07 ms        |
| cascade         | 1.00               | 0.94            | 0.97        | 0.97       | 0.97              | 0.17               | 1.1 s          |
| llm every pair  | 0.97               | 0.92            | 0.94        | 0.92       | 0.91              | 1.00               | 7.4 s          |
