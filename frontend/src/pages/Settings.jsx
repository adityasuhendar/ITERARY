
import { useState } from 'react';
import SystemSettings from '../components/settings/SystemSettings';
import ProfileSettings from '../components/settings/ProfileSettings';
import SecuritySettings from '../components/settings/SecuritySettings';
import useSettings from '../hooks/useSettings';


function Settings() {
  const { settings, loading, actions } = useSettings();
  const [banner, setBanner] = useState(null);
  const [tab, setTab] = useState('system');

  const handleSystemSave = async (payload) => {
    const ok = await actions.updateSystem(payload);
    if (ok) {
      setBanner('Pengaturan sistem berhasil disimpan');
      setTimeout(() => setBanner(null), 2000);
    }
  };

  const handleProfileSave = async (payload) => {
    const ok = await actions.updateProfile(payload);
    if (ok) {
      setBanner('Profil berhasil disimpan');
      setTimeout(() => setBanner(null), 2000);
    }
  };

  // Tab config
  const tabs = [
    { key: 'system', label: 'System', icon: 'settings' },
    { key: 'profile', label: 'Profile', icon: 'person' },
    { key: 'security', label: 'Security', icon: 'lock' },
  ];

  return (
    <div className="px-0 md:px-0 pt-6 pb-8 flex flex-col items-center min-h-[80vh]">
      <div className="w-full max-w-6xl">
        <div className="text-sm text-gray-500 mb-1 px-8">Dashboard / Settings</div>
        <h1 className="text-2xl font-bold text-[#0D47A1] mb-4 px-8">Settings</h1>
        {banner && (
          <div className="rounded-xl bg-green-50 border border-green-200 text-green-700 px-4 py-3 mb-4 text-center mx-8">{banner}</div>
        )}
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-xl border border-slate-100 p-8">
          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-slate-100 mb-8">
            {tabs.map((t) => (
              <button
                key={t.key}
                className={`py-3 px-6 text-left font-medium text-base transition-colors flex items-center gap-2 rounded-t-xl
                  ${tab === t.key ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50' : 'text-slate-500 hover:text-blue-700'}`}
                onClick={() => setTab(t.key)}
                type="button"
                style={{minWidth:120}}
              >
                <span className="material-icons text-base">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
          {/* Tab Content */}
          <div className="pt-2">
            {tab === 'system' && (
              <SystemSettings data={settings.system} loading={loading} onSave={handleSystemSave} />
            )}
            {tab === 'profile' && (
              <ProfileSettings data={settings.profile} loading={loading} onSave={handleProfileSave} />
            )}
            {tab === 'security' && (
              <SecuritySettings loading={loading} onChangePassword={actions.updatePassword} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
