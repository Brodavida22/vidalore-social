import { queryOptions } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateDirectConversation, sendMessage } from "@/services/messages";

export type GameSlug =
  | "quiz-battle"
  | "truth-or-dare"
  | "would-you-rather"
  | "word-challenge"
  | "emoji-challenge"
  | "tic-tac-toe"
  | "rock-paper-scissors"
  | "meme-challenge"
  | "music-guessing"
  | "daily-challenges";

export type GameCategory =
  "All" | "Trivia" | "Party" | "Strategy" | "Word & Puzzle" | "Creative" | "Daily";

export interface GameDefinition {
  slug: GameSlug;
  title: string;
  description: string;
  category: Exclude<GameCategory, "All">;
  isEnabled: boolean;
  isFeatured: boolean;
  isPopular: boolean;
  xpReward: number;
  pointsReward: number;
  minPlayers: number;
  maxPlayers: number;
  playCount: number;
  supportsSolo: boolean;
  supportsMultiplayer: boolean;
  estimatedMinutes: string;
}

export interface GameQuestion {
  id: string;
  gameSlug: GameSlug;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  prompt: string;
  options: string[];
  correctAnswer: string;
  hint?: string | undefined;
  clueMeta?:
    | {
        melody?: number[];
        artist?: string;
        era?: string;
        genre?: string;
        type?: "truth" | "dare" | "scramble" | "spelling" | "wordle";
        intensity?: "chill" | "bold" | "creator";
      }
    | undefined;
  isActive: boolean;
}

export interface GameRoomPlayer {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  score: number;
  isReady: boolean;
  isHost: boolean;
  joinedAt: string;
}

export interface GameRoom {
  id: string;
  roomCode: string;
  gameSlug: GameSlug;
  hostId: string;
  hostUsername: string;
  visibility: "public" | "private";
  status: "waiting" | "active" | "finished";
  currentRound: number;
  totalRounds: number;
  roundEndsAt: string | null;
  winnerId: string | null;
  players: GameRoomPlayer[];
  state: Record<string, unknown>;
  createdAt: string;
}

export interface GameSessionRecord {
  id: string;
  gameSlug: GameSlug;
  gameTitle: string;
  mode: "solo" | "ai" | "multiplayer";
  result: "win" | "loss" | "draw" | "completed";
  score: number;
  xpEarned: number;
  pointsEarned: number;
  durationSeconds: number;
  createdAt: string;
}

export interface UserGameProfile {
  userId: string;
  xp: number;
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPct: number;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  totalPointsEarned: number;
  recentlyPlayedSlugs: GameSlug[];
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  xp: number;
  level: number;
  gamesWon: number;
  gamesPlayed: number;
  pointsBalance: number;
}

export interface OnlinePlayer {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  activity: string;
  roomCode?: string | undefined;
  onlineAt: string;
}

export interface MemeSubmission {
  id: string;
  roomId: string | null;
  userId: string;
  authorUsername: string;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  prompt: string;
  templateId: string;
  topText: string;
  bottomText: string;
  imageUrl?: string | null | undefined;
  votesCount: number;
  hasVoted: boolean;
  createdAt: string;
}

export interface DailyChallenge {
  id: string;
  challengeDate: string;
  gameSlug: GameSlug;
  title: string;
  description: string;
  targetScore: number;
  rewardXp: number;
  rewardPoints: number;
  progress: number;
  completed: boolean;
  rewardClaimed: boolean;
}

export const gamesKeys = {
  all: ["games"] as const,
  catalog: () => ["games", "catalog"] as const,
  questions: (slug?: GameSlug) => ["games", "questions", slug ?? "all"] as const,
  rooms: () => ["games", "rooms"] as const,
  profile: (userId?: string) => ["games", "profile", userId ?? "me"] as const,
  history: (userId?: string) => ["games", "history", userId ?? "me"] as const,
  leaderboard: () => ["games", "leaderboard"] as const,
  memes: () => ["games", "memes"] as const,
  daily: (userId?: string) => ["games", "daily", userId ?? "me"] as const,
};

// ============================================================================
// DEFAULT CATALOG & RICH GAME CONTENT
// ============================================================================

export const DEFAULT_GAMES_CATALOG: GameDefinition[] = [
  {
    slug: "quiz-battle",
    title: "Quiz Battle",
    description: "Timed multi-round trivia showdown with speed bonuses and live leaderboards.",
    category: "Trivia",
    isEnabled: true,
    isFeatured: true,
    isPopular: true,
    xpReward: 60,
    pointsReward: 20,
    minPlayers: 1,
    maxPlayers: 8,
    playCount: 412,
    supportsSolo: true,
    supportsMultiplayer: true,
    estimatedMinutes: "2 min",
  },
  {
    slug: "truth-or-dare",
    title: "Truth or Dare",
    description: "Multiplayer party prompts with turn rotation, boldness tiers, and crowd points.",
    category: "Party",
    isEnabled: true,
    isFeatured: true,
    isPopular: true,
    xpReward: 40,
    pointsReward: 10,
    minPlayers: 1,
    maxPlayers: 10,
    playCount: 358,
    supportsSolo: true,
    supportsMultiplayer: true,
    estimatedMinutes: "3-5 min",
  },
  {
    slug: "would-you-rather",
    title: "Would You Rather",
    description: "Two tough choices. Vote live and compare room consensus with friends.",
    category: "Party",
    isEnabled: true,
    isFeatured: false,
    isPopular: true,
    xpReward: 35,
    pointsReward: 10,
    minPlayers: 1,
    maxPlayers: 12,
    playCount: 294,
    supportsSolo: true,
    supportsMultiplayer: true,
    estimatedMinutes: "2 min",
  },
  {
    slug: "word-challenge",
    title: "Word Challenge",
    description: "Word scramble sprints, spelling challenges, and 5-letter word guessing.",
    category: "Word & Puzzle",
    isEnabled: true,
    isFeatured: true,
    isPopular: true,
    xpReward: 55,
    pointsReward: 15,
    minPlayers: 1,
    maxPlayers: 6,
    playCount: 339,
    supportsSolo: true,
    supportsMultiplayer: true,
    estimatedMinutes: "2-3 min",
  },
  {
    slug: "emoji-challenge",
    title: "Emoji Challenge",
    description: "Decode movies, objects, idioms, and phrases from curated emoji sequences.",
    category: "Trivia",
    isEnabled: true,
    isFeatured: false,
    isPopular: false,
    xpReward: 50,
    pointsReward: 15,
    minPlayers: 1,
    maxPlayers: 8,
    playCount: 247,
    supportsSolo: true,
    supportsMultiplayer: true,
    estimatedMinutes: "2 min",
  },
  {
    slug: "tic-tac-toe",
    title: "Tic-Tac-Toe",
    description: "Classic 3x3 strategy against an adaptive AI or live friend duel.",
    category: "Strategy",
    isEnabled: true,
    isFeatured: false,
    isPopular: true,
    xpReward: 45,
    pointsReward: 15,
    minPlayers: 1,
    maxPlayers: 2,
    playCount: 510,
    supportsSolo: true,
    supportsMultiplayer: true,
    estimatedMinutes: "1 min",
  },
  {
    slug: "rock-paper-scissors",
    title: "Rock Paper Scissors",
    description: "Simultaneous Best-of-5 showdown against another player or CPU.",
    category: "Strategy",
    isEnabled: true,
    isFeatured: false,
    isPopular: false,
    xpReward: 40,
    pointsReward: 12,
    minPlayers: 1,
    maxPlayers: 2,
    playCount: 276,
    supportsSolo: true,
    supportsMultiplayer: true,
    estimatedMinutes: "1 min",
  },
  {
    slug: "meme-challenge",
    title: "Meme Challenge",
    description: "Craft punchlines on templates, drop them to the gallery, and vote for the best.",
    category: "Creative",
    isEnabled: true,
    isFeatured: true,
    isPopular: true,
    xpReward: 65,
    pointsReward: 20,
    minPlayers: 1,
    maxPlayers: 12,
    playCount: 382,
    supportsSolo: true,
    supportsMultiplayer: true,
    estimatedMinutes: "3 min",
  },
  {
    slug: "music-guessing",
    title: "Music Guessing",
    description:
      "Identify iconic songs from lyric clues, melody previews, and custom friend hints.",
    category: "Trivia",
    isEnabled: true,
    isFeatured: false,
    isPopular: false,
    xpReward: 55,
    pointsReward: 15,
    minPlayers: 1,
    maxPlayers: 8,
    playCount: 215,
    supportsSolo: true,
    supportsMultiplayer: true,
    estimatedMinutes: "2-3 min",
  },
  {
    slug: "daily-challenges",
    title: "Daily Challenges",
    description: "Fresh daily missions across VIDALORE games to earn bonus XP and VIDA Points.",
    category: "Daily",
    isEnabled: true,
    isFeatured: true,
    isPopular: true,
    xpReward: 80,
    pointsReward: 25,
    minPlayers: 1,
    maxPlayers: 1,
    playCount: 445,
    supportsSolo: true,
    supportsMultiplayer: false,
    estimatedMinutes: "Daily",
  },
];

