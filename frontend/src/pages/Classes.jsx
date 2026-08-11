import { useEffect, useState } from 'react';
import api from '../utils/api';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';

const emptyForm = { code: '', programme: 'DEGREE', year: '1', semester: '1' };

export default function Classes() {
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const toast = useToast();

  const load = () => api.get('/classes').then(r => setClasses(r.data));
  useEffect(() => { load(); }, []);

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const openEdit = c => { setForm({ code: c.code, programme: c.programme, year: c.year, semester: c.semester }); setEditing(c.id); setShowModal(true); };
  const openNew = () => { setForm(emptyForm); setEditing(null); setShowModal(true); };

  const save = async e => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/classes/${editing}`, form);
      else await api.post('/classes', form);
      toast(editing ? 'Class updated' : 'Class added');
      setShowModal(false); load();
    } catch (err) { toast(err.response?.data?.error || 'Error saving', 'error'); }
  };

  const remove = async id => {
    try { await api.delete(`/classes/${id}`); toast('Class deleted'); setDeleting(null); load(); }
    catch { toast('Cannot delete — class has sessions', 'error'); setDeleting(null); }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Classes</h1>
          <p className="text-gray-500 text-sm">{classes.length} classes configured</p>
        </div>
        <button onClick={openNew} className="btn-primary">+ Add Class</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>{['Class Code','Programme','Year','Semester','Actions'].map(h => <th key={h} className="table-th">{h}</th>)}</tr>
          </thead>
          <tbody>
            {classes.length === 0 ? (
              <tr><td colSpan={5} className="table-td text-center text-gray-400 py-12">No classes yet</td></tr>
            ) : classes.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="table-td font-mono font-bold text-primary">{c.code}</td>
                <td className="table-td"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.programme==='DEGREE'?'bg-blue-100 text-blue-700':'bg-purple-100 text-purple-700'}`}>{c.programme}</span></td>
                <td className="table-td">Year {c.year}</td>
                <td className="table-td">Semester {c.semester}</td>
                <td className="table-td">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(c)} className="text-blue-500 hover:text-blue-700 text-xs px-2 py-1 rounded hover:bg-blue-50">Edit</button>
                    <button onClick={() => setDeleting(c.id)} className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? 'Edit Class' : 'Add Class'} onClose={() => setShowModal(false)}>
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="label">Class Code</label>
              <input className="input" value={form.code} onChange={set('code')} placeholder="e.g. BENG24BEBE-2" required />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">Programme</label>
                <select className="input" value={form.programme} onChange={set('programme')}>
                  <option value="DEGREE">DEGREE</option>
                  <option value="OD">OD</option>
                </select>
              </div>
              <div>
                <label className="label">Year</label>
                <select className="input" value={form.year} onChange={set('year')}>
                  {['1','2','3','4'].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Semester</label>
                <select className="input" value={form.semester} onChange={set('semester')}>
                  <option value="1">1</option>
                  <option value="2">2</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-primary flex-1">{editing ? 'Update' : 'Add Class'}</button>
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal title="Confirm Delete" onClose={() => setDeleting(null)}>
          <p className="text-gray-600 mb-6">Delete this class?</p>
          <div className="flex gap-3">
            <button onClick={() => remove(deleting)} className="btn-danger flex-1">Delete</button>
            <button onClick={() => setDeleting(null)} className="btn-secondary flex-1">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
