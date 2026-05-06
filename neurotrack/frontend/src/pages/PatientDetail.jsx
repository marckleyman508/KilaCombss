import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import PatientTimeline from '../components/patients/PatientTimeline';
import ProgressLogForm from '../components/patients/ProgressLogForm';
import ProgressChart from '../components/charts/ProgressChart';
import { patientApi } from '../api';
import {
  fDate, fAge, fDiagnosis, fStage, fCondition, fTremorScale,
  diagnosisBadgeColor, stageBadgeColor, conditionColor,
} from '../utils/formatters';

const TABS = ['Overview', 'Progress', 'Timeline', 'Medications', 'Surgeries'];

export default function PatientDetail() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [progressLogs, setProgressLogs] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [tab, setTab] = useState('Overview');
  const [showLogForm, setShowLogForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      patientApi.get(id),
      patientApi.getProgress(id),
      patientApi.getTimeline(id),
    ])
      .then(([p, prog, tl]) => {
        setPatient(p.data);
        setProgressLogs(prog.data);
        setTimeline(tl.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return (
    <Layout title="Patient Detail">
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );

  if (!patient) return (
    <Layout title="Patient Not Found">
      <p className="text-sm text-gray-500">Patient record not found.</p>
    </Layout>
  );

  const latestLog = progressLogs[progressLogs.length - 1];

  return (
    <Layout title={`${patient.first_name} ${patient.last_name}`}>
      <div className="space-y-5">
        {/* Back */}
        <Link to="/patients" className="text-sm text-blue-600 hover:underline">← All Patients</Link>

        {/* Patient Header Card */}
        <div className="card p-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-semibold">{patient.first_name} {patient.last_name}</h2>
                <Badge className={diagnosisBadgeColor(patient.diagnosis_type)}>{fDiagnosis(patient.diagnosis_type)}</Badge>
                {patient.disease_stage && (
                  <Badge className={stageBadgeColor(patient.disease_stage)}>{fStage(patient.disease_stage)}</Badge>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1 font-mono">{patient.mrn}</p>
            </div>
            <button onClick={() => setShowLogForm(true)} className="btn-primary">
              + Add Assessment
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
            <div><p className="label">Date of Birth</p><p className="text-sm mt-1">{fDate(patient.date_of_birth)} ({fAge(patient.date_of_birth)})</p></div>
            <div><p className="label">Gender</p><p className="text-sm mt-1 capitalize">{patient.gender || '—'}</p></div>
            <div><p className="label">Diagnosis Date</p><p className="text-sm mt-1">{fDate(patient.diagnosis_date)}</p></div>
            <div>
              <p className="label">Primary Physician</p>
              <p className="text-sm mt-1">
                {patient.doctor_first_name ? `Dr. ${patient.doctor_first_name} ${patient.doctor_last_name}` : '—'}
              </p>
            </div>
            <div><p className="label">Phone</p><p className="text-sm mt-1">{patient.phone || '—'}</p></div>
            <div><p className="label">Email</p><p className="text-sm mt-1">{patient.email || '—'}</p></div>
            <div><p className="label">Emergency Contact</p><p className="text-sm mt-1">{patient.emergency_contact_name || '—'}</p></div>
            <div><p className="label">Emergency Phone</p><p className="text-sm mt-1">{patient.emergency_contact_phone || '—'}</p></div>
          </div>
        </div>

        {/* Latest Assessment Summary */}
        {latestLog && (
          <div className="card p-5">
            <p className="section-header text-sm mb-3">Latest Assessment — {fDate(latestLog.log_date)}</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div><p className="label">MMSE</p><p className="text-2xl font-bold mt-1">{latestLog.mmse_score ?? '—'}<span className="text-xs text-gray-400 font-normal">/30</span></p></div>
              <div><p className="label">MoCA</p><p className="text-2xl font-bold mt-1">{latestLog.moca_score ?? '—'}<span className="text-xs text-gray-400 font-normal">/30</span></p></div>
              {patient.diagnosis_type === 'parkinsons' && (
                <>
                  <div><p className="label">Tremor</p><p className="text-2xl font-bold mt-1">{latestLog.tremor_severity ?? '—'}<span className="text-xs text-gray-400 font-normal">/4</span></p></div>
                  <div><p className="label">Mobility</p><p className="text-2xl font-bold mt-1">{latestLog.mobility_score ?? '—'}<span className="text-xs text-gray-400 font-normal">/100</span></p></div>
                </>
              )}
              <div>
                <p className="label">Condition</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-sm font-medium mt-1 ${conditionColor(latestLog.overall_condition)}`}>
                  {fCondition(latestLog.overall_condition)}
                </span>
              </div>
            </div>
            {latestLog.clinician_notes && (
              <p className="text-sm text-gray-600 mt-3 bg-gray-50 rounded p-3">
                {latestLog.clinician_notes}
              </p>
            )}
          </div>
        )}

        {/* Tabs */}
        <div>
          <div className="border-b border-gray-200 flex gap-0">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === t
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}>
                {t}
              </button>
            ))}
          </div>

          <div className="card mt-4 p-5">
            {/* Overview Tab */}
            {tab === 'Overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="section-header text-sm mb-3">Medical History</h3>
                  {patient.medicalHistory?.length === 0 && <p className="text-sm text-gray-500">No conditions recorded.</p>}
                  <div className="space-y-2">
                    {patient.medicalHistory?.map((h) => (
                      <div key={h.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <div>
                          <p className="text-sm font-medium">{h.condition_name}</p>
                          <p className="text-xs text-gray-400">Since {fDate(h.onset_date)}</p>
                        </div>
                        <Badge className={h.is_ongoing ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}>
                          {h.is_ongoing ? 'Ongoing' : 'Resolved'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="section-header text-sm mb-3">Active Treatments</h3>
                  {patient.treatments?.filter((t) => t.is_active).length === 0 && <p className="text-sm text-gray-500">No active treatments.</p>}
                  <div className="space-y-1.5">
                    {patient.treatments?.filter((t) => t.is_active).map((t) => (
                      <div key={t.id} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" />
                        <p className="text-sm">{t.name}</p>
                        <span className="text-xs text-gray-400 capitalize ml-auto">{t.treatment_type?.replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Progress Tab */}
            {tab === 'Progress' && (
              <div className="space-y-4">
                <ProgressChart logs={progressLogs} diagnosisType={patient.diagnosis_type} />

                {/* Log table */}
                <div className="mt-4">
                  <h3 className="section-header text-sm mb-3">Assessment History</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 text-xs font-medium text-gray-500 pr-4">Date</th>
                          <th className="text-left py-2 text-xs font-medium text-gray-500 pr-4">MMSE</th>
                          <th className="text-left py-2 text-xs font-medium text-gray-500 pr-4">MoCA</th>
                          {patient.diagnosis_type === 'parkinsons' && (
                            <>
                              <th className="text-left py-2 text-xs font-medium text-gray-500 pr-4">Tremor</th>
                              <th className="text-left py-2 text-xs font-medium text-gray-500 pr-4">Mobility</th>
                            </>
                          )}
                          <th className="text-left py-2 text-xs font-medium text-gray-500 pr-4">Condition</th>
                          <th className="text-left py-2 text-xs font-medium text-gray-500">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {[...progressLogs].reverse().map((l) => (
                          <tr key={l.id}>
                            <td className="py-2 pr-4 text-gray-700">{fDate(l.log_date)}</td>
                            <td className="py-2 pr-4">{l.mmse_score ?? '—'}</td>
                            <td className="py-2 pr-4">{l.moca_score ?? '—'}</td>
                            {patient.diagnosis_type === 'parkinsons' && (
                              <>
                                <td className="py-2 pr-4">{l.tremor_severity ?? '—'}</td>
                                <td className="py-2 pr-4">{l.mobility_score ?? '—'}</td>
                              </>
                            )}
                            <td className="py-2 pr-4">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${conditionColor(l.overall_condition)}`}>
                                {fCondition(l.overall_condition)}
                              </span>
                            </td>
                            <td className="py-2 text-xs text-gray-500 max-w-xs truncate">{l.clinician_notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Timeline Tab */}
            {tab === 'Timeline' && <PatientTimeline events={timeline} />}

            {/* Medications Tab */}
            {tab === 'Medications' && (
              <div className="space-y-2">
                {patient.medications?.length === 0 && <p className="text-sm text-gray-500">No medications recorded.</p>}
                {patient.medications?.map((m) => (
                  <div key={m.id} className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{m.medication_name}</p>
                      <p className="text-xs text-gray-500">{m.dosage} — {m.frequency}</p>
                      <p className="text-xs text-gray-400">Started {fDate(m.start_date)}</p>
                    </div>
                    <Badge className={m.is_current ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                      {m.is_current ? 'Current' : 'Discontinued'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Surgeries Tab */}
            {tab === 'Surgeries' && (
              <div className="space-y-3">
                {patient.surgeries?.length === 0 && <p className="text-sm text-gray-500">No surgical history.</p>}
                {patient.surgeries?.map((s) => (
                  <div key={s.id} className="border border-gray-100 rounded-md p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{s.procedure_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{fDate(s.procedure_date)}</p>
                        {s.performing_surgeon && <p className="text-xs text-gray-400">Surgeon: {s.performing_surgeon}</p>}
                        {s.facility         && <p className="text-xs text-gray-400">Facility: {s.facility}</p>}
                      </div>
                      {s.outcome && (
                        <Badge className="bg-blue-100 text-blue-700 capitalize">{s.outcome.replace('_', ' ')}</Badge>
                      )}
                    </div>
                    {s.notes && <p className="text-xs text-gray-600 mt-2 bg-gray-50 rounded p-2">{s.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal open={showLogForm} onClose={() => setShowLogForm(false)} title="New Clinical Assessment" size="md">
        <ProgressLogForm
          patientId={id}
          diagnosisType={patient.diagnosis_type}
          onSaved={() => { setShowLogForm(false); load(); }}
          onCancel={() => setShowLogForm(false)}
        />
      </Modal>
    </Layout>
  );
}
