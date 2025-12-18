import { useEffect, useState } from "react";
import { CivicScoreLogo } from "./CivicScoreLogo";

interface SplashScreenProps {
  onComplete: () => void;
  minDisplayTime?: number;
}

export const SplashScreen = ({ onComplete, minDisplayTime = 1500 }: SplashScreenProps) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(onComplete, 500); // Wait for fade animation
    }, minDisplayTime);

    return () => clearTimeout(timer);
  }, [onComplete, minDisplayTime]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-civic-navy/5 via-background to-civic-red/5" />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Logo/Brand */}
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <CivicScoreLogo size="xl" />
          
          <p className="text-muted-foreground text-sm md:text-base tracking-wide">
            Neutral Civic Analytics
          </p>
        </div>

        {/* Loading indicator */}
        <div className="flex flex-col items-center gap-3 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-civic-red animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-civic-navy animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-xs text-muted-foreground">Loading...</span>
        </div>
      </div>

      {/* Footer tagline */}
      <div className="absolute bottom-8 text-center animate-fade-in" style={{ animationDelay: '0.5s' }}>
        <p className="text-xs text-muted-foreground/60">
          Clarity about politics, without telling you what to think
        </p>
      </div>
    </div>
  );
};
