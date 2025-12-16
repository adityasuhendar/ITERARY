import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, LogOut, User, Home, Library, Menu, X } from 'lucide-react';
import LanguageSwitcher from './LanguageSwitcher';
import { useTranslation } from 'react-i18next';

const Navbar = () => {
  const { user, logout, isAuthenticated, isAdmin, isMember } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
    setIsOpen(false);
  };
  const { t } = useTranslation();

return (
    <nav className="bg-white shadow-lg sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <BookOpen className="h-8 w-8 text-primary-600" />
              <span className="text-2xl font-bold text-gray-900">ITERARY</span>
            </Link>
            
            {/* Desktop Menu */}
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

          <div className="hidden md:flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <Link
                  to={isAdmin ? '/admin/dashboard' : '/member/dashboard'}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-all"
                >
                  <User className="h-4 w-4 mr-2" />
                  {isAdmin ? (t ? t('manage_books') : 'Dashboard Admin') : (t ? t('manage_books') : 'Dashboard')}
                </Link>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center px-4 py-2 border border-gray-200 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {t ? t('sign_out') : 'Keluar'}
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-primary-600 bg-primary-50 hover:bg-primary-100 transition-colors"
                >
                  {t ? t('masuk') : 'Masuk'}
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-all"
                >
                  {t ? t('create_account') : 'Daftar'}
                </Link>
              </>
            )}
            <div className="ml-2">
              <LanguageSwitcher />
            </div>
          </div>

          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
            >
              <span className="sr-only">Open main menu</span>
              {isOpen ? (
                <X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden bg-white border-t border-gray-100">
          <div className="pt-2 pb-3 space-y-1 px-4">
            <Link
              to="/"
              onClick={() => setIsOpen(false)}
              className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-600 hover:bg-gray-50 hover:border-primary-300 hover:text-gray-800"
            >
              <div className="flex items-center">
                <Home className="h-5 w-5 mr-2" />
                Beranda
              </div>
            </Link>
            <Link
              to="/books"
              onClick={() => setIsOpen(false)}
              className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-600 hover:bg-gray-50 hover:border-primary-300 hover:text-gray-800"
            >
              <div className="flex items-center">
                <Library className="h-5 w-5 mr-2" />
                Katalog Buku
              </div>
            </Link>
          </div>
          
          <div className="pt-4 pb-4 border-t border-gray-200 px-4">
            {isAuthenticated ? (
              <div className="space-y-3">
                <Link
                  to={isAdmin ? '/admin/dashboard' : '/member/dashboard'}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center w-full px-4 py-2 border border-transparent text-base font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 shadow-sm"
                >
                  <User className="h-5 w-5 mr-2" />
                  {isAdmin ? 'Dashboard Admin' : 'Dashboard'}
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center w-full px-4 py-2 border border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
                >
                  <LogOut className="h-5 w-5 mr-2" />
                  Keluar
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center px-4 py-2 border border-transparent text-base font-medium rounded-lg text-primary-700 bg-primary-50 hover:bg-primary-100"
                >
                  Masuk
                </Link>
                <Link
                  to="/register"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center px-4 py-2 border border-transparent text-base font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 shadow-sm"
                >
                  Daftar
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;