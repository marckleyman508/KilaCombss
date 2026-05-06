import React, { useEffect, useState } from 'react';
import Layout from '../components/layout/Layout';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import { researchApi, treatmentApi } from '../api';
import { fDate, diagnosisBadgeColor, fDiagnosis } from '../utils/formatters';

function PaperForm({ onSaved, onCancel }) {
  const [form, setForm] = useState({
    title: '', authors: '', publicationYear: '', journal: '', doi: '',
    abstract: '', tags: '', summary: '', externalUrl: '',
    diagnosisRelevance: [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handle = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const toggleDx = (val) => setForm((f) => ({
    ...f,
    diagnosisRelevance: f.diagnosisRelevance.includes(val)
      ? f.diagnosisRelevance.filter((x) => x !== val)
      : [...f.diagnosisRelevance, val],
  }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await researchApi.create({
        ...form,
        authors: form.authors.split(',').map((s) => s.trim()).filter(Boolean),
        tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
        publicationYear: form.publicationYear ? +form.publicationYear : null,
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save paper');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
      <div>
        <label className="label">Title</label>
        <input name="title" value={form.title} onChange={handle} required className="input-field mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Authors (comma-separated)</label>
          <input name="authors" value={form.authors} onChange={handle} className="input-field mt-1" placeholder="Smith J, Jones A" />
        </div>
        <div>
          <label className="label">Year</label>
          <input name="publicationYear" type="number" min={1900} max={2099} value={form.publicationYear} onChange={handle} className="input-field mt-1" />
        </div>
        <div>
          <label className="label">Journal</label>
          <input name="journal" value={form.journal} onChange={handle} className="input-field mt-1" />
        </div>
        <div>
          <label className="label">DOI</label>
          <input name="doi" value={form.doi} onChange={handle} className="input-field mt-1" placeholder="10.xxxx/..." />
        </div>
      </div>
      <div>
        <label className="label">Diagnosis Relevance</label>
        <div className="flex gap-4 mt-1.5">
          {['alzheimers', "parkinsons"].map((d) => (
            <label key={d} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.diagnosisRelevance.includes(d)}
                onChange={() => toggleDx(d)} className="rounded" />
              {fDiagnosis(d)}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Tags (comma-separated)</label>
        <input name="tags" value={form.tags} onChange={handle} className="input-field mt-1" placeholder="DBS, motor function, RCT" />
      </div>
      <div>
        <label className="label">Abstract</label>
        <textarea name="abstract" value={form.abstract} onChange={handle} rows={3} className="input-field mt-1" />
      </div>
      <div>
        <label className="label">Plain-Language Summary</label>
        <textarea name="summary" value={form.summary} onChange={handle} rows={3} className="input-field mt-1"
          placeholder="Brief clinician-written summary of key findings..." />
      </div>
      <div>
        <label className="label">External URL</label>
        <input name="externalUrl" value={form.externalUrl} onChange={handle} className="input-field mt-1" placeholder="https://..." />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Add Paper'}
        </button>
      </div>
    </form>
  );
}

function PaperDetail({ paper }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="label">Authors</p>
        <p className="text-sm mt-1">{paper.authors?.join(', ') || '—'}</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div><p className="label">Year</p><p className="text-sm mt-1">{paper.publication_year || '—'}</p></div>
        <div><p className="label">Journal</p><p className="text-sm mt-1">{paper.journal || '—'}</p></div>
        <div>
          <p className="label">DOI</p>
          <p className="text-sm mt-1 font-mono text-xs">{paper.doi || '—'}</p>
        </div>
      </div>
      {paper.abstract && (
        <div>
          <p className="label">Abstract</p>
          <p className="text-sm mt-1 text-gray-700 leading-relaxed">{paper.abstract}</p>
        </div>
      )}
      {paper.summary && (
        <div>
          <p className="label">Clinical Summary</p>
          <p className="text-sm mt-1 text-gray-700 bg-blue-50 rounded-md p-3 leading-relaxed">{paper.summary}</p>
        </div>
      )}
      {paper.treatmentLinks?.length > 0 && (
        <div>
          <p className="label">Linked Treatments</p>
          <div className="space-y-1.5 mt-1.5">
            {paper.treatmentLinks.map((l) => (
              <div key={l.id} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" />
                <p className="text-sm">{l.treatment_name}</p>
                {l.relevance_notes && <p className="text-xs text-gray-400">— {l.relevance_notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
      {paper.external_url && (
        <a href={paper.external_url} target="_blank" rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline">
          View full paper →
        </a>
      )}
    </div>
  );
}

export default function Research() {
  const [papers, setPapers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ diagnosis: '', search: '' });

  const load = () => {
    setLoading(true);
    researchApi.list(filters)
      .then((res) => { setPapers(res.data.data); setTotal(res.data.total); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filters]);

  const openDetail = async (id) => {
    const res = await researchApi.get(id);
    setSelected(res.data);
  };

  return (
    <Layout title="Research">
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <input type="text" placeholder="Search papers…"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            className="input-field w-56" />
          <select value={filters.diagnosis}
            onChange={(e) => setFilters((f) => ({ ...f, diagnosis: e.target.value }))}
            className="input-field w-44">
            <option value="">All Diagnoses</option>
            <option value="alzheimers">Alzheimer's</option>
            <option value="parkinsons">Parkinson's</option>
          </select>
          <span className="text-sm text-gray-500 ml-auto">{total} paper{total !== 1 ? 's' : ''}</span>
          <button onClick={() => setShowNew(true)} className="btn-primary">+ Add Paper</button>
        </div>

        {/* Paper list */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : papers.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-sm text-gray-500">No research papers found.</p>
            </div>
          ) : papers.map((p) => (
            <div key={p.id} className="card p-4 hover:border-blue-200 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <button onClick={() => openDetail(p.id)}
                    className="text-sm font-medium text-blue-700 hover:underline text-left">
                    {p.title}
                  </button>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {p.authors?.slice(0, 3).join(', ')}{p.authors?.length > 3 ? ' et al.' : ''} · {p.journal} · {p.publication_year}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {p.diagnosis_relevance?.map((d) => (
                      <Badge key={d} className={diagnosisBadgeColor(d)}>{fDiagnosis(d)}</Badge>
                    ))}
                    {p.tags?.slice(0, 4).map((t) => (
                      <Badge key={t} className="bg-gray-100 text-gray-600">{t}</Badge>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-400 whitespace-nowrap">{fDate(p.created_at)}</p>
              </div>
              {p.summary && (
                <p className="text-xs text-gray-600 mt-2 line-clamp-2">{p.summary}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Add Research Paper" size="lg">
        <PaperForm onSaved={() => { setShowNew(false); load(); }} onCancel={() => setShowNew(false)} />
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title || 'Paper'} size="lg">
        {selected && <PaperDetail paper={selected} />}
      </Modal>
    </Layout>
  );
}
