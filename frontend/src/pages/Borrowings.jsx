import BorrowingActions from '../components/borrowings/BorrowingActions';
import BorrowingTable from '../components/borrowings/BorrowingTable';
import BorrowingForm from '../components/borrowings/BorrowingForm';
import useBorrowings from '../hooks/useBorrowings';

function Borrowings() {
  const { borrowings, loading, submitError, modals, onCreate, onUpdate, onReturn, onDelete } = useBorrowings();

  return (
    <div className="space-y-6 px-6 pt-6 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500">Dashboard / Borrowings</div>
          <h1 className="text-2xl font-bold text-[#0D47A1]">Borrowings Management</h1>
        </div>
        <BorrowingActions onAdd={modals.openAddModal} />
      </div>

      <div className="rounded-2xl bg-white shadow-xl border border-slate-100">
        <BorrowingTable 
          borrowings={borrowings}
          loading={loading}
          onEdit={modals.openEditModal}
          onReturn={(b)=>onReturn(b.id)}
          onDelete={(b)=>modals.setConfirmDelete(b)}
        />
      </div>

      <BorrowingForm 
        open={modals.modalOpen}
        onClose={modals.closeModal}
        onSubmit={({ id, payload }) => id ? onUpdate(id, payload) : onCreate(payload)}
        editingBorrowing={modals.editingBorrowing}
        errorMessage={submitError}
      />

      {Boolean(modals.confirmDelete) && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Borrowing</h3>
            <p className="text-slate-600 mb-4">Are you sure you want to delete borrowing for <span className="font-medium">{modals.confirmDelete?.borrowerName}</span>?</p>
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

export default Borrowings;
