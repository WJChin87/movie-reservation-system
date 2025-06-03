const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { auth, admin } = require("../middleware/auth");

// Get all reservations (Admin only)
router.get("/reservations", [auth, admin], async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, u.username, m.title as movie_title,
             s.start_time, t.name as theater_name,
             st.row_number, st.seat_number
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      JOIN showtimes s ON r.showtime_id = s.id
      JOIN movies m ON s.movie_id = m.id
      JOIN theaters t ON s.theater_id = t.id
      JOIN seats st ON r.seat_id = st.id
      ORDER BY s.start_time DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching reservations" });
  }
});

// Get revenue report (Admin only)
router.get("/reports/revenue", [auth, admin], async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        DATE_TRUNC('day', s.start_time) as date,
        COUNT(r.id) as total_reservations,
        SUM(s.price) as total_revenue
      FROM reservations r
      JOIN showtimes s ON r.showtime_id = s.id
      WHERE r.status = 'active'
      GROUP BY DATE_TRUNC('day', s.start_time)
      ORDER BY date DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error generating revenue report" });
  }
});

// Update user role (Admin only)
router.put("/users/:id/role", [auth, admin], async (req, res) => {
  try {
    const { role } = req.body;

    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const result = await pool.query(
      `UPDATE users
       SET role = $1
       WHERE id = $2
       RETURNING id, username, email, role`,
      [role, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating user role" });
  }
});

module.exports = router;