export const DEFAULT_QUESTIONS: GameQuestion[] = [
  // Quiz Battle
  {
    id: "qb-1",
    gameSlug: "quiz-battle",
    category: "Science",
    difficulty: "easy",
    prompt: "Which planet has the most prominent ring system in our solar system?",
    options: ["Mars", "Saturn", "Venus", "Mercury"],
    correctAnswer: "Saturn",
    hint: "Sixth planet from the Sun.",
    isActive: true,
  },
  {
    id: "qb-2",
    gameSlug: "quiz-battle",
    category: "Technology",
    difficulty: "medium",
    prompt: "What does HTTP stand for on the World Wide Web?",
    options: [
      "HyperText Transfer Protocol",
      "High Transmission Text Path",
      "Host Terminal Transport Port",
      "Hyperlink Tracking Tool Protocol",
    ],
    correctAnswer: "HyperText Transfer Protocol",
    hint: "Foundation of data communication on the web.",
    isActive: true,
  },
  {
    id: "qb-3",
    gameSlug: "quiz-battle",
    category: "Pop Culture",
    difficulty: "easy",
    prompt: "Which studio released the animated film 'Spider-Man: Into the Spider-Verse'?",
    options: ["Pixar", "Sony Pictures Animation", "DreamWorks", "Illumination"],
    correctAnswer: "Sony Pictures Animation",
    hint: "Released in 2018 with comic-book halftone styling.",
    isActive: true,
  },
  {
    id: "qb-4",
    gameSlug: "quiz-battle",
    category: "Geography",
    difficulty: "medium",
    prompt: "Which city is split between Europe and Asia across the Bosphorus Strait?",
    options: ["Athens", "Istanbul", "Baku", "Tbilisi"],
    correctAnswer: "Istanbul",
    hint: "Largest city in Turkey.",
    isActive: true,
  },
  {
    id: "qb-5",
    gameSlug: "quiz-battle",
    category: "Science",
    difficulty: "medium",
    prompt: "What is the chemical symbol for Gold on the periodic table?",
    options: ["Gd", "Go", "Au", "Ag"],
    correctAnswer: "Au",
    hint: "From the Latin word 'aurum'.",
    isActive: true,
  },
  {
    id: "qb-6",
    gameSlug: "quiz-battle",
    category: "Music",
    difficulty: "easy",
    prompt: "How many keys are on a standard full-size piano?",
    options: ["76", "84", "88", "92"],
    correctAnswer: "88",
    hint: "52 white and 36 black keys.",
    isActive: true,
  },
  {
    id: "qb-7",
    gameSlug: "quiz-battle",
    category: "Technology",
    difficulty: "hard",
    prompt: "Who is widely credited with writing the first algorithm intended for a machine?",
    options: ["Alan Turing", "Ada Lovelace", "Grace Hopper", "Tim Berners-Lee"],
    correctAnswer: "Ada Lovelace",
    hint: "Worked on Charles Babbage's Analytical Engine.",
    isActive: true,
  },
  {
    id: "qb-8",
    gameSlug: "quiz-battle",
    category: "General",
    difficulty: "easy",
    prompt: "Which ocean is the largest and deepest on Earth?",
    options: ["Atlantic Ocean", "Indian Ocean", "Pacific Ocean", "Arctic Ocean"],
    correctAnswer: "Pacific Ocean",
    hint: "Covers roughly one-third of Earth's surface.",
    isActive: true,
  },

  // Truth or Dare
  {
    id: "tod-t1",
    gameSlug: "truth-or-dare",
    category: "Truth",
    difficulty: "easy",
    prompt: "What is the most unexpected song on your current workout or chill playlist?",
    options: [],
    correctAnswer: "",
    clueMeta: { type: "truth", intensity: "chill" },
    isActive: true,
  },
  {
    id: "tod-t2",
    gameSlug: "truth-or-dare",
    category: "Truth",
    difficulty: "medium",
    prompt: "Which trend did you secretly love even after pretending it wasn't your style?",
    options: [],
    correctAnswer: "",
    clueMeta: { type: "truth", intensity: "chill" },
    isActive: true,
  },
  {
    id: "tod-t3",
    gameSlug: "truth-or-dare",
    category: "Truth",
    difficulty: "medium",
    prompt: "Who in this room would survive the longest in a zombie apocalypse, and why?",
    options: [],
    correctAnswer: "",
    clueMeta: { type: "truth", intensity: "bold" },
    isActive: true,
  },
  {
    id: "tod-t4",
    gameSlug: "truth-or-dare",
    category: "Truth",
    difficulty: "easy",
    prompt: "What is the longest streak you've ever kept on a hobby or habit?",
    options: [],
    correctAnswer: "",
    clueMeta: { type: "truth", intensity: "creator" },
    isActive: true,
  },
  {
    id: "tod-d1",
    gameSlug: "truth-or-dare",
    category: "Dare",
    difficulty: "easy",
    prompt: "Drop a 5-word motivational hype post or voice note in your next chat!",
    options: [],
    correctAnswer: "",
    clueMeta: { type: "dare", intensity: "chill" },
    isActive: true,
  },
  {
    id: "tod-d2",
    gameSlug: "truth-or-dare",
    category: "Dare",
    difficulty: "medium",
    prompt: "Describe your favorite movie using ONLY 4 emojis in the room chat.",
    options: [],
    correctAnswer: "",
    clueMeta: { type: "dare", intensity: "creator" },
    isActive: true,
  },
  {
    id: "tod-d3",
    gameSlug: "truth-or-dare",
    category: "Dare",
    difficulty: "medium",
    prompt: "Give every player in this game room a genuine one-sentence compliment.",
    options: [],
    correctAnswer: "",
    clueMeta: { type: "dare", intensity: "chill" },
    isActive: true,
  },
  {
    id: "tod-d4",
    gameSlug: "truth-or-dare",
    category: "Dare",
    difficulty: "hard",
    prompt: "Invent a 10-second brand commercial for the last object you touched.",
    options: [],
    correctAnswer: "",
    clueMeta: { type: "dare", intensity: "bold" },
    isActive: true,
  },

  // Would You Rather
  {
    id: "wyr-1",
    gameSlug: "would-you-rather",
    category: "Lifestyle",
    difficulty: "easy",
    prompt: "Which superpower fits your life better?",
    options: ["Speak and understand every language fluently", "Teleport to any city once a day"],
    correctAnswer: "",
    isActive: true,
  },
  {
    id: "wyr-2",
    gameSlug: "would-you-rather",
    category: "Creator",
    difficulty: "easy",
    prompt: "For your next big creative project:",
    options: [
      "Go viral overnight with 1M views once",
      "Build a loyal 10K community that never misses a post",
    ],
    correctAnswer: "",
    isActive: true,
  },
  {
    id: "wyr-3",
    gameSlug: "would-you-rather",
    category: "Time",
    difficulty: "medium",
    prompt: "If you got a one-way time ticket:",
    options: [
      "Visit 100 years in the future for one day",
      "Revisit any favorite day from your past",
    ],
    correctAnswer: "",
    isActive: true,
  },
  {
    id: "wyr-4",
    gameSlug: "would-you-rather",
    category: "Daily",
    difficulty: "easy",
    prompt: "Which morning upgrade would you lock in forever?",
    options: [
      "Unlimited barista coffee & breakfast for life",
      "Zero traffic and instant green lights everywhere",
    ],
    correctAnswer: "",
    isActive: true,
  },
  {
    id: "wyr-5",
    gameSlug: "would-you-rather",
    category: "Music",
    difficulty: "easy",
    prompt: "Soundtrack choice:",
    options: [
      "Every room plays your personal hype theme when you enter",
      "Play any instrument at concert level instantly",
    ],
    correctAnswer: "",
    isActive: true,
  },

  // Word Challenge
  {
    id: "wc-1",
    gameSlug: "word-challenge",
    category: "Vocabulary",
    difficulty: "easy",
    prompt: "CREATOR",
    options: [],
    correctAnswer: "CREATOR",
    hint: "Someone who makes posts, videos, or art.",
    clueMeta: { type: "scramble" },
    isActive: true,
  },
  {
    id: "wc-2",
    gameSlug: "word-challenge",
    category: "Social",
    difficulty: "easy",
    prompt: "STREAK",
    options: [],
    correctAnswer: "STREAK",
    hint: "Consecutive wins or daily check-ins.",
    clueMeta: { type: "scramble" },
    isActive: true,
  },
  {
    id: "wc-3",
    gameSlug: "word-challenge",
    category: "Tech",
    difficulty: "medium",
    prompt: "QUANTUM",
    options: [],
    correctAnswer: "QUANTUM",
    hint: "Physics of the tiniest packets of energy.",
    clueMeta: { type: "scramble" },
    isActive: true,
  },
  {
    id: "wc-4",
    gameSlug: "word-challenge",
    category: "Culture",
    difficulty: "medium",
    prompt: "RHYTHM",
    options: [],
    correctAnswer: "RHYTHM",
    hint: "A tricky spelling word about musical beat (no standard vowels!).",
    clueMeta: { type: "spelling" },
    isActive: true,
  },
  {
    id: "wc-5",
    gameSlug: "word-challenge",
    category: "5-Letter",
    difficulty: "medium",
    prompt: "FLAME",
    options: [],
    correctAnswer: "FLAME",
    hint: "5-letter word associated with fire and trending heat.",
    clueMeta: { type: "wordle" },
    isActive: true,
  },
  {
    id: "wc-6",
    gameSlug: "word-challenge",
    category: "5-Letter",
    difficulty: "medium",
    prompt: "SPARK",
    options: [],
    correctAnswer: "SPARK",
    hint: "A tiny flash of inspiration or fire.",
    clueMeta: { type: "wordle" },
    isActive: true,
  },
  {
    id: "wc-7",
    gameSlug: "word-challenge",
    category: "5-Letter",
    difficulty: "medium",
    prompt: "CROWN",
    options: [],
    correctAnswer: "CROWN",
    hint: "Worn by the leaderboard champion.",
    clueMeta: { type: "wordle" },
    isActive: true,
  },
  {
    id: "wc-8",
    gameSlug: "word-challenge",
    category: "5-Letter",
    difficulty: "medium",
    prompt: "VIBES",
    options: [],
    correctAnswer: "VIBES",
    hint: "The energy or mood of a room.",
    clueMeta: { type: "wordle" },
    isActive: true,
  },

  // Emoji Challenge
  {
    id: "em-1",
    gameSlug: "emoji-challenge",
    category: "Movies",
    difficulty: "easy",
    prompt: "🦁👑🌅",
    options: ["The Lion King", "Jungle Book", "Madagascar", "Tarzan"],
    correctAnswer: "The Lion King",
    hint: "1994 animated Disney classic.",
    isActive: true,
  },
  {
    id: "em-2",
    gameSlug: "emoji-challenge",
    category: "Movies",
    difficulty: "easy",
    prompt: "🕷️🧑🏾‍🎓🕸️🌆",
    options: ["Spider-Man", "Venom", "Batman", "Ant-Man"],
    correctAnswer: "Spider-Man",
    hint: "Friendly neighborhood hero.",
    isActive: true,
  },
  {
    id: "em-3",
    gameSlug: "emoji-challenge",
    category: "Expressions",
    difficulty: "medium",
    prompt: "☕📖🌧️",
    options: ["Coffee Break", "Rainy Day Read", "Morning Brew", "Stormy Tea"],
    correctAnswer: "Rainy Day Read",
    hint: "Cozy activity when it pours outside.",
    isActive: true,
  },
  {
    id: "em-4",
    gameSlug: "emoji-challenge",
    category: "Objects",
    difficulty: "easy",
    prompt: "🎧🎶📱",
    options: ["Music Streaming", "Podcast Mic", "Radio Tower", "Vinyl Player"],
    correctAnswer: "Music Streaming",
    hint: "Listening to tracks on your phone.",
    isActive: true,
  },
  {
    id: "em-5",
    gameSlug: "emoji-challenge",
    category: "Phrases",
    difficulty: "medium",
    prompt: "⏰💰",
    options: ["Time Is Money", "Payday Soon", "Late Fee", "Golden Hour"],
    correctAnswer: "Time Is Money",
    hint: "Classic productivity idiom.",
    isActive: true,
  },
  {
    id: "em-6",
    gameSlug: "emoji-challenge",
    category: "Movies",
    difficulty: "medium",
    prompt: "🚢❄️💔",
    options: ["Titanic", "Frozen", "Ice Age", "Cast Away"],
    correctAnswer: "Titanic",
    hint: "Unforgettable 1997 ocean liner drama.",
    isActive: true,
  },

  // Music Guessing
  {
    id: "mg-1",
    gameSlug: "music-guessing",
    category: "Synth Pop",
    difficulty: "easy",
    prompt:
      "\"I said, ooh, I'm blinded by the lights — no, I can't sleep until I feel your touch.\"",
    options: ["Blinding Lights", "Starboy", "Save Your Tears", "After Hours"],
    correctAnswer: "Blinding Lights",
    hint: "2019 megahit by The Weeknd.",
    clueMeta: {
      artist: "The Weeknd",
      era: "2019",
      genre: "Synth-pop",
      melody: [440, 440, 392, 440, 493.88, 329.63],
    },
    isActive: true,
  },
  {
    id: "mg-2",
    gameSlug: "music-guessing",
    category: "Afrobeats",
    difficulty: "easy",
    prompt: '"Baby, calm down, calm down — girl, this your body e put my heart for lockdown."',
    options: ["Calm Down", "Last Last", "Essence", "Peru"],
    correctAnswer: "Calm Down",
    hint: "Global Afrobeats hit by Rema (& Selena Gomez).",
    clueMeta: {
      artist: "Rema",
      era: "2022",
      genre: "Afrobeats",
      melody: [392, 440, 493.88, 440, 392, 329.63],
    },
    isActive: true,
  },
  {
    id: "mg-3",
    gameSlug: "music-guessing",
    category: "Pop",
    difficulty: "easy",
    prompt: '"I can buy myself flowers, write my name in the sand."',
    options: ["Flowers", "Wrecking Ball", "Anti-Hero", "Levitating"],
    correctAnswer: "Flowers",
    hint: "2023 anthem by Miley Cyrus.",
    clueMeta: {
      artist: "Miley Cyrus",
      era: "2023",
      genre: "Disco-pop",
      melody: [329.63, 392, 440, 392, 523.25, 493.88],
    },
    isActive: true,
  },
  {
    id: "mg-4",
    gameSlug: "music-guessing",
    category: "Classics",
    difficulty: "medium",
    prompt: '"Is this the real life? Is this just fantasy? Caught in a landslide..."',
    options: ["Bohemian Rhapsody", "Don't Stop Me Now", "We Will Rock You", "Somebody to Love"],
    correctAnswer: "Bohemian Rhapsody",
    hint: "1975 rock opera masterpiece by Queen.",
    clueMeta: {
      artist: "Queen",
      era: "1975",
      genre: "Classic Rock",
      melody: [466.16, 440, 466.16, 523.25, 466.16, 392],
    },
    isActive: true,
  },
  {
    id: "mg-5",
    gameSlug: "music-guessing",
    category: "R&B",
    difficulty: "medium",
    prompt: '"You don\'t need no other body — only you can give me that feeling."',
    options: ["Essence", "Love Nwantiti", "Peaches", "Snooze"],
    correctAnswer: "Essence",
    hint: "2020 collaboration by Wizkid feat. Tems.",
    clueMeta: {
      artist: "Wizkid ft. Tems",
      era: "2020",
      genre: "Afro-R&B",
      melody: [349.23, 392, 440, 392, 349.23, 293.66],
    },
    isActive: true,
  },
];

