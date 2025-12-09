import { BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { SyncStatus } from "@/components/SyncStatus";

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="civic-container py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <BarChart3 className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-serif text-lg font-semibold text-primary">
                CivicScore
              </span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Non-partisan, data-driven insights into your representatives' performance.
            </p>
          </div>

          <div>
            <h4 className="font-serif font-semibold text-foreground mb-4">Explore</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/map" className="hover:text-primary transition-colors">U.S. Map</Link></li>
              <li><Link to="/members" className="hover:text-primary transition-colors">All Members</Link></li>
              <li><Link to="/compare" className="hover:text-primary transition-colors">Compare</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-serif font-semibold text-foreground mb-4">About</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/methodology" className="hover:text-primary transition-colors">Methodology</Link></li>
              <li><Link to="/data-sources" className="hover:text-primary transition-colors">Data Sources</Link></li>
              <li><Link to="/faq" className="hover:text-primary transition-colors">FAQ</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-serif font-semibold text-foreground mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-primary transition-colors">Terms of Use</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-8 space-y-4">
          <div className="flex justify-center">
            <SyncStatus />
          </div>
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} CivicScore. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground">
              Data sourced from Congress.gov API
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
