const db = require("../config/database");

class Showtime {
  static async create({ movieId, theaterId, startTime, price }) {
    const [result] = await db.execute(
      "INSERT INTO showtimes (movie_id, theater_id, start_time, price) VALUES (?, ?, ?, ?)",
      [movieId, theaterId, startTime, price]
    );
    return result.insertId;
  }

  static async findAll() {
    const [rows] = await db.execute(`
      SELECT s.*, m.title as movie_title, t.name as theater_name, t.capacity
      FROM showtimes s
      JOIN movies m ON s.movie_id = m.id
      JOIN theaters t ON s.theater_id = t.id
      WHERE s.start_time >= NOW()
      ORDER BY s.start_time ASC
    `);
    return rows;
  }

  static async findById(id) {
    const [rows] = await db.execute(
      `
      SELECT s.*, m.title as movie_title, t.name as theater_name, t.capacity
      FROM showtimes s
      JOIN movies m ON s.movie_id = m.id
      JOIN theaters t ON s.theater_id = t.id
      WHERE s.id = ?
    `,
      [id]
    );
    return rows[0];
  }

  static async getAvailableSeats(showtimeId) {
    const [rows] = await db.execute(
      `
      SELECT s.id, s.row_number, s.seat_number
      FROM seats s
      JOIN theaters t ON s.theater_id = t.id
      JOIN showtimes st ON st.theater_id = t.id
      WHERE st.id = ?
      AND s.id NOT IN (
        SELECT seat_id 
        FROM reservations 
        WHERE showtime_id = ? 
        AND status = 'active'
      )
      ORDER BY s.row_number, s.seat_number
    `,
      [showtimeId, showtimeId]
    );
    return rows;
  }

  static async isValidSeat(showtimeId, seatId) {
    const [rows] = await db.execute(
      `
      SELECT 1
      FROM seats s
      JOIN theaters t ON s.theater_id = t.id
      JOIN showtimes st ON st.theater_id = t.id
      WHERE st.id = ? AND s.id = ?
      AND s.id NOT IN (
        SELECT seat_id 
        FROM reservations 
        WHERE showtime_id = ? 
        AND status = 'active'
      )
    `,
      [showtimeId, seatId, showtimeId]
    );
    return rows.length > 0;
  }

  static async delete(id) {
    const [result] = await db.execute("DELETE FROM showtimes WHERE id = ?", [
      id,
    ]);
    return result.affectedRows > 0;
  }
}

module.exports = Showtime;
