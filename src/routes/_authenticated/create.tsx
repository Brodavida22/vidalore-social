import { createFileRoute } from "@tanstack/react-router";
import { PlusSquare } from "lucide-react";
import { ComingSoon } from "@/components/layout/ComingSoon";

export const Route = createFileRoute("/_authenticated/create")({
  head: () => ({
    meta: [
      { title: "Create — VIDALORE SOCIAL" },
      { name: "description", content: "Create posts, reels and stories." },
      { property: "og:title", content: "Create — VIDALORE SOCIAL" },
      { property: "og:description", content: "Create posts, reels and stories." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ComingSoon icon={PlusSquare} title="Create" phase={2} text="Text, photo and video posts arrive in Phase 2; reels and stories in Phase 3." />,
});
