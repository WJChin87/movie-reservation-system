const db = require("../config/database");

class Movie {
  static async create({ title, description, duration, posterUrl }) {
    const [result] = await db.execute(
      "INSERT INTO movies (title, description, duration, poster_url) VALUES (?, ?, ?, ?)",
      [title, description, duration, posterUrl]
    );
    return result.insertId;
  }

  static async findAll() {
    const [rows] = await db.execute(`
      SELECT m.*, GROUP_CONCAT(g.name) as genres
      FROM movies m
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
      GROUP BY m.id
    `);
    return rows;
  }

  static async findById(id) {
    const [rows] = await db.execute(
      `
      SELECT m.*, GROUP_CONCAT(g.name) as genres
      FROM movies m
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
      WHERE m.id = ?
      GROUP BY m.id
    `,
      [id]
    );
    return rows[0];
  }

  static async update(id, { title, description, duration, posterUrl }) {
    const [result] = await db.execute(
      "UPDATE movies SET title = ?, description = ?, duration = ?, poster_url = ? WHERE id = ?",
      [title, description, duration, posterUrl, id]
    );
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await db.execute("DELETE FROM movies WHERE id = ?", [id]);
    return result.affectedRows > 0;
  }

  static async addGenre(movieId, genreId) {
    await db.execute(
      "INSERT INTO movie_genres (movie_id, genre_id) VALUES (?, ?)",
      [movieId, genreId]
    );
  }

  static async removeGenre(movieId, genreId) {
    await db.execute(
      "DELETE FROM movie_genres WHERE movie_id = ? AND genre_id = ?",
      [movieId, genreId]
    );
  }
}

module.exports = Movie;
