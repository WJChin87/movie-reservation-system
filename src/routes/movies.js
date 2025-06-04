const express = require("express");
const router = express.Router();
const { auth, admin } = require("../middleware/auth");
const Movie = require("../models/Movie");

// Get all movies with pagination and filtering
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10, genre } = req.query;

    // Validate pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        message: "Invalid page number. Must be a positive integer.",
      });
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      return res.status(400).json({
        message: "Invalid limit. Must be a positive integer between 1 and 50.",
      });
    }

    const offset = (pageNum - 1) * limitNum;
    const result = await Movie.findAll({
      limit: limitNum,
      offset,
      genre: genre,
    });

    res.json(result);
  } catch (err) {
    console.error("Error fetching movies:", err);
    res.status(500).json({
      message: "Error fetching movies",
      error: err.message,
    });
  }
});

// Get movie by ID
router.get("/:id", async (req, res) => {
  try {
    const movieId = parseInt(req.params.id);

    if (isNaN(movieId) || movieId < 1) {
      return res.status(400).json({
        message: "Invalid movie ID. Must be a positive integer.",
      });
    }

    const movie = await Movie.findById(movieId);
    res.json(movie);
  } catch (err) {
    console.error("Error fetching movie:", err);

    if (err.message === "Movie not found") {
      return res.status(404).json({ message: err.message });
    }

    res.status(500).json({
      message: "Error fetching movie",
      error: err.message,
    });
  }
});

// Create movie (Admin only)
router.post("/", [auth, admin], async (req, res) => {
  try {
    const {
      title,
      description,
      duration,
      rating,
      poster_url: posterUrl,
      genres,
    } = req.body;

    // Additional validation
    if (!Array.isArray(genres)) {
      return res.status(400).json({
        message: "Genres must be an array of genre IDs",
      });
    }

    const movie = await Movie.create({
      title,
      description,
      duration: parseInt(duration),
      posterUrl,
      genres,
    });

    res.status(201).json(movie);
  } catch (err) {
    console.error("Error creating movie:", err);

    if (
      err.message.includes("required") ||
      err.message.includes("valid") ||
      err.message.includes("invalid")
    ) {
      return res.status(400).json({
        message: "Validation error",
        error: err.message,
      });
    }

    res.status(500).json({
      message: "Error creating movie",
      error: err.message,
    });
  }
});

// Update movie (Admin only)
router.put("/:id", [auth, admin], async (req, res) => {
  try {
    const movieId = parseInt(req.params.id);

    if (isNaN(movieId) || movieId < 1) {
      return res.status(400).json({
        message: "Invalid movie ID. Must be a positive integer.",
      });
    }

    const {
      title,
      description,
      duration,
      rating,
      poster_url: posterUrl,
      genres,
    } = req.body;

    // Additional validation
    if (genres !== undefined && !Array.isArray(genres)) {
      return res.status(400).json({
        message: "Genres must be an array of genre IDs",
      });
    }

    const movie = await Movie.update(movieId, {
      title,
      description,
      duration: parseInt(duration),
      posterUrl,
      genres,
    });

    res.json(movie);
  } catch (err) {
    console.error("Error updating movie:", err);

    if (err.message === "Movie not found") {
      return res.status(404).json({ message: err.message });
    }

    if (
      err.message.includes("required") ||
      err.message.includes("valid") ||
      err.message.includes("invalid")
    ) {
      return res.status(400).json({
        message: "Validation error",
        error: err.message,
      });
    }

    res.status(500).json({
      message: "Error updating movie",
      error: err.message,
    });
  }
});

// Delete movie (Admin only)
router.delete("/:id", [auth, admin], async (req, res) => {
  try {
    const movieId = parseInt(req.params.id);

    if (isNaN(movieId) || movieId < 1) {
      return res.status(400).json({
        message: "Invalid movie ID. Must be a positive integer.",
      });
    }

    const result = await Movie.delete(movieId);
    res.json(result);
  } catch (err) {
    console.error("Error deleting movie:", err);

    if (err.message === "Movie not found") {
      return res.status(404).json({ message: err.message });
    }

    if (err.message.includes("existing showtimes")) {
      return res.status(400).json({ message: err.message });
    }

    res.status(500).json({
      message: "Error deleting movie",
      error: err.message,
    });
  }
});

// Add genres to a movie (Admin only)
router.post("/:id/genres", [auth, admin], async (req, res) => {
  try {
    const movieId = parseInt(req.params.id);

    if (isNaN(movieId) || movieId < 1) {
      return res.status(400).json({
        message: "Invalid movie ID. Must be a positive integer.",
      });
    }

    const { genres } = req.body;

    if (!Array.isArray(genres) || genres.length === 0) {
      return res.status(400).json({
        message: "genres must be a non-empty array of genre IDs",
      });
    }

    const movie = await Movie.addGenres(movieId, genres);
    res.json(movie);
  } catch (err) {
    console.error("Error adding genres:", err);

    if (err.message === "Movie not found") {
      return res.status(404).json({ message: err.message });
    }

    if (err.message.includes("invalid genre")) {
      return res.status(400).json({ message: err.message });
    }

    res.status(500).json({
      message: "Error adding genres to movie",
      error: err.message,
    });
  }
});

// Remove genres from a movie (Admin only)
router.delete("/:id/genres", [auth, admin], async (req, res) => {
  try {
    const movieId = parseInt(req.params.id);

    if (isNaN(movieId) || movieId < 1) {
      return res.status(400).json({
        message: "Invalid movie ID. Must be a positive integer.",
      });
    }

    const { genres } = req.body;

    if (!Array.isArray(genres) || genres.length === 0) {
      return res.status(400).json({
        message: "genres must be a non-empty array of genre IDs",
      });
    }

    const movie = await Movie.removeGenres(movieId, genres);
    res.json(movie);
  } catch (err) {
    console.error("Error removing genres:", err);

    if (err.message === "Movie not found") {
      return res.status(404).json({ message: err.message });
    }

    res.status(500).json({
      message: "Error removing genres from movie",
      error: err.message,
    });
  }
});

module.exports = router;
