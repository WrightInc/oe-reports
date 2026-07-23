// OE Utility Services — Indigenous Strategic Roadmap page (reports.oeservices.ca/indigenous-strategic-roadmap)
// Basic Auth gate for /indigenous-strategic-roadmap/* only — the rest of the site (e.g. the sustainability
// report) stays public because this middleware lives under functions/indigenous-strategic-roadmap/.
// Login: Utility · Password: Services123  (change CREDS below, redeploy to rotate)

const CREDS = "Utility:Services123";

export async function onRequest(context) {
  const { request } = context;

  const expected = "Basic " + btoa(CREDS);
  if (request.headers.get("Authorization") !== expected) {
    return new Response("Authentication required.", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="OE Utility Services", charset="UTF-8"' },
    });
  }

  const response = await context.next();

  // Pages' asset layer ignores Range when routed through a Function, which would
  // break video seeking — so serve byte ranges ourselves.
  const range = request.headers.get("Range");
  if (!range || response.status !== 200 || request.method !== "GET") {
    return response;
  }

  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!m || (m[1] === "" && m[2] === "")) return response;

  const buf = await response.arrayBuffer();
  const total = buf.byteLength;
  let start, end;
  if (m[1] === "") {
    // suffix range: last N bytes
    start = Math.max(total - Number(m[2]), 0);
    end = total - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? total - 1 : Math.min(Number(m[2]), total - 1);
  }
  if (start > end || start >= total) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${total}` },
    });
  }

  const headers = new Headers(response.headers);
  headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
  headers.set("Content-Length", String(end - start + 1));
  headers.set("Accept-Ranges", "bytes");
  return new Response(buf.slice(start, end + 1), { status: 206, headers });
}
