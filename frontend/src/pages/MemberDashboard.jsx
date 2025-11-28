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
      setBorrowings(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch borrowings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      borrowed: 'bg-blue-100 text-blue-800',
      overdue: 'bg-red-100 text-red-800',
      returned: 'bg-green-100 text-green-800',
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
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
              <div className="space-y-4">
                {activeBorrowings.map((borrowing) => (
                  <div
                    key={borrowing.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
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
                              <span>Due: {new Date(borrowing.due_date).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(borrowing.status)}`}>
                        {borrowing.status}
                      </span>
                    </div>
                    {borrowing.status === 'overdue' && (
                      <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3">
                        <p className="text-sm text-red-800">
                          This book is overdue! Please return it as soon as possible to avoid fines.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No active borrowings</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Visit the{' '}
                  <Link to="/books" className="text-primary-600 hover:text-primary-500">
                    catalog
                  </Link>{' '}
                  to borrow books.
                </p>
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
