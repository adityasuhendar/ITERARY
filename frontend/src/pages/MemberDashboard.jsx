import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { BookOpen, Calendar, AlertCircle, CheckCircle, Clock } from 'lucide-react';

const MemberDashboard = () => {
  const [borrowings, setBorrowings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyBorrowings();
  }, []);

  const fetchMyBorrowings = async () => {
    try {
      const response = await api.get('/api/borrowings/me');
      setBorrowings(response.data.data.borrowings || []);
    } catch (error) {
      console.error('Failed to fetch borrowings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      borrowed: 'bg-blue-100 text-blue-800 border-blue-200',
      overdue: 'bg-red-100 text-red-800 border-red-200',
      returned: 'bg-green-100 text-green-800 border-green-200',
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'borrowed':
        return <Clock className="h-5 w-5 text-blue-600" />;
      case 'overdue':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'returned':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      default:
        return <BookOpen className="h-5 w-5 text-gray-600" />;
    }
  };

  const activeBorrowings = borrowings.filter(
    (b) => b.status === 'borrowed' || b.status === 'overdue'
  );
  const pastBorrowings = borrowings.filter((b) => b.status === 'returned');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Dashboard</h1>
          <p className="text-gray-600">Manage your borrowed books</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BookOpen className="h-8 w-8 text-primary-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Borrowings</p>
                <p className="text-2xl font-bold text-gray-900">{activeBorrowings.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Overdue Books</p>
                <p className="text-2xl font-bold text-gray-900">
                  {borrowings.filter((b) => b.status === 'overdue').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Borrowed</p>
                <p className="text-2xl font-bold text-gray-900">{borrowings.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Active Borrowings */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Active Borrowings</h2>
          </div>
          <div className="p-6">
            {activeBorrowings.length > 0 ? (
              <div className="grid gap-6">
                {activeBorrowings.map((b) => (
                  <div key={b.id} className="flex flex-col md:flex-row gap-6 border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow bg-white">
                    {/* Bagian Thumbnail Buku */}
                    <div className="w-full md:w-32 h-48 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                      {b.cover_url ? (
                        <img src={b.cover_url} alt={b.book_title || b.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                          <BookOpen className="h-10 w-10" />
                        </div>
                      )}
                    </div>

                    {/* Bagian Informasi Peminjaman */}
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 mb-1">
                              <Link to={`/books/${b.book_id}`} className="hover:text-blue-600 hover:underline">
                                {b.book_title || b.title}
                              </Link>
                            </h3>
                            <p className="text-sm text-gray-600 mb-3">{b.author}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(b.status)} uppercase tracking-wider`}>
                            {b.status}
                          </span>
                        </div>
                        {/* Informasi Tanggal */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-blue-500" />
                            <span>Pinjam: <span className="font-medium text-gray-900">{formatDate(b.borrow_date)}</span></span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-orange-500" />
                            <span>Tenggat: <span className="font-medium text-gray-900">{formatDate(b.due_date)}</span></span>
                          </div>
                        </div>
                      </div>

                      {/* Alert Overdue */}
                      {b.status === 'overdue' && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3">
                          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-red-800">Buku ini terlambat dikembalikan!</p>
                            <p className="text-xs text-red-600 mt-1">Harap segera kembalikan ke perpustakaan untuk menghindari denda lebih lanjut.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Tampilan kosong (Empty State)
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                <h3 className="text-lg font-medium text-gray-900">Tidak ada peminjaman aktif</h3>
                <p className="text-gray-500 mb-4">Anda sedang tidak meminjam buku apapun.</p>
                <Link to="/books" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 shadow-sm">
                  Cari Buku
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Borrowing History */}
        {pastBorrowings.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Borrowing History</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {pastBorrowings.map((borrowing) => (
                  <div
                    key={borrowing.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4">
                        <div>{getStatusIcon(borrowing.status)}</div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            {borrowing.book_title}
                          </h3>
                          <div className="space-y-1 text-sm text-gray-600">
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-2" />
                              <span>
                                Borrowed: {new Date(borrowing.borrow_date).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-2" />
                              <span>
                                Returned: {borrowing.return_date ? new Date(borrowing.return_date).toLocaleDateString() : 'N/A'}
                              </span>
                            </div>
                            {borrowing.fine_amount > 0 && (
                              <div className="flex items-center text-red-600">
                                <AlertCircle className="h-4 w-4 mr-2" />
                                <span>Fine: Rp {borrowing.fine_amount.toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(borrowing.status)}`}>
                        {borrowing.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberDashboard;
