import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import KpiCard from '../components/common/KpiCard';
import Badge from '../components/common/Badge';
import { analyticsApi } from '../api';
import { fName, fDiagnosis, fStage, diagnosisBadgeColor, stageBadgeColor } from '../utils/formatters';

const FLAG_LABELS = {
  flag_rapid_cognitive_decline: 'Rapid cognitive decline',
  flag_severe_cognitive_impairment: 'Severe cognitive impairment',
  flag_severe_tremor: 'Severe tremor',
  flag_poor_mobility: 'Poor mobility',
  flag_overdue_assessment: 'Assessment overdue (60+ days)',
  flag_declined_last_visit: 'Declined at last visit',
};

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([analyticsApi.overview(), analyticsApi.riskFlags()])
      .then(([o, f]) => { setOverview(o.data); setFlags(f.data); })
      .finally(() => setLoading(false));
  }, []);

  const kpis = overview?.kpis;

  return (
    <Layout title="Dashboard">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total Active Patients" value={kpis?.total_patients} />
            <KpiCard label="Alzheimer's Patients" value={kpis?.alzheimers_count}
              colorClass="text-purple-700" sub={`${kpis?.total_patients ? Math.round(kpis.alzheimers_count / kpis.total_patients * 100) : 0}% of cohort`} />
            <KpiCard label="Parkinson's Patients"  value={kpis?.parkinsons_count}
              colorClass="text-orange-600" sub={`${kpis?.total_patients ? Math.round(kpis.parkinsons_count / kpis.total_patients * 100) : 0}% of cohort`} />
            <KpiCard label="Assessments This Month" value={overview?.logsThisMonth}
              colorClass="text-blue-700" />
          </div>

          {/* Stage breakdown */}
          <div className="grid grid-cols-3 gap-4">
            <KpiCard label="Early Stage"    value={kpis?.stage_early}    colorClass="text-green-700" />
            <KpiCard label="Moderate Stage" value={kpis?.stage_moderate} colorClass="text-yellow-700" />
            <KpiCard label="Advanced Stage" value={kpis?.stage_advanced} colorClass="text-red-700" />
          </div>

          {/* Risk Flags */}
          <div className="card">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="section-header text-base">Risk Flags</h2>
              <span className="text-xs text-gray-500">{flags.length} patient{flags.length !== 1 ? 's' : ''} flagged</span>
            </div>

            {flags.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-500">No patients currently flagged.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {flags.map((p) => {
                  const activeFlags = Object.entries(FLAG_LABELS)
                    .filter(([key]) => p[key] === true)
                    .map(([, label]) => label);
                  return (
                    <div key={p.id} className="px-5 py-3 flex items-start justify-between gap-4">
                      <div>
                        <Link to={`/patients/${p.id}`} className="text-sm font-medium text-blue-700 hover:underline">
                          {p.first_name} {p.last_name}
                        </Link>
                        <div className="flex gap-1.5 mt-1 flex-wrap">
                          <Badge className={diagnosisBadgeColor(p.diagnosis_type)}>{fDiagnosis(p.diagnosis_type)}</Badge>
                          <Badge className={stageBadgeColor(p.disease_stage)}>{fStage(p.disease_stage)}</Badge>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        {activeFlags.map((f, i) => (
                          <Badge key={i} className="bg-red-100 text-red-700">{f}</Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
