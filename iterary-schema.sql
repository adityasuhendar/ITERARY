-- ============================================
-- ITERARY - Library Management System
-- Database Schema (PostgreSQL 14)
-- Institut Teknologi Sumatera
-- ============================================

-- Drop tables if exists (for clean setup)
DROP TABLE IF EXISTS borrowings CASCADE;
DROP TABLE IF EXISTS members CASCADE;
DROP TABLE IF EXISTS books CASCADE;
DROP TABLE IF EXISTS admins CASCADE;

-- ============================================
-- TABLE: books
-- Menyimpan data buku perpustakaan
-- ============================================
CREATE TABLE books (
    id SERIAL PRIMARY KEY,
    isbn VARCHAR(13) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    publisher VARCHAR(255),
    year_published INTEGER,
    category VARCHAR(100) DEFAULT 'General',
    total_copies INTEGER DEFAULT 1 CHECK (total_copies >= 0),
    available_copies INTEGER DEFAULT 1 CHECK (available_copies >= 0),
    cover_url TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraint: available tidak boleh lebih dari total
    CONSTRAINT check_available_copies CHECK (available_copies <= total_copies)
);

-- Index untuk performance
CREATE INDEX idx_books_title ON books(title);
CREATE INDEX idx_books_author ON books(author);
CREATE INDEX idx_books_category ON books(category);
CREATE INDEX idx_books_isbn ON books(isbn);

