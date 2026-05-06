import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import PatientForm from '../components/patients/PatientForm';
import { patientApi } from '../api';
import { fDate, fAge, fDiagnosis, fStage, diagnosisBadgeColor, stageBadgeColor } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';

export default function Patients() {
  const { isAdmin } = useAuth();
  const [patients, setPatients] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [filters, setFilters] = useState({ diagnosis: '', stage: '', search: '' });

  const load = () => {
    setLoading(true);
    patientApi.list(filters)
      .then((res) => { setPatients(res.data.data); setTotal(res.data.total); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filters]);

  const setFilter = (key, val) => setFilters((f) => ({ ...f, [key]: val }));

  return (
    <Layout title="Patients">
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text" placeholder="Search name or MRN…"
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            className="input-field w-56"
          />
          <select value={filters.diagnosis} onChange={(e) => setFilter('diagnosis', e.target.value)}
            className="input-field w-44">
            <option value="">All Diagnoses</option>
            <option value="alzheimers">Alzheimer's</option>
            <option value="parkinsons">Parkinson's</option>
          </select>
          <select value={filters.stage} onChange={(e) => setFilter('stage', e.target.value)}
            className="input-field w-36">
            <option value="">All Stages</option>
            <option value="early">Early</option>
            <option value="moderate">Moderate</option>
            <option value="advanced">Advanced</option>
          </select>
          <span className="text-sm text-gray-500 ml-auto">{total} patient{total !== 1 ? 's' : ''}</span>
          <button onClick={() => setShowNew(true)} className="btn-primary">+ New Patient</button>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['MRN', 'Patient', 'DOB / Age', 'Diagnosis', 'Stage', 'Dx Date', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">Loading…</td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">No patients found.</td>
                </tr>
              ) : patients.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono text-gray-600">{p.mrn}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{p.first_name} {p.last_name}</p>
                    {p.doctor_first_name && (
                      <p className="text-xs text-gray-400">Dr. {p.doctor_last_name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <span>{fDate(p.date_of_birth)}</span>
                    <span className="text-gray-400 ml-1">({fAge(p.date_of_birth)})</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={diagnosisBadgeColor(p.diagnosis_type)}>{fDiagnosis(p.diagnosis_type)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {p.disease_stage && <Badge className={stageBadgeColor(p.disease_stage)}>{fStage(p.disease_stage)}</Badge>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{fDate(p.diagnosis_date)}</td>
                  <td className="px-4 py-3">
                    <Link to={`/patients/${p.id}`} className="text-sm text-blue-600 hover:underline font-medium">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Patient" size="lg">
        <PatientForm onSaved={() => { setShowNew(false); load(); }} onCancel={() => setShowNew(false)} />
      </Modal>
    </Layout>
  );
}
