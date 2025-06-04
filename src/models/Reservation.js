const db = require("../config/database");
const Showtime = require("./Showtime");
const Seat = require("./Seat");

class Reservation {
  static validateReservation({ userId, showtimeId, seatIds }) {
    if (!userId || typeof userId !== "number") {
      throw new Error("Valid user ID is required");
    }
    if (!showtimeId || typeof showtimeId !== "number") {
      throw new Error("Valid showtime ID is required");
    }
    if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
      throw new Error("Valid seat IDs are required");
    }
  }

  static async create({ userId, showtimeId, seatIds }) {
    this.validateReservation({ userId, showtimeId, seatIds });

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

      // Validate seats availability
      const seatsValid = await Seat.validateSeats(showtimeId, seatIds);
      if (!seatsValid) {
        throw new Error("One or more selected seats are not available");
      }

      // Get showtime details for price calculation
      const price = showtime.rows[0].price;

      // Create a reservation for each seat
      const reservations = [];
      for (const seatId of seatIds) {
        const reservationQuery = `
          INSERT INTO reservations (user_id, showtime_id, seat_id, price, status)
          VALUES ($1, $2, $3, $4, 'active')
          RETURNING *
        `;
        const result = await client.query(reservationQuery, [
          userId,
          showtimeId,
          seatId,
          price,
        ]);
        reservations.push(result.rows[0]);
      }

      // Return complete reservation data
      const result = await client.query(
        `SELECT 
          r.*,
          m.title as movie_title,
          m.poster_url as movie_poster_url,
          t.name as theater_name,
          t.type as theater_type,
          s.start_time,
          s.price as ticket_price,
          st.row_number,
          st.seat_number
        FROM reservations r
        JOIN showtimes s ON r.showtime_id = s.id
        JOIN movies m ON s.movie_id = m.id
        JOIN theaters t ON s.theater_id = t.id
        JOIN seats st ON r.seat_id = st.id
        WHERE r.id = ANY($1::int[])
        ORDER BY st.row_number, st.seat_number`,
        [reservations.map((r) => r.id)]
      );

      return {
        reservations: result.rows,
        totalPrice: price * seatIds.length,
      };
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
        r.*,
        m.title as movie_title,
        m.poster_url,
        t.name as theater_name,
        t.type as theater_type,
        s.start_time,
        s.price as ticket_price,
        st.row_number,
        st.seat_number,
        CASE 
          WHEN s.start_time > NOW() THEN true 
          ELSE false 
        END as is_upcoming
      FROM reservations r
      JOIN showtimes s ON r.showtime_id = s.id
      JOIN movies m ON s.movie_id = m.id
      JOIN theaters t ON s.theater_id = t.id
      JOIN seats st ON r.seat_id = st.id
      WHERE r.user_id = $1
    `;

    if (status) {
      paramCount++;
      query += ` AND r.status = $${paramCount}`;
      params.push(status);
    }

    if (upcoming) {
      query += ` AND s.start_time > NOW()`;
    }

    query += ` ORDER BY s.start_time DESC`;

    const result = await db.query(query, params);
    return result.rows;
  }

  static async findById(id) {
    const query = `
      SELECT 
        r.*,
        m.title as movie_title,
        m.poster_url as movie_poster_url,
        t.name as theater_name,
        t.type as theater_type,
        s.start_time,
        s.price as ticket_price,
        st.row_number,
        st.seat_number
      FROM reservations r
      JOIN showtimes s ON r.showtime_id = s.id
      JOIN movies m ON s.movie_id = m.id
      JOIN theaters t ON s.theater_id = t.id
      JOIN seats st ON r.seat_id = st.id
      WHERE r.id = $1
    `;
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  static async cancel(id) {
    if (!id) {
      throw new Error("Reservation ID is required");
    }

    const query = `
      UPDATE reservations 
      SET status = 'cancelled', 
          cancelled_at = CURRENT_TIMESTAMP 
      WHERE id = $1 
      AND status = 'active'
      RETURNING *
    `;

    const result = await db.query(query, [id]);
    return result.rows[0];
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
