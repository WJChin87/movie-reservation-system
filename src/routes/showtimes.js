const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { auth, admin } = require("../middleware/auth");

// Get all showtimes
router.get("/", async (req, res) => {
  try {
    const { movieId } = req.query;
    let query = `
      SELECT 
        s.*,
        m.title, m.duration, m.rating, m.poster_url,
        t.name as theater_name, t.capacity, t.type as theater_type,
        array_agg(DISTINCT g.name) as genres,
        json_build_object(
          'id', m.id,
          'title', m.title,
          'duration', m.duration,
          'genres', array_agg(DISTINCT g.name),
          'rating', m.rating,
          'poster_url', m.poster_url
        ) as movie,
        json_build_object(
          'id', t.id,
          'name', t.name,
          'capacity', t.capacity,
          'type', t.type
        ) as theater
      FROM showtimes s
      JOIN movies m ON s.movie_id = m.id
      JOIN theaters t ON s.theater_id = t.id
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
      WHERE s.start_time >= NOW()
    `;

    const queryParams = [];
    if (movieId) {
      queryParams.push(movieId);
      query += ` AND s.movie_id = $1`;
    }

    query += `
      GROUP BY s.id, m.id, t.id
      ORDER BY s.start_time ASC
    `;

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching showtimes" });
  }
});

// Get showtime by ID
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        s.*,
        m.title, m.duration, m.rating, m.poster_url,
        t.name as theater_name, t.capacity, t.type as theater_type,
        array_agg(DISTINCT g.name) as genres,
        json_build_object(
          'id', m.id,
          'title', m.title,
          'duration', m.duration,
          'genres', array_agg(DISTINCT g.name),
          'rating', m.rating,
          'poster_url', m.poster_url
        ) as movie,
        json_build_object(
          'id', t.id,
          'name', t.name,
          'capacity', t.capacity,
          'type', t.type
        ) as theater
      FROM showtimes s
      JOIN movies m ON s.movie_id = m.id
      JOIN theaters t ON s.theater_id = t.id
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
      WHERE s.id = $1
      GROUP BY s.id, m.id, t.id
    `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Showtime not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching showtime" });
  }
});

// Create showtime (Admin only)
router.post("/", [auth, admin], async (req, res) => {
  try {
    const { movie_id, theater_id, start_time, price } = req.body;

    const result = await pool.query(
      `INSERT INTO showtimes (movie_id, theater_id, start_time, price)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [movie_id, theater_id, start_time, price]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creating showtime" });
  }
});

// Update showtime (Admin only)
router.put("/:id", [auth, admin], async (req, res) => {
  try {
    const { movie_id, theater_id, start_time, price } = req.body;

    const result = await pool.query(
      `UPDATE showtimes
       SET movie_id = $1, theater_id = $2, start_time = $3, price = $4
       WHERE id = $5
       RETURNING *`,
      [movie_id, theater_id, start_time, price, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Showtime not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating showtime" });
  }
});

// Delete showtime (Admin only)
router.delete("/:id", [auth, admin], async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM showtimes WHERE id = $1 RETURNING *",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Showtime not found" });
    }

    res.json({ message: "Showtime deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting showtime" });
  }
});

// Add multiple showtimes (Admin only)
router.post("/batch", [auth, admin], async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { movie_id, theater_id, dates, times, price } = req.body;
    const results = [];

    for (const date of dates) {
      for (const time of times) {
        const [hours, minutes] = time.split(":");
        const start_time = new Date(date);
        start_time.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        const result = await client.query(
          `INSERT INTO showtimes (movie_id, theater_id, start_time, price)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [movie_id, theater_id, start_time, price]
        );
        results.push(result.rows[0]);
      }
    }

    await client.query("COMMIT");
    res.status(201).json(results);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: "Error creating showtimes" });
  } finally {
    client.release();
  }
});

// Get seats for a showtime
router.get("/:id/seats", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT s.*, r.id as reservation_id,
             CASE WHEN r.id IS NOT NULL AND r.status = 'active' THEN true ELSE false END as is_occupied
      FROM seats s
      LEFT JOIN reservations r ON s.id = r.seat_id AND r.showtime_id = $1 AND r.status = 'active'
      WHERE s.theater_id = (
        SELECT theater_id FROM showtimes WHERE id = $1
      )
      ORDER BY s.row_number, s.seat_number
    `,
      [req.params.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching seats" });
  }
});

module.exports = router;
