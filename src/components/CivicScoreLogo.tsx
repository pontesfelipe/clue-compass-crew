import { cn } from "@/lib/utils";

interface CivicScoreLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: { text: "text-lg", checkmark: "h-5 w-5" },
  md: { text: "text-xl", checkmark: "h-6 w-6" },
  lg: { text: "text-3xl", checkmark: "h-8 w-8" },
  xl: { text: "text-5xl md:text-6xl", checkmark: "h-12 w-12 md:h-14 md:w-14" },
};

export function CivicScoreLogo({ size = "md", showText = true, className }: CivicScoreLogoProps) {
  const config = sizeConfig[size];

  if (!showText) {
    // Icon-only version with checkmark
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <svg 
          viewBox="0 0 24 24" 
          className={cn(config.checkmark, "text-primary")}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    );
  }

  return (
    <span className={cn("font-bold tracking-tight inline-flex items-baseline", config.text, className)}>
      <span className="text-civic-red translate-y-[0.02em]">Ci</span>
      <svg 
        viewBox="0 0 24 24" 
        className={cn(
          "inline-block -mx-0.5",
          size === "sm" && "h-5 w-4 translate-y-[0.37em]",
          size === "md" && "h-6 w-5 translate-y-[0.37em]",
          size === "lg" && "h-8 w-7 translate-y-[0.37em]",
          size === "xl" && "h-12 w-10 md:h-14 md:w-12 translate-y-[0.35em]"
        )}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" className="text-primary" />
      </svg>
      <span className="text-civic-navy dark:text-primary">icScore</span>
    </span>
  );
}
