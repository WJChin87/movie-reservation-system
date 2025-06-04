const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Register
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Create user using User model (which includes validation)
    const user = await User.create({ email, password });

    // Create token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(201).json({
      token,
      user,
    });
  } catch (err) {
    console.error("Registration error:", err);

    // Return specific error messages for known errors
    if (
      err.message.includes("already exists") ||
      err.message.includes("required") ||
      err.message.includes("characters long")
    ) {
      return res.status(400).json({ message: err.message });
    }

    res.status(500).json({ message: "Error registering user" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Verify password
    const validPassword = await User.comparePassword(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Create token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // Remove password from user object
    delete user.password;

    res.json({
      token,
      user,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Error logging in" });
  }
});

// Get current user profile
router.get("/profile", [auth], async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error("Error fetching profile:", err);
    res.status(500).json({
      message: "Error fetching profile",
      error: err.message,
    });
  }
});

// Update user profile
router.put("/profile", [auth], async (req, res) => {
  try {
    const { name, email, currentPassword, newPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({
        message: "Validation error",
        error: "Current password is required",
      });
    }

    const updatedUser = await User.updateProfile(req.user.id, {
      name,
      email,
      currentPassword,
      newPassword,
    });

    res.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error("Error updating profile:", err);

    if (
      err.message.includes("required") ||
      err.message.includes("must") ||
      err.message.includes("incorrect") ||
      err.message.includes("Invalid") ||
      err.message.includes("already in use")
    ) {
      return res.status(400).json({
        message: "Validation error",
        error: err.message,
      });
    }

    res.status(500).json({
      message: "Error updating profile",
      error: "An unexpected error occurred",
    });
  }
});

// Delete account
router.delete("/profile", [auth], async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        message: "Validation error",
        error: "Password is required to delete account",
      });
    }

    await User.delete(req.user.id, password);
    res.json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error("Error deleting account:", err);

    if (err.message === "Invalid password") {
      return res.status(401).json({ message: err.message });
    }

    res.status(500).json({
      message: "Error deleting account",
      error: "An unexpected error occurred",
    });
  }
});

// Update user role (Admin only)
router.put("/users/:userId/role", [auth], async (req, res) => {
  try {
    const { role } = req.body;
    const { userId } = req.params;

    const updatedUser = await User.updateRole(
      parseInt(userId),
      role,
      req.user.id
    );

    res.json({
      message: "User role updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error("Error updating user role:", err);

    if (err.message.includes("Not authorized")) {
      return res.status(403).json({ message: err.message });
    }

    if (
      err.message.includes("required") ||
      err.message.includes("Invalid") ||
      err.message.includes("cannot")
    ) {
      return res.status(400).json({
        message: "Validation error",
        error: err.message,
      });
    }

    if (err.message.includes("not found")) {
      return res.status(404).json({ message: err.message });
    }

    res.status(500).json({
      message: "Error updating user role",
      error: "An unexpected error occurred",
    });
  }
});

module.exports = router;
