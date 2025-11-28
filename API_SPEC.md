# 📡 ITERARY - API SPECIFICATION
**ITERA Repository Archive Reading facilitY**

Version: 1.0.0
Base URL: `https://iterary-backend-xxxxx-uc.a.run.app`
Local Development: `http://localhost:8080`

---

## 📋 TABLE OF CONTENTS

- [Authentication](#authentication)
- [Books API](#books-api)
- [Members API](#members-api)
- [Borrowings API](#borrowings-api)
- [Stats API](#stats-api)
- [Error Responses](#error-responses)

---

## 🔐 AUTHENTICATION

### Login (Admin)

**Endpoint:** `POST /api/auth/login`

**Description:** Login untuk admin/pustakawan

**Request Body:**
```json
{
  "username": "admin@itera.ac.id",
  "password": "admin123"
}
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "admin@itera.ac.id",
      "name": "Admin ITERARY",
      "email": "admin@itera.ac.id",
      "role": "admin"
    }
  }
}
```

**Response Error (401):**
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

---

### Login (Member)

**Endpoint:** `POST /api/auth/member-login`

**Description:** Login untuk member/mahasiswa

**Request Body:**
```json
{
  "email": "budi@students.itera.ac.id",
  "password": "member123"
}
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "member_id": "120450001",
      "name": "Budi Santoso",
      "email": "budi@students.itera.ac.id",
      "member_type": "student"
    }
  }
}
```

---

### Register (Member)

**Endpoint:** `POST /api/auth/register`

**Description:** Registrasi member baru

**Request Body:**
```json
{
  "member_id": "120450004",
  "name": "Dewi Lestari",
  "email": "dewi@students.itera.ac.id",
  "phone": "081234567893",
  "password": "password123",
  "member_type": "student"
}
```

**Response Success (201):**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "id": 4,
    "member_id": "120450004",
    "name": "Dewi Lestari",
    "email": "dewi@students.itera.ac.id"
  }
}
```

**Response Error (400):**
```json
{
  "success": false,
  "message": "Email already exists"
}
```

---

### Get Current User

**Endpoint:** `GET /api/auth/me`

**Description:** Get current logged in user info

**Headers:**
```
Authorization: Bearer {token}
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin@itera.ac.id",
    "name": "Admin ITERARY",
    "email": "admin@itera.ac.id",
    "role": "admin"
  }
}
```

---

### Logout

**Endpoint:** `POST /api/auth/logout`

**Description:** Logout (client-side token removal)

**Headers:**
```
Authorization: Bearer {token}
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

## 📚 BOOKS API

### Get All Books

**Endpoint:** `GET /api/books`

**Description:** Get list semua buku dengan pagination, search, filter

**Query Parameters:**
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 20) - Items per page
- `search` (optional) - Search by title or author
- `category` (optional) - Filter by category
- `sort` (optional, default: title) - Sort by: title, author, year

**Example Request:**
```
GET /api/books?page=1&limit=10&search=clean&category=Programming&sort=title
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "books": [
      {
        "id": 1,
        "isbn": "9780132350884",
        "title": "Clean Code",
        "author": "Robert C. Martin",
        "publisher": "Prentice Hall",
        "year_published": 2008,
        "category": "Programming",
        "total_copies": 5,
        "available_copies": 4,
        "cover_url": "https://images.isbndb.com/covers/08/84/9780132350884.jpg",
        "description": "A handbook of agile software craftsmanship",
        "availability_status": "Available"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 15,
      "total_pages": 2
    }
  }
}
```

**Cache:** Redis (5 minutes)

---

### Get Book by ID

**Endpoint:** `GET /api/books/:id`

**Description:** Get detail satu buku

**Example Request:**
```
GET /api/books/1
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "isbn": "9780132350884",
    "title": "Clean Code",
    "author": "Robert C. Martin",
    "publisher": "Prentice Hall",
    "year_published": 2008,
    "category": "Programming",
    "total_copies": 5,
    "available_copies": 4,
    "cover_url": "https://images.isbndb.com/covers/08/84/9780132350884.jpg",
    "description": "A handbook of agile software craftsmanship",
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-01-15T10:00:00Z"
  }
}
```

**Response Error (404):**
```json
{
  "success": false,
  "message": "Book not found"
}
```

**Cache:** Redis (10 minutes)

---

### Get Categories

**Endpoint:** `GET /api/books/categories`

**Description:** Get list semua kategori buku yang tersedia

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "categories": [
      "Programming",
      "Database",
      "Computer Science",
      "Software Architecture",
      "DevOps",
      "Distributed Systems",
      "Machine Learning"
    ]
  }
}
```

---

### Create Book (Admin Only)

**Endpoint:** `POST /api/books`

**Description:** Tambah buku baru

**Headers:**
```
Authorization: Bearer {admin_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "isbn": "9780134685991",
  "title": "Effective Java",
  "author": "Joshua Bloch",
  "publisher": "Addison-Wesley",
  "year_published": 2017,
  "category": "Programming",
  "total_copies": 4,
  "available_copies": 4,
  "cover_url": "https://images.isbndb.com/covers/59/91/9780134685991.jpg",
  "description": "Best practices for the Java platform"
}
```

**Response Success (201):**
```json
{
  "success": true,
  "message": "Book created successfully",
  "data": {
    "id": 16,
    "isbn": "9780134685991",
    "title": "Effective Java",
    "author": "Joshua Bloch",
    "publisher": "Addison-Wesley",
    "year_published": 2017,
    "category": "Programming",
    "total_copies": 4,
    "available_copies": 4
  }
}
```

**Response Error (400):**
```json
{
  "success": false,
  "message": "ISBN already exists"
}
```

**Response Error (401):**
```json
{
  "success": false,
  "message": "Unauthorized - Admin only"
}
```

---

### Update Book (Admin Only)

**Endpoint:** `PUT /api/books/:id`

**Description:** Update data buku

**Headers:**
```
Authorization: Bearer {admin_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Clean Code - Updated Edition",
  "total_copies": 6,
  "available_copies": 5,
  "description": "Updated description"
}
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Book updated successfully",
  "data": {
    "id": 1,
    "title": "Clean Code - Updated Edition",
    "total_copies": 6,
    "available_copies": 5
  }
}
```

---

### Delete Book (Admin Only)

**Endpoint:** `DELETE /api/books/:id`

**Description:** Hapus buku (soft delete atau hard delete)

**Headers:**
```
Authorization: Bearer {admin_token}
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Book deleted successfully"
}
```

**Response Error (400):**
```json
{
  "success": false,
  "message": "Cannot delete book with active borrowings"
}
```

---

## 👥 MEMBERS API

### Get All Members (Admin Only)

**Endpoint:** `GET /api/members`

**Description:** Get list semua member

**Headers:**
```
Authorization: Bearer {admin_token}
```

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 20)
- `search` (optional) - Search by name, email, or member_id
- `status` (optional) - Filter by status (active, suspended)

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "members": [
      {
        "id": 1,
        "member_id": "120450001",
        "name": "Budi Santoso",
        "email": "budi@students.itera.ac.id",
        "phone": "081234567890",
        "member_type": "student",
        "status": "active",
        "joined_date": "2025-01-01",
        "total_borrowings": 5,
        "active_borrowings": 1
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 3,
      "total_pages": 1
    }
  }
}
```

