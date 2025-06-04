const db = require("../config/database");

class Showtime {
  static validateShowtime({ movieId, theaterId, startTime, price }) {
    if (!movieId || typeof movieId !== "number") {
      throw new Error("Valid movie ID is required");
    }
    if (!theaterId || typeof theaterId !== "number") {
      throw new Error("Valid theater ID is required");
    }
    if (!startTime || isNaN(new Date(startTime).getTime())) {
      throw new Error("Valid start time is required");
    }
    if (!price || typeof price !== "number" || price <= 0) {
      throw new Error("Valid price is required");
    }

    // Ensure start time is in the future
    const now = new Date();
    const showtime = new Date(startTime);
    if (showtime <= now) {
      throw new Error("Start time must be in the future");
    }
  }

  static async create({ movieId, theaterId, startTime, price }) {
    this.validateShowtime({ movieId, theaterId, startTime, price });

    return db.transaction(async (client) => {
      // Verify movie exists
      const movieExists = await client.query(
        "SELECT id FROM movies WHERE id = $1",
        [movieId]
      );
      if (movieExists.rows.length === 0) {
        throw new Error("Movie not found");
      }

      // Verify theater exists
      const theaterExists = await client.query(
        "SELECT id FROM theaters WHERE id = $1",
        [theaterId]
      );
      if (theaterExists.rows.length === 0) {
        throw new Error("Theater not found");
      }

      // Check for scheduling conflicts
      const conflicts = await client.query(
        `SELECT id FROM showtimes 
         WHERE theater_id = $1 
         AND $2 < start_time + (
           SELECT duration * interval '1 minute' 
           FROM movies 
           WHERE id = movie_id
         )
         AND $2 + (
           SELECT duration * interval '1 minute' 
           FROM movies 
           WHERE id = $3
         ) > start_time`,
        [theaterId, startTime, movieId]
      );

      if (conflicts.rows.length > 0) {
        throw new Error("This time slot conflicts with another showtime");
      }

      // Create showtime
      const result = await client.query(
        `INSERT INTO showtimes (movie_id, theater_id, start_time, price)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [movieId, theaterId, startTime, price]
      );

      return this.findById(result.rows[0].id, client);
    });
  }

  static async findAll({
    limit = 50,
    offset = 0,
    startDate = new Date(),
    endDate = null,
    movieId = null,
    theaterId = null,
  } = {}) {
    const params = [startDate];
    let paramCount = 1;

    let query = `
      SELECT 
        s.*,
        m.title as movie_title,
        m.duration,
        m.poster_url,
        t.name as theater_name,
        t.type as theater_type,
        t.capacity,
        (
          SELECT COUNT(*)
          FROM reservations r
          WHERE r.showtime_id = s.id
          AND r.status = 'active'
        ) as booked_seats
      FROM showtimes s
      JOIN movies m ON s.movie_id = m.id
      JOIN theaters t ON s.theater_id = t.id
      WHERE s.start_time >= $1
    `;

    if (endDate) {
      paramCount++;
      query += ` AND s.start_time <= $${paramCount}`;
      params.push(endDate);
    }

    if (movieId) {
      paramCount++;
      query += ` AND s.movie_id = $${paramCount}`;
      params.push(movieId);
    }

    if (theaterId) {
      paramCount++;
      query += ` AND s.theater_id = $${paramCount}`;
      params.push(theaterId);
    }

    query += `
      ORDER BY s.start_time ASC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  }

  static async findById(id, client = db) {
    if (!id) {
      throw new Error("Showtime ID is required");
    }

    const result = await client.query(
      `SELECT 
        s.*,
        m.title as movie_title,
        m.duration,
        m.poster_url,
        t.name as theater_name,
        t.type as theater_type,
        t.capacity,
        (
          SELECT COUNT(*)
          FROM reservations r
          WHERE r.showtime_id = s.id
          AND r.status = 'active'
        ) as booked_seats
      FROM showtimes s
      JOIN movies m ON s.movie_id = m.id
      JOIN theaters t ON s.theater_id = t.id
      WHERE s.id = $1`,
      [id]
    );

    return result.rows[0];
  }

  static async getAvailableSeats(showtimeId) {
    if (!showtimeId) {
      throw new Error("Showtime ID is required");
    }

    return db.transaction(async (client) => {
      // Verify showtime exists and get theater info
      const showtime = await this.findById(showtimeId, client);
      if (!showtime) {
        throw new Error("Showtime not found");
      }

      const result = await client.query(
        `SELECT 
          s.id,
          s.row_number,
          s.seat_number,
          CASE WHEN r.id IS NULL THEN false ELSE true END as is_reserved
        FROM seats s
        JOIN theaters t ON s.theater_id = t.id
        JOIN showtimes st ON st.theater_id = t.id
        LEFT JOIN reservations r ON r.seat_id = s.id 
          AND r.showtime_id = st.id 
          AND r.status = 'active'
        WHERE st.id = $1
        ORDER BY s.row_number, s.seat_number`,
        [showtimeId]
      );

      return result.rows;
    });
  }

  static async isValidSeat(showtimeId, seatId) {
    if (!showtimeId || !seatId) {
      throw new Error("Showtime ID and seat ID are required");
    }

    const result = await db.query(
      `SELECT EXISTS (
        SELECT 1
        FROM seats s
        JOIN theaters t ON s.theater_id = t.id
        JOIN showtimes st ON st.theater_id = t.id
        WHERE st.id = $1 AND s.id = $2
        AND NOT EXISTS (
          SELECT 1
          FROM reservations r
          WHERE r.showtime_id = st.id
          AND r.seat_id = s.id
          AND r.status = 'active'
        )
      ) as is_valid`,
      [showtimeId, seatId]
    );

    return result.rows[0].is_valid;
  }

  static async update(id, { price, startTime }) {
    if (!id) {
      throw new Error("Showtime ID is required");
    }

    if (!price && !startTime) {
      throw new Error(
        "At least one field (price or startTime) must be provided"
      );
    }

    return db.transaction(async (client) => {
      // Get current showtime
      const current = await this.findById(id, client);
      if (!current) {
        throw new Error("Showtime not found");
      }

      // Validate new values
      const newPrice = price || current.price;
      const newStartTime = startTime || current.start_time;

      if (newPrice <= 0) {
        throw new Error("Valid price is required");
      }

      const now = new Date();
      const showtime = new Date(newStartTime);
      if (showtime <= now) {
        throw new Error("Start time must be in the future");
      }

      // Check for scheduling conflicts if start time is being changed
      if (startTime) {
        const conflicts = await client.query(
          `SELECT id FROM showtimes 
           WHERE theater_id = $1 
           AND id != $2
           AND $3 < start_time + (
             SELECT duration * interval '1 minute' 
             FROM movies 
             WHERE id = movie_id
           )
           AND $3 + (
             SELECT duration * interval '1 minute' 
             FROM movies 
             WHERE id = $4
           ) > start_time`,
          [current.theater_id, id, newStartTime, current.movie_id]
        );

        if (conflicts.rows.length > 0) {
          throw new Error("This time slot conflicts with another showtime");
        }
      }

      // Update showtime
      const result = await client.query(
        `UPDATE showtimes 
         SET price = $1, start_time = $2
         WHERE id = $3
         RETURNING *`,
        [newPrice, newStartTime, id]
      );

      return this.findById(id, client);
    });
  }

  static async delete(id) {
    if (!id) {
      throw new Error("Showtime ID is required");
    }

    return db.transaction(async (client) => {
      // Check if showtime exists
      const showtime = await this.findById(id, client);
      if (!showtime) {
        throw new Error("Showtime not found");
      }

      // Check if there are any active reservations
      const reservations = await client.query(
        `SELECT COUNT(*) as count
         FROM reservations
         WHERE showtime_id = $1
         AND status = 'active'`,
        [id]
      );

      if (reservations.rows[0].count > 0) {
        throw new Error("Cannot delete showtime with active reservations");
      }

      // Delete showtime
      await client.query("DELETE FROM showtimes WHERE id = $1", [id]);

      return { id, message: "Showtime deleted successfully" };
    });
  }
}

module.exports = Showtime;
