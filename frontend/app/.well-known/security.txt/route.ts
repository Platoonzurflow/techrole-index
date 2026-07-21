const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export function GET() {
  const body = `Contact: mailto:sqldevelopermoscow@yandex.com
Expires: 2027-07-20T00:00:00Z
Canonical: ${siteUrl}/.well-known/security.txt
Preferred-Languages: ru, en
Policy: ${siteUrl}/support
`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
