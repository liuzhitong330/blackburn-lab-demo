"""Rebuild the demo from the authors' public CRELES S1 data (no model fitting).

python -m pip install -r analysis/requirements.txt
python analysis/reproduce.py
Optional: --source /path/to/downloaded.dta avoids downloading again.

Raw clinical variables and original source IDs remain in the ignored .cache
directory. Public outputs contain only sample-history fields and relative T/S.
"""
from pathlib import Path
import argparse
import hashlib
import json
from urllib.request import Request, urlopen
import numpy as np
import pandas as pd

ROOT=Path(__file__).resolve().parents[1]
DATA_URL="https://doi.org/10.1371/journal.pone.0223766.s001"
DATA_SHA256="6ba6737bce46c956fd59162cf298018e9f6ff9c3181a6f0ce74869d7ca911575"
ARTICLE_URL="https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0223766"
NORMALIZATION_URL="https://doi.org/10.1371/journal.pone.0223766.s003"

def normalization(raw, years, fresh, pilot):
    """Published S2 equations. Not a new or validated correction model."""
    coefficient=.041 if pilot else .065
    return raw-(coefficient*years-.0064*years**2)+.043*(1-fresh)+.063*pilot

def change(p,adjusted=False):
    return p['adjusted2']-p['adjusted1'] if adjusted else p['raw2']-p['raw1']

