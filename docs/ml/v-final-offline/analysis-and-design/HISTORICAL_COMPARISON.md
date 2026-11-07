# Stored Phase 1 diagnostic comparison

NOT current-source inference, NOT product FPR, NOT final release evidence. See WEAKNESS_REPORT.md for cohort limitations.

| Model | Precision % | Recall % | F1 % | FPR % | FN / FP | Warm dynamic p50 / p95 / p99 ms | Total MiB |
|---|---:|---:|---:|---:|---:|---|---:|
| v14 | 92.67 | 74.37 | 82.52 | 38.89 | 61 / 14 | 18.38 / 36.53 / 58.35 | 87.52 |
| v15 | 92.19 | 74.37 | 82.33 | 41.67 | 61 / 15 | 16.98 / 36.97 / 58.17 | 87.52 |
| v16 | 90.76 | 70.17 | 79.15 | 47.22 | 71 / 17 | 17.39 / 38.19 / 60.49 | 87.52 |
| v17-minilm | 91.94 | 71.85 | 80.66 | 41.67 | 67 / 15 | 17.41 / 39.37 / 60.69 | 87.52 |
| v17-multilingual | 91.18 | 78.15 | 84.16 | 50.00 | 52 / 18 | 50.76 / 91.38 / 123.04 | 516.15 |
| v18-recovered | 91.19 | 73.95 | 81.67 | 47.22 | 62 / 17 | 8.62 / 14.56 / 19.27 | 198.33 |
| v-final | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT BUILT |
