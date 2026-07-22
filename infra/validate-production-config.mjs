import process from "node:process";

const input = await new Promise((resolve, reject) => {
  let value = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { value += chunk; });
  process.stdin.on("end", () => resolve(value));
  process.stdin.on("error", reject);
});

let config;
try {
  config = JSON.parse(input);
} catch {
  throw new Error("Expected rendered Docker Compose JSON on stdin.");
}

const services = config.services ?? {};
const failures = [];
const backendServices = [
  "migrate",
  "seed",
  "backend",
  "worker",
  "scheduler",
  "dagster-webserver",
  "dagster-daemon",
];

function requireCondition(condition, message) {
  if (!condition) failures.push(message);
}

function environment(serviceName, key) {
  return services[serviceName]?.environment?.[key];
}

function normalizedHttpsUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    if (
      url.protocol !== "https:"
      || ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
      || url.pathname !== "/"
      || url.search
      || url.hash
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

const publicUrl = normalizedHttpsUrl(environment("backend", "PUBLIC_BASE_URL"));
const frontendOrigin = normalizedHttpsUrl(environment("backend", "FRONTEND_ORIGIN"));
const nextPublicUrl = normalizedHttpsUrl(environment("frontend", "NEXT_PUBLIC_SITE_URL"));
const caddyAddress = normalizedHttpsUrl(environment("caddy", "SITE_ADDRESS"));

requireCondition(publicUrl !== null, "PUBLIC_BASE_URL must be a non-local HTTPS origin.");
requireCondition(frontendOrigin === publicUrl, "FRONTEND_ORIGIN must match PUBLIC_BASE_URL.");
requireCondition(nextPublicUrl === publicUrl, "NEXT_PUBLIC_SITE_URL must match PUBLIC_BASE_URL.");
requireCondition(caddyAddress === publicUrl, "SITE_ADDRESS must match PUBLIC_BASE_URL.");
requireCondition(
  services.frontend?.build?.args?.NEXT_PUBLIC_SITE_URL === environment("frontend", "NEXT_PUBLIC_SITE_URL"),
  "NEXT_PUBLIC_SITE_URL must be passed to both frontend build and runtime.",
);
requireCondition(
  services.frontend?.build?.args?.INTERNAL_API_URL === "http://backend:8000"
    && environment("frontend", "INTERNAL_API_URL") === "http://backend:8000",
  "Production frontend must route API requests to the backend service at build and runtime.",
);
requireCondition(
  services.frontend?.build?.args?.NEXT_PUBLIC_DATA_MODE !== "demo"
    && environment("frontend", "NEXT_PUBLIC_DATA_MODE") !== "demo",
  "Production frontend data mode must not be demo.",
);

const appSecret = environment("backend", "APP_SECRET_KEY") ?? "";
requireCondition(
  appSecret.length >= 32
    && !["development-only-change-me", "change-me-to-a-long-random-value"].includes(appSecret),
  "APP_SECRET_KEY must be a new random value of at least 32 characters.",
);

let databaseUrl;
try {
  databaseUrl = new URL(environment("backend", "DATABASE_URL"));
} catch {
  databaseUrl = null;
}
const databasePassword = databaseUrl ? decodeURIComponent(databaseUrl.password) : "";
const databaseUser = databaseUrl ? decodeURIComponent(databaseUrl.username) : "";
const databaseName = databaseUrl?.pathname.replace(/^\//, "") ?? "";
requireCondition(databaseUrl?.protocol.startsWith("postgresql+") === true, "DATABASE_URL must use PostgreSQL.");
requireCondition(
  databaseUrl !== null
    && databaseUrl.hostname.length > 0
    && !["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname),
  "DATABASE_URL must use a non-local database host.",
);
requireCondition(
  databasePassword.length >= 16 && databasePassword !== "techrole",
  "PostgreSQL password must be non-default and at least 16 characters.",
);
requireCondition(
  databaseUser === environment("postgres", "POSTGRES_USER")
    && databasePassword === environment("postgres", "POSTGRES_PASSWORD")
    && databaseName === environment("postgres", "POSTGRES_DB"),
  "DATABASE_URL credentials must match the PostgreSQL container settings.",
);

for (const serviceName of backendServices) {
  requireCondition(environment(serviceName, "APP_ENV") === "production", `${serviceName} must use APP_ENV=production.`);
  requireCondition(environment(serviceName, "DEMO_MODE") === "false", `${serviceName} must use DEMO_MODE=false.`);
  requireCondition(
    environment(serviceName, "DATABASE_URL") === environment("backend", "DATABASE_URL"),
    `${serviceName} must use the production DATABASE_URL.`,
  );
  const appBindMount = (services[serviceName]?.volumes ?? []).some(
    (volume) => volume.type === "bind" && volume.target === "/app",
  );
  requireCondition(!appBindMount, `${serviceName} must not bind-mount source code into /app.`);
}

for (const [serviceName, service] of Object.entries(services)) {
  if (serviceName === "caddy") continue;
  requireCondition((service.ports ?? []).length === 0, `${serviceName} must not publish host ports.`);
}
const caddyTargets = new Set((services.caddy?.ports ?? []).map((port) => Number(port.target)));
requireCondition(caddyTargets.has(80) && caddyTargets.has(443), "Caddy must publish ports 80 and 443.");
requireCondition(services.backend?.command?.[0] === "gunicorn", "Production backend must use Gunicorn.");
requireCondition(services.frontend?.environment?.NODE_ENV === "production", "Frontend must use NODE_ENV=production.");

if (failures.length > 0) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  production_config_valid: true,
  checked_backend_services: backendServices.length,
  public_origin: publicUrl,
  only_caddy_publishes_ports: true,
  source_bind_mounts: false,
}));
