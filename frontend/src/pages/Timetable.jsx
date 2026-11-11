import { useEffect, useState, useRef } from 'react';
import api from '../utils/api';
import { MONTHS, currentMonth, currentYear } from '../utils/format';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const DOW_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const emptyForm = { moduleId: '', classId: '', programme: 'DEGREE', hours: '', startTime: '', endTime: '', hasTransport: false, remarks: '' };

function getDaysInMonth(year, month) {
  const days = [];
  const total = new Date(year, month, 0).getDate();
  for (let d = 1; d <= total; d++) {
    const str = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    days.push({ d, str, dow: new Date(year, month - 1, d).getDay() });
  }
  return days;
}

export default function Timetable() {
  const [entries, setEntries] = useState([]);
  const [modules, setModules] = useState([]);
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [selectedDates, setSelectedDates] = useState(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [showPopulate, setShowPopulate] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [importing, setImporting] = useState(false);
  const [populating, setPopulating] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef();
  const toast = useToast();

  const load = () => api.get('/timetable').then(r => setEntries(r.data)).catch(console.error);

  useEffect(() => {
    load();
    api.get('/modules').then(r => setModules(r.data));
    api.get('/classes').then(r => setClasses(r.data));
  }, []);

  const set = k => e => setForm(p => ({ ...p, [k]: e.type === 'checkbox' ? e.target.checked : e.target.value }));

  const saveEntry = async e => {
    e.preventDefault();
    if (selectedDates.size === 0) { toast('Select at least one date', 'error'); return; }
    if (!form.hours && (!form.startTime || !form.endTime)) { toast('Enter hours or start/end time', 'error'); return; }
    try {
      const r = await api.post('/sessions/bulk', { ...form, dates: [...selectedDates].sort() });
      toast(`${r.data.created} session(s) added${r.data.skipped ? `, ${r.data.skipped} skipped` : ''}`);
      setShowAdd(false);
      setForm(emptyForm);
      setSelectedDates(new Set());
    } catch (err) { toast(err.response?.data?.error || 'Error saving', 'error'); }
  };

  const deleteEntry = async id => {
    try { await api.delete(`/timetable/${id}`); toast('Entry removed'); load(); }
    catch { toast('Error deleting', 'error'); }
  };

  const clearAll = async () => {
    try { await api.delete('/timetable'); toast('Timetable cleared'); setShowClearConfirm(false); load(); }
    catch { toast('Error clearing', 'error'); }
  };

  const handleImport = async e => {
    const file = e.target.files[0]; if (!file) return;
    setImporting(true);
    const fd = new FormData(); fd.append('file', file);
    try {
      const r = await api.post('/timetable/import', fd);
      toast(`Imported ${r.data.imported} timetable entries${r.data.errors.length ? ` (${r.data.errors.length} errors)` : ''}`);
      if (r.data.errors.length) console.warn(r.data.errors);
      load();
    } catch (err) { toast(err.response?.data?.error || 'Import failed', 'error'); }
    finally { setImporting(false); fileRef.current.value = ''; }
  };

  const downloadTemplate = async () => {
    try {
      const token = localStorage.getItem('dit_token');
      const res = await fetch('/api/timetable/template', { headers: { Authorization: `Bearer ${token}` } });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'timetable_template.xlsx';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('Template downloaded');
    } catch { toast('Download failed', 'error'); }
  };

  const populate = async () => {
    setPopulating(true); setResult(null);
    try {
      const r = await api.post('/timetable/populate', { month, year });
      setResult(r.data);
      toast(r.data.message);
    } catch (err) { toast(err.response?.data?.error || 'Error populating', 'error'); }
    finally { setPopulating(false); }
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const calDays = getDaysInMonth(year, month);
  const firstDow = calDays[0]?.dow ?? 0;

  const toggleDate = str => setSelectedDates(prev => {
    const next = new Set(prev); next.has(str) ? next.delete(str) : next.add(str); return next;
  });
  const selectAllDates = () => setSelectedDates(new Set(calDays.map(d => d.str)));
  const clearDates = () => setSelectedDates(new Set());
  const toggleDow = dowIndex => {
    const matching = calDays.filter(d => d.dow === dowIndex).map(d => d.str);
    const allSel = matching.every(s => selectedDates.has(s));
    setSelectedDates(prev => {
      const next = new Set(prev);
      if (allSel) matching.forEach(s => next.delete(s));
      else matching.forEach(s => next.add(s));
      return next;
    });
  };

  // Group entries by day
  const byDay = {};
  DAYS.forEach(d => { byDay[d] = entries.filter(e => e.dayOfWeek === d); });

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Weekly Timetable</h1>
          <p className="text-gray-500 text-sm">
            {entries.length === 0
              ? 'No timetable yet — import your Excel timetable or add entries manually'
              : `${entries.length} entries across the week`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadTemplate} className="btn-secondary">⬇ Download Template</button>
          <label className={`btn-secondary cursor-pointer ${importing ? 'opacity-60' : ''}`}>
            {importing ? 'Importing…' : '⬆ Import Excel'}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} disabled={importing} />
          </label>
          <button onClick={() => setShowAdd(true)} className="btn-secondary">+ Add Entry</button>
          {entries.length > 0 && (
            <>
              <button onClick={() => { setResult(null); setShowPopulate(true); }} className="btn-primary">
                📅 Populate Month
              </button>
              <button onClick={() => setShowClearConfirm(true)} className="text-red-400 hover:text-red-600 text-sm px-3 py-2 rounded-lg hover:bg-red-50 border border-red-200 transition-colors">
                Clear All
              </button>
            </>
          )}
        </div>
      </div>

      {/* How it works banner */}
      {entries.length === 0 && (
        <div className="card bg-blue-50 border-blue-100">
          <h3 className="font-bold text-primary mb-3">How Timetable Import Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {[
              { step: '1', icon: '⬇', title: 'Download Template', desc: 'Get the Excel template with your modules and classes pre-listed' },
              { step: '2', icon: '✏️', title: 'Fill Your Timetable', desc: 'Add each class: day, module, class, time. One row per teaching slot per week.' },
              { step: '3', icon: '📅', title: 'Populate Any Month', desc: 'Click "Populate Month", select month/year — all sessions auto-created for every occurrence of that day!' },
            ].map(s => (
              <div key={s.step} className="flex gap-3">
                <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">{s.step}</div>
                <div>
                  <div className="font-semibold text-gray-700">{s.icon} {s.title}</div>
                  <div className="text-gray-500 text-xs mt-0.5">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timetable grid by day */}
      {entries.length > 0 && (
        <div className="space-y-3">
          {DAYS.map(day => byDay[day].length > 0 && (
            <div key={day} className="card p-0 overflow-hidden">
              <div className="bg-primary px-4 py-2 flex items-center gap-2">
                <span className="text-white font-bold text-sm">{day}</span>
                <span className="text-blue-200 text-xs">{byDay[day].length} {byDay[day].length === 1 ? 'class' : 'classes'}</span>
              </div>
              <table className="w-full">
                <tbody>
                  {byDay[day].map(e => (
                    <tr key={e.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono font-bold text-primary w-32">{e.startTime} – {e.endTime}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-800">{e.module?.name || '—'}</div>
                        <div className="text-xs text-gray-400">{e.module?.code}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{e.class?.code || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.programme === 'DEGREE' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{e.programme}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {e.hasTransport && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Transport</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{e.remarks}</td>
                      <td className="px-4 py-3 w-16">
                        <button onClick={() => deleteEntry(e.id)} className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Add Entry Modal */}
      {showAdd && (
        <Modal title="Add Sessions" onClose={() => { setShowAdd(false); setSelectedDates(new Set()); }}>
          <form onSubmit={saveEntry} className="space-y-5">
            {/* Month selector */}
            <div className="flex gap-2">
              <select className="input flex-1" value={month} onChange={e => { setMonth(+e.target.value); setSelectedDates(new Set()); }}>
                {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
              <select className="input w-24" value={year} onChange={e => { setYear(+e.target.value); setSelectedDates(new Set()); }}>
                {years.map(y => <option key={y}>{y}</option>)}
              </select>
            </div>

            {/* Calendar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Select Teaching Dates</label>
                <div className="flex gap-2">
                  <button type="button" onClick={selectAllDates} className="text-xs text-primary hover:underline">All</button>
                  <button type="button" onClick={clearDates} className="text-xs text-gray-400 hover:underline">Clear</button>
                </div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-7 bg-primary text-white text-center text-xs">
                  {DOW_SHORT.map((d, i) => (
                    <button key={d} type="button" onClick={() => toggleDow(i)}
                      className="py-1.5 font-medium hover:bg-white/20 transition-colors w-full" title={`Select all ${d}s`}>{d}</button>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
                  {calDays.map(({ d, str }) => (
                    <button key={str} type="button" onClick={() => toggleDate(str)}
                      className={`py-2 text-sm font-medium border border-gray-100 transition-colors ${selectedDates.has(str) ? 'bg-primary text-white' : 'hover:bg-blue-50 text-gray-700'}`}>{d}</button>
                  ))}
                </div>
              </div>
              {selectedDates.size > 0 && <p className="text-xs text-primary mt-1 font-medium">{selectedDates.size} date(s) selected</p>}
            </div>

            {/* Module / Class / Programme / Hours */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Module</label>
                <select className="input" value={form.moduleId} onChange={set('moduleId')} required>
                  <option value="">-- Select --</option>
                  {modules.map(m => <option key={m.id} value={m.id}>{m.code} – {m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Class</label>
                <select className="input" value={form.classId} onChange={set('classId')} required>
                  <option value="">-- Select --</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Programme</label>
                <select className="input" value={form.programme} onChange={set('programme')}>
                  <option value="DEGREE">DEGREE</option>
                  <option value="OD">OD</option>
                </select>
              </div>
              <div>
                <label className="label">Hours per Session</label>
                <input className="input" type="number" min="0.5" max="12" step="0.5" value={form.hours} onChange={set('hours')} />
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-400 mb-2">Optional: add start &amp; end time for the record</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Start Time</label>
                  <input className="input" type="time" value={form.startTime} onChange={set('startTime')} />
                </div>
                <div>
                  <label className="label">End Time</label>
                  <input className="input" type="time" value={form.endTime} onChange={set('endTime')} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="ttransport" checked={form.hasTransport} onChange={set('hasTransport')} className="w-4 h-4 accent-primary" />
              <label htmlFor="ttransport" className="text-sm font-medium text-gray-700">Include Transport (TZS 10,000)</label>
            </div>
            <div>
              <label className="label">Remarks (optional)</label>
              <input className="input" value={form.remarks} onChange={set('remarks')} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-primary flex-1">
                Add {selectedDates.size > 0 ? `${selectedDates.size} ` : ''}Session{selectedDates.size !== 1 ? 's' : ''}
              </button>
              <button type="button" onClick={() => { setShowAdd(false); setSelectedDates(new Set()); }} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Populate Month Modal */}
      {showPopulate && (
        <Modal title="Populate Sessions from Timetable" onClose={() => setShowPopulate(false)}>
          <div className="space-y-5">
            <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
              <div className="font-bold mb-1">What will happen:</div>
              The system will look at your timetable ({entries.length} entries) and create a session for <strong>every occurrence</strong> of each day in the selected month — skipping any that already exist.
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Month</label>
                <select className="input" value={month} onChange={e => setMonth(+e.target.value)}>
                  {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Year</label>
                <select className="input" value={year} onChange={e => setYear(+e.target.value)}>
                  {years.map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {result && (
              <div className={`rounded-xl p-4 text-sm ${result.created > 0 ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-yellow-50 text-yellow-800 border border-yellow-200'}`}>
                <div className="font-bold text-base mb-1">{result.created > 0 ? '✓' : '⚠'} {result.message}</div>
                {result.created > 0 && <div>Go to <strong>Sessions</strong> to view all generated sessions.</div>}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={populate} disabled={populating} className="btn-primary flex-1 py-3">
                {populating ? 'Creating sessions…' : `Populate ${MONTHS[month-1]} ${year}`}
              </button>
              <button onClick={() => setShowPopulate(false)} className="btn-secondary">Close</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Clear Confirm Modal */}
      {showClearConfirm && (
        <Modal title="Clear Timetable" onClose={() => setShowClearConfirm(false)}>
          <p className="text-gray-600 mb-6">This will remove all {entries.length} timetable entries. Your existing sessions are not affected.</p>
          <div className="flex gap-3">
            <button onClick={clearAll} className="btn-danger flex-1">Yes, Clear All</button>
            <button onClick={() => setShowClearConfirm(false)} className="btn-secondary flex-1">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
