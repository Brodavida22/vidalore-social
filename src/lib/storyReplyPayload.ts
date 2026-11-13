import { supabase } from "@/integrations/supabase/client";

const STORY_REPLY_PREFIX = "[[VIDALORE_STORY_REPLY:";
const STORY_REPLY_SUFFIX = "]]\n";
const STORY_BUCKET = "story-media";

export interface StoryReplyReference {
  storyId: string;
  ownerId: string;
  ownerUsername: string;
  mediaType: "image" | "video";
  mediaPath?: string | undefined;
  caption?: string | undefined;
  expiresAt?: string | undefined;
}

export interface ParsedStoryReply {
  storyRef: StoryReplyReference;
  replyText: string;
}

export function encodeStoryReplyContent(storyRef: StoryReplyReference, replyText: string): string {
  const payload: StoryReplyReference = {
    storyId: storyRef.storyId,
    ownerId: storyRef.ownerId,
    ownerUsername: storyRef.ownerUsername,
    mediaType: storyRef.mediaType === "video" ? "video" : "image",
    ...(storyRef.mediaPath ? { mediaPath: storyRef.mediaPath } : {}),
    ...(storyRef.caption ? { caption: storyRef.caption.slice(0, 140) } : {}),
    ...(storyRef.expiresAt ? { expiresAt: storyRef.expiresAt } : {}),
  };
  return `${STORY_REPLY_PREFIX}${JSON.stringify(payload)}${STORY_REPLY_SUFFIX}${replyText.trim()}`;
}

export function parseStoryReplyMessage(content?: string | null): ParsedStoryReply | null {
  if (!content || !content.startsWith(STORY_REPLY_PREFIX)) return null;
  const suffixIdx = content.indexOf(STORY_REPLY_SUFFIX, STORY_REPLY_PREFIX.length);
  if (suffixIdx === -1) return null;

  const jsonPart = content.slice(STORY_REPLY_PREFIX.length, suffixIdx);
  const replyText = content.slice(suffixIdx + STORY_REPLY_SUFFIX.length).trim();

  try {
    const parsed = JSON.parse(jsonPart) as Partial<StoryReplyReference>;
    if (!parsed || typeof parsed.storyId !== "string" || typeof parsed.ownerId !== "string") {
      return null;
    }
    return {
      storyRef: {
        storyId: parsed.storyId,
        ownerId: parsed.ownerId,
        ownerUsername: typeof parsed.ownerUsername === "string" ? parsed.ownerUsername : "member",
        mediaType: parsed.mediaType === "video" ? "video" : "image",
        mediaPath: typeof parsed.mediaPath === "string" ? parsed.mediaPath : undefined,
        caption: typeof parsed.caption === "string" ? parsed.caption : undefined,
        expiresAt: typeof parsed.expiresAt === "string" ? parsed.expiresAt : undefined,
      },
      replyText,
    };
  } catch {
    return null;
  }
}

export function formatMessageTextForPreview(content?: string | null): string {
  const parsed = parseStoryReplyMessage(content);
  if (!parsed) return content || "Message";
  return parsed.replyText ? `Story reply: ${parsed.replyText}` : "Replied to story";
}

export interface ResolvedStoryPreview {
  available: boolean;
  reason?: "expired" | "deleted" | "unavailable";
  mediaUrl?: string | undefined;
  mediaType: "image" | "video";
  caption?: string | undefined;
  ownerUsername: string;
}

export async function resolveStoryPreview(
  storyRef: StoryReplyReference,
): Promise<ResolvedStoryPreview> {
  const base: ResolvedStoryPreview = {
    available: false,
    mediaType: storyRef.mediaType,
    caption: storyRef.caption,
    ownerUsername: storyRef.ownerUsername,
  };

  if (storyRef.expiresAt && new Date(storyRef.expiresAt).getTime() <= Date.now()) {
    return { ...base, reason: "expired" };
  }

  try {
    const { data, error } = await supabase
      .from("stories")
      .select("id, media_url, media_type, caption, expires_at")
      .eq("id", storyRef.storyId)
      .maybeSingle();

    if (error) {
      return { ...base, reason: "unavailable" };
    }

    if (!data) {
      return { ...base, reason: "deleted" };
    }

    if (new Date(data.expires_at).getTime() <= Date.now()) {
      return { ...base, reason: "expired" };
    }

    const rawPath = data.media_url || storyRef.mediaPath;
    if (!rawPath) {
      return { ...base, reason: "unavailable" };
    }

    if (rawPath.startsWith("http")) {
      return {
        available: true,
        mediaUrl: rawPath,
        mediaType: data.media_type === "video" ? "video" : "image",
        caption: data.caption ?? storyRef.caption,
        ownerUsername: storyRef.ownerUsername,
      };
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from(STORY_BUCKET)
      .createSignedUrl(rawPath, 60 * 60);

    if (signErr || !signed?.signedUrl) {
      return { ...base, reason: "unavailable" };
    }

    return {
      available: true,
      mediaUrl: signed.signedUrl,
      mediaType: data.media_type === "video" ? "video" : "image",
      caption: data.caption ?? storyRef.caption,
      ownerUsername: storyRef.ownerUsername,
    };
  } catch {
    return { ...base, reason: "unavailable" };
  }
}
