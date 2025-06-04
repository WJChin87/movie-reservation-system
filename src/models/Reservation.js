const db = require("../config/database");
const Showtime = require("./Showtime");

class Reservation {
  static validateReservation({ userId, showtimeId, seatId }) {
    if (!userId || typeof userId !== "number") {
      throw new Error("Valid user ID is required");
    }
    if (!showtimeId || typeof showtimeId !== "number") {
      throw new Error("Valid showtime ID is required");
    }
    if (!seatId || typeof seatId !== "number") {
      throw new Error("Valid seat ID is required");
    }
  }

  static async create({ userId, showtimeId, seatId }) {
    this.validateReservation({ userId, showtimeId, seatId });

    return db.transaction(async (client) => {
      // Verify showtime exists and is in the future
      const showtime = await client.query(
        `SELECT start_time, price FROM showtimes WHERE id = $1`,
        [showtimeId]
      );

      if (showtime.rows.length === 0) {
        throw new Error("Showtime not found");
      }

      const startTime = new Date(showtime.rows[0].start_time);
      if (startTime <= new Date()) {
        throw new Error("Cannot make reservations for past showtimes");
      }

      // Check if seat is valid for this showtime
      const seatValid = await client.query(
        `SELECT s.id, t.capacity 
         FROM seats s
         JOIN theaters t ON s.theater_id = t.id
         JOIN showtimes sh ON sh.theater_id = t.id
         WHERE sh.id = $1 AND s.id = $2`,
        [showtimeId, seatId]
      );

      if (seatValid.rows.length === 0) {
        throw new Error("Invalid seat for this showtime");
      }

      // Check if seat is still available
      const seatAvailable = await client.query(
        `SELECT 1 FROM seats s
         WHERE s.id = $1
         AND NOT EXISTS (
           SELECT 1 FROM reservations r
           WHERE r.seat_id = s.id
           AND r.showtime_id = $2
           AND r.status = 'active'
         )`,
        [seatId, showtimeId]
      );

      if (seatAvailable.rows.length === 0) {
        throw new Error("Seat is no longer available");
      }

      // Check user's existing reservations for this showtime
      const existingReservations = await client.query(
        `SELECT COUNT(*) as count 
         FROM reservations 
         WHERE user_id = $1 
         AND showtime_id = $2 
         AND status = 'active'`,
        [userId, showtimeId]
      );

      if (existingReservations.rows[0].count >= 5) {
        throw new Error(
          "Maximum number of reservations (5) reached for this showtime"
        );
      }

      // Create reservation
      const result = await client.query(
        `INSERT INTO reservations (user_id, showtime_id, seat_id, price, status)
         VALUES ($1, $2, $3, $4, 'active')
         RETURNING id`,
        [userId, showtimeId, seatId, showtime.rows[0].price]
      );

      return this.findById(result.rows[0].id, client);
    });
  }