export const MEME_PROMPTS = [
  "When the group chat agrees on a hangout time and nobody cancels",
  "Me explaining my 3 AM creative idea to my friends",
  "Checking my VIDA Points after winning a 5-game streak",
  "When the Wi-Fi drops right before the final Quiz Battle question",
  "Opening VIDALORE Reels for 'just 5 minutes' before sleep",
  "That moment you top the weekly Games Center leaderboard",
];

export const MEME_TEMPLATES = [
  {
    id: "neon-dark",
    name: "Midnight Club",
    bg: "from-zinc-950 via-zinc-900 to-[#E91E63]/30",
    text: "text-white",
  },
  {
    id: "crimson-pop",
    name: "Rose Hype",
    bg: "from-[#E91E63] via-[#C2185B] to-zinc-950",
    text: "text-white",
  },
  {
    id: "gold-trophy",
    name: "Gold Champion",
    bg: "from-amber-950 via-zinc-900 to-amber-700/40",
    text: "text-amber-50",
  },
  {
    id: "emerald-win",
    name: "Emerald Grid",
    bg: "from-emerald-950 via-zinc-900 to-emerald-700/40",
    text: "text-emerald-50",
  },
];

// ============================================================================
// PURE GAME LOGIC ENGINES (DETERMINISTIC & TESTABLE)
// ============================================================================

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function sanitizeGameScore(rawScore: number): number {
  if (!Number.isFinite(rawScore)) return 0;
  return Math.max(0, Math.min(5000, Math.round(rawScore)));
}

