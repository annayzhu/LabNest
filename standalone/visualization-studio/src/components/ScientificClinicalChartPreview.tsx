"use client";

import { calibrationBins, decisionCurve, precisionRecallCurve, type BinaryPrediction } from "@/lib/visualization-clinical";
import { kaplanMeier } from "@/lib/visualization-advanced";
import { categoricalColorForIndex, compactLegendLabel, estimateLegendTextWidth, formatTick, parseNumericValue, scaleLinear, type ParsedDataset, type VisualizationSettings } from "@/lib/visualization-studio";

export type ClinicalPlotType = "funnel" | "precision-recall" | "calibration" | "decision-curve" | "nomogram" | "lasso-path" | "km-cutoff" | "risk-score";
type Frame = { width: number; height: number; left: number; right: number; top: number; bottom: number; plotWidth: number; plotHeight: number };
type Props = { type: ClinicalPlotType; frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[]; gridColor: string };
const TEXT = "#23242A";

function axes(frame: Frame, settings: VisualizationSettings, xLabel: string, yLabel: string) {
  const bottom = frame.top + frame.plotHeight;
  return <g><line x1={frame.left} x2={frame.left + frame.plotWidth} y1={bottom} y2={bottom} stroke={TEXT} strokeWidth={settings.axisLineWidth} /><line x1={frame.left} x2={frame.left} y1={frame.top} y2={bottom} stroke={TEXT} strokeWidth={settings.axisLineWidth} />{xLabel ? <text x={frame.left + frame.plotWidth / 2} y={frame.height - 13} textAnchor="middle" fill={TEXT} fontSize={settings.axisLabelSize} fontWeight={600}>{xLabel}</text> : null}{yLabel ? <text transform={`translate(18 ${frame.top + frame.plotHeight / 2}) rotate(-90)`} textAnchor="middle" fill={TEXT} fontSize={settings.axisLabelSize} fontWeight={600}>{yLabel}</text> : null}</g>;
}
function numericAxes(frame: Frame, settings: VisualizationSettings, xDomain: [number, number], yDomain: [number, number], xLabel: string, yLabel: string, gridColor: string) {
  const bottom = frame.top + frame.plotHeight;
  const ticks = Array.from({ length: 5 }, (_, index) => index / 4);
  return <g data-clinical-axes>{ticks.map((fraction) => {
    const x = frame.left + fraction * frame.plotWidth;
    const y = bottom - fraction * frame.plotHeight;
    const xValue = xDomain[0] + fraction * (xDomain[1] - xDomain[0]);
    const yValue = yDomain[0] + fraction * (yDomain[1] - yDomain[0]);
    return <g key={fraction}>
      {settings.grid !== "none" ? <line x1={frame.left} x2={frame.left + frame.plotWidth} y1={y} y2={y} stroke={gridColor} strokeWidth={settings.gridLineWidth} /> : null}
      {settings.grid === "both" ? <line x1={x} x2={x} y1={frame.top} y2={bottom} stroke={gridColor} strokeWidth={settings.gridLineWidth} /> : null}
      <text x={frame.left - 7} y={y + 4} textAnchor="end" fill={TEXT} fontSize={settings.tickSize}>{formatTick(yValue)}</text>
      <text x={x} y={bottom + 17} textAnchor="middle" fill={TEXT} fontSize={settings.tickSize}>{formatTick(xValue)}</text>
    </g>;
  })}{axes(frame, settings, xLabel, yLabel)}</g>;
}
function binaryRows(dataset: ParsedDataset, mapping: Record<string, string>, group: string): BinaryPrediction[] { return dataset.rows.filter((row) => !mapping.group || (row[mapping.group] || "Model") === group).map((row) => ({ truth: parseNumericValue(row[mapping.truth]) === 1 ? 1 as const : 0 as const, score: parseNumericValue(row[mapping.score]) ?? 0 })); }
function modelGroups(dataset: ParsedDataset, mapping: Record<string, string>) { return [...new Set(dataset.rows.map((row) => mapping.group ? row[mapping.group] || "Model" : "Model"))]; }
function InlineModelLabel({ frame, settings, index, color, label }: { frame: Frame; settings: VisualizationSettings; index: number; color: string; label: string }) { return <text data-no-clip="true" data-full-label={label} x={frame.left + 8} y={frame.top + 15 + index * 15} fill={color} fontSize={settings.legendSize}><title>{label}</title>{compactLegendLabel(label, settings.legendSize, frame.plotWidth - 16, 42)}</text>; }

