import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, BookOpen, Layers, ClipboardList, Users, Settings, LogOut, Bell, Search, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGlobalSettings } from '../context/SettingsContext';

function AdminLayout({ children, hideTopbar = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { settings } = useGlobalSettings();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Get data from settings context
  const appName = settings?.system?.appName || 'ITERARY';
  const logoUrl = settings?.system?.logo_url;
  const profileName = settings?.profile?.fullName || user?.name || 'Admin';
  const avatarUrl = settings?.profile?.avatar_url;

  return (
    <div className="min-h-screen bg-[#E3F2FD] text-slate-800 flex">
      {/* Sidebar */}
      <aside 
        className={`${sidebarOpen ? 'w-72' : 'w-20'} text-white flex flex-col transition-all duration-300`} 
        style={{background:'#0D47A1'}}
      >
        {/* Header with Logo */}
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                {logoUrl ? (
                  <img src={logoUrl.startsWith('/') ? `http://localhost:8080${logoUrl}` : logoUrl} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold">{appName.substring(0, 2).toUpperCase()}</span>
                )}
              </div>
              {sidebarOpen && (
                <div className="transition-opacity duration-300">
                  <div className="text-lg font-semibold">{appName}</div>
                  <div className="text-xs text-white/70">Admin Console</div>
                </div>
              )}
            </div>
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
              title={sidebarOpen ? "Tutup sidebar" : "Buka sidebar"}
            >
              {sidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <Link 
            className={`flex items-center gap-3 px-3 py-3 rounded-lg transition ${isActive('/admin/dashboard') ? 'bg-white/20' : 'hover:bg-white/10'}`} 
            to="/admin/dashboard"
            title={!sidebarOpen ? "Dashboard" : ""}
          >
            <BarChart3 className="h-5 w-5 flex-shrink-0"/> 
            {sidebarOpen && <span>Dashboard</span>}
          </Link>
          <Link 
            className={`flex items-center gap-3 px-3 py-3 rounded-lg transition ${isActive('/admin/books') ? 'bg-white/20' : 'hover:bg-white/10'}`} 
            to="/admin/books"
            title={!sidebarOpen ? "Manage Books" : ""}
          >
            <BookOpen className="h-5 w-5 flex-shrink-0"/> 
            {sidebarOpen && <span>Manage Books</span>}
          </Link>
          <Link 
            className={`flex items-center gap-3 px-3 py-3 rounded-lg transition ${isActive('/admin/categories') ? 'bg-white/20' : 'hover:bg-white/10'}`} 
            to="/admin/categories"
            title={!sidebarOpen ? "Manage Categories" : ""}
          >
            <Layers className="h-5 w-5 flex-shrink-0"/> 
            {sidebarOpen && <span>Manage Categories</span>}
          </Link>
          <Link 
            className={`flex items-center gap-3 px-3 py-3 rounded-lg transition ${isActive('/admin/borrowings') ? 'bg-white/20' : 'hover:bg-white/10'}`} 
            to="/admin/borrowings"
            title={!sidebarOpen ? "Borrowings" : ""}
          >
            <ClipboardList className="h-5 w-5 flex-shrink-0"/> 
            {sidebarOpen && <span>Borrowings</span>}
          </Link>
          <Link 
            className={`flex items-center gap-3 px-3 py-3 rounded-lg transition ${isActive('/admin/members') ? 'bg-white/20' : 'hover:bg-white/10'}`} 
            to="/admin/members"
            title={!sidebarOpen ? "Members" : ""}
          >
            <Users className="h-5 w-5 flex-shrink-0"/> 
            {sidebarOpen && <span>Members</span>}
          </Link>
          <Link 
            className={`flex items-center gap-3 px-3 py-3 rounded-lg transition ${isActive('/admin/settings') ? 'bg-white/20' : 'hover:bg-white/10'}`} 
            to="/admin/settings"
            title={!sidebarOpen ? "Settings" : ""}
          >
            <Settings className="h-5 w-5 flex-shrink-0"/> 
            {sidebarOpen && <span>Settings</span>}
          </Link>
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-white/10">
          <button 
            onClick={handleLogout} 
            className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/10 w-full text-left"
            title={!sidebarOpen ? "Logout" : ""}
          >
            <LogOut className="h-5 w-5 flex-shrink-0"/> 
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col">
        {/* Top Navbar (optional) */}
        {!hideTopbar && (
        <header className="mx-6 mt-6 rounded-2xl bg-white shadow-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 w-[40%]">
            <div className="rounded-xl p-2 bg-blue-50"><Search className="h-5 w-5 text-blue-600"/></div>
            <input className="w-full bg-white/60 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1E88E5]" placeholder="Search books, members, reports..." />
          </div>
          <div className="flex items-center gap-4 relative">
            <button onClick={() => setShowNotifications((s)=>!s)} className="relative rounded-xl p-2 bg-blue-50 hover:shadow-md transition">
              <Bell className="h-6 w-6 text-[#0D47A1]" />
              <span className="absolute -top-1 -right-1 text-xs bg-red-500 text-white rounded-full px-1">3</span>
            </button>
            <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => setShowProfile((p)=>!p)}>
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-900">{profileName}</div>
                <div className="text-xs text-slate-500">Administrator</div>
              </div>
              <div className="w-10 h-10 rounded-full shadow overflow-hidden bg-blue-100 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl.startsWith('/') ? `http://localhost:8080${avatarUrl}` : avatarUrl} className="w-full h-full object-cover" alt="Admin"/>
                ) : (
                  <span className="text-blue-600 font-semibold">{profileName.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <ChevronDown className="h-4 w-4 text-slate-500"/>
            </div>
            {showNotifications && (
              <div className="absolute right-20 top-12 w-80 rounded-2xl bg-white shadow-xl border border-slate-100 p-3 z-20">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold">Notifications</div>
                  <button className="text-xs text-blue-600">Mark all read</button>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-3 p-2 rounded-xl hover:bg-slate-50"><span className="w-2 h-2 rounded-full bg-red-500 mt-1"></span> 18 overdue borrowings require attention</li>
                  <li className="flex items-start gap-3 p-2 rounded-xl hover:bg-slate-50"><span className="w-2 h-2 rounded-full bg-yellow-500 mt-1"></span> 5 items due in next 48 hours</li>
                  <li className="flex items-start gap-3 p-2 rounded-xl hover:bg-slate-50"><span className="w-2 h-2 rounded-full bg-blue-500 mt-1"></span> New member registrations today: 0</li>
                </ul>
              </div>
            )}
            {showProfile && (
              <div className="absolute right-0 top-12 w-52 rounded-2xl bg-white shadow-xl border border-slate-100 p-2 z-20">
                <Link to="/admin/settings" className="block px-3 py-2 rounded-xl hover:bg-slate-50 text-sm">Settings</Link>
                <button onClick={handleLogout} className="block w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 text-sm text-red-600">Logout</button>
              </div>
            )}
          </div>
        </header>
        )}

        {/* Page content */}
        <main className="p-0">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
