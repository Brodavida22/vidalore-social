import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, Share2, UserPen, Award } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { achievementsForUserQuery, myProfileQuery, profileByUsernameQuery } from "@/services/profiles";

export const Route = createFileRoute("/_authenticated/u/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.username} — VIDALORE SOCIAL` },
      { name: "description", content: `@${params.username} on VIDALORE SOCIAL.` },
      { property: "og:title", content: `@${params.username} — VIDALORE SOCIAL` },
      { property: "og:description", content: `See @${params.username}'s profile on VIDALORE SOCIAL.` },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const { data: profile, isLoading, error, refetch } = useQuery(profileByUsernameQuery(username));
  const { data: me } = useQuery(myProfileQuery());
  const { data: achievements } = useQuery({ ...achievementsForUserQuery(profile?.id ?? ""), enabled: !!profile });

  if (isLoading) return <div className="mx-auto max-w-3xl p-4"><Skeleton className="h-56 rounded-3xl" /><Skeleton className="mt-4 h-32 rounded-3xl" /></div>;
  if (error) return <div className="p-10 text-center"><p className="text-muted-foreground">Couldn't load this profile.</p><Button variant="glass" className="mt-4" onClick={() => refetch()}>Retry</Button></div>;
  if (!profile) return <div className="p-10 text-center"><h1 className="text-3xl font-semibold">No one by that name</h1><p className="mt-2 text-muted-foreground">@{username} hasn't bloomed here yet.</p></div>;

  const isMe = me?.id === profile.id;
  const joined = new Date(profile.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: `@${profile!.username} on VIDALORE SOCIAL`, url }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Profile link copied");
    }
  }

  return (
    <div className="mx-auto max-w-3xl pb-8">
      <div className="relative h-40 overflow-hidden bg-garden sm:h-56 md:mt-6 md:rounded-3xl">
        {profile.cover_url && <img src={profile.cover_url} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="px-4">
        <div className="-mt-12 flex items-end justify-between gap-3">
          <UserAvatar profile={profile} className="h-24 w-24 border-4 border-background text-3xl sm:h-28 sm:w-28" />
          <div className="flex gap-2 pb-1">
            <Button variant="glass" size="icon" onClick={share} aria-label="Share profile"><Share2 /></Button>
            {isMe && <Button asChild variant="rose"><Link to="/settings/profile"><UserPen /> Edit profile</Link></Button>}
          </div>
        </div>
        <h1 className="mt-3 text-3xl font-semibold">{profile.display_name || profile.username}</h1>
        <p className="text-sm text-muted-foreground">@{profile.username}</p>
        {profile.bio && <p className="mt-3 whitespace-pre-line">{profile.bio}</p>}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {profile.location && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{profile.location}</span>}
          <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" />Joined {joined}</span>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <Stat label="VIDA POINTS" value={`🌹 ${profile.points_balance}`} highlight />
          <Stat label="Followers" value="—" />
          <Stat label="Friends" value="—" />
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">Follow, friends, messages and posts arrive in Phase 2.</p>

        <section className="glass mt-6 rounded-3xl p-5">
          <h2 className="flex items-center gap-2 text-2xl font-semibold"><Award className="h-5 w-5 text-primary" />Achievements</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {achievements?.length ? achievements.map((a) => (
              <span key={a.achievements?.code} title={a.achievements?.description ?? ""} className="rounded-full bg-secondary px-3 py-1.5 text-sm">
                🏵️ {a.achievements?.name}
              </span>
            )) : <p className="text-sm text-muted-foreground">No achievements yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-3 ${highlight ? "bg-gradient-rose shadow-glow" : "glass"}`}>
      <p className="font-semibold">{value}</p>
      <p className={`text-[0.7rem] ${highlight ? "text-primary-foreground/85" : "text-muted-foreground"}`}>{label}</p>
    </div>
  );
}