function CurveAxes({ frame, settings, xLabel, yLabel, gridColor }: { frame: Frame; settings: VisualizationSettings; xLabel: string; yLabel: string; gridColor: string }) { const bottom = frame.top + frame.plotHeight; return <>{[0, .25, .5, .75, 1].map((value) => { const x = frame.left + frame.plotWidth * value; const y = bottom - frame.plotHeight * value; return <g key={value}><line x1={frame.left} x2={frame.left + frame.plotWidth} y1={y} y2={y} stroke={gridColor} /><text x={frame.left - 7} y={y + 4} textAnchor="end" fill={TEXT} fontSize={settings.tickSize}>{value}</text><text x={x} y={bottom + 17} textAnchor="middle" fill={TEXT} fontSize={settings.tickSize}>{value}</text></g>; })}{axes(frame, settings, xLabel, yLabel)}</>; }

function PrecisionRecall({ frame, dataset, mapping, settings, colors, gridColor }: Omit<Props, "type">) { const groups = modelGroups(dataset, mapping); const x = (v: number) => frame.left + v * frame.plotWidth; const y = (v: number) => frame.top + (1 - v) * frame.plotHeight; return <><CurveAxes frame={frame} settings={settings} xLabel={settings.xLabel || "Recall (sensitivity)"} yLabel={settings.yLabel || "Precision (PPV)"} gridColor={gridColor} /><g data-plot-data>{groups.map((group, index) => { const result = precisionRecallCurve(binaryRows(dataset, mapping, group)); const color = categoricalColorForIndex(index, colors); const label = `${group}: AP ${result.auprc.toFixed(3)} · prevalence ${result.prevalence.toFixed(3)}`; return <g key={group} data-plot-element="pr-curve"><line x1={x(0)} x2={x(1)} y1={y(result.prevalence)} y2={y(result.prevalence)} stroke={color} strokeDasharray="3 4" opacity={0.45} /><polyline points={result.points.map((point) => `${x(point.recall)},${y(point.precision)}`).join(" ")} fill="none" stroke={color} strokeWidth={settings.dataLineWidth} /><InlineModelLabel frame={frame} settings={settings} index={index} color={color} label={label} /></g>; })}</g></>; }

function Calibration({ frame, dataset, mapping, settings, colors, gridColor }: Omit<Props, "type">) {
  const groups = modelGroups(dataset, mapping); const x = (value: number) => frame.left + value * frame.plotWidth; const y = (value: number) => frame.top + (1 - value) * frame.plotHeight;
  return <><CurveAxes frame={frame} settings={settings} xLabel={settings.xLabel || "Mean predicted probability"} yLabel={settings.yLabel || "Observed event proportion"} gridColor={gridColor} /><g data-plot-data><line x1={x(0)} x2={x(1)} y1={y(0)} y2={y(1)} stroke="#777A80" strokeDasharray="5 4" />{groups.map((group, index) => {
    const rows = binaryRows(dataset, mapping, group); const bins = calibrationBins(rows, settings.calibrationBinCount); const color = categoricalColorForIndex(index, colors);
    return <g key={group} data-plot-element="calibration-series"><polyline points={bins.map((bin) => `${x(bin.predicted)},${y(bin.observed)}`).join(" ")} fill="none" stroke={color} strokeWidth={settings.dataLineWidth} />{bins.map((bin, binIndex) => <g key={binIndex}><line x1={x(bin.predicted)} x2={x(bin.predicted)} y1={y(bin.lower)} y2={y(bin.upper)} stroke={color} /><circle cx={x(bin.predicted)} cy={y(bin.observed)} r={settings.pointSize * 0.55} fill={color}><title>{`n=${bin.n}; Wilson 95% CI ${bin.lower.toFixed(3)}–${bin.upper.toFixed(3)}`}</title></circle></g>)}<InlineModelLabel frame={frame} settings={settings} index={index} color={color} label={`${group} · n=${rows.length} · ${bins.length} bins`} /></g>;
  })}<text x={frame.left + frame.plotWidth - 4} y={frame.top + 13} textAnchor="end" fill="#777A80" fontSize={Math.max(7, settings.tickSize - 2)}>Ideal calibration</text></g></>;
}