---

### Get Member by ID (Admin Only)

**Endpoint:** `GET /api/members/:id`

**Description:** Get detail member

**Headers:**
```
Authorization: Bearer {admin_token}
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "member_id": "120450001",
    "name": "Budi Santoso",
    "email": "budi@students.itera.ac.id",
    "phone": "081234567890",
    "member_type": "student",
    "status": "active",
    "address": null,
    "joined_date": "2025-01-01",
    "statistics": {
      "total_borrowings": 5,
      "active_borrowings": 1,
      "returned_books": 4,
      "overdue_books": 0
    }
  }
}
```

---

## 📖 BORROWINGS API

### Create Borrowing (Member)

**Endpoint:** `POST /api/borrowings`

**Description:** Member pinjam buku

**Headers:**
```
Authorization: Bearer {member_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "book_id": 1,
  "duration_days": 14
}
```

**Response Success (201):**
```json
{
  "success": true,
  "message": "Book borrowed successfully",
  "data": {
    "id": 3,
    "member_id": 1,
    "book_id": 1,
    "borrow_date": "2025-01-20",
    "due_date": "2025-02-03",
    "status": "borrowed",
    "book": {
      "title": "Clean Code",
      "author": "Robert C. Martin"
    }
  }
}
```

**Response Error (400):**
```json
{
  "success": false,
  "message": "Book not available"
}
```

