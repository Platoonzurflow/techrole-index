export function browserCsrf(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.split("; ").find((item) => item.startsWith("techrole_csrf="));
  return match ? decodeURIComponent(match.split("=")[1]) : "";
}
