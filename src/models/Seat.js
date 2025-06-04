const db = require("../config/database");

class Seat {
  static async findByShowtime(showtimeId) {
    if (!showtimeId) {
      throw new Error("Showtime ID is required");
    }

    const query = `
      SELECT 
        s.id,
        s.row_number,
        s.seat_number,
        CASE WHEN r.id IS NULL THEN false ELSE true END as is_occupied
      FROM showtimes st
      JOIN theaters t ON st.theater_id = t.id
      JOIN seats s ON s.theater_id = t.id
      LEFT JOIN reservations r ON r.seat_id = s.id 
        AND r.showtime_id = st.id 
        AND r.status = 'active'
      WHERE st.id = $1
      ORDER BY s.row_number, s.seat_number
    `;

    const result = await db.query(query, [showtimeId]);
    return result.rows;
  }

  static async validateSeats(showtimeId, seatIds) {
    if (!showtimeId || !Array.isArray(seatIds) || seatIds.length === 0) {
      throw new Error("Showtime ID and seat IDs array are required");
    }

    const query = `
      SELECT s.id
      FROM showtimes st
      JOIN theaters t ON st.theater_id = t.id
      JOIN seats s ON s.theater_id = t.id
      WHERE st.id = $1
      AND s.id = ANY($2::int[])
      AND NOT EXISTS (
        SELECT 1
        FROM reservations r
        WHERE r.showtime_id = st.id
        AND r.seat_id = s.id
        AND r.status = 'active'
      )
    `;

    const result = await db.query(query, [showtimeId, seatIds]);
    return result.rows.length === seatIds.length;
  }
}

module.exports = Seat;
