const indexNowKey = process.env.INDEXNOW_KEY?.trim();
const validKey = /^[A-Za-z0-9-]{8,128}$/;

export function GET() {
  if (!indexNowKey || !validKey.test(indexNowKey)) {
    return new Response("Not configured\n", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" },
    });
  }
  return new Response(`${indexNowKey}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
