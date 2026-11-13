import { useEffect, useState } from "react";
import { Toaster as Sonner } from "sonner";
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

export function getResponsiveToastPosition(isDesktop: boolean): ToasterProps["position"] {
  return isDesktop ? "top-right" : "top-center";
}

function useIsDesktopViewport(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mql = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener?.("change", update);
    return () => mql.removeEventListener?.("change", update);
  }, []);

  return isDesktop;
}

const Toaster = ({ position, ...props }: ToasterProps) => {
  const [mounted, setMounted] = useState(false);
  const isDesktop = useIsDesktopViewport();
  const resolvedPosition = position ?? getResponsiveToastPosition(isDesktop);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <Sonner
      position={resolvedPosition}
      closeButton
      visibleToasts={4}
      gap={10}
      expand={false}
      className="vidalore-toaster toaster group"
      icons={{
        success: <CheckCircle2 className="h-[18px] w-[18px] text-[#22C55E]" />,
        error: <XCircle className="h-[18px] w-[18px] text-[#EF4444]" />,
        warning: <AlertTriangle className="h-[18px] w-[18px] text-[#F59E0B]" />,
        info: <Info className="h-[18px] w-[18px] text-[#E91E63]" />,
        loading: <Loader2 className="h-[18px] w-[18px] animate-spin text-[#E91E63]" />,
      }}
      toastOptions={{
        duration: 3500,
        classNames: {
          toast:
            "vidalore-toast group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:rounded-2xl group-[.toaster]:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.22)] dark:group-[.toaster]:shadow-[0_16px_38px_-10px_rgba(0,0,0,0.72)] group-[.toaster]:px-3.5 group-[.toaster]:py-3 group-[.toaster]:pr-9",
          title: "text-[13px] font-semibold leading-snug tracking-[-0.01em] text-card-foreground",
          description: "text-[12px] leading-relaxed text-muted-foreground mt-0.5",
          icon: "shrink-0 mt-0.5",
          closeButton:
            "vidalore-toast-close !left-auto !right-2.5 !top-2.5 !transform-none !border-0 !bg-transparent !text-muted-foreground hover:!text-foreground hover:!bg-secondary !h-6 !w-6 !rounded-lg transition-colors",
          actionButton:
            "group-[.toast]:bg-[#E91E63] group-[.toast]:hover:bg-[#C2185B] group-[.toast]:text-white group-[.toast]:rounded-lg group-[.toast]:text-xs group-[.toast]:font-semibold group-[.toast]:px-3 group-[.toast]:py-1.5",
          cancelButton:
            "group-[.toast]:bg-secondary group-[.toast]:text-secondary-foreground group-[.toast]:rounded-lg group-[.toast]:text-xs",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
