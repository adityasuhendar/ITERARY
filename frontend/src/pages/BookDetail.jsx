import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { BookOpen, Calendar, User, Package, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';

const BookDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isMember } = useAuth();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [borrowing, setBorrowing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [durationDays, setDurationDays] = useState(7); // Default 7 days

  useEffect(() => {
    fetchBook();
  }, [id]);

  const fetchBook = async () => {
    try {
      const response = await api.get(`/api/books/${id}`);
      setBook(response.data.data);
    } catch (error) {
      console.error('Failed to fetch book:', error);
      setMessage({ type: 'error', text: 'Book not found' });
    } finally {
      setLoading(false);
    }
  };

  const handleBorrow = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (!isMember) {
      setMessage({ type: 'error', text: 'Only members can borrow books' });
      return;
    }

    setBorrowing(true);
    setMessage({ type: '', text: '' });

    try {
      await api.post('/api/borrowings', {
        book_id: book.id,
        duration_days: durationDays,
      });

      setMessage({ type: 'success', text: 'Book borrowed successfully! Check your dashboard.' });

      // Refresh book data to update available copies
      setTimeout(() => {
        fetchBook();
      }, 1000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to borrow book',
      });
    } finally {
      setBorrowing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Book not found</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Kembali</span>
        </button>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="md:flex">
            {/* Book Cover */}
            <div className="md:w-1/3 bg-gray-200">
              {book.cover_image_url ? (
                <img
                  src={book.cover_image_url}
                  alt={book.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-96 bg-primary-100">
                  <BookOpen className="h-32 w-32 text-primary-300" />
                </div>
              )}
            </div>

            {/* Book Details */}
            <div className="md:w-2/3 p-8">
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{book.title}</h1>
                <p className="text-xl text-gray-600 mb-4">by {book.author}</p>

                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm">
                    {book.category}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-sm ${
                      book.available_copies > 0
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {book.available_copies > 0
                      ? `${book.available_copies} available`
                      : 'Not available'}
                  </span>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-center text-gray-700">
                  <Package className="h-5 w-5 mr-3 text-gray-400" />
                  <span>ISBN: {book.isbn}</span>
                </div>
                {/* <div className="flex items-center text-gray-700">
                  <User className="h-5 w-5 mr-3 text-gray-400" />
                  <span>Publisher: {book.publisher || 'N/A'}</span>
                </div> */}
                {/* <div className="flex items-center text-gray-700">
                  <Calendar className="h-5 w-5 mr-3 text-gray-400" />
                  <span>Published: {book.publication_year || 'N/A'}</span>
                </div> */}
                <div className="flex items-center text-gray-700">
                  <BookOpen className="h-5 w-5 mr-3 text-gray-400" />
                  <span>
                    Total Copies: {book.total_copies} ({book.available_copies} available)
                  </span>
                </div>
              </div>

              {book.description && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
                  <p className="text-gray-700 leading-relaxed">{book.description}</p>
                </div>
              )}

              {/* Messages */}
              {message.text && (
                <div
                  className={`rounded-md p-4 mb-4 ${
                    message.type === 'success' ? 'bg-green-50' : 'bg-red-50'
                  }`}
                >
                  <div className="flex">
                    {message.type === 'success' ? (
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-400" />
                    )}
                    <div className="ml-3">
                      <p
                        className={`text-sm ${
                          message.type === 'success' ? 'text-green-800' : 'text-red-800'
                        }`}
                      >
                        {message.text}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Borrow Section */}
              {isMember && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
                      Borrowing Duration
                    </label>
                    <select
                      id="duration"
                      value={durationDays}
                      onChange={(e) => setDurationDays(Number(e.target.value))}
                      className="block w-full md:w-64 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value={7}>7 days (1 week)</option>
                      <option value={14}>14 days (2 weeks)</option>
                      <option value={21}>21 days (3 weeks)</option>
                      <option value={30}>30 days (1 month)</option>
                    </select>
                  </div>
                  
                  <button
                    onClick={handleBorrow}
                    disabled={borrowing || book.available_copies === 0}
                    className="w-full md:w-auto px-6 py-3 bg-primary-600 text-white font-medium rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {borrowing
                      ? 'Processing...'
                      : book.available_copies > 0
                      ? 'Borrow This Book'
                      : 'Currently Unavailable'}
                  </button>
                </div>
              )}

              {!isAuthenticated && (
                <div className="bg-blue-50 rounded-md p-4">
                  <p className="text-sm text-blue-800">
                    Please{' '}
                    <button
                      onClick={() => navigate('/login')}
                      className="font-medium underline hover:text-blue-900"
                    >
                      sign in
                    </button>{' '}
                    to borrow this book.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookDetail;
