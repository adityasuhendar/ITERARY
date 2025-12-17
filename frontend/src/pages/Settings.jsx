import { useState } from 'react';
import SystemSettings from '../components/settings/SystemSettings';
import ProfileSettings from '../components/settings/ProfileSettings';
import SecuritySettings from '../components/settings/SecuritySettings';
import useSettings from '../hooks/useSettings';
import { useGlobalSettings } from '../context/SettingsContext';
import { Settings as SettingsIcon, User, Lock } from 'lucide-react';

function Settings() {
  const { settings, loading, actions } = useSettings();
  const { refreshSettings } = useGlobalSettings();
  const [banner, setBanner] = useState(null);
  const [tab, setTab] = useState('system');

  const handleSystemSave = async (payload) => {
    try {
      const ok = await actions.updateSystem(payload);
      if (ok) {
        setBanner('Pengaturan sistem berhasil disimpan');
        refreshSettings(); // Refresh global settings
        setTimeout(() => setBanner(null), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleProfileSave = async (payload) => {
    try {
      const ok = await actions.updateProfile(payload);
      if (ok) {
        setBanner('Profil berhasil disimpan');
        refreshSettings(); // Refresh global settings
        setTimeout(() => setBanner(null), 3000);
      }
      return ok;
    } catch (err) {
      throw err;
    }
  };

  const tabs = [
    { key: 'system', label: 'System', icon: SettingsIcon },
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'security', label: 'Security', icon: Lock },
  ];

  return (
    <div className="px-0 md:px-0 pt-6 pb-8 flex flex-col items-center min-h-[80vh]">
      <div className="w-full max-w-6xl">
        <div className="text-sm text-gray-500 mb-1 px-4 lg:px-8">Dashboard / Settings</div>
        <h1 className="text-xl lg:text-2xl font-bold text-[#0D47A1] mb-4 px-4 lg:px-8">Settings</h1>
        {banner && (
          <div className="rounded-xl bg-green-50 border border-green-200 text-green-700 px-4 py-3 mb-4 text-center mx-4 lg:mx-8">{banner}</div>
        )}
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-xl border border-slate-100 p-4 lg:p-8">
          {/* Tab Navigation */}
          <div className="flex gap-1 lg:gap-2 border-b border-slate-100 mb-6 lg:mb-8 overflow-x-auto">
            {tabs.map((t) => {
              const IconComponent = t.icon;
              return (
                <button
                  key={t.key}
                  className={`py-2 lg:py-3 px-3 lg:px-6 text-left font-medium text-sm lg:text-base transition-colors flex items-center gap-2 rounded-t-xl whitespace-nowrap
                    ${tab === t.key ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50' : 'text-slate-500 hover:text-blue-700'}`}
                  onClick={() => setTab(t.key)}
                  type="button"
                  style={{minWidth:100}}
                >
                  <IconComponent className="h-5 w-5" />
                  {t.label}
                </button>
              );
            })}
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