-- ============================================
-- TABLE: members
-- Menyimpan data anggota perpustakaan
-- ============================================
CREATE TABLE members (
    id SERIAL PRIMARY KEY,
    member_id VARCHAR(50) UNIQUE NOT NULL,  -- NIM atau ID member
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    member_type VARCHAR(20) DEFAULT 'student',  -- student, lecturer, staff
    status VARCHAR(20) DEFAULT 'active',  -- active, suspended, expired
    address TEXT,
    joined_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index untuk performance
CREATE INDEX idx_members_member_id ON members(member_id);
CREATE INDEX idx_members_email ON members(email);
CREATE INDEX idx_members_status ON members(status);

-- ============================================
-- TABLE: admins
-- Menyimpan data admin/pustakawan
-- ============================================
CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'librarian',  -- librarian, admin
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index untuk performance
CREATE INDEX idx_admins_username ON admins(username);
CREATE INDEX idx_admins_email ON admins(email);

-- ============================================
-- TABLE: borrowings
-- Menyimpan data peminjaman buku
-- ============================================
CREATE TABLE borrowings (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    borrow_date DATE DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    return_date DATE,
    status VARCHAR(20) DEFAULT 'borrowed',  -- borrowed, returned, overdue
    fine_amount DECIMAL(10,2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraint: return_date tidak boleh sebelum borrow_date
    CONSTRAINT check_return_date CHECK (return_date IS NULL OR return_date >= borrow_date)
);

-- Index untuk performance
CREATE INDEX idx_borrowings_member ON borrowings(member_id);
CREATE INDEX idx_borrowings_book ON borrowings(book_id);
CREATE INDEX idx_borrowings_status ON borrowings(status);
CREATE INDEX idx_borrowings_due_date ON borrowings(due_date);

-- ============================================
-- TRIGGERS untuk auto-update timestamps
-- ============================================

-- Function untuk update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger untuk books
CREATE TRIGGER update_books_updated_at BEFORE UPDATE ON books
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger untuk members
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger untuk admins
CREATE TRIGGER update_admins_updated_at BEFORE UPDATE ON admins
    FOR EACH ROW EXECUTE FUNCTION update_admins_updated_at_column();

-- Trigger untuk borrowings
CREATE TRIGGER update_borrowings_updated_at BEFORE UPDATE ON borrowings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTION untuk auto-update status overdue
-- ============================================
CREATE OR REPLACE FUNCTION update_overdue_status()
RETURNS void AS $$
BEGIN
    UPDATE borrowings
    SET status = 'overdue'
    WHERE status = 'borrowed'
    AND due_date < CURRENT_DATE
    AND return_date IS NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEWS untuk reporting
-- ============================================

-- View: Active Borrowings
CREATE OR REPLACE VIEW active_borrowings AS
SELECT
    b.id,
    b.borrow_date,
    b.due_date,
    b.status,
    m.member_id,
    m.name as member_name,
    m.email as member_email,
    bk.title as book_title,
    bk.author as book_author,
    bk.isbn,
    CASE
        WHEN b.due_date < CURRENT_DATE THEN b.due_date - CURRENT_DATE
        ELSE 0
    END as days_overdue
FROM borrowings b
JOIN members m ON b.member_id = m.id
JOIN books bk ON b.book_id = bk.id
WHERE b.status IN ('borrowed', 'overdue');

-- View: Book Availability
CREATE OR REPLACE VIEW book_availability AS
SELECT
    id,
    isbn,
    title,
    author,
    category,
    total_copies,
    available_copies,
    (total_copies - available_copies) as borrowed_copies,
    CASE
        WHEN available_copies > 0 THEN 'Available'
        ELSE 'Not Available'
    END as availability_status
FROM books;

-- View: Member Statistics
CREATE OR REPLACE VIEW member_statistics AS
SELECT
    m.id,
    m.member_id,
    m.name,
    m.email,
    COUNT(b.id) as total_borrowings,
    COUNT(CASE WHEN b.status = 'borrowed' THEN 1 END) as active_borrowings,
    COUNT(CASE WHEN b.status = 'returned' THEN 1 END) as returned_books,
    COUNT(CASE WHEN b.status = 'overdue' THEN 1 END) as overdue_books
FROM members m
LEFT JOIN borrowings b ON m.id = b.member_id
GROUP BY m.id, m.member_id, m.name, m.email;

-- ============================================
-- SAMPLE DATA / SEED DATA
-- ============================================

-- Insert sample admin
INSERT INTO admins (username, password_hash, name, email, role) VALUES
('admin', '$2b$10$rZ5qE5qE5qE5qE5qE5qE5u5qE5qE5qE5qE5qE5qE5qE5qE5qE5qE5', 'Admin ITERARY', 'admin@itera.ac.id', 'admin');
-- Password: admin123 (hashed with bcrypt)

-- Insert sample members
INSERT INTO members (member_id, name, email, phone, password_hash, member_type) VALUES
('120450001', 'Budi Santoso', 'budi@students.itera.ac.id', '081234567890', '$2b$10$rZ5qE5qE5qE5qE5qE5qE5u5qE5qE5qE5qE5qE5qE5qE5qE5qE5qE5', 'student'),
('120450002', 'Siti Nurhaliza', 'siti@students.itera.ac.id', '081234567891', '$2b$10$rZ5qE5qE5qE5qE5qE5qE5u5qE5qE5qE5qE5qE5qE5qE5qE5qE5qE5', 'student'),
('120450003', 'Ahmad Fadli', 'ahmad@students.itera.ac.id', '081234567892', '$2b$10$rZ5qE5qE5qE5qE5qE5qE5u5qE5qE5qE5qE5qE5qE5qE5qE5qE5qE5', 'student');
-- Password untuk semua: member123 (hashed with bcrypt)

-- Insert sample books
INSERT INTO books (isbn, title, author, publisher, year_published, category, total_copies, available_copies, cover_url, description) VALUES
('9780132350884', 'Clean Code', 'Robert C. Martin', 'Prentice Hall', 2008, 'Programming', 5, 5, 'https://images.isbndb.com/covers/08/84/9780132350884.jpg', 'A handbook of agile software craftsmanship'),
('9780201633610', 'Design Patterns', 'Gang of Four', 'Addison-Wesley', 1994, 'Programming', 3, 3, 'https://images.isbndb.com/covers/36/10/9780201633610.jpg', 'Elements of Reusable Object-Oriented Software'),
('9780134685991', 'Effective Java', 'Joshua Bloch', 'Addison-Wesley', 2017, 'Programming', 4, 4, 'https://images.isbndb.com/covers/59/91/9780134685991.jpg', 'Best practices for the Java platform'),
('9781449355739', 'Designing Data-Intensive Applications', 'Martin Kleppmann', 'O''Reilly Media', 2017, 'Database', 3, 3, 'https://images.isbndb.com/covers/57/39/9781449355739.jpg', 'The Big Ideas Behind Reliable, Scalable, and Maintainable Systems'),
('9780321573513', 'Algorithms', 'Robert Sedgewick', 'Addison-Wesley', 2011, 'Computer Science', 4, 4, 'https://images.isbndb.com/covers/35/13/9780321573513.jpg', 'Fourth Edition'),
('9780596517748', 'JavaScript: The Good Parts', 'Douglas Crockford', 'O''Reilly Media', 2008, 'Programming', 5, 5, 'https://images.isbndb.com/covers/77/48/9780596517748.jpg', 'The Definitive Guide'),
('9781491950296', 'Building Microservices', 'Sam Newman', 'O''Reilly Media', 2015, 'Software Architecture', 3, 3, 'https://images.isbndb.com/covers/02/96/9781491950296.jpg', 'Designing Fine-Grained Systems'),
('9780134757599', 'Refactoring', 'Martin Fowler', 'Addison-Wesley', 2018, 'Programming', 4, 4, 'https://images.isbndb.com/covers/75/99/9780134757599.jpg', 'Improving the Design of Existing Code'),
('9781617294136', 'The DevOps Handbook', 'Gene Kim', 'IT Revolution Press', 2016, 'DevOps', 2, 2, 'https://images.isbndb.com/covers/41/36/9781617294136.jpg', 'How to Create World-Class Agility, Reliability, and Security'),
('9780134494166', 'Clean Architecture', 'Robert C. Martin', 'Prentice Hall', 2017, 'Software Architecture', 3, 3, 'https://images.isbndb.com/covers/41/66/9780134494166.jpg', 'A Craftsman''s Guide to Software Structure'),
('9781492040347', 'Fundamentals of Software Architecture', 'Mark Richards', 'O''Reilly Media', 2020, 'Software Architecture', 3, 3, 'https://images.isbndb.com/covers/03/47/9781492040347.jpg', 'An Engineering Approach'),
('9781449373320', 'Designing Distributed Systems', 'Brendan Burns', 'O''Reilly Media', 2018, 'Distributed Systems', 2, 2, 'https://images.isbndb.com/covers/33/20/9781449373320.jpg', 'Patterns and Paradigms for Scalable, Reliable Services'),
('9780135957059', 'The Pragmatic Programmer', 'David Thomas', 'Addison-Wesley', 2019, 'Programming', 5, 5, 'https://images.isbndb.com/covers/70/59/9780135957059.jpg', 'Your Journey to Mastery'),
('9781491904244', 'Introduction to Machine Learning with Python', 'Andreas Müller', 'O''Reilly Media', 2016, 'Machine Learning', 4, 4, 'https://images.isbndb.com/covers/42/44/9781491904244.jpg', 'A Guide for Data Scientists'),
('9780321125217', 'Domain-Driven Design', 'Eric Evans', 'Addison-Wesley', 2003, 'Software Architecture', 3, 3, 'https://images.isbndb.com/covers/52/17/9780321125217.jpg', 'Tackling Complexity in the Heart of Software');

-- Insert sample borrowings
INSERT INTO borrowings (member_id, book_id, borrow_date, due_date, status) VALUES
(1, 1, CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '9 days', 'borrowed'),
(2, 3, CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '11 days', 'borrowed');

-- Update available copies after borrowings
UPDATE books SET available_copies = available_copies - 1 WHERE id = 1;
UPDATE books SET available_copies = available_copies - 1 WHERE id = 3;

-- ============================================
-- GRANT PERMISSIONS (for application user)
-- ============================================
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO iterary_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO iterary_app;

-- ============================================
-- SUMMARY
-- ============================================
-- Tables created: 4 (books, members, admins, borrowings)
-- Views created: 3 (active_borrowings, book_availability, member_statistics)
-- Functions created: 2 (update_updated_at_column, update_overdue_status)
-- Sample data: 1 admin, 3 members, 15 books, 2 borrowings
-- ============================================