function DecisionCurve({ frame, dataset, mapping, settings, colors, gridColor }: Omit<Props, "type">) {
  const groups = modelGroups(dataset, mapping);
  const thresholds: number[] = [];
  for (let threshold = settings.decisionThresholdMinimum; threshold <= settings.decisionThresholdMaximum + settings.decisionThresholdStep * 0.25; threshold += settings.decisionThresholdStep) thresholds.push(Number(Math.min(threshold, settings.decisionThresholdMaximum).toFixed(6)));
  if (thresholds.at(-1) !== settings.decisionThresholdMaximum) thresholds.push(settings.decisionThresholdMaximum);
  const all = groups.map((group) => ({ group, rows: decisionCurve(binaryRows(dataset, mapping, group), thresholds) })); const values = all.flatMap((entry) => entry.rows.flatMap((row) => [row.model, row.all, 0]));
  const xDomain: [number, number] = [settings.decisionThresholdMinimum, settings.decisionThresholdMaximum]; const yDomain: [number, number] = [Math.min(-0.05, ...values), Math.max(0.05, ...values)];
  const x = (value: number) => scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth]); const y = (value: number) => scaleLinear(value, yDomain, [frame.top + frame.plotHeight, frame.top]);
  return <>{numericAxes(frame, settings, xDomain, yDomain, settings.xLabel || "Threshold probability", settings.yLabel || "Net benefit", gridColor)}<g data-plot-data><line x1={x(settings.decisionThresholdMinimum)} x2={x(settings.decisionThresholdMaximum)} y1={y(0)} y2={y(0)} stroke="#777A80" />{all[0] ? <polyline data-plot-element="treat-all" points={all[0].rows.map((row) => `${x(row.threshold)},${y(row.all)}`).join(" ")} fill="none" stroke="#777A80" strokeDasharray="5 4" /> : null}{all.map((entry, index) => { const color = categoricalColorForIndex(index, colors); return <g key={entry.group}><polyline data-plot-element="decision-curve" points={entry.rows.map((row) => `${x(row.threshold)},${y(row.model)}`).join(" ")} fill="none" stroke={color} strokeWidth={settings.dataLineWidth} /><InlineModelLabel frame={frame} settings={settings} index={index} color={color} label={entry.group} /></g>; })}</g><text x={frame.left + frame.plotWidth - 4} y={y(0) - 5} textAnchor="end" fill="#777A80" fontSize={settings.tickSize}>Treat none</text><text x={frame.left + frame.plotWidth - 4} y={frame.top + 13} textAnchor="end" fill="#777A80" fontSize={Math.max(7, settings.tickSize - 2)}>Treat all · shared cohort</text><text data-no-clip="true" data-plot-element="decision-threshold-grid" x={frame.left} y={frame.top + frame.plotHeight + 31} fill={TEXT} fontSize={Math.max(7, settings.tickSize - 2)}>{`Grid ${settings.decisionThresholdMinimum.toFixed(3)}–${settings.decisionThresholdMaximum.toFixed(3)} · Δ ${settings.decisionThresholdStep.toFixed(3)} · ${thresholds.length} thresholds`}</text></>;
}

