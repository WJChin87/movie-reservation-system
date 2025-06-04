const db = require("../config/database");

class Movie {
  static validateMovie({ title, description, duration }) {
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      throw new Error("Valid title is required");
    }
    if (!description || typeof description !== "string") {
      throw new Error("Valid description is required");
    }
    if (!duration || typeof duration !== "number" || duration <= 0) {
      throw new Error("Valid duration (in minutes) is required");
    }
  }

  static async create({
    title,
    description,
    duration,
    posterUrl,
    genres = [],
  }) {
    this.validateMovie({ title, description, duration });

    return db.transaction(async (client) => {
      // Insert movie
      const result = await client.query(
        "INSERT INTO movies (title, description, duration, poster_url) VALUES ($1, $2, $3, $4) RETURNING *",
        [title, description, duration, posterUrl]
      );

      const movie = result.rows[0];

      // Add genres if provided
      if (genres.length > 0) {
        const genreValues = genres
          .map((genreId, index) => `($${index * 2 + 1}, $${index * 2 + 2})`)
          .join(", ");

        const genreParams = genres.reduce(
          (params, genreId) => [...params, movie.id, genreId],
          []
        );

        await client.query(
          `INSERT INTO movie_genres (movie_id, genre_id) VALUES ${genreValues}`,
          genreParams
        );
      }

      return this.findById(movie.id, client);
    });
  }

  static async findAll({ limit = 50, offset = 0, genre = null } = {}) {
    let query = `
      SELECT 
        m.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', g.id,
              'name', g.name
            )
          ) FILTER (WHERE g.id IS NOT NULL),
          '[]'
        ) as genres
      FROM movies m
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
    `;

    const params = [];
    if (genre) {
      query += " WHERE g.name = $1";
      params.push(genre);
    }

    query += `
      GROUP BY m.id
      ORDER BY m.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  }

  static async findById(id, client = db) {
    if (!id) {
      throw new Error("Movie ID is required");
    }

    const result = await client.query(
      `SELECT 
        m.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', g.id,
              'name', g.name
            )
          ) FILTER (WHERE g.id IS NOT NULL),
          '[]'
        ) as genres
      FROM movies m
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
      WHERE m.id = $1
      GROUP BY m.id`,
      [id]
    );

    return result.rows[0];
  }

  static async update(id, { title, description, duration, posterUrl, genres }) {
    if (!id) {
      throw new Error("Movie ID is required");
    }

    this.validateMovie({ title, description, duration });

    return db.transaction(async (client) => {
      // Update movie
      const result = await client.query(
        `UPDATE movies 
         SET title = $1, description = $2, duration = $3, poster_url = $4 
         WHERE id = $5 
         RETURNING *`,
        [title, description, duration, posterUrl, id]
      );

      if (result.rows.length === 0) {
        throw new Error("Movie not found");
      }

      // Update genres if provided
      if (genres) {
        // Remove existing genres
        await client.query("DELETE FROM movie_genres WHERE movie_id = $1", [
          id,
        ]);

        // Add new genres
        if (genres.length > 0) {
          const genreValues = genres
            .map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2})`)
            .join(", ");

          const genreParams = genres.reduce(
            (params, genreId) => [...params, id, genreId],
            []
          );

          await client.query(
            `INSERT INTO movie_genres (movie_id, genre_id) VALUES ${genreValues}`,
            genreParams
          );
        }
      }

      return this.findById(id, client);
    });
  }

  static async delete(id) {
    if (!id) {
      throw new Error("Movie ID is required");
    }

    return db.transaction(async (client) => {
      // Delete movie (cascade will handle related records)
      const result = await client.query(
        "DELETE FROM movies WHERE id = $1 RETURNING id",
        [id]
      );

      if (result.rows.length === 0) {
        throw new Error("Movie not found");
      }

      return { id: result.rows[0].id };
    });
  }

  static async addGenres(movieId, genreIds) {
    if (!movieId || !Array.isArray(genreIds) || genreIds.length === 0) {
      throw new Error("Movie ID and at least one genre ID are required");
    }

    return db.transaction(async (client) => {
      // Verify movie exists
      const movieExists = await client.query(
        "SELECT id FROM movies WHERE id = $1",
        [movieId]
      );

      if (movieExists.rows.length === 0) {
        throw new Error("Movie not found");
      }

      // Add genres
      const genreValues = genreIds
        .map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2})`)
        .join(", ");

      const genreParams = genreIds.reduce(
        (params, genreId) => [...params, movieId, genreId],
        []
      );

      await client.query(
        `INSERT INTO movie_genres (movie_id, genre_id) 
         VALUES ${genreValues}
         ON CONFLICT (movie_id, genre_id) DO NOTHING`,
        genreParams
      );

      return this.findById(movieId, client);
    });
  }

  static async removeGenres(movieId, genreIds) {
    if (!movieId || !Array.isArray(genreIds) || genreIds.length === 0) {
      throw new Error("Movie ID and at least one genre ID are required");
    }

    const placeholders = genreIds.map((_, i) => `$${i + 2}`).join(", ");

    const result = await db.query(
      `DELETE FROM movie_genres 
       WHERE movie_id = $1 
       AND genre_id IN (${placeholders})`,
      [movieId, ...genreIds]
    );

    return this.findById(movieId);
  }
}

module.exports = Movie;
