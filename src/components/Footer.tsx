import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { SyncStatus } from "@/components/SyncStatus";
import { DataFreshnessIndicator } from "@/components/DataFreshnessIndicator";

export function Footer() {
  return (
    <footer className="border-t border-border bg-secondary/30">
      <div className="civic-container py-10">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="space-y-3">
            <Link to="/">
              <Logo size="sm" />
            </Link>
            <p className="text-sm text-muted-foreground">
              Neutral, data-driven insights into your representatives' actions.
            </p>
          </div>

          <div>
            <h4 className="font-medium text-foreground mb-3 text-sm">Explore</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/map" className="hover:text-foreground transition-colors">U.S. Map</Link></li>
              <li><Link to="/members" className="hover:text-foreground transition-colors">All Members</Link></li>
              <li><Link to="/compare" className="hover:text-foreground transition-colors">Compare</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-foreground mb-3 text-sm">About</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/methodology" className="hover:text-foreground transition-colors">Methodology</Link></li>
              <li><Link to="/data-sources" className="hover:text-foreground transition-colors">Data Sources</Link></li>
              <li><Link to="/faq" className="hover:text-foreground transition-colors">FAQ</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-foreground mb-3 text-sm">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-foreground transition-colors">Terms of Use</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6 space-y-3">
          <div className="flex justify-center">
            <SyncStatus />
          </div>
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} CivicScore. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <DataFreshnessIndicator />
              <p className="text-xs text-muted-foreground">
                Data from Congress.gov & FEC
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