function Funnel({ frame, dataset, mapping, settings, colors, gridColor }: Omit<Props, "type">) {
  const rows = dataset.rows.map((row) => ({ label: row[mapping.label], effect: parseNumericValue(row[mapping.estimate]) ?? 0, se: parseNumericValue(row[mapping.error]) ?? 1 }));
  const weights = rows.map((row) => 1 / (row.se * row.se));
  const reference = rows.reduce((sum, row, index) => sum + row.effect * weights[index], 0) / Math.max(1e-9, weights.reduce((a, b) => a + b, 0));
  const effects = rows.flatMap((row) => [row.effect, reference - 1.96 * row.se, reference + 1.96 * row.se]);
  const rawMinimum = Math.min(...effects); const rawMaximum = Math.max(...effects); const xPadding = Math.max(0.05, (rawMaximum - rawMinimum) * 0.04);
  const xDomain: [number, number] = [rawMinimum - xPadding, rawMaximum + xPadding];
  const maxPrecision = Math.max(...rows.map((row) => 1 / row.se));
  const yDomain: [number, number] = [0, maxPrecision * 1.08];
  const x = (value: number) => scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth]);
  const y = (value: number) => scaleLinear(value, yDomain, [frame.top + frame.plotHeight, frame.top]);
  const precisionSteps = Array.from({ length: 30 }, (_, index) => maxPrecision * index / 29).slice(1);
  return <>
    {numericAxes(frame, settings, xDomain, yDomain, settings.xLabel || "Effect estimate", settings.yLabel || "Precision (1 / SE)", gridColor)}
    <g data-plot-data>
      <line x1={x(reference)} x2={x(reference)} y1={y(0)} y2={y(maxPrecision)} stroke={TEXT} strokeDasharray="5 4" />
      <polyline points={precisionSteps.map((precision) => `${x(reference - 1.96 / precision)},${y(precision)}`).join(" ")} fill="none" stroke="#8B8D92" />
      <polyline points={precisionSteps.map((precision) => `${x(reference + 1.96 / precision)},${y(precision)}`).join(" ")} fill="none" stroke="#8B8D92" />
      {rows.map((row, index) => <circle key={`${row.label}-${index}`} data-plot-element="funnel-study" cx={x(row.effect)} cy={y(1 / row.se)} r={settings.pointSize * 0.7} fill={colors[0]}><title>{`${row.label}: ${row.effect}; SE ${row.se}`}</title></circle>)}
    </g>
  </>;
}

function Nomogram({ frame, dataset, mapping, settings, colors }: Omit<Props, "type" | "gridColor">) {
  const predictors = [...new Set(dataset.rows.map((row) => row[mapping.group]))]; const maximum = Math.max(...dataset.rows.map((row) => parseNumericValue(row[mapping.value]) ?? 0), 1); const rowGap = frame.plotHeight / Math.max(1, predictors.length); const scaleEnd = maximum * 1.03;
  const x = (value: number) => scaleLinear(value, [0, scaleEnd], [frame.left + 70, frame.left + frame.plotWidth]);
  return <g data-plot-data>{predictors.map((predictor, index) => { const rows = dataset.rows.filter((row) => row[mapping.group] === predictor); const y = frame.top + rowGap * (index + 0.5); return <g key={predictor}><text data-full-label={predictor} x={frame.left} y={y + 4} fill={TEXT} fontSize={settings.tickSize} fontWeight={700}><title>{predictor}</title>{compactLegendLabel(predictor, settings.tickSize, 62, 12)}</text><line x1={x(0)} x2={x(maximum)} y1={y} y2={y} stroke="#B7B8BC" />{rows.map((row, pointIndex) => { const points = parseNumericValue(row[mapping.value]) ?? 0; const label = row[mapping.label]; const labelFont = Math.max(7, settings.tickSize - 2); const compactLabel = compactLegendLabel(label, labelFont, 42, 10); const labelWidth = estimateLegendTextWidth(compactLabel, labelFont); const pointX = x(points); const labelX = Math.min(frame.left + frame.plotWidth - labelWidth / 2 - 2, Math.max(frame.left + 70 + labelWidth / 2 + 2, pointX)); return <g key={pointIndex}><circle data-plot-element="nomogram-point" cx={pointX} cy={y} r={settings.pointSize * 0.55} fill={categoricalColorForIndex(index, colors)} /><text data-full-label={label} x={labelX} y={y - 7} textAnchor="middle" fill={TEXT} fontSize={labelFont}><title>{label}</title>{compactLabel}</text></g>; })}</g>; })}<text x={frame.left + frame.plotWidth / 2} y={frame.height - 13} textAnchor="middle" fill={TEXT} fontSize={settings.axisLabelSize}>{settings.xLabel || "Assigned points (upstream model)"}</text></g>;
}

