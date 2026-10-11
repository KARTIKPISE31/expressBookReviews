const express = require("express");
const jwt = require("jsonwebtoken");
const { randomBytes, scryptSync, timingSafeEqual } = require("node:crypto");
const books = require("./booksdb.js");
const regd_users = express.Router();

const users = [];
const jwtSecret =
  process.env.JWT_SECRET ||
  process.env.SESSION_SECRET ||
  randomBytes(32).toString("hex");

const normalizeUsername = (username) =>
  typeof username === "string" ? username.trim().toLowerCase() : "";

const isValid = (username) => {
  const normalized = normalizeUsername(username);
  return (
    /^[a-z0-9][a-z0-9._-]{0,63}$/.test(normalized) &&
    !users.some((user) => user.username === normalized)
  );
};

const authenticatedUser = (username, password) => {
  const normalized = normalizeUsername(username);
  if (typeof password !== "string" || password.length === 0) return false;

  const user = users.find((candidate) => candidate.username === normalized);
  if (!user) return false;

  const suppliedHash = scryptSync(password, user.salt, 64);
  return timingSafeEqual(suppliedHash, user.passwordHash);
};

const requireAuthentication = (req, res, next) => {
  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const payload = jwt.verify(match[1], jwtSecret, { algorithms: ["HS256"] });
    if (
      typeof payload !== "object" ||
      payload === null ||
      typeof payload.sub !== "string" ||
      !users.some((user) => user.username === payload.sub)
    ) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    req.authenticatedUsername = payload.sub;
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

regd_users.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ message: "Username and password are required" });
  }
  if (!authenticatedUser(username, password)) {
    return res.status(401).json({ message: "Incorrect username or password" });
  }

  const normalizedUsername = normalizeUsername(username);
  const token = jwt.sign({ sub: normalizedUsername }, jwtSecret, {
    algorithm: "HS256",
    expiresIn: "1h",
  });
  return res.status(200).json({ message: "User successfully logged in", token });
});

const getBook = (isbn) =>
  Object.prototype.hasOwnProperty.call(books, isbn) ? books[isbn] : undefined;

const reviewHandler = (req, res) => {
  const book = getBook(req.params.isbn);
  if (!book) {
    return res.status(404).json({ message: "Book not found" });
  }

  const review = req.body?.review ?? req.body?.comment;
  if (typeof review !== "string" || review.trim().length === 0) {
    return res.status(400).json({ message: "Review must be a non-empty string" });
  }
  if (review.length > 2000) {
    return res.status(400).json({ message: "Review must be 2000 characters or fewer" });
  }

  const username = req.authenticatedUsername;
  const existed = Object.prototype.hasOwnProperty.call(book.reviews, username);
  // Synchronous mutation keeps concurrent requests from interleaving here.
  book.reviews[username] = review.trim();
  return res.status(existed ? 200 : 201).json({
    message: existed ? "Review updated successfully" : "Review added successfully",
    review: book.reviews[username],
  });
};

regd_users.put("/auth/review/:isbn", requireAuthentication, reviewHandler);

regd_users.delete("/auth/review/:isbn", requireAuthentication, (req, res) => {
  const book = getBook(req.params.isbn);
  if (!book) {
    return res.status(404).json({ message: "Book not found" });
  }

  const username = req.authenticatedUsername;
  if (!Object.prototype.hasOwnProperty.call(book.reviews, username)) {
    return res.status(404).json({ message: "Your review was not found" });
  }

  delete book.reviews[username];
  return res.status(200).json({ message: "Review deleted successfully" });
});

module.exports.authenticated = regd_users;
module.exports.isValid = isValid;
module.exports.users = users;
module.exports.authenticatedUser = authenticatedUser;