  static async findByUser(
    userId,
    { status = null, upcoming = false, limit = 10, offset = 0 } = {}
  ) {
    if (!userId) {
      throw new Error("User ID is required");
    }

    const params = [userId];
    let paramCount = 1;

    let query = `
      SELECT 
        r.id,
        r.status,
        r.created_at,
        r.price as ticket_price,
        m.id as movie_id,
        m.title as movie_title,
        m.poster_url,
        sh.id as showtime_id,
        sh.start_time,
        t.id as theater_id,
        t.name as theater_name,
        t.type as theater_type,
        st.row_number,
        st.seat_number,
        CASE 
          WHEN sh.start_time > NOW() THEN true 
          ELSE false 
        END as is_upcoming
      FROM reservations r
      JOIN showtimes sh ON r.showtime_id = sh.id
      JOIN movies m ON sh.movie_id = m.id
      JOIN theaters t ON sh.theater_id = t.id
      JOIN seats st ON r.seat_id = st.id
      WHERE r.user_id = $1
    `;

    if (status) {
      paramCount++;
      query += ` AND r.status = $${paramCount}`;
      params.push(status);
    }

    if (upcoming) {
      query += ` AND sh.start_time > NOW()`;
    }

    query += `
      ORDER BY sh.start_time DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  }

  static async findById(id, client = db) {
    if (!id) {
      throw new Error("Reservation ID is required");
    }

    const result = await client.query(
      `SELECT 
        r.id,
        r.user_id,
        r.status,
        r.created_at,
        r.price as ticket_price,
        m.id as movie_id,
        m.title as movie_title,
        m.poster_url,
        sh.id as showtime_id,
        sh.start_time,
        t.id as theater_id,
        t.name as theater_name,
        t.type as theater_type,
        st.row_number,
        st.seat_number,
        CASE 
          WHEN sh.start_time > NOW() THEN true 
          ELSE false 
        END as is_upcoming
      FROM reservations r
      JOIN showtimes sh ON r.showtime_id = sh.id
      JOIN movies m ON sh.movie_id = m.id
      JOIN theaters t ON sh.theater_id = t.id
      JOIN seats st ON r.seat_id = st.id
      WHERE r.id = $1`,
      [id]
    );

    return result.rows[0];
  }

  static async cancel(id, userId) {
    if (!id || !userId) {
      throw new Error("Reservation ID and user ID are required");
    }

    return db.transaction(async (client) => {
      // Get reservation details
      const reservation = await client.query(
        `SELECT r.*, sh.start_time 
         FROM reservations r
         JOIN showtimes sh ON r.showtime_id = sh.id
         WHERE r.id = $1 AND r.user_id = $2`,
        [id, userId]
      );

      if (reservation.rows.length === 0) {
        throw new Error("Reservation not found");
      }

      const { status, start_time } = reservation.rows[0];

      // Validate cancellation
      if (status === "cancelled") {
        throw new Error("Reservation is already cancelled");
      }

      const showtime = new Date(start_time);
      const now = new Date();
      const hoursDifference = (showtime - now) / (1000 * 60 * 60);

      if (hoursDifference < 1) {
        throw new Error(
          "Reservations can only be cancelled at least 1 hour before showtime"
        );
      }

      // Cancel reservation
      const result = await client.query(
        `UPDATE reservations 
         SET status = 'cancelled', 
             cancelled_at = NOW()
         WHERE id = $1 
         AND user_id = $2
         AND status = 'active'
         RETURNING *`,
        [id, userId]
      );

      return this.findById(result.rows[0].id, client);
    });
  }

  static async getReservationsByShowtime(
    showtimeId,
    { status = "active" } = {}
  ) {
    if (!showtimeId) {
      throw new Error("Showtime ID is required");
    }

    const result = await db.query(
      `SELECT 
        r.id,
        r.status,
        r.created_at,
        u.id as user_id,
        u.email as user_email,
        st.row_number,
        st.seat_number,
        r.price as ticket_price
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      JOIN seats st ON r.seat_id = st.id
      WHERE r.showtime_id = $1
      AND r.status = $2
      ORDER BY st.row_number, st.seat_number`,
      [showtimeId, status]
    );

    return result.rows;
  }

  static async getReservationStats(userId) {
    if (!userId) {
      throw new Error("User ID is required");
    }

    const result = await db.query(
      `SELECT 
        COUNT(*) FILTER (WHERE r.status = 'active' AND sh.start_time > NOW()) as upcoming_reservations,
        COUNT(*) FILTER (WHERE r.status = 'active' AND sh.start_time <= NOW()) as past_reservations,
        COUNT(*) FILTER (WHERE r.status = 'cancelled') as cancelled_reservations,
        SUM(r.price) FILTER (WHERE r.status = 'active') as total_spent,
        array_agg(DISTINCT t.type) FILTER (WHERE r.status = 'active') as favorite_theater_types
      FROM reservations r
      JOIN showtimes sh ON r.showtime_id = sh.id
      JOIN theaters t ON sh.theater_id = t.id
      WHERE r.user_id = $1`,
      [userId]
    );

    return result.rows[0];
  }
}

module.exports = Reservation;