function LassoPath({ frame, dataset, mapping, settings, colors, gridColor }: Omit<Props, "type">) { const features = [...new Set(dataset.rows.map((row) => row[mapping.group]))]; const rows = dataset.rows.map((row) => ({ x: Math.log10(parseNumericValue(row[mapping.x]) ?? 1), y: parseNumericValue(row[mapping.y]) ?? 0, feature: row[mapping.group] })); const xs = rows.map((row) => row.x); const ys = rows.map((row) => row.y); const xd: [number, number] = [Math.min(...xs), Math.max(...xs)]; const yd: [number, number] = [Math.min(...ys), Math.max(...ys)]; const x = (v: number) => scaleLinear(v, xd, [frame.left, frame.left + frame.plotWidth]); const y = (v: number) => scaleLinear(v, yd, [frame.top + frame.plotHeight, frame.top]); const labelFont = Math.max(8, settings.legendSize - 1); const labelStep = labelFont + 3; return <>{numericAxes(frame, settings, xd, yd, settings.xLabel || "log₁₀(λ)", settings.yLabel || "Coefficient", gridColor)}<g data-plot-data>{features.map((feature, index) => <g key={feature} data-plot-element="lasso-path"><polyline points={rows.filter((row) => row.feature === feature).sort((a, b) => a.x - b.x).map((row) => `${x(row.x)},${y(row.y)}`).join(" ")} fill="none" stroke={categoricalColorForIndex(index, colors)} strokeWidth={settings.dataLineWidth}><title>{feature}</title></polyline><text data-full-label={feature} x={frame.left + 7} y={frame.top + labelFont + index * labelStep} fill={categoricalColorForIndex(index, colors)} fontSize={labelFont}><title>{feature}</title>{compactLegendLabel(feature, labelFont, frame.plotWidth - 14, 40)}</text></g>)}</g></>; }

function CutoffKm({ frame, dataset, mapping, settings, colors, gridColor }: Omit<Props, "type">) {
  const cutoff = parseNumericValue(dataset.rows[0]?.[mapping.cutoff]) ?? 0;
  const groups = ["Low score", "High score"];
  const curves = groups.map((group) => {
    const observations = dataset.rows.filter((row) => ((parseNumericValue(row[mapping.score]) ?? 0) >= cutoff ? "High score" : "Low score") === group).map((row) => ({ time: parseNumericValue(row[mapping.time]) ?? 0, event: (parseNumericValue(row[mapping.event]) === 1 ? 1 : 0) as 0 | 1 }));
    return { group, n: observations.length, points: kaplanMeier(observations) };
  });
  const maxTime = Math.max(...dataset.rows.map((row) => parseNumericValue(row[mapping.time]) ?? 0), 1);
  const xDomain: [number, number] = [0, maxTime]; const yDomain: [number, number] = [0, 1];
  const x = (value: number) => scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth]);
  const y = (value: number) => scaleLinear(value, yDomain, [frame.top + frame.plotHeight, frame.top]);
  return <>
    {numericAxes(frame, settings, xDomain, yDomain, settings.xLabel || "Follow-up time", settings.yLabel || "Survival probability", gridColor)}
    <g data-plot-data>{curves.map((curve, index) => {
      const color = categoricalColorForIndex(index, colors);
      const path = curve.points.slice(1).reduce((current, point) => `${current} H ${x(point.time)} V ${y(point.survival)}`, `M ${x(0)} ${y(1)}`);
      return <g key={curve.group}>
        <path data-plot-element="cutoff-km" data-step-curve="right-continuous" d={path} fill="none" stroke={color} strokeWidth={settings.dataLineWidth} />
        {curve.points.filter((point) => point.censored > 0).map((point) => { const half = 3.5; const cx = x(point.time); const cy = y(point.survival); return <g key={point.time} data-plot-element="cutoff-km-censor" data-censored-count={point.censored} data-censor-time-x={cx} data-censor-survival-y={cy}><title>{`${point.censored} censored at time ${point.time}`}</title><line data-no-clip="true" x1={cx - half} x2={cx + half} y1={cy} y2={cy} stroke={color} strokeWidth={1.4} /><line data-no-clip="true" x1={cx} x2={cx} y1={cy - half} y2={cy + half} stroke={color} strokeWidth={1.4} /></g>; })}
        <text data-no-clip="true" data-full-label={curve.group} x={frame.left + 8} y={frame.top + 15 + index * 15} fill={color} fontSize={settings.legendSize}>{`${curve.group} · n=${curve.n}`}</text>
      </g>;
    })}</g>
    <g data-no-clip="true" fill={TEXT} fontSize={Math.max(7, settings.tickSize - 2)}><text x={frame.left} y={frame.top + frame.plotHeight + 31}>{`Supplied cutoff = ${cutoff} · upstream threshold.`}</text><text x={frame.left} y={frame.top + frame.plotHeight + 43}>Independent validation required.<title>Optimization and evaluation in the same cohort is exploratory and optimistic.</title></text></g>
  </>;
}

