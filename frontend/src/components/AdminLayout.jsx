import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, BookOpen, Layers, ClipboardList, Users, Settings, LogOut, Bell, Search, ChevronDown } from 'lucide-react';

function AdminLayout({ children, hideTopbar = false }) {
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-[#E3F2FD] text-slate-800 flex">
      {/* Sidebar */}
      <aside className="w-72 text-white flex flex-col" style={{background:'#0D47A1'}}>
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
          <Link className={`flex items-center gap-3 px-3 py-3 rounded-lg transition ${isActive('/admin/dashboard') ? 'bg-white/20' : 'hover:bg-white/10'}`} to="/admin/dashboard"><BarChart3 className="h-5 w-5"/> Dashboard</Link>
          <Link className={`flex items-center gap-3 px-3 py-3 rounded-lg transition ${isActive('/admin/books') ? 'bg-white/20' : 'hover:bg-white/10'}`} to="/admin/books"><BookOpen className="h-5 w-5"/> Manage Books</Link>
          <Link className={`flex items-center gap-3 px-3 py-3 rounded-lg transition ${isActive('/admin/categories') ? 'bg-white/20' : 'hover:bg-white/10'}`} to="/admin/categories"><Layers className="h-5 w-5"/> Manage Categories</Link>
          <Link className={`flex items-center gap-3 px-3 py-3 rounded-lg transition ${isActive('/admin/borrowings') ? 'bg-white/20' : 'hover:bg-white/10'}`} to="/admin/borrowings"><ClipboardList className="h-5 w-5"/> Borrowings</Link>
          <Link className={`flex items-center gap-3 px-3 py-3 rounded-lg transition ${isActive('/admin/members') ? 'bg-white/20' : 'hover:bg-white/10'}`} to="/admin/members"><Users className="h-5 w-5"/> Members</Link>
          <Link className={`flex items-center gap-3 px-3 py-3 rounded-lg transition ${isActive('/admin/settings') ? 'bg-white/20' : 'hover:bg-white/10'}`} to="/admin/settings"><Settings className="h-5 w-5"/> Settings</Link>
        </nav>
        <div className="px-3 py-4 border-t border-white/10">
          <a className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/10" href="/logout"><LogOut className="h-5 w-5"/> Logout</a>
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
                <div className="text-sm font-semibold text-slate-900">Admin Name</div>
                <div className="text-xs text-slate-500">Administrator</div>
              </div>
              <img src="https://i.pravatar.cc/40" className="w-10 h-10 rounded-full shadow" alt="Admin"/>
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
                <a className="block px-3 py-2 rounded-xl hover:bg-slate-50 text-sm" href="/admin/settings">Settings</a>
                <a className="block px-3 py-2 rounded-xl hover:bg-slate-50 text-sm text-red-600" href="/logout">Logout</a>
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