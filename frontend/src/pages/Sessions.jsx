import { useEffect, useState, useRef } from 'react';
import api from '../utils/api';
import { fmt, MONTHS, currentMonth, currentYear } from '../utils/format';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';

const emptyForm = { date: '', moduleId: '', classId: '', programme: 'DEGREE', startTime: '', endTime: '', hasTransport: false, remarks: '' };
const emptyBulk = { moduleId: '', classId: '', programme: 'DEGREE', hours: '', startTime: '', endTime: '', hasTransport: false, remarks: '' };

function getDaysInMonth(year, month) {
  const days = [];
  const total = new Date(year, month, 0).getDate();
  for (let d = 1; d <= total; d++) {
    const str = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    days.push({ d, str, dow: new Date(year, month - 1, d).getDay() });
  }
  return days;
}

const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [modules, setModules] = useState([]);
  const [classes, setClasses] = useState([]);
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulk, setBulk] = useState(emptyBulk);
  const [selectedDates, setSelectedDates] = useState(new Set());
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [autoFillSource, setAutoFillSource] = useState(null); // { month, year, patterns }
  const [showAutoFill, setShowAutoFill] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const fileRef = useRef();
  const toast = useToast();

  const load = async () => {
    const r = await api.get('/sessions', { params: { month, year } });
    setSessions(r.data);
    // If this month is empty, find nearest month with sessions (any direction)
    if (r.data.length === 0) {
      try {
        const pr = await api.get('/sessions/nearest-pattern', { params: { month, year } });
        if (pr.data.patterns.length > 0) {
          setAutoFillSource({ month: pr.data.sourceMonth, year: pr.data.sourceYear, patterns: pr.data.patterns });
        } else {
          setAutoFillSource(null);
        }
      } catch { setAutoFillSource(null); }
    } else {
      setAutoFillSource(null);
    }
  };
  useEffect(() => { load(); }, [month, year]);
  useEffect(() => {
    api.get('/modules').then(r => setModules(r.data));
    api.get('/classes').then(r => setClasses(r.data));
  }, []);

  const set = k => e => setForm(p => ({ ...p, [k]: e.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setBulkField = k => e => setBulk(p => ({ ...p, [k]: e.type === 'checkbox' ? e.target.checked : e.target.value }));

  const openEdit = s => {
    setForm({ date: s.date, moduleId: s.moduleId, classId: s.classId, programme: s.programme, startTime: s.startTime, endTime: s.endTime, hasTransport: s.transport > 0, remarks: s.remarks });
    setEditing(s.id); setShowModal(true);
  };

  const openBulk = () => {
    setBulk(emptyBulk);
    setSelectedDates(new Set());
    setShowBulk(true);
  };

  const save = async e => {
    e.preventDefault();
    try {
      await api.put(`/sessions/${editing}`, form);
      toast('Session updated');
      setShowModal(false); load();
    } catch (err) { toast(err.response?.data?.error || 'Error saving', 'error'); }
  };

  const runAutoFill = async () => {
    if (!autoFillSource) return;
    setAutoFilling(true);
    try {
      const r = await api.post('/sessions/autofill', {
        sourceMonth: autoFillSource.month, sourceYear: autoFillSource.year,
        targetMonth: month, targetYear: year
      });
      toast(`${r.data.created} sessions auto-filled from ${MONTHS[autoFillSource.month - 1]} ${autoFillSource.year}!`);
      setShowAutoFill(false);
      load();
    } catch (err) { toast(err.response?.data?.error || 'Auto-fill failed', 'error'); }
    finally { setAutoFilling(false); }
  };

  const saveBulk = async e => {
    e.preventDefault();
    if (selectedDates.size === 0) { toast('Select at least one date', 'error'); return; }
    if (!bulk.hours && (!bulk.startTime || !bulk.endTime)) { toast('Enter hours or start/end time', 'error'); return; }
    try {
      const r = await api.post('/sessions/bulk', { ...bulk, dates: [...selectedDates].sort() });
      toast(`${r.data.created} session(s) added${r.data.skipped ? `, ${r.data.skipped} skipped (duplicates)` : ''}`);
      setShowBulk(false); load();
    } catch (err) { toast(err.response?.data?.error || 'Error saving', 'error'); }
  };

  const remove = async id => {
    try {
      await api.delete(`/sessions/${id}`);
      toast('Session deleted'); setDeleting(null); load();
    } catch { toast('Error deleting', 'error'); }
  };

  const handleImport = async e => {
    const file = e.target.files[0]; if (!file) return;
    setImporting(true);
    const fd = new FormData(); fd.append('file', file);
    try {
      const r = await api.post('/sessions/import', fd);
      toast(`Imported ${r.data.imported} sessions${r.data.errors.length ? ` (${r.data.errors.length} skipped)` : ''}`);
      load();
    } catch (err) { toast(err.response?.data?.error || 'Import failed', 'error'); }
    finally { setImporting(false); fileRef.current.value = ''; }
  };

  const days = getDaysInMonth(year, month);
  const firstDow = days[0]?.dow ?? 0;

  const toggleDate = str => {
    setSelectedDates(prev => {
      const next = new Set(prev);
      next.has(str) ? next.delete(str) : next.add(str);
      return next;
    });
  };

  const selectAll = () => setSelectedDates(new Set(days.map(d => d.str)));
  const clearAll = () => setSelectedDates(new Set());

  const toggleDow = (dowIndex) => {
    const matching = days.filter(d => d.dow === dowIndex).map(d => d.str);
    const allSelected = matching.every(s => selectedDates.has(s));
    setSelectedDates(prev => {
      const next = new Set(prev);
      if (allSelected) matching.forEach(s => next.delete(s));
      else matching.forEach(s => next.add(s));
      return next;
    });
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Teaching Sessions</h1>
          <p className="text-gray-500 text-sm">{sessions.length} sessions · TZS {fmt(sessions.reduce((a,s)=>a+s.gross,0))} total</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select className="input w-36" value={month} onChange={e => setMonth(+e.target.value)}>
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select className="input w-24" value={year} onChange={e => setYear(+e.target.value)}>
            {years.map(y => <option key={y}>{y}</option>)}
          </select>
          <label className={`btn-secondary cursor-pointer ${importing ? 'opacity-60' : ''}`}>
            {importing ? 'Importing…' : '⬆ Import Excel'}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} disabled={importing} />
          </label>
          <button onClick={openBulk} className="btn-primary">+ Add Session</button>
        </div>
      </div>

      {/* Auto-fill banner */}
      {sessions.length === 0 && autoFillSource && (
        <div className="card bg-green-50 border border-green-200 flex items-center justify-between gap-4 p-4">
          <div>
            <div className="font-semibold text-green-800">✨ Auto-fill from {MONTHS[autoFillSource.month - 1]} {autoFillSource.year}</div>
            <div className="text-sm text-green-700 mt-0.5">
              {autoFillSource.patterns.length} teaching pattern{autoFillSource.patterns.length !== 1 ? 's' : ''} found — same days &amp; times will be applied to {MONTHS[month-1]} {year}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => setShowAutoFill(true)} className="btn-primary bg-green-600 hover:bg-green-700 whitespace-nowrap">
              Preview &amp; Fill
            </button>
            <button onClick={() => setAutoFillSource(null)} className="text-green-600 hover:text-green-800 text-sm px-2">✕</button>
          </div>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-3">📅</div>
          <p className="text-gray-500">No sessions for {MONTHS[month-1]} {year}</p>
          <button onClick={openBulk} className="btn-primary mt-4">Add First Session</button>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr>
                {['Date','Module','Class','Programme','Time','Hours','Rate','Tuition','Transport','Gross',''].map(h => (
                  <th key={h} className="table-th whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="table-td font-mono text-xs">{s.date}</td>
                  <td className="table-td">
                    <div className="font-medium text-xs">{s.module?.code}</div>
                    <div className="text-gray-400 text-xs truncate max-w-28">{s.module?.name}</div>
                  </td>
                  <td className="table-td text-xs">{s.class?.code}</td>
                  <td className="table-td"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.programme==='DEGREE'?'bg-blue-100 text-blue-700':'bg-purple-100 text-purple-700'}`}>{s.programme}</span></td>
                  <td className="table-td text-xs">{s.startTime && s.endTime ? `${s.startTime}–${s.endTime}` : '–'}</td>
                  <td className="table-td font-bold">{s.hours}</td>
                  <td className="table-td text-xs">{fmt(s.hourlyRate)}</td>
                  <td className="table-td">{fmt(s.tuition)}</td>
                  <td className="table-td">{s.transport ? fmt(s.transport) : '–'}</td>
                  <td className="table-td font-bold text-primary">{fmt(s.gross)}</td>
                  <td className="table-td">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(s)} className="text-blue-500 hover:text-blue-700 text-xs px-2 py-1 rounded hover:bg-blue-50">Edit</button>
                      <button onClick={() => setDeleting(s.id)} className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50">Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50">
                <td colSpan={7} className="table-td font-bold text-right">TOTALS</td>
                <td className="table-td font-bold text-primary">{fmt(sessions.reduce((a,s)=>a+s.tuition,0))}</td>
                <td className="table-td font-bold text-accent">{fmt(sessions.reduce((a,s)=>a+s.transport,0))}</td>
                <td className="table-td font-bold text-primary text-base">{fmt(sessions.reduce((a,s)=>a+s.gross,0))}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Bulk Add Modal */}
      {showBulk && (
        <Modal title="Add Sessions" onClose={() => setShowBulk(false)}>
          <form onSubmit={saveBulk} className="space-y-5">
            {/* Calendar date picker */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Select Dates — {MONTHS[month-1]} {year}</label>
                <div className="flex gap-2">
                  <button type="button" onClick={selectAll} className="text-xs text-primary hover:underline">All</button>
                  <button type="button" onClick={clearAll} className="text-xs text-gray-400 hover:underline">Clear</button>
                </div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-7 bg-primary text-white text-center text-xs">
                  {DOW.map((d, i) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDow(i)}
                      className="py-1.5 font-medium hover:bg-white/20 transition-colors w-full"
                      title={`Select all ${d}s`}
                    >{d}</button>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
                  {days.map(({ d, str }) => (
                    <button
                      key={str}
                      type="button"
                      onClick={() => toggleDate(str)}
                      className={`py-2 text-sm font-medium border border-gray-100 transition-colors
                        ${selectedDates.has(str)
                          ? 'bg-primary text-white'
                          : 'hover:bg-blue-50 text-gray-700'}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              {selectedDates.size > 0 && (
                <p className="text-xs text-primary mt-1 font-medium">{selectedDates.size} date(s) selected</p>
              )}
            </div>

            {/* Module / Class / Programme */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Module</label>
                <select className="input" value={bulk.moduleId} onChange={setBulkField('moduleId')} required>
                  <option value="">-- Select Module --</option>
                  {modules.map(m => <option key={m.id} value={m.id}>{m.code} – {m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Class</label>
                <select className="input" value={bulk.classId} onChange={setBulkField('classId')} required>
                  <option value="">-- Select Class --</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Programme</label>
                <select className="input" value={bulk.programme} onChange={setBulkField('programme')}>
                  <option value="DEGREE">DEGREE</option>
                  <option value="OD">OD (Ordinary Diploma)</option>
                </select>
              </div>
              <div>
                <label className="label">Hours per Session</label>
                <input className="input" type="number" min="0.5" max="12" step="0.5" value={bulk.hours} onChange={setBulkField('hours')} />
              </div>
            </div>

            {/* Optional start/end time */}
            <div>
              <p className="text-xs text-gray-400 mb-2">Optional: add start &amp; end time for the record</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Start Time</label>
                  <input className="input" type="time" value={bulk.startTime} onChange={setBulkField('startTime')} />
                </div>
                <div>
                  <label className="label">End Time</label>
                  <input className="input" type="time" value={bulk.endTime} onChange={setBulkField('endTime')} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="btransport" checked={bulk.hasTransport} onChange={setBulkField('hasTransport')} className="w-4 h-4 accent-primary" />
              <label htmlFor="btransport" className="text-sm font-medium text-gray-700">Include Transport (TZS 10,000)</label>
            </div>
            <div>
              <label className="label">Remarks (optional)</label>
              <input className="input" value={bulk.remarks} onChange={setBulkField('remarks')} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-primary flex-1">
                Add {selectedDates.size > 0 ? `${selectedDates.size} ` : ''}Session{selectedDates.size !== 1 ? 's' : ''}
              </button>
              <button type="button" onClick={() => setShowBulk(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Auto-fill Preview Modal */}
      {showAutoFill && autoFillSource && (
        <Modal title={`Auto-fill ${MONTHS[month-1]} ${year}`} onClose={() => setShowAutoFill(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              The following patterns from <strong>{MONTHS[autoFillSource.month-1]} {autoFillSource.year}</strong> will be applied to <strong>{MONTHS[month-1]} {year}</strong>:
            </p>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {['Day','Module','Class','Time','Hours'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {autoFillSource.patterns.map((p, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][p.dayOfWeek]}</td>
                      <td className="px-3 py-2 text-xs">{p.moduleCode}</td>
                      <td className="px-3 py-2 text-xs">{p.classCode}</td>
                      <td className="px-3 py-2 font-mono text-xs">{p.startTime}–{p.endTime}</td>
                      <td className="px-3 py-2">{p.hours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400">Sessions already in {MONTHS[month-1]} {year} will be skipped (no duplicates).</p>
            <div className="flex gap-3 pt-1">
              <button onClick={runAutoFill} disabled={autoFilling} className="btn-primary flex-1 py-3">
                {autoFilling ? 'Creating sessions…' : `Fill ${MONTHS[month-1]} ${year}`}
              </button>
              <button onClick={() => setShowAutoFill(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {showModal && (
        <Modal title="Edit Session" onClose={() => setShowModal(false)}>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Date</label>
                <input className="input" type="date" value={form.date} onChange={set('date')} required />
              </div>
              <div>
                <label className="label">Programme</label>
                <select className="input" value={form.programme} onChange={set('programme')}>
                  <option value="DEGREE">DEGREE</option>
                  <option value="OD">OD (Ordinary Diploma)</option>
                </select>
              </div>
              <div>
                <label className="label">Module</label>
                <select className="input" value={form.moduleId} onChange={set('moduleId')} required>
                  <option value="">-- Select Module --</option>
                  {modules.map(m => <option key={m.id} value={m.id}>{m.code} – {m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Class</label>
                <select className="input" value={form.classId} onChange={set('classId')} required>
                  <option value="">-- Select Class --</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Start Time</label>
                <input className="input" type="time" value={form.startTime} onChange={set('startTime')} required />
              </div>
              <div>
                <label className="label">End Time</label>
                <input className="input" type="time" value={form.endTime} onChange={set('endTime')} required />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="transport" checked={form.hasTransport} onChange={set('hasTransport')} className="w-4 h-4 accent-primary" />
              <label htmlFor="transport" className="text-sm font-medium text-gray-700">Include Transport (TZS 10,000)</label>
            </div>
            <div>
              <label className="label">Remarks (optional)</label>
              <input className="input" value={form.remarks} onChange={set('remarks')} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-primary flex-1">Update Session</button>
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal title="Confirm Delete" onClose={() => setDeleting(null)}>
          <p className="text-gray-600 mb-6">Are you sure you want to delete this session? This cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => remove(deleting)} className="btn-danger flex-1">Yes, Delete</button>
            <button onClick={() => setDeleting(null)} className="btn-secondary flex-1">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