**Response Error (400):**
```json
{
  "success": false,
  "message": "You have overdue books. Please return them first."
}
```

---

### Get My Borrowings (Member)

**Endpoint:** `GET /api/borrowings/me`

**Description:** Get borrowing history member yang login

**Headers:**
```
Authorization: Bearer {member_token}
```

**Query Parameters:**
- `status` (optional) - Filter by status (borrowed, returned, overdue)

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "borrowings": [
      {
        "id": 1,
        "borrow_date": "2025-01-15",
        "due_date": "2025-01-29",
        "return_date": null,
        "status": "borrowed",
        "days_remaining": 9,
        "book": {
          "id": 1,
          "title": "Clean Code",
          "author": "Robert C. Martin",
          "cover_url": "https://..."
        }
      }
    ]
  }
}
```

---

### Get All Borrowings (Admin)

**Endpoint:** `GET /api/borrowings`

**Description:** Get semua borrowing (admin view)

**Headers:**
```
Authorization: Bearer {admin_token}
```

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 20)
- `status` (optional) - Filter by status
- `member_id` (optional) - Filter by member

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "borrowings": [
      {
        "id": 1,
        "borrow_date": "2025-01-15",
        "due_date": "2025-01-29",
        "return_date": null,
        "status": "borrowed",
        "member": {
          "id": 1,
          "member_id": "120450001",
          "name": "Budi Santoso",
          "email": "budi@students.itera.ac.id"
        },
        "book": {
          "id": 1,
          "isbn": "9780132350884",
          "title": "Clean Code",
          "author": "Robert C. Martin"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 2,
      "total_pages": 1
    }
  }
}
```

---

### Process Return (Admin)

**Endpoint:** `PUT /api/borrowings/:id/return`

**Description:** Admin proses pengembalian buku

**Headers:**
```
Authorization: Bearer {admin_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "notes": "Buku dikembalikan dalam kondisi baik"
}
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Book returned successfully",
  "data": {
    "id": 1,
    "return_date": "2025-01-20",
    "status": "returned",
    "fine_amount": 0,
    "notes": "Buku dikembalikan dalam kondisi baik"
  }
}
```

**Response Error (400):**
```json
{
  "success": false,
  "message": "Book already returned"
}
```

---

### Get Overdue Borrowings (Admin)

**Endpoint:** `GET /api/borrowings/overdue`

**Description:** Get list borrowing yang overdue

**Headers:**
```
Authorization: Bearer {admin_token}
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "overdue_borrowings": [
      {
        "id": 5,
        "borrow_date": "2024-12-15",
        "due_date": "2024-12-29",
        "days_overdue": 22,
        "fine_amount": 22000,
        "member": {
          "member_id": "120450002",
          "name": "Siti Nurhaliza",
          "email": "siti@students.itera.ac.id"
        },
        "book": {
          "title": "Design Patterns",
          "author": "Gang of Four"
        }
      }
    ]
  }
}
```

---

## 📊 STATS API

### Dashboard Statistics (Admin)

