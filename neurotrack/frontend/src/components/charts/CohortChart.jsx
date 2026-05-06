import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { format, parseISO } from 'date-fns';

const fMonth = (d) => { try { return format(parseISO(d), 'MMM yy'); } catch { return d; } };

export function CohortCognitionChart({ data }) {
  const alzData = data.filter((d) => d.diagnosis_type === 'alzheimers');
  const pdData  = data.filter((d) => d.diagnosis_type === 'parkinsons');

  const merged = [...new Set([...alzData.map((d) => d.month), ...pdData.map((d) => d.month)])]
    .sort()
    .map((month) => {
      const alz = alzData.find((d) => d.month === month);
      const pd  = pdData.find((d)  => d.month === month);
      return {
        month,
        alz_mmse: alz?.avg_mmse ? +alz.avg_mmse : null,
        pd_mmse:  pd?.avg_mmse  ? +pd.avg_mmse  : null,
      };
    });

  if (!merged.length) return <p className="text-sm text-gray-500">No cohort data available.</p>;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={merged} margin={{ top: 4, right: 20, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tickFormatter={fMonth} tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 30]} tick={{ fontSize: 11 }} />
        <Tooltip labelFormatter={fMonth} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line dataKey="alz_mmse" name="Alzheimer's — MMSE" stroke="#8b5cf6" strokeWidth={2}
          dot={{ r: 3 }} connectNulls />
        <Line dataKey="pd_mmse"  name="Parkinson's — MMSE" stroke="#f59e0b" strokeWidth={2}
          dot={{ r: 3 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TreatmentEffectivenessChart({ data }) {
  if (!data?.length) return <p className="text-sm text-gray-500">No treatment data available.</p>;

  const sorted = [...data]
    .filter((d) => d.avg_outcome_score !== null)
    .sort((a, b) => b.avg_outcome_score - a.avg_outcome_score)
    .slice(0, 8);

  const barColor = (score) => {
    if (score > 0.3)  return '#10b981';
    if (score > 0)    return '#3b82f6';
    if (score > -0.3) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 30, left: 120, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" domain={[-1, 1]} tick={{ fontSize: 11 }}
          tickFormatter={(v) => v > 0 ? `+${v}` : v} />
        <YAxis type="category" dataKey="treatment_name" tick={{ fontSize: 11 }} width={115} />
        <Tooltip formatter={(v) => [v > 0 ? `+${v}` : v, 'Avg Outcome Score']} />
        <Bar dataKey="avg_outcome_score" name="Outcome Score" radius={[0, 3, 3, 0]}>
          {sorted.map((entry, i) => (
            <rect key={i} fill={barColor(+entry.avg_outcome_score)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
