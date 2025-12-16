UPDATE admins SET password_hash = '$2b$10$zKkNyTX8HIXvZbJjgVOvz.7gmptKmVYg.ZGuQ8tKC2dMR6tLJvKM6' WHERE username = 'admin';
SELECT id, username, email, CHAR_LENGTH(password_hash) as len, password_hash FROM admins WHERE username='admin';
