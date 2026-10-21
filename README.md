# Before interpreting telomere change

A sample-history audit built by Cathy Liu for discussion with the Blackburn Lab. Independent exploratory work; not affiliated with or endorsed by UCSF or the source authors.

**Live demo:** https://liuzhitong330.github.io/blackburn-lab-demo/

## The question

Which longitudinal telomere comparisons are sensitive to recorded sample history and the original paper's adjustment assumptions?

The interface connects two views: the storage-duration distributions behind two assay lots, and paired changes before/after the published model-based adjustment. Cohort filters are sensitivity lenses, not rules for accepting or rejecting assays. A proposed bridge-sample design turns the audit into a concrete discussion about future measurements.

## What the data support

- Public CRELES S1 data: 2,229 observations, 1,261 participants, 968 paired participants.
- Default audit: 967 pairs, omitting one pair with negative recorded storage time; the flagged pair remains available for sensitivity analysis.
- In those 967 pairs, 159 change direction under the published adjustment; the unweighted median paired change is +0.007 T/S before and approximately −0.009 T/S after adjustment.
- These are descriptive, method-sensitive changes, not evidence that individual measurements are wrong or that telomeres truly reversed direction. The adjustment's zero-storage/2014 reference includes extrapolation. No coefficient uncertainty is propagated.

T/S is a relative assay ratio, not base pairs or biological age. The source material is leukocyte DNA from whole-blood cell fractions, **not isolated PBMC data**. It cannot validate short-delay transport, isolation yield, telomerase activity, flow measurements, or technical-replicate precision.

## Reproduce

Use Python 3.12 or a compatible current Python environment:

```sh
python -m venv .venv
source .venv/bin/activate
python -m pip install -r analysis/requirements.txt
python analysis/reproduce.py
python analysis/test_analysis.py
python -m http.server 8765 --bind 127.0.0.1
```

Open http://127.0.0.1:8765/ in a browser. The site itself has no package dependencies or remote analytics.

The script downloads the source to ignored `.cache/`, verifies its SHA-256, checks keys and expected counts, and rebuilds `data.js` and `analysis/results.json`. To use an existing source download:

```sh
python analysis/reproduce.py --source /path/to/CRELES-2019-s001.dta
```

The independent standard-library test suite checks every pair's reconstructed adjustment, observation joins, metadata flags, cohort summaries, storage distributions and allowed public fields.

`data.js` contains only measurement/sample-history fields with display-only identifiers. Original study IDs, demographics, and clinical variables are not republished. Browser CSV exports reflect the active cohort and preserve the metadata flag.

## Sources and methods

[Rosero-Bixby et al. (2019), PLOS ONE](https://doi.org/10.1371/journal.pone.0223766), [S1 data](https://doi.org/10.1371/journal.pone.0223766.s001), and [S2 equations](https://doi.org/10.1371/journal.pone.0223766.s003). The study reports assays performed by the Blackburn laboratory. Source materials are attributed under their CC BY terms; this is a transformed, secondary analysis.

See [analysis/PROVENANCE.md](analysis/PROVENANCE.md) for equations, exclusions, source checksums, and limitations; [analysis/results.json](analysis/results.json) for machine-readable aggregates. This is not a refit of the paper's weighted, multiply-imputed panel analysis. Quartiles describe participant spread, not confidence intervals.

The [Blackburn Telomere Core](https://blackburnlab.ucsf.edu/telomere-core-services-resources) and its [TRN project](https://trn.tulane.edu/about-trn/u01-labs/elizabeth-blackburn-lab/) motivate the sample-handling and measurement-quality focus. No relevant lab-owned GitHub repository was verified; the demo uses the primary public data instead.

## Authorship and scope

Developed with AI-assisted coding and analysis, with source-based numerical and interface checks. The project demonstrates research reasoning, traceable analysis, and scientific communication; it is not evidence of unaided software implementation or hands-on PBMC/telomere-assay experience.

Contact: Cathy Liu · cathyliu014@gmail.com · 415-216-3799
