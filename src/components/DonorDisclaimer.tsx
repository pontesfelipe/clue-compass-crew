import { AlertTriangle, ExternalLink, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DonorDisclaimerProps {
  variant?: "inline" | "full";
}

export function DonorDisclaimer({ variant = "inline" }: DonorDisclaimerProps) {
  if (variant === "inline") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Info className="h-3 w-3" />
              <span>Data source</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-xs">
              <strong>Source:</strong> FEC (federal filings). Names and addresses
              reflect campaign filings and may contain errors. Do not use this
              information to harass or contact individuals.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Alert variant="default" className="bg-muted/50 border-muted-foreground/20">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="text-sm font-medium">Public Records Notice</AlertTitle>
      <AlertDescription className="text-xs text-muted-foreground">
        This data comes from{" "}
        <a
          href="https://www.fec.gov/data/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-civic-blue hover:underline"
        >
          FEC federal filings
          <ExternalLink className="h-3 w-3" />
        </a>
        . Names and addresses reflect campaign filings and may contain errors.
        Do not use this information to harass or contact individuals.
      </AlertDescription>
    </Alert>
  );
}
