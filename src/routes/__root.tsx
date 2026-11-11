import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

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

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();

  const errorMessage = error instanceof Error ? error.message : String(error);

  const errorStack = error instanceof Error ? error.stack : undefined;

  useEffect(() => {
    console.error("VIDALORE SOCIAL application error:", error);

    try {
      reportLovableError(error, {
        boundary: "tanstack_root_error_component",
      });
    } catch (reportError) {
      console.error("Error reporting failed:", reportError);
    }
  }, [error]);

  const handleRetry = async () => {
    try {
      await router.invalidate();
      reset();
    } catch (retryError) {
      console.error("Retry failed:", retryError);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-3xl">
            ⚠️
          </div>

          <h1 className="text-xl font-bold tracking-tight text-foreground">
            VIDALORE SOCIAL couldn't load
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Something went wrong while loading this page. The error details are shown below so we
            can identify and fix the problem.
          </p>
        </div>

        <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
          <p className="mb-2 text-sm font-bold text-red-400">Error message</p>

          <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-foreground">
            {errorMessage || "Unknown application error"}
          </pre>

          {errorStack && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                Show technical details
              </summary>

              <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
                {errorStack}
              </pre>
            </details>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>

          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          VIDALORE SOCIAL · Application diagnostics
        </p>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        name: "theme-color",
        content: "#080808",
      },
      {
        title: "VIDALORE SOCIAL",
      },
      {
        name: "description",
        content:
          "VIDALORE SOCIAL: A premium social network for posts, reels, stories and messaging.",
      },
      {
        property: "og:title",
        content: "VIDALORE SOCIAL",
      },
      {
        property: "og:description",
        content:
          "VIDALORE SOCIAL: A premium social network for posts, reels, stories and messaging.",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
    ],

    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        type: "image/png",
        href: "/favicon.png",
      },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Manrope:wght@400;500;600;700&display=swap",
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>

      <body className="bg-background text-foreground antialiased selection:bg-[#E91E63]/20 selection:text-[#E91E63]">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") {
        return;
      }

      router.invalidate();

      if (event === "SIGNED_OUT") {
        queryClient.clear();
      } else {
        queryClient.invalidateQueries();
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
