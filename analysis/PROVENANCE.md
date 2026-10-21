# CRELES sample-history analysis

Source: Rosero-Bixby L, Rehkopf DH, Dow WH, Lin J, Epel ES, Azofeifa J, et al. (2019). *Correlates of longitudinal leukocyte telomere length in CRELES: On the importance of DNA collection and storage procedures.* PLOS ONE 14(10): e0223766. [Article](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0223766). Article and accompanying supporting information are openly supplied under the article's [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) attribution terms. Changes here consist of a minimal-field extract, new display IDs and a secondary descriptive sensitivity analysis. This demo is unaffiliated with the authors or UCSF.

## Data and transformations

[S1 Stata dataset](https://doi.org/10.1371/journal.pone.0223766.s001): 2,229 sample-wave observations, 1,261 participants, 968 participants with two waves. The file's `ts_num` is the reported relative T/S measurement. It is not a raw Ct value or a length in base pairs. The study reports the Blackburn laboratory performed the telomere assays. Specimens are whole-blood cell-fraction DNA, not isolated PBMCs.

The public site exposes only measurement and sample-history fields using new display IDs. Original IDs, health variables and demographic characteristics are omitted. Fetch the original data through the reproduction script to trace the source-level joins. The `.cache` directory must never be committed.

Join wave 1 and 2 by the original participant ID after checking uniqueness. Preserve source values. There is one record with a negative recorded storage duration (−0.5833 years), which is not silently changed to zero. Its pair is omitted from the default 967-pair view but remains in the flagged-record sensitivity. A data-entry clarification is required; this does not establish that the assay failed.

`yrdna` contains fractional years. Use them as given: [S2](https://doi.org/10.1371/journal.pone.0223766.s003) defines exact years, despite a contradictory “completed years” label in the Stata file. `bloodfresh` means cells stored for less than **one year** before extraction, not same-day handling. `month1012` groups October–December versus other collection months. `inpilot=1` indicates the 2010 assay lot; zero indicates 2014.

## Published normalization sensitivity

Implement the source authors' S2 equations without refitting their model:

```
2010: adjusted = observed − (0.041 × years − 0.0064 × years²)
                 + 0.043 × old_blood + 0.063
2014: adjusted = observed − (0.065 × years − 0.0064 × years²)
                 + 0.043 × old_blood
old_blood = 1 − bloodfresh
```

These are a labeled model-based comparison, not biological ground truth or a new correction. The default primary metric is paired change in T/S (wave 2 minus wave 1), not annualized change. “Sign switch” means the sign differs between reported and model-adjusted change; it does not mean a clinically meaningful reversal. No biological minimum-change threshold is claimed.

Medians, counts and quartiles are unweighted descriptive sample statistics. Baseline-weighted means and decrease proportions are included in results.json only as a secondary sensitivity. No national-population, inferential, diagnostic or causal claim is made. Original publication regression and imputation results are not reproduced.

## Practical interpretation

Pair-history filters are audit lenses, not exclusion rules. Matching assay lot, broad cell-storage category and collection season does not equalize storage durations or remove biological and selection differences. Range overlap between assay lots is sparse: all 2014 observations within the shared range have a single storage value. This cannot isolate a causal effect of storage or assay year.

For a new study, the operational follow-up is to discuss a prospectively balanced re-assay/bridge-sample design and record collection, isolation, extraction, storage, thaw and assay identifiers. The historical data do not establish a processing deadline, PBMC isolation quality, telomerase signal, flow-cytometry result or technical-replicate ICC.

## Reproduction

```
python -m pip install -r analysis/requirements.txt
python analysis/reproduce.py
```

The script fetches S1 into an ignored cache, verifies SHA-256, checks keys/counts, rebuilds minimal public data.js and aggregate analysis/results.json. It does not write any source file. A changed checksum stops execution for review.

S1 SHA-256: `6ba6737bce46c956fd59162cf298018e9f6ff9c3181a6f0ce74869d7ca911575`

S2 PDF SHA-256: `0384d01275b59a989b9e629529cd93e411660b06cfc249e889f6cbee17d652f5`

The browser's CSV export is generated from the currently selected pair cohort, including its raw inputs, model-adjusted comparison and metadata flag; it must not be confused with the full source dataset.
