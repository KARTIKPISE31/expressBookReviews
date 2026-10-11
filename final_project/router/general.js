const express = require('express');
const { randomBytes, scryptSync } = require("node:crypto");
const books = require("./booksdb.js");
const { isValid, users } = require("./auth_users.js");
const public_users = express.Router();

public_users.post("/register", (req, res) => {
  const { username, password } = req.body || {};
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    username.trim().length === 0 ||
    password.length === 0
  ) {
    return res.status(400).json({ message: "Username and password are required" });
  }
  if (password.length > 256) {
    return res.status(400).json({ message: "Password is too long" });
  }
  const normalizedUsername = username.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(normalizedUsername)) {
    return res.status(400).json({ message: "Username format is invalid" });
  }
  if (!isValid(username)) {
    return res.status(409).json({ message: "Username is invalid or already registered" });
  }

  const salt = randomBytes(16);
  const passwordHash = scryptSync(password, salt, 64);
  // No await occurs between duplicate check and insert, so simultaneous
  // registrations cannot both create the same normalized username.
  users.push({ username: normalizedUsername, salt, passwordHash });
  return res.status(201).json({ message: "User successfully registered" });
});

// Get the book list available in the shop
public_users.get("/", (_req, res) => {
  return res.status(200).json(books);
});

// Get book details based on ISBN
public_users.get("/isbn/:isbn", (req, res) => {
  const book = Object.prototype.hasOwnProperty.call(books, req.params.isbn)
    ? books[req.params.isbn]
    : undefined;
  if (!book) return res.status(404).json({ message: "Book not found" });
  return res.status(200).json(book);
});

// Get book details based on author
public_users.get("/author/:author", (req, res) => {
  const query = req.params.author.trim().toLocaleLowerCase();
  if (!query) return res.status(400).json({ message: "Author is required" });
  const matches = Object.values(books).filter((book) =>
    book.author.toLocaleLowerCase().includes(query),
  );
  return res.status(200).json(matches);
});

// Get all books based on title
public_users.get("/title/:title", (req, res) => {
  const query = req.params.title.trim().toLocaleLowerCase();
  if (!query) return res.status(400).json({ message: "Title is required" });
  const matches = Object.values(books).filter((book) =>
    book.title.toLocaleLowerCase().includes(query),
  );
  return res.status(200).json(matches);
});

//  Get book review
public_users.get("/review/:isbn", (req, res) => {
  const book = Object.prototype.hasOwnProperty.call(books, req.params.isbn)
    ? books[req.params.isbn]
    : undefined;
  if (!book) return res.status(404).json({ message: "Book not found" });
  return res.status(200).json(book.reviews);
});

module.exports.general = public_users;
