import { cn } from "@/lib/utils";
import type { Profile } from "@/services/profiles";

export function UserAvatar({
  profile,
  className,
}: {
  profile: Pick<Profile, "username" | "display_name"> & { avatar_url?: string | null | undefined };
  className?: string;
}) {
  const initial = (profile.display_name || profile.username).charAt(0).toUpperCase();
  return profile.avatar_url ? (
    <img
      src={profile.avatar_url}
      alt={`${profile.username}'s photo`}
      loading="lazy"
      className={cn("rounded-full object-cover ring-1 ring-border", className)}
    />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground",
        className,
      )}
    >
      {initial}
    </span>
  );
}