export function calculatePlayerLevel(xp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPct: number;
} {
  const safeXp = Math.max(0, Math.floor(xp));
  const level = Math.max(1, Math.floor(Math.sqrt(safeXp / 100)) + 1);
  const currentLevelFloor = Math.pow(level - 1, 2) * 100;
  const nextLevelFloor = Math.pow(level, 2) * 100;
  const span = Math.max(1, nextLevelFloor - currentLevelFloor);
  const currentLevelXp = safeXp - currentLevelFloor;
  const progressPct = Math.min(100, Math.max(0, Math.round((currentLevelXp / span) * 100)));
  return {
    level,
    currentLevelXp,
    nextLevelXp: nextLevelFloor - currentLevelFloor,
    progressPct,
  };
}

export type TicTacToeCell = "X" | "O" | null;

export function evaluateTicTacToe(board: TicTacToeCell[]): {
  winner: "X" | "O" | "draw" | null;
  line: number[] | null;
} {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  for (const line of lines) {
    const [a, b, c] = line;
    if (a !== undefined && b !== undefined && c !== undefined) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a], line };
      }
    }
  }

  if (board.every((cell) => cell !== null)) {
    return { winner: "draw", line: null };
  }

  return { winner: null, line: null };
}

export function chooseTicTacToeAiMove(
  board: TicTacToeCell[],
  aiMark: "X" | "O" = "O",
  difficulty: "casual" | "smart" = "smart",
): number {
  const humanMark: "X" | "O" = aiMark === "O" ? "X" : "O";
  const emptyIndices = board
    .map((val, idx) => (val === null ? idx : -1))
    .filter((idx) => idx !== -1);

  if (emptyIndices.length === 0) return -1;

  if (difficulty === "casual" && Math.random() < 0.45) {
    return emptyIndices[Math.floor(Math.random() * emptyIndices.length)]!;
  }

  function minimax(state: TicTacToeCell[], depth: number, isMax: boolean): number {
    const res = evaluateTicTacToe(state);
    if (res.winner === aiMark) return 10 - depth;
    if (res.winner === humanMark) return depth - 10;
    if (res.winner === "draw") return 0;

    let best = isMax ? -Infinity : Infinity;
    for (let i = 0; i < 9; i++) {
      if (state[i] === null) {
        state[i] = isMax ? aiMark : humanMark;
        const score = minimax(state, depth + 1, !isMax);
        state[i] = null;
        best = isMax ? Math.max(best, score) : Math.min(best, score);
      }
    }
    return best;
  }

  let bestScore = -Infinity;
  let bestMoves: number[] = [];
  for (const idx of emptyIndices) {
    const copy = [...board];
    copy[idx] = aiMark;
    const score = minimax(copy, 0, false);
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [idx];
    } else if (score === bestScore) {
      bestMoves.push(idx);
    }
  }

  return bestMoves[Math.floor(Math.random() * bestMoves.length)] ?? emptyIndices[0]!;
}

export type RpsMove = "rock" | "paper" | "scissors";

export function evaluateRpsRound(moveA: RpsMove, moveB: RpsMove): "a" | "b" | "draw" {
  if (moveA === moveB) return "draw";
  if (
    (moveA === "rock" && moveB === "scissors") ||
    (moveA === "paper" && moveB === "rock") ||
    (moveA === "scissors" && moveB === "paper")
  ) {
    return "a";
  }
  return "b";
}

export type LetterTileState = "correct" | "present" | "absent";

export function evaluateWordGuess(guessRaw: string, targetRaw: string): LetterTileState[] {
  const guess = guessRaw.toUpperCase().split("");
  const target = targetRaw.toUpperCase().split("");
  const result: LetterTileState[] = new Array(target.length).fill("absent");
  const remainingCounts = new Map<string, number>();

  for (let i = 0; i < target.length; i++) {
    if (guess[i] === target[i]) {
      result[i] = "correct";
    } else {
      const ch = target[i]!;
      remainingCounts.set(ch, (remainingCounts.get(ch) ?? 0) + 1);
    }
  }

  for (let i = 0; i < target.length; i++) {
    if (result[i] === "correct") continue;
    const ch = guess[i]!;
    const count = remainingCounts.get(ch) ?? 0;
    if (count > 0) {
      result[i] = "present";
      remainingCounts.set(ch, count - 1);
    }
  }

  return result;
}

export function scrambleWord(word: string): string {
  const clean = word.trim().toUpperCase();
  if (clean.length <= 1) return clean;
  const chars = clean.split("");
  for (let attempt = 0; attempt < 10; attempt++) {
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j]!, chars[i]!];
    }
    if (chars.join("") !== clean) return chars.join("");
  }
  return chars.reverse().join("");
}

export function isFuzzyAnswerMatch(guess: string, target: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const g = normalize(guess);
  const t = normalize(target);
  if (!g || !t) return false;
  return g === t || (g.length >= 4 && t.includes(g));
}

// ============================================================================
// LOCAL RESILIENCE HELPERS (ONLY USED WHEN EXTENDED DB TABLES AREN'T PROVISIONED)
// ============================================================================

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDefaultDailyChallenges(): DailyChallenge[] {
  const today = getTodayDateString();
  const daySeed = Number(today.replace(/-/g, "")) % 3;
  const pool: DailyChallenge[][] = [
    [
      {
        id: `dc-${today}-1`,
        challengeDate: today,
        gameSlug: "quiz-battle",
        title: "Trivia Tactician",
        description: "Score at least 200 points in Quiz Battle today.",
        targetScore: 200,
        rewardXp: 80,
        rewardPoints: 25,
        progress: 0,
        completed: false,
        rewardClaimed: false,
      },
      {
        id: `dc-${today}-2`,
        challengeDate: today,
        gameSlug: "tic-tac-toe",
        title: "Grid Victory",
        description: "Win a match of Tic-Tac-Toe against AI or a friend.",
        targetScore: 100,
        rewardXp: 60,
        rewardPoints: 20,
        progress: 0,
        completed: false,
        rewardClaimed: false,
      },
      {
        id: `dc-${today}-3`,
        challengeDate: today,
        gameSlug: "word-challenge",
        title: "Wordsmith Sprint",
        description: "Complete a Word Challenge round with 150+ score.",
        targetScore: 150,
        rewardXp: 70,
        rewardPoints: 20,
        progress: 0,
        completed: false,
        rewardClaimed: false,
      },
    ],
    [
      {
        id: `dc-${today}-1`,
        challengeDate: today,
        gameSlug: "emoji-challenge",
        title: "Emoji Decoder",
        description: "Score 180+ in Emoji Challenge.",
        targetScore: 180,
        rewardXp: 75,
        rewardPoints: 25,
        progress: 0,
        completed: false,
        rewardClaimed: false,
      },
      {
        id: `dc-${today}-2`,
        challengeDate: today,
        gameSlug: "rock-paper-scissors",
        title: "Best-of-5 Champion",
        description: "Win a Rock Paper Scissors duel.",
        targetScore: 100,
        rewardXp: 60,
        rewardPoints: 20,
        progress: 0,
        completed: false,
        rewardClaimed: false,
      },
      {
        id: `dc-${today}-3`,
        challengeDate: today,
        gameSlug: "meme-challenge",
        title: "Meme Drop",
        description: "Submit an original meme in Meme Challenge.",
        targetScore: 50,
        rewardXp: 65,
        rewardPoints: 20,
        progress: 0,
        completed: false,
        rewardClaimed: false,
      },
    ],
    [
      {
        id: `dc-${today}-1`,
        challengeDate: today,
        gameSlug: "music-guessing",
        title: "Chart Topper",
        description: "Score 160+ in Music Guessing.",
        targetScore: 160,
        rewardXp: 80,
        rewardPoints: 25,
        progress: 0,
        completed: false,
        rewardClaimed: false,
      },
      {
        id: `dc-${today}-2`,
        challengeDate: today,
        gameSlug: "would-you-rather",
        title: "Social Pulse",
        description: "Vote on 3 dilemmas in Would You Rather.",
        targetScore: 60,
        rewardXp: 50,
        rewardPoints: 15,
        progress: 0,
        completed: false,
        rewardClaimed: false,
      },
      {
        id: `dc-${today}-3`,
        challengeDate: today,
        gameSlug: "quiz-battle",
        title: "Speed Scholar",
        description: "Finish a Quiz Battle with 250+ points.",
        targetScore: 250,
        rewardXp: 90,
        rewardPoints: 30,
        progress: 0,
        completed: false,
        rewardClaimed: false,
      },
    ],
  ];
  return pool[daySeed] ?? pool[0]!;
}

