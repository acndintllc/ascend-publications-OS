/* PTL-025 Phase 14A — External PDF runner contract (stub).
   Native print-PDF generation (Chromium/Prince/Vivliostyle) cannot run
   inside the Cloudflare Worker. This route documents the public contract
   for an external runner; the runner POSTs results back to
   /api/public/render/callback once the artifact lands in object storage. */
import { createFileRoute } from "@tanstack/react-router";

const CONTRACT = {
  endpoint: "/api/public/render/pdf",
  method: "POST",
  auth: {
    scheme: "HMAC-SHA256",
    header: "x-ascend-signature",
    secret: "ASCEND_RUNNER_SECRET (env)",
    payload: "request body, raw",
  },
  request: {
    slug: "<manuscript-slug>",
    profile: "pdf",
    pdfSourceUrl: "<signed-url-to-pdf-source.html>",
    sourceQueueId: "<distribution-queue-uuid|null>",
  },
  response: {
    jobId: "<uuid>",
    status: "queued | running | done | failed",
    artifactUrl: "<signed-url-when-done>",
  },
  stages: [
    "fetch pdf-source.html artifact",
    "render with chromium/prince/vivliostyle",
    "post-process (crop marks, ICC, embed fonts)",
    "upload to publication-assets bucket",
    "POST result to /api/public/render/callback (signed)",
  ],
} as const;

export const Route = createFileRoute("/api/public/render/pdf")({
  server: {
    handlers: {
      GET: () => new Response(JSON.stringify({ ok: true, contract: CONTRACT }, null, 2),
        { headers: { "content-type": "application/json" } }),
      POST: () => new Response(JSON.stringify({
        ok: false, error: "Not implemented",
        reason: "External PDF runner not deployed. See contract.",
        contract: CONTRACT,
      }, null, 2), { status: 501, headers: { "content-type": "application/json" } }),
    },
  },
});
