import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { format, parseISO } from 'date-fns';

const fTick = (d) => { try { return format(parseISO(d), 'MMM d'); } catch { return d; } };

export default function ProgressChart({ logs, diagnosisType }) {
  if (!logs?.length) return <p className="text-sm text-gray-500 py-6 text-center">No progress data available.</p>;

  const data = logs.map((l) => ({
    date: l.log_date?.split('T')[0],
    mmse: l.mmse_score,
    moca: l.moca_score,
    mobility: l.mobility_score,
    tremor: l.tremor_severity != null ? l.tremor_severity * 25 : null,
  }));

  const isParkinsons = diagnosisType === 'parkinsons';

  return (
    <div className="space-y-6">
      {/* Cognitive */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Cognitive Scores</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tickFormatter={fTick} tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 30]} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v, name) => [v ?? '—', name]}
              labelFormatter={(l) => fTick(l)}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {/* MMSE severe impairment threshold */}
            <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="4 4"
              label={{ value: 'Severe', fontSize: 10, fill: '#ef4444', position: 'right' }} />
            <Line dataKey="mmse" name="MMSE" stroke="#3b82f6" strokeWidth={2}
              dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
            <Line dataKey="moca" name="MoCA" stroke="#8b5cf6" strokeWidth={2}
              dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Motor (Parkinson's only) */}
      {isParkinsons && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Motor Function</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ top: 4, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tickFormatter={fTick} tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v, name) => [name === 'Tremor' ? `${v / 25}/4` : v, name]}
                labelFormatter={(l) => fTick(l)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line dataKey="mobility" name="Mobility" stroke="#10b981" strokeWidth={2}
                dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
              <Line dataKey="tremor" name="Tremor (scaled)" stroke="#f59e0b" strokeWidth={2}
                dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-400 mt-1">Tremor scaled to 0–100 for display (actual 0–4 scale)</p>
        </div>
      )}
    </div>
  );
}
