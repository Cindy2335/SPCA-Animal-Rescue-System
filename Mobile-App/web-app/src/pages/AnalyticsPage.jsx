import { useState } from "react";

const RANGE_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
  { label: "All time", value: "all" },
];

const TREND_SERIES = [
  { color: "#2f7d4f", key: "applications", label: "Applications" },
  { color: "#0f6ea8", key: "reports", label: "Stray reports" },
  { color: "#d17a00", key: "surrenders", label: "Surrenders" },
];

const TRAFFIC_TREND_SERIES = [
  { color: "#0f6ea8", key: "activeUsers", label: "Active users" },
  { color: "#7c3aed", key: "sessions", label: "Sessions" },
  { color: "#d17a00", key: "views", label: "Views" },
];

const ADOPTION_PIPELINE_STAGES = [
  { label: "Applications", status: "SUBMITTED" },
  { label: "Under review", status: "UNDER_REVIEW" },
  { label: "Inspection requested", status: "INSPECTION_REQUIRED" },
  { label: "Agent assigned", status: "INSPECTION_ASSIGNED" },
  { label: "Inspection completed", status: "INSPECTION_COMPLETED" },
  { label: "Approved", status: "APPROVED" },
  { label: "Pickup scheduled", status: "PICKUP_SCHEDULED" },
  { label: "Adopted", status: "ADOPTED" },
];

const BAR_PALETTE = ["#0f6ea8", "#2f7d4f", "#7c3aed", "#d17a00", "#b42318", "#7ba8c8"];

function formatNumber(value) {
  return new Intl.NumberFormat("en-ZA").format(value ?? 0);
}

function formatMetric(value, suffix = "") {
  return value === null || value === undefined ? "Not enough data" : `${formatNumber(value)}${suffix}`;
}

function formatPercentage(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "Not available";
  return `${new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 1 }).format(Number(value))}%`;
}

function formatDuration(value, unit) {
  if (value === null || value === undefined) return "Not enough completed cases";
  return `${formatNumber(value)} ${unit}${Number(value) === 1 ? "" : "s"}`;
}

function normalizeRange(value) {
  if (String(value).toLowerCase() === "all") return "all";
  const numericValue = Number(value);
  return [7, 30, 90].includes(numericValue) ? numericValue : null;
}

function formatRequestedRange(value, { lowerCase = false } = {}) {
  const label = normalizeRange(value) === "all" ? "All recorded history" : `Last ${Number(value) || 30} days`;
  return lowerCase ? label.toLowerCase() : label;
}

function normalizeGranularity(value) {
  const normalized = String(value || "day").toLowerCase();
  if (["month", "monthly"].includes(normalized)) return "month";
  if (["week", "weekly"].includes(normalized)) return "week";
  return "day";
}

function formatGranularity(value) {
  const granularity = normalizeGranularity(value);
  return `${granularity[0].toUpperCase()}${granularity.slice(1)}ly`;
}

function AnalyticsKpi({ label, note, tone, value }) {
  return (
    <article className={`analytics-kpi analytics-kpi-${tone}`}>
      <div>
        <span className="analytics-kpi-label">{label}</span>
        <strong>{value}</strong>
        <p>{note}</p>
      </div>
    </article>
  );
}

function formatTrendDate(value, options) {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-ZA", options);
}

function formatPreparedBucket(row, granularity) {
  const date = row.date;
  if (row.label) {
    return {
      label: row.label,
      rangeLabel: row.rangeLabel || (granularity === "day"
        ? formatTrendDate(date, { day: "numeric", month: "long", year: "numeric" })
        : row.label),
    };
  }
  if (granularity === "month") {
    const label = formatTrendDate(date, { month: "short", year: "numeric" });
    return {
      label,
      rangeLabel: formatTrendDate(date, { month: "long", year: "numeric" }),
    };
  }
  if (granularity === "week") {
    const label = formatTrendDate(date, { day: "numeric", month: "short" });
    return { label, rangeLabel: `Week of ${formatTrendDate(date, { day: "numeric", month: "long", year: "numeric" })}` };
  }
  const label = formatTrendDate(date, { day: "numeric", month: "short" });
  return { label, rangeLabel: formatTrendDate(date, { day: "numeric", month: "long", year: "numeric" }) };
}

function prepareOperationalTrend(data, granularityValue) {
  const granularity = normalizeGranularity(granularityValue);
  return data
    .filter((row) => row?.date)
    .slice()
    .sort((first, second) => String(first.date).localeCompare(String(second.date)))
    .map((row) => ({
      ...row,
      ...formatPreparedBucket(row, granularity),
      applications: Number(row.applications || 0),
      key: String(row.date),
      reports: Number(row.reports || 0),
      surrenders: Number(row.surrenders || 0),
    }));
}

