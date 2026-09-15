// Temporary manual-testing server.

const http = require("http");
const fs = require("fs");
const path = require("path");
const { handleRequest } = require("./src/server/request-handlers");

const CLIENT_DIR = path.join(__dirname, "src", "client");
const PORT = 4000;

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
};

function serveStatic(req, res) {
  const filePath = req.url === "/" ? "/index.html" : req.url;
  const resolved = path.join(CLIENT_DIR, filePath);

  if (!resolved.startsWith(CLIENT_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(resolved, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(resolved);
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(data);
  });
}

function handleApi(req, res) {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    let payload;
    try {
      payload = JSON.parse(body || "{}");
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "invalid JSON body" }));
      return;
    }
    const { action, ...rest } = payload;
    const result = handleRequest(action, rest);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/watchlist") {
    handleApi(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Dev server running at http://localhost:${PORT}`);
});
