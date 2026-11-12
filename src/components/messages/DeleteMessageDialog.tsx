import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, AlertTriangle, User, Users } from "lucide-react";
import type { MessageWithReadsAndReactions } from "@/services/messages";

interface DeleteMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: MessageWithReadsAndReactions | null;
  currentUserId: string;
  isGroupAdmin: boolean;
  onDeleteForMe: (messageId: string) => void;
  onDeleteForEveryone: (messageId: string) => void;
}

export function DeleteMessageDialog({
  open,
  onOpenChange,
  message,
  currentUserId,
  isGroupAdmin,
  onDeleteForMe,
  onDeleteForEveryone,
}: DeleteMessageDialogProps) {
  if (!message) return null;

  const isMine = message.sender_id === currentUserId;
  const canDeleteForEveryone = isMine || isGroupAdmin;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <AlertDialogHeader className="space-y-2">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <Trash2 size={20} />
          </div>
          <AlertDialogTitle className="text-center font-display text-base font-bold text-foreground">
            Delete message?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-xs text-muted-foreground leading-relaxed">
            {canDeleteForEveryone
              ? "Choose whether to remove this message only from your view or delete it for everyone in the chat."
              : "This message will be removed from your chat history. Other participants will still be able to see it."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2 pt-2">
          {/* Delete for everyone (if allowed) */}
          {canDeleteForEveryone && (
            <button
              type="button"
              onClick={() => {
                onDeleteForEveryone(message.id);
                onOpenChange(false);
              }}
              className="flex w-full items-center justify-between rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-xs font-semibold text-destructive hover:bg-destructive hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <Users size={15} />
                <span>Delete for everyone</span>
              </div>
              <span className="text-[10px] opacity-80">All participants</span>
            </button>
          )}

          {/* Delete for me */}
          <button
            type="button"
            onClick={() => {
              onDeleteForMe(message.id);
              onOpenChange(false);
            }}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-secondary/80 px-4 py-2.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <div className="flex items-center gap-2">
              <User size={15} className="text-muted-foreground" />
              <span>Delete for me</span>
            </div>
            <span className="text-[10px] text-muted-foreground">Only for you</span>
          </button>

          {/* Cancel */}
          <AlertDialogCancel className="mt-1 rounded-xl text-xs h-9">Cancel</AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
