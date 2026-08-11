import { useEffect, useState } from 'react';
import api from '../utils/api';
import { fmt } from '../utils/format';
import { useToast } from '../components/ui/Toast';
import PasswordInput from '../components/ui/PasswordInput';

export default function Profile() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPw, setChangingPw] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.get('/lecturer').then(r => setForm(r.data)).catch(console.error);
  }, []);

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const setPwField = k => e => setPw(p => ({ ...p, [k]: e.target.value }));

  const changePassword = async e => {
    e.preventDefault();
    if (pw.newPassword.length < 6) return toast('New password must be at least 6 characters', 'error');
    if (pw.newPassword !== pw.confirmPassword) return toast('New passwords do not match', 'error');
    setChangingPw(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: pw.currentPassword,
        newPassword: pw.newPassword
      });
      setPw({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast('Password changed successfully');
    } catch (err) {
      toast(err.response?.data?.error || 'Error changing password', 'error');
    } finally { setChangingPw(false); }
  };

  const save = async e => {
    e.preventDefault(); setSaving(true);
    try {
      await api.put('/lecturer', form);
      toast('Profile saved successfully');
    } catch { toast('Error saving profile', 'error'); }
    finally { setSaving(false); }
  };

  if (!form) return <div className="p-6 text-gray-400">Loading profile…</div>;

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
        <p className="text-gray-500 text-sm">This information appears on your claim forms</p>
      </div>

      <form onSubmit={save} className="space-y-5">
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-700 border-b pb-2">Personal Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={form.name} onChange={set('name')} required />
            </div>
            <div>
              <label className="label">Department</label>
              <input className="input" value={form.department} onChange={set('department')} />
            </div>
            <div className="col-span-2">
              <label className="label">Address</label>
              <input className="input" value={form.address} onChange={set('address')} />
            </div>
            <div>
              <label className="label">Academic Year</label>
              <input className="input" value={form.academicYear} onChange={set('academicYear')} placeholder="2024/2025" />
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-bold text-gray-700 border-b pb-2">Bank Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Bank</label>
              <input className="input" value={form.bank} onChange={set('bank')} placeholder="CRDB" />
            </div>
            <div>
              <label className="label">Branch</label>
              <input className="input" value={form.branch} onChange={set('branch')} placeholder="VIJANA BRANCH" />
            </div>
            <div>
              <label className="label">Account Number</label>
              <input className="input" value={form.accountNo} onChange={set('accountNo')} placeholder="0152411777500" />
            </div>
            <div>
              <label className="label">Account Name</label>
              <input className="input" value={form.accountName} onChange={set('accountName')} />
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-bold text-gray-700 border-b pb-2">Hourly Rates (TZS)</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { k: 'degreeRate', label: 'Degree Program', placeholder: '15000' },
              { k: 'odRate', label: 'OD Program', placeholder: '10000' },
              { k: 'transportRate', label: 'Transport Rate', placeholder: '10000' },
            ].map(({ k, label, placeholder }) => (
              <div key={k}>
                <label className="label">{label}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">TZS</span>
                  <input className="input pl-12" type="number" value={form[k]} onChange={set(k)} placeholder={placeholder} />
                </div>
                <p className="text-xs text-gray-400 mt-1">{fmt(form[k])}/=</p>
              </div>
            ))}
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full py-3">
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </form>

      <form onSubmit={changePassword} className="card space-y-4">
        <h2 className="font-bold text-gray-700 border-b pb-2">Change Password</h2>
        <div>
          <label className="label">Current Password</label>
          <PasswordInput value={pw.currentPassword} onChange={setPwField('currentPassword')}
            required autoComplete="current-password" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">New Password</label>
            <PasswordInput value={pw.newPassword} onChange={setPwField('newPassword')}
              required autoComplete="new-password" />
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <PasswordInput value={pw.confirmPassword} onChange={setPwField('confirmPassword')}
              required autoComplete="new-password" />
          </div>
        </div>
        <p className="text-xs text-gray-400">At least 6 characters. You will keep your current session after changing.</p>
        <button type="submit" disabled={changingPw} className="btn-primary w-full py-3">
          {changingPw ? 'Changing…' : 'Change Password'}
        </button>
      </form>
    </div>
  );
}
