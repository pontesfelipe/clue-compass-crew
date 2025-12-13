export function CivicScoreLogo({ className = "h-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 180 32"
      className={className}
      aria-label="CivicScore"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* "Ci" in red */}
      <text
        x="0"
        y="24"
        fontFamily="Georgia, serif"
        fontSize="24"
        fontWeight="600"
        fill="#DC2626"
      >
        Ci
      </text>
      
      {/* Checkmark as "v" - positioned to align with text */}
      <path
        d="M30 14 L37 22 L50 8"
        stroke="#DC2626"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M30 14 L37 22 L50 8"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      
      {/* "icScore" in blue */}
      <text
        x="48"
        y="24"
        fontFamily="Georgia, serif"
        fontSize="24"
        fontWeight="600"
        fill="#1D4ED8"
      >
        icScore
      </text>
    </svg>
  );
}

export function CivicScoreLogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      className={className}
      aria-label="CivicScore"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background circle */}
      <circle cx="18" cy="18" r="18" fill="#1D4ED8" />
      
      {/* "C" in red */}
      <text
        x="6"
        y="25"
        fontFamily="Georgia, serif"
        fontSize="20"
        fontWeight="700"
        fill="#DC2626"
      >
        C
      </text>
      
      {/* Checkmark in white */}
      <path
        d="M18 12 L22 20 L30 8"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
