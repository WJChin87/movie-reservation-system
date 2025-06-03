const db = require("../config/database");
const bcrypt = require("bcryptjs");

class User {
  static async create({ username, email, password }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.execute(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, hashedPassword]
    );
    return result.insertId;
  }

  static async findByEmail(email) {
    const [rows] = await db.execute("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    return rows[0];
  }

  static async findById(id) {
    const [rows] = await db.execute("SELECT * FROM users WHERE id = ?", [id]);
    return rows[0];
  }

  static async updateRole(userId, role) {
    const [result] = await db.execute(
      "UPDATE users SET role = ? WHERE id = ?",
      [role, userId]
    );
    return result.affectedRows > 0;
  }

  static async comparePassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  }
}

module.exports = User;
