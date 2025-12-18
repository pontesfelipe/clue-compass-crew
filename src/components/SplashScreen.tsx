import { useEffect, useState } from "react";

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
          <div className="relative">
            {/* Animated ring */}
            <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" 
                 style={{ animationDuration: '2s' }} />
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-civic-navy to-civic-red flex items-center justify-center shadow-2xl">
              <span className="text-4xl font-bold text-white font-playfair">CS</span>
            </div>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-playfair font-bold tracking-tight">
            <span className="text-civic-navy dark:text-white">Civic</span>
            <span className="text-civic-red">Score</span>
          </h1>
          
          <p className="text-muted-foreground text-sm md:text-base tracking-wide">
            Neutral Civic Analytics
          </p>
        </div>

        {/* Loading indicator */}
        <div className="flex flex-col items-center gap-3 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-civic-navy animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-civic-red animate-bounce" style={{ animationDelay: '300ms' }} />
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
