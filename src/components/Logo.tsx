import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: { icon: "h-7 w-7", text: "text-lg" },
  md: { icon: "h-8 w-8", text: "text-xl" },
  lg: { icon: "h-10 w-10", text: "text-2xl" },
};

export function Logo({ className, showWordmark = true, size = "md" }: LogoProps) {
  const sizes = sizeMap[size];
  
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {/* Grid/Alignment Symbol - represents structure, transparency, signal clarity */}
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(sizes.icon, "flex-shrink-0")}
        aria-hidden="true"
      >
        {/* Outer frame - structure */}
        <rect
          x="2"
          y="2"
          width="28"
          height="28"
          rx="4"
          stroke="currentColor"
          strokeWidth="2"
          className="text-foreground"
        />
        
        {/* Grid lines - alignment, transparency */}
        <line
          x1="11"
          y1="2"
          x2="11"
          y2="30"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-foreground/40"
        />
        <line
          x1="21"
          y1="2"
          x2="21"
          y2="30"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-foreground/40"
        />
        <line
          x1="2"
          y1="11"
          x2="30"
          y2="11"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-foreground/40"
        />
        <line
          x1="2"
          y1="21"
          x2="30"
          y2="21"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-foreground/40"
        />
        
        {/* Center intersection node - signal clarity, checkpoint */}
        <circle
          cx="16"
          cy="16"
          r="3"
          fill="currentColor"
          className="text-foreground"
        />
        
        {/* Corner nodes - data points */}
        <circle
          cx="11"
          cy="11"
          r="1.5"
          fill="currentColor"
          className="text-foreground/60"
        />
        <circle
          cx="21"
          cy="11"
          r="1.5"
          fill="currentColor"
          className="text-foreground/60"
        />
        <circle
          cx="11"
          cy="21"
          r="1.5"
          fill="currentColor"
          className="text-foreground/60"
        />
        <circle
          cx="21"
          cy="21"
          r="1.5"
          fill="currentColor"
          className="text-foreground/60"
        />
      </svg>
      
      {showWordmark && (
        <span className={cn(
          sizes.text,
          "font-semibold tracking-tight text-foreground"
        )}>
          CivicScore
        </span>
      )}
    </div>
  );
}

// Favicon version - symbol only, optimized for small sizes
export function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-8 w-8", className)}
      aria-hidden="true"
    >
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        rx="4"
        stroke="currentColor"
        strokeWidth="2.5"
        className="text-foreground"
      />
      <line x1="11" y1="2" x2="11" y2="30" stroke="currentColor" strokeWidth="2" className="text-foreground/30" />
      <line x1="21" y1="2" x2="21" y2="30" stroke="currentColor" strokeWidth="2" className="text-foreground/30" />
      <line x1="2" y1="11" x2="30" y2="11" stroke="currentColor" strokeWidth="2" className="text-foreground/30" />
      <line x1="2" y1="21" x2="30" y2="21" stroke="currentColor" strokeWidth="2" className="text-foreground/30" />
      <circle cx="16" cy="16" r="4" fill="currentColor" className="text-foreground" />
    </svg>
  );
}
