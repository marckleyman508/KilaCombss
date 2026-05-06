import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchApi } from '../../api';
import { fDiagnosis } from '../../utils/formatters';

export default function Header({ title }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (q.length < 2) { setResults(null); setOpen(false); return; }
    const t = setTimeout(() => {
      searchApi.search(q).then((res) => { setResults(res.data); setOpen(true); }).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const go = (path) => { navigate(path); setQ(''); setOpen(false); };

  const total = results
    ? results.patients.length + results.researchPapers.length + results.treatments.length
    : 0;

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>

      <div className="relative w-72" ref={ref}>
        <div className="relative">
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search patients, papers, treatments..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {open && results && (
          <div className="absolute right-0 mt-1 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
            {total === 0 && (
              <p className="px-4 py-3 text-sm text-gray-500">No results found</p>
            )}

            {results.patients.length > 0 && (
              <div>
                <p className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase bg-gray-50 border-b">Patients</p>
                {results.patients.map((p) => (
                  <button key={p.id} onClick={() => go(`/patients/${p.id}`)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100">
                    <p className="text-sm font-medium">{p.first_name} {p.last_name}</p>
                    <p className="text-xs text-gray-500">{p.mrn} · {fDiagnosis(p.diagnosis_type)}</p>
                  </button>
                ))}
              </div>
            )}

            {results.researchPapers.length > 0 && (
              <div>
                <p className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase bg-gray-50 border-b">Research Papers</p>
                {results.researchPapers.map((r) => (
                  <button key={r.id} onClick={() => go(`/research`)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100">
                    <p className="text-sm font-medium line-clamp-1">{r.title}</p>
                    <p className="text-xs text-gray-500">{r.journal} · {r.publication_year}</p>
                  </button>
                ))}
              </div>
            )}

            {results.treatments.length > 0 && (
              <div>
                <p className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase bg-gray-50 border-b">Treatments</p>
                {results.treatments.map((t) => (
                  <button key={t.id} onClick={() => go(`/research`)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50">
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{t.treatment_type}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
