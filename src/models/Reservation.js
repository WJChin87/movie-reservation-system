const db = require("../config/database");

class Reservation {
  static async create({ userId, showtimeId, seatId }) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Check if seat is still available
      const [seats] = await connection.execute(
        `
        SELECT 1 FROM seats s
        WHERE s.id = ?
        AND NOT EXISTS (
          SELECT 1 FROM reservations r
          WHERE r.seat_id = s.id
          AND r.showtime_id = ?
          AND r.status = 'active'
        )
      `,
        [seatId, showtimeId]
      );

      if (seats.length === 0) {
        throw new Error("Seat is no longer available");
      }

      // Create reservation
      const [result] = await connection.execute(
        "INSERT INTO reservations (user_id, showtime_id, seat_id) VALUES (?, ?, ?)",
        [userId, showtimeId, seatId]
      );

      await connection.commit();
      return result.insertId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async findByUser(userId) {
    const [rows] = await db.execute(
      `
      SELECT 
        r.id,
        r.status,
        r.created_at,
        m.title as movie_title,
        s.start_time,
        t.name as theater_name,
        st.row_number,
        st.seat_number,
        sh.price
      FROM reservations r
      JOIN showtimes sh ON r.showtime_id = sh.id
      JOIN movies m ON sh.movie_id = m.id
      JOIN theaters t ON sh.theater_id = t.id
      JOIN seats st ON r.seat_id = st.id
      WHERE r.user_id = ?
      ORDER BY sh.start_time DESC
    `,
      [userId]
    );
    return rows;
  }

  static async findById(id) {
    const [rows] = await db.execute(
      `
      SELECT 
        r.*,
        m.title as movie_title,
        s.start_time,
        t.name as theater_name,
        st.row_number,
        st.seat_number
      FROM reservations r
      JOIN showtimes s ON r.showtime_id = s.id
      JOIN movies m ON s.movie_id = m.id
      JOIN theaters t ON s.theater_id = t.id
      JOIN seats st ON r.seat_id = st.id
      WHERE r.id = ?
    `,
      [id]
    );
    return rows[0];
  }

  static async cancel(id, userId) {
    const [result] = await db.execute(
      `
      UPDATE reservations 
      SET status = 'cancelled' 
      WHERE id = ? 
      AND user_id = ?
      AND status = 'active'
      AND showtime_id IN (
        SELECT id FROM showtimes WHERE start_time > NOW()
      )
    `,
      [id, userId]
    );
    return result.affectedRows > 0;
  }

  static async getReservationsByShowtime(showtimeId) {
    const [rows] = await db.execute(
      `
      SELECT 
        r.id,
        r.status,
        u.username,
        st.row_number,
        st.seat_number
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      JOIN seats st ON r.seat_id = st.id
      WHERE r.showtime_id = ?
      AND r.status = 'active'
    `,
      [showtimeId]
    );
    return rows;
  }
}

module.exports = Reservation;
