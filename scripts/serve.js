import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../public");
const port = parseInt(process.argv[2] || "3000", 10);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

process.on("uncaughtException", (err) => {
  if (err.code !== "EPIPE" && err.code !== "ECONNRESET") {
    console.error("Server uncaught exception:", err);
  }
});

const server = http.createServer((req, res) => {
  req.on("error", () => {});
  res.on("error", () => {});

  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
    let reqPath = decodeURIComponent(parsedUrl.pathname);
    if (reqPath === "/" || reqPath === "") reqPath = "/index.html";

    const filePath = path.normalize(path.join(rootDir, reqPath));
    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = mimeTypes[ext] || "application/octet-stream";

      try {
        res.writeHead(200, {
          "Content-Type": contentType,
          "Content-Length": data.length,
          "Cache-Control": "no-cache"
        });
        res.end(data);
      } catch {
        // Socket closed
      }
    });
  } catch {
    try {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    } catch {
      // Socket closed
    }
  }
});

server.on("clientError", (err, socket) => {
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Node static server listening on http://127.0.0.1:${port}`);
});
