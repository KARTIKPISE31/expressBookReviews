const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");
const axios = require("axios");

const port = 5197;
const baseURL = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [path.join(__dirname, "index.js")], {
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverOutput = "";
server.stdout.on("data", (chunk) => (serverOutput += chunk.toString()));
server.stderr.on("data", (chunk) => (serverOutput += chunk.toString()));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Server exited before starting:\n${serverOutput}`);
    }
    try {
      await axios.get(`${baseURL}/health`, { timeout: 300 });
      return;
    } catch (_error) {
      await sleep(100);
    }
  }
  throw new Error(`Server did not become ready:\n${serverOutput}`);
}

async function expectStatus(promise, status) {
  try {
    const response = await promise;
    assert.equal(response.status, status);
    return response;
  } catch (error) {
    if (error.response) {
      assert.equal(error.response.status, status, JSON.stringify(error.response.data));
      return error.response;
    }
    throw error;
  }
}

async function run() {
  await waitForServer();
  const api = axios.create({ baseURL, validateStatus: () => true });

  const allBooks = await api.get("/");
  assert.equal(allBooks.status, 200);
  assert.equal(Object.keys(allBooks.data).length, 10);

  const byIsbn = await api.get("/isbn/1");
  assert.equal(byIsbn.status, 200);
  assert.equal(byIsbn.data.title, "Things Fall Apart");
  assert.equal((await api.get("/isbn/not-a-book")).status, 404);

  const byAuthor = await api.get("/author/Chinua%20Achebe");
  assert.equal(byAuthor.status, 200);
  assert.equal(byAuthor.data[0].author, "Chinua Achebe");
  assert.equal((await api.get("/author/no-such-author")).data.length, 0);

  const byTitle = await api.get("/title/pride");
  assert.equal(byTitle.status, 200);
  assert.equal(byTitle.data[0].title, "Pride and Prejudice");

  const initialReviews = await api.get("/review/1");
  assert.equal(initialReviews.status, 200);
  assert.deepEqual(initialReviews.data, {});
  assert.equal((await api.get("/review/999")).status, 404);

  assert.equal(
    (await api.post("/register", { username: "evidence_reader", password: "test-pass-one" })).status,
    201,
  );
  assert.equal(
    (await api.post("/register", { username: "EVIDENCE_READER", password: "another-pass" })).status,
    409,
  );
  assert.equal((await api.post("/register", { username: "", password: "x" })).status, 400);

  const concurrentRegistrations = await Promise.all(
    Array.from({ length: 6 }, (_, index) =>
      api.post("/register", {
        username: index % 2 === 0 ? "parallel_reader" : "PARALLEL_READER",
        password: `parallel-pass-${index}`,
      }),
    ),
  );
  assert.equal(
    concurrentRegistrations.filter((response) => response.status === 201).length,
    1,
  );
  assert.equal(
    concurrentRegistrations.filter((response) => response.status === 409).length,
    5,
  );

  assert.equal(
    (await api.post("/login", { username: "evidence_reader", password: "wrong" })).status,
    401,
  );

  const login = await api.post("/login", {
    username: "evidence_reader",
    password: "test-pass-one",
  });
  assert.equal(login.status, 200);
  assert.equal(typeof login.data.token, "string");
  const token = login.data.token;

  assert.equal((await api.put("/auth/review/1", { review: "No token" })).status, 401);
  const headers = { Authorization: `Bearer ${token}` };
  assert.equal((await api.put("/auth/review/999", { review: "Unknown book" }, { headers })).status, 404);
  assert.equal((await api.put("/auth/review/1", { review: " " }, { headers })).status, 400);
  assert.equal(
    (await api.put("/auth/review/1", { review: "A thoughtful classic." }, { headers })).status,
    201,
  );
  assert.equal(
    (await api.put("/auth/review/1", { review: "Updated review." }, { headers })).status,
    200,
  );

  assert.equal(
    (
      await api.post("/register", {
        username: "another_reader",
        password: "test-pass-two",
      })
    ).status,
    201,
  );
  const otherLogin = await api.post("/login", {
    username: "another_reader",
    password: "test-pass-two",
  });
  assert.equal((await api.delete("/auth/review/1", {
    headers: { Authorization: `Bearer ${otherLogin.data.token}` },
  })).status, 404);

  const reviews = await api.get("/review/1");
  assert.equal(reviews.data.evidence_reader, "Updated review.");
  assert.equal((await api.delete("/auth/review/1", { headers })).status, 200);
  assert.deepEqual((await api.get("/review/1")).data, {});

  assert.equal(
    (await api.post("/customer/login", {
      username: "evidence_reader",
      password: "test-pass-one",
    })).status,
    200,
    "legacy course login path",
  );

  process.env.BOOK_REVIEW_API_URL = baseURL;
  const client = require("./general.js");
  assert.equal(Object.keys(await client.getAllBooks()).length, 10);
  assert.equal((await client.getBookByISBN("1")).title, "Things Fall Apart");
  assert.equal((await client.getBooksByAuthor("Jane Austen"))[0].title, "Pride and Prejudice");
  assert.equal((await client.getBooksByTitle("molloy"))[0].author, "Samuel Beckett");

  console.log("PASS: catalogue, ISBN/author/title search, reviews, registration, login,");
  console.log("      authentication, owner-only deletion, validation, legacy paths, and Axios client.");
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    server.kill("SIGTERM");
  });
