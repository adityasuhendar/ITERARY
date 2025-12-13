import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, LogOut, User, Home, Library } from 'lucide-react';

const Navbar = () => {
  const { user, logout, isAuthenticated, isAdmin, isMember } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav className="bg-white shadow-lg sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <BookOpen className="h-8 w-8 text-primary-600" />
              <span className="text-2xl font-bold text-gray-900">ITERARY</span>
            </Link>
            <div className="hidden md:ml-10 md:flex md:space-x-8">
              <Link
                to="/"
                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 hover:text-primary-600 transition-colors"
              >
                <Home className="h-4 w-4 mr-1" />
                Beranda
              </Link>
              <Link
                to="/books"
                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-primary-600 transition-colors"
              >
                <Library className="h-4 w-4 mr-1" />
                Katalog Buku
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <Link
                  to={isAdmin ? '/admin/dashboard' : '/member/dashboard'}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-all"
                >
                  <User className="h-4 w-4 mr-2" />
                  {isAdmin ? 'Dashboard Admin' : 'Dashboard'}
                </Link>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center px-4 py-2 border border-gray-200 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Keluar
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-primary-600 bg-primary-50 hover:bg-primary-100 transition-colors"
                >
                  Masuk
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-all"
                >
                  Daftar
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;