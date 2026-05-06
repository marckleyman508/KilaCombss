import React from 'react';

export default function KpiCard({ label, value, sub, colorClass = 'text-gray-900' }) {
  return (
    <div className="card p-5">
      <p className="label mb-1">{label}</p>
      <p className={`text-3xl font-bold ${colorClass}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}