def summary(pairs):
    r=np.array([change(p) for p in pairs])
    a=np.array([change(p,True) for p in pairs])
    if not len(r):return {'n':0}
    return dict(n=len(r),rawMedian=float(np.median(r)),adjustedMedian=float(np.median(a)),
        rawMean=float(r.mean()),adjustedMean=float(a.mean()),
        rawQ1=float(np.quantile(r,.25)),rawQ3=float(np.quantile(r,.75)),
        adjustedQ1=float(np.quantile(a,.25)),adjustedQ3=float(np.quantile(a,.75)),
        rawDecrease=int((r<0).sum()),adjustedDecrease=int((a<0).sum()),
        signSwitch=int((np.sign(r)!=np.sign(a)).sum()))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--source',type=Path)
    args=ap.parse_args()
    path=args.source or ROOT/'.cache'/'CRELES-2019-s001.dta'
    if not path.exists():
        path.parent.mkdir(parents=True,exist_ok=True)
        req=Request(DATA_URL,headers={'User-Agent':'CRELES-reproducibility-demo/1.0'})
        path.write_bytes(urlopen(req,timeout=90).read())
    sha=hashlib.sha256(path.read_bytes()).hexdigest()
    if sha!=DATA_SHA256:
        raise ValueError('Source checksum changed; inspect and version the change before rebuilding.')
    d=pd.read_stata(path,convert_categoricals=False)
    assert d.shape==(2229,47) and d.idsujeto.nunique()==1261
    assert not d.duplicated(['idsujeto','wave']).any()
    used=['idsujeto','wave','ts_num','inpilot','yrdna','bloodfresh','month1012','exage','expasubtl']
    assert not d[used].isna().any().any()
    assert d.ts_num.gt(0).all()
    assert d.wave.isin([1,2]).all()
    for c in ['inpilot','bloodfresh','month1012']:assert d[c].isin([0,1]).all()
    # Float64 math keeps the published formula transparent and reproducible.
    d['adjusted']=d.apply(lambda x:normalization(float(x.ts_num),float(x.yrdna),
        int(x.bloodfresh),int(x.inpilot)),axis=1)
    one=d[d.wave.eq(1)].set_index('idsujeto')
    two=d[d.wave.eq(2)].set_index('idsujeto')
    joined=one.join(two,how='inner',lsuffix='_1',rsuffix='_2').sort_index()
    assert len(joined)==968
    paired_ids={source:f'P{i:03d}' for i,source in enumerate(joined.index,start=1)}
    single_ids={source:f'U{i:03d}' for i,source in enumerate(
        sorted(set(d.idsujeto)-set(joined.index)),start=1)}
    display_ids=paired_ids|single_ids
    pairs=[]
    weights=[]
    for source,x in joined.iterrows():
        p=dict(id=display_ids[source],raw1=float(x.ts_num_1),raw2=float(x.ts_num_2),
            adjusted1=float(x.adjusted_1),adjusted2=float(x.adjusted_2),
            storage1=float(x.yrdna_1),storage2=float(x.yrdna_2),
            lot1=2010 if x.inpilot_1 else 2014,lot2=2010 if x.inpilot_2 else 2014,
            fresh1=bool(x.bloodfresh_1),fresh2=bool(x.bloodfresh_2),
            season1=bool(x.month1012_1),season2=bool(x.month1012_2),
            yearsBetween=float(x.exage_2)-float(x.exage_1),
            validMetadata=bool(x.yrdna_1>=0 and x.yrdna_2>=0),
            sameLot=bool(x.inpilot_1==x.inpilot_2),
            sameFresh=bool(x.bloodfresh_1==x.bloodfresh_2),
            sameSeason=bool(x.month1012_1==x.month1012_2))
        p['allMatched']=p['sameLot'] and p['sameFresh'] and p['sameSeason']
        assert p['yearsBetween']>0
        pairs.append(p)
        weights.append(float(x.expasubtl_1))
    primary=[p for p in pairs if p['validMetadata']]
    assert len(primary)==967
    observations=[dict(id=display_ids[int(x.idsujeto)],wave=int(x.wave),
        lot=2010 if x.inpilot else 2014,storageYears=float(x.yrdna),
        rawTS=float(x.ts_num),normalizedTS=float(x.adjusted),
        validMetadata=bool(x.yrdna>=0)) for x in d.itertuples()]
    valid=d[d.yrdna.ge(0)]
    low=float(valid.groupby('inpilot').yrdna.min().max())
    high=float(valid.groupby('inpilot').yrdna.max().min())
    lots=[]
    for pilot,x in valid.groupby('inpilot'):
        overlap=x[x.yrdna.between(low,high)]
        lots.append(dict(lot=2010 if pilot else 2014,n=len(x),
            min=float(x.yrdna.min()),max=float(x.yrdna.max()),
            overlapN=len(overlap),overlapDistinctValues=int(overlap.yrdna.nunique()),
            distribution=[dict(years=float(t),n=int(n)) for t,n in x.groupby('yrdna').size().items()]))
    summary_sets={'all':summary(primary),'allIncludingFlagged':summary(pairs),
        'sameLot':summary([p for p in primary if p['sameLot']]),
        'allMatched':summary([p for p in primary if p['allMatched']]),
        'differentLot':summary([p for p in primary if not p['sameLot']])}
    # Secondary weighted sensitivity is aggregate-only; weights do not enter the UI.
    good=np.array([p['validMetadata'] for p in pairs])
    r=np.array([change(p) for p in pairs])[good]
    a=np.array([change(p,True) for p in pairs])[good]
    w=np.array(weights)[good]
    weighted=dict(rawMean=float(np.average(r,weights=w)),adjustedMean=float(np.average(a,weights=w)),
        rawDecreaseProportion=float(np.average(r<0,weights=w)),
        adjustedDecreaseProportion=float(np.average(a<0,weights=w)),
        note='Baseline-weighted descriptive sensitivity only; not a full survey-design estimate or confidence interval.')
    dataset=dict(
        meta=dict(title='Sample history and paired telomere measurements',
            dataset='CRELES, published 2019',observations=2229,participants=1261,pairs=968,
            primaryPairs=967,flaggedPairs=1,units='Relative telomere-to-single-copy-gene ratio (T/S)',
            sampleType='Leukocyte DNA from whole-blood cell fractions, not isolated PBMC',
            freshnessDefinition='Blood cells stored for less than one YEAR before DNA extraction',
            seasonDefinition='October-December versus all other collection months',
            defaultExclusion='One pair has a negative recorded DNA storage duration. Retained for flagged-record sensitivity; not classified as assay failure.',
            displayIds='Demo-only identifiers. Original study IDs and clinical variables are not included.'),
        summary=summary_sets,
        flags=dict(lotChanged=sum(not p['sameLot'] for p in pairs),
            freshCategoryChanged=sum(not p['sameFresh'] for p in pairs),
            seasonChanged=sum(not p['sameSeason'] for p in pairs),
            allMatched=sum(p['allMatched'] for p in pairs)),
        pairs=pairs,observations=observations,
        support=dict(overlapMin=low,overlapMax=high,lots=lots,
            note='Overlapping ranges do not establish comparable samples. All 2014 observations in the shared range have one recorded storage value; no assay-year causal effect is identified.'),
        sources=[
            dict(title='Rosero-Bixby et al. (2019), PLOS ONE',url=ARTICLE_URL,role='Study design and provenance'),
            dict(title='S1 Data: public participant-level measurements',url=DATA_URL,role='Raw data',sha256=DATA_SHA256),
            dict(title='S2 Document: published normalization equations',url=NORMALIZATION_URL,role='Labeled sensitivity comparison',sha256='0384d01275b59a989b9e629529cd93e411660b06cfc249e889f6cbee17d652f5'),
            dict(title='Blackburn Telomere Core',url='https://blackburnlab.ucsf.edu/telomere-core-services-resources',role='Role relevance and precision guidance')],
        limitations=[
            'Descriptive secondary analysis, not a refit of the original weighted random-effects models or their multiple imputations.',
            'Published normalization is a sensitivity lens, not ground truth, a newly validated correction or a causal storage effect.',
            'Matching categories is not a quality gate. It does not equalize storage duration or eliminate selection and biological differences.',
            'No raw technical replicates, telomerase activity, flow data or processing timestamps are available. Do not infer ICC or PBMC handling effects.',
            'Change means wave 2 minus wave 1 in relative T/S, not base pairs, biological age, diagnosis or treatment response.'],
        weightedSensitivity=weighted)
    # Generated artifacts: never include the original Stata file or clinical fields.
    (ROOT/'data.js').write_text('window.UNIVERSITY_LAB_DEMO_DATA = '+json.dumps(dataset,separators=(',',':'),allow_nan=False)+';\n')
    results={k:v for k,v in dataset.items() if k not in ['pairs','observations']}
    (ROOT/'analysis'/'results.json').write_text(json.dumps(results,indent=2,allow_nan=False)+'\n')
    print(json.dumps({'rows':len(observations),'pairs':len(pairs),'primary':summary_sets['all'],
        'sourceSha256':sha},indent=2))

if __name__=='__main__':main()
