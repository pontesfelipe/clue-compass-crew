import { useEffect, useRef, useState } from "react";

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

let mermaidInitialized = false;

export function MermaidDiagram({ chart, className = "" }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!containerRef.current) return;

      try {
        // Dynamically import mermaid to avoid module-level initialization issues
        const mermaid = (await import("mermaid")).default;
        
        // Initialize mermaid only once
        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: "base",
            themeVariables: {
              primaryColor: "#3b82f6",
              primaryTextColor: "#fff",
              primaryBorderColor: "#2563eb",
              lineColor: "#6b7280",
              secondaryColor: "#f3f4f6",
              tertiaryColor: "#e5e7eb",
              background: "#ffffff",
              mainBkg: "#f8fafc",
              nodeBorder: "#94a3b8",
              clusterBkg: "#f1f5f9",
              titleColor: "#1e293b",
              edgeLabelBackground: "#ffffff",
            },
            flowchart: {
              htmlLabels: true,
              curve: "basis",
            },
            securityLevel: "loose",
          });
          mermaidInitialized = true;
        }

        // Generate unique ID for each diagram
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, chart);
        setSvgContent(svg);
        setError(null);
      } catch (err) {
        console.error("Mermaid rendering error:", err);
        setError("Failed to render diagram");
      } finally {
        setIsLoading(false);
      }
    };

    renderDiagram();
  }, [chart]);

  if (isLoading) {
    return (
      <div className="p-4 rounded-lg border bg-muted/50 animate-pulse">
        <div className="h-32 bg-muted rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-sm">
        {error}
        <pre className="mt-2 text-xs overflow-auto max-h-32">{chart}</pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`mermaid-diagram overflow-x-auto ${className}`}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}
