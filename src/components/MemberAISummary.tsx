import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, RefreshCw, Clock, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureToggles } from "@/hooks/useFeatureToggles";
import { Link } from "react-router-dom";

interface MemberAISummaryProps {
  memberId: string;
  memberName: string;
}

export function MemberAISummary({ memberId, memberName }: MemberAISummaryProps) {
  const { user, isLoading: authLoading } = useAuth();
  const { isFeatureEnabled, isLoading: togglesLoading } = useFeatureToggles();
  const [summary, setSummary] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const canRegenerate = !generatedAt || (new Date().getTime() - generatedAt.getTime() > 30 * 24 * 60 * 60 * 1000);

  useEffect(() => {
    fetchExistingSummary();
  }, [memberId]);

  const fetchExistingSummary = async () => {
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from('member_summaries')
        .select('summary, generated_at')
        .eq('member_id', memberId)
        .single();

      if (data && !error) {
        setSummary(data.summary);
        setGeneratedAt(new Date(data.generated_at));
      }
    } catch (err) {
      // No existing summary, that's okay
    } finally {
      setIsFetching(false);
    }
  };

  const generateSummary = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-member-summary`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ memberId }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429 && data.nextAvailable) {
          const nextDate = new Date(data.nextAvailable);
          nextDate.setMonth(nextDate.getMonth() + 1);
          toast({
            title: "Summary limit reached",
            description: `You can generate a new summary after ${nextDate.toLocaleDateString()}`,
            variant: "destructive",
          });
        } else {
          throw new Error(data.error || 'Failed to generate summary');
        }
        return;
      }

      setSummary(data.summary);
      setGeneratedAt(new Date());
      toast({
        title: "Summary generated",
        description: "AI analysis complete",
      });
    } catch (err) {
      console.error('Error generating summary:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to generate summary",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getNextAvailableDate = () => {
    if (!generatedAt) return null;
    const nextDate = new Date(generatedAt);
    nextDate.setMonth(nextDate.getMonth() + 1);
    return nextDate;
  };

  // Check if feature is disabled
  if (!togglesLoading && !isFeatureEnabled("ai_summary")) {
    return null;
  }

  if (authLoading || isFetching || togglesLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-serif text-xl font-semibold text-foreground">AI Summary</h2>
        </div>
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-serif text-xl font-semibold text-foreground">AI Summary</h2>
        </div>
        <div className="text-center py-6">
          <Lock className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">
            Sign in to access AI-powered summaries of {memberName}'s legislative activity.
          </p>
          <Button variant="civic" asChild>
            <Link to="/auth">Sign In</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-serif text-xl font-semibold text-foreground">AI Summary</h2>
        </div>
        {generatedAt && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Generated {formatDate(generatedAt)}</span>
          </div>
        )}
      </div>

      {summary ? (
        <div className="space-y-4">
          <div className="prose prose-sm max-w-none text-foreground/90">
            {summary.split('\n\n').map((paragraph, i) => (
              <p key={i} className="mb-3 last:mb-0 leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
          
          {!canRegenerate && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Next update available {getNextAvailableDate()?.toLocaleDateString()}
            </p>
          )}
          
          {canRegenerate && (
            <Button
              variant="civic-outline"
              size="sm"
              onClick={generateSummary}
              disabled={isLoading}
              className="mt-4"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Regenerate Summary
                </>
              )}
            </Button>
          )}
        </div>
      ) : (
        <div className="text-center py-6">
          <p className="text-muted-foreground mb-4">
            Get an AI-powered analysis of {memberName}&apos;s legislative activity, voting patterns, and policy positions in simple terms.
          </p>
          <Button
            variant="civic"
            onClick={generateSummary}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Generating Summary...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate AI Summary
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            You can generate one summary per month
          </p>
        </div>
      )}
    </div>
  );
}
