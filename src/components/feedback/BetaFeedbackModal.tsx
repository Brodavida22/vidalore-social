import { useState, useEffect } from "react";
import {
  MessageSquarePlus,
  Bug,
  Lightbulb,
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  HelpCircle,
  History,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  submitBetaFeedback,
  getStoredFeedbackHistory,
  type FeedbackType,
  type BetaFeedbackSubmission,
} from "@/services/feedback";

export function BetaFeedbackModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [type, setType] = useState<FeedbackType>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<BetaFeedbackSubmission[]>([]);

  useEffect(() => {
    if (open) {
      setHistory(getStoredFeedbackHistory());
    }
  }, [open]);

  function getDiagnosticsString(): string {
    if (typeof window === "undefined") return "Environment: SSR";
    return `Browser: ${navigator.userAgent.slice(0, 150)} | Screen: ${window.innerWidth}x${window.innerHeight} | Platform: ${navigator.platform || "Unknown"} | PWA: ${window.matchMedia("(display-mode: standalone)").matches ? "Yes" : "No"}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error("Please fill in both a title and description.");
      return;
    }

    setIsSubmitting(true);
    try {
      const diagnostics = includeDiagnostics ? getDiagnosticsString() : undefined;
      await submitBetaFeedback({
        type,
        title: title.trim(),
        description: description.trim(),
        contactEmail: contactEmail.trim() || undefined,
        deviceInfo: diagnostics,
      });

      toast.success("Thank you for your feedback! 🌹", {
        description: "Your report has been sent to the VIDALORE product team.",
      });

      setTitle("");
      setDescription("");
      setContactEmail("");
      setHistory(getStoredFeedbackHistory());
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit feedback.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const typeConfig: Record<
    FeedbackType,
    { label: string; icon: typeof Bug; placeholder: string; descPlaceholder: string }
  > = {
    bug: {
      label: "Bug Report",
      icon: Bug,
      placeholder: "e.g. Video player stalled on Android Chrome",
      descPlaceholder: "What happened? What were you trying to do, and what went wrong?",
    },
    feature: {
      label: "Feature Idea",
      icon: Lightbulb,
      placeholder: "e.g. Add audio volume slider in Reels",
      descPlaceholder: "How would this feature help you or improve the community?",
    },
    experience: {
      label: "User Experience",
      icon: Sparkles,
      placeholder: "e.g. The app feels very fast and responsive",
      descPlaceholder: "Tell us about your experience using VIDALORE SOCIAL.",
    },
    other: {
      label: "Other",
      icon: HelpCircle,
      placeholder: "e.g. Question about rewards and points",
      descPlaceholder: "Please share any other thoughts or comments.",
    },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border border-border bg-card p-5 max-h-[90vh] flex flex-col rounded-2xl shadow-2xl">
        <DialogHeader className="border-b border-border pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="font-display text-lg flex items-center gap-2 text-foreground">
              <MessageSquarePlus className="h-5 w-5 text-[#E91E63]" />
              VIDALORE Beta Feedback
            </DialogTitle>
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs text-muted-foreground hover:text-[#E91E63] flex items-center gap-1 transition-colors"
            >
              <History className="h-3.5 w-3.5" />
              {showHistory ? "Back to Form" : `History (${history.length})`}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Help us improve VIDALORE SOCIAL. All feedback is directly reviewed by the engineering
            team.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2 pr-1 space-y-4">
          {showHistory ? (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Your Submitted Feedback
              </h3>
              {history.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  No feedback submitted yet.
                </div>
              ) : (
                history.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-3 rounded-xl bg-secondary/50 border border-border space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[0.65rem] font-bold uppercase tracking-wider text-[#E91E63]">
                        {typeConfig[item.type]?.label || item.type}
                      </span>
                      {item.createdAt && (
                        <span className="text-[0.65rem] text-muted-foreground">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                ))
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Feedback Type Selector */}
              <div className="grid grid-cols-3 gap-2">
                {(["bug", "feature", "experience"] as FeedbackType[]).map((t) => {
                  const cfg = typeConfig[t];
                  const Icon = cfg.icon;
                  const isSelected = type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all text-xs font-medium ${
                        isSelected
                          ? "border-[#E91E63] bg-[#E91E63]/10 text-foreground font-semibold shadow-xs"
                          : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${isSelected ? "text-[#E91E63]" : ""}`} />
                      <span>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Title Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Summary / Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={typeConfig[type].placeholder}
                  maxLength={100}
                  className="h-9 rounded-lg bg-secondary border-border text-xs focus-visible:ring-primary"
                  required
                />
              </div>

              {/* Description Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Details</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={typeConfig[type].descPlaceholder}
                  rows={4}
                  maxLength={1000}
                  className="rounded-lg bg-secondary border-border text-xs leading-relaxed focus-visible:ring-primary resize-none"
                  required
                />
                <span className="text-[0.65rem] text-muted-foreground block text-right">
                  {description.length}/1000
                </span>
              </div>

              {/* Optional Contact */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Optional contact email (for updates on this issue)
                </label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="you@example.com (optional)"
                  className="h-8 rounded-lg bg-secondary border-border text-xs focus-visible:ring-primary"
                />
              </div>

              {/* Diagnostics Toggle */}
              <div className="flex items-start gap-2.5 rounded-xl bg-secondary/30 p-2.5 border border-border/60">
                <input
                  type="checkbox"
                  id="diagnostics-toggle"
                  checked={includeDiagnostics}
                  onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                  className="mt-0.5 rounded accent-[#E91E63]"
                />
                <label
                  htmlFor="diagnostics-toggle"
                  className="text-[0.7rem] text-muted-foreground leading-normal cursor-pointer select-none"
                >
                  <strong className="text-foreground">Include anonymous device diagnostics:</strong>{" "}
                  Device resolution, browser version, and PWA mode (no personal passwords or files
                  are sent).
                </label>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting || !title.trim() || !description.trim()}
                className="w-full rounded-xl bg-[#E91E63] hover:bg-[#C2185B] text-white font-semibold text-xs h-10 shadow-md transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting feedback...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send Feedback
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
