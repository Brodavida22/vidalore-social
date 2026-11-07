import { cn } from "@/lib/utils";
import type { Profile } from "@/services/profiles";

export function UserAvatar({ profile, className }: { profile: Pick<Profile, "avatar_url" | "username" | "display_name">; className?: string }) {
  const initial = (profile.display_name || profile.username).charAt(0).toUpperCase();
  return profile.avatar_url ? (
    <img src={profile.avatar_url} alt={`${profile.username}'s photo`} loading="lazy" className={cn("rounded-full object-cover ring-2 ring-primary/40", className)} />
  ) : (
    <span aria-hidden="true" className={cn("inline-flex items-center justify-center rounded-full bg-gradient-rose font-semibold text-primary-foreground", className)}>
      {initial}
    </span>
  );
}
