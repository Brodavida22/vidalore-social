import { useState } from "react";
import { Flag, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { reportContent } from "@/services/social";

const REPORT_REASONS = [
  "Spam or unsolicited promotion",
  "Harassment, hate speech, or bullying",
  "Inappropriate or sensitive content",
  "Fake account or impersonation",
  "Misleading or malicious links",
  "Other concern",
];

export function ReportModal({
  targetId,
  targetType,
  targetLabel,
  open,
  onOpenChange,
}: {
  targetId: string;
  targetType: "post" | "comment" | "profile";
  targetLabel?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    reportContent({
      targetId,
      targetType,
      reason: selectedReason || "General report",
      details: details.trim() || undefined,
    });
    setSubmitted(true);
    toast.success("Report submitted to Garden Moderation", {
      description: "Thank you for keeping VIDALORE safe and inspiring.",
    });
    setTimeout(() => {
      setSubmitted(false);
      onOpenChange(false);
    }, 1500);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md glass border-border/80">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" />
            Report {targetLabel || targetType}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Help maintain the high standard of the VIDALORE community. Reports are reviewed
            promptly.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <ShieldCheck className="h-12 w-12 text-success mx-auto animate-bounce" />
            <p className="font-semibold text-foreground">Report Received</p>
            <p className="text-xs text-muted-foreground">
              Our moderation circle will evaluate this item against community guidelines.
            </p>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-rose-soft">Select reason:</label>
              <div className="space-y-1.5">
                {REPORT_REASONS.map((reason) => (
                  <label
                    key={reason}
                    className={`flex items-center gap-2.5 rounded-xl p-2.5 text-xs cursor-pointer transition-colors ${
                      selectedReason === reason
                        ? "bg-secondary text-foreground font-medium ring-1 ring-primary/40"
                        : "bg-secondary/40 text-muted-foreground hover:bg-secondary/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name="report-reason"
                      checked={selectedReason === reason}
                      onChange={() => setSelectedReason(reason)}
                      className="accent-primary"
                    />
                    {reason}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="rep-det" className="text-xs font-semibold text-muted-foreground">
                Additional context (optional):
              </label>
              <Textarea
                id="rep-det"
                placeholder="Describe why this content violates community standards..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={2}
                className="resize-none rounded-xl bg-background/60 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleSubmit}
                className="rounded-xl text-xs"
              >
                Submit Report
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
