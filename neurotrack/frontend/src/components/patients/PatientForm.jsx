import React, { useState } from 'react';
import { patientApi } from '../../api';

export default function PatientForm({ onSaved, onCancel }) {
  const [form, setForm] = useState({
    mrn: '', firstName: '', lastName: '', dateOfBirth: '', gender: '',
    email: '', phone: '', diagnosisType: '', diagnosisDate: '', diseaseStage: '',
    emergencyContactName: '', emergencyContactPhone: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handle = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await patientApi.create(form);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create patient');
    } finally {
      setSaving(false);
    }
  };

  const F = ({ label, name, type = 'text', required, children }) => (
    <div>
      <label className="label">{label}</label>
      {children || (
        <input type={type} name={name} value={form[name]} onChange={handle}
          required={required} className="input-field mt-1" />
      )}
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}

      <div className="grid grid-cols-2 gap-4">
        <F label="MRN" name="mrn" required />
        <F label="Date of Birth" name="dateOfBirth" type="date" required />
        <F label="First Name" name="firstName" required />
        <F label="Last Name" name="lastName" required />
        <F label="Gender" name="gender">
          <select name="gender" value={form.gender} onChange={handle} className="input-field mt-1">
            <option value="">Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="nonbinary">Non-binary</option>
            <option value="other">Other / Prefer not to say</option>
          </select>
        </F>
        <F label="Email" name="email" type="email" />
        <F label="Phone" name="phone" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <F label="Diagnosis" name="diagnosisType" required>
          <select name="diagnosisType" value={form.diagnosisType} onChange={handle} required className="input-field mt-1">
            <option value="">Select…</option>
            <option value="alzheimers">Alzheimer's Disease</option>
            <option value="parkinsons">Parkinson's Disease</option>
            <option value="other">Other</option>
          </select>
        </F>
        <F label="Diagnosis Date" name="diagnosisDate" type="date" />
        <F label="Disease Stage" name="diseaseStage">
          <select name="diseaseStage" value={form.diseaseStage} onChange={handle} className="input-field mt-1">
            <option value="">Select…</option>
            <option value="early">Early</option>
            <option value="moderate">Moderate</option>
            <option value="advanced">Advanced</option>
          </select>
        </F>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <F label="Emergency Contact Name" name="emergencyContactName" />
        <F label="Emergency Contact Phone" name="emergencyContactPhone" />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Create Patient'}
        </button>
      </div>
    </form>
  );
}
