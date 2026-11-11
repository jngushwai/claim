import { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../utils/api';
import { fmt, MONTHS, currentMonth, currentYear } from '../utils/format';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import PasswordInput from '../components/ui/PasswordInput';

function StatCard({ label, value, sub, color }) {
  return (
    <div className="card">
      <div className={`text-xs font-bold uppercase tracking-wide mb-1 ${color || 'text-gray-500'}`}>{label}</div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between border-b pb-3 mb-4">
          <h3 className="font-bold text-lg text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function OverviewTab({ overview }) {
  if (!overview) return <div className="text-gray-400 py-8">Loading system overview…</div>;
  const { stats, monthlyChart, recentSessions } = overview;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Accounts"
          value={stats.totalUsers}
          sub={`${stats.activeUsers} active · ${stats.superAdmins} super admin`}
          color="text-primary"
        />
        <StatCard
          label="Total Sessions"
          value={stats.totalSessions}
          sub={`${stats.totalHours} total hours`}
          color="text-primary-light"
        />
        <StatCard
          label="Total Tuition"
          value={`TZS ${fmt(stats.totalTuition)}`}
          sub={`Transport: TZS ${fmt(stats.totalTransport)}`}
          color="text-accent"
        />
        <StatCard
          label="Institution Gross"
          value={`TZS ${fmt(stats.totalGross)}`}
          sub="All lecturers combined"
          color="text-green-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-bold text-gray-700 mb-4">Monthly Institution Claims (TZS)</h2>
          {monthlyChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyChart}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v / 1000}k`} />
                <Tooltip formatter={v => `TZS ${fmt(v)}`} />
                <Bar dataKey="tuition" fill="#0F4C81" name="Tuition" radius={[4, 4, 0, 0]} />
                <Bar dataKey="transport" fill="#00A86B" name="Transport" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-300 text-sm">No session data recorded yet</div>
          )}
        </div>

        <div className="card">
          <h2 className="font-bold text-gray-700 mb-4">Recent Sessions Across All Lecturers</h2>
          {recentSessions.length === 0 ? (
            <div className="text-center py-8 text-gray-300 text-sm">No sessions recorded yet</div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {recentSessions.map(s => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                  <div>
                    <div className="text-sm font-medium text-gray-800">
                      {s.lecturerName} <span className="text-gray-400 font-normal">· {s.module?.code}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {s.date} · {s.class?.code} · {s.hours}h ({s.programme})
                    </div>
                  </div>
                  <div className="text-sm font-bold text-primary">TZS {fmt(s.gross)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UsersTab({ users, currentUserId, onRefresh, toast }) {
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '', email: '', password: '', role: 'lecturer',
    department: '', degreeRate: '', odRate: '', transportRate: '',
  });

  const filtered = users.filter(u => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.lecturer?.department || '').toLowerCase().includes(q)
    );
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/users', createForm);
      toast('User created successfully');
      setShowCreate(false);
      setCreateForm({
        name: '', email: '', password: '', role: 'lecturer',
        department: '', degreeRate: '', odRate: '', transportRate: '',
      });
      onRefresh();
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to create user', 'error');
    } finally { setSaving(false); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/admin/users/${editing.id}`, {
        name: editing.name,
        email: editing.email,
        role: editing.role,
        isActive: editing.isActive,
        lecturer: editing.lecturer,
      });
      toast('User updated successfully');
      setEditing(null);
      onRefresh();
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to update user', 'error');
    } finally { setSaving(false); }
  };

  const handleToggleActive = async (u) => {
    try {
      await api.patch(`/admin/users/${u.id}`, { isActive: !u.isActive });
      toast(u.isActive ? 'Account disabled' : 'Account enabled');
      onRefresh();
    } catch (err) {
      toast(err.response?.data?.error || 'Action failed', 'error');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/admin/users/${resetTarget.id}/reset-password`, { newPassword });
      toast(`Password reset for ${resetTarget.email}`);
      setResetTarget(null);
      setNewPassword('');
      onRefresh();
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to reset password', 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Delete ${u.name} (${u.email}) and all their sessions, modules, and classes? This cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/admin/users/${u.id}`);
      toast('User deleted');
      onRefresh();
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to delete user', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          className="input max-w-sm"
          placeholder="Search by name, email, or department…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button onClick={() => setShowCreate(true)} className="btn-primary">+ Create User</button>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">User</th>
              <th className="table-th">Role & Auth</th>
              <th className="table-th">Department & Rates</th>
              <th className="table-th">Claims Activity</th>
              <th className="table-th">Status</th>
              <th className="table-th text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => {
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id} className="hover:bg-gray-50/70">
                  <td className="table-td">
                    <div className="font-semibold text-gray-800">
                      {u.name} {isSelf && <span className="text-xs text-primary font-normal">(You)</span>}
                    </div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </td>
                  <td className="table-td space-y-1">
                    <div>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        u.role === 'super_admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-50 text-primary'
                      }`}>
                        {u.role === 'super_admin' ? 'Super Admin' : 'Lecturer'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {u.googleLinked ? 'Google' : ''}{u.googleLinked && u.hasPassword ? ' + ' : ''}{u.hasPassword ? 'Password' : ''}
                    </div>
                  </td>
                  <td className="table-td text-xs">
                    <div className="font-medium text-gray-700">{u.lecturer?.department || '—'}</div>
                    <div className="text-gray-400">
                      Deg {fmt(u.lecturer?.degreeRate || 0)} · OD {fmt(u.lecturer?.odRate || 0)} · Tr {fmt(u.lecturer?.transportRate || 0)}
                    </div>
                  </td>
                  <td className="table-td text-xs">
                    <div className="font-semibold text-gray-800">TZS {fmt(u.stats?.gross || 0)}</div>
                    <div className="text-gray-400">{u.stats?.sessions || 0} sessions · {u.stats?.hours || 0}h</div>
                  </td>
                  <td className="table-td">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                      u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {u.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="table-td text-right">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      <button
                        onClick={() => setEditing({
                          id: u.id,
                          name: u.name,
                          email: u.email,
                          role: u.role,
                          isActive: u.isActive,
                          lecturer: {
                            department: u.lecturer?.department || '',
                            address: u.lecturer?.address || '',
                            bank: u.lecturer?.bank || '',
                            branch: u.lecturer?.branch || '',
                            accountNo: u.lecturer?.accountNo || '',
                            accountName: u.lecturer?.accountName || '',
                            academicYear: u.lecturer?.academicYear || '',
                            degreeRate: u.lecturer?.degreeRate ?? '',
                            odRate: u.lecturer?.odRate ?? '',
                            transportRate: u.lecturer?.transportRate ?? '',
                          },
                        })}
                        className="btn-secondary px-2.5 py-1 text-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { setResetTarget(u); setNewPassword(''); }}
                        className="btn-secondary px-2.5 py-1 text-xs"
                      >
                        Reset PW
                      </button>
                      {!isSelf && (
                        <>
                          <button
                            onClick={() => handleToggleActive(u)}
                            className="btn-secondary px-2.5 py-1 text-xs"
                          >
                            {u.isActive ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            className="btn-danger px-2.5 py-1 text-xs"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-400 text-sm">No matching users found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="Create New Account" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={createForm.email} onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Password</label>
                <PasswordInput value={createForm.password} onChange={e => setCreateForm(p => ({ ...p, password: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Role</label>
                <select className="input" value={createForm.role} onChange={e => setCreateForm(p => ({ ...p, role: e.target.value }))}>
                  <option value="lecturer">Lecturer</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Department</label>
              <input className="input" value={createForm.department} onChange={e => setCreateForm(p => ({ ...p, department: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Degree Rate</label>
                <input className="input" type="number" value={createForm.degreeRate} onChange={e => setCreateForm(p => ({ ...p, degreeRate: e.target.value }))} />
              </div>
              <div>
                <label className="label">OD Rate</label>
                <input className="input" type="number" value={createForm.odRate} onChange={e => setCreateForm(p => ({ ...p, odRate: e.target.value }))} />
              </div>
              <div>
                <label className="label">Transport</label>
                <input className="input" type="number" value={createForm.transportRate} onChange={e => setCreateForm(p => ({ ...p, transportRate: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create Account'}</button>
            </div>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit User · ${editing.email}`} onClose={() => setEditing(null)}>
          <form onSubmit={handleUpdate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Full Name</label>
                <input className="input" value={editing.name} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={editing.email} onChange={e => setEditing(p => ({ ...p, email: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Role</label>
                <select
                  className="input"
                  value={editing.role}
                  disabled={editing.id === currentUserId}
                  onChange={e => setEditing(p => ({ ...p, role: e.target.value }))}
                >
                  <option value="lecturer">Lecturer</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="label">Department</label>
                <input
                  className="input"
                  value={editing.lecturer.department}
                  onChange={e => setEditing(p => ({ ...p, lecturer: { ...p.lecturer, department: e.target.value } }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Bank</label>
                <input
                  className="input"
                  value={editing.lecturer.bank}
                  onChange={e => setEditing(p => ({ ...p, lecturer: { ...p.lecturer, bank: e.target.value } }))}
                />
              </div>
              <div>
                <label className="label">Account Number</label>
                <input
                  className="input"
                  value={editing.lecturer.accountNo}
                  onChange={e => setEditing(p => ({ ...p, lecturer: { ...p.lecturer, accountNo: e.target.value } }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Degree Rate</label>
                <input
                  className="input"
                  type="number"
                  value={editing.lecturer.degreeRate}
                  onChange={e => setEditing(p => ({ ...p, lecturer: { ...p.lecturer, degreeRate: e.target.value } }))}
                />
              </div>
              <div>
                <label className="label">OD Rate</label>
                <input
                  className="input"
                  type="number"
                  value={editing.lecturer.odRate}
                  onChange={e => setEditing(p => ({ ...p, lecturer: { ...p.lecturer, odRate: e.target.value } }))}
                />
              </div>
              <div>
                <label className="label">Transport Rate</label>
                <input
                  className="input"
                  type="number"
                  value={editing.lecturer.transportRate}
                  onChange={e => setEditing(p => ({ ...p, lecturer: { ...p.lecturer, transportRate: e.target.value } }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <button type="button" onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </form>
        </Modal>
      )}

      {resetTarget && (
        <Modal title={`Reset Password · ${resetTarget.name}`} onClose={() => setResetTarget(null)}>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <p className="text-xs text-gray-500">Set a new password (minimum 6 characters) for {resetTarget.email}.</p>
            <div>
              <label className="label">New Password</label>
              <PasswordInput value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setResetTarget(null)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Updating…' : 'Reset Password'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function ClaimsTab({ users, toast }) {
  const [month, setMonth] = useState(String(currentMonth));
  const [year, setYear] = useState(String(currentYear));
  const [userId, setUserId] = useState('');
  const [programme, setProgramme] = useState('ALL');
  const [data, setData] = useState({ summaryByLecturer: [], sessions: [] });
  const [loading, setLoading] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const loadClaims = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/claims', {
        params: {
          month: month || undefined,
          year: year || undefined,
          userId: userId || undefined,
          programme,
        },
      });
      setData(res.data);
    } catch {
      toast('Error loading claims data', 'error');
    } finally {
      setLoading(false);
    }
  }, [month, year, userId, programme, toast]);

  useEffect(() => { loadClaims(); }, [loadClaims]);

  const exportExcel = async () => {
    try {
      const params = new URLSearchParams();
      if (month) params.set('month', month);
      if (year) params.set('year', year);
      if (userId) params.set('userId', userId);
      if (programme) params.set('programme', programme);
      const token = localStorage.getItem('dit_token');
      const res = await fetch(`/api/admin/claims/excel?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DIT_SuperAdmin_Claims_${year || 'All'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('Institution summary Excel downloaded');
    } catch {
      toast('Failed to export Excel', 'error');
    }
  };

  const totals = data.summaryByLecturer.reduce(
    (acc, r) => ({
      sessions: acc.sessions + r.sessions,
      hours: acc.hours + r.hours,
      tuition: acc.tuition + r.tuition,
      transport: acc.transport + r.transport,
      gross: acc.gross + r.gross,
    }),
    { sessions: 0, hours: 0, tuition: 0, transport: 0, gross: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Month</label>
          <select className="input w-36" value={month} onChange={e => setMonth(e.target.value)}>
            <option value="">All Months</option>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Year</label>
          <select className="input w-28" value={year} onChange={e => setYear(e.target.value)}>
            <option value="">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Lecturer</label>
          <select className="input w-52" value={userId} onChange={e => setUserId(e.target.value)}>
            <option value="">All Lecturers</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
          </select>
        </div>
        <div>
          <label className="label">Programme</label>
          <select className="input w-32" value={programme} onChange={e => setProgramme(e.target.value)}>
            <option value="ALL">All</option>
            <option value="DEGREE">DEGREE</option>
            <option value="OD">OD</option>
          </select>
        </div>
        <button onClick={exportExcel} className="btn-accent ml-auto">⬇ Export Summary Excel</button>
      </div>

      <div className="card p-0 overflow-x-auto">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="font-bold text-gray-700">Claims Summary by Lecturer</h3>
          <span className="text-sm font-bold text-primary">Total Gross: TZS {fmt(totals.gross)}</span>
        </div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Lecturer</th>
              <th className="table-th">Department</th>
              <th className="table-th">Bank / Account</th>
              <th className="table-th">Sessions</th>
              <th className="table-th">Hours</th>
              <th className="table-th">Tuition</th>
              <th className="table-th">Transport</th>
              <th className="table-th">Gross</th>
            </tr>
          </thead>
          <tbody>
            {data.summaryByLecturer.map(r => (
              <tr key={r.userId}>
                <td className="table-td">
                  <div className="font-semibold text-gray-800">{r.name}</div>
                  <div className="text-xs text-gray-400">{r.email}</div>
                </td>
                <td className="table-td text-xs">{r.department || '—'}</td>
                <td className="table-td text-xs">
                  <div>{r.bank || '—'}</div>
                  <div className="text-gray-400">{r.accountNo || 'No account #'}</div>
                </td>
                <td className="table-td">{r.sessions}</td>
                <td className="table-td">{r.hours}h</td>
                <td className="table-td">TZS {fmt(r.tuition)}</td>
                <td className="table-td">TZS {fmt(r.transport)}</td>
                <td className="table-td font-bold text-primary">TZS {fmt(r.gross)}</td>
              </tr>
            ))}
            {data.summaryByLecturer.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-400 text-sm">
                  {loading ? 'Loading claims…' : 'No claims found for the selected filter'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card p-0 overflow-x-auto">
        <div className="px-6 py-4 border-b">
          <h3 className="font-bold text-gray-700">Detailed Sessions ({data.sessions.length})</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Date</th>
              <th className="table-th">Lecturer</th>
              <th className="table-th">Module & Class</th>
              <th className="table-th">Time</th>
              <th className="table-th">Programme</th>
              <th className="table-th">Gross</th>
            </tr>
          </thead>
          <tbody>
            {data.sessions.slice(0, 100).map(s => (
              <tr key={s.id}>
                <td className="table-td text-xs">{s.date}</td>
                <td className="table-td text-xs font-medium">{s.lecturerName}</td>
                <td className="table-td text-xs">{s.module?.code} · {s.class?.code}</td>
                <td className="table-td text-xs">{s.startTime}–{s.endTime} ({s.hours}h)</td>
                <td className="table-td text-xs">{s.programme}</td>
                <td className="table-td text-xs font-semibold text-primary">TZS {fmt(s.gross)}</td>
              </tr>
            ))}
            {data.sessions.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-400 text-sm">No matching sessions</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Admin() {
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const { user } = useAuth();
  const toast = useToast();

  const loadAll = useCallback(async () => {
    try {
      const [ov, us] = await Promise.all([
        api.get('/admin/overview'),
        api.get('/admin/users'),
      ]);
      setOverview(ov.data);
      setUsers(us.data);
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to load Super Admin data', 'error');
    }
  }, [toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Super Admin Panel</h1>
          <p className="text-gray-500 text-sm">Manage lecturers, user accounts, hourly rates, and institution claims</p>
        </div>
        <button onClick={loadAll} className="btn-secondary">↻ Refresh</button>
      </div>

      <div className="flex gap-2 border-b border-gray-200 pb-3">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'users', label: `Users & Lecturers (${users.length})` },
          { id: 'claims', label: 'All Claims & Sessions' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab overview={overview} />}
      {tab === 'users' && <UsersTab users={users} currentUserId={user?.id} onRefresh={loadAll} toast={toast} />}
      {tab === 'claims' && <ClaimsTab users={users} toast={toast} />}
    </div>
  );
}