function getLocalStorageKey(prefix: string, userId: string): string {
  return `vidalore_games_${prefix}_${userId}`;
}

function readLocalJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalJson<T>(key: string, val: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // ignore quota errors
  }
}

function isMissingRelationError(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    code === "PGRST202" ||
    code === "42883" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("could not find the function")
  );
}

// ============================================================================
// SUPABASE DATA QUERIES & MUTATIONS
// ============================================================================

const dbAny = supabase as unknown as {
  from: (table: string) => ReturnType<typeof supabase.from>;
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>;
};

export async function fetchGamesCatalog(): Promise<{
  games: GameDefinition[];
  usingExtendedSchema: boolean;
}> {
  const { data, error } = await dbAny
    .from("games_catalog")
    .select("*")
    .order("is_featured", { ascending: false });

  if (error || !data || data.length === 0) {
    if (error && !isMissingRelationError(error)) {
      console.warn("Games catalog fetch issue:", error.message);
    }
    return { games: DEFAULT_GAMES_CATALOG, usingExtendedSchema: !error };
  }

  interface CatalogRow {
    slug: string;
    title: string;
    description: string;
    category: string;
    is_enabled: boolean;
    is_featured: boolean;
    xp_reward: number;
    points_reward: number;
    min_players: number;
    max_players: number;
    play_count: number;
  }

  const defaultsBySlug = new Map(DEFAULT_GAMES_CATALOG.map((g) => [g.slug, g]));
  const mapped: GameDefinition[] = (data as unknown as CatalogRow[]).map((row) => {
    const def = defaultsBySlug.get(row.slug as GameSlug);
    return {
      slug: row.slug as GameSlug,
      title: row.title,
      description: row.description,
      category: (row.category as GameDefinition["category"]) || def?.category || "Trivia",
      isEnabled: row.is_enabled,
      isFeatured: row.is_featured,
      isPopular: row.play_count >= 250 || Boolean(def?.isPopular),
      xpReward: row.xp_reward,
      pointsReward: row.points_reward,
      minPlayers: row.min_players,
      maxPlayers: row.max_players,
      playCount: row.play_count,
      supportsSolo: def?.supportsSolo ?? true,
      supportsMultiplayer: def?.supportsMultiplayer ?? true,
      estimatedMinutes: def?.estimatedMinutes ?? "2 min",
    };
  });

  return { games: mapped, usingExtendedSchema: true };
}

export async function fetchGameQuestions(slug?: GameSlug): Promise<GameQuestion[]> {
  let query = dbAny.from("game_questions").select("*").eq("is_active", true);
  if (slug) {
    query = query.eq("game_slug", slug);
  }
  const { data, error } = await query.limit(200);

  const fallback = slug ? DEFAULT_QUESTIONS.filter((q) => q.gameSlug === slug) : DEFAULT_QUESTIONS;

  if (error || !data || data.length === 0) {
    return fallback;
  }

  interface QuestionRow {
    id: string;
    game_slug: string;
    category: string;
    difficulty: "easy" | "medium" | "hard";
    prompt: string;
    options: string[];
    correct_answer: string | null;
    hint: string | null;
    clue_meta: GameQuestion["clueMeta"] | null;
    is_active: boolean;
  }

  const dbQuestions: GameQuestion[] = (data as unknown as QuestionRow[]).map((row) => ({
    id: row.id,
    gameSlug: row.game_slug as GameSlug,
    category: row.category,
    difficulty: row.difficulty,
    prompt: row.prompt,
    options: Array.isArray(row.options) ? row.options : [],
    correctAnswer: row.correct_answer ?? "",
    hint: row.hint ?? undefined,
    clueMeta: row.clue_meta ?? undefined,
    isActive: row.is_active,
  }));

  // Merge custom DB questions with curated bank avoiding duplicate prompts
  const seen = new Set(dbQuestions.map((q) => q.prompt.toLowerCase()));
  return [...dbQuestions, ...fallback.filter((q) => !seen.has(q.prompt.toLowerCase()))];
}

export async function fetchUserGameProfile(): Promise<UserGameProfile> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) {
    return {
      userId: "",
      xp: 0,
      level: 1,
      currentLevelXp: 0,
      nextLevelXp: 100,
      progressPct: 0,
      gamesPlayed: 0,
      gamesWon: 0,
      winRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      totalPointsEarned: 0,
      recentlyPlayedSlugs: [],
    };
  }

  const recentLocal = readLocalJson<GameSlug[]>(getLocalStorageKey("recent", uid), []);

  const { data: statsRow, error } = await dbAny
    .from("user_game_stats")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();

  if (!error && statsRow) {
    const s = statsRow as unknown as {
      xp: number;
      games_played: number;
      games_won: number;
      current_streak: number;
      best_streak: number;
      total_points_earned: number;
    };
    const lvl = calculatePlayerLevel(s.xp);
    return {
      userId: uid,
      xp: s.xp,
      ...lvl,
      gamesPlayed: s.games_played,
      gamesWon: s.games_won,
      winRate: s.games_played > 0 ? Math.round((s.games_won / s.games_played) * 100) : 0,
      currentStreak: s.current_streak,
      bestStreak: s.best_streak,
      totalPointsEarned: s.total_points_earned,
      recentlyPlayedSlugs: recentLocal,
    };
  }

  const localStats = readLocalJson<{
    xp: number;
    gamesPlayed: number;
    gamesWon: number;
    currentStreak: number;
    bestStreak: number;
    totalPointsEarned: number;
  }>(getLocalStorageKey("stats", uid), {
    xp: 0,
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalPointsEarned: 0,
  });

  const lvl = calculatePlayerLevel(localStats.xp);
  return {
    userId: uid,
    xp: localStats.xp,
    ...lvl,
    gamesPlayed: localStats.gamesPlayed,
    gamesWon: localStats.gamesWon,
    winRate:
      localStats.gamesPlayed > 0
        ? Math.round((localStats.gamesWon / localStats.gamesPlayed) * 100)
        : 0,
    currentStreak: localStats.currentStreak,
    bestStreak: localStats.bestStreak,
    totalPointsEarned: localStats.totalPointsEarned,
    recentlyPlayedSlugs: recentLocal,
  };
}

export async function fetchGameHistory(): Promise<GameSessionRecord[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [];

  const titleBySlug = new Map(DEFAULT_GAMES_CATALOG.map((g) => [g.slug, g.title]));

  const { data, error } = await dbAny
    .from("game_sessions")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(30);

  if (!error && data) {
    interface SessionRow {
      id: string;
      game_slug: GameSlug;
      mode: "solo" | "ai" | "multiplayer";
      result: "win" | "loss" | "draw" | "completed";
      score: number;
      xp_earned: number;
      points_earned: number;
      duration_seconds: number;
      created_at: string;
    }
    return (data as unknown as SessionRow[]).map((r) => ({
      id: r.id,
      gameSlug: r.game_slug,
      gameTitle: titleBySlug.get(r.game_slug) ?? r.game_slug,
      mode: r.mode,
      result: r.result,
      score: r.score,
      xpEarned: r.xp_earned,
      pointsEarned: r.points_earned,
      durationSeconds: r.duration_seconds,
      createdAt: r.created_at,
    }));
  }

  return readLocalJson<GameSessionRecord[]>(getLocalStorageKey("history", uid), []);
}

