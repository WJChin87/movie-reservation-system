const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { auth, admin } = require("../middleware/auth");

// Get all movies
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, array_agg(g.name) as genres
      FROM movies m
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
      GROUP BY m.id
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching movies" });
  }
});

// Get movie by ID
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT m.*, array_agg(g.name) as genres
      FROM movies m
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
      WHERE m.id = $1
      GROUP BY m.id
    `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Movie not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching movie" });
  }
});

// Create movie (Admin only)
router.post("/", [auth, admin], async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { title, description, duration, rating, poster_url, genres } =
      req.body;

    // Insert movie
    const movieResult = await client.query(
      `INSERT INTO movies (title, description, duration, rating, poster_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [title, description, duration, rating, poster_url]
    );

    const movieId = movieResult.rows[0].id;

    // Insert genres
    if (genres && genres.length > 0) {
      const genreValues = genres.map((genre) => `('${genre}')`).join(",");
      await client.query(`
        INSERT INTO genres (name)
        VALUES ${genreValues}
        ON CONFLICT (name) DO NOTHING
      `);

      const genreIds = await client.query(
        `SELECT id FROM genres WHERE name = ANY($1)`,
        [genres]
      );

      for (const row of genreIds.rows) {
        await client.query(
          `INSERT INTO movie_genres (movie_id, genre_id)
           VALUES ($1, $2)`,
          [movieId, row.id]
        );
      }
    }

    await client.query("COMMIT");
    res.status(201).json({ id: movieId });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: "Error creating movie" });
  } finally {
    client.release();
  }
});

// Update movie (Admin only)
router.put("/:id", [auth, admin], async (req, res) => {
  try {
    const { title, description, duration, rating, poster_url } = req.body;

    const result = await pool.query(
      `UPDATE movies
       SET title = $1, description = $2, duration = $3, rating = $4, poster_url = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [title, description, duration, rating, poster_url, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Movie not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating movie" });
  }
});

// Delete movie (Admin only)
router.delete("/:id", [auth, admin], async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM movies WHERE id = $1 RETURNING *",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Movie not found" });
    }

    res.json({ message: "Movie deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting movie" });
  }
});

module.exports = router;
