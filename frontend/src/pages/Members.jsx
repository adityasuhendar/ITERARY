import MemberActions from '../components/members/MemberActions';
import MemberTable from '../components/members/MemberTable';
import MemberForm from '../components/members/MemberForm';
import useMembers from '../hooks/useMembers';

function Members() {
  const { members, loading, search, modals, onCreate, onUpdate, onDelete } = useMembers();

  return (
    <div className="space-y-6 px-6 pt-6 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500">Dashboard / Members</div>
          <h1 className="text-2xl font-bold text-[#0D47A1]">Members Management</h1>
        </div>
        <MemberActions onAdd={modals.openAddModal} />
      </div>

      <div className="rounded-2xl bg-white shadow-xl border border-slate-100 p-4">
        <div className="flex items-center justify-between mb-4">
          <input
            value={search.query}
            onChange={(e)=>search.setQuery(e.target.value)}
            placeholder="Search members by name or email..."
            className="w-80 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1E88E5]"
          />
        </div>
        <MemberTable 
          members={members}
          loading={loading}
          onEdit={modals.openEditModal}
          onDelete={(m)=>modals.setConfirmDelete(m)}
        />
      </div>

      <MemberForm 
        open={modals.modalOpen}
        onClose={modals.closeModal}
        onSubmit={({ id, payload }) => id ? onUpdate(id, payload) : onCreate(payload)}
        editingMember={modals.editingMember}
      />

      {Boolean(modals.confirmDelete) && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Member</h3>
            <p className="text-slate-600 mb-4">Are you sure you want to delete <span className="font-medium">{modals.confirmDelete?.name}</span>?</p>
            <div className="flex justify-end gap-3">
              <button onClick={()=>modals.setConfirmDelete(null)} className="px-4 py-2 rounded-lg border border-slate-200">Cancel</button>
              <button onClick={()=>{ onDelete(modals.confirmDelete.id); modals.setConfirmDelete(null); }} className="px-4 py-2 rounded-lg bg-[#1E88E5] text-white">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Members;
