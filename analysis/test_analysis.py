"""Independent deterministic checks for the generated CRELES demo data.

Run from any directory: python analysis/test_analysis.py
Uses only the Python standard library. Does not import reproduce.py.
The original-source checks in reproduce.py remain necessary: these tests audit
the published extract and formula implementation, not the original assay.
"""
from collections import Counter, defaultdict
import json
import math
from pathlib import Path
import statistics
import unittest

ROOT = Path(__file__).resolve().parents[1]
PREFIX = "window.UNIVERSITY_LAB_DEMO_DATA = "
text = (ROOT / "data.js").read_text(encoding="utf-8")
if not text.startswith(PREFIX) or not text.rstrip().endswith(";"):
    raise ValueError("Expected a generated data.js assignment, not executable input.")
DATA = json.loads(text[len(PREFIX):].rstrip().removesuffix(";"))


def s2(raw, years, fresh, lot):
    """Independent transcription of published S2 (not a fitted correction)."""
    if lot == 2010:
        return raw - .041 * years + .0064 * years * years + .043 * (not fresh) + .063
    if lot == 2014:
        return raw - .065 * years + .0064 * years * years + .043 * (not fresh)
    raise ValueError(f"Unexpected assay lot: {lot}")


def delta(pair, adjusted=False):
    field = "adjusted" if adjusted else "raw"
    return pair[field + "2"] - pair[field + "1"]


def sign(value):
    return (value > 0) - (value < 0)