export async function submitGameResult(input: {
  gameSlug: GameSlug;
  mode: "solo" | "ai" | "multiplayer";
  result: "win" | "loss" | "draw" | "completed";
  rawScore: number;
  durationSeconds?: number;
  roomId?: string | null;
  details?: Record<string, unknown>;
}): Promise<{
  xpEarned: number;
  pointsEarned: number;
  totalXp: number;
  level: number;
  persistedViaRpc: boolean;
}> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Sign in to save game progress.");

  const safeScore = sanitizeGameScore(input.rawScore);
  const safeDuration = Math.max(1, Math.min(3600, Math.round(input.durationSeconds ?? 30)));

  // Update recently played list
  const recentKey = getLocalStorageKey("recent", uid);
  const prevRecent = readLocalJson<GameSlug[]>(recentKey, []);
  const nextRecent = [input.gameSlug, ...prevRecent.filter((s) => s !== input.gameSlug)].slice(
    0,
    6,
  );
  writeLocalJson(recentKey, nextRecent);

  // Update daily challenge progress
  await advanceDailyChallengeProgress(uid, input.gameSlug, safeScore, input.result === "win");

  // Authoritative server RPC
  const { data: rpcData, error: rpcError } = await dbAny.rpc("submit_game_session", {
    p_game_slug: input.gameSlug,
    p_mode: input.mode,
    p_result: input.result,
    p_raw_score: safeScore,
    p_duration_seconds: safeDuration,
    p_room_id: input.roomId ?? null,
    p_details: input.details ?? {},
  });

  if (!rpcError && rpcData && typeof rpcData === "object") {
    const res = rpcData as {
      xp_earned?: number;
      points_earned?: number;
      total_xp?: number;
      level?: number;
    };
    return {
      xpEarned: res.xp_earned ?? 0,
      pointsEarned: res.points_earned ?? 0,
      totalXp: res.total_xp ?? 0,
      level: res.level ?? 1,
      persistedViaRpc: true,
    };
  }

  if (rpcError && !isMissingRelationError(rpcError)) {
    throw new Error(rpcError.message);
  }

  // Graceful session continuity when extended DB RPC is not yet provisioned
  const def = DEFAULT_GAMES_CATALOG.find((g) => g.slug === input.gameSlug);
  const baseXp = def?.xpReward ?? 45;
  const xpEarned =
    input.result === "win"
      ? baseXp + Math.min(Math.round(safeScore * 0.05), 50)
      : input.result === "loss"
        ? Math.max(Math.round(baseXp * 0.45), 10)
        : baseXp;
  const pointsEarned =
    input.result === "win" ? (def?.pointsReward ?? 15) : Math.round((def?.pointsReward ?? 10) / 2);

  const statsKey = getLocalStorageKey("stats", uid);
  const prev = readLocalJson(statsKey, {
    xp: 0,
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalPointsEarned: 0,
  });
  const nextXp = prev.xp + xpEarned;
  const nextStreak = input.result === "win" ? prev.currentStreak + 1 : 0;
  writeLocalJson(statsKey, {
    xp: nextXp,
    gamesPlayed: prev.gamesPlayed + 1,
    gamesWon: prev.gamesWon + (input.result === "win" ? 1 : 0),
    currentStreak: nextStreak,
    bestStreak: Math.max(prev.bestStreak, nextStreak),
    totalPointsEarned: prev.totalPointsEarned + pointsEarned,
  });

  const histKey = getLocalStorageKey("history", uid);
  const prevHist = readLocalJson<GameSessionRecord[]>(histKey, []);
  const entry: GameSessionRecord = {
    id: `local-${Date.now()}`,
    gameSlug: input.gameSlug,
    gameTitle: def?.title ?? input.gameSlug,
    mode: input.mode,
    result: input.result,
    score: safeScore,
    xpEarned,
    pointsEarned,
    durationSeconds: safeDuration,
    createdAt: new Date().toISOString(),
  };
  writeLocalJson(histKey, [entry, ...prevHist].slice(0, 30));

  const lvl = calculatePlayerLevel(nextXp);
  return {
    xpEarned,
    pointsEarned,
    totalXp: nextXp,
    level: lvl.level,
    persistedViaRpc: false,
  };
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data: statsData, error: statsErr } = await dbAny
    .from("user_game_stats")
    .select("user_id, xp, level, games_won, games_played")
    .order("xp", { ascending: false })
    .limit(25);

  if (!statsErr && statsData && statsData.length > 0) {
    const statRows = statsData as unknown as Array<{
      user_id: string;
      xp: number;
      level: number;
      games_won: number;
      games_played: number;
    }>;
    const ids = statRows.map((r) => r.user_id);
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, points_balance")
      .in("id", ids);

    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
    return statRows.map((row, idx) => {
      const p = profMap.get(row.user_id);
      return {
        rank: idx + 1,
        userId: row.user_id,
        username: p?.username ?? "player",
        displayName: p?.display_name ?? null,
        avatarUrl: p?.avatar_url ?? null,
        xp: row.xp,
        level: row.level,
        gamesWon: row.games_won,
        gamesPlayed: row.games_played,
        pointsBalance: p?.points_balance ?? 0,
      };
    });
  }

  // Fall back to real VIDALORE profiles ranked by VIDA Points
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, points_balance")
    .order("points_balance", { ascending: false })
    .limit(20);

  return (profiles ?? []).map((p, idx) => {
    const derivedXp = Math.max(0, (p.points_balance - 100) * 2);
    const lvl = calculatePlayerLevel(derivedXp);
    return {
      rank: idx + 1,
      userId: p.id,
      username: p.username,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
      xp: derivedXp,
      level: lvl.level,
      gamesWon: 0,
      gamesPlayed: 0,
      pointsBalance: p.points_balance,
    };
  });
}

// ============================================================================
// DAILY CHALLENGES
// ============================================================================

async function advanceDailyChallengeProgress(
  userId: string,
  gameSlug: GameSlug,
  score: number,
  won: boolean,
): Promise<void> {
  const today = getTodayDateString();
  const key = getLocalStorageKey(`daily_${today}`, userId);
  const current = readLocalJson<DailyChallenge[]>(key, getDefaultDailyChallenges());

  const updated = current.map((dc) => {
    if (dc.gameSlug !== gameSlug || dc.completed) return dc;
    const step = won ? Math.max(score, dc.targetScore) : Math.max(score, 50);
    const nextProgress = Math.min(dc.targetScore, Math.max(dc.progress, step));
    return {
      ...dc,
      progress: nextProgress,
      completed: nextProgress >= dc.targetScore,
    };
  });
  writeLocalJson(key, updated);
}

export async function fetchDailyChallenges(): Promise<DailyChallenge[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  const today = getTodayDateString();

  const { data: dbChallenges, error } = await dbAny
    .from("daily_challenges")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(10);

  const localChallenges = uid
    ? readLocalJson<DailyChallenge[]>(
        getLocalStorageKey(`daily_${today}`, uid),
        getDefaultDailyChallenges(),
      )
    : getDefaultDailyChallenges();

  if (error || !dbChallenges || dbChallenges.length === 0) {
    return localChallenges;
  }

  interface DcRow {
    id: string;
    challenge_date: string;
    game_slug: GameSlug;
    title: string;
    description: string;
    target_score: number;
    reward_xp: number;
    reward_points: number;
  }

  const localMap = new Map(localChallenges.map((c) => [c.gameSlug, c]));
  return (dbChallenges as unknown as DcRow[]).map((row) => {
    const localMatch = localMap.get(row.game_slug);
    return {
      id: row.id,
      challengeDate: row.challenge_date,
      gameSlug: row.game_slug,
      title: row.title,
      description: row.description,
      targetScore: row.target_score,
      rewardXp: row.reward_xp,
      rewardPoints: row.reward_points,
      progress: localMatch?.progress ?? 0,
      completed: localMatch?.completed ?? false,
      rewardClaimed: localMatch?.rewardClaimed ?? false,
    };
  });
}

export async function claimDailyChallenge(
  challengeId: string,
): Promise<{ xp: number; points: number }> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Sign in to claim rewards.");

  const today = getTodayDateString();
  const key = getLocalStorageKey(`daily_${today}`, uid);
  const current = readLocalJson<DailyChallenge[]>(key, getDefaultDailyChallenges());
  const target = current.find((c) => c.id === challengeId);
  if (!target) throw new Error("Challenge not found.");
  if (!target.completed) throw new Error("Complete the mission objective first.");
  if (target.rewardClaimed) throw new Error("Reward already claimed today.");

  const next = current.map((c) => (c.id === challengeId ? { ...c, rewardClaimed: true } : c));
  writeLocalJson(key, next);

  // Add bonus XP locally & attempt server submission
  await submitGameResult({
    gameSlug: "daily-challenges",
    mode: "solo",
    result: "win",
    rawScore: target.targetScore,
    durationSeconds: 15,
    details: { challengeId },
  }).catch(() => {});

  return { xp: target.rewardXp, points: target.rewardPoints };
}

// ============================================================================
// MEME CHALLENGE SUBMISSIONS & VOTING
// ============================================================================

