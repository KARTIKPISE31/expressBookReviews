const axios = require("axios");

const API_BASE_URL = (
  process.env.BOOK_REVIEW_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { Accept: "application/json" },
});

async function getAllBooks() {
  const response = await client.get("/");
  return response.data;
}

async function getBookByISBN(isbn) {
  if (typeof isbn !== "string" || isbn.trim() === "") {
    throw new TypeError("ISBN must be a non-empty string");
  }
  const response = await client.get(`/isbn/${encodeURIComponent(isbn.trim())}`);
  return response.data;
}

async function getBooksByAuthor(author) {
  if (typeof author !== "string" || author.trim() === "") {
    throw new TypeError("Author must be a non-empty string");
  }
  const response = await client.get(`/author/${encodeURIComponent(author.trim())}`);
  return response.data;
}

async function getBooksByTitle(title) {
  if (typeof title !== "string" || title.trim() === "") {
    throw new TypeError("Title must be a non-empty string");
  }
  const response = await client.get(`/title/${encodeURIComponent(title.trim())}`);
  return response.data;
}

const getBookByTitle = getBooksByTitle;

module.exports = {
  getAllBooks,
  getBookByISBN,
  getBooksByAuthor,
  getBooksByTitle,
  getBookByTitle,
};
