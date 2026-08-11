import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import PasswordInput from '../components/ui/PasswordInput';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      navigate('/');
    } catch (err) {
      toast(err.response?.data?.error || 'Something went wrong', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-primary-light flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎓</div>
          <h1 className="text-2xl font-bold text-gray-800">Part-Time Consultation</h1>
          <p className="text-gray-500 text-sm mt-1">Claims Management System</p>
        </div>

        <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
          {['login','register'].map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all capitalize ${
                mode === m ? 'bg-white shadow text-primary' : 'text-gray-500'
              }`}>
              {m === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="label">Full Name</label>
              <input className="input" placeholder="Joel Ngushwai" value={form.name} onChange={set('name')} required />
            </div>
          )}
          <div>
            <label className="label">Email Address</label>
            <input className="input" type="email" placeholder="your@email.com" value={form.email} onChange={set('email')} required />
          </div>
          <div>
            <label className="label">Password</label>
            <PasswordInput value={form.password} onChange={set('password')} required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-primary-light transition-colors disabled:opacity-60 mt-2">
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Part-Time Consultation · Claims Management
        </p>
      </div>
    </div>
  );
}
