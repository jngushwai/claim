import { useState, useEffect } from 'react';
import api from '../utils/api';
import { fmt, MONTHS, currentMonth, currentYear } from '../utils/format';
import { useToast } from '../components/ui/Toast';

export default function Claims() {
  const [tab, setTab] = useState('monthly'); // 'monthly' | 'summary'
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [preview, setPreview] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const loadPreview = async () => {
    setLoading(true);
    try {
      const r = await api.get('/claims/preview', { params: { month, year } });
      setPreview(r.data);
    } catch { toast('Error loading preview', 'error'); }
    finally { setLoading(false); }
  };

  const loadSummary = async () => {
    setLoading(true);
    try {
      const r = await api.get('/claims/summary-preview', { params: { year } });
      setSummary(r.data);
    } catch { toast('Error loading summary', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (tab === 'monthly') loadPreview();
    else loadSummary();
  }, [month, year, tab]);

  const download = async (type) => {
    try {
      const url = type === 'claim'
        ? `/api/claims/excel?month=${month}&year=${year}`
        : `/api/claims/summary-excel?year=${year}`;
      const token = localStorage.getItem('dit_token');
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl; a.setAttribute('download', '');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
      toast(`${type === 'claim' ? 'Claim form' : 'Summary'} downloaded`);
    } catch { toast('Download failed', 'error'); }
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Generate Claims</h1>
          <p className="text-gray-500 text-sm">Preview and export official Consultancy Claim Forms</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {tab === 'monthly' && (
            <select className="input w-36" value={month} onChange={e => setMonth(+e.target.value)}>
              {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
          )}
          <select className="input w-24" value={year} onChange={e => setYear(+e.target.value)}>
            {years.map(y => <option key={y}>{y}</option>)}
          </select>
          {tab === 'monthly' ? (
            <button onClick={() => download('claim')} className="btn-primary">⬇ Download Claim (.xlsx)</button>
          ) : (
            <button onClick={() => download('summary')} className="btn-accent">⬇ Annual Summary (.xlsx)</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab('monthly')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'monthly' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          Monthly Claim
        </button>
        <button
          onClick={() => setTab('summary')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'summary' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          Annual Summary
        </button>
      </div>

      {loading ? (
        <div className="card flex items-center justify-center py-20 text-gray-400">Loading…</div>
      ) : tab === 'monthly' ? (
        !preview || preview.modules.length === 0 ? (
          <div className="card text-center py-16">
            <div className="text-5xl mb-3">📋</div>
            <p className="text-gray-500">No sessions found for {MONTHS[month-1]} {year}</p>
            <p className="text-xs text-gray-400 mt-1">Add sessions first, then generate your claim here</p>
          </div>
        ) : (
          <div className="card space-y-4">
            {/* Header */}
            <div className="text-center border-b pb-4">
              <div className="font-bold text-gray-800 text-lg">DAR ES SALAAM INSTITUTE OF TECHNOLOGY</div>
              {preview.lecturer.department && (
                <div className="text-gray-600">{preview.lecturer.department} DEPARTMENT</div>
              )}
              <div className="font-bold text-gray-800">CONSULTANCY CLAIM FORM</div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="font-bold">LECTURER/TUTOR NAME:</span> {preview.lecturer.name}</div>
              <div><span className="font-bold">BANK:</span> {preview.lecturer.bank} – {preview.lecturer.branch}</div>
              <div><span className="font-bold">ADDRESS:</span> {preview.lecturer.address}</div>
              <div><span className="font-bold">ACCOUNT:</span> {preview.lecturer.accountNo} ({preview.lecturer.accountName})</div>
              <div><span className="font-bold">DEPARTMENT:</span> {preview.lecturer.department}</div>
              <div><span className="font-bold">ACADEMIC YEAR:</span> {preview.lecturer.academicYear}</div>
            </div>

            <div className="font-bold text-gray-700">MONTH: {preview.month}, {preview.year}</div>

            {/* Sessions by Module */}
            {preview.modules.map(m => (
              <div key={`${m.module.id}-${m.class?.id ?? ''}`}>
                <div className="bg-gray-100 px-3 py-2 font-bold text-sm text-gray-700 rounded">
                  MODULE: {m.module.name} ({m.module.code}){m.class ? ` — ${m.class.code}` : ''}
                </div>
                <table className="w-full text-sm mt-1">
                  <thead>
                    <tr className="bg-gray-50">
                      {['DATE','CLASS','FROM','TO','HRS','RATE (TSHS)','TUITION (TSHS)','TRANSPORT (TSHS)'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {m.sessions.map(s => (
                      <tr key={s.id} className="border-b">
                        <td className="px-3 py-2 border text-xs font-mono">{s.date}</td>
                        <td className="px-3 py-2 border text-xs">{s.class?.code}</td>
                        <td className="px-3 py-2 border text-xs">{s.startTime}</td>
                        <td className="px-3 py-2 border text-xs">{s.endTime}</td>
                        <td className="px-3 py-2 border text-xs font-bold">{s.hours}</td>
                        <td className="px-3 py-2 border text-xs">{fmt(s.hourlyRate)}</td>
                        <td className="px-3 py-2 border text-xs">{fmt(s.tuition)}</td>
                        <td className="px-3 py-2 border text-xs">{s.transport ? fmt(s.transport) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-blue-50">
                      <td colSpan={6} className="px-3 py-2 text-right font-bold text-sm border">TOTAL</td>
                      <td className="px-3 py-2 font-bold text-primary border">{fmt(m.totalTuition)}</td>
                      <td className="px-3 py-2 font-bold text-accent border">{fmt(m.totalTransport)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ))}

            {/* Grand Totals */}
            <div className="border-t-2 border-gray-800 pt-4 space-y-1">
              {[
                ['Total Tuition Payment', preview.totalTuition, 'text-primary'],
                ['Total Transport Payment', preview.totalTransport, 'text-accent'],
                [`Gross pay as per ${preview.month}, ${preview.year}`, preview.gross, 'text-green-600 text-xl'],
              ].map(([label, val, cls]) => (
                <div key={label} className="flex justify-between items-center px-2">
                  <span className="font-bold text-gray-700">{label}</span>
                  <span className={`font-bold ${cls}`}>TZS {fmt(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        !summary || summary.rows.length === 0 ? (
          <div className="card text-center py-16">
            <div className="text-5xl mb-3">📊</div>
            <p className="text-gray-500">No sessions found for {year}</p>
            <p className="text-xs text-gray-400 mt-1">Add sessions across the year to see your annual summary</p>
          </div>
        ) : (
          <div className="card space-y-4">
            {/* Header */}
            <div className="text-center border-b pb-4">
              <div className="font-bold text-gray-800 text-lg">DAR ES SALAAM INSTITUTE OF TECHNOLOGY</div>
              {summary.lecturer.department && (
                <div className="text-gray-600">{summary.lecturer.department} DEPARTMENT</div>
              )}
              <div className="font-bold text-gray-800">SUMMARY OF CONSULTANCY CLAIM FORM</div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="font-bold">LECTURER/TUTOR NAME:</span> {summary.lecturer.name}</div>
              <div><span className="font-bold">ACADEMIC YEAR:</span> {summary.lecturer.academicYear}</div>
            </div>

            <table className="w-full text-sm mt-1">
              <thead>
                <tr className="bg-gray-50">
                  {['MODULE','MONTH','SESSIONS','TUITION PAYMENT','TRANSPORT','TOTAL'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.rows.map(r => (
                  <tr key={r.month} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 border text-xs">{r.modules}</td>
                    <td className="px-3 py-2 border text-xs font-medium">{r.month}, {summary.year}</td>
                    <td className="px-3 py-2 border text-xs text-center">{r.sessionCount}</td>
                    <td className="px-3 py-2 border text-xs">{fmt(r.tuition)}</td>
                    <td className="px-3 py-2 border text-xs">{fmt(r.transport)}</td>
                    <td className="px-3 py-2 border text-xs font-bold text-primary">{fmt(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-blue-50">
                  <td colSpan={3} className="px-3 py-2 text-right font-bold text-sm border">TOTAL AMOUNT</td>
                  <td className="px-3 py-2 font-bold text-primary border">{fmt(summary.grandTuition)}</td>
                  <td className="px-3 py-2 font-bold text-accent border">{fmt(summary.grandTransport)}</td>
                  <td className="px-3 py-2 font-bold text-green-600 border">{fmt(summary.grandTotal)}</td>
                </tr>
              </tfoot>
            </table>

            <div className="border-t-2 border-gray-800 pt-4 flex justify-between items-center px-2">
              <span className="font-bold text-gray-700">Gross pay for {year}</span>
              <span className="font-bold text-green-600 text-xl">TZS {fmt(summary.grandTotal)}</span>
            </div>
          </div>
        )
      )}
    </div>
  );
}
