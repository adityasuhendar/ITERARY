import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const change = (e) => {
    i18n.changeLanguage(e.target.value);
  };

  return (
    <select value={i18n.language} onChange={change} className="rounded border px-2 py-1 text-sm">
      <option value="id">ID</option>
      <option value="en">EN</option>
    </select>
  );
}
