import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export const myProfileQuery = () =>
  queryOptions({
    queryKey: ["profile", "me"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const profileByUsernameQuery = (username: string) =>
  queryOptions({
    queryKey: ["profile", "u", username.toLowerCase()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username.toLowerCase())
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const communityProfilesQuery = (limit = 10) =>
  queryOptions({
    queryKey: ["profiles", "community", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("points_balance", { ascending: false })
        .limit(limit);
      if (error) return [];
      return data ?? [];
    },
  });

export const achievementsForUserQuery = (userId: string) =>
  queryOptions({
    queryKey: ["achievements", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_achievements")
        .select("earned_at, achievements(code, name, description, icon)")
        .eq("user_id", userId)
        .order("earned_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

export async function checkUsernameAvailable(username: string) {
  const { data, error } = await supabase.rpc("is_username_available", { _username: username });
  if (error) throw error;
  return Boolean(data);
}

/** Uploads an image to the private profile-media bucket under the user's own folder. */
export async function uploadProfileImage(userId: string, file: File, kind: "avatar" | "cover") {
  if (!IMAGE_TYPES.includes(file.type))
    throw new Error("Please choose a JPG, PNG, WEBP or GIF image.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Images must be 5 MB or smaller.");
  const ext = (file.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg");
  const path = `${userId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("profile-media")
    .upload(path, file, { contentType: file.type });
  if (error) throw error;
  const { data, error: urlError } = await supabase.storage
    .from("profile-media")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
  if (urlError || !data) throw urlError ?? new Error("Could not prepare image link.");
  return data.signedUrl;
}

export function friendlyAuthError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "That email and password don't match. Please try again.";
  if (m.includes("email not confirmed"))
    return "Please confirm your email first — check your inbox.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "An account with this email already exists. Try signing in.";
  if (m.includes("password") && m.includes("characters"))
    return "Password must be at least 8 characters.";
  if (m.includes("pwned") || m.includes("weak"))
    return "That password is too easy to guess. Please choose a stronger one.";
  if (m.includes("rate") || m.includes("too many"))
    return "Too many attempts. Please wait a minute and try again.";
  return message;
}
