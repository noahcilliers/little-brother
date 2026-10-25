# Pair model learning curve (gbdt)

1669 gold of 1709 labelled pairs from 336 repositories/runs. grouped-by-repository CV as train.py; each fold's training rows subsampled per label; scored on the full held-out fold, gold labels only. Mean ± sd over seeds [0, 1, 2].

| Training share | Train rows / fold | Macro-F1      | Blocking precision | Open pairs settled without the judge | Settled accuracy | ECE           |
| -------------- | ----------------- | ------------- | ------------------ | ------------------------------------ | ---------------- | ------------- |
| 10%            | 137               | 0.470 ± 0.059 | 0.680 ± 0.024      | 62% ± 33%                            | 98% ± 1%         | 0.018 ± 0.005 |
| 25%            | 342               | 0.509 ± 0.002 | 0.680 ± 0.001      | 91% ± 2%                             | 98% ± 0%         | 0.016 ± 0.003 |
| 50%            | 684               | 0.563 ± 0.075 | 0.793 ± 0.006      | 91% ± 1%                             | 98% ± 1%         | 0.017 ± 0.005 |
| 75%            | 1025              | 0.515 ± 0.003 | 0.783 ± 0.005      | 92% ± 0%                             | 98% ± 0%         | 0.019 ± 0.008 |
| 100%           | 1367              | 0.518 ± 0.000 | 0.787 ± 0.000      | 92% ± 0%                             | 98% ± 0%         | 0.018 ± 0.000 |
