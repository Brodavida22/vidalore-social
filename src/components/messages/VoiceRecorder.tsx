import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square, Trash2, Send, Play, Pause, AlertCircle, RefreshCw, X } from "lucide-react";
import { toast } from "@/lib/toast";

export function VoiceRecorder({
  onSendVoice,
  onCancel,
}: {
  onSendVoice: (audioBlob: Blob, durationSeconds: number) => void;
  onCancel: () => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
  }, []);

  const startRecording = useCallback(async () => {
    audioChunksRef.current = [];
    setDuration(0);
    setPreviewBlob(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.warning("Voice recording is not supported in this browser environment.");
      setPermissionDenied(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Select mime type supported by the browser
      let mimeType = "audio/webm;codecs=opus";
      if (typeof MediaRecorder !== "undefined") {
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          if (MediaRecorder.isTypeSupported("audio/mp4")) {
            mimeType = "audio/mp4";
          } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
            mimeType = "audio/ogg";
          } else {
            mimeType = ""; // Browser default
          }
        }
      }

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setPreviewBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setPreviewUrl(url);
        setIsRecording(false);
      };

      recorder.start(100);
      setIsRecording(true);
      setPermissionDenied(false);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      // Use console.warn instead of console.error to avoid treating expected user permission denials as fatal system errors
      console.warn("[VoiceRecorder] Microphone access was not granted:", err);
      setPermissionDenied(true);
      setIsRecording(false);
      toast.warning("Microphone access is required to record voice notes.");
    }
  }, []);

  // Check browser support and initialize recording on mount
  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof MediaRecorder === "undefined"
    ) {
      toast.warning("Voice recording is not supported in this browser.");
      onCancelRef.current();
      return;
    }

    void startRecording();

    return () => {
      cleanup();
    };
  }, [cleanup, startRecording]);

  // Cleanup temporary URLs
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const togglePreviewPlay = () => {
    if (!previewAudioRef.current) return;
    if (isPlayingPreview) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      previewAudioRef.current
        .play()
        .then(() => setIsPlayingPreview(true))
        .catch(() => setIsPlayingPreview(false));
    }
  };

  const handleSend = () => {
    if (!previewBlob) return;
    cleanup();
    onSendVoice(previewBlob, duration);
  };

  const handleDiscard = () => {
    cleanup();
    onCancel();
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  if (permissionDenied) {
    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-xl bg-secondary/80 border border-border text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <AlertCircle size={16} className="text-[#F59E0B] shrink-0" />
          <span>Microphone access was denied or is unavailable in this browser.</span>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => void startRecording()}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground border border-border"
          >
            <RefreshCw size={12} />
            <span>Try Again</span>
          </button>
          <button
            type="button"
            onClick={handleDiscard}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-card hover:bg-secondary text-muted-foreground hover:text-foreground border border-border"
          >
            <X size={12} />
            <span>Close</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 p-2 bg-secondary/80 rounded-xl border border-border">
      {/* RECORDING STATE */}
      {isRecording ? (
        <>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E91E63] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#E91E63]"></span>
            </span>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Mic size={14} className="text-[#E91E63]" />
              <span>Recording... {formatSeconds(duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDiscard}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-card transition"
              title="Cancel recording"
            >
              <Trash2 size={16} />
            </button>
            <button
              type="button"
              onClick={stopRecording}
              className="px-3 py-1.5 rounded-lg bg-[#E91E63] text-white text-xs font-medium hover:bg-[#C2185B] flex items-center gap-1.5 shadow-sm"
            >
              <Square size={13} className="fill-white" />
              <span>Done</span>
            </button>
          </div>
        </>
      ) : (
        /* PREVIEW STATE */
        <>
          {previewUrl && (
            <audio
              ref={previewAudioRef}
              src={previewUrl}
              onEnded={() => setIsPlayingPreview(false)}
              onError={(e) => {
                e.stopPropagation();
                setIsPlayingPreview(false);
              }}
            />
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePreviewPlay}
              className="h-8 w-8 rounded-full bg-[#E91E63] text-white flex items-center justify-center hover:bg-[#C2185B] transition shadow-sm"
            >
              {isPlayingPreview ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
            </button>
            <div className="text-xs font-semibold text-foreground">
              <span>Preview voice note ({formatSeconds(duration)})</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDiscard}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-card transition"
              title="Discard"
            >
              <Trash2 size={16} />
            </button>
            <button
              type="button"
              onClick={handleSend}
              className="px-3.5 py-1.5 rounded-lg bg-[#E91E63] text-white text-xs font-semibold hover:bg-[#C2185B] flex items-center gap-1.5 shadow-sm"
            >
              <Send size={13} />
              <span>Send</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