**Endpoint:** `GET /api/stats/dashboard`

**Description:** Get statistics untuk dashboard admin

**Headers:**
```
Authorization: Bearer {admin_token}
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "total_books": 15,
    "total_available": 13,
    "total_borrowed": 2,
    "total_members": 3,
    "active_borrowings": 2,
    "overdue_borrowings": 0,
    "recent_borrowings": [
      {
        "id": 2,
        "borrow_date": "2025-01-17",
        "member_name": "Siti Nurhaliza",
        "book_title": "Effective Java",
        "due_date": "2025-01-31",
        "status": "borrowed"
      }
    ],
    "popular_books": [
      {
        "id": 1,
        "title": "Clean Code",
        "author": "Robert C. Martin",
        "borrow_count": 15
      }
    ]
  }
}
```

**Cache:** Redis (1 minute)

---

### Popular Books

**Endpoint:** `GET /api/stats/popular-books`

**Description:** Get most borrowed books

**Query Parameters:**
- `limit` (optional, default: 10) - Number of books

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "popular_books": [
      {
        "id": 1,
        "title": "Clean Code",
        "author": "Robert C. Martin",
        "category": "Programming",
        "borrow_count": 15,
        "cover_url": "https://..."
      }
    ]
  }
}
```

---

## ❌ ERROR RESPONSES

### Standard Error Format

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE",
    "details": "Additional error details"
  }
}
```

### HTTP Status Codes

- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required or failed
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate email)
- `422 Unprocessable Entity` - Validation error
- `500 Internal Server Error` - Server error

### Common Error Examples

**Validation Error (422):**
```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": {
      "email": "Invalid email format",
      "password": "Password must be at least 6 characters"
    }
  }
}
```

**Unauthorized (401):**
```json
{
  "success": false,
  "message": "Authentication required",
  "error": {
    "code": "UNAUTHORIZED"
  }
}
```

**Forbidden (403):**
```json
{
  "success": false,
  "message": "Admin access required",
  "error": {
    "code": "FORBIDDEN"
  }
}
```

**Not Found (404):**
```json
{
  "success": false,
  "message": "Book not found",
  "error": {
    "code": "NOT_FOUND"
  }
}
```

---

## 🔒 AUTHENTICATION & AUTHORIZATION

### JWT Token

All protected endpoints require JWT token in Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Payload

```json
{
  "id": 1,
  "email": "admin@itera.ac.id",
  "role": "admin",
  "iat": 1674652800,
  "exp": 1674739200
}
```

### Roles

- `admin` - Full access (CRUD books, manage borrowings, view all members)
- `member` - Limited access (borrow books, view own borrowings)

---

## 📝 NOTES

### Pagination

All list endpoints support pagination with `page` and `limit` query parameters.

Default values:
- `page`: 1
- `limit`: 20

### Caching Strategy

Redis caching implemented for:
- `GET /api/books` - 5 minutes
- `GET /api/books/:id` - 10 minutes
- `GET /api/stats/dashboard` - 1 minute

Cache invalidation occurs on:
- Book CRUD operations
- Borrowing operations
- Return operations

### Rate Limiting

API rate limits (to be implemented):
- 100 requests per minute per IP
- 1000 requests per hour per user

---

## 🧪 TESTING ENDPOINTS

### Example with cURL

**Login:**
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@itera.ac.id","password":"admin123"}'
```

**Get Books:**
```bash
curl http://localhost:8080/api/books?page=1&limit=10
```

**Create Book (with auth):**
```bash
curl -X POST http://localhost:8080/api/books \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"isbn":"9781234567890","title":"Test Book","author":"Test Author",...}'
```

### Example with Postman

Import this API spec to Postman and use environment variables:
- `{{baseUrl}}` = `http://localhost:8080` or production URL
- `{{token}}` = JWT token from login response

---

**Last Updated:** 2025-01-27
**Version:** 1.0.0
**Maintained by:** ITERARY Development Team
