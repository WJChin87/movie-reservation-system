const express = require("express");
const router = express.Router();
const { auth, admin } = require("../middleware/auth");
const Showtime = require("../models/Showtime");

// Get all showtimes with filtering and pagination
router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      movieId,
      theaterId,
      startDate,
      endDate,
    } = req.query;

    const showtimes = await Showtime.findAll({
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      movieId: movieId ? parseInt(movieId) : null,
      theaterId: theaterId ? parseInt(theaterId) : null,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
    });

    res.json({
      showtimes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    console.error("Error fetching showtimes:", err);
    res.status(500).json({
      message: "Error fetching showtimes",
      error: err.message,
    });
  }
});

// Get showtime by ID
router.get("/:id", async (req, res) => {
  try {
    const showtime = await Showtime.findById(req.params.id);

    if (!showtime) {
      return res.status(404).json({ message: "Showtime not found" });
    }

    res.json(showtime);
  } catch (err) {
    console.error("Error fetching showtime:", err);
    res.status(500).json({
      message: "Error fetching showtime",
      error: err.message,
    });
  }
});

// Create showtime (Admin only)
router.post("/", [auth, admin], async (req, res) => {
  try {
    const { movie_id, theater_id, start_time, price } = req.body;

    const showtime = await Showtime.create({
      movieId: parseInt(movie_id),
      theaterId: parseInt(theater_id),
      startTime: new Date(start_time),
      price: parseFloat(price),
    });

    res.status(201).json(showtime);
  } catch (err) {
    console.error("Error creating showtime:", err);

    if (
      err.message.includes("required") ||
      err.message.includes("valid") ||
      err.message.includes("conflicts")
    ) {
      return res.status(400).json({
        message: "Validation error",
        error: err.message,
      });
    }

    if (err.message.includes("not found")) {
      return res.status(404).json({
        message: err.message,
      });
    }

    res.status(500).json({
      message: "Error creating showtime",
      error: err.message,
    });
  }
});

// Update showtime (Admin only)
router.put("/:id", [auth, admin], async (req, res) => {
  try {
    const { start_time, price } = req.body;

    const showtime = await Showtime.update(req.params.id, {
      startTime: start_time ? new Date(start_time) : undefined,
      price: price ? parseFloat(price) : undefined,
    });

    res.json(showtime);
  } catch (err) {
    console.error("Error updating showtime:", err);

    if (err.message === "Showtime not found") {
      return res.status(404).json({ message: err.message });
    }

    if (
      err.message.includes("required") ||
      err.message.includes("valid") ||
      err.message.includes("conflicts")
    ) {
      return res.status(400).json({
        message: "Validation error",
        error: err.message,
      });
    }

    res.status(500).json({
      message: "Error updating showtime",
      error: err.message,
    });
  }
});

// Delete showtime (Admin only)
router.delete("/:id", [auth, admin], async (req, res) => {
  try {
    const result = await Showtime.delete(req.params.id);
    res.json(result);
  } catch (err) {
    console.error("Error deleting showtime:", err);

    if (err.message === "Showtime not found") {
      return res.status(404).json({ message: err.message });
    }

    if (err.message.includes("active reservations")) {
      return res.status(400).json({
        message: err.message,
      });
    }

    res.status(500).json({
      message: "Error deleting showtime",
      error: err.message,
    });
  }
});

// Add multiple showtimes (Admin only)
router.post("/batch", [auth, admin], async (req, res) => {
  try {
    const { movie_id, theater_id, dates, times, price } = req.body;

    // Validate input
    if (
      !Array.isArray(dates) ||
      !Array.isArray(times) ||
      dates.length === 0 ||
      times.length === 0
    ) {
      return res.status(400).json({
        message: "Validation error",
        error: "dates and times must be non-empty arrays",
      });
    }

    const results = [];
    for (const date of dates) {
      for (const time of times) {
        const [hours, minutes] = time.split(":");
        const start_time = new Date(date);
        start_time.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        try {
          const showtime = await Showtime.create({
            movieId: parseInt(movie_id),
            theaterId: parseInt(theater_id),
            startTime: start_time,
            price: parseFloat(price),
          });
          results.push(showtime);
        } catch (err) {
          // Log error but continue with other times
          console.error(`Error creating showtime for ${date} ${time}:`, err);
        }
      }
    }

    if (results.length === 0) {
      return res.status(400).json({
        message: "No showtimes were created",
        error: "All showtime creation attempts failed",
      });
    }

    res.status(201).json({
      message: `Successfully created ${results.length} showtimes`,
      showtimes: results,
    });
  } catch (err) {
    console.error("Error creating batch showtimes:", err);
    res.status(500).json({
      message: "Error creating batch showtimes",
      error: err.message,
    });
  }
});

// Get seats for a showtime
router.get("/:id/seats", async (req, res) => {
  try {
    const seats = await Showtime.getAvailableSeats(req.params.id);
    res.json(seats);
  } catch (err) {
    console.error("Error fetching seats:", err);

    if (err.message === "Showtime not found") {
      return res.status(404).json({ message: err.message });
    }

    res.status(500).json({
      message: "Error fetching seats",
      error: err.message,
    });
  }
});

// Validate seat for a showtime
router.get("/:id/seats/:seatId/validate", async (req, res) => {
  try {
    const isValid = await Showtime.isValidSeat(
      req.params.id,
      req.params.seatId
    );
    res.json({ isValid });
  } catch (err) {
    console.error("Error validating seat:", err);

    if (err.message.includes("required")) {
      return res.status(400).json({
        message: "Validation error",
        error: err.message,
      });
    }

    res.status(500).json({
      message: "Error validating seat",
      error: err.message,
    });
  }
});

module.exports = router;
