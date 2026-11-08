import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";

/**
 * Fetches a user-supplied URL from the server without letting it reach
 * private networks (SSRF). Addresses are checked inside the socket's DNS
 * lookup, so the IP that's validated is the IP that's connected to, and
 * every redirect hop is re-validated.
 */

export class SafeFetchError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "SafeFetchError";
    this.status = status;
  }
}

// ── Address checks ───────────────────────────────────────────────────────────

function isPublicV4(ip: string): boolean {
  const [a, b, c] = ip.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false; // this-net, private, loopback, multicast/reserved
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
  if (a === 169 && b === 254) return false; // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function expandV6(ip: string): number[] | null {
  let addr = ip.toLowerCase().split("%")[0];
  const lastColon = addr.lastIndexOf(":");
  const tail = addr.slice(lastColon + 1);
  if (tail.includes(".")) {
    const p = tail.split(".").map(Number);
    if (p.length !== 4 || p.some((n) => !(n >= 0 && n <= 255))) return null;
    addr = `${addr.slice(0, lastColon + 1)}${((p[0] << 8) | p[1]).toString(16)}:${((p[2] << 8) | p[3]).toString(16)}`;
  }

  const halves = addr.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  let groups = head;
  if (halves.length === 2) {
    const rest = halves[1] ? halves[1].split(":") : [];
    const fill = 8 - head.length - rest.length;
    if (fill < 1) return null;
    groups = [...head, ...Array<string>(fill).fill("0"), ...rest];
  }
  if (groups.length !== 8) return null;

  const nums = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return nums.some(Number.isNaN) ? null : nums;
}

function isPublicV6(ip: string): boolean {
  const g = expandV6(ip);
  if (!g) return false;
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
    return isPublicV4(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`);
  }
  if ((g[0] & 0xe000) !== 0x2000) return false; // allow only global unicast 2000::/3
  if (g[0] === 0x2001 && g[1] === 0x0db8) return false; // documentation
  if (g[0] === 0x2001 && g[1] === 0) return false; // Teredo tunnels to IPv4
  if (g[0] === 0x2002) return false; // 6to4 embeds an IPv4 address
  return true;
}

export function isPublicAddress(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return isPublicV4(ip);
  if (version === 6) return isPublicV6(ip);
  return false;
}

const blockedError = () =>
  new SafeFetchError("That link points to a private address and can't be imported.");

const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "");
    if (addresses.length === 0 || addresses.some((a) => !isPublicAddress(a.address))) {
      return callback(blockedError() as NodeJS.ErrnoException, "");
    }
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
};

function parsePublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeFetchError("That doesn't look like a valid link.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SafeFetchError("Only http and https links can be imported.");
  }
  if (url.username || url.password) {
    throw new SafeFetchError("Links with a username or password can't be imported.");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new SafeFetchError("Links on non-standard ports can't be imported.");
  }
  // Node skips the DNS lookup for IP literals, so check those directly
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && !isPublicAddress(host)) throw blockedError();
  return url;
}

// ── Request ──────────────────────────────────────────────────────────────────

const REQUEST_HEADERS = {
  // A browser UA from a non-browser TLS client gets flagged by Cloudflare; an honest one passes more often
  "User-Agent": "Mozilla/5.0 (compatible; LifePlanner/1.0; recipe import)",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, br",
};

function statusError(status: number): SafeFetchError {
  if (status === 401 || status === 403 || status === 429) {
    return new SafeFetchError("That site blocked the import. You can still add the recipe by hand.", 422);
  }
  if (status === 404 || status === 410) return new SafeFetchError("That page wasn't found.", 422);
  return new SafeFetchError(`That site returned an error (${status}).`, 502);
}

function decodeBody(buf: Buffer, contentType: string): string {
  const charset = contentType.match(/charset=["']?([\w-]+)/i)?.[1];
  try {
    return new TextDecoder(charset ?? "utf-8").decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}

type HopResult = { redirect: string } | { html: string };

function requestOnce(url: URL, signal: AbortSignal, maxBytes: number): Promise<HopResult> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      { method: "GET", headers: REQUEST_HEADERS, lookup: safeLookup, signal, agent: false },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ redirect: res.headers.location });
        }
        if (status < 200 || status >= 300) {
          res.resume();
          return reject(statusError(status));
        }

        const contentType = String(res.headers["content-type"] ?? "");
        if (!/html/i.test(contentType)) {
          res.resume();
          return reject(new SafeFetchError("That link isn't a web page.", 422));
        }

        const encoding = String(res.headers["content-encoding"] ?? "").trim().toLowerCase();
        let body: NodeJS.ReadableStream = res;
        if (encoding === "gzip" || encoding === "x-gzip") body = res.pipe(zlib.createGunzip());
        else if (encoding === "br") body = res.pipe(zlib.createBrotliDecompress());
        else if (encoding === "deflate") body = res.pipe(zlib.createInflate());
        else if (encoding && encoding !== "identity") {
          res.resume();
          return reject(new SafeFetchError("That page uses an unsupported encoding.", 422));
        }

        // Size is enforced on decompressed bytes, which also guards against compression bombs
        const chunks: Buffer[] = [];
        let size = 0;
        body.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            req.destroy();
            reject(new SafeFetchError("That page is too large to import.", 422));
            return;
          }
          chunks.push(chunk);
        });
        body.on("end", () => resolve({ html: decodeBody(Buffer.concat(chunks), contentType) }));
        body.on("error", () => reject(new SafeFetchError("Couldn't read that page.", 502)));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function toSafeError(err: unknown, signal: AbortSignal): SafeFetchError {
  if (err instanceof SafeFetchError) return err;
  if (signal.aborted) return new SafeFetchError("That site took too long to respond.", 504);
  const code = (err as NodeJS.ErrnoException)?.code;
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return new SafeFetchError("Couldn't find that website. Check the link.", 422);
  }
  return new SafeFetchError("Couldn't load that page.", 502);
}

export async function fetchPublicHtml(
  rawUrl: string,
  { timeoutMs = 9000, maxBytes = 5_000_000, maxRedirects = 5 } = {}
): Promise<{ html: string; finalUrl: string }> {
  const signal = AbortSignal.timeout(timeoutMs);
  let url = parsePublicUrl(rawUrl);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    let result: HopResult;
    try {
      result = await requestOnce(url, signal, maxBytes);
    } catch (err) {
      throw toSafeError(err, signal);
    }
    if ("html" in result) return { html: result.html, finalUrl: url.toString() };
    let next: string;
    try {
      next = new URL(result.redirect, url).toString();
    } catch {
      throw new SafeFetchError("That site sent an invalid redirect.", 502);
    }
    url = parsePublicUrl(next);
  }
  throw new SafeFetchError("That link redirects too many times.", 422);
}
