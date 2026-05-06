import React, { useState } from 'react';
import { patientApi } from '../../api';

const FIELD = ({ label, name, type = 'number', min, max, value, onChange, hint }) => (
  <div>
    <label className="label">{label}{hint && <span className="normal-case font-normal text-gray-400 ml-1">({hint})</span>}</label>
    <input
      type={type} name={name} value={value} onChange={onChange}
      min={min} max={max}
      className="input-field mt-1"
      placeholder="—"
    />
  </div>
);

export default function ProgressLogForm({ patientId, diagnosisType, onSaved, onCancel }) {
  const [form, setForm] = useState({
    logDate: new Date().toISOString().split('T')[0],
    mmseScore: '', mocaScore: '', cognitiveNotes: '',
    tremorSeverity: '', mobilityScore: '', rigidityScore: '', bradykinesiaScore: '', motorNotes: '',
    overallCondition: '', clinicianNotes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handle = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        logDate: form.logDate,
        mmseScore:         form.mmseScore         !== '' ? +form.mmseScore         : null,
        mocaScore:         form.mocaScore         !== '' ? +form.mocaScore         : null,
        cognitiveNotes:    form.cognitiveNotes    || null,
        tremorSeverity:    form.tremorSeverity    !== '' ? +form.tremorSeverity    : null,
        mobilityScore:     form.mobilityScore     !== '' ? +form.mobilityScore     : null,
        rigidityScore:     form.rigidityScore     !== '' ? +form.rigidityScore     : null,
        bradykinesiaScore: form.bradykinesiaScore !== '' ? +form.bradykinesiaScore : null,
        motorNotes:        form.motorNotes        || null,
        overallCondition:  form.overallCondition  || null,
        clinicianNotes:    form.clinicianNotes    || null,
      };
      await patientApi.addProgress(patientId, payload);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save progress log');
    } finally {
      setSaving(false);
    }
  };

  const isParkinsons = diagnosisType === 'parkinsons';

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}

      <div>
        <label className="label">Assessment Date</label>
        <input type="date" name="logDate" value={form.logDate} onChange={handle} required className="input-field mt-1" />
      </div>

      <fieldset className="border border-gray-200 rounded-md p-4">
        <legend className="text-xs font-semibold text-gray-600 px-1 uppercase">Cognitive Metrics</legend>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <FIELD label="MMSE Score" name="mmseScore" min={0} max={30} hint="0–30" value={form.mmseScore} onChange={handle} />
          <FIELD label="MoCA Score" name="mocaScore" min={0} max={30} hint="0–30" value={form.mocaScore} onChange={handle} />
        </div>
        <div className="mt-3">
          <label className="label">Cognitive Notes</label>
          <textarea name="cognitiveNotes" value={form.cognitiveNotes} onChange={handle}
            rows={2} className="input-field mt-1" />
        </div>
      </fieldset>

      {isParkinsons && (
        <fieldset className="border border-gray-200 rounded-md p-4">
          <legend className="text-xs font-semibold text-gray-600 px-1 uppercase">Motor Function</legend>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <FIELD label="Tremor Severity" name="tremorSeverity" min={0} max={4} hint="0–4" value={form.tremorSeverity} onChange={handle} />
            <FIELD label="Mobility Score"  name="mobilityScore"  min={0} max={100} hint="0–100" value={form.mobilityScore} onChange={handle} />
            <FIELD label="Rigidity Score"  name="rigidityScore"  min={0} max={4} hint="0–4" value={form.rigidityScore} onChange={handle} />
            <FIELD label="Bradykinesia"    name="bradykinesiaScore" min={0} max={4} hint="0–4" value={form.bradykinesiaScore} onChange={handle} />
          </div>
          <div className="mt-3">
            <label className="label">Motor Notes</label>
            <textarea name="motorNotes" value={form.motorNotes} onChange={handle} rows={2} className="input-field mt-1" />
          </div>
        </fieldset>
      )}

      <div>
        <label className="label">Overall Condition</label>
        <select name="overallCondition" value={form.overallCondition} onChange={handle} className="input-field mt-1" required>
          <option value="">Select...</option>
          <option value="improved">Improved</option>
          <option value="stable">Stable</option>
          <option value="declined">Declined</option>
          <option value="unknown">Unknown</option>
        </select>
      </div>

      <div>
        <label className="label">Clinician Notes</label>
        <textarea name="clinicianNotes" value={form.clinicianNotes} onChange={handle}
          rows={3} className="input-field mt-1" placeholder="Clinical observations and plan..." />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save Assessment'}
        </button>
      </div>
    </form>
  );
}
