import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Users, TrendingUp, Shield, ArrowRight, Github, Twitter, Instagram, Download } from 'lucide-react'; 

const Home = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);

  useEffect(() => {
    // Hide if already installed/standalone
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallButton(false);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    const installed = () => {
      setShowInstallButton(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installed);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallButton(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white flex flex-col">
      {/* Hero Section */}
      <div className="flex-grow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
           <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 tracking-tight">
            Yuk Buka{' '}
            <span className="text-primary-600">ITERARY</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-8 font-light">
            Perpustakaan Digital Masa Depan ITERA
          </p>
          <p className="text-lg text-gray-500 mb-12 max-w-2xl mx-auto leading-relaxed">
            ITERA Library And Reading facilitY — Sistem manajemen perpustakaan modern yang memudahkan Anda mencari, meminjam, dan membaca buku di mana saja.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              to="/books"
              className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-xl text-white bg-primary-600 hover:bg-primary-700 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
            >
              <BookOpen className="h-5 w-5 mr-2" />
              Jelajahi Katalog
            </Link>
            {showInstallButton && (
              <button
                onClick={handleInstallClick}
                className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-xl text-white bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
              >
                <Download className="h-5 w-5 mr-2" />
                Install App
              </button>
            )}
            <Link
              to="/register"
              className="inline-flex items-center justify-center px-8 py-4 border border-gray-200 text-base font-medium rounded-xl text-primary-700 bg-white hover:bg-gray-50 shadow-sm transition-all"
            >
              Daftar Sekarang
              <ArrowRight className="h-5 w-5 ml-2" />
            </Link>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-100 mb-6 text-primary-600">
              <BookOpen className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Katalog Digital
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Akses ribuan koleksi buku fisik dan digital dengan pencarian pintar yang memudahkan Anda menemukan referensi.
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-100 mb-6 text-green-600">
              <Users className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Peminjaman Mudah
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Proses peminjaman buku yang simpel, cepat, dan transparan dengan notifikasi pengingat otomatis.
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-100 mb-6 text-purple-600">
              <Shield className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Teknologi Cloud
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Didukung oleh Google Cloud Platform untuk menjamin keamanan data, kecepatan akses, dan ketersediaan 24/7.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-primary-700 text-white py-20 relative overflow-hidden">
        {/* Background Pattern (Optional) */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-primary-500/50">
            <div className="py-4">
              <div className="text-5xl font-extrabold mb-2 tracking-tight">1000+</div>
              <div className="text-primary-100 text-lg font-medium">Buku Tersedia</div>
            </div>
            <div className="py-4">
              <div className="text-5xl font-extrabold mb-2 tracking-tight">500+</div>
              <div className="text-primary-100 text-lg font-medium">Anggota Aktif</div>
            </div>
            <div className="py-4">
              <div className="text-5xl font-extrabold mb-2 tracking-tight">24/7</div>
              <div className="text-primary-100 text-lg font-medium">Akses Online</div>
            </div>
          </div>
        </div>
      </div>
      </div>

      <footer className="bg-gray-900 text-gray-300 py-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-2 mb-4 text-white">
                <BookOpen className="h-8 w-8 text-primary-500" />
                <span className="text-2xl font-bold">ITERARY</span>
              </div>
              <p className="text-gray-400 max-w-md">
                Platform perpustakaan digital Institut Teknologi Sumatera yang memudahkan akses literasi bagi seluruh civitas akademika.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 uppercase tracking-wider text-sm">Tautan</h4>
              <ul className="space-y-2">
                <li><Link to="/" className="hover:text-primary-400 transition-colors">Beranda</Link></li>
                <li><Link to="/books" className="hover:text-primary-400 transition-colors">Katalog Buku</Link></li>
                <li><Link to="/login" className="hover:text-primary-400 transition-colors">Masuk Anggota</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 uppercase tracking-wider text-sm">Kontak</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Jl. Terusan Ryacudu, Lampung</li>
                <li>perpustakaan@itera.ac.id</li>
                <li>(0721) 8030188</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-500">&copy; {new Date().getFullYear()} ITERARY - Institut Teknologi Sumatera. All rights reserved.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="https://github.com/adityasuhendar/ITERARY" className="text-gray-400 hover:text-white transition-colors"><Github className="h-5 w-5"/></a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors"><Twitter className="h-5 w-5"/></a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors"><Instagram className="h-5 w-5"/></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;