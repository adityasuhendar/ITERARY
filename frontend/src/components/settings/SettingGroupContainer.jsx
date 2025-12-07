function SettingGroupContainer({ title, children }) {
  return (
    <section className="rounded-2xl bg-white shadow-xl border border-slate-100">
      <div className="px-6 py-4 border-b border-slate-100">
        <h2 className="text-lg font-semibold text-[#0D47A1]">{title}</h2>
      </div>
      <div className="p-6">
        {children}
      </div>
    </section>
  );
}

export default SettingGroupContainer;