function RiskScore({ frame, dataset, mapping, settings, colors }: Omit<Props, "type" | "gridColor">) { const rows = dataset.rows.map((row) => ({ sample: row[mapping.label], score: parseNumericValue(row[mapping.score]) ?? 0, outcome: parseNumericValue(row[mapping.truth]) === 1 ? 1 : 0 })).sort((a, b) => a.score - b.score); const domain: [number, number] = [Math.min(...rows.map((row) => row.score)), Math.max(...rows.map((row) => row.score))]; const scoreBottom = frame.top + frame.plotHeight * .72; const x = (index: number) => frame.left + frame.plotWidth * (index + .5) / Math.max(1, rows.length); const y = (value: number) => scaleLinear(value, domain, [scoreBottom, frame.top]); return <>{axes(frame, settings, settings.xLabel || "Subjects ranked by score", settings.yLabel || "Risk score")}<g data-plot-data>{rows.map((row, index) => <g key={`${row.sample}-${index}`} data-plot-element="risk-subject"><line x1={x(index)} x2={x(index)} y1={scoreBottom} y2={y(row.score)} stroke={categoricalColorForIndex(row.outcome, colors)} strokeWidth={Math.max(1, settings.dataLineWidth * .7)} /><circle cx={x(index)} cy={y(row.score)} r={Math.max(1.5, settings.pointSize * .35)} fill={categoricalColorForIndex(row.outcome, colors)} /><rect x={x(index) - 2} y={scoreBottom + 18} width={4} height={12} fill={categoricalColorForIndex(row.outcome, colors)}><title>{`${row.sample}; outcome=${row.outcome}; score=${row.score}`}</title></rect></g>)}</g><g data-plot-element="risk-outcome-legend" transform={`translate(${frame.left + frame.plotWidth - 102} ${frame.top + 7})`} fontSize={Math.max(8, settings.legendSize - 1)} fill={TEXT}><rect x={0} y={-7} width={8} height={8} fill={categoricalColorForIndex(0, colors)} /><text x={12} y={0}>Outcome 0</text><rect x={58} y={-7} width={8} height={8} fill={categoricalColorForIndex(1, colors)} /><text x={70} y={0}>1</text></g><text x={frame.left} y={scoreBottom + 44} fill={TEXT} fontSize={Math.max(7, settings.tickSize - 2)}>Descriptive ranking · not model validation.</text></>; }

export function ScientificClinicalPlot(props: Props) { if (props.type === "funnel") return <Funnel {...props} />; if (props.type === "precision-recall") return <PrecisionRecall {...props} />; if (props.type === "calibration") return <Calibration {...props} />; if (props.type === "decision-curve") return <DecisionCurve {...props} />; if (props.type === "nomogram") return <Nomogram {...props} />; if (props.type === "lasso-path") return <LassoPath {...props} />; if (props.type === "km-cutoff") return <CutoffKm {...props} />; return <RiskScore {...props} />; }
