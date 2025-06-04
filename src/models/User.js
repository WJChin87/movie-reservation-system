const db = require("../config/database");
const bcrypt = require("bcryptjs");

class User {
  static async create({ email, password, role = "user" }) {
    // Validate input
    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user with transaction
    const result = await db.transaction(async (client) => {
      // Check if user exists
      const existingUser = await client.query(
        "SELECT id FROM users WHERE email = $1",
        [email]
      );

      if (existingUser.rows.length > 0) {
        throw new Error("User already exists");
      }

      // Create user
      const result = await client.query(
        "INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role",
        [email, hashedPassword, role]
      );

      return result.rows[0];
    });

    return result;
  }

  static async findByEmail(email) {
    if (!email) {
      throw new Error("Email is required");
    }

    const result = await db.query(
      "SELECT id, email, password, role FROM users WHERE email = $1",
      [email]
    );

    return result.rows[0];
  }

  static async findById(id) {
    if (!id) {
      throw new Error("User ID is required");
    }

    const result = await db.query(
      "SELECT id, email, role FROM users WHERE id = $1",
      [id]
    );

    return result.rows[0];
  }

  static async updateRole(userId, role) {
    if (!userId || !role) {
      throw new Error("User ID and role are required");
    }

    const validRoles = ["user", "admin"];
    if (!validRoles.includes(role)) {
      throw new Error("Invalid role specified");
    }

    const result = await db.query(
      "UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, role",
      [role, userId]
    );

    return result.rows[0];
  }

  static async comparePassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  }
}

module.exports = User;
