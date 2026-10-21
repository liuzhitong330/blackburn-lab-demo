(function () {
  "use strict";
  const data = window.UNIVERSITY_LAB_DEMO_DATA;
  const byId = (id) => document.getElementById(id);
  if (!data || !Array.isArray(data.pairs) || !data.support) {
    byId("support-readout").textContent = "The local data file did not load. Please reload this page or use the reproduction script.";
    byId("pair-readout").textContent = "No analysis has been displayed.";
    return;
  }

  const accent = "#1f7a8c";
  const gray = "#93999b";
  const ink = "#555";
  const number = (value) => Number(value).toLocaleString("en-US");
  const fixed = (value, digits = 4) => Number(value).toFixed(digits);
  const signed = (value, digits = 4) => (value > 0 ? "+" : "") + fixed(value, digits);
  const rawChange = (pair) => pair.raw2 - pair.raw1;
  const modelChange = (pair) => pair.adjusted2 - pair.adjusted1;
  const switches = (pair) => Math.sign(rawChange(pair)) !== Math.sign(modelChange(pair));
  const quantile = (values, q) => {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = (sorted.length - 1) * q;
    const lo = Math.floor(index);
    return sorted[lo] + (sorted[Math.ceil(index)] - sorted[lo]) * (index - lo);
  };
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function svgElement(tag, attrs, text) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, value));
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function addSvg(svg, tag, attrs, text) {
    const node = svgElement(tag, attrs, text);
    svg.appendChild(node);
    return node;
  }
  function svgText(svg, x, y, text, attrs = {}) {
    return addSvg(svg, "text", { x, y, fill: ink, "font-size": 12, ...attrs }, text);
  }
  function accessibleSvg(svg, titleId, descId, title, description) {
    svg.replaceChildren();
    addSvg(svg, "title", { id: titleId }, title);
    addSvg(svg, "desc", { id: descId }, description);
  }
  function readout(node, lead, detail) {
    node.replaceChildren(element("strong", lead), document.createTextNode(" " + detail));
  }

  const supportSvg = byId("support-viz");
  const rangeMin = data.support.overlapMin;
  const rangeMax = data.support.overlapMax;
  function renderSupport() {
    const overlapOnly = byId("storage-view").value === "overlap";
    const x = (years) => 72 + years / 10 * 505;
    const allCount = data.support.lots.reduce((sum, lot) => sum + lot.n, 0);
    const selectedCount = data.support.lots.reduce((sum, lot) =>
      sum + (overlapOnly ? lot.overlapN : lot.n), 0);
    accessibleSvg(supportSvg, "support-title", "support-description",
      "DNA storage duration by assay lot",
      "Stem height is number of observations at each exact recorded duration, with the same scale in both lots. " +
      (overlapOnly ? "Only the shared numerical range is shown." : "All non-negative recorded durations are shown.") +
      " All 431 observations from the 2014 lot in the shared range have the same recorded duration.");
    addSvg(supportSvg, "rect", {
      x: x(rangeMin), y: 22, width: x(rangeMax) - x(rangeMin), height: 221,
      fill: "#e6f1f3"
    });
    svgText(supportSvg, (x(rangeMin) + x(rangeMax)) / 2, 15,
      "Shared range", { "text-anchor": "middle", fill: accent, "font-size": 11 });
    const lots = data.support.lots.slice().sort((a, b) => a.lot - b.lot);
    lots.forEach((lot, index) => {
      const baseline = 115 + index * 113;
      const distribution = lot.distribution.filter((point) =>
        !overlapOnly || (point.years >= rangeMin && point.years <= rangeMax));
      const count = distribution.reduce((sum, point) => sum + point.n, 0);
      addSvg(supportSvg, "line", {
        x1: x(0), x2: x(10), y1: baseline, y2: baseline, stroke: "#c8ccce"
      });
      svgText(supportSvg, 0, baseline - 56, String(lot.lot), { "font-size": 14, "font-weight": 600 });
      svgText(supportSvg, 0, baseline - 37, "n = " + number(count), { "font-size": 10.5 });
      distribution.forEach((point) => {
        const height = point.n / 431 * 74;
        const mark = addSvg(supportSvg, "line", {
          x1: x(point.years), x2: x(point.years), y1: baseline, y2: baseline - height,
          stroke: lot.lot === 2014 ? accent : gray, "stroke-width": 4
        });
        mark.appendChild(svgElement("title", {}, lot.lot + ": " + fixed(point.years, 3) +
          " years; " + point.n + " observations"));
      });
      const peak = distribution.reduce((best, point) => point.n > best.n ? point : best, { n: 0 });
      if (peak.n) {
        svgText(supportSvg, x(peak.years), baseline - peak.n / 431 * 74 - 8,
          String(peak.n), { "text-anchor": "middle", "font-size": 11 });
      }
    });
    [0, 2, 4, 6, 8, 10].forEach((tick) => {
      addSvg(supportSvg, "line", { x1: x(tick), x2: x(tick), y1: 243, y2: 248, stroke: gray });
      svgText(supportSvg, x(tick), 265, String(tick), { "text-anchor": "middle" });
    });
    svgText(supportSvg, 325, 292, "Recorded DNA storage duration (years)", { "text-anchor": "middle" });
    readout(byId("support-readout"),
      overlapOnly ? "581 observations share a numerical range, not comparable coverage." :
        "The two assay lots have very different storage histories.",
      "The range overlaps from " + fixed(rangeMin, 2) + " to " + fixed(rangeMax, 2) +
      " years. Within it, all 431 observations from 2014 sit at one recorded duration (" +
      fixed(rangeMin, 3) + " years); 2010 has 150 observations at 13 other durations. " +
      "A range restriction alone cannot identify a storage or assay-lot effect.");
    byId("metric-one").textContent = number(data.meta.observations);
    byId("metric-two").textContent = number(data.meta.pairs);
    byId("metric-three").textContent = number(selectedCount);
    byId("metric-three-label").textContent = overlapOnly ?
      "observations in shared range" : "non-negative storage records";
    byId("support-caption").textContent =
      "Each stem is an exact recorded duration; height is observation count on a common scale (maximum 431). " +
      "Shading marks the shared numerical range. " + number(allCount) +
      " records have non-negative durations; one negative record is flagged and omitted from this storage chart.";
  }

  const pairSvg = byId("pair-viz");
  let selectedId = null;
  let currentPairs = [];
  const fullAxisLimit = Math.ceil(Math.max(...data.pairs.flatMap((pair) =>
    [Math.abs(rawChange(pair)), Math.abs(modelChange(pair))])) * 2) / 2;
  let axisLimit = fullAxisLimit;
  const plot = { left: 90, right: 575, top: 28, bottom: 348 };
  const scaleX = (value) => plot.left + (value + axisLimit) / (2 * axisLimit) * (plot.right - plot.left);
  const scaleY = (value) => plot.bottom - (value + axisLimit) / (2 * axisLimit) * (plot.bottom - plot.top);
  const inPlot = (pair) => Math.abs(rawChange(pair)) <= axisLimit && Math.abs(modelChange(pair)) <= axisLimit;

  function getPairs() {
    const cohort = byId("pair-cohort").value;
    const includeFlagged = byId("include-flagged").checked;
    return data.pairs.filter((pair) =>
      (includeFlagged || pair.validMetadata) &&
      (cohort === "all" || pair[cohort]));
  }

  function renderPairDetail() {
    const pair = currentPairs.find((candidate) => candidate.id === selectedId);
    if (!pair) return;
    byId("pair-select").value = pair.id;
    const previous = pairSvg.querySelector(".selected-ring");
    if (previous) previous.remove();
    if (inPlot(pair)) {
      addSvg(pairSvg, "circle", {
        class: "selected-ring", "data-id": pair.id,
        cx: scaleX(rawChange(pair)), cy: scaleY(modelChange(pair)),
        r: 6, fill: "none", stroke: "#1a1a1a", "stroke-width": 1.5, "pointer-events": "none"
      });
    }
    const container = byId("pair-detail");
    const heading = element("p");
    heading.append(element("strong", pair.id + ": "),
      document.createTextNode("deposited change " + signed(rawChange(pair)) +
      "; normalized change " + signed(modelChange(pair)) + " T/S. " +
      (switches(pair) ? "The signs differ." : "The signs agree.") +
      " Visits are " + fixed(pair.yearsBetween, 2) + " years apart; changes are not annualized."));
    const table = element("table");
    const thead = element("thead");
    const tr = element("tr");
    ["Recorded item", "Visit 1", "Visit 2"].forEach((label, index) => {
      const th = element("th", label);
      th.scope = "col";
      if (index === 0) th.className = "item-name";
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    const tbody = element("tbody");
    const rows = [
      ["Deposited T/S", fixed(pair.raw1), fixed(pair.raw2)],
      ["Source-normalized T/S", fixed(pair.adjusted1), fixed(pair.adjusted2)],
      ["DNA storage (years)", fixed(pair.storage1, 3), fixed(pair.storage2, 3)],
      ["Assay lot", pair.lot1, pair.lot2],
      ["Cell storage < 1 year", pair.fresh1 ? "Yes" : "No", pair.fresh2 ? "Yes" : "No"],
      ["Collection Oct–Dec", pair.season1 ? "Yes" : "No", pair.season2 ? "Yes" : "No"]
    ];
    rows.forEach((row) => {
      const line = element("tr");
      row.forEach((value, index) => {
        const cell = element(index === 0 ? "th" : "td", String(value));
        if (index === 0) cell.scope = "row";
        line.appendChild(cell);
      });
      tbody.appendChild(line);
    });
    table.append(thead, tbody);
    container.replaceChildren(heading, table);
    if (!inPlot(pair)) {
      container.prepend(element("p", pair.id + " is outside the current visual zoom. Its record remains in the cohort summary and CSV. Choose Full range to see its point.", "flag"));
    }
    if (!pair.validMetadata) {
      container.appendChild(element("p",
        "Metadata flag: a recorded storage duration is negative. It is preserved, not clamped or interpreted as a valid duration. The model comparison for this record is only a flagged-record sensitivity, not a validated correction.", "flag"));
    }
    container.appendChild(element("p",
      "These are demo-only identifiers. “Cell storage < 1 year” is the source's coarse pre-extraction category, not a same-day processing standard.", "small-note"));
  }

  function renderPairs() {
    currentPairs = getPairs();
    const closeView = byId("plot-range").value === "close";
    axisLimit = closeView ? 0.25 : fullAxisLimit;
    const raw = currentPairs.map(rawChange);
    const modeled = currentPairs.map(modelChange);
    const nSwitch = currentPairs.filter(switches).length;
    accessibleSvg(pairSvg, "pair-title", "pair-description",
      "Paired change in deposited versus paper-normalized T/S",
      currentPairs.length + " paired observations. " + nSwitch +
      " switch sign. Horizontal axis is deposited visit-two minus visit-one T/S; vertical axis is the same difference under source normalization. " +
      "Teal is a sign switch, not an invalid result. Use the person selector for keyboard-accessible inspection.");
    addSvg(pairSvg, "rect", { x: plot.left, y: plot.top, width: plot.right - plot.left,
      height: plot.bottom - plot.top, fill: "none", stroke: "#e2e2e2" });
    svgText(pairSvg, plot.right, 16, "Axes ±" + axisLimit + " T/S", { "text-anchor": "end", "font-size": 11 });
    // Both visual ranges use identical axes across cohorts. Zoom never changes the analysis set.
    const ticks = closeView ? [-0.2, -0.1, 0, 0.1, 0.2] :
      Array.from({ length: Math.round(4 * axisLimit) + 1 }, (_, index) => -axisLimit + index * 0.5);
    ticks.forEach((tick) => {
      const zero = Math.abs(tick) < 0.001;
      addSvg(pairSvg, "line", {
        x1: scaleX(tick), x2: scaleX(tick), y1: plot.top, y2: plot.bottom,
        stroke: zero ? "#abb2b4" : "#ededed", "stroke-width": zero ? 1.2 : 1
      });
      addSvg(pairSvg, "line", {
        x1: plot.left, x2: plot.right, y1: scaleY(tick), y2: scaleY(tick),
        stroke: zero ? "#abb2b4" : "#ededed", "stroke-width": zero ? 1.2 : 1
      });
      svgText(pairSvg, scaleX(tick), plot.bottom + 20, fixed(tick, closeView ? 2 : 1), { "text-anchor": "middle", "font-size": 11 });
      svgText(pairSvg, plot.left - 10, scaleY(tick) + 4, fixed(tick, closeView ? 2 : 1), { "text-anchor": "end", "font-size": 11 });
    });
    addSvg(pairSvg, "line", {
      x1: scaleX(-axisLimit), y1: scaleY(-axisLimit), x2: scaleX(axisLimit), y2: scaleY(axisLimit),
      stroke: "#a5adaf", "stroke-dasharray": "4 4"
    });
    const defs = addSvg(pairSvg, "defs", {});
    const clip = addSvg(defs, "clipPath", { id: "pair-plot-clip" });
    addSvg(clip, "rect", { x: plot.left, y: plot.top, width: plot.right - plot.left, height: plot.bottom - plot.top });
    const pointLayer = addSvg(pairSvg, "g", { "clip-path": "url(#pair-plot-clip)" });
    const visiblePairs = currentPairs.filter(inPlot);
    byId("plot-visibility").textContent = (closeView ? "Visual zoom only: " : "Full range: ") +
      number(visiblePairs.length) + " of " + number(currentPairs.length) + " points visible; " +
      number(currentPairs.length - visiblePairs.length) + " outside the plot. Summaries and CSV retain the full selected cohort.";
    // Draw sign-switch points last so their locations remain inspectable.
    visiblePairs.slice().sort((a, b) => Number(switches(a)) - Number(switches(b))).forEach((pair) => {
      const node = addSvg(pointLayer, "circle", {
        class: "selectable-point", "data-id": pair.id, cx: scaleX(rawChange(pair)), cy: scaleY(modelChange(pair)),
        r: switches(pair) ? 3.2 : 2.8, fill: switches(pair) ? accent : gray,
        opacity: switches(pair) ? 0.8 : 0.35
      });
      node.appendChild(svgElement("title", {}, pair.id + ": deposited " +
        signed(rawChange(pair)) + ", source-normalized " + signed(modelChange(pair)) + " T/S"));
      node.addEventListener("click", () => { selectedId = pair.id; renderPairDetail(); });
    });
    svgText(pairSvg, (plot.left + plot.right) / 2, 397, "Deposited change (T/S)", { "text-anchor": "middle" });
    svgText(pairSvg, 15, (plot.top + plot.bottom) / 2, "Source-normalized change (T/S)", {
      transform: "rotate(-90 15 " + ((plot.top + plot.bottom) / 2) + ")", "text-anchor": "middle"
    });
    readout(byId("pair-readout"),
      nSwitch + " of " + number(currentPairs.length) + " changes switch sign (" +
        fixed(100 * nSwitch / currentPairs.length, 1) + "%).",
      "Median change: deposited " + signed(quantile(raw, 0.5)) + " → source-normalized " +
      signed(quantile(modeled, 0.5)) + " T/S. This is sensitivity to a published model, not evidence that either value is biological truth.");
    const variation = element("p",
      "Middle 50% of changes: deposited " + signed(quantile(raw, 0.25)) + " to " +
      signed(quantile(raw, 0.75)) + "; source-normalized " + signed(quantile(modeled, 0.25)) +
      " to " + signed(quantile(modeled, 0.75)) + " T/S. These are observed spreads, not confidence intervals.",
      "readout-spread");
    byId("pair-readout").appendChild(variation);
    const includedFlagged = currentPairs.filter((pair) => !pair.validMetadata).length;
    byId("pair-readout").appendChild(element("p",
      includedFlagged ? "This view includes one flagged metadata pair. No negative duration was replaced." :
        (byId("include-flagged").checked ? "No flagged metadata pair meets this cohort filter." :
          "Default metadata rule: exclude the one negative-duration pair; retain every other pair in the selected history category."),
      "readout-spread"));
    const selector = byId("pair-select");
    selector.replaceChildren();
    currentPairs.forEach((pair) => {
      const option = element("option", pair.id + (switches(pair) ? " · signs differ" : " · signs agree") +
        (!pair.validMetadata ? " · metadata flag" : ""));
      option.value = pair.id;
      selector.appendChild(option);
    });
    if (!currentPairs.some((pair) => pair.id === selectedId)) {
      selectedId = (currentPairs.find(switches) || currentPairs[0]).id;
    }
    renderPairDetail();
  }

  function downloadPairs() {
    const columns = [
      "demo_id", "cohort_filter", "include_flagged_requested", "valid_storage_metadata",
      "deposited_ts_visit1", "deposited_ts_visit2", "source_normalized_ts_visit1",
      "source_normalized_ts_visit2", "deposited_change_ts", "source_normalized_change_ts",
      "sign_switch", "dna_storage_years_visit1", "dna_storage_years_visit2",
      "assay_lot_visit1", "assay_lot_visit2", "cell_storage_lt1year_visit1",
      "cell_storage_lt1year_visit2", "collection_oct_dec_visit1", "collection_oct_dec_visit2",
      "years_between_visits", "same_lot", "same_freshness_category", "same_season_category"
    ];
    const rows = currentPairs.map((pair) => [
      pair.id, byId("pair-cohort").value, byId("include-flagged").checked, pair.validMetadata,
      pair.raw1, pair.raw2, pair.adjusted1, pair.adjusted2, rawChange(pair), modelChange(pair),
      switches(pair), pair.storage1, pair.storage2, pair.lot1, pair.lot2, pair.fresh1, pair.fresh2,
      pair.season1, pair.season2, pair.yearsBetween, pair.sameLot, pair.sameFresh, pair.sameSeason
    ]);
    const escape = (value) => '"' + String(value).replace(/"/g, '""') + '"';
    const csv = [columns, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = element("a");
    link.href = url;
    link.download = "creles-paired-sensitivity-" + byId("pair-cohort").value +
      (byId("include-flagged").checked ? "-flagged-included" : "") + ".csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const methods = byId("methods-details");
  methods.replaceChildren(
    element("p", "The two source waves are joined by participant ID after uniqueness checks. Only T/S, specimen-history fields and new display IDs enter this page. One negative storage record (−0.583 years) is retained in the data, omitted from the storage chart and excluded from the default paired view."),
    element("p", "Source S2 normalization, applied without refitting: for 2010, normalized T/S = deposited T/S − (0.041 × years − 0.0064 × years²) + 0.043 × old-cell-storage + 0.063. For 2014, replace 0.041 with 0.065 and omit +0.063. Old-cell-storage equals 1 when cells were stored for at least one year before DNA extraction."),
    element("p", "The reference condition is fresh cells, zero DNA-storage years and the 2014 assay lot. The 2014 observations have no zero-storage samples, so this reference involves extrapolation. The model does not account for every source of biological or measurement variation."),
    element("p", "A paired change is visit 2 minus visit 1 in relative T/S, without division by the visit interval. A sign switch is a difference in the signs of the two changes; no minimum biological or clinical effect threshold is imposed. Medians, counts and linearly interpolated quartiles are unweighted sample summaries. Raw qPCR replicate uncertainty is unavailable; no confidence interval or rejection threshold is invented.")
  );
  byId("storage-view").addEventListener("change", renderSupport);
  byId("pair-cohort").addEventListener("change", renderPairs);
  byId("include-flagged").addEventListener("change", renderPairs);
  byId("plot-range").addEventListener("change", renderPairs);
  byId("pair-select").addEventListener("change", () => {
    selectedId = byId("pair-select").value;
    renderPairDetail();
  });
  byId("download-pairs").addEventListener("click", downloadPairs);
  renderSupport();
  renderPairs();
}());