class AnalysisTests(unittest.TestCase):
    def assertNear(self, actual, expected):
        self.assertTrue(math.isclose(actual, expected, rel_tol=0, abs_tol=1e-11),
                        f"{actual!r} != {expected!r}")

    def test_counts_and_unique_keys(self):
        observations, pairs = DATA["observations"], DATA["pairs"]
        self.assertEqual(len(observations), 2229)
        self.assertEqual(len(pairs), 968)
        self.assertEqual(len({p["id"] for p in pairs}), 968)
        self.assertEqual(len({(o["id"], o["wave"]) for o in observations}), 2229)
        sizes = Counter(Counter(o["id"] for o in observations).values())
        self.assertEqual(sizes, {1: 293, 2: 968})
        self.assertEqual(len({o["id"] for o in observations}), 1261)
        self.assertEqual({o["wave"] for o in observations}, {1, 2})

    def test_every_pair_and_observation_join(self):
        observations = {(o["id"], o["wave"]): o for o in DATA["observations"]}
        for p in DATA["pairs"]:
            with self.subTest(pair=p["id"]):
                self.assertGreater(p["yearsBetween"], 0)
                for wave in (1, 2):
                    suffix = str(wave)
                    o = observations[(p["id"], wave)]
                    self.assertNear(p["raw" + suffix], o["rawTS"])
                    self.assertNear(p["adjusted" + suffix], o["normalizedTS"])
                    self.assertNear(p["storage" + suffix], o["storageYears"])
                    self.assertEqual(p["lot" + suffix], o["lot"])
                    self.assertNear(p["adjusted" + suffix], s2(
                        p["raw" + suffix], p["storage" + suffix],
                        p["fresh" + suffix], p["lot" + suffix]))
                self.assertEqual(p["sameLot"], p["lot1"] == p["lot2"])
                self.assertEqual(p["sameFresh"], p["fresh1"] == p["fresh2"])
                self.assertEqual(p["sameSeason"], p["season1"] == p["season2"])
                self.assertEqual(p["allMatched"], p["sameLot"] and p["sameFresh"] and p["sameSeason"])
                self.assertEqual(p["validMetadata"], p["storage1"] >= 0 and p["storage2"] >= 0)

    def test_flagged_record_is_preserved_not_clamped(self):
        bad_o = [o for o in DATA["observations"] if o["storageYears"] < 0]
        bad_p = [p for p in DATA["pairs"] if not p["validMetadata"]]
        self.assertEqual(len(bad_o), 1)
        self.assertEqual(len(bad_p), 1)
        self.assertEqual(bad_o[0]["id"], bad_p[0]["id"])
        self.assertNear(bad_o[0]["storageYears"], -.5833333134651184)
        self.assertFalse(bad_o[0]["validMetadata"])
        self.assertTrue(all(o["validMetadata"] == (o["storageYears"] >= 0)
                            for o in DATA["observations"]))

    def test_cohort_headlines_and_published_summaries(self):
        primary = [p for p in DATA["pairs"] if p["validMetadata"]]
        groups = {
            "all": (primary, 967, 159),
            "allIncludingFlagged": (DATA["pairs"], 968, 160),
            "sameLot": ([p for p in primary if p["sameLot"]], 928, 149),
            "allMatched": ([p for p in primary if p["allMatched"]], 182, 31),
            "differentLot": ([p for p in primary if not p["sameLot"]], 39, 10),
        }
        for name, (pairs, n, switches) in groups.items():
            with self.subTest(cohort=name):
                self.assertEqual(len(pairs), n)
                self.assertEqual(sum(sign(delta(p)) != sign(delta(p, True)) for p in pairs), switches)
                summary = DATA["summary"][name]
                self.assertEqual(summary["n"], n)
                self.assertEqual(summary["signSwitch"], switches)
                for prefix, adjusted in (("raw", False), ("adjusted", True)):
                    values = [delta(p, adjusted) for p in pairs]
                    self.assertNear(summary[prefix + "Median"], statistics.median(values))
                    self.assertNear(summary[prefix + "Mean"], statistics.mean(values))
                    self.assertEqual(summary[prefix + "Decrease"], sum(v < 0 for v in values))
        self.assertNear(statistics.median(delta(p) for p in primary), .007000000000000006)
        self.assertNear(statistics.median(delta(p, True) for p in primary), -.008998157494432557)

    def test_storage_support_from_observations(self):
        lots = defaultdict(list)
        for o in DATA["observations"]:
            if o["storageYears"] >= 0:
                lots[o["lot"]].append(o["storageYears"])
        self.assertEqual({k: len(v) for k, v in lots.items()}, {2010: 976, 2014: 1252})
        low, high = max(map(min, lots.values())), min(map(max, lots.values()))
        self.assertNear(low, 3.8333332538604736)
        self.assertNear(high, 5.75)
        self.assertNear(DATA["support"]["overlapMin"], low)
        self.assertNear(DATA["support"]["overlapMax"], high)
        records = {x["lot"]: x for x in DATA["support"]["lots"]}
        for lot, values in lots.items():
            overlap = [v for v in values if low <= v <= high]
            self.assertEqual(len(overlap), {2010: 150, 2014: 431}[lot])
            self.assertEqual(records[lot]["overlapN"], len(overlap))
            self.assertEqual(records[lot]["overlapDistinctValues"], len(set(overlap)))
            self.assertEqual({x["years"]: x["n"] for x in records[lot]["distribution"]}, Counter(values))
        self.assertEqual(len({v for v in lots[2014] if low <= v <= high}), 1)

    def test_public_field_allowlist(self):
        # Exact fields prevent accidentally publishing source health variables.
        allowed_pair = {"id", "raw1", "raw2", "adjusted1", "adjusted2", "storage1", "storage2",
                        "lot1", "lot2", "fresh1", "fresh2", "season1", "season2", "yearsBetween",
                        "validMetadata", "sameLot", "sameFresh", "sameSeason", "allMatched"}
        allowed_observation = {"id", "wave", "lot", "storageYears", "rawTS", "normalizedTS", "validMetadata"}
        self.assertTrue(all(set(p) == allowed_pair for p in DATA["pairs"]))
        self.assertTrue(all(set(o) == allowed_observation for o in DATA["observations"]))


if __name__ == "__main__":
    unittest.main(verbosity=2)
