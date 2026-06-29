import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

import appCss from "../styles.css?url";
import logoAsset from "@/assets/ascend-publishing-logo.png.asset.json";

// ASCEND TIER 1 — Self-hosted WOFF2 font primitives (Stack 1: Editorial Authority)
import "@fontsource-variable/fraunces/index.css";
import "@fontsource-variable/fraunces/wght-italic.css";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/400-italic.css";
import "@fontsource/source-serif-4/600.css";
import "@fontsource/source-serif-4/700.css";
import "@fontsource-variable/inter-tight/index.css";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "Ascend Publishing — Media is the Expression, Publication is Access" },
        {
          name: "description",
          content:
            "Ascend Publishing — internal Publishing OS for manuscript ingestion, metadata, readiness, and distribution.",
        },
        { name: "author", content: "Ascend Publishing" },
        { property: "og:site_name", content: "Ascend Publishing" },
        { property: "og:title", content: "Ascend Publishing — Media is the Expression, Publication is Access" },
        {
          property: "og:description",
          content: "Internal Publishing OS for the Ascend Publishing imprint.",
        },
        { property: "og:type", content: "website" },
        { property: "og:image", content: logoAsset.url },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:image", content: logoAsset.url },
        { name: "theme-color", content: "#000000" },
        { name: "twitter:title", content: "Ascend Publishing — Media is the Expression, Publication is Access" },
        { name: "description", content: "The ultimate publishing workspace for creators. Publish books, music, and more with ASCEND Publishing. Make the world your audience." },
        { property: "og:description", content: "The ultimate publishing workspace for creators. Publish books, music, and more with ASCEND Publishing. Make the world your audience." },
        { name: "twitter:description", content: "The ultimate publishing workspace for creators. Publish books, music, and more with ASCEND Publishing. Make the world your audience." },
        { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/bZWRdPf2QMSLZRqGHUc4Icyykcv2/social-images/social-1782692021694-ascend_publishing_logo.webp" },
        { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/bZWRdPf2QMSLZRqGHUc4Icyykcv2/social-images/social-1782692021694-ascend_publishing_logo.webp" },
      ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: logoAsset.url },
      { rel: "apple-touch-icon", href: logoAsset.url },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  React.useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
