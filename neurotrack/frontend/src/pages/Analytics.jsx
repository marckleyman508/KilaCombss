import React, { useEffect, useState } from 'react';
import Layout from '../components/layout/Layout';
import { CohortCognitionChart, TreatmentEffectivenessChart } from '../components/charts/CohortChart';
import { analyticsApi } from '../api';

export default function Analytics() {
  const [cohort, setCohort] = useState([]);
  const [effectiveness, setEffectiveness] = useState([]);
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsApi.cohortComparison(),
      analyticsApi.treatmentEffectiveness(),
      analyticsApi.riskFlags(),
    ])
      .then(([c, e, f]) => { setCohort(c.data); setEffectiveness(e.data); setFlags(f.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <Layout title="Analytics">
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );

  const alzCohort = [...new Set(cohort.filter((d) => d.diagnosis_type === 'alzheimers').map((d) => d.patient_count))];
  const pdCohort  = [...new Set(cohort.filter((d) => d.diagnosis_type === 'parkinsons').map((d) => d.patient_count))];

  const flagCounts = {
    cognitive: flags.filter((f) => f.flag_rapid_cognitive_decline || f.flag_severe_cognitive_impairment).length,
    motor:     flags.filter((f) => f.flag_severe_tremor || f.flag_poor_mobility).length,
    overdue:   flags.filter((f) => f.flag_overdue_assessment).length,
    declined:  flags.filter((f) => f.flag_declined_last_visit).length,
  };

  return (
    <Layout title="Analytics">
      <div className="space-y-6">
        {/* Risk summary row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Cognitive Risk', value: flagCounts.cognitive, color: 'text-purple-700' },
            { label: 'Motor Risk',     value: flagCounts.motor,     color: 'text-orange-600' },
            { label: 'Overdue Assess.', value: flagCounts.overdue,  color: 'text-red-700' },
            { label: 'Declined Last Visit', value: flagCounts.declined, color: 'text-gray-800' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card p-5">
              <p className="label mb-1">{label}</p>
              <p className={`text-3xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-400 mt-1">patients flagged</p>
            </div>
          ))}
        </div>

        {/* Cohort Cognition Comparison */}
        <div className="card p-5">
          <h2 className="section-header text-sm mb-1">Cohort Cognitive Scores Over Time</h2>
          <p className="text-xs text-gray-400 mb-4">Average MMSE — Alzheimer's vs Parkinson's patients (rolling 12 months)</p>
          <CohortCognitionChart data={cohort} />
        </div>

        {/* Treatment Effectiveness */}
        <div className="card p-5">
          <h2 className="section-header text-sm mb-1">Treatment Outcome Comparison</h2>
          <p className="text-xs text-gray-400 mb-4">
            Average outcome score: +1 = all improved, 0 = stable, −1 = all declined.
            Based on clinician-recorded condition per visit.
          </p>
          <TreatmentEffectivenessChart data={effectiveness} />
        </div>

        {/* Cohort data table */}
        <div className="card p-5">
          <h2 className="section-header text-sm mb-3">Monthly Cohort Summary</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {['Month', 'Diagnosis', 'Patients', 'Avg MMSE', 'Avg MoCA', 'Avg Mobility', 'Avg Tremor'].map((h) => (
                    <th key={h} className="text-left py-2 pr-4 text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cohort.map((row, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-4 text-gray-700">{row.month?.split('T')[0]}</td>
                    <td className="py-2 pr-4 capitalize">{row.diagnosis_type === 'alzheimers' ? "Alzheimer's" : "Parkinson's"}</td>
                    <td className="py-2 pr-4">{row.patient_count}</td>
                    <td className="py-2 pr-4">{row.avg_mmse ?? '—'}</td>
                    <td className="py-2 pr-4">{row.avg_moca ?? '—'}</td>
                    <td className="py-2 pr-4">{row.avg_mobility ?? '—'}</td>
                    <td className="py-2 pr-4">{row.avg_tremor ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
