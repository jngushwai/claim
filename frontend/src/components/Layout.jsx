import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const nav = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/sessions', label: 'Sessions', icon: '📅' },
  { to: '/timetable', label: 'Timetable', icon: '🗓️' },
  { to: '/claims', label: 'Generate Claims', icon: '📋' },
  { to: '/modules', label: 'Modules', icon: '📚' },
  { to: '/classes', label: 'Classes', icon: '🏫' },
  { to: '/profile', label: 'My Profile', icon: '👤' },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };
  const navItems = user?.role === 'super_admin'
    ? [{ to: '/admin', label: 'Super Admin', icon: '🛡️' }, ...nav]
    : nav;

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* Sidebar */}
      <aside className="w-64 bg-primary flex flex-col shadow-xl flex-shrink-0">
        <div className="px-6 py-5 border-b border-white/10">
          <div className="text-white font-bold text-lg leading-tight">Part-Time Consultation</div>
          <div className="text-blue-200 text-xs mt-0.5">Claims Management</div>
        </div>
        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white font-semibold border-r-4 border-white'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-blue-200 text-xs">Logged in as</span>
            {user?.role === 'super_admin' && (
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-white/20 text-white">
                Super Admin
              </span>
            )}
          </div>
          <div className="text-white text-sm font-medium truncate">{user?.name}</div>
          <button onClick={handleLogout} className="mt-3 text-xs text-blue-300 hover:text-white transition-colors">
            Sign Out →
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