function getChartScale(maxValue) {
  if (maxValue <= 4) {
    const max = Math.max(1, Math.ceil(maxValue));
    return { max, ticks: Array.from({ length: max + 1 }, (_, index) => index) };
  }
  const roughStep = maxValue / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalizedStep = roughStep / magnitude;
  const multiplier = normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 5 ? 5 : 10;
  const step = multiplier * magnitude;
  const max = Math.ceil(maxValue / step) * step;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, index) => index * step);
  return { max, ticks };
}

function ActivityDataTable({ data, granularity }) {
  return (
    <details className="analytics-chart-data">
      <summary>View historical activity data</summary>
      <div>
        <table>
          <thead><tr><th>{formatGranularity(granularity)} period</th><th>Applications</th><th>Stray reports</th><th>Surrenders</th><th>Total</th></tr></thead>
          <tbody>
            {data.map((row) => {
              const total = TREND_SERIES.reduce((sum, series) => sum + Number(row[series.key] || 0), 0);
              return (
                <tr key={row.key}>
                  <th scope="row">{row.rangeLabel}</th>
                  <td>{formatNumber(row.applications)}</td>
                  <td>{formatNumber(row.reports)}</td>
                  <td>{formatNumber(row.surrenders)}</td>
                  <td>{formatNumber(total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function OperationalHistoryChart({ data, granularity, period }) {
  const normalizedGranularity = normalizeGranularity(granularity);
  const chartData = prepareOperationalTrend(data, normalizedGranularity);
  const width = 960;
  const height = 340;
  const padding = { bottom: 56, left: 52, right: 18, top: 18 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  if (!chartData.length) {
    return (
      <div className="analytics-history-empty" role="status">
        <span aria-hidden="true" className="analytics-empty-chart-mark">—</span>
        <div><strong>No historical case activity was returned</strong><p>There are no dated applications, stray reports, or surrender requests in this reporting scope.</p></div>
      </div>
    );
  }

  const bucketTotals = chartData.map((row) => TREND_SERIES.reduce((sum, series) => sum + Number(row[series.key] || 0), 0));
  const totalActivity = bucketTotals.reduce((sum, value) => sum + value, 0);
  const maxValue = Math.max(
    0,
    ...chartData.flatMap((row) => TREND_SERIES.map((series) => Number(row[series.key] || 0)))
  );

  if (!maxValue) {
    return (
      <div className="analytics-history-empty" role="status">
        <span aria-hidden="true" className="analytics-empty-chart-mark">0</span>
        <div><strong>The history is available, with no new cases in it</strong><p>Every {normalizedGranularity} bucket contains zero applications, stray reports, and surrender requests.</p></div>
        <ActivityDataTable data={chartData} granularity={normalizedGranularity} />
      </div>
    );
  }

  const scale = getChartScale(maxValue);
  const baseline = padding.top + plotHeight;
  const xForIndex = (index) => chartData.length === 1
    ? padding.left + plotWidth / 2
    : padding.left + (index / (chartData.length - 1)) * plotWidth;
  const yForValue = (value) => baseline - (value / scale.max) * plotHeight;
  const labelStep = Math.max(1, Math.ceil(chartData.length / 7));
  const labelledRows = chartData.filter((_, index) => index % labelStep === 0 || index === chartData.length - 1);

  return (
    <div className="analytics-trend-wrap analytics-history-wrap">
      <div className="analytics-history-insights" aria-label="Historical activity highlights">
        <span><small>{period?.trendLimited ? "Cases in chart window" : "Cases created"}</small><strong>{formatNumber(totalActivity)}</strong></span>
      </div>
      <div aria-label="Chart series" className="analytics-chart-legend analytics-area-legend">
        {TREND_SERIES.map((series) => (
          <span key={series.key}><i style={{ backgroundColor: series.color }} />{series.label}</span>
        ))}
      </div>
      <svg
        aria-labelledby="operational-history-chart-title operational-history-chart-description"
        className="analytics-trend-chart analytics-history-chart"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <title id="operational-history-chart-title">Historical shelter case activity</title>
        <desc id="operational-history-chart-description">Line chart comparing applications, stray reports, and surrender requests from the same zero baseline across {chartData.length} {normalizedGranularity} periods. Exact values are available in the table after the chart.</desc>
        {scale.ticks.map((tick) => {
          const y = yForValue(tick);
          return (
            <g key={tick}>
              <line className="analytics-grid-line analytics-history-grid-line" x1={padding.left} x2={padding.left + plotWidth} y1={y} y2={y} />
              <text className="analytics-axis-label analytics-y-axis-label" textAnchor="end" x={padding.left - 10} y={y + 4}>{formatNumber(tick)}</text>
            </g>
          );
        })}
        {TREND_SERIES.map((series) => (
          <g aria-hidden="true" key={series.key}>
            <polyline
              className="analytics-history-series-line"
              fill="none"
              points={chartData.map((row, index) => `${xForIndex(index)},${yForValue(row[series.key])}`).join(" ")}
              stroke={series.color}
              vectorEffect="non-scaling-stroke"
            />
            {chartData.map((row, index) => (
              <circle
                className="analytics-history-series-point"
                cx={xForIndex(index)}
                cy={yForValue(row[series.key])}
                fill={series.color}
                key={`${row.key}-${series.key}`}
                r={chartData.length > 30 ? 2.5 : 4}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        ))}
        {labelledRows.map((row) => {
          const index = chartData.indexOf(row);
          return (
            <text
              className="analytics-axis-label analytics-x-axis-label"
              key={row.key}
              textAnchor={index === 0 ? "start" : index === chartData.length - 1 ? "end" : "middle"}
              x={xForIndex(index)}
              y={height - 18}
            >
              {row.label}
            </text>
          );
        })}
      </svg>
      <ActivityDataTable data={chartData} granularity={normalizedGranularity} />
    </div>
  );
}

function TrafficDataTable({ data, granularity }) {
  return (
    <details className="analytics-chart-data">
      <summary>View {normalizeGranularity(granularity) === "day" ? "daily" : "historical"} chart data</summary>
      <div>
        <table>
          <thead><tr><th>{formatGranularity(granularity)} period</th><th>Active users</th><th>Sessions</th><th>Views</th></tr></thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.rangeLabel}</th>
                <td>{formatNumber(row.activeUsers)}</td>
                <td>{formatNumber(row.sessions)}</td>
                <td>{formatNumber(row.views)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function TrafficZeroChart({ data, granularity, period, range }) {
  const hasDatedRows = data.length > 0;
  const scopeLabel = period?.label || formatRequestedRange(range);
  const checkedAllHistory = normalizeRange(period?.days ?? range) === "all";
  const startLabel = period?.from
    ? formatTrendDate(period.from, { day: "numeric", month: "short", year: "numeric" })
    : checkedAllHistory ? "First recorded event" : "Period start";
  const endLabel = period?.to
    ? formatTrendDate(period.to, { day: "numeric", month: "short", year: "numeric" })
    : "Today";

  return (
    <div className="analytics-zero-chart">
      <div aria-label="Chart series" className="analytics-chart-legend">
        {TRAFFIC_TREND_SERIES.map((series) => (
          <span key={series.key}><i style={{ backgroundColor: series.color }} />{series.label}</span>
        ))}
      </div>
      <div className="analytics-zero-plot">
        <svg aria-hidden="true" className="analytics-trend-chart" preserveAspectRatio="none" viewBox="0 0 960 300">
          {[42, 102, 162, 222].map((y, index) => (
            <g key={y}>
              <line className="analytics-grid-line" x1="48" x2="940" y1={y} y2={y} />
              <text className="analytics-axis-label" textAnchor="end" x="38" y={y + 4}>{3 - index}</text>
            </g>
          ))}
          <line className="analytics-zero-baseline" x1="48" x2="940" y1="222" y2="222" />
          <text className="analytics-axis-label" x="48" y="276">{startLabel}</text>
          <text className="analytics-axis-label" textAnchor="end" x="940" y="276">{endLabel}</text>
        </svg>
        <div className="analytics-zero-message" role="status">
          <span>{hasDatedRows ? "GA4 returned zero" : "No trend rows"}</span>
          <strong>{hasDatedRows ? "All three series are on the zero baseline" : "No dated engagement rows were returned"}</strong>
          <p>
            {hasDatedRows
              ? `${scopeLabel} contains reporting rows, but each users, sessions, and views value is 0.`
              : `${scopeLabel} does not yet contain processed GA4 activity.`}
            {checkedAllHistory ? " The full retained reporting history was checked." : " Choose All time to check the full retained history."}
          </p>
          <small>This is processed GA4 history, not a counter for only the current dashboard session. Newly sent events may not appear immediately.</small>
        </div>
      </div>
      {hasDatedRows ? <TrafficDataTable data={data} granularity={granularity} /> : null}
    </div>
  );
}

function TrafficTrendChart({ data = [], granularity, period, range }) {
  const normalizedGranularity = normalizeGranularity(granularity);
  const chartData = data
    .filter((row) => row?.date)
    .slice()
    .sort((first, second) => String(first.date).localeCompare(String(second.date)))
    .map((row) => ({
      ...formatPreparedBucket(row, normalizedGranularity),
      activeUsers: Number(row.activeUsers || 0),
      date: row.date,
      key: String(row.date),
      sessions: Number(row.sessions || 0),
      views: Number(row.views || 0),
    }));
  const width = 960;
  const height = 340;
  const padding = { bottom: 54, left: 54, right: 20, top: 20 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(
    0,
    ...chartData.flatMap((row) => TRAFFIC_TREND_SERIES.map((series) => row[series.key]))
  );

  if (!maxValue) {
    return <TrafficZeroChart data={chartData} granularity={normalizedGranularity} period={period} range={range} />;
  }

  const scale = getChartScale(maxValue);
  const baseline = padding.top + plotHeight;
  const xForIndex = (index) => chartData.length === 1
    ? padding.left + plotWidth / 2
    : padding.left + (index / (chartData.length - 1)) * plotWidth;
  const yForValue = (value) => baseline - (value / scale.max) * plotHeight;
  const labelStep = Math.max(1, Math.ceil(chartData.length / 7));
  const labelledRows = chartData.filter((_, index) => index % labelStep === 0 || index === chartData.length - 1);

  return (
    <div className="analytics-trend-wrap analytics-traffic-trend-wrap">
      <div aria-label="Chart series" className="analytics-chart-legend">
        {TRAFFIC_TREND_SERIES.map((series) => (
          <span key={series.key}><i style={{ backgroundColor: series.color }} />{series.label}</span>
        ))}
      </div>
      <svg
        aria-labelledby="traffic-trend-title traffic-trend-description"
        className="analytics-trend-chart analytics-line-chart"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <title id="traffic-trend-title">{formatGranularity(normalizedGranularity)} digital engagement</title>
        <desc id="traffic-trend-description">Line chart showing {normalizedGranularity} active users, sessions, and views. Exact values are available in the table after the chart.</desc>
        {scale.ticks.map((tick) => {
          const y = yForValue(tick);
          return (
            <g key={tick}>
              <line className="analytics-grid-line" x1={padding.left} x2={padding.left + plotWidth} y1={y} y2={y} />
              <text className="analytics-axis-label analytics-y-axis-label" textAnchor="end" x={padding.left - 10} y={y + 4}>{formatNumber(tick)}</text>
            </g>
          );
        })}
        {labelledRows.map((row) => {
          const index = chartData.indexOf(row);
          return (
            <text
              className="analytics-axis-label analytics-x-axis-label"
              key={row.date}
              textAnchor={index === 0 ? "start" : index === chartData.length - 1 ? "end" : "middle"}
              x={xForIndex(index)}
              y={height - 18}
            >
              {row.label}
            </text>
          );
        })}
        {TRAFFIC_TREND_SERIES.map((series) => {
          const points = chartData.map((row, index) => `${xForIndex(index)},${yForValue(row[series.key])}`).join(" ");
          return (
            <g aria-hidden="true" key={series.key}>
              <polyline
                className="analytics-line-path"
                fill="none"
                points={points}
                stroke={series.color}
                vectorEffect="non-scaling-stroke"
              />
              {chartData.map((row, index) => (
                <circle
                  className="analytics-line-point"
                  cx={xForIndex(index)}
                  cy={yForValue(row[series.key])}
                  fill={series.color}
                  key={`${row.key}-${series.key}`}
                  r={chartData.length > 30 ? 2 : 3}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
          );
        })}
      </svg>
      <TrafficDataTable data={chartData} granularity={normalizedGranularity} />
    </div>
  );
}

function BreakdownBars({ data, title, subtitle }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const max = Math.max(1, ...data.map((item) => item.value));

  return (
    <article className="analytics-panel analytics-breakdown-panel">
      <header>
        <div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>
        <strong>{formatNumber(total)}</strong>
      </header>
      {data.length ? (
        <div className="analytics-bars">
          {data.map((item, index) => (
            <div className="analytics-bar-row" key={item.status || item.label}>
              <div><span>{item.label}</span><strong>{formatNumber(item.value)}</strong></div>
              <div className="analytics-bar-track" aria-label={`${item.label}: ${item.value}`}>
                <i style={{ backgroundColor: BAR_PALETTE[index % BAR_PALETTE.length], width: `${(item.value / max) * 100}%` }} />
              </div>
              <small>{total ? Math.round((item.value / total) * 100) : 0}%</small>
            </div>
          ))}
        </div>
      ) : <div className="analytics-empty compact">No records in this period.</div>}
    </article>
  );
}

function CaseCompositionPanel({ items }) {
  const rows = items.map((item) => ({ ...item, value: Number(item.value || 0) }));
  const total = rows.reduce((sum, item) => sum + item.value, 0);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let accumulatedShare = 0;

  return (
    <article className="analytics-panel analytics-composition-panel">
      <header className="analytics-panel-heading">
        <div><span className="eyebrow">Case composition</span><h2>What created the workload</h2></div>
      </header>
      <div className="analytics-composition-body">
        <svg
          aria-labelledby="case-composition-title case-composition-description"
          className="analytics-donut"
          role="img"
          viewBox="0 0 144 144"
        >
          <title id="case-composition-title">New shelter case composition</title>
          <desc id="case-composition-description">Donut chart showing {formatNumber(total)} cases split between adoption applications, stray reports, and surrender requests. Exact values follow the chart.</desc>
          <circle className="analytics-donut-track" cx="72" cy="72" fill="none" r={radius} />
          {total ? rows.map((item) => {
            const share = item.value / total;
            const dashLength = share * circumference;
            const dashOffset = -accumulatedShare * circumference;
            accumulatedShare += share;
            return (
              <circle
                className="analytics-donut-segment"
                cx="72"
                cy="72"
                fill="none"
                key={item.key}
                r={radius}
                stroke={item.color}
                strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                strokeDashoffset={dashOffset}
              />
            );
          }) : null}
          <text className="analytics-donut-value" textAnchor="middle" x="72" y="69">{formatNumber(total)}</text>
          <text className="analytics-donut-label" textAnchor="middle" x="72" y="86">new cases</text>
        </svg>
        <ul className="analytics-composition-list" aria-label="Case composition values">
          {rows.map((item) => (
            <li key={item.key}>
              <i aria-hidden="true" style={{ backgroundColor: item.color }} />
              <span>{item.label}<small>{total ? Math.round((item.value / total) * 100) : 0}% of new cases</small></span>
              <strong>{formatNumber(item.value)}</strong>
            </li>
          ))}
        </ul>
      </div>
      {!total ? <p className="analytics-composition-empty">No new case records exist in this reporting scope.</p> : null}
    </article>
  );
}

function AdoptionPipeline({ data, subtitle }) {
  const counts = new Map(data.map((item) => [item.status, Number(item.value || 0)]));
  const stages = ADOPTION_PIPELINE_STAGES.map((stage) => ({
    ...stage,
    value: counts.get(stage.status) || 0,
  }));
  const declined = counts.get("DECLINED") || 0;
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);

  return (
    <article className="analytics-panel analytics-pipeline-panel">
      <header>
        <div><h2>Application status journey</h2><p>{subtitle} · each application appears once in its current stage</p></div>
        <strong>{formatNumber(total)}</strong>
      </header>
      <ol className="analytics-pipeline" aria-label="Adoption application stages">
        {stages.map((stage, index) => (
          <li key={stage.status}>
            <span className="analytics-pipeline-step">{index + 1}</span>
            <span>{stage.label}</span>
            <strong>{formatNumber(stage.value)}</strong>
          </li>
        ))}
      </ol>
      {declined ? (
        <div className="analytics-pipeline-outcome">
          <span>Alternative outcome · Declined</span>
          <strong>{formatNumber(declined)}</strong>
        </div>
      ) : null}
    </article>
  );
}

function PerformanceMetric({ label, note, value }) {
  return (
    <div className="analytics-performance-row">
      <div><span>{label}</span><small>{note}</small></div>
      <strong>{value}</strong>
    </div>
  );
}

function TrafficBreakdownPanel({ data = [], emptyMessage, secondaryLabel, subtitle, title, valueLabel }) {
  const rows = data.filter((item) => item?.label).map((item) => ({
    label: item.label,
    users: Number(item.users || 0),
    value: Number(item.value || 0),
  }));
  const max = Math.max(1, ...rows.map((item) => item.value));
  const total = rows.reduce((sum, item) => sum + item.value, 0);

  return (
    <article className="analytics-panel analytics-traffic-breakdown-panel">
      <header>
        <div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>
        <strong><span>{formatNumber(total)}</span><small>{valueLabel} shown</small></strong>
      </header>
      {rows.length ? (
        <ol className="analytics-ranked-list">
          {rows.map((item, index) => (
            <li key={`${item.label}-${index}`}>
              <span className="analytics-rank">{index + 1}</span>
              <div className="analytics-ranked-detail">
                <div>
                  <span title={item.label}>{item.label}</span>
                  <strong>{formatNumber(item.value)} <small>{valueLabel}</small></strong>
                </div>
                <div className="analytics-bar-track" aria-label={`${item.label}: ${formatNumber(item.value)} ${valueLabel}`}>
                  <i style={{ width: `${(item.value / max) * 100}%` }} />
                </div>
                {secondaryLabel ? <small>{formatNumber(item.users)} {secondaryLabel}</small> : null}
              </div>
            </li>
          ))}
        </ol>
      ) : <div className="analytics-empty compact">{emptyMessage}</div>}
    </article>
  );
}

function DigitalEngagementSection({
  data,
  error,
  loading,
  onRefresh,
  range,
}) {
  const summary = data?.summary || {};
  const period = data?.period || {};
  const periodLabel = period.label || formatRequestedRange(range);
  const trendGranularity = normalizeGranularity(period.granularity);
  const staleMessage = error || (data?.isStale ? "Google Analytics is temporarily unavailable" : "");
  const kpis = [
    { label: "Active users", note: "People who engaged with the app or site", tone: "blue", value: formatNumber(summary.activeUsers) },
    { label: "Sessions", note: "Visits started during this period", tone: "violet", value: formatNumber(summary.sessions) },
    { label: "Views", note: "App screens and web pages viewed", tone: "amber", value: formatNumber(summary.views) },
    { label: "Engagement rate", note: "Share of sessions that were engaged", tone: "green", value: formatPercentage(summary.engagementRate) },
    { label: "Key events", note: "Important tracked actions completed", tone: "blue", value: formatNumber(summary.keyEvents) },
  ];

  return (
    <section aria-labelledby="digital-engagement-heading" className="analytics-section">
      <div className="analytics-processed-heading">
        <div>
          <span className="eyebrow">Processed reporting</span>
          <strong id="digital-engagement-heading">Historical totals and trends · {periodLabel}</strong>
        </div>
        {loading ? <span className="analytics-refreshing" role="status">Updating history…</span> : null}
      </div>

      {loading && !data ? (
        <AnalyticsSkeleton label="Loading processed Google Analytics engagement" />
      ) : error && !data ? (
        <div className="analytics-error analytics-source-error" role="alert">
          <div>
            <strong>Processed digital engagement could not be loaded</strong>
            <span>{error}</span>
            <small>The live activity panel above and shelter operations remain independent.</small>
          </div>
          {onRefresh ? <button className="secondary-button" onClick={onRefresh} type="button">Try history again</button> : null}
        </div>
      ) : !data ? (
        <div className="analytics-error"><div><strong>Processed digital engagement is not available yet</strong><span>Connect the GA4 reporting endpoint to display historical visitor activity.</span></div></div>
      ) : (
        <>
          {staleMessage ? <div className="analytics-warning" role="status">{staleMessage}. Showing the last successful GA4 result.</div> : null}

          <section aria-label="Processed digital engagement summary" className="analytics-kpi-grid analytics-kpi-grid-five">
            {kpis.map((item) => <AnalyticsKpi {...item} key={item.label} />)}
          </section>
          <section className="analytics-panel analytics-trend-panel">
            <header className="analytics-panel-heading">
              <div><span className="eyebrow">{formatGranularity(trendGranularity)} history</span><h2>Users, sessions, and views</h2></div>
            </header>
            <TrafficTrendChart
              data={Array.isArray(data.trend) ? data.trend : []}
              granularity={trendGranularity}
              period={period}
              range={range}
            />
          </section>

          <section className="analytics-traffic-breakdown-grid">
            <TrafficBreakdownPanel
              data={Array.isArray(data.topScreens) ? data.topScreens : []}
              emptyMessage="No screen or page views were reported."
              title="Top screens"
              valueLabel="views"
            />
            <TrafficBreakdownPanel
              data={Array.isArray(data.channels) ? data.channels : []}
              emptyMessage="No acquisition channels were reported."
              secondaryLabel="active users"
              subtitle="Where visits originated"
              title="Acquisition channels"
              valueLabel="sessions"
            />
            <TrafficBreakdownPanel
              data={Array.isArray(data.keyEventBreakdown) ? data.keyEventBreakdown : []}
              emptyMessage="No key events were recorded in this period."
              subtitle="Important actions completed"
              title="Key events"
              valueLabel="events"
            />
          </section>
        </>
      )}
    </section>
  );
}

function AnalyticsSkeleton({ label = "Loading analytics" }) {
  return (
    <div aria-label={label} aria-live="polite" className="analytics-loading" role="status">
      {Array.from({ length: 4 }, (_, index) => <span key={index} />)}
    </div>
  );
}

function ShelterOperationsSection({ data, error, loading, range }) {
  if (loading && !data) return <AnalyticsSkeleton label="Loading shelter operations" />;

  if (error && !data) {
    return <div className="analytics-error" role="alert"><div><strong>Shelter operations could not be loaded</strong><span>{error}</span></div></div>;
  }

  if (!data) {
    return <div className="analytics-error"><div><strong>Shelter operations are not available</strong><span>No database analytics result was returned.</span></div></div>;
  }

  const breakdowns = data.breakdowns || {};
  const operations = data.operations || {};
  const adoption = operations.adoption || {};
  const reports = operations.reports || {};
  const surrenders = operations.surrenders || {};
  const period = data.period || { label: formatRequestedRange(range) };
  const summary = data.summary || {};
  const trend = Array.isArray(data.trend) ? data.trend : [];
  const trendGranularity = normalizeGranularity(period.granularity);
  const periodLabel = period.label || formatRequestedRange(range);
  const kpis = [
    { label: "Animals in care", note: `${formatNumber(summary.availableAnimals)} currently available`, tone: "blue", value: formatNumber(summary.totalAnimals) },
    { label: "Adoption success", note: `${formatNumber(adoption.adopted)} adopted from ${formatNumber(adoption.total)} applications`, tone: "green", value: formatMetric(summary.adoptionRate, "%") },
    { label: "Open stray reports", note: `${formatNumber(summary.unassignedActiveReports)} currently need an agent`, tone: summary.unassignedActiveReports ? "red" : "green", value: formatNumber(summary.activeReports) },
    { label: "Open surrenders", note: "Current backlog awaiting final intake", tone: "amber", value: formatNumber(summary.activeSurrenders) },
  ];
  const animalsByStatus = Array.isArray(breakdowns.animalsByStatus) ? breakdowns.animalsByStatus : [];
  const applicationsByStatus = Array.isArray(breakdowns.applicationsByStatus) ? breakdowns.applicationsByStatus : [];
  const reportsByStatus = Array.isArray(breakdowns.reportsByStatus) ? breakdowns.reportsByStatus : [];
  const surrenderBreakdown = (Array.isArray(breakdowns.surrendersByStatus) ? breakdowns.surrendersByStatus : [])
    .filter((item) => item.status !== "DECLINED");

  return (
    <section aria-labelledby="shelter-operations-heading" className="analytics-section">
      <div className="analytics-section-intro">
        <div>
          <span className="eyebrow">Internal database</span>
          <h2 id="shelter-operations-heading">Shelter operations</h2>
        </div>
        {loading ? <span className="analytics-refreshing" role="status">Updating...</span> : null}
      </div>

      {error ? <div className="analytics-warning" role="status">{error}. Showing the last successful database result.</div> : null}

      <section aria-label="Shelter operations summary" className="analytics-kpi-grid">
        {kpis.map((item) => <AnalyticsKpi {...item} key={item.label} />)}
      </section>
      <section className="analytics-history-grid">
        <article className="analytics-panel analytics-trend-panel analytics-history-panel">
          <header className="analytics-panel-heading">
            <div><span className="eyebrow">{formatGranularity(trendGranularity)} history</span><h2>Historical case activity</h2></div>
          </header>
          <OperationalHistoryChart data={trend} granularity={trendGranularity} period={period} />
        </article>
        <CaseCompositionPanel
          items={TREND_SERIES.map((series) => ({
            ...series,
            value: series.key === "applications"
              ? adoption.total ?? summary.applications
              : series.key === "reports"
                ? reports.total ?? summary.reports
                : surrenders.total ?? summary.surrenders,
          }))}
        />
      </section>

      <section className="analytics-breakdown-grid">
        <BreakdownBars data={animalsByStatus} title="Animals by status" />
        <AdoptionPipeline data={applicationsByStatus} subtitle={periodLabel} />
        <BreakdownBars data={reportsByStatus} title="Stray reports" />
        <BreakdownBars data={surrenderBreakdown} title="Surrender workflow" />
      </section>

      <section className="analytics-lower-grid">
        <article className="analytics-panel analytics-performance-panel">
          <header className="analytics-panel-heading"><div><span className="eyebrow">Service delivery</span><h2>Operational performance</h2><p>Average timings only use cases with recorded milestone dates.</p></div></header>
          <PerformanceMetric label="Report assignment" note="From submission to agent assignment" value={formatDuration(reports.averageAssignmentHours, "hour")} />
          <PerformanceMetric label="Field response" note="From submission to arrival on scene" value={formatDuration(reports.averageResponseHours, "hour")} />
          <PerformanceMetric label="Report resolution" note="From submission to resolution" value={formatDuration(reports.averageResolutionHours, "hour")} />
          <PerformanceMetric label="Adoption turnaround" note="From application to adoption" value={formatDuration(adoption.averageDaysToAdoption, "day")} />
          <PerformanceMetric label="Surrender completion" note="From request to completed intake" value={formatDuration(surrenders.averageCompletionDays, "day")} />
        </article>

        <article className="analytics-panel analytics-health-panel">
          <header className="analytics-panel-heading"><div><span className="eyebrow">Workflow health</span><h2>Management indicators</h2><p>Rates for records created during {periodLabel.toLowerCase()}.</p></div></header>
          <PerformanceMetric label="Reports assigned" note="Cases linked to a field agent" value={formatMetric(reports.assignmentRate, "%")} />
          <PerformanceMetric label="Anonymous reporting" note="Reports not linked to an account" value={formatMetric(reports.anonymousRate, "%")} />
          <PerformanceMetric label="Inspections completed" note="Applications with a completed home inspection" value={formatMetric(adoption.inspectionCompletionRate, "%")} />
          <PerformanceMetric label="Surrenders scheduled" note="Requests with an intake appointment" value={formatMetric(surrenders.schedulingRate, "%")} />
          <div className={`analytics-priority ${summary.unassignedActiveReports ? "needs-attention" : "healthy"}`}>
            <div><strong>{summary.unassignedActiveReports ? `${summary.unassignedActiveReports} reports require assignment` : "All active reports are assigned"}</strong><span>{summary.unassignedActiveReports ? "Assign field agents to reduce rescue delays." : "No immediate report-assignment backlog."}</span></div>
          </div>
        </article>
      </section>
    </section>
  );
}

function TabStatus({ data, error, loading }) {
  if (loading) return <small className="is-loading">Updating</small>;
  if (error) return <small className="has-error">Attention</small>;
  if (data) return <small>Ready</small>;
  return <small>Unavailable</small>;
}

export default function AnalyticsPage({
  data,
  error,
  loading,
  onRangeChange,
  onTrafficRefresh,
  range,
  trafficData,
  trafficError,
  trafficLoading,
}) {
  const [activeTab, setActiveTab] = useState("operations");
  const busy = loading || trafficLoading;
  const rangeBusy = loading || trafficLoading;
  const activeData = activeTab === "digital" ? trafficData : data;
  const activeError = activeTab === "digital" ? trafficError : error;
  const activeLoading = activeTab === "digital" ? trafficLoading : loading;
  const requestedRange = normalizeRange(range);
  const displayedRange = normalizeRange(activeData?.period?.days);
  const requestedRangeLabel = formatRequestedRange(range);
  const displayedRangeLabel = activeData?.period?.label || formatRequestedRange(displayedRange);
  const hasDifferentDisplayedRange = displayedRange !== null
    && requestedRange !== null
    && displayedRange !== requestedRange;
  const periodStatus = hasDifferentDisplayedRange
    ? activeLoading
      ? `Loading ${requestedRangeLabel.toLowerCase()}; showing ${displayedRangeLabel.toLowerCase()}`
      : activeError
        ? `${requestedRangeLabel} could not load; showing ${displayedRangeLabel.toLowerCase()}`
        : `Showing ${displayedRangeLabel.toLowerCase()}`
    : `Shared reporting period: ${requestedRangeLabel.toLowerCase()}`;

  function handleTabKeyDown(event) {
    let nextTab = null;

    if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "End") {
      nextTab = "operations";
    } else if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "Home") {
      nextTab = "digital";
    }

    if (!nextTab) return;

    event.preventDefault();
    setActiveTab(nextTab);
    requestAnimationFrame(() => document.getElementById(`analytics-${nextTab}-tab`)?.focus());
  }

  return (
    <div className="analytics-page">
      <section className="analytics-toolbar">
        <div>
          <span className={`analytics-live-dot${busy ? " is-loading" : ""}`} />
          <strong>Analytics overview</strong>
          <small>{periodStatus}</small>
        </div>
        <div className="analytics-range" aria-label="Analytics date range">
          {RANGE_OPTIONS.map((option) => (
            <button
              aria-pressed={range === option.value}
              className={range === option.value ? "active" : ""}
              disabled={rangeBusy}
              key={option.value}
              onClick={() => onRangeChange(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <div aria-label="Analytics areas" className="analytics-tabs" role="tablist">
        <button
          aria-controls="analytics-digital-panel"
          aria-selected={activeTab === "digital"}
          className={activeTab === "digital" ? "active" : ""}
          id="analytics-digital-tab"
          onClick={() => setActiveTab("digital")}
          onKeyDown={handleTabKeyDown}
          role="tab"
          tabIndex={activeTab === "digital" ? 0 : -1}
          type="button"
        >
          <span>Digital engagement</span>
          <TabStatus data={trafficData} error={trafficError} loading={trafficLoading} />
        </button>
        <button
          aria-controls="analytics-operations-panel"
          aria-selected={activeTab === "operations"}
          className={activeTab === "operations" ? "active" : ""}
          id="analytics-operations-tab"
          onClick={() => setActiveTab("operations")}
          onKeyDown={handleTabKeyDown}
          role="tab"
          tabIndex={activeTab === "operations" ? 0 : -1}
          type="button"
        >
          <span>Shelter operations</span>
          <TabStatus data={data} error={error} loading={loading} />
        </button>
      </div>

      <div aria-labelledby="analytics-digital-tab" hidden={activeTab !== "digital"} id="analytics-digital-panel" role="tabpanel" tabIndex="0">
        <DigitalEngagementSection
          data={trafficData}
          error={trafficError}
          loading={trafficLoading}
          onRefresh={onTrafficRefresh}
          range={range}
        />
      </div>
      <div aria-labelledby="analytics-operations-tab" hidden={activeTab !== "operations"} id="analytics-operations-panel" role="tabpanel" tabIndex="0">
        <ShelterOperationsSection data={data} error={error} loading={loading} range={range} />
      </div>
    </div>
  );
}
