import { useState } from 'react';
import SettingGroupContainer from '../components/settings/SettingGroupContainer';
import SystemSettings from '../components/settings/SystemSettings';
import ProfileSettings from '../components/settings/ProfileSettings';
import SecuritySettings from '../components/settings/SecuritySettings';
import useSettings from '../hooks/useSettings';

function Settings() {
  const { settings, loading, actions } = useSettings();
  const [banner, setBanner] = useState(null);

  const handleSystemSave = async (payload) => {
    const ok = await actions.updateSystem(payload);
    if (ok) {
      setBanner('Pengaturan sistem berhasil disimpan');
      setTimeout(()=>setBanner(null), 2000);
    }
  };

  const handleProfileSave = async (payload) => {
    const ok = await actions.updateProfile(payload);
    if (ok) {
      setBanner('Profil berhasil disimpan');
      setTimeout(()=>setBanner(null), 2000);
    }
  };

  return (
    <div className="space-y-6 px-6 pt-6 pb-6">
      <div>
        <div className="text-sm text-gray-500">Dashboard / Settings</div>
        <h1 className="text-2xl font-bold text-[#0D47A1]">Settings</h1>
      </div>
      {banner && (
        <div className="rounded-xl bg-green-50 border border-green-200 text-green-700 px-4 py-3">{banner}</div>
      )}

      <SettingGroupContainer title="System Settings">
        <SystemSettings data={settings.system} loading={loading} onSave={handleSystemSave} />
      </SettingGroupContainer>

      <SettingGroupContainer title="Profile Settings">
        <ProfileSettings data={settings.profile} loading={loading} onSave={handleProfileSave} />
      </SettingGroupContainer>

      {/* Appearance Settings removed as requested */}

      <SettingGroupContainer title="Security Settings">
        <SecuritySettings loading={loading} onChangePassword={actions.updatePassword} />
      </SettingGroupContainer>
    </div>
  );
}

export default Settings;
