import React from 'react';
import { fDate } from '../../utils/formatters';

const EVENT_STYLES = {
  diagnosis:        { dot: 'bg-red-500',    label: 'Diagnosis' },
  surgery:          { dot: 'bg-orange-500', label: 'Surgery/Procedure' },
  medication_start: { dot: 'bg-green-500',  label: 'Medication Start' },
  medication_stop:  { dot: 'bg-gray-400',   label: 'Medication Stop' },
  progress_log:     { dot: 'bg-blue-500',   label: 'Assessment' },
  hospital_visit:   { dot: 'bg-purple-500', label: 'Hospital Visit' },
  treatment_start:  { dot: 'bg-teal-500',   label: 'Treatment Start' },
  treatment_stop:   { dot: 'bg-gray-400',   label: 'Treatment Stop' },
  note:             { dot: 'bg-gray-400',   label: 'Note' },
};

export default function PatientTimeline({ events }) {
  if (!events?.length) {
    return <p className="text-sm text-gray-500 py-4">No timeline events recorded.</p>;
  }

  return (
    <ol className="relative border-l border-gray-200 space-y-6 ml-3">
      {events.map((ev) => {
        const style = EVENT_STYLES[ev.event_type] || { dot: 'bg-gray-300', label: ev.event_type };
        return (
          <li key={ev.id} className="ml-5">
            <span className={`absolute -left-2 w-4 h-4 rounded-full border-2 border-white ${style.dot}`} />
            <div className="card p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{ev.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{style.label} · {fDate(ev.event_date)}</p>
                </div>
              </div>
              {ev.description && (
                <p className="text-xs text-gray-600 mt-2">{ev.description}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
