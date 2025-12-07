const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/auth');
const { query } = require('../config/db');

// List minimal members for selection (admin)
router.get('/', verifyToken, isAdmin, async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    let rows;
    if (q) {
      rows = await query(
        `SELECT id, member_id, name, email FROM members
         WHERE member_id LIKE ? OR name LIKE ? OR email LIKE ?
         ORDER BY name ASC LIMIT 50`,
        [`%${q}%`, `%${q}%`, `%${q}%`]
      );
    } else {
      rows = await query(`SELECT id, member_id, name, email FROM members ORDER BY name ASC LIMIT 50`);
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;