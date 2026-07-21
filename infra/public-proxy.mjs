import http from "node:http";

const upstream = new URL(process.env.UPSTREAM_URL ?? "http://host.docker.internal:3100");
const port = Number(process.env.PORT ?? "3199");
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const hopByHop = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);
const privateForwardingHeaders = new Set(["forwarded", "x-forwarded-for", "x-real-ip"]);

function filteredHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).filter(([name]) =>
    !hopByHop.has(name.toLowerCase()) && !privateForwardingHeaders.has(name.toLowerCase()),
  ));
}

const server = http.createServer((request, response) => {
  if (request.method === "GET" && request.url === "/_proxy/health") {
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
    });
    response.end('{"status":"ready"}');
    return;
  }

  const headers = filteredHeaders(request.headers);
  headers.host = upstream.host;
  const proxyRequest = http.request({
    protocol: upstream.protocol,
    hostname: upstream.hostname,
    port: upstream.port,
    method: request.method,
    path: request.url,
    headers,
    timeout: 30_000,
  }, (proxyResponse) => {
    response.writeHead(proxyResponse.statusCode ?? 502, filteredHeaders(proxyResponse.headers));
    proxyResponse.pipe(response);
  });

  proxyRequest.on("timeout", () => proxyRequest.destroy(new Error("upstream timeout")));
  proxyRequest.on("error", () => {
    if (!response.headersSent) {
      response.writeHead(503, {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
        "Retry-After": "1",
      });
    }
    response.end('{"detail":"Public origin is switching builds. Retry shortly."}');
  });
  request.on("aborted", () => proxyRequest.destroy());
  request.pipe(proxyRequest);
});

server.keepAliveTimeout = 65_000;
server.headersTimeout = 70_000;
server.listen(port, hostname);
