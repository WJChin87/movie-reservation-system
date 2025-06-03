const jwt = require("jsonwebtoken");

const auth = (req, res, next) => {
  try {
    // Allow public access to GET methods for movies and showtimes
    if (
      req.method === "GET" &&
      (req.path.startsWith("/movies") || req.path.startsWith("/showtimes"))
    ) {
      return next();
    }

    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res
        .status(401)
        .json({ message: "No token, authorization denied" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: "Token is not valid" });
  }
};

const admin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

module.exports = { auth, admin };
