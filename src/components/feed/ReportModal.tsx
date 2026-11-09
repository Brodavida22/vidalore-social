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
    toast.success("Report submitted to moderation", {
      description: "Thank you for keeping VIDALORE safe.",
    });
    setTimeout(() => {
      setSubmitted(false);
      onOpenChange(false);
    }, 1500);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-semibold flex items-center gap-2 text-foreground">
            <Flag className="h-4 w-4 text-destructive" />
            Report {targetLabel || targetType}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Help maintain community standards. All reports are confidential and reviewed promptly.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <ShieldCheck className="h-10 w-10 text-[#22C55E] mx-auto" />
            <p className="font-semibold text-foreground text-sm">Report Received</p>
            <p className="text-xs text-muted-foreground">
              Our moderation team will review this item.
            </p>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">Select reason:</label>
              <div className="space-y-1.5">
                {REPORT_REASONS.map((reason) => (
                  <label
                    key={reason}
                    className={`flex items-center gap-2.5 rounded-lg p-2.5 text-xs cursor-pointer transition-colors ${
                      selectedReason === reason
                        ? "bg-secondary text-foreground font-medium ring-1 ring-primary"
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
                className="resize-none rounded-lg bg-secondary text-xs border-border"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="rounded-lg text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleSubmit}
                className="rounded-lg text-xs"
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
