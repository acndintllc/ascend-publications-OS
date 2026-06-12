/* External build-runner contract for Kindle KFX emission.
   (PTL-016 Phase 5B, stub only.)

   KindleGen and Amazon's KPF/KFX toolchain are native binaries —
   per PTL-008 §8 and @server-runtime, they CANNOT run inside the
   Cloudflare Worker. This route documents the public contract for
   an external runner (Node container / GitHub Actions / Fly machine)
   to consume.

   Sits under /api/public/* so external runners do not need user auth;
   they MUST authenticate via the shared ASCEND_RUNNER_SECRET HMAC.
*/
import { createFileRoute } from "@tanstack/react-router";

interface KindleJobContract {
  endpoint: "/api/public/render/kindle";
  method: "POST";
  auth: {
    scheme: "HMAC-SHA256";
    header: "x-ascend-signature";
    secret: "ASCEND_RUNNER_SECRET (env)";
    payload: "request body, raw";
  };
  request: {
    slug: string;
    profile: "kindle";
    epubArtifactUrl: string; // signed URL to the kindle-profile EPUB
  };
  response: {
    jobId: string;
    status: "queued" | "running" | "done" | "failed";
    artifactUrl?: string;    // signed KFX URL, present when status="done"
    error?: string;
  };
  stages: [
    "fetch source EPUB (kindle profile)",
    "kindlegen --kfx (or kpr/kfxlib)",
    "validate KFX integrity",
    "upload artifact to object store",
    "return signed URL (24h TTL)"
  ];
  notes: [
    "Runner is NOT part of this Worker deploy.",
    "When runner exists, swap reader's kindle download from local EPUB to artifactUrl polling.",
    "Pre-runner: reader serves the source kindle-profile EPUB; users sideload via Send-to-Kindle."
  ];
}

const CONTRACT: KindleJobContract = {
  endpoint: "/api/public/render/kindle",
  method: "POST",
  auth: {
    scheme: "HMAC-SHA256",
    header: "x-ascend-signature",
    secret: "ASCEND_RUNNER_SECRET (env)",
    payload: "request body, raw",
  },
  request: {
    slug: "<manuscript-slug>",
    profile: "kindle",
    epubArtifactUrl: "<signed-url-to-source-epub>",
  },
  response: {
    jobId: "<uuid>",
    status: "queued",
  },
  stages: [
    "fetch source EPUB (kindle profile)",
    "kindlegen --kfx (or kpr/kfxlib)",
    "validate KFX integrity",
    "upload artifact to object store",
    "return signed URL (24h TTL)",
  ],
  notes: [
    "Runner is NOT part of this Worker deploy.",
    "When runner exists, swap reader's kindle download from local EPUB to artifactUrl polling.",
    "Pre-runner: reader serves the source kindle-profile EPUB; users sideload via Send-to-Kindle.",
  ],
};

export const Route = createFileRoute("/api/public/render/kindle")({
  server: {
    handlers: {
      GET: () =>
        new Response(JSON.stringify({ ok: true, contract: CONTRACT }, null, 2), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      POST: () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: "Not implemented",
            reason:
              "KindleGen is a native binary and cannot run in the Cloudflare Worker. Deploy the ASCEND build-runner separately and re-point this endpoint at it.",
            contract: CONTRACT,
          }, null, 2),
          { status: 501, headers: { "content-type": "application/json" } },
        ),
    },
  },
});
