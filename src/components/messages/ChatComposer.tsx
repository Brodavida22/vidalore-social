import { useState, useRef, useEffect, type FormEvent } from "react";
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  Smile,
  Mic,
  X,
  Loader2,
  CornerDownRight,
  RefreshCw,
  AlertCircle,
  Edit2,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { VoiceRecorder } from "./VoiceRecorder";
import { COMMON_EMOJIS } from "./ReactionPicker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatMessageTextForPreview } from "@/lib/storyReplyPayload";
import type { MessageWithReadsAndReactions } from "@/services/messages";

export interface PendingMediaAttachment {
  file: File;
  previewUrl: string;
  type: "image" | "video" | "audio" | "file";
  progress: number;
  status: "idle" | "uploading" | "failed" | "completed";
}

export function ChatComposer({
  onSendMessage,
  onTyping,
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  isSending,
}: {
  onSendMessage: (data: {
    content?: string | undefined;
    mediaFile?: File | Blob;
    messageType?: "text" | "image" | "video" | "audio" | "file" | undefined;
    replyToId?: string | undefined;
  }) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
  replyingTo: MessageWithReadsAndReactions | null;
  editingMessage: MessageWithReadsAndReactions | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  isSending: boolean;
}) {
  const [text, setText] = useState("");
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [attachment, setAttachment] = useState<PendingMediaAttachment | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentAtRef = useRef(0);
  const isTypingActiveRef = useRef(false);
  const onTypingRef = useRef(onTyping);
  onTypingRef.current = onTyping;

  const stopTypingImmediately = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (isTypingActiveRef.current) {
      isTypingActiveRef.current = false;
      lastTypingSentAtRef.current = 0;
      onTypingRef.current(false);
    }
  };

  // Sync edit mode text
  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.content || "");
    }
  }, [editingMessage]);

  // Clear typing status when composer unmounts
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (isTypingActiveRef.current) {
        isTypingActiveRef.current = false;
        onTypingRef.current(false);
      }
    };
  }, []);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (attachment?.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
    };
  }, [attachment]);

  // Throttled typing broadcast with inactivity auto-clear
  const handleTextChange = (value: string) => {
    setText(value);

    if (!value.trim()) {
      stopTypingImmediately();
      return;
    }

    const now = Date.now();
    if (!isTypingActiveRef.current || now - lastTypingSentAtRef.current >= 1500) {
      isTypingActiveRef.current = true;
      lastTypingSentAtRef.current = now;
      onTyping(true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTypingImmediately();
    }, 2500);
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    e.target.value = "";

    // Validate size (max 50MB for video, 20MB for image/audio)
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    const isAudio = file.type.startsWith("audio/");
    const maxSize = isVideo ? 50 * 1024 * 1024 : 20 * 1024 * 1024;

    if (file.size > maxSize) {
      toast.error(`File is too large. Max size is ${isVideo ? "50MB" : "20MB"}.`);
      return;
    }

    if (attachment?.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }

    const preview = URL.createObjectURL(file);
    setAttachment({
      file,
      previewUrl: preview,
      type: isImage ? "image" : isVideo ? "video" : isAudio ? "audio" : "file",
      progress: 0,
      status: "idle",
    });
    setUploadError(null);
  };

  const handleVoiceSend = async (audioBlob: Blob) => {
    setIsRecordingVoice(false);
    try {
      await onSendMessage({
        mediaFile: audioBlob,
        messageType: "audio",
        replyToId: replyingTo?.id,
      });
      toast.success("Voice note sent.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send voice note.");
    }
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();

    const clean = text.trim();
    if (!clean && !attachment) return;

    stopTypingImmediately();

    try {
      if (attachment) {
        setAttachment((prev) => (prev ? { ...prev, status: "uploading", progress: 30 } : null));

        await onSendMessage({
          content: clean || undefined,
          mediaFile: attachment.file,
          messageType: attachment.type,
          replyToId: replyingTo?.id,
        });

        // Cleanup
        URL.revokeObjectURL(attachment.previewUrl);
        setAttachment(null);
      } else {
        await onSendMessage({
          content: clean,
          messageType: "text",
          replyToId: replyingTo?.id,
        });
      }

      setText("");
      if (replyingTo) onCancelReply();
      if (editingMessage) onCancelEdit();
    } catch (err) {
      console.error("Composer send error:", err);
      const msg = err instanceof Error ? err.message : "Send failed";
      setUploadError(msg);
      if (attachment) {
        setAttachment((prev) => (prev ? { ...prev, status: "failed" } : null));
      }
      toast.error(msg);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <div className="border-t border-border bg-card p-2 sm:p-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] space-y-2 shrink-0">
      {/* 1. REPLY BANNER */}
      {replyingTo && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-secondary/80 border border-border text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <CornerDownRight size={14} className="text-[#E91E63] shrink-0" />
            <div className="min-w-0 truncate">
              <span className="font-semibold text-foreground">
                Replying to{" "}
                {replyingTo.sender?.display_name || replyingTo.sender?.username || "message"}:{" "}
              </span>
              <span className="text-muted-foreground truncate">
                {replyingTo.content
                  ? formatMessageTextForPreview(replyingTo.content)
                  : `[${replyingTo.message_type}]`}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="p-1 text-muted-foreground hover:text-foreground"
            title="Cancel reply"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2. EDITING BANNER */}
      {editingMessage && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-[#E91E63]/10 border border-[#E91E63]/20 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Edit2 size={14} className="text-[#E91E63] shrink-0" />
            <span className="font-semibold text-foreground truncate">
              Editing message: {editingMessage.content}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            className="p-1 text-muted-foreground hover:text-foreground"
            title="Cancel edit"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 3. ATTACHMENT PREVIEW CARD */}
      {attachment && (
        <div className="relative flex items-center gap-3 p-2 rounded-xl bg-secondary border border-border max-w-sm">
          {attachment.type === "image" ? (
            <img
              src={attachment.previewUrl}
              alt="Preview"
              className="h-14 w-14 rounded-lg object-cover ring-1 ring-border"
            />
          ) : (
            <div className="h-14 w-14 rounded-lg bg-card flex items-center justify-center text-[#E91E63] border border-border font-bold text-xs uppercase">
              {attachment.type}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground truncate">{attachment.file.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {(attachment.file.size / (1024 * 1024)).toFixed(2)} MB
            </p>

            {attachment.status === "uploading" && (
              <div className="w-full bg-border rounded-full h-1.5 mt-1 overflow-hidden">
                <div
                  className="bg-[#E91E63] h-full transition-all duration-300"
                  style={{ width: `${attachment.progress}%` }}
                />
              </div>
            )}

            {attachment.status === "failed" && (
              <div className="flex items-center gap-1 text-[10px] text-destructive mt-0.5">
                <AlertCircle size={12} />
                <span>Upload failed</span>
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  className="ml-1 underline font-semibold flex items-center gap-0.5"
                >
                  <RefreshCw size={10} /> Retry
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              URL.revokeObjectURL(attachment.previewUrl);
              setAttachment(null);
              setUploadError(null);
            }}
            className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-card"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 4. VOICE RECORDER OVERLAY */}
      {isRecordingVoice ? (
        <VoiceRecorder onSendVoice={handleVoiceSend} onCancel={() => setIsRecordingVoice(false)} />
      ) : (
        /* 5. MAIN COMPOSER INPUT ROW */
        <div className="flex items-end gap-1.5 sm:gap-2">
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*"
            className="hidden"
            onChange={handleFileSelected}
          />

          {/* Media Attachment Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition"
            title="Attach image or video"
          >
            <Paperclip size={18} />
          </button>

          {/* Emoji Picker Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition"
                title="Add emoji"
              >
                <Smile size={18} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              className="w-64 p-2 bg-card border border-border shadow-xl rounded-2xl grid grid-cols-5 gap-1"
            >
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleTextChange(text + emoji)}
                  className="h-9 w-9 rounded-xl flex items-center justify-center text-lg hover:bg-secondary transition hover:scale-125"
                >
                  {emoji}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Textarea Input (handles auto-height, Shift+Enter) */}
          <div className="min-w-0 flex-1 relative rounded-2xl border border-border bg-secondary/50 focus-within:border-[#E91E63] transition px-3 py-1.5">
            <textarea
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={stopTypingImmediately}
              placeholder={
                editingMessage ? "Edit message..." : "Write a message... (Enter to send)"
              }
              rows={1}
              className="w-full resize-none bg-transparent text-[16px] sm:text-sm text-foreground outline-none placeholder:text-muted-foreground max-h-28 overflow-y-auto leading-relaxed"
              maxLength={5000}
              disabled={isSending}
            />
          </div>

          {/* Voice Record or Send Button */}
          {!text.trim() && !attachment ? (
            <button
              type="button"
              onClick={() => setIsRecordingVoice(true)}
              className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-muted-foreground hover:text-[#E91E63] hover:bg-secondary transition"
              title="Record voice message"
            >
              <Mic size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isSending}
              className="h-9 w-9 shrink-0 rounded-xl bg-[#E91E63] text-white flex items-center justify-center hover:bg-[#C2185B] transition shadow-sm disabled:opacity-50"
              title="Send message"
            >
              {isSending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} className="ml-0.5" />
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
