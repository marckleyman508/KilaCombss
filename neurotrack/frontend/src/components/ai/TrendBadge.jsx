import React from 'react';

const config = {
  improving:         { label: 'Improving',        cls: 'bg-green-100 text-green-800'  },
  stable:            { label: 'Stable',            cls: 'bg-blue-100 text-blue-800'   },
  declining:         { label: 'Declining',         cls: 'bg-red-100 text-red-800'     },
  insufficient_data: { label: 'Insufficient Data', cls: 'bg-gray-100 text-gray-600'   },
};

export default function TrendBadge({ trend }) {
  const { label, cls } = config[trend] || config.insufficient_data;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
