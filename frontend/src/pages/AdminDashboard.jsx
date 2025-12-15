import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { BookOpen, Layers, ClipboardList, Users, BarChart3, Settings, LogOut, Bell, Search, AlertTriangle, ChevronDown, Menu } from 'lucide-react';
import { useGlobalSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import ChartBar from '../components/ChartBar';
import ChartLine from '../components/ChartLine';

const StatCard = ({ icon: Icon, label, value, colorClass = "text-blue-600", bgClass = "bg-blue-50" }) => (
  <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6 flex items-center transition-transform hover:-translate-y-1">
    <div className={`rounded-full p-3 ${bgClass}`}>
      <Icon className={`h-6 w-6 ${colorClass}`} />
    </div>
    <div className="ml-4">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
    </div>
  </div>
);

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { settings } = useGlobalSettings();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Get settings data
  const appName = settings?.system?.appName || 'ITERARY';
  const logoUrl = settings?.system?.logo_url;
  const profileName = settings?.profile?.fullName || 'Admin';
  const avatarUrl = settings?.profile?.avatar_url;

  const formatDateSafe = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      const parsed = Date.parse(value.replace(' ', 'T'));
      if (!Number.isNaN(parsed)) {
        return new Date(parsed).toLocaleDateString('id-ID');
      }
      return typeof value === 'string' ? value : '-';
    }
    return d.toLocaleDateString('id-ID');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const response = await api.get('/api/stats/dashboard');
      const data = response.data.data;
      setStats(data);

      const newNotifs = [];

      if (data.overdue_borrowings > 0) {
        newNotifs.push({
          id: 'overdue',
          type: 'danger',
          message: `${data.overdue_borrowings} buku terlambat dikembalikan`,
          link: '/admin/borrowings?status=overdue'
        });
      }

      if (data.active_borrowings > 0) {
        newNotifs.push({
          id: 'active',
          type: 'info',
          message: `${data.active_borrowings} peminjaman sedang aktif`,
          link: '/admin/borrowings'
        });
      }

      if (data.total_available < (data.total_books * 0.1)) {
        newNotifs.push({
          id: 'stock',
          type: 'warning',
          message: 'Stok buku tersedia menipis!',
          link: '/admin/books'
        });
      }

      setNotifications(newNotifs);
      setUnreadCount(newNotifs.length);

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

  // Monthly Borrowing Activity Chart (Line)
  const monthlyLabels = (stats?.monthly_borrowings ?? []).map((m) => m.month_name);
  const monthlyData = (stats?.monthly_borrowings ?? []).map((m) => m.total);
  const monthlyChartData = {
    labels: monthlyLabels,
    datasets: [
      {
        label: 'Peminjaman',
        data: monthlyData,
        fill: true,
        backgroundColor: 'rgba(30,136,229,0.1)',
        borderColor: '#1E88E5',
        tension: 0.4,
        pointBackgroundColor: '#1E88E5',
      },
    ],
  };

  // Most Borrowed Categories Chart (Horizontal Bar)
  const categoryLabels = (stats?.categories_stats ?? []).map((c) => c.category);
  const categoryData = (stats?.categories_stats ?? []).map((c) => c.borrow_count);
  const categoryChartData = {
    labels: categoryLabels,
    datasets: [
      {
        label: 'Jumlah Peminjaman',
        data: categoryData,
        backgroundColor: 'rgba(13, 71, 161, 0.8)',
        borderRadius: 4,
      },
    ],
  };

  return (
    <>
    <div className="min-h-screen bg-gray-50 text-slate-800 flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-72 text-white flex-col" style={{background:'#0D47A1'}}>
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl.startsWith('/') ? `http://localhost:8080${logoUrl}` : logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="font-bold">{appName.substring(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div>
              <div className="text-lg font-semibold">{appName}</div>
              <div className="text-xs text-white/70">Admin Console</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <Link className="flex items-center gap-3 px-3 py-3 rounded-lg bg-white/10 transition hover:bg-white/20" to="/admin/dashboard"><BarChart3 className="h-5 w-5"/> Dashboard</Link>
          <Link className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/10 transition" to="/admin/books"><BookOpen className="h-5 w-5"/> Buku</Link>
          <Link className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/10 transition" to="/admin/categories"><Layers className="h-5 w-5"/> Kategori</Link>
          <Link className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/10 transition" to="/admin/borrowings"><ClipboardList className="h-5 w-5"/> Peminjaman</Link>
          <Link className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/10 transition" to="/admin/members"><Users className="h-5 w-5"/> Anggota</Link>
          <Link className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/10 transition" to="/admin/settings"><Settings className="h-5 w-5"/> Pengaturan</Link>
        </nav>
        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/10 text-left transition"
          >
            <LogOut className="h-5 w-5"/> Keluar
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col">
        {/* Top Navbar */}
        <header className="relative z-50 mx-6 mt-6 rounded-2xl bg-white shadow-sm border border-gray-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button className="md:hidden rounded-xl p-2 bg-blue-50" onClick={() => setMobileNavOpen(true)}>
              <Menu className="h-5 w-5 text-blue-600" />
            </button>
            <h2 className="text-xl font-bold text-gray-800 ml-2 md:ml-0">Dashboard Admin</h2>
          </div>

          <div className="flex items-center gap-4 relative">
            <button
              onClick={() => setShowNotifications((s)=>!s)}
              className="relative rounded-xl p-2 bg-gray-50 hover:bg-blue-50 transition text-gray-600 hover:text-blue-600"
            >
              <Bell className="h-6 w-6" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-2 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white"></span>
              )}
            </button>

            {/* Dropdown Notifikasi */}
            {showNotifications && (
              <div className="absolute right-16 top-14 w-80 rounded-xl bg-white shadow-lg border border-gray-100 p-0 z-50 animate-in fade-in slide-in-from-top-2 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                  <h3 className="font-semibold text-sm text-gray-800">Notifikasi</h3>
                  {unreadCount > 0 && (
                    <button onClick={() => setUnreadCount(0)} className="text-xs text-blue-600 hover:underline">
                      Tandai dibaca
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length > 0 ? (
                    notifications.map((notif, idx) => (
                      <Link
                        key={idx}
                        to={notif.link}
                        className="block px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition"
                        onClick={() => setShowNotifications(false)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                            notif.type === 'danger' ? 'bg-red-500' :
                            notif.type === 'warning' ? 'bg-orange-500' : 'bg-blue-500'
                          }`} />
                          <p className="text-sm text-gray-600 leading-snug">{notif.message}</p>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-center text-gray-400 text-sm">
                      Tidak ada notifikasi baru
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => setShowProfile((p)=>!p)}>
              <div className="text-right hidden md:block">
                <div className="text-sm font-bold text-gray-900">{profileName}</div>
                <div className="text-xs text-gray-500">Super Admin</div>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold border-2 border-white shadow-sm overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl.startsWith('/') ? `http://localhost:8080${avatarUrl}` : avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span>{profileName.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <ChevronDown className="h-4 w-4 text-gray-400"/>
            </div>

            {/* Dropdown Profile */}
            {showProfile && (
              <div className="absolute right-0 top-14 w-48 rounded-xl bg-white shadow-lg border border-gray-100 p-2 z-50 animate-in fade-in slide-in-from-top-2">
                <Link to="/admin/settings" className="block px-4 py-2 rounded-lg hover:bg-gray-50 text-sm text-gray-700 font-medium">Profile</Link>
                <Link to="/admin/settings" className="block px-4 py-2 rounded-lg hover:bg-gray-50 text-sm text-gray-700 font-medium">Settings</Link>
                <div className="h-px bg-gray-100 my-1"></div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 rounded-lg hover:bg-red-50 text-sm text-red-600 font-medium"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Content grid */}
        <main className="p-6 space-y-6">
          {/* Stat cards Section */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              icon={BookOpen}
              label="Total Buku"
              value={stats?.total_books ?? 0}
              colorClass="text-blue-600"
              bgClass="bg-blue-100"
            />
            <StatCard
              icon={Users}
              label="Buku Tersedia"
              value={stats?.total_available ?? 0}
              colorClass="text-green-600"
              bgClass="bg-green-100"
            />
            <StatCard
              icon={ClipboardList}
              label="Peminjaman Aktif"
              value={stats?.active_borrowings ?? 0}
              colorClass="text-orange-600"
              bgClass="bg-orange-100"
            />
            <StatCard
              icon={AlertTriangle}
              label="Terlambat (Overdue)"
              value={stats?.overdue_borrowings ?? 0}
              colorClass="text-red-600"
              bgClass="bg-red-100"
            />
          </section>

          {/* Charts Section */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Aktivitas Peminjaman Bulanan</h3>
              <div className="h-64 w-full">
                <ChartLine
                  data={monthlyChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins:{legend:{display:false}},
                    scales:{y:{beginAtZero:true, grid:{borderDash:[4,4]}}, x:{grid:{display:false}}}
                  }}
                />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Kategori Populer</h3>
              <div className="h-64 w-full">
                <ChartBar
                  data={categoryChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    plugins:{legend:{display:false}},
                    scales:{x:{beginAtZero:true}}
                  }}
                />
              </div>
            </div>
          </section>

          {/* Recent Borrowings Table */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-800">Peminjaman Terbaru</h3>
              <Link to="/admin/borrowings" className="text-sm font-medium text-blue-600 hover:text-blue-800">Lihat Semua</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3 font-medium">Judul Buku</th>
                    <th className="px-6 py-3 font-medium">Peminjam</th>
                    <th className="px-6 py-3 font-medium">Tgl Pinjam</th>
                    <th className="px-6 py-3 font-medium">Tenggat</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(stats?.recent_borrowings ?? []).slice(0, 5).map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 font-medium text-gray-900">{b.book_title}</td>
                      <td className="px-6 py-4 text-gray-600">{b.member_name}</td>
                      <td className="px-6 py-4 text-gray-600">{formatDateSafe(b.created_at)}</td>
                      <td className="px-6 py-4 text-gray-600">{formatDateSafe(b.due_date)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold
                          ${b.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {b.status || 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(stats?.recent_borrowings ?? []).length === 0 && (
                    <tr><td className="px-6 py-8 text-center text-gray-500" colSpan={5}>Belum ada data peminjaman terbaru.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>

    {/* Mobile drawer */}
    {mobileNavOpen && (
      <div className="fixed inset-0 z-40 md:hidden" role="dialog">
        <div className="absolute inset-0 bg-black/30" onClick={() => setMobileNavOpen(false)}></div>
        <div className="absolute left-0 top-0 h-full w-72 max-w-[80%] bg-[#0D47A1] text-white p-4 shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              {logoUrl ? (
                <img src={logoUrl.startsWith('/') ? `http://localhost:8080${logoUrl}` : logoUrl} alt="Logo" className="w-8 h-8 rounded object-cover" />
              ) : null}
              <span className="font-bold text-lg">{appName}</span>
            </div>
            <button onClick={() => setMobileNavOpen(false)} className="p-2 text-white/70 hover:text-white">✕</button>
          </div>
          <nav className="space-y-2">
            <Link to="/admin/dashboard" onClick={() => setMobileNavOpen(false)} className="block px-4 py-3 rounded-lg bg-white/10">Dashboard</Link>
            <Link to="/admin/books" onClick={() => setMobileNavOpen(false)} className="block px-4 py-3 rounded-lg hover:bg-white/10">Buku</Link>
            <Link to="/admin/categories" onClick={() => setMobileNavOpen(false)} className="block px-4 py-3 rounded-lg hover:bg-white/10">Kategori</Link>
            <Link to="/admin/borrowings" onClick={() => setMobileNavOpen(false)} className="block px-4 py-3 rounded-lg hover:bg-white/10">Peminjaman</Link>
            <Link to="/admin/members" onClick={() => setMobileNavOpen(false)} className="block px-4 py-3 rounded-lg hover:bg-white/10">Anggota</Link>
            <Link to="/admin/settings" onClick={() => setMobileNavOpen(false)} className="block px-4 py-3 rounded-lg hover:bg-white/10">Pengaturan</Link>
          </nav>
        </div>
      </div>
    )}
    </>
  );
};

export default AdminDashboard;
