import { createFileRoute } from "@tanstack/react-router";
import { Clapperboard } from "lucide-react";
import { ComingSoon } from "@/components/layout/ComingSoon";

export const Route = createFileRoute("/_authenticated/reels")({
  head: () => ({
    meta: [
      { title: "Reels — VIDALORE SOCIAL" },
      { name: "description", content: "Full-screen vertical short videos." },
      { property: "og:title", content: "Reels — VIDALORE SOCIAL" },
      { property: "og:description", content: "Full-screen vertical short videos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ComingSoon icon={Clapperboard} title="Vidalore Reels" phase={3} text="Swipe-through vertical videos with likes, comments and follows." />,
});
