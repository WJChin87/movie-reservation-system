const express = require("express");
const router = express.Router();
const { auth, admin } = require("../middleware/auth");
const Movie = require("../models/Movie");

// Get all movies with pagination and filtering
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10, genre } = req.query;
    const offset = (page - 1) * limit;

    const movies = await Movie.findAll({
      limit: parseInt(limit),
      offset: parseInt(offset),
      genre: genre,
    });

    res.json({
      movies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
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
    const movie = await Movie.findById(req.params.id);

    if (!movie) {
      return res.status(404).json({ message: "Movie not found" });
    }

    res.json(movie);
  } catch (err) {
    console.error("Error fetching movie:", err);
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

    if (err.message.includes("required") || err.message.includes("valid")) {
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
    const {
      title,
      description,
      duration,
      rating,
      poster_url: posterUrl,
      genres,
    } = req.body;

    const movie = await Movie.update(req.params.id, {
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

    if (err.message.includes("required") || err.message.includes("valid")) {
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
    await Movie.delete(req.params.id);
    res.json({ message: "Movie deleted successfully" });
  } catch (err) {
    console.error("Error deleting movie:", err);

    if (err.message === "Movie not found") {
      return res.status(404).json({ message: err.message });
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
    const { genres } = req.body;

    if (!Array.isArray(genres) || genres.length === 0) {
      return res.status(400).json({
        message: "Validation error",
        error: "genres must be a non-empty array of genre IDs",
      });
    }

    const movie = await Movie.addGenres(req.params.id, genres);
    res.json(movie);
  } catch (err) {
    console.error("Error adding genres:", err);

    if (err.message === "Movie not found") {
      return res.status(404).json({ message: err.message });
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
    const { genres } = req.body;

    if (!Array.isArray(genres) || genres.length === 0) {
      return res.status(400).json({
        message: "Validation error",
        error: "genres must be a non-empty array of genre IDs",
      });
    }

    const movie = await Movie.removeGenres(req.params.id, genres);
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
