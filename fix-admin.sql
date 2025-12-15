UPDATE admins SET password_hash = '$2b$10$kpO/DzmGZ1fVa5lIQ1FR5.q5QONUkgHnbGxUk6QJE0Wd2kdIV754m' WHERE username = 'admin';
SELECT username, password_hash FROM admins;
