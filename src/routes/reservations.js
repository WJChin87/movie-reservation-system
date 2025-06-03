const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { auth } = require("../middleware/auth");

// Get user's reservations
router.get("/", [auth], async (req, res) => {
  try {
    console.log("Fetching reservations for user:", req.user.id);

    const basicQuery = `
      SELECT 
        r.id,
        r.status::text,
        r.showtime_id,
        r.seat_id,
        r.user_id,
        s.row_number,
        s.seat_number,
        sh.start_time,
        sh.price,
        m.title as movie_title,
        COALESCE(m.poster_url, '') as movie_poster,
        t.name as theater_name
      FROM reservations r
      JOIN seats s ON r.seat_id = s.id
      JOIN showtimes sh ON r.showtime_id = sh.id
      JOIN movies m ON sh.movie_id = m.id
      JOIN theaters t ON sh.theater_id = t.id
      WHERE r.user_id = $1
      ORDER BY sh.start_time DESC;
    `;

    console.log("Executing query for user:", req.user.id);

    const result = await pool.query(basicQuery, [req.user.id]);

    console.log(
      "Query executed successfully. Found",
      result.rows.length,
      "rows"
    );

    // Group the results by showtime
    const groupedReservations = result.rows.reduce((acc, row) => {
      const showtimeId = row.showtime_id;

      if (!acc[showtimeId]) {
        acc[showtimeId] = {
          showtime_id: showtimeId,
          movie_title: row.movie_title,
          movie_poster: row.movie_poster || "",
          start_time: row.start_time,
          theater_name: row.theater_name,
          price: parseFloat(row.price) || 0,
          status: row.status,
          seats: [],
        };
      }

      acc[showtimeId].seats.push({
        id: row.id,
        row_number: row.row_number,
        seat_number: row.seat_number,
      });

      return acc;
    }, {});

    const finalResults = Object.values(groupedReservations);

    console.log("Successfully grouped reservations:", {
      totalGroups: finalResults.length,
      sampleGroup: finalResults[0]
        ? {
            showtime_id: finalResults[0].showtime_id,
            movie_title: finalResults[0].movie_title,
            seats_count: finalResults[0].seats.length,
          }
        : null,
    });

    res.json(finalResults);
  } catch (err) {
    console.error("Detailed error in GET /reservations:", {
      error: err.message,
      stack: err.stack,
      code: err.code,
      detail: err.detail,
      hint: err.hint,
      where: err.where,
      user_id: req.user?.id,
    });
    res.status(500).json({
      message: "Error fetching reservations",
      error: err.message,
      detail: err.detail,
      hint: err.hint,
    });
  }
});

// Create reservation
router.post("/", [auth], async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { showtime_id, seat_ids } = req.body;

    // Check if seats are available
    const seatCheck = await client.query(
      `SELECT seat_id FROM reservations
       WHERE showtime_id = $1 AND seat_id = ANY($2) AND status = 'active'`,
      [showtime_id, seat_ids]
    );

    if (seatCheck.rows.length > 0) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ message: "One or more seats are already reserved" });
    }

    // Create reservations for all seats
    const reservations = [];
    for (const seat_id of seat_ids) {
      const result = await client.query(
        `INSERT INTO reservations (user_id, showtime_id, seat_id, status)
         VALUES ($1, $2, $3, 'active')
         RETURNING *`,
        [req.user.id, showtime_id, seat_id]
      );
      reservations.push(result.rows[0]);
    }

    await client.query("COMMIT");
    res.status(201).json(reservations);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: "Error creating reservations" });
  } finally {
    client.release();
  }
});

// Update reservation status
router.put("/:id", [auth], async (req, res) => {
  try {
    const { status } = req.body;

    const result = await pool.query(
      `UPDATE reservations
       SET status = $1
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [status, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Reservation not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating reservation" });
  }
});

// Cancel reservation
router.delete("/:id", [auth], async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE reservations
       SET status = 'cancelled'
       WHERE id = $1 AND user_id = $2 AND status = 'active'
       RETURNING *`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Active reservation not found" });
    }

    res.json({ message: "Reservation cancelled successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error cancelling reservation" });
  }
});

// Update multiple reservations for a showtime
router.put("/showtime/:showtimeId", [auth], async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { status } = req.body;
    const { showtimeId } = req.params;

    // Update all reservations for this showtime
    const result = await client.query(
      `UPDATE reservations
       SET status = $1
       WHERE showtime_id = $2 AND user_id = $3
       RETURNING *`,
      [status, showtimeId, req.user.id]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({ message: "No reservations found for this showtime" });
    }

    await client.query("COMMIT");
    res.json({
      message: "Reservations updated successfully",
      reservations: result.rows,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: "Error updating reservations" });
  } finally {
    client.release();
  }
});

// Delete all reservations for a showtime
router.delete("/showtime/:showtimeId", [auth], async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { showtimeId } = req.params;

    // Delete all reservations for this showtime
    const result = await client.query(
      `DELETE FROM reservations
       WHERE showtime_id = $1 AND user_id = $2
       RETURNING *`,
      [showtimeId, req.user.id]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({ message: "No reservations found for this showtime" });
    }

    await client.query("COMMIT");
    res.json({
      message: "Reservations deleted successfully",
      count: result.rows.length,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: "Error deleting reservations" });
  } finally {
    client.release();
  }
});

module.exports = router;
