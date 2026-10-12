import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { execFileSync } from "node:child_process";
import { copyFileSync, createReadStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir, networkInterfaces } from "node:os";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./public/", import.meta.url));
const portArgIndex = process.argv.indexOf("--port");
const portArg = portArgIndex >= 0 ? process.argv[portArgIndex + 1] : undefined;
const httpsPort = Number(portArg || process.env.HTTPS_PORT || 8766);
const obsPort = Number(process.env.OBS_PORT || httpsPort - 1);
const certDir = process.env.CERT_DIR || join(homedir(), ".local/share/iphone-linux-webcam/certs");
const keyPath = join(certDir, "key.pem");
const certPath = join(certDir, "cert.pem");
const bundledKeyPath = fileURLToPath(new URL("./certs/key.pem", import.meta.url));
const bundledCertPath = fileURLToPath(new URL("./certs/cert.pem", import.meta.url));
const rooms = new Map();

const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

function localAddresses() {
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === "IPv4" && !iface.internal)
    .map((iface) => iface.address);

  const likelyLan = addresses.filter((address) => {
    return address.startsWith("192.168.") || address.startsWith("10.");
  });

  return likelyLan.length > 0 ? likelyLan : addresses;
}

function getRoom(id) {
  if (!rooms.has(id)) {
    rooms.set(id, { nextId: 1, messages: [], waiters: new Set() });
  }
  return rooms.get(id);
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error("Request body too large"));
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function messagesAfter(room, peer, after) {
  return room.messages.filter((message) => message.id > after && message.from !== peer);
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/info" && req.method === "GET") {
    const addresses = localAddresses();
    sendJson(res, 200, {
      httpsPort,
      obsPort,
      phoneUrls: addresses.map((address) => `https://${address}:${httpsPort}/phone.html`),
      obsUrl: `http://localhost:${obsPort}/viewer.html`,
      controlUrl: `http://localhost:${obsPort}/`,
    });
    return true;
  }

  const match = url.pathname.match(/^\/api\/rooms\/([^/]+)\/(messages|poll)$/);
  if (!match) return false;

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return true;
  }

  const [, roomId, action] = match;
  const room = getRoom(roomId);

  if (action === "messages" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const message = {
        id: room.nextId++,
        at: Date.now(),
        from: String(body.from || "unknown"),
        type: String(body.type || "message"),
        payload: body.payload ?? null,
      };
      room.messages.push(message);
      room.messages = room.messages.slice(-200);

      for (const waiter of room.waiters) waiter();
      room.waiters.clear();
      sendJson(res, 201, { ok: true, id: message.id });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (action === "poll" && req.method === "GET") {
    const peer = String(url.searchParams.get("peer") || "unknown");
    const after = Number(url.searchParams.get("after") || 0);
    const current = messagesAfter(room, peer, after);

    if (current.length > 0) {
      sendJson(res, 200, { messages: current });
      return true;
    }

    let timer;
    const done = () => {
      clearTimeout(timer);
      room.waiters.delete(done);
      sendJson(res, 200, { messages: messagesAfter(room, peer, after) });
    };

    room.waiters.add(done);
    timer = setTimeout(done, 25_000);
    req.on("close", () => {
      clearTimeout(timer);
      room.waiters.delete(done);
    });
    return true;
  }

  sendJson(res, 405, { ok: false, error: "Method not allowed" });
  return true;
}

function serveFile(req, res, url) {
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath);

  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  res.writeHead(200, {
    "content-type": mime.get(extname(filePath)) || "application/octet-stream",
    "cache-control": "no-store",
  });
  createReadStream(filePath).pipe(res);
}

async function handler(req, res) {
  const host = req.headers.host || "localhost";
  const url = new URL(req.url || "/", `http://${host}`);

  if (await handleApi(req, res, url)) return;
  serveFile(req, res, url);
}

function ensureCertificate() {
  if (existsSync(keyPath) && existsSync(certPath)) return;

  mkdirSync(certDir, { recursive: true });
  try {
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        keyPath,
        "-out",
        certPath,
        "-days",
        "365",
        "-subj",
        "/CN=iphone-linux-webcam",
      ],
      { stdio: "ignore" },
    );
  } catch {
    if (!existsSync(bundledKeyPath) || !existsSync(bundledCertPath)) {
      throw new Error("Nao foi possivel criar certificado local e nenhum certificado embutido foi encontrado.");
    }
    copyFileSync(bundledKeyPath, keyPath);
    copyFileSync(bundledCertPath, certPath);
  }
}

ensureCertificate();

createHttpServer(handler)
  .on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error("");
      console.error(`A porta local do OBS ${obsPort} ja esta em uso.`);
      console.error("Feche o processo que usa essa porta ou rode com outra porta HTTPS:");
      console.error("");
      console.error(`  iphone-webcam --port ${httpsPort + 10}`);
      console.error("");
      process.exit(1);
    }

    throw error;
  })
  .listen(obsPort, "127.0.0.1");

createHttpsServer(
  {
    key: readFileSync(keyPath),
    cert: readFileSync(certPath),
  },
  handler,
)
  .on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error("");
      console.error(`A porta ${httpsPort} ja esta em uso.`);
      console.error("");
      console.error("Isso normalmente significa que o iphone-webcam ja esta rodando em outro terminal.");
      console.error("Feche o outro processo ou rode em outra porta:");
      console.error("");
      console.error(`  iphone-webcam --port ${httpsPort + 1}`);
      console.error("");
      process.exit(1);
    }

    throw error;
  })
  .listen(httpsPort, "0.0.0.0", () => {
  console.log("");
  console.log("iPhone Linux Webcam iniciado.");
  console.log(`Servico local: https://localhost:${httpsPort}`);
  console.log(`Fonte OBS:     http://localhost:${obsPort}/viewer.html`);
  console.log("");
  for (const address of localAddresses()) {
    console.log(`Conectar iPhone: https://${address}:${httpsPort}/phone.html`);
    console.log("");
  }
  console.log("Use o endereco da sua rede Wi-Fi. Normalmente ele comeca com 192.168.");
});
