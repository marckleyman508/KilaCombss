import React, { useEffect, useState } from 'react';
import Layout from '../components/layout/Layout';
import { aiApi } from '../api';
import TrendBadge from '../components/ai/TrendBadge';

function CohortCard({ insight }) {
  if (insight.status === 'insufficient_data') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 opacity-60">
        <p className="text-sm font-medium capitalize text-gray-700">{insight.diagnosis}</p>
        <p className="text-xs text-gray-400 mt-1">Insufficient data</p>
      </div>
    );
  }

  const diagnosisLabel = insight.diagnosis === 'alzheimers' ? "Alzheimer's" : "Parkinson's";
  const mmseColor =
    insight.avgMmseChange > 0 ? 'text-green-600' :
    insight.avgMmseChange < 0 ? 'text-red-600'   : 'text-gray-500';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-gray-900">{diagnosisLabel}</p>
          <p className="text-xs text-gray-400 mt-0.5">{insight.latestCohortSize} patients</p>
        </div>
        <TrendBadge trend={insight.trend} />
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Avg MMSE Change</p>
          <p className={`text-lg font-bold mt-0.5 ${mmseColor}`}>
            {insight.avgMmseChange != null
              ? `${insight.avgMmseChange > 0 ? '+' : ''}${insight.avgMmseChange}`
              : '—'}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Avg Mobility Change</p>
          <p className={`text-lg font-bold mt-0.5 ${insight.avgMobilityChange > 0 ? 'text-green-600' : insight.avgMobilityChange < 0 ? 'text-red-600' : 'text-gray-500'}`}>
            {insight.avgMobilityChange != null
              ? `${insight.avgMobilityChange > 0 ? '+' : ''}${insight.avgMobilityChange}`
              : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AIInsights() {
  const [insights, setInsights] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    aiApi.cohortInsights()
      .then(res => setInsights(res.data))
      .catch(() => setError('Could not load cohort insights.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">AI Insights</h1>
          <p className="text-sm text-gray-500 mt-1">
            Statistical analysis of cohort trends. For clinical reference only — not a diagnostic tool.
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {insights && (
          <>
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                6-Month Cohort Trends
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {insights.insights.map((insight, i) => (
                  <CohortCard key={i} insight={insight} />
                ))}
              </div>
            </section>

            <p className="text-xs text-gray-400 italic border-t border-gray-100 pt-4">
              {insights.disclaimer} Generated {new Date(insights.generatedAt).toLocaleString()}.
            </p>
          </>
        )}
      </div>
    </Layout>
  );
}
