import { useEffect, useState } from 'react';
import api from '../utils/api';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';

const emptyForm = { code: '', name: '', programme: 'DEGREE', status: 'active' };

export default function Modules() {
  const [modules, setModules] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const toast = useToast();

  const load = () => api.get('/modules').then(r => setModules(r.data));
  useEffect(() => { load(); }, []);

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const openEdit = m => { setForm({ code: m.code, name: m.name, programme: m.programme, status: m.status }); setEditing(m.id); setShowModal(true); };
  const openNew = () => { setForm(emptyForm); setEditing(null); setShowModal(true); };

  const save = async e => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/modules/${editing}`, form);
      else await api.post('/modules', form);
      toast(editing ? 'Module updated' : 'Module added');
      setShowModal(false); load();
    } catch (err) { toast(err.response?.data?.error || 'Error saving', 'error'); }
  };

  const remove = async id => {
    try { await api.delete(`/modules/${id}`); toast('Module deleted'); setDeleting(null); load(); }
    catch { toast('Cannot delete — module has sessions', 'error'); setDeleting(null); }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Modules</h1>
          <p className="text-gray-500 text-sm">{modules.length} modules configured</p>
        </div>
        <button onClick={openNew} className="btn-primary">+ Add Module</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>{['Code','Module Name','Programme','Status','Actions'].map(h => <th key={h} className="table-th">{h}</th>)}</tr>
          </thead>
          <tbody>
            {modules.length === 0 ? (
              <tr><td colSpan={5} className="table-td text-center text-gray-400 py-12">No modules yet — add your first module</td></tr>
            ) : modules.map(m => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="table-td font-mono font-bold text-primary">{m.code}</td>
                <td className="table-td font-medium">{m.name}</td>
                <td className="table-td"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.programme==='DEGREE'?'bg-blue-100 text-blue-700':'bg-purple-100 text-purple-700'}`}>{m.programme}</span></td>
                <td className="table-td"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.status==='active'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{m.status}</span></td>
                <td className="table-td">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(m)} className="text-blue-500 hover:text-blue-700 text-xs px-2 py-1 rounded hover:bg-blue-50">Edit</button>
                    <button onClick={() => setDeleting(m.id)} className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? 'Edit Module' : 'Add Module'} onClose={() => setShowModal(false)}>
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="label">Module Code</label>
              <input className="input" value={form.code} onChange={set('code')} required />
            </div>
            <div>
              <label className="label">Module Name</label>
              <input className="input" value={form.name} onChange={set('name')} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Programme</label>
                <select className="input" value={form.programme} onChange={set('programme')}>
                  <option value="DEGREE">DEGREE</option>
                  <option value="OD">OD (Ordinary Diploma)</option>
                  <option value="BOTH">BOTH</option>
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={set('status')}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-primary flex-1">{editing ? 'Update' : 'Add Module'}</button>
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal title="Confirm Delete" onClose={() => setDeleting(null)}>
          <p className="text-gray-600 mb-6">Delete this module? This will fail if sessions exist for it.</p>
          <div className="flex gap-3">
            <button onClick={() => remove(deleting)} className="btn-danger flex-1">Delete</button>
            <button onClick={() => setDeleting(null)} className="btn-secondary flex-1">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
