import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { BookOpen, Layers, ClipboardList, Users, BarChart3, Settings, LogOut, Bell, Search, AlertTriangle, ChevronDown, Menu } from 'lucide-react';
import useSettings from '../hooks/useSettings';
import ChartBar from '../components/ChartBar';
import ChartLine from '../components/ChartLine';

const StatCard = ({ icon: Icon, label, value }) => (
  <div className="rounded-2xl bg-white shadow-xl shadow-navy/5 p-5 flex items-center gap-4">
    <div className="rounded-xl p-2 bg-blue-50">
      <Icon className="h-6 w-6 text-blue-600" />
    </div>
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  </div>
);

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { settings: appSettings } = useSettings();

  const formatDateSafe = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      // Try parsing common non-ISO formats (e.g., 'YYYY-MM-DD HH:mm:ss')
      const parsed = Date.parse(value.replace(' ', 'T'));
      if (!Number.isNaN(parsed)) {
        return new Date(parsed).toLocaleDateString();
      }
      return typeof value === 'string' ? value : '-';
    }
    return d.toLocaleDateString();
  };

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const response = await api.get('/api/stats/dashboard');
      setStats(response.data.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#E3F2FD]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Monthly Borrowing Activity Chart
  const monthlyLabels = (stats?.monthly_borrowings ?? []).map((m) => m.month_name);
  const monthlyData = (stats?.monthly_borrowings ?? []).map((m) => m.total);
  const monthlyChartData = {
    labels: monthlyLabels,
    datasets: [
      {
        label: 'Borrowings',
        data: monthlyData,
        fill: true,
        backgroundColor: 'rgba(30,136,229,0.2)',
        borderColor: '#1E88E5',
        tension: 0.4,
      },
    ],
  };
  // Most Borrowed Categories Chart
  const categoryLabels = (stats?.categories_stats ?? []).map((c) => c.category);
  const categoryData = (stats?.categories_stats ?? []).map((c) => c.borrow_count);
  const categoryChartData = {
    labels: categoryLabels,
    datasets: [
      {
        label: 'Borrowings',
        data: categoryData,
        backgroundColor: 'rgba(13,71,161,0.7)',
      },
    ],
  };

  return (
    <>
    <div className="min-h-screen bg-[#E3F2FD] text-slate-800 flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-72 text-white flex-col" style={{background:'#0D47A1', backdropFilter:'saturate(140%) blur(6px)'}}>
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <span className="font-bold">IT</span>
            </div>
            <div>
              <div className="text-lg font-semibold">ITERARY</div>
              <div className="text-xs text-white/70">Admin Console</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <Link className="flex items-center gap-3 px-3 py-3 rounded-lg bg-white/10 transition hover:bg-white/20" to="/admin/dashboard"><BarChart3 className="h-5 w-5"/> Dashboard</Link>
          <Link className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/10 transition" to="/admin/books"><BookOpen className="h-5 w-5"/> Manage Books</Link>
          <a className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/10 transition" href="#"><Layers className="h-5 w-5"/> Manage Categories</a>
          <a className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/10 transition" href="#"><ClipboardList className="h-5 w-5"/> Borrowings</a>
          <a className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/10 transition" href="#"><Users className="h-5 w-5"/> Members</a>
          {/* Reports removed per request */}
          <a className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/10 transition" href="#"><Settings className="h-5 w-5"/> Settings</a>
        </nav>
        <div className="px-3 py-4 border-t border-white/10">
          <a className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/10" href="#"><LogOut className="h-5 w-5"/> Logout</a>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col">
        {/* Top Navbar */}
        <header className="mx-3 md:mx-6 mt-6 rounded-2xl bg-white shadow-xl shadow-navy/5 px-3 md:px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 w-[40%]">
            <button className="md:hidden rounded-xl p-2 bg-blue-50" onClick={() => setMobileNavOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5 text-blue-600" />
            </button>
            <div className="hidden md:block rounded-xl p-2 bg-blue-50"><Search className="h-5 w-5 text-blue-600"/></div>
            <input onFocus={() => setShowSearch(true)} className="hidden md:block w-full bg-white/60 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1E88E5]" placeholder="Search books, members, reports..." />
          </div>
          <div className="flex items-center gap-4 relative">
            <button onClick={() => setShowNotifications((s)=>!s)} className="relative rounded-xl p-2 bg-blue-50 hover:shadow-md transition">
              <Bell className="h-6 w-6 text-[#0D47A1]" />
              <span className="absolute -top-1 -right-1 text-xs bg-red-500 text-white rounded-full px-1">3</span>
            </button>
            <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => setShowProfile((p)=>!p)}>
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-900">{appSettings?.profile?.fullName || 'Admin'}</div>
                <div className="text-xs text-slate-500">Administrator</div>
              </div>
              <img src={appSettings?.profile?.avatar_url || 'https://i.pravatar.cc/40'} className="w-10 h-10 rounded-full shadow" alt="Admin"/>
              <ChevronDown className="h-4 w-4 text-slate-500"/>
            </div>
            {showNotifications && (
              <div className="absolute right-20 top-12 w-80 rounded-2xl bg-white shadow-xl shadow-navy/10 border border-slate-100 p-3 z-20">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold">Notifications</div>
                  <button className="text-xs text-blue-600">Mark all read</button>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-3 p-2 rounded-xl hover:bg-slate-50"><span className="w-2 h-2 rounded-full bg-red-500 mt-1"></span> 18 overdue borrowings require attention</li>
                  <li className="flex items-start gap-3 p-2 rounded-xl hover:bg-slate-50"><span className="w-2 h-2 rounded-full bg-yellow-500 mt-1"></span> 5 items due in next 48 hours</li>
                  <li className="flex items-start gap-3 p-2 rounded-xl hover:bg-slate-50"><span className="w-2 h-2 rounded-full bg-blue-500 mt-1"></span> New member registrations today: {stats?.new_members_today ?? 0}</li>
                </ul>
              </div>
            )}
            {showProfile && (
              <div className="absolute right-0 top-12 w-52 rounded-2xl bg-white shadow-xl shadow-navy/10 border border-slate-100 p-2 z-20">
                <a className="block px-3 py-2 rounded-xl hover:bg-slate-50 text-sm" href="#">Profile</a>
                <a className="block px-3 py-2 rounded-xl hover:bg-slate-50 text-sm" href="#">Settings</a>
                <a className="block px-3 py-2 rounded-xl hover:bg-slate-50 text-sm text-red-600" href="#">Logout</a>
              </div>
            )}
          </div>
        </header>

        {/* Content grid */}
        <main className="grid grid-cols-12 gap-3 md:gap-6 p-3 md:p-6">
          {/* Stat cards */}
          <section className="col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="rounded-2xl p-[1px]" style={{background:'linear-gradient(180deg,#E3F2FD 0%, #FFFFFF 100%)'}}>
              <StatCard icon={BookOpen} label="Total Books" value={stats?.total_books ?? 0} />
            </div>
            <div className="rounded-2xl p-[1px]" style={{background:'linear-gradient(180deg,#E3F2FD 0%, #FFFFFF 100%)'}}>
              <StatCard icon={Users} label="Available Books" value={stats?.total_available ?? 0} />
            </div>
            <div className="rounded-2xl p-[1px]" style={{background:'linear-gradient(180deg,#E3F2FD 0%, #FFFFFF 100%)'}}>
              <StatCard icon={ClipboardList} label="Active Borrowings" value={stats?.active_borrowings ?? 0} />
            </div>
            <div className="rounded-2xl p-[1px]" style={{background:'linear-gradient(180deg,#E3F2FD 0%, #FFFFFF 100%)'}}>
              <StatCard icon={AlertTriangle} label="Overdue" value={stats?.overdue_borrowings ?? 0} />
            </div>
          </section>

          {/* Charts + Table (full width) */}
          <section className="col-span-12 space-y-6">
            <div className="rounded-2xl bg-white shadow-xl shadow-navy/5 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">Monthly Borrowing Activity</h3>
              </div>
              <div className="rounded-2xl bg-[#EAF3FE] h-48 border border-slate-200 relative overflow-hidden">
                <ChartLine data={monthlyChartData} options={{responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}}}} height={160} />
              </div>
            </div>
            {/* Side-by-side, larger cards to fill space */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
              <div className="rounded-2xl bg-white shadow-xl shadow-navy/5 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700">Most Borrowed Categories</h3>
                </div>
                <div className="rounded-2xl bg-[#E3F2FD] h-56 md:h-64 border border-slate-200 grid grid-cols-1 items-end gap-2 md:gap-3 p-4 md:p-6">
                  <ChartBar data={categoryChartData} options={{responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}}}} height={220} />
                </div>
              </div>
              <div className="rounded-2xl bg-white shadow-xl shadow-navy/5 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-700">Recent Borrowings</h3>
                  <button className="px-3 py-2 text-sm rounded-xl border border-[#1E88E5] text-[#0D47A1] bg-white">View All</button>
                </div>
                <div className="min-h-[12rem] md:min-h-[16rem] flex">
                  <table className="w-full text-sm self-stretch">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="py-2 pr-4">Book Title</th>
                        <th className="py-2 pr-4">Borrower</th>
                        <th className="py-2 pr-4">Date Borrowed</th>
                        <th className="py-2 pr-4">Due Date</th>
                        <th className="py-2 pr-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(stats?.recent_borrowings ?? []).slice(0,3).map((b) => (
                        <tr key={b.id} className="border-t hover:bg-slate-50 transition">
                          <td className="py-3 pr-4">{b.book_title}</td>
                          <td className="py-3 pr-4">{b.member_name}</td>
                          <td className="py-3 pr-4">{formatDateSafe(b.created_at)}</td>
                          <td className="py-3 pr-4">{formatDateSafe(b.due_date)}</td>
                          <td className="py-3 pr-4">
                            <span className="px-2 py-1 rounded bg-green-100 text-green-700">{b.status || 'Active'}</span>
                          </td>
                        </tr>
                      ))}
                      {(stats?.recent_borrowings ?? []).length === 0 && (
                        <tr><td className="py-4 text-slate-500" colSpan={5}>No recent borrowings</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          {/* Right side panel removed per request */}
        </main>
      </div>
    </div>

    {/* Mobile drawer */}
    {mobileNavOpen && (
      <div className="fixed inset-0 z-40" aria-modal="true" role="dialog">
        <div className="absolute inset-0 bg-black/30" onClick={() => setMobileNavOpen(false)}></div>
        <div className="absolute left-0 top-0 h-full w-72 max-w-[75%] text-white" style={{background:'#0D47A1'}}>
          <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <span className="font-bold">IT</span>
              </div>
              <div>
                <div className="text-base font-semibold">ITERARY</div>
                <div className="text-xs text-white/70">Admin Console</div>
              </div>
            </div>
            <button className="rounded-xl px-3 py-2 bg-white/10" onClick={() => setMobileNavOpen(false)}>Close</button>
          </div>
          <nav className="px-2 py-3 space-y-1">
            <Link className="block px-3 py-3 rounded-lg bg-white/10" to="/admin/dashboard" onClick={() => setMobileNavOpen(false)}><BarChart3 className="inline-block mr-2 h-5 w-5"/> Dashboard</Link>
            <Link className="block px-3 py-3 rounded-lg hover:bg-white/10" to="/admin/books" onClick={() => setMobileNavOpen(false)}><BookOpen className="inline-block mr-2 h-5 w-5"/> Manage Books</Link>
            <Link className="block px-3 py-3 rounded-lg hover:bg-white/10" to="/admin/categories" onClick={() => setMobileNavOpen(false)}><Layers className="inline-block mr-2 h-5 w-5"/> Manage Categories</Link>
            <Link className="block px-3 py-3 rounded-lg hover:bg-white/10" to="/admin/borrowings" onClick={() => setMobileNavOpen(false)}><ClipboardList className="inline-block mr-2 h-5 w-5"/> Borrowings</Link>
            <Link className="block px-3 py-3 rounded-lg hover:bg-white/10" to="/admin/members" onClick={() => setMobileNavOpen(false)}><Users className="inline-block mr-2 h-5 w-5"/> Members</Link>
            {/* Reports removed per request */}
            <Link className="block px-3 py-3 rounded-lg hover:bg-white/10" to="/admin/settings" onClick={() => setMobileNavOpen(false)}><Settings className="inline-block mr-2 h-5 w-5"/> Settings</Link>
          </nav>
        </div>
      </div>
    )}
    {showSearch && (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-start justify-center pt-24 z-30" onClick={()=>setShowSearch(false)}>
        <div className="w-full max-w-2xl mx-auto rounded-2xl bg-white shadow-2xl shadow-navy/20 border border-slate-100" onClick={(e)=>e.stopPropagation()}>
          <div className="p-4 flex items-center gap-3">
            <div className="rounded-xl p-2 bg-blue-50"><Search className="h-5 w-5 text-blue-600"/></div>
            <input autoFocus placeholder="Type to search books, members, reports..." className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1E88E5]"/>
          </div>
          <div className="px-4 pb-4 text-xs text-slate-500">Press ESC to close</div>
        </div>
      </div>
    )}
    </>
  );
};

export default AdminDashboard;
