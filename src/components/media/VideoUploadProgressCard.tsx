import { Loader2, RefreshCw, X, CheckCircle2, AlertCircle, Film, Sparkles } from "lucide-react";
import type { VideoUploadProgress } from "@/lib/videoUpload";
import { Button } from "@/components/ui/button";

export function VideoUploadProgressCard({
  progress,
  videoPreviewUrl,
  videoName,
  onRetry,
  onCancel,
}: {
  progress: VideoUploadProgress;
  videoPreviewUrl?: string | null | undefined;
  videoName?: string | undefined;
  onRetry?: (() => void) | undefined;
  onCancel?: (() => void) | undefined;
}) {
  const isCompressing = progress.stage === "compressing";
  const isUploading = progress.stage === "uploading";
  const isPublishing = progress.stage === "publishing";
  const isSuccess = progress.stage === "success";
  const isError = progress.stage === "error";

  const getStageTitle = () => {
    switch (progress.stage) {
      case "preparing":
        return "Preparing video...";
      case "compressing":
        return "Optimizing video size...";
      case "uploading":
        return "Uploading video...";
      case "publishing":
        return "Finalizing publication...";
      case "success":
        return "Video published successfully!";
      case "error":
        return "Upload interrupted";
      default:
        return "Processing video...";
    }
  };

  const getStageDescription = () => {
    switch (progress.stage) {
      case "compressing":
        return "Compressing to efficient 720p H.264 for fast mobile streaming.";
      case "uploading":
        return `${progress.formattedUploaded} of ${progress.formattedTotal} transferred`;
      case "publishing":
        return "Saving video and updating community feed...";
      case "success":
        return "Your video is now live.";
      case "error":
        return progress.errorMessage || "Network connection interrupted during upload.";
      default:
        return "Please keep this window open.";
    }
  };

  const [previewError, setPreviewError] = useState(false);

  return (
    <div className="relative rounded-2xl border border-border bg-card p-4 shadow-md space-y-3 overflow-hidden select-none">
      {/* Top Header: Thumbnail + Status Title + Stage indicator */}
      <div className="flex items-center gap-3">
        {/* Video Thumbnail / Icon */}
        <div className="relative h-14 w-14 rounded-xl overflow-hidden bg-secondary border border-border shrink-0 flex items-center justify-center">
          {videoPreviewUrl && !previewError ? (
            <video
              src={videoPreviewUrl}
              className="h-full w-full object-cover"
              muted
              playsInline
              onError={(e) => {
                e.stopPropagation();
                setPreviewError(true);
              }}
            />
          ) : (
            <Film size={22} className="text-[#E91E63]" />
          )}

          {/* Overlay Icon for status */}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            {isSuccess ? (
              <CheckCircle2 size={18} className="text-[#22C55E]" />
            ) : isError ? (
              <AlertCircle size={18} className="text-destructive" />
            ) : isCompressing ? (
              <Sparkles size={16} className="text-amber-400 animate-spin" />
            ) : (
              <Loader2 size={16} className="text-white animate-spin" />
            )}
          </div>
        </div>

        {/* Status Details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <h4 className="text-xs font-bold text-foreground truncate">{getStageTitle()}</h4>
            {!isError && !isSuccess && (
              <span className="text-xs font-semibold tabular-nums text-[#E91E63]">
                {progress.percent}%
              </span>
            )}
          </div>

          {videoName && <p className="text-[10px] text-muted-foreground truncate">{videoName}</p>}

          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {getStageDescription()}
          </p>
        </div>

        {/* Cancel button if not finished */}
        {onCancel && !isSuccess && !isPublishing && (
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition shrink-0"
            title="Cancel upload"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Real Progress Bar */}
      {!isError && (
        <div className="space-y-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary border border-border/50">
            <div
              className={`h-full rounded-full transition-all duration-300 ease-out ${
                isSuccess ? "bg-[#22C55E]" : isCompressing ? "bg-amber-500" : "bg-[#E91E63]"
              }`}
              style={{ width: `${progress.percent}%` }}
            />
          </div>

          {/* Numerical progress breakdown: 18.5 MB / 24.6 MB */}
          {isUploading && progress.bytesTotal > 0 && (
            <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground tabular-nums">
              <span>
                {progress.formattedUploaded} / {progress.formattedTotal}
              </span>
              <span>{progress.percent}%</span>
            </div>
          )}
        </div>
      )}

      {/* Error state with Retry Option */}
      {isError && (
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-destructive/20">
          <p className="text-[11px] text-destructive font-medium truncate">
            Upload paused. Your work is saved.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="h-7 text-xs rounded-lg px-2"
              >
                Discard
              </Button>
            )}
            {onRetry && (
              <Button
                type="button"
                size="sm"
                onClick={onRetry}
                className="h-7 text-xs rounded-lg px-3 bg-[#E91E63] hover:bg-[#C2185B] text-white font-semibold gap-1.5 shadow-sm"
              >
                <RefreshCw size={12} />
                <span>Retry</span>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
