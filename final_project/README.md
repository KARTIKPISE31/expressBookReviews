# Express Book Reviews

IBM Skills Network Express Book Review final project. This keeps the original
IBM repository structure and its ten-book sample data.

## Run

```sh
npm install
npm start
```

The service listens on port `5000` by default. Set `PORT` to change it.
`JWT_SECRET` (or `SESSION_SECRET`) may be provided for a stable signing key.
When neither is set, a random process-local key is generated; login tokens then
expire when the server restarts. No signing key or password is stored in source.

Run the integration checks with:

```sh
npm test
```

## Routes

Public routes: `GET /`, `GET /isbn/:isbn`, `GET /author/:author`,
`GET /title/:title`, `GET /review/:isbn`, and `POST /register`.
Authenticated routes: `POST /login`, `PUT /auth/review/:isbn`, and
`DELETE /auth/review/:isbn`. Course-compatible `/customer/login` and
`/customer/auth/review/:isbn` paths are also supported. Send authenticated
requests with `Authorization: Bearer <token>`.

The starter data has numeric keys `1`–`10` rather than ISBN strings; those keys
are the lookup values for the assignment's ISBN route. Author and title searches
are case-insensitive substring matches and return arrays.

Passwords are salted and hashed in memory. User and review updates are
synchronous in Node's event loop, so concurrent operations cannot interleave
between validation and mutation. Data is intentionally in memory, matching the
starter project; it resets on server restart.