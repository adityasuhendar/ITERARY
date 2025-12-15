import { useEffect, useState } from 'react';
import { Database, Server, Wifi, WifiOff, CheckCircle, XCircle, RefreshCw, Clock, Upload } from 'lucide-react';

function SystemSettings({ data, loading, onSave }) {
  const [appName, setAppName] = useState('');
  const [maxBooks, setMaxBooks] = useState(3);
  const [borrowDurationDays, setBorrowDurationDays] = useState(7);
  const [maintenance, setMaintenance] = useState(false);
  const [logo, setLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  
  // Health check state
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState(null);

  useEffect(() => {
    if (data) {
      setAppName(data.appName || 'ITERARY');
      setMaxBooks(data.maxBooks ?? 3);
      setBorrowDurationDays(data.borrowDurationDays ?? 7);
      setMaintenance(Boolean(data.maintenance));
      // Set existing logo preview
      if (data.logo_url) {
        const url = data.logo_url.startsWith('/') ? `http://localhost:8080${data.logo_url}` : data.logo_url;
        setLogoPreview(url);
      }
    }
  }, [data]);

  // Fetch health status
  const checkHealth = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8080/api/settings/health', {
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        }
      });
      const result = await response.json();
      if (result.success) {
        setHealth(result.health);
      } else {
        setHealthError('Failed to fetch health status');
      }
    } catch (err) {
      setHealthError(err.message || 'Connection error');
    } finally {
      setHealthLoading(false);
    }
  };

  // Check health on mount
  useEffect(() => {
    checkHealth();
  }, []);

  const handleSelect = (e) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      setLogo(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ appName, maxBooks, borrowDurationDays, maintenance, logo });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected':
      case 'running':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'error':
      case 'disconnected':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'connecting':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'disabled':
        return 'text-gray-500 bg-gray-50 border-gray-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'connected':
      case 'running':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
      case 'disconnected':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'connecting':
        return <RefreshCw className="h-5 w-5 text-yellow-500 animate-spin" />;
      case 'disabled':
        return <WifiOff className="h-5 w-5 text-gray-400" />;
      default:
        return <Wifi className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Connection Status Section */}
      <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Server className="h-5 w-5 text-blue-600" />
            Status Koneksi
          </h3>
          <button
            onClick={checkHealth}
            disabled={healthLoading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${healthLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {healthError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            Error: {healthError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Database Status */}
          <div className={`p-4 rounded-xl border ${health?.database ? getStatusColor(health.database.status) : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center gap-3 mb-2">
              <Database className="h-6 w-6 text-blue-600" />
              <span className="font-medium">MySQL Database</span>
            </div>
            {health?.database ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {getStatusIcon(health.database.status)}
                  <span className="text-sm font-medium capitalize">{health.database.status}</span>
                </div>
                {health.database.latency && (
                  <div className="flex items-center gap-1 text-xs text-slate-600">
                    <Clock className="h-3 w-3" />
                    Latency: {health.database.latency}
                  </div>
                )}
                {health.database.host && (
                  <div className="text-xs text-slate-500">Host: {health.database.host}</div>
                )}
                {health.database.database && (
                  <div className="text-xs text-slate-500">DB: {health.database.database}</div>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-500">Loading...</div>
            )}
          </div>

          {/* Redis Status */}
          <div className={`p-4 rounded-xl border ${health?.redis ? getStatusColor(health.redis.status) : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center gap-3 mb-2">
              <Wifi className="h-6 w-6 text-purple-600" />
              <span className="font-medium">Redis Cache</span>
            </div>
            {health?.redis ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {getStatusIcon(health.redis.status)}
                  <span className="text-sm font-medium capitalize">{health.redis.status}</span>
                </div>
                <div className="text-xs text-slate-600">{health.redis.message}</div>
                {health.redis.host && (
                  <div className="text-xs text-slate-500">Host: {health.redis.host}</div>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-500">Loading...</div>
            )}
          </div>

          {/* Server Status */}
          <div className={`p-4 rounded-xl border ${health?.server ? getStatusColor(health.server.status) : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center gap-3 mb-2">
              <Server className="h-6 w-6 text-green-600" />
              <span className="font-medium">Backend Server</span>
            </div>
            {health?.server ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {getStatusIcon(health.server.status)}
                  <span className="text-sm font-medium capitalize">{health.server.status}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-600">
                  <Clock className="h-3 w-3" />
                  Uptime: {Math.floor(health.server.uptime / 60)}m {Math.floor(health.server.uptime % 60)}s
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">Loading...</div>
            )}
          </div>
        </div>
      </div>

      {/* System Settings Form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nama Aplikasi</label>
          <input 
            value={appName} 
            onChange={(e) => setAppName(e.target.value)} 
            className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
          />
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Maksimal Buku</label>
            <input 
              type="number" 
              value={maxBooks} 
              onChange={(e) => setMaxBooks(Number(e.target.value))} 
              className="w-full border border-slate-200 rounded-xl px-3 py-2" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Durasi Peminjaman (hari)</label>
            <input 
              type="number" 
              value={borrowDurationDays} 
              onChange={(e) => setBorrowDurationDays(Number(e.target.value))} 
              className="w-full border border-slate-200 rounded-xl px-3 py-2" 
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input 
            id="maintenanceSwitch" 
            type="checkbox" 
            checked={maintenance} 
            onChange={(e) => setMaintenance(e.target.checked)} 
            className="peer appearance-none w-12 h-6 rounded-full bg-slate-200 transition-all checked:bg-blue-500 relative cursor-pointer" 
          />
          <label htmlFor="maintenanceSwitch" className="text-sm text-slate-700">Maintenance Mode</label>
        </div>
        <div className="flex flex-col gap-2 md:col-span-2 md:flex-row md:items-center">
          <label className="block text-sm font-medium text-slate-700 mb-1 md:mb-0 md:w-40">Logo Aplikasi</label>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-blue-50 border-2 border-blue-200 flex items-center justify-center overflow-hidden">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo preview" className="object-cover w-full h-full" />
              ) : (
                <span className="text-blue-400 text-2xl font-bold">{appName.substring(0, 2).toUpperCase()}</span>
              )}
            </div>
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white cursor-pointer shadow-md hover:shadow-lg">
              <Upload className="h-4 w-4" />
              Pilih Gambar
              <input type="file" accept="image/*" className="hidden" onChange={handleSelect} />
            </label>
            {logo && <span className="text-sm text-slate-600">{logo.name}</span>}
          </div>
        </div>
        <div className="md:col-span-2 flex justify-end mt-4">
          <button 
            type="submit" 
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white font-medium shadow-md hover:shadow-lg"
          >
            Simpan Pengaturan
          </button>
        </div>
      </form>
    </div>
  );
}

export default SystemSettings;
