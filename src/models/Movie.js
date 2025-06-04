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
        // Verify all genres exist
        const existingGenres = await client.query(
          "SELECT id FROM genres WHERE id = ANY($1)",
          [genres]
        );

        if (existingGenres.rows.length !== genres.length) {
          throw new Error("One or more invalid genre IDs provided");
        }

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
    try {
      // Build the query based on whether we're filtering by genre
      const baseQuery = `
        WITH movie_data AS (
          SELECT 
            m.*,
            COUNT(*) OVER() as total_count
          FROM movies m
          ${
            genre
              ? `
            JOIN movie_genres mg ON m.id = mg.movie_id
            JOIN genres g ON mg.genre_id = g.id
            WHERE LOWER(g.name) = LOWER($1)
          `
              : ""
          }
          GROUP BY m.id
          ORDER BY m.created_at DESC
          LIMIT $${genre ? "2" : "1"} 
          OFFSET $${genre ? "3" : "2"}
        )
        SELECT 
          m.*,
          m.total_count::integer,
          COALESCE(
            json_agg(
              json_build_object(
                'id', g.id,
                'name', g.name
              )
            ) FILTER (WHERE g.id IS NOT NULL),
            '[]'
          ) as genres
        FROM movie_data m
        LEFT JOIN movie_genres mg ON m.id = mg.movie_id
        LEFT JOIN genres g ON mg.genre_id = g.id
        GROUP BY m.id, m.title, m.description, m.duration, m.rating, 
                 m.poster_url, m.created_at, m.total_count
        ORDER BY m.created_at DESC
      `;

      const params = genre ? [genre, limit, offset] : [limit, offset];
      const result = await db.query(baseQuery, params);

      const totalCount = result.rows[0]?.total_count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      return {
        movies: result.rows.map((row) => {
          const { total_count, ...movie } = row;
          return movie;
        }),
        pagination: {
          total: totalCount,
          pages: totalPages,
          current_page: Math.floor(offset / limit) + 1,
          per_page: limit,
        },
      };
    } catch (error) {
      console.error("Error in findAll:", error);
      throw new Error("Error fetching movies: " + error.message);
    }
  }

  static async findById(id, client = db) {
    if (!id) {
      throw new Error("Movie ID is required");
    }

    try {
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

      if (result.rows.length === 0) {
        throw new Error("Movie not found");
      }

      return result.rows[0];
    } catch (error) {
      console.error("Error in findById:", error);
      throw error.message === "Movie not found"
        ? error
        : new Error("Error fetching movie: " + error.message);
    }
  }

  static async update(id, { title, description, duration, posterUrl, genres }) {
    if (!id) {
      throw new Error("Movie ID is required");
    }

    this.validateMovie({ title, description, duration });

    return db.transaction(async (client) => {
      // Check if movie exists
      const exists = await client.query("SELECT id FROM movies WHERE id = $1", [
        id,
      ]);

      if (exists.rows.length === 0) {
        throw new Error("Movie not found");
      }

      // Update movie
      const result = await client.query(
        `UPDATE movies 
         SET title = $1, description = $2, duration = $3, poster_url = $4 
         WHERE id = $5 
         RETURNING *`,
        [title, description, duration, posterUrl, id]
      );

      // Update genres if provided
      if (genres) {
        // Verify all genres exist
        if (genres.length > 0) {
          const existingGenres = await client.query(
            "SELECT id FROM genres WHERE id = ANY($1)",
            [genres]
          );

          if (existingGenres.rows.length !== genres.length) {
            throw new Error("One or more invalid genre IDs provided");
          }
        }

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
      // Check if movie exists
      const exists = await client.query("SELECT id FROM movies WHERE id = $1", [
        id,
      ]);

      if (exists.rows.length === 0) {
        throw new Error("Movie not found");
      }

      // Check if movie has any showtimes
      const showtimes = await client.query(
        "SELECT id FROM showtimes WHERE movie_id = $1 LIMIT 1",
        [id]
      );

      if (showtimes.rows.length > 0) {
        throw new Error("Cannot delete movie with existing showtimes");
      }

      // Delete movie (cascade will handle related records)
      await client.query("DELETE FROM movies WHERE id = $1", [id]);

      return { id, message: "Movie deleted successfully" };
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

      // Verify all genres exist
      const existingGenres = await client.query(
        "SELECT id FROM genres WHERE id = ANY($1)",
        [genreIds]
      );

      if (existingGenres.rows.length !== genreIds.length) {
        throw new Error("One or more invalid genre IDs provided");
      }

      // Add new genres
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

    return db.transaction(async (client) => {
      // Verify movie exists
      const movieExists = await client.query(
        "SELECT id FROM movies WHERE id = $1",
        [movieId]
      );

      if (movieExists.rows.length === 0) {
        throw new Error("Movie not found");
      }

      // Remove genres
      await client.query(
        `DELETE FROM movie_genres 
         WHERE movie_id = $1 AND genre_id = ANY($2)`,
        [movieId, genreIds]
      );

      return this.findById(movieId, client);
    });
  }
}

module.exports = Movie;