export async function fetchMemeSubmissions(): Promise<MemeSubmission[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;

  const { data, error } = await dbAny
    .from("meme_submissions")
    .select("*")
    .eq("is_removed", false)
    .order("votes_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);

  if (!error && data) {
    interface MemeRow {
      id: string;
      room_id: string | null;
      user_id: string;
      prompt: string;
      template_id: string;
      top_text: string;
      bottom_text: string;
      image_url: string | null;
      votes_count: number;
      created_at: string;
    }
    const rows = data as unknown as MemeRow[];
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const { data: profiles } = userIds.length
      ? await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", userIds)
      : { data: [] };
    const profMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    let votedIds = new Set<string>();
    if (uid && rows.length > 0) {
      const { data: votes } = await dbAny
        .from("meme_votes")
        .select("submission_id")
        .eq("voter_id", uid)
        .in(
          "submission_id",
          rows.map((r) => r.id),
        );
      votedIds = new Set(
        ((votes ?? []) as unknown as Array<{ submission_id: string }>).map((v) => v.submission_id),
      );
    }

    return rows.map((r) => {
      const p = profMap.get(r.user_id);
      return {
        id: r.id,
        roomId: r.room_id,
        userId: r.user_id,
        authorUsername: p?.username ?? "member",
        authorDisplayName: p?.display_name ?? null,
        authorAvatarUrl: p?.avatar_url ?? null,
        prompt: r.prompt,
        templateId: r.template_id,
        topText: r.top_text,
        bottomText: r.bottom_text,
        imageUrl: r.image_url,
        votesCount: r.votes_count,
        hasVoted: votedIds.has(r.id),
        createdAt: r.created_at,
      };
    });
  }

  return readLocalJson<MemeSubmission[]>("vidalore_local_memes", []);
}

export async function submitMemeEntry(input: {
  prompt: string;
  templateId: string;
  topText: string;
  bottomText: string;
  imageUrl?: string | null;
  roomId?: string | null;
}): Promise<MemeSubmission> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Sign in to submit a meme.");

  const top = input.topText.trim();
  const bottom = input.bottomText.trim();
  if (!top && !bottom) throw new Error("Add top or bottom caption text for your meme.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .eq("id", uid)
    .maybeSingle();

  const { data, error } = await dbAny
    .from("meme_submissions")
    .insert({
      room_id: input.roomId ?? null,
      user_id: uid,
      prompt: input.prompt,
      template_id: input.templateId,
      top_text: top,
      bottom_text: bottom,
      image_url: input.imageUrl ?? null,
    })
    .select("*")
    .single();

  if (!error && data) {
    const r = data as unknown as { id: string; created_at: string };
    return {
      id: r.id,
      roomId: input.roomId ?? null,
      userId: uid,
      authorUsername: profile?.username ?? "you",
      authorDisplayName: profile?.display_name ?? null,
      authorAvatarUrl: profile?.avatar_url ?? null,
      prompt: input.prompt,
      templateId: input.templateId,
      topText: top,
      bottomText: bottom,
      imageUrl: input.imageUrl ?? null,
      votesCount: 0,
      hasVoted: false,
      createdAt: r.created_at,
    };
  }

  const localEntry: MemeSubmission = {
    id: `meme-${Date.now()}`,
    roomId: input.roomId ?? null,
    userId: uid,
    authorUsername: profile?.username ?? "you",
    authorDisplayName: profile?.display_name ?? null,
    authorAvatarUrl: profile?.avatar_url ?? null,
    prompt: input.prompt,
    templateId: input.templateId,
    topText: top,
    bottomText: bottom,
    imageUrl: input.imageUrl ?? null,
    votesCount: 0,
    hasVoted: false,
    createdAt: new Date().toISOString(),
  };
  const existing = readLocalJson<MemeSubmission[]>("vidalore_local_memes", []);
  writeLocalJson("vidalore_local_memes", [localEntry, ...existing].slice(0, 30));
  return localEntry;
}

export async function voteMemeEntry(submissionId: string): Promise<number> {
  const { data, error } = await dbAny.rpc("vote_meme_submission", {
    p_submission_id: submissionId,
  });

  if (!error && typeof data === "number") {
    return data;
  }

  if (error && !isMissingRelationError(error)) {
    throw new Error(error.message);
  }

  const existing = readLocalJson<MemeSubmission[]>("vidalore_local_memes", []);
  let nextCount = 0;
  const updated = existing.map((m) => {
    if (m.id !== submissionId) return m;
    if (m.hasVoted) return m;
    nextCount = m.votesCount + 1;
    return { ...m, votesCount: nextCount, hasVoted: true };
  });
  writeLocalJson("vidalore_local_memes", updated);
  return nextCount;
}

// ============================================================================
// MULTIPLAYER ROOMS, REALTIME PRESENCE & FRIEND INVITES
// ============================================================================

export async function fetchPublicRooms(): Promise<GameRoom[]> {
  const { data, error } = await dbAny
    .from("game_rooms")
    .select("*")
    .eq("visibility", "public")
    .in("status", ["waiting", "active"])
    .order("created_at", { ascending: false })
    .limit(15);

  if (error || !data) return [];

  interface RoomRow {
    id: string;
    room_code: string;
    game_slug: GameSlug;
    host_id: string;
    visibility: "public" | "private";
    status: "waiting" | "active" | "finished";
    current_round: number;
    total_rounds: number;
    round_ends_at: string | null;
    winner_id: string | null;
    state: Record<string, unknown>;
    created_at: string;
  }

  const rows = data as unknown as RoomRow[];
  const hostIds = [...new Set(rows.map((r) => r.host_id))];
  const { data: profiles } = hostIds.length
    ? await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", hostIds)
    : { data: [] };
  const profMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return rows.map((r) => {
    const host = profMap.get(r.host_id);
    return {
      id: r.id,
      roomCode: r.room_code,
      gameSlug: r.game_slug,
      hostId: r.host_id,
      hostUsername: host?.username ?? "host",
      visibility: r.visibility,
      status: r.status,
      currentRound: r.current_round,
      totalRounds: r.total_rounds,
      roundEndsAt: r.round_ends_at,
      winnerId: r.winner_id,
      players: [
        {
          userId: r.host_id,
          username: host?.username ?? "host",
          displayName: host?.display_name ?? null,
          avatarUrl: host?.avatar_url ?? null,
          score: 0,
          isReady: true,
          isHost: true,
          joinedAt: r.created_at,
        },
      ],
      state: r.state ?? {},
      createdAt: r.created_at,
    };
  });
}

export async function createGameRoom(input: {
  gameSlug: GameSlug;
  visibility: "public" | "private";
  totalRounds?: number;
}): Promise<GameRoom> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Sign in to create a game room.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .eq("id", uid)
    .maybeSingle();

  const roomCode = generateRoomCode();
  const now = new Date().toISOString();

  const { data, error } = await dbAny
    .from("game_rooms")
    .insert({
      room_code: roomCode,
      game_slug: input.gameSlug,
      host_id: uid,
      visibility: input.visibility,
      status: "waiting",
      current_round: 1,
      total_rounds: input.totalRounds ?? 5,
    })
    .select("*")
    .single();

  if (!error && data) {
    const row = data as unknown as { id: string; room_code: string; created_at: string };
    await dbAny.from("game_room_players").insert({
      room_id: row.id,
      user_id: uid,
      score: 0,
      is_ready: true,
    });

    return {
      id: row.id,
      roomCode: row.room_code,
      gameSlug: input.gameSlug,
      hostId: uid,
      hostUsername: profile?.username ?? "you",
      visibility: input.visibility,
      status: "waiting",
      currentRound: 1,
      totalRounds: input.totalRounds ?? 5,
      roundEndsAt: null,
      winnerId: null,
      players: [
        {
          userId: uid,
          username: profile?.username ?? "you",
          displayName: profile?.display_name ?? null,
          avatarUrl: profile?.avatar_url ?? null,
          score: 0,
          isReady: true,
          isHost: true,
          joinedAt: row.created_at,
        },
      ],
      state: {},
      createdAt: row.created_at,
    };
  }

  // Fallback to pure Supabase Realtime broadcast room when extended tables aren't deployed yet
  return {
    id: `rt-${roomCode}`,
    roomCode,
    gameSlug: input.gameSlug,
    hostId: uid,
    hostUsername: profile?.username ?? "you",
    visibility: input.visibility,
    status: "waiting",
    currentRound: 1,
    totalRounds: input.totalRounds ?? 5,
    roundEndsAt: null,
    winnerId: null,
    players: [
      {
        userId: uid,
        username: profile?.username ?? "you",
        displayName: profile?.display_name ?? null,
        avatarUrl: profile?.avatar_url ?? null,
        score: 0,
        isReady: true,
        isHost: true,
        joinedAt: now,
      },
    ],
    state: {},
    createdAt: now,
  };
}

