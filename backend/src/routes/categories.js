const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Ensure categories table exists to avoid runtime errors on fresh DBs
async function ensureCategoriesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

// Run table ensure once when module is loaded
ensureCategoriesTable().catch((e) => {
  console.error('Failed to ensure categories table:', e);
});

// List categories
router.get('/', async (req, res, next) => {
  try {
    await ensureCategoriesTable();
    const rows = await query('SELECT id, name FROM categories ORDER BY id ASC');
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// Create category
router.post('/', verifyToken, isAdmin, async (req, res, next) => {
  try {
    await ensureCategoriesTable();
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    const result = await query('INSERT INTO categories (name) VALUES (?)', [name]);
    res.status(201).json({ success: true, data: { id: result.insertId, name } });
  } catch (err) {
    next(err);
  }
});

// Update category
router.put('/:id', verifyToken, isAdmin, async (req, res, next) => {
  try {
    await ensureCategoriesTable();
    const { id } = req.params;
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    await query('UPDATE categories SET name = ? WHERE id = ?', [name, id]);
    res.json({ success: true, data: { id: Number(id), name } });
  } catch (err) {
    next(err);
  }
});

// Delete category
router.delete('/:id', verifyToken, isAdmin, async (req, res, next) => {
  try {
    await ensureCategoriesTable();
    const { id } = req.params;
    const categoryId = Number(id);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid category id' });
    }

    const result = await query('DELETE FROM categories WHERE id = ?', [categoryId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    const rows = await query('SELECT id, name FROM categories ORDER BY id ASC');
    res.json({ success: true, message: 'Deleted', data: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
