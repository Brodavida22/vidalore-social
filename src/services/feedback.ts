import { supabase } from "@/integrations/supabase/client";

export type FeedbackType = "bug" | "feature" | "experience" | "other";

export interface BetaFeedbackSubmission {
  id?: string;
  type: FeedbackType;
  title: string;
  description: string;
  deviceInfo?: string | undefined;
  contactEmail?: string | undefined;
  createdAt?: string;
}

const FEEDBACK_STORAGE_KEY = "vidalore_beta_feedback_history";

export function getStoredFeedbackHistory(): BetaFeedbackSubmission[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFeedbackHistory(entry: BetaFeedbackSubmission): void {
  if (typeof window === "undefined") return;
  try {
    const current = getStoredFeedbackHistory();
    const updated = [entry, ...current].slice(0, 50);
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Could not save feedback history locally:", err);
  }
}

export async function submitBetaFeedback(input: {
  type: FeedbackType;
  title: string;
  description: string;
  deviceInfo?: string | undefined;
  contactEmail?: string | undefined;
}): Promise<{ id: string; success: boolean }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id;

  const typeLabels: Record<FeedbackType, string> = {
    bug: "Bug Report",
    feature: "Feature Request",
    experience: "User Experience",
    other: "General Feedback",
  };

  const cleanTitle = input.title.trim().slice(0, 100);
  const formattedReason = `[Beta - ${typeLabels[input.type]}] ${cleanTitle}`.slice(0, 120);

  const formattedDescription = [
    `Category: ${typeLabels[input.type]}`,
    `Description: ${input.description.trim()}`,
    input.contactEmail ? `Contact: ${input.contactEmail.trim()}` : null,
    input.deviceInfo ? `Diagnostics: ${input.deviceInfo.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 1000);

  const localEntry: BetaFeedbackSubmission = {
    id: crypto.randomUUID(),
    type: input.type,
    title: cleanTitle,
    description: input.description.trim(),
    deviceInfo: input.deviceInfo,
    contactEmail: input.contactEmail,
    createdAt: new Date().toISOString(),
  };

  // 1. Submit to Supabase content_reports table using existing schema
  let dbReportId = localEntry.id!;
  if (uid) {
    try {
      const { data, error } = await supabase
        .from("content_reports")
        .insert({
          reporter_id: uid,
          target_type: "profile",
          target_id: uid,
          profile_id: uid,
          reason: formattedReason,
          description: formattedDescription,
          status: "pending",
        })
        .select("id")
        .single();

      if (!error && data?.id) {
        dbReportId = data.id;
        localEntry.id = data.id;
      } else if (error) {
        console.warn("Direct report insert notice (storing in local history):", error.message);
      }
    } catch (dbErr) {
      console.warn("Feedback network warning, saving locally:", dbErr);
    }
  }

  // 2. Persist in local user history
  saveFeedbackHistory(localEntry);

  return { id: dbReportId, success: true };
}
