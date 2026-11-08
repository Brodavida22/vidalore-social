import type { Profile } from "@/services/profiles";

export interface ReelComment {
  id: string;
  reelId: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl?: string | null;
  content: string;
  createdAt: string;
  reactionsCount: number;
  hasReacted?: boolean;
}

export interface ReelItem {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorUsername: string;
  creatorAvatarUrl?: string | null;
  creatorVerified?: boolean;
  videoUrl: string;
  caption: string;
  audioTitle?: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  savesCount: number;
  viewsCount: number;
  hasLiked?: boolean;
  hasSaved?: boolean;
  isFollowing?: boolean;
  createdAt: string;
  tags?: string[];
}

export interface StoryItem {
  id: string;
  userId: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  caption?: string;
  sticker?: string;
  createdAt: string;
  expiresAt: string; // 24 hours from creation
  seenBy: string[];
}

export interface UserStoryGroup {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  stories: StoryItem[];
  hasUnseen: boolean;
}

const STORAGE_KEYS = {
  REELS: "vidalore_reels_v3",
  REEL_COMMENTS: "vidalore_reel_comments_v3",
  STORIES: "vidalore_stories_v3",
};

// High-fidelity curated reels matching the Rose Garden aesthetic
const SEED_REELS: ReelItem[] = [
  {
    id: "reel-1",
    creatorId: "creator-celeste",
    creatorName: "Celeste Moreau",
    creatorUsername: "celeste",
    creatorAvatarUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80",
    creatorVerified: true,
    // Web-friendly reliable vertical sample video
    videoUrl:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    caption:
      "The midnight conservatory illuminated under pink neon. Velvet petals opening to the night breeze. 🌹✨ #RoseGarden #MidnightVibes #Aesthetic",
    audioTitle: "Celeste Moreau — Midnight Blooms (Original Sound)",
    likesCount: 1840,
    commentsCount: 142,
    sharesCount: 88,
    savesCount: 310,
    viewsCount: 14200,
    hasLiked: false,
    hasSaved: false,
    isFollowing: true,
    createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    tags: ["RoseGarden", "MidnightVibes", "Aesthetic"],
  },
  {
    id: "reel-2",
    creatorId: "creator-raphael",
    creatorName: "Raphaël Vance",
    creatorUsername: "raphael",
    creatorAvatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80",
    creatorVerified: true,
    videoUrl:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    caption:
      "Golden hour textures across velvet burgundy tailoring. Moving through Milan before dusk falls. 🍷 #VidaloreStyle #Editorial #VelvetHours",
    audioTitle: "Raphaël Vance — Velvet Noir (Milan Sessions)",
    likesCount: 2420,
    commentsCount: 198,
    sharesCount: 164,
    savesCount: 520,
    viewsCount: 22800,
    hasLiked: true,
    hasSaved: true,
    isFollowing: true,
    createdAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    tags: ["VidaloreStyle", "Editorial", "VelvetHours"],
  },
  {
    id: "reel-3",
    creatorId: "creator-seraphina",
    creatorName: "Seraphina Lin",
    creatorUsername: "seraphina",
    creatorAvatarUrl:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=240&auto=format&fit=crop&q=80",
    creatorVerified: false,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    caption:
      "Acoustic strings & dark ambient piano in Studio Noir. Headphones recommended for deep bass reverb. 🎹🌹 #Acoustic #DarkAmbient #Creatives",
    audioTitle: "Seraphina Lin — Petals in the Dark (Acoustic)",
    likesCount: 960,
    commentsCount: 84,
    sharesCount: 45,
    savesCount: 215,
    viewsCount: 8900,
    hasLiked: false,
    hasSaved: false,
    isFollowing: false,
    createdAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
    tags: ["Acoustic", "DarkAmbient", "Creatives"],
  },
];

const SEED_REEL_COMMENTS: ReelComment[] = [
  {
    id: "rc-1",
    reelId: "reel-1",
    authorId: "creator-raphael",
    authorName: "Raphaël Vance",
    authorUsername: "raphael",
    authorAvatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80",
    content:
      "The lighting in this reel is utterly hypnotic Celeste! That pink backlight is pure art 🌹",
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    reactionsCount: 28,
    hasReacted: true,
  },
  {
    id: "rc-2",
    reelId: "reel-1",
    authorId: "creator-seraphina",
    authorName: "Seraphina Lin",
    authorUsername: "seraphina",
    authorAvatarUrl:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=240&auto=format&fit=crop&q=80",
    content: "The audio ambience pairs with the visuals so seamlessly. Enchanting work ✨",
    createdAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    reactionsCount: 12,
    hasReacted: false,
  },
];

const SEED_STORIES: StoryItem[] = [
  {
    id: "story-1",
    userId: "creator-celeste",
    mediaUrl:
      "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1080&auto=format&fit=crop&q=85",
    mediaType: "image",
    caption: "Early dawn in the greenhouse 🌹",
    sticker: "🌹",
    createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 21 * 3600 * 1000).toISOString(),
    seenBy: [],
  },
  {
    id: "story-2",
    userId: "creator-celeste",
    mediaUrl:
      "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=1080&auto=format&fit=crop&q=85",
    mediaType: "image",
    caption: "Rose water infusions for the evening reception ✨",
    sticker: "✨",
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 22 * 3600 * 1000).toISOString(),
    seenBy: [],
  },
  {
    id: "story-3",
    userId: "creator-raphael",
    mediaUrl:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1080&auto=format&fit=crop&q=85",
    mediaType: "image",
    caption: "Pre-shoot lighting test in Milano 🍷",
    sticker: "🍷",
    createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 19 * 3600 * 1000).toISOString(),
    seenBy: [],
  },
  {
    id: "story-4",
    userId: "creator-seraphina",
    mediaUrl:
      "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1080&auto=format&fit=crop&q=85",
    mediaType: "image",
    caption: "Arranging track 4 under crimson neon 🎹",
    sticker: "🌙",
    createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 18 * 3600 * 1000).toISOString(),
    seenBy: [],
  },
];

function getLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function setLocal<T>(key: string, val: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
    window.dispatchEvent(new Event("vidalore:reels-updated"));
  } catch {
    // quota
  }
}

// Reels API
export function getStoredReels(): ReelItem[] {
  return getLocal<ReelItem[]>(STORAGE_KEYS.REELS, SEED_REELS);
}

export function saveStoredReels(reels: ReelItem[]): void {
  setLocal(STORAGE_KEYS.REELS, reels);
}

export function toggleReelLike(reelId: string): ReelItem | undefined {
  const reels = getStoredReels();
  const reel = reels.find((r) => r.id === reelId);
  if (!reel) return undefined;

  const nextLiked = !reel.hasLiked;
  reel.hasLiked = nextLiked;
  reel.likesCount = Math.max(0, reel.likesCount + (nextLiked ? 1 : -1));
  saveStoredReels([...reels]);
  return reel;
}

export function toggleReelSave(reelId: string): boolean {
  const reels = getStoredReels();
  const reel = reels.find((r) => r.id === reelId);
  if (!reel) return false;

  const nextSaved = !reel.hasSaved;
  reel.hasSaved = nextSaved;
  reel.savesCount = Math.max(0, reel.savesCount + (nextSaved ? 1 : -1));
  saveStoredReels([...reels]);
  return nextSaved;
}

export function addReel(
  me: Profile,
  data: {
    videoUrl: string;
    caption: string;
    audioTitle?: string;
    tags?: string[];
  },
): ReelItem {
  const reels = getStoredReels();
  const newReel: ReelItem = {
    id: `reel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    creatorId: me.id,
    creatorName: me.display_name || me.username,
    creatorUsername: me.username,
    creatorAvatarUrl: me.avatar_url,
    creatorVerified: true,
    videoUrl: data.videoUrl,
    caption: data.caption,
    audioTitle: data.audioTitle || `${me.display_name || me.username} — Original Sound 🌹`,
    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    savesCount: 0,
    viewsCount: 1,
    hasLiked: false,
    hasSaved: false,
    isFollowing: false,
    createdAt: new Date().toISOString(),
    tags: data.tags ?? [],
  };

  saveStoredReels([newReel, ...reels]);
  return newReel;
}

// Reel Comments API
export function getReelComments(reelId: string): ReelComment[] {
  const all = getLocal<ReelComment[]>(STORAGE_KEYS.REEL_COMMENTS, SEED_REEL_COMMENTS);
  return all.filter((c) => c.reelId === reelId);
}

export function addReelComment(me: Profile, reelId: string, content: string): ReelComment {
  const all = getLocal<ReelComment[]>(STORAGE_KEYS.REEL_COMMENTS, SEED_REEL_COMMENTS);
  const newComment: ReelComment = {
    id: `rc-${Date.now()}`,
    reelId,
    authorId: me.id,
    authorName: me.display_name || me.username,
    authorUsername: me.username,
    authorAvatarUrl: me.avatar_url,
    content: content.trim(),
    createdAt: new Date().toISOString(),
    reactionsCount: 0,
    hasReacted: false,
  };

  setLocal(STORAGE_KEYS.REEL_COMMENTS, [...all, newComment]);

  // increment reel comment count
  const reels = getStoredReels();
  const reel = reels.find((r) => r.id === reelId);
  if (reel) {
    reel.commentsCount += 1;
    saveStoredReels([...reels]);
  }

  return newComment;
}

// Stories API (with strict 24-hour visual expiry)
export function getStoredStories(): StoryItem[] {
  const raw = getLocal<StoryItem[]>(STORAGE_KEYS.STORIES, SEED_STORIES);
  const now = Date.now();
  // Filter out any story created more than 24 hours ago
  return raw.filter((s) => new Date(s.expiresAt).getTime() > now);
}

export function saveStoredStories(stories: StoryItem[]): void {
  setLocal(STORAGE_KEYS.STORIES, stories);
}

export function addStory(
  me: Profile,
  data: {
    mediaUrl: string;
    mediaType: "image" | "video";
    caption?: string;
    sticker?: string;
  },
): StoryItem {
  const stories = getStoredStories();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();

  const newStory: StoryItem = {
    id: `story-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId: me.id,
    mediaUrl: data.mediaUrl,
    mediaType: data.mediaType,
    caption: data.caption,
    sticker: data.sticker,
    createdAt: now.toISOString(),
    expiresAt,
    seenBy: [me.id],
  };

  saveStoredStories([newStory, ...stories]);
  return newStory;
}

export function markStorySeen(storyId: string, userId: string): void {
  const stories = getStoredStories();
  const s = stories.find((item) => item.id === storyId);
  if (s && !s.seenBy.includes(userId)) {
    s.seenBy.push(userId);
    saveStoredStories([...stories]);
  }
}
