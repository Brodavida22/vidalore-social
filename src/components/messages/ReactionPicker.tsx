import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Smile } from "lucide-react";

export const COMMON_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "🌹", "🔥", "👏", "🎉", "🙏"];

export function ReactionPicker({
  onSelectEmoji,
  children,
}: {
  onSelectEmoji: (emoji: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {children || (
          <button
            type="button"
            className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            title="Add reaction"
          >
            <Smile size={15} />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="w-auto p-1.5 bg-card border border-border shadow-xl rounded-full flex items-center gap-1"
      >
        {COMMON_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onSelectEmoji(emoji)}
            className="h-8 w-8 rounded-full flex items-center justify-center text-base hover:bg-secondary hover:scale-125 transition-transform"
          >
            {emoji}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
