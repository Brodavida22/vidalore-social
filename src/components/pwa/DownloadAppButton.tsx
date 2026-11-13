import { useState } from "react";
import {
  CheckCircle2,
  Download,
  Loader2,
  Share,
  Smartphone,
  MoreVertical,
  PlusSquare,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePWAInstall } from "@/lib/pwaInstall";

interface DownloadAppButtonProps {
  className?: string;
  label?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
}

export function DownloadAppButton({
  className = "",
  label = "Download VIDALORE SOCIAL App",
  variant = "default",
  size = "lg",
}: DownloadAppButtonProps) {
  const { canPromptInstall, isInstalled, isIOS, isAndroid, isInstalling, promptInstall } =
    usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideMode, setGuideMode] = useState<"ios" | "android" | "browser">("android");

  async function handleClick() {
    const outcome = await promptInstall();
    if (outcome === "already-installed") {
      toast.success("VIDALORE SOCIAL is already installed on your device.");
      return;
    }
    if (outcome === "accepted") {
      toast.success("Installing VIDALORE SOCIAL App! Look for it on your home screen.");
      return;
    }
    if (outcome === "dismissed") {
      toast.info("Install cancelled. You can install the app anytime.");
      return;
    }
    if (outcome === "ios-instructions") {
      setGuideMode("ios");
      setGuideOpen(true);
      return;
    }
    setGuideMode(isAndroid ? "android" : "browser");
    setGuideOpen(true);
  }

  if (isInstalled) {
    return (
      <div
        className={`flex w-full items-center justify-center gap-2 rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/10 px-4 py-3 text-xs font-semibold text-[#22C55E] ${className}`}
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>VIDALORE SOCIAL App Installed</span>
      </div>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={isInstalling}
        onClick={() => void handleClick()}
        className={
          variant === "default"
            ? `w-full rounded-xl bg-[#E91E63] hover:bg-[#C2185B] text-white font-semibold text-xs sm:text-sm h-11 shadow-sm ${className}`
            : `w-full rounded-xl font-semibold text-xs sm:text-sm h-11 ${className}`
        }
      >
        {isInstalling ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-2 shrink-0" />
        )}
        <span>{label}</span>
        {canPromptInstall && !isInstalling && (
          <span className="ml-2 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold">
            Install
          </span>
        )}
      </Button>

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border border-border bg-card p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Smartphone className="h-5 w-5 text-[#E91E63]" />
              Install VIDALORE SOCIAL App
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add VIDALORE SOCIAL to your home screen for instant full-screen access, no app store
              needed.
            </DialogDescription>
          </DialogHeader>

          {guideMode === "ios" || isIOS ? (
            <ol className="space-y-3 py-2 text-xs text-foreground">
              <li className="flex items-start gap-3 rounded-xl bg-secondary/60 p-3 border border-border">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E91E63] text-[11px] font-bold text-white">
                  1
                </span>
                <div className="space-y-0.5">
                  <p className="font-semibold">Tap the Share button in Safari</p>
                  <p className="text-muted-foreground flex items-center gap-1">
                    Look for the <Share className="inline h-3.5 w-3.5 text-[#E91E63]" /> icon at the
                    bottom or top of your browser.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-xl bg-secondary/60 p-3 border border-border">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E91E63] text-[11px] font-bold text-white">
                  2
                </span>
                <div className="space-y-0.5">
                  <p className="font-semibold">Select &ldquo;Add to Home Screen&rdquo;</p>
                  <p className="text-muted-foreground flex items-center gap-1">
                    Scroll down in the share sheet and tap{" "}
                    <PlusSquare className="inline h-3.5 w-3.5 text-[#E91E63]" /> Add to Home Screen.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-xl bg-secondary/60 p-3 border border-border">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E91E63] text-[11px] font-bold text-white">
                  3
                </span>
                <div className="space-y-0.5">
                  <p className="font-semibold">Tap &ldquo;Add&rdquo; to finish</p>
                  <p className="text-muted-foreground">
                    Launch VIDALORE SOCIAL directly from your iPhone or iPad home screen.
                  </p>
                </div>
              </li>
            </ol>
          ) : (
            <ol className="space-y-3 py-2 text-xs text-foreground">
              <li className="flex items-start gap-3 rounded-xl bg-secondary/60 p-3 border border-border">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E91E63] text-[11px] font-bold text-white">
                  1
                </span>
                <div className="space-y-0.5">
                  <p className="font-semibold">Open your browser menu</p>
                  <p className="text-muted-foreground flex items-center gap-1">
                    Tap the <MoreVertical className="inline h-3.5 w-3.5 text-[#E91E63]" /> menu icon
                    in Chrome, Edge, or your Android browser.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-xl bg-secondary/60 p-3 border border-border">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E91E63] text-[11px] font-bold text-white">
                  2
                </span>
                <div className="space-y-0.5">
                  <p className="font-semibold">
                    Tap &ldquo;Install app&rdquo; or &ldquo;Add to Home screen&rdquo;
                  </p>
                  <p className="text-muted-foreground">
                    Confirm the prompt to install VIDALORE SOCIAL onto your device.
                  </p>
                </div>
              </li>
            </ol>
          )}

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              size="sm"
              onClick={() => setGuideOpen(false)}
              className="rounded-lg bg-[#E91E63] hover:bg-[#C2185B] text-white text-xs"
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
