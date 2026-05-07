import React, { useState, useEffect } from 'react';
import { aiApi } from '../../api';
import TrendBadge from './TrendBadge';

function MetricRow({ label, trend }) {
  if (!trend) return null;
  const changeColor =
    trend.totalChange > 0 ? 'text-green-600' :
    trend.totalChange < 0 ? 'text-red-600'   : 'text-gray-500';

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-medium ${changeColor}`}>
          {trend.totalChange > 0 ? '+' : ''}{trend.totalChange}
        </span>
        <TrendBadge trend={trend.direction} />
      </div>
    </div>
  );
}

function AnomalyList({ anomalies }) {
  if (!anomalies?.length) return <p className="text-sm text-gray-500 py-2">No statistical anomalies detected.</p>;

  const severityColor = s => s === 'high' ? 'text-red-600 bg-red-50' : 'text-amber-600 bg-amber-50';
  const labels = {
    mmse_score: 'MMSE', moca_score: 'MoCA',
    mobility_score: 'Mobility', tremor_severity: 'Tremor',
  };

  return (
    <ul className="space-y-2 mt-1">
      {anomalies.map((a, i) => (
        <li key={i} className={`flex items-center justify-between px-3 py-2 rounded-md text-sm ${severityColor(a.severity)}`}>
          <span>
            <span className="font-medium">{labels[a.metric] || a.metric}</span>
            {' '}on {new Date(a.date).toLocaleDateString()} — value {a.value} ({a.direction.replace('_', ' ')})
          </span>
          <span className="ml-2 font-mono">z={a.zScore}</span>
        </li>
      ))}
    </ul>
  );
}

export default function AIInsightsPanel({ patientId }) {
  const [trends,    setTrends]    = useState(null);
  const [anomalies, setAnomalies] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    if (!patientId) return;
    setLoading(true);
    setError(null);

    Promise.all([
      aiApi.trends(patientId, 12),
      aiApi.anomalies(patientId),
    ])
      .then(([trendsRes, anomalyRes]) => {
        setTrends(trendsRes.data);
        setAnomalies(anomalyRes.data);
      })
      .catch(() => setError('Could not load AI insights.'))
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600 p-4">{error}</p>;
  }

  const insufficient = trends?.status === 'insufficient_data';

  return (
    <div className="space-y-6">
      {/* Trends */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Metric Trends</h3>
          {trends && <span className="text-xs text-gray-400">{trends.dataPoints} assessments · {trends.analysisWindow}</span>}
        </div>
        {insufficient ? (
          <p className="text-sm text-gray-500">{trends.message}</p>
        ) : (
          <div>
            <MetricRow label="MMSE (Cognitive)"    trend={trends?.trends?.mmse}     />
            <MetricRow label="MoCA (Cognitive)"    trend={trends?.trends?.moca}     />
            <MetricRow label="Mobility Score"      trend={trends?.trends?.mobility} />
            <MetricRow label="Tremor Severity"     trend={trends?.trends?.tremor}   />
          </div>
        )}
      </div>

      {/* Anomalies */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Statistical Anomalies</h3>
        <AnomalyList anomalies={anomalies?.anomalies} />
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 italic px-1">
        AI insights are statistical summaries for clinical reference only and do not constitute medical advice or diagnosis.
      </p>
    </div>
  );
}
