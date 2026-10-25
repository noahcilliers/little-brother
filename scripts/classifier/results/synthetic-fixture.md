# SYNTHETIC — CI fixture only, not real metrics

## Pair model synthetic-fixture (logreg)

SYNTHETIC DATA — not real metrics. 271 labelled pairs (161 gold) from 80 repositories/runs; metrics are out-of-fold, 5 folds grouped by repository, on gold labels. Calibration ECE 0.07 → 0.07.

| Relation             | Precision | Recall | F1   | Support | Settle threshold |
| -------------------- | --------- | ------ | ---- | ------- | ---------------- |
| duplicate            | 0.71      | 0.83   | 0.77 | 12      | 0.80             |
| independent          | 0.82      | 0.88   | 0.85 | 16      | 0.76             |
| intent_contradiction | 0.80      | 0.57   | 0.67 | 7       | 1.01             |
| ordering_dependency  | 0.94      | 1.00   | 0.97 | 15      | 0.50             |
| overlap_compatible   | 0.96      | 0.96   | 0.96 | 51      | 0.60             |
| repeats_failure      | 1.00      | 1.00   | 1.00 | 18      | 0.50             |
| semantic_conflict    | 0.93      | 0.82   | 0.87 | 17      | 0.50             |
| textual_conflict     | 1.00      | 1.00   | 1.00 | 25      | 0.50             |

Macro-F1 0.886; blocking precision 0.951.
Of 120 gold pairs no rule settles, the model settles 93 (0.78) at accuracy 1.00; that is 93 judge calls (~651.0 s at 7 s each) saved.

Per source (out-of-fold accuracy): synthetic 0.93 (n=161)

Settled without the judge, by source: synthetic 93/120 (accuracy 1.00)

Confusion (rows = truth, columns = predicted): see metrics.json.

### SYNTHETIC replay (not real metrics)

161 pairs scored against gold labels. Blocking = textual, semantic, intent or ordering conflict.

| Architecture    | Blocking precision | Blocking recall | Blocking F1 | Finding F1 | Relation accuracy | Judge calls / pair | Latency / pair |
| --------------- | ------------------ | --------------- | ----------- | ---------- | ----------------- | ------------------ | -------------- |
| rules only      | 1.00               | 0.52            | 0.68        | 0.61       | 0.35              | 0.00               | 0.05 ms        |
| pair model only | 0.95               | 0.91            | 0.93        | 0.97       | 0.93              | 0.00               | 0.06 ms        |
| cascade         | 1.00               | 0.98            | 0.99        | 0.98       | 0.98              | 0.17               | 1.2 s          |
| llm every pair  | 0.97               | 0.92            | 0.94        | 0.92       | 0.91              | 1.00               | 7.4 s          |
