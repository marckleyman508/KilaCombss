import { format, parseISO, differenceInYears } from 'date-fns';

export const fDate = (d) => d ? format(parseISO(d.split('T')[0]), 'MMM d, yyyy') : '—';
export const fDateShort = (d) => d ? format(parseISO(d.split('T')[0]), 'MM/dd/yy') : '—';
export const fAge = (dob) => dob ? `${differenceInYears(new Date(), parseISO(dob))} yrs` : '—';

export const fDiagnosis = (type) =>
  ({ alzheimers: "Alzheimer's Disease", parkinsons: "Parkinson's Disease", other: 'Other', both: 'Both' }[type] || type);

export const fStage = (stage) =>
  ({ early: 'Early', moderate: 'Moderate', advanced: 'Advanced' }[stage] || stage || '—');

export const fCondition = (c) =>
  ({ improved: 'Improved', stable: 'Stable', declined: 'Declined', unknown: 'Unknown' }[c] || c || '—');

export const fTremorScale = (n) =>
  n === null || n === undefined ? '—' : ['None (0)', 'Slight (1)', 'Mild (2)', 'Moderate (3)', 'Severe (4)'][n] || n;

export const fName = (p) => p ? `${p.first_name} ${p.last_name}` : '—';

export const conditionColor = (c) =>
  ({ improved: 'text-green-700 bg-green-50', stable: 'text-blue-700 bg-blue-50',
     declined: 'text-red-700 bg-red-50', unknown: 'text-gray-600 bg-gray-100' }[c] || 'text-gray-600 bg-gray-100');

export const diagnosisBadgeColor = (type) =>
  ({ alzheimers: 'bg-purple-100 text-purple-800', parkinsons: 'bg-orange-100 text-orange-800',
     other: 'bg-gray-100 text-gray-700' }[type] || 'bg-gray-100 text-gray-700');

export const stageBadgeColor = (stage) =>
  ({ early: 'bg-green-100 text-green-700', moderate: 'bg-yellow-100 text-yellow-700',
     advanced: 'bg-red-100 text-red-700' }[stage] || 'bg-gray-100 text-gray-600');
