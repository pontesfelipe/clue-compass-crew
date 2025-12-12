import { useEffect, useRef, useState, useCallback } from "react";

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

export function MermaidDiagram({ chart, className = "" }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const renderAttemptedRef = useRef(false);

  const renderDiagram = useCallback(async () => {
    if (renderAttemptedRef.current) return;
    renderAttemptedRef.current = true;

    try {
      // Dynamically import mermaid
      const mermaidModule = await import("mermaid");
      const mermaid = mermaidModule.default;

      // Initialize with safe settings
      mermaid.initialize({
        startOnLoad: false,
        theme: "default",
        securityLevel: "loose",
        fontFamily: "inherit",
      });

      // Generate unique ID
      const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Render the diagram
      const { svg } = await mermaid.render(id, chart);
      setSvgContent(svg);
      setError(null);
    } catch (err) {
      console.error("Mermaid rendering error:", err);
      setError(err instanceof Error ? err.message : "Failed to render diagram");
    } finally {
      setIsLoading(false);
    }
  }, [chart]);

  useEffect(() => {
    renderAttemptedRef.current = false;
    setIsLoading(true);
    setSvgContent("");
    setError(null);
    
    // Small delay to ensure React is fully ready
    const timer = setTimeout(() => {
      renderDiagram();
    }, 100);

    return () => clearTimeout(timer);
  }, [chart, renderDiagram]);

  if (isLoading) {
    return (
      <div className="p-6 rounded-lg border bg-muted/30 flex items-center justify-center min-h-[200px]">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading diagram...</span>
        </div>
      </div>
    );
  }

  if (error) {
    // Show a formatted text fallback when mermaid fails
    return (
      <div className="p-4 rounded-lg border bg-muted/30">
        <div className="text-xs text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-2">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Interactive diagram unavailable - showing text version
        </div>
        <pre className="text-xs font-mono whitespace-pre-wrap overflow-auto max-h-96 p-3 bg-background rounded border">
          {chart}
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`mermaid-diagram overflow-x-auto bg-background rounded p-4 ${className}`}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}
