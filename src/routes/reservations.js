const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const Reservation = require("../models/Reservation");

// Get user's reservations with filtering and pagination
router.get("/", [auth], async (req, res) => {
  try {
    const { status, upcoming = false, page = 1, limit = 10 } = req.query;

    const reservations = await Reservation.findByUser(req.user.id, {
      status,
      upcoming: upcoming === "true",
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    // Get user's reservation stats
    const stats = await Reservation.getReservationStats(req.user.id);

    res.json({
      reservations,
      stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    console.error("Error fetching reservations:", err);
    res.status(500).json({
      message: "Error fetching reservations",
      error: err.message,
    });
  }
});

// Get reservation by ID
router.get("/:id", [auth], async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({ message: "Reservation not found" });
    }

    // Check if the reservation belongs to the user
    if (reservation.user_id !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Not authorized to view this reservation" });
    }

    res.json(reservation);
  } catch (err) {
    console.error("Error fetching reservation:", err);
    res.status(500).json({
      message: "Error fetching reservation",
      error: err.message,
    });
  }
});

// Create reservations
router.post("/", [auth], async (req, res) => {
  try {
    const { showtime_id, seat_ids } = req.body;

    // Validate input
    if (!showtime_id || !Array.isArray(seat_ids) || seat_ids.length === 0) {
      return res.status(400).json({
        message: "Validation error",
        error: "Showtime ID and at least one seat ID are required",
      });
    }

    if (seat_ids.length > 5) {
      return res.status(400).json({
        message: "Validation error",
        error: "Maximum 5 seats can be reserved at once",
      });
    }

    // Create reservation with all seats
    try {
      const reservation = await Reservation.create({
        userId: req.user.id,
        showtimeId: parseInt(showtime_id),
        seatIds: seat_ids.map((id) => parseInt(id)),
      });

      res.status(201).json({
        message: "Reservation created successfully",
        reservation,
      });
    } catch (err) {
      if (err.message.includes("not available")) {
        return res.status(400).json({
          message: "Seat reservation error",
          error: err.message,
        });
      }
      throw err;
    }
  } catch (err) {
    console.error("Error creating reservation:", err);
    res.status(500).json({
      message: "Error creating reservation",
      error: err.message,
    });
  }
});

// Cancel reservation
router.delete("/:id", [auth], async (req, res) => {
  try {
    const reservation = await Reservation.cancel(req.params.id, req.user.id);
    res.json({
      message: "Reservation cancelled successfully",
      reservation,
    });
  } catch (err) {
    console.error("Error cancelling reservation:", err);

    if (err.message === "Reservation not found") {
      return res.status(404).json({ message: err.message });
    }

    if (
      err.message.includes("already cancelled") ||
      err.message.includes("1 hour before")
    ) {
      return res.status(400).json({
        message: err.message,
      });
    }

    res.status(500).json({
      message: "Error cancelling reservation",
      error: err.message,
    });
  }
});

// Get reservations by showtime (Admin only)
router.get("/showtime/:showtimeId", [auth], async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Not authorized to view showtime reservations" });
    }

    const { status = "active" } = req.query;
    const reservations = await Reservation.getReservationsByShowtime(
      req.params.showtimeId,
      { status }
    );

    res.json(reservations);
  } catch (err) {
    console.error("Error fetching showtime reservations:", err);

    if (err.message === "Showtime ID is required") {
      return res.status(400).json({
        message: err.message,
      });
    }

    res.status(500).json({
      message: "Error fetching showtime reservations",
      error: err.message,
    });
  }
});

// Get user's reservation statistics
router.get("/stats/summary", [auth], async (req, res) => {
  try {
    const stats = await Reservation.getReservationStats(req.user.id);
    res.json(stats);
  } catch (err) {
    console.error("Error fetching reservation stats:", err);
    res.status(500).json({
      message: "Error fetching reservation statistics",
      error: err.message,
    });
  }
});

module.exports = router;
