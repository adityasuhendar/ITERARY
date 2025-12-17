import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import BooksPage from './pages/BooksPage';
import BookDetail from './pages/BookDetail';
import AdminDashboard from './pages/AdminDashboard';
import MemberDashboard from './pages/MemberDashboard';
import ManageBooks from './pages/ManageBooks';
import AdminLayout from './components/AdminLayout';
import ManageCategories from './pages/ManageCategories';
import Borrowings from './pages/Borrowings';
import Members from './pages/Members';
import Settings from './pages/Settings';

function TestPage(){
  return (<div style={{padding:24}}><h1>Test Page</h1><p>Aplikasi berjalan. Routing OK.</p></div>);
}

function AppLayout() {
  const location = useLocation();
  const adminPaths = ['/admin/dashboard', '/admin/books', '/admin/categories', '/admin/borrowings', '/admin/members', '/admin/settings'];
  const isAdminPath = adminPaths.includes(location.pathname);
  const fullWidthPaths = ['/'];
  const isFullWidth = fullWidthPaths.includes(location.pathname);
  const containerClass = isAdminPath
    ? 'min-h-screen'
    : isFullWidth
      ? 'w-full min-h-screen'
      : 'container mx-auto px-4 py-6';
  const showNavbar = !isAdminPath;

  return (
    <div className="min-h-screen bg-gray-50">
      {showNavbar && <Navbar />}
      <div className={containerClass}>
      <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/books" element={<BooksPage />} />
            <Route path="/books/:id" element={<BookDetail />} />
            <Route path="/test" element={<TestPage />} />

            {/* Admin Routes */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/books"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminLayout hideTopbar>
                    <ManageBooks />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/categories"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminLayout hideTopbar>
                    <ManageCategories />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/borrowings"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminLayout hideTopbar>
                    <Borrowings />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/members"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminLayout hideTopbar>
                    <Members />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminLayout hideTopbar>
                    <Settings />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            {/* Member Routes */}
            <Route
              path="/member/dashboard"
              element={
                <ProtectedRoute requireMember>
                  <MemberDashboard />
                </ProtectedRoute>
              }
            />
      </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <Router>
          <ErrorBoundary>
            <AppLayout />
          </ErrorBoundary>
        </Router>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
