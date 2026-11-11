import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import PasswordInput from '../components/ui/PasswordInput';
import api from '../utils/api';

const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

function GoogleLogo() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-8.97Z" />
      <path fill="#34A853" d="M12 24c3.3 0 6.08-1.09 8.11-2.96l-3.88-3.05c-1.08.72-2.45 1.16-4.23 1.16-3.25 0-6.01-2.19-7-5.15H.99v3.14C3.01 21.14 7.18 24 12 24Z" />
      <path fill="#FBBC05" d="M5 14c-.25-.72-.39-1.49-.39-2.29s.14-1.57.39-2.29V6.28H.99A11.98 11.98 0 0 0 0 11.71c0 1.93.46 3.76 1.29 5.43L5 14Z" />
      <path fill="#EA4335" d="M12 4.75c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.07 1.19 15.3 0 12 0 7.18 0 3.01 2.86.99 7.14L5 10.28c.99-2.96 3.75-5.53 7-5.53Z" />
    </svg>
  );
}

export default function Login() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [googleConfig, setGoogleConfig] = useState({
    loaded: false,
    enabled: Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID),
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || null,
  });
  const [gsiState, setGsiState] = useState('idle');

  const googleBtnRef = useRef(null);
  const initializedClientRef = useRef(null);
  const googleHandlerRef = useRef(null);

  const { login, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  googleHandlerRef.current = async (response) => {
    if (!response?.credential) {
      toast('Google sign-in did not return a credential', 'error');
      return;
    }
    setLoading(true);
    try {
      const data = await loginWithGoogle(response.credential);
      navigate(data?.user?.role === 'super_admin' ? '/admin' : '/');
    } catch (err) {
      toast(err.response?.data?.error || 'Google sign-in failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    api.get('/auth/google/config')
      .then((res) => {
        if (cancelled) return;
        const clientId = res.data?.clientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || null;
        setGoogleConfig({ loaded: true, enabled: Boolean(clientId), clientId });
      })
      .catch(() => {
        if (cancelled) return;
        const fallbackId = import.meta.env.VITE_GOOGLE_CLIENT_ID || null;
        setGoogleConfig({ loaded: true, enabled: Boolean(fallbackId), clientId: fallbackId });
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!googleConfig.enabled || !googleConfig.clientId) return;
    if (window.google?.accounts?.id) {
      setGsiState('ready');
      return;
    }

    setGsiState('loading');
    let script = document.querySelector(`script[src="${GSI_SCRIPT_SRC}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = GSI_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const onLoad = () => setGsiState('ready');
    const onError = () => setGsiState('error');
    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);
    return () => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };
  }, [googleConfig.enabled, googleConfig.clientId]);

  useEffect(() => {
    if (gsiState !== 'ready' || !googleConfig.clientId || !googleBtnRef.current) return;
    const gsi = window.google?.accounts?.id;
    if (!gsi) return;

    if (initializedClientRef.current !== googleConfig.clientId) {
      gsi.initialize({
        client_id: googleConfig.clientId,
        callback: (resp) => googleHandlerRef.current?.(resp),
      });
      initializedClientRef.current = googleConfig.clientId;
    }

    const container = googleBtnRef.current;
    container.innerHTML = '';
    gsi.renderButton(container, {
      theme: 'outline',
      size: 'large',
      shape: 'rectangular',
      text: mode === 'login' ? 'signin_with' : 'signup_with',
      width: container.offsetWidth || 360,
    });
  }, [gsiState, googleConfig.clientId, mode]);

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = mode === 'login'
        ? await login(form.email, form.password)
        : await register(form.name, form.email, form.password);
      navigate(data?.user?.role === 'super_admin' ? '/admin' : '/');
    } catch (err) {
      toast(err.response?.data?.error || 'Something went wrong', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFallbackGoogleClick = () => {
    if (!googleConfig.loaded || gsiState === 'loading') return;
    if (!googleConfig.enabled) {
      toast('Google Sign-In is not configured yet. Set GOOGLE_CLIENT_ID in backend/.env.', 'warn');
      return;
    }
    if (gsiState === 'error') {
      toast('Could not load Google Sign-In. Check your internet connection.', 'error');
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
              <input className="input" value={form.name} onChange={set('name')} required />
            </div>
          )}
          <div>
            <label className="label">Email Address</label>
            <input className="input" type="email" value={form.email} onChange={set('email')} required />
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

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-gray-400">or</span>
          </div>
        </div>

        {gsiState === 'ready' && googleConfig.enabled ? (
          <div className={loading ? 'opacity-60 pointer-events-none' : ''}>
            <div ref={googleBtnRef} className="w-full flex justify-center min-h-[44px]" />
          </div>
        ) : (
          <button
            type="button"
            disabled={loading || !googleConfig.loaded || gsiState === 'loading'}
            onClick={handleFallbackGoogleClick}
            className="w-full flex items-center justify-center gap-3 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 py-2.5 px-4 rounded-xl font-medium text-sm transition-colors disabled:opacity-60"
          >
            <GoogleLogo />
            <span>
              {gsiState === 'loading' ? 'Loading Google Sign-In…' : 'Continue with Google'}
            </span>
          </button>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          Part-Time Consultation · Claims Management
        </p>
      </div>
    </div>
  );
}
