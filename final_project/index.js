const express = require('express');
const customer_routes = require('./router/auth_users.js').authenticated;
const genl_routes = require('./router/general.js').general;

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Keep the original course namespace while also exposing the concise paths
// used in the project brief.
app.use("/customer", customer_routes);
app.use("/", customer_routes);
app.use("/", genl_routes);

app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, _req, res, _next) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ message: "Invalid JSON request body" });
  }
  return res.status(500).json({ message: "Internal server error" });
});

if (require.main === module) {
  const port = Number(process.env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${process.env.PORT}`);
  }
  app.listen(port, "0.0.0.0", () => {
    process.stdout.write(`Express Book Review API listening on port ${port}\n`);
  });
}

module.exports = app;
