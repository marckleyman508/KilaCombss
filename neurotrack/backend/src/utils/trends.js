/**
 * Statistical utilities for patient trend and anomaly analysis.
 * All functions are pure (no DB calls) and work on arrays of progress_log rows.
 */

/**
 * Linear regression trend analysis on a single metric over time.
 * Returns direction, slope, total change, and summary stats.
 */
function analyzeTrend(logs, metric) {
  const points = logs
    .filter(l => l[metric] !== null && l[metric] !== undefined)
    .map((l, i) => ({ x: i, y: Number(l[metric]), date: l.log_date }));

  if (points.length < 2) return null;

  const n = points.length;
  const sumX  = points.reduce((a, p) => a + p.x, 0);
  const sumY  = points.reduce((a, p) => a + p.y, 0);
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
  const sumX2 = points.reduce((a, p) => a + p.x * p.x, 0);

  const denom = n * sumX2 - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const mean  = sumY / n;
  const total = points[n - 1].y - points[0].y;

  // slope threshold: 0.1 unit per assessment period
  let direction = 'stable';
  if (Math.abs(slope) >= 0.1) direction = slope > 0 ? 'improving' : 'declining';

  return {
    direction,
    slope:       parseFloat(slope.toFixed(3)),
    totalChange: parseFloat(total.toFixed(1)),
    mean:        parseFloat(mean.toFixed(1)),
    latest:      points[n - 1].y,
    earliest:    points[0].y,
    dataPoints:  n,
    firstDate:   points[0].date,
    lastDate:    points[n - 1].date,
  };
}

/**
 * Z-score anomaly detection across key metrics.
 * Flags points >= 2 standard deviations from the series mean.
 */
function detectAnomalies(logs) {
  const metrics = ['mmse_score', 'moca_score', 'mobility_score', 'tremor_severity'];
  const anomalies = [];

  for (const metric of metrics) {
    const values = logs
      .filter(l => l[metric] !== null && l[metric] !== undefined)
      .map(l => ({ value: Number(l[metric]), date: l.log_date }));

    if (values.length < 3) continue;

    const mean   = values.reduce((a, v) => a + v.value, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((a, v) => a + Math.pow(v.value - mean, 2), 0) / values.length
    );

    if (stdDev === 0) continue;

    for (const point of values) {
      const z = Math.abs((point.value - mean) / stdDev);
      if (z >= 2.0) {
        anomalies.push({
          metric,
          date:      point.date,
          value:     point.value,
          zScore:    parseFloat(z.toFixed(2)),
          direction: point.value > mean ? 'above_normal' : 'below_normal',
          severity:  z >= 3 ? 'high' : 'moderate',
        });
      }
    }
  }

  return anomalies.sort((a, b) => b.zScore - a.zScore);
}

/**
 * Infers overall trajectory from the last N overall_condition values.
 */
function computeOverallTrend(logs, n = 4) {
  if (logs.length < 2) return 'insufficient_data';
  const recent = logs.slice(0, n).map(l => l.overall_condition).filter(Boolean);
  const improved = recent.filter(c => c === 'improved').length;
  const declined  = recent.filter(c => c === 'declined').length;
  if (improved > declined) return 'improving';
  if (declined > improved) return 'declining';
  return 'stable';
}

module.exports = { analyzeTrend, detectAnomalies, computeOverallTrend };
