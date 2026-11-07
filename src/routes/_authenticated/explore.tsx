import { createFileRoute } from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { ComingSoon } from "@/components/layout/ComingSoon";

export const Route = createFileRoute("/_authenticated/explore")({
  head: () => ({
    meta: [
      { title: "Explore — VIDALORE SOCIAL" },
      { name: "description", content: "Discover creators, posts and communities." },
      { property: "og:title", content: "Explore — VIDALORE SOCIAL" },
      { property: "og:description", content: "Discover creators, posts and communities." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ComingSoon icon={Compass} title="Explore" phase={5} text="Trending posts, reels, creators and communities, plus search." />,
});
