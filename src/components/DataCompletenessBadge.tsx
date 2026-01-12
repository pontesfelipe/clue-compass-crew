import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';

interface DataCompletenessBadgeProps {
  percentage: number;
  missingFields?: string[];
  showDetails?: boolean;
}

export function DataCompletenessBadge({
  percentage,
  missingFields = [],
  showDetails = true
}: DataCompletenessBadgeProps) {
  const getStatusConfig = () => {
    if (percentage >= 90) {
      return {
        variant: 'default' as const,
        icon: CheckCircle,
        label: 'Complete',
        color: 'text-green-600'
      };
    } else if (percentage >= 70) {
      return {
        variant: 'secondary' as const,
        icon: AlertTriangle,
        label: 'Mostly Complete',
        color: 'text-yellow-600'
      };
    } else {
      return {
        variant: 'destructive' as const,
        icon: AlertCircle,
        label: 'Incomplete',
        color: 'text-red-600'
      };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const badge = (
    <Badge variant={config.variant} className="flex items-center gap-1">
      <Icon className={`h-3 w-3 ${config.color}`} />
      <span>{Math.round(percentage)}% Data</span>
    </Badge>
  );

  if (!showDetails || missingFields.length === 0) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <p className="font-semibold mb-1">Missing Data:</p>
            <ul className="list-disc pl-4 space-y-1">
              {missingFields.slice(0, 5).map((field, index) => (
                <li key={index}>{formatFieldName(field)}</li>
              ))}
              {missingFields.length > 5 && (
                <li className="text-muted-foreground">
                  ...and {missingFields.length - 5} more
                </li>
              )}
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function formatFieldName(field: string): string {
  return field
    .split('.')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' > ')
    .replace(/_/g, ' ');
}
