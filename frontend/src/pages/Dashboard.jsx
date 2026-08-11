import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../utils/api';
import { fmt, MONTHS, currentMonth, currentYear } from '../utils/format';

function StatCard({ label, value, sub, color }) {
  return (
    <div className="card">
      <div className={`text-xs font-bold uppercase tracking-wide mb-1 ${color || 'text-gray-500'}`}>{label}</div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/reports/dashboard').then(r => setData(r.data)).catch(console.error);
  }, []);

  if (!data) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-gray-400 text-lg">Loading dashboard…</div>
    </div>
  );

  const { thisMonth, recentSessions, monthlyChart } = data;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500 text-sm">{MONTHS[currentMonth - 1]} {currentYear} Overview</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/sessions')} className="btn-primary">+ Add Session</button>
          <button onClick={() => navigate('/claims')} className="btn-accent">Generate Claim</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="This Month's Hours" value={`${thisMonth.hours}h`} color="text-primary" />
        <StatCard label="Tuition Payment" value={`TZS ${fmt(thisMonth.tuition)}`} color="text-primary-light" />
        <StatCard label="Transport" value={`TZS ${fmt(thisMonth.transport)}`} color="text-accent" />
        <StatCard label="Gross Pay" value={`TZS ${fmt(thisMonth.gross)}`} sub={`${thisMonth.sessions} sessions`} color="text-green-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-bold text-gray-700 mb-4">Monthly Earnings (TZS)</h2>
          {monthlyChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyChart}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => (v/1000) + 'k'} />
                <Tooltip formatter={v => `TZS ${fmt(v)}`} />
                <Bar dataKey="tuition" fill="#0F4C81" name="Tuition" radius={[4,4,0,0]} />
                <Bar dataKey="transport" fill="#00A86B" name="Transport" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-300 text-sm">No data yet — add your first session</div>
          )}
        </div>

        <div className="card">
          <h2 className="font-bold text-gray-700 mb-4">Recent Sessions</h2>
          {recentSessions.length === 0 ? (
            <div className="text-center py-8 text-gray-300">
              <div className="text-4xl mb-2">📅</div>
              <p className="text-sm">No sessions yet</p>
              <button onClick={() => navigate('/sessions')} className="btn-primary mt-3 text-xs">Add First Session</button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentSessions.slice(0, 6).map(s => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                  <div>
                    <div className="text-sm font-medium text-gray-700">{s.module?.name || s.moduleId}</div>
                    <div className="text-xs text-gray-400">{s.date} · {s.class?.code} · {s.hours}h</div>
                  </div>
                  <div className="text-sm font-bold text-primary">TZS {fmt(s.gross)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="font-bold text-gray-700 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Add Session', icon: '➕', to: '/sessions', color: 'bg-blue-50 text-primary border-blue-100' },
            { label: 'Generate Claim', icon: '📋', to: '/claims', color: 'bg-green-50 text-accent border-green-100' },
            { label: 'Manage Modules', icon: '📚', to: '/modules', color: 'bg-purple-50 text-purple-600 border-purple-100' },
            { label: 'My Profile', icon: '👤', to: '/profile', color: 'bg-orange-50 text-orange-600 border-orange-100' },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.to)}
              className={`flex items-center gap-3 p-4 rounded-xl border font-medium text-sm transition-all hover:shadow-md ${a.color}`}>
              <span className="text-2xl">{a.icon}</span>
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
