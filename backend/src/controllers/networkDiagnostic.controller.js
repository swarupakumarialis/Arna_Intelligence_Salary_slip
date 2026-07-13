import dns from 'dns';
import net from 'net';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * TEMPORARY diagnostic endpoint (Sprint 6.2F) — GET
 * /api/email/network-test. Delete this file and its route
 * registration (routes/email.routes.js) once the Render SMTP
 * ETIMEDOUT investigation is closed; it has no place in the
 * permanent API surface.
 *
 * Deliberately bypasses Nodemailer/email.service.js entirely and
 * uses only Node's built-in net/dns modules to answer one narrow
 * question: from wherever this process is running, can it even open
 * a raw TCP socket to Gmail's SMTP ports at all? No SMTP handshake,
 * no STARTTLS/TLS negotiation, no auth, no email is ever sent — this
 * only tells us whether the underlying network path is open or
 * blocked, which is a strictly earlier failure point than anything
 * Nodemailer's own connectionTimeout/verify() can distinguish. If
 * this endpoint reports port587/port465 as "timeout" on Render while
 * the same call succeeds locally, that's conclusive: Render's
 * outbound networking is blocking/dropping the connection before TLS
 * or SMTP is even in play, and no transporter configuration
 * (host/port/secure/family) can fix that from this side — it needs a
 * network-level change (different port, a relay/smart host, or
 * Render support).
 */

const HOST = 'smtp.gmail.com';
const CONNECT_TIMEOUT_MS = 10000;

function dnsLookup(host) {
  const start = Date.now();
  return new Promise((resolve) => {
    dns.lookup(host, (err, address, family) => {
      const ms = Date.now() - start;
      if (err) {
        resolve({ result: `failed: ${err.code || err.message}`, ms });
      } else {
        resolve({ result: `resolved to ${address} (IPv${family})`, ms });
      }
    });
  });
}

/** Raw TCP connect only — no data is ever written to the socket, so
    this never speaks SMTP and never authenticates. */
function testTcpConnection(host, port, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (status) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ status, ms: Date.now() - start });
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish('connected'));
    socket.once('timeout', () => finish('timeout'));
    socket.once('error', (err) => finish(`error: ${err.code || err.message}`));

    socket.connect(port, host);
  });
}

export const networkTest = asyncHandler(async (req, res) => {
  const dnsResult = await dnsLookup(HOST);
  const port587 = await testTcpConnection(HOST, 587, CONNECT_TIMEOUT_MS);
  const port465 = await testTcpConnection(HOST, 465, CONNECT_TIMEOUT_MS);

  res.status(200).json({
    dns: dnsResult.result,
    port587: port587.status,
    port465: port465.status,
    timings: {
      dnsMs: dnsResult.ms,
      port587Ms: port587.ms,
      port465Ms: port465.ms,
    },
  });
});