export async function joinGameRoomByCode(
  codeRaw: string,
  fallbackGameSlug: GameSlug = "quiz-battle",
): Promise<GameRoom> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Sign in to join a room.");

  const roomCode = codeRaw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (roomCode.length < 4) throw new Error("Enter a valid room code.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .eq("id", uid)
    .maybeSingle();

  const { data: roomData, error } = await dbAny
    .from("game_rooms")
    .select("*")
    .eq("room_code", roomCode)
    .maybeSingle();

  if (!error && roomData) {
    const r = roomData as unknown as {
      id: string;
      room_code: string;
      game_slug: GameSlug;
      host_id: string;
      visibility: "public" | "private";
      status: "waiting" | "active" | "finished";
      current_round: number;
      total_rounds: number;
      round_ends_at: string | null;
      winner_id: string | null;
      state: Record<string, unknown>;
      created_at: string;
    };

    await dbAny
      .from("game_room_players")
      .upsert({ room_id: r.id, user_id: uid, status: "active" }, { onConflict: "room_id,user_id" });

    const { data: playersData } = await dbAny
      .from("game_room_players")
      .select("user_id, score, is_ready, joined_at")
      .eq("room_id", r.id);

    const pRows = (playersData ?? []) as unknown as Array<{
      user_id: string;
      score: number;
      is_ready: boolean;
      joined_at: string;
    }>;
    const pIds = pRows.map((p) => p.user_id);
    const { data: profs } = pIds.length
      ? await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", pIds)
      : { data: [] };
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));

    return {
      id: r.id,
      roomCode: r.room_code,
      gameSlug: r.game_slug,
      hostId: r.host_id,
      hostUsername: profMap.get(r.host_id)?.username ?? "host",
      visibility: r.visibility,
      status: r.status,
      currentRound: r.current_round,
      totalRounds: r.total_rounds,
      roundEndsAt: r.round_ends_at,
      winnerId: r.winner_id,
      players: pRows.map((p) => {
        const prof = profMap.get(p.user_id);
        return {
          userId: p.user_id,
          username: prof?.username ?? "player",
          displayName: prof?.display_name ?? null,
          avatarUrl: prof?.avatar_url ?? null,
          score: p.score,
          isReady: p.is_ready,
          isHost: p.user_id === r.host_id,
          joinedAt: p.joined_at,
        };
      }),
      state: r.state ?? {},
      createdAt: r.created_at,
    };
  }

  // Realtime-only room fallback when extended DB tables aren't deployed yet
  const now = new Date().toISOString();
  return {
    id: `rt-${roomCode}`,
    roomCode,
    gameSlug: fallbackGameSlug,
    hostId: "",
    hostUsername: "Host",
    visibility: "private",
    status: "waiting",
    currentRound: 1,
    totalRounds: 5,
    roundEndsAt: null,
    winnerId: null,
    players: [
      {
        userId: uid,
        username: profile?.username ?? "you",
        displayName: profile?.display_name ?? null,
        avatarUrl: profile?.avatar_url ?? null,
        score: 0,
        isReady: true,
        isHost: false,
        joinedAt: now,
      },
    ],
    state: {},
    createdAt: now,
  };
}

export async function inviteFriendToGameViaDM(input: {
  friendUserId: string;
  gameTitle: string;
  gameSlug: GameSlug;
  roomCode: string;
}): Promise<void> {
  const conv = await getOrCreateDirectConversation(input.friendUserId);
  const inviteText = `🎮 Game Challenge! Join me in ${input.gameTitle} on VIDALORE Games Center.\nRoom Code: ${input.roomCode}\nOpen /games?room=${input.roomCode}&game=${input.gameSlug}`;
  await sendMessage(conv.id, {
    content: inviteText,
    messageType: "text",
  });
}

export function subscribeToGamesLobbyPresence(
  me: { id: string; username: string; display_name: string | null; avatar_url: string | null },
  activity: string,
  onSync: (players: OnlinePlayer[]) => void,
): { updateActivity: (nextActivity: string, roomCode?: string) => void; cleanup: () => void } {
  if (typeof supabase.getChannels === "function") {
    const existing = supabase
      .getChannels()
      .find((ch) => ch.topic === "realtime:vidalore:games-lobby");
    if (existing) {
      void supabase.removeChannel(existing);
    }
  }
  const channel = supabase.channel("vidalore:games-lobby", {
    config: { presence: { key: me.id } },
  });

  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<OnlinePlayer>();
      const list: OnlinePlayer[] = [];
      for (const entries of Object.values(state)) {
        const latest = entries[entries.length - 1];
        if (latest?.userId) list.push(latest);
      }
      onSync(list);
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          userId: me.id,
          username: me.username,
          displayName: me.display_name,
          avatarUrl: me.avatar_url,
          activity,
          onlineAt: new Date().toISOString(),
        });
      }
    });

  return {
    updateActivity: (nextActivity: string, roomCode?: string) => {
      channel
        .track({
          userId: me.id,
          username: me.username,
          displayName: me.display_name,
          avatarUrl: me.avatar_url,
          activity: nextActivity,
          roomCode,
          onlineAt: new Date().toISOString(),
        })
        .catch(() => {});
    },
    cleanup: () => {
      supabase.removeChannel(channel);
    },
  };
}

export interface RoomEventPayload {
  type: "move" | "score" | "state_sync" | "rematch" | "chat" | "vote" | "start";
  senderId: string;
  senderUsername: string;
  data: Record<string, unknown>;
  sentAt: string;
}

export function connectGameRoomChannel(
  roomCode: string,
  me: { id: string; username: string; display_name: string | null; avatar_url: string | null },
  handlers: {
    onPlayersChange: (players: GameRoomPlayer[]) => void;
    onEvent: (payload: RoomEventPayload) => void;
  },
): {
  broadcast: (type: RoomEventPayload["type"], data: Record<string, unknown>) => Promise<void>;
  disconnect: () => void;
} {
  const topic = `vidalore:game-room:${roomCode}`;
  if (typeof supabase.getChannels === "function") {
    const existing = supabase.getChannels().find((ch) => ch.topic === `realtime:${topic}`);
    if (existing) {
      void supabase.removeChannel(existing);
    }
  }
  const channel: RealtimeChannel = supabase.channel(topic, {
    config: {
      presence: { key: me.id },
      broadcast: { self: true },
    },
  });

  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<{
        userId: string;
        username: string;
        displayName: string | null;
        avatarUrl: string | null;
        score?: number;
        isReady?: boolean;
        isHost?: boolean;
        joinedAt: string;
      }>();
      const players: GameRoomPlayer[] = [];
      for (const entries of Object.values(state)) {
        const latest = entries[entries.length - 1];
        if (latest?.userId) {
          players.push({
            userId: latest.userId,
            username: latest.username,
            displayName: latest.displayName ?? null,
            avatarUrl: latest.avatarUrl ?? null,
            score: latest.score ?? 0,
            isReady: latest.isReady ?? true,
            isHost: latest.isHost ?? false,
            joinedAt: latest.joinedAt,
          });
        }
      }
      players.sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
      handlers.onPlayersChange(players);
    })
    .on("broadcast", { event: "game_event" }, ({ payload }) => {
      if (payload) {
        handlers.onEvent(payload as RoomEventPayload);
      }
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          userId: me.id,
          username: me.username,
          displayName: me.display_name,
          avatarUrl: me.avatar_url,
          score: 0,
          isReady: true,
          joinedAt: new Date().toISOString(),
        });
      }
    });

  return {
    broadcast: async (type, data) => {
      await channel.send({
        type: "broadcast",
        event: "game_event",
        payload: {
          type,
          senderId: me.id,
          senderUsername: me.username,
          data,
          sentAt: new Date().toISOString(),
        } satisfies RoomEventPayload,
      });
    },
    disconnect: () => {
      supabase.removeChannel(channel);
    },
  };
}

// ============================================================================
// REACT QUERY OPTIONS
// ============================================================================

export const gamesCatalogQuery = () =>
  queryOptions({
    queryKey: gamesKeys.catalog(),
    queryFn: fetchGamesCatalog,
    staleTime: 30_000,
  });

export const gameQuestionsQuery = (slug?: GameSlug) =>
  queryOptions({
    queryKey: gamesKeys.questions(slug),
    queryFn: () => fetchGameQuestions(slug),
    staleTime: 60_000,
  });

export const userGameProfileQuery = () =>
  queryOptions({
    queryKey: gamesKeys.profile(),
    queryFn: fetchUserGameProfile,
  });

export const gameHistoryQuery = () =>
  queryOptions({
    queryKey: gamesKeys.history(),
    queryFn: fetchGameHistory,
  });

export const gamesLeaderboardQuery = () =>
  queryOptions({
    queryKey: gamesKeys.leaderboard(),
    queryFn: fetchLeaderboard,
    staleTime: 30_000,
  });

export const publicGameRoomsQuery = () =>
  queryOptions({
    queryKey: gamesKeys.rooms(),
    queryFn: fetchPublicRooms,
    staleTime: 10_000,
  });

export const memeSubmissionsQuery = () =>
  queryOptions({
    queryKey: gamesKeys.memes(),
    queryFn: fetchMemeSubmissions,
  });

export const dailyChallengesQuery = () =>
  queryOptions({
    queryKey: gamesKeys.daily(),
    queryFn: fetchDailyChallenges,
  });
