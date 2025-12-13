import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users, Crown, Award, ExternalLink, Info } from "lucide-react";

interface Committee {
  id: string;
  committeeName: string;
  committeeCode: string;
  chamber: string;
  rank: number;
  isChair: boolean;
  isRankingMember: boolean;
}

interface MemberCommitteesProps {
  memberId: string;
}

// Committee descriptions and jurisdictions
const COMMITTEE_INFO: Record<string, { description: string; jurisdiction: string[]; url?: string }> = {
  // House Committees
  HSAG: {
    description: "Oversees federal agriculture policy, including farm programs, nutrition programs, and rural development.",
    jurisdiction: ["Farm policy", "Food stamps/SNAP", "Rural development", "Forestry", "Commodity prices"],
    url: "https://agriculture.house.gov/",
  },
  HSAP: {
    description: "Controls federal spending by drafting appropriations bills that fund government operations.",
    jurisdiction: ["Federal budget allocation", "Government funding", "Discretionary spending"],
    url: "https://appropriations.house.gov/",
  },
  HSAS: {
    description: "Responsible for defense policy, military operations, and the Department of Defense budget.",
    jurisdiction: ["Military operations", "Defense budget", "National security", "Veterans affairs", "Military personnel"],
    url: "https://armedservices.house.gov/",
  },
  HSBA: {
    description: "Oversees banking, insurance, housing, and securities industries.",
    jurisdiction: ["Banking regulation", "Housing policy", "Insurance", "Securities", "Consumer credit"],
    url: "https://financialservices.house.gov/",
  },
  HSBU: {
    description: "Develops the congressional budget resolution and monitors budget enforcement.",
    jurisdiction: ["Federal budget", "Budget process", "Fiscal policy"],
    url: "https://budget.house.gov/",
  },
  HSED: {
    description: "Oversees education and workforce policies including K-12, higher education, and labor laws.",
    jurisdiction: ["K-12 education", "Higher education", "Labor laws", "Workforce training", "Pensions"],
    url: "https://edworkforce.house.gov/",
  },
  HSIF: {
    description: "Wide jurisdiction over energy, telecommunications, health care, and consumer protection.",
    jurisdiction: ["Energy policy", "Telecommunications", "Health care", "Consumer protection", "Environment"],
    url: "https://energycommerce.house.gov/",
  },
  HSFA: {
    description: "Oversees foreign policy, international relations, and foreign aid.",
    jurisdiction: ["Foreign policy", "Treaties", "International organizations", "Foreign aid", "Export controls"],
    url: "https://foreignaffairs.house.gov/",
  },
  HSHA: {
    description: "Responsible for House rules, member conduct, and administrative functions.",
    jurisdiction: ["House rules", "Member conduct", "Elections", "Federal holidays"],
    url: "https://cha.house.gov/",
  },
  HSHM: {
    description: "Oversees homeland security policy including border security and emergency management.",
    jurisdiction: ["Border security", "Cybersecurity", "Emergency management", "TSA", "Coast Guard"],
    url: "https://homeland.house.gov/",
  },
  HSJU: {
    description: "Jurisdiction over federal courts, constitutional amendments, immigration, and criminal law.",
    jurisdiction: ["Federal courts", "Immigration", "Criminal justice", "Civil rights", "Antitrust"],
    url: "https://judiciary.house.gov/",
  },
  HSII: {
    description: "Manages federal lands, territories, Native American affairs, and natural resources.",
    jurisdiction: ["Public lands", "National parks", "Native American affairs", "Territories", "Water resources"],
    url: "https://naturalresources.house.gov/",
  },
  HSGO: {
    description: "Oversees government operations, federal workforce, and conducts investigations.",
    jurisdiction: ["Government efficiency", "Federal workforce", "Postal service", "DC government", "Investigations"],
    url: "https://oversight.house.gov/",
  },
  HSRU: {
    description: "Sets the rules for floor debate and determines which bills reach the House floor.",
    jurisdiction: ["Floor procedures", "Bill scheduling", "Debate rules", "Amendment process"],
    url: "https://rules.house.gov/",
  },
  HSSM: {
    description: "Supports small businesses through oversight of the Small Business Administration.",
    jurisdiction: ["Small business programs", "SBA oversight", "Entrepreneurship", "Access to capital"],
    url: "https://smallbusiness.house.gov/",
  },
  HSSY: {
    description: "Oversees science, technology, and research policy including NASA and NSF.",
    jurisdiction: ["NASA", "NSF", "Research funding", "Technology policy", "STEM education"],
    url: "https://science.house.gov/",
  },
  HSPW: {
    description: "Responsible for transportation infrastructure including highways, aviation, and railroads.",
    jurisdiction: ["Highways", "Aviation", "Railroads", "Public transit", "Water infrastructure"],
    url: "https://transportation.house.gov/",
  },
  HSVE: {
    description: "Oversees veterans' benefits, health care, and the Department of Veterans Affairs.",
    jurisdiction: ["Veterans health care", "Veterans benefits", "VA hospitals", "GI Bill", "Disability compensation"],
    url: "https://veterans.house.gov/",
  },
  HSWM: {
    description: "Has jurisdiction over tax policy, trade, Social Security, and Medicare.",
    jurisdiction: ["Tax policy", "Trade agreements", "Social Security", "Medicare", "Welfare"],
    url: "https://waysandmeans.house.gov/",
  },
  // Senate Committees
  SSAF: {
    description: "Oversees federal agriculture policy, including farm programs, nutrition, and forestry.",
    jurisdiction: ["Farm policy", "Nutrition programs", "Rural development", "Forestry", "Food safety"],
    url: "https://www.agriculture.senate.gov/",
  },
  SSAP: {
    description: "Controls federal spending by drafting appropriations bills.",
    jurisdiction: ["Federal spending", "Government funding", "Budget allocation"],
    url: "https://www.appropriations.senate.gov/",
  },
  SSAS: {
    description: "Responsible for defense policy and the Department of Defense.",
    jurisdiction: ["Military policy", "Defense budget", "National security", "Military personnel"],
    url: "https://www.armed-services.senate.gov/",
  },
  SSBK: {
    description: "Oversees banking, housing, and urban affairs.",
    jurisdiction: ["Banking regulation", "Housing policy", "Urban development", "Securities"],
    url: "https://www.banking.senate.gov/",
  },
  SSBU: {
    description: "Develops the congressional budget resolution.",
    jurisdiction: ["Federal budget", "Fiscal policy", "Budget enforcement"],
    url: "https://www.budget.senate.gov/",
  },
  SSCM: {
    description: "Wide jurisdiction over commerce, science, and transportation.",
    jurisdiction: ["Interstate commerce", "Communications", "Transportation", "Science", "Tourism"],
    url: "https://www.commerce.senate.gov/",
  },
  SSEG: {
    description: "Oversees energy policy and natural resources.",
    jurisdiction: ["Energy policy", "Public lands", "Mining", "Water resources", "Nuclear energy"],
    url: "https://www.energy.senate.gov/",
  },
  SSEV: {
    description: "Responsible for environmental policy and public works.",
    jurisdiction: ["Environmental protection", "Clean air/water", "Infrastructure", "Superfund"],
    url: "https://www.epw.senate.gov/",
  },
  SSFI: {
    description: "Has jurisdiction over taxes, trade, Social Security, and health programs.",
    jurisdiction: ["Tax policy", "Trade", "Social Security", "Medicare", "Medicaid"],
    url: "https://www.finance.senate.gov/",
  },
  SSFR: {
    description: "Oversees foreign policy and international relations.",
    jurisdiction: ["Foreign policy", "Treaties", "Ambassadors", "Foreign aid", "International organizations"],
    url: "https://www.foreign.senate.gov/",
  },
  SSHR: {
    description: "Oversees health, education, labor, and pensions.",
    jurisdiction: ["Public health", "Education", "Labor laws", "Pensions", "Disability policy"],
    url: "https://www.help.senate.gov/",
  },
  SSGA: {
    description: "Oversees government operations and conducts investigations.",
    jurisdiction: ["Government efficiency", "Federal workforce", "Investigations", "Postal service"],
    url: "https://www.hsgac.senate.gov/",
  },
  SSIA: {
    description: "Oversees Indian affairs and Native American policy.",
    jurisdiction: ["Native American affairs", "Tribal relations", "Indian health", "Tribal lands"],
    url: "https://www.indian.senate.gov/",
  },
  SSJU: {
    description: "Jurisdiction over federal courts, immigration, and criminal law.",
    jurisdiction: ["Federal judiciary", "Immigration", "Criminal justice", "Constitutional amendments", "Antitrust"],
    url: "https://www.judiciary.senate.gov/",
  },
  SSRA: {
    description: "Oversees Senate rules, administration, and elections.",
    jurisdiction: ["Senate rules", "Elections", "Campaign finance", "Federal holidays"],
    url: "https://www.rules.senate.gov/",
  },
  SSSB: {
    description: "Supports small businesses and entrepreneurship.",
    jurisdiction: ["Small business programs", "SBA oversight", "Entrepreneurship"],
    url: "https://www.sbc.senate.gov/",
  },
  SSVA: {
    description: "Oversees veterans' benefits and the Department of Veterans Affairs.",
    jurisdiction: ["Veterans health care", "Veterans benefits", "VA oversight", "GI Bill"],
    url: "https://www.veterans.senate.gov/",
  },
  SLIN: {
    description: "Oversees intelligence activities and the intelligence community.",
    jurisdiction: ["Intelligence agencies", "National security", "Surveillance", "Counterterrorism"],
    url: "https://www.intelligence.senate.gov/",
  },
  HLIG: {
    description: "Oversees intelligence activities and the intelligence community.",
    jurisdiction: ["Intelligence agencies", "CIA", "NSA", "Counterterrorism", "Surveillance"],
    url: "https://intelligence.house.gov/",
  },
  JSLC: {
    description: "Joint committee that manages the Library of Congress.",
    jurisdiction: ["Library of Congress", "Copyright", "National collections"],
  },
  JSEC: {
    description: "Joint committee that oversees the Government Publishing Office.",
    jurisdiction: ["Government printing", "Public documents", "Congressional Record"],
  },
  JSTX: {
    description: "Joint committee that reviews the federal tax system.",
    jurisdiction: ["Tax legislation analysis", "Revenue estimates", "Tax code simplification"],
  },
};

function getCommitteeInfo(code: string) {
  // Try exact match first
  if (COMMITTEE_INFO[code]) return COMMITTEE_INFO[code];
  
  // Try partial match (for subcommittees or variant codes)
  const baseCode = code.slice(0, 4);
  if (COMMITTEE_INFO[baseCode]) return COMMITTEE_INFO[baseCode];
  
  // Return default info
  return {
    description: "This committee handles specific legislative matters within its jurisdiction.",
    jurisdiction: ["Legislative oversight", "Policy development", "Hearings and investigations"],
  };
}

export function MemberCommittees({ memberId }: MemberCommitteesProps) {
  const [selectedCommittee, setSelectedCommittee] = useState<Committee | null>(null);

  const { data: committees, isLoading } = useQuery({
    queryKey: ["member-committees", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_committees")
        .select("*")
        .eq("member_id", memberId)
        .order("rank", { ascending: true });

      if (error) throw error;

      return (data || []).map((c: any) => ({
        id: c.id,
        committeeName: c.committee_name,
        committeeCode: c.committee_code,
        chamber: c.chamber,
        rank: c.rank,
        isChair: c.is_chair,
        isRankingMember: c.is_ranking_member,
      })) as Committee[];
    },
    enabled: !!memberId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Committee Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!committees || committees.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Committee Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            No committee data available yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const committeeInfo = selectedCommittee ? getCommitteeInfo(selectedCommittee.committeeCode) : null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Committee Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {committees.map((committee, index) => (
              <button
                key={committee.id}
                onClick={() => setSelectedCommittee(committee)}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/50 opacity-0 animate-slide-up hover:bg-muted transition-colors cursor-pointer text-left"
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground truncate">
                      {committee.committeeName}
                    </p>
                    <Info className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {committee.chamber === 'house' ? 'House' : 'Senate'} Committee · Click for details
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  {committee.isChair && (
                    <Badge className="bg-civic-gold/10 text-civic-gold border-civic-gold/30">
                      <Crown className="h-3 w-3 mr-1" />
                      Chair
                    </Badge>
                  )}
                  {committee.isRankingMember && (
                    <Badge className="bg-civic-blue/10 text-civic-blue border-civic-blue/30">
                      <Award className="h-3 w-3 mr-1" />
                      Ranking
                    </Badge>
                  )}
                  {!committee.isChair && !committee.isRankingMember && (
                    <Badge variant="secondary">Member</Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedCommittee} onOpenChange={(open) => !open && setSelectedCommittee(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {selectedCommittee?.committeeName}
            </DialogTitle>
            <DialogDescription>
              {selectedCommittee?.chamber === 'house' ? 'House' : 'Senate'} Committee
            </DialogDescription>
          </DialogHeader>

          {selectedCommittee && committeeInfo && (
            <div className="space-y-4">
              {/* Role Badge */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Role:</span>
                {selectedCommittee.isChair && (
                  <Badge className="bg-civic-gold/10 text-civic-gold border-civic-gold/30">
                    <Crown className="h-3 w-3 mr-1" />
                    Committee Chair
                  </Badge>
                )}
                {selectedCommittee.isRankingMember && (
                  <Badge className="bg-civic-blue/10 text-civic-blue border-civic-blue/30">
                    <Award className="h-3 w-3 mr-1" />
                    Ranking Member
                  </Badge>
                )}
                {!selectedCommittee.isChair && !selectedCommittee.isRankingMember && (
                  <Badge variant="secondary">Committee Member</Badge>
                )}
              </div>

              {/* Role Explanation */}
              {(selectedCommittee.isChair || selectedCommittee.isRankingMember) && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">
                    {selectedCommittee.isChair && (
                      <>
                        <strong className="text-foreground">Committee Chair:</strong> Leads the committee, sets the agenda, schedules hearings, and controls which bills are considered. The chair is from the majority party.
                      </>
                    )}
                    {selectedCommittee.isRankingMember && (
                      <>
                        <strong className="text-foreground">Ranking Member:</strong> The most senior member of the minority party on the committee. Serves as the minority's leader and spokesperson on committee matters.
                      </>
                    )}
                  </p>
                </div>
              )}

              {/* Committee Description */}
              <div>
                <h4 className="font-medium text-sm mb-2">About This Committee</h4>
                <p className="text-sm text-muted-foreground">
                  {committeeInfo.description}
                </p>
              </div>

              {/* Jurisdiction */}
              <div>
                <h4 className="font-medium text-sm mb-2">Areas of Jurisdiction</h4>
                <div className="flex flex-wrap gap-2">
                  {committeeInfo.jurisdiction.map((area) => (
                    <Badge key={area} variant="outline" className="text-xs">
                      {area}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Why It Matters */}
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <h4 className="font-medium text-sm mb-1 text-primary">Why Committee Assignments Matter</h4>
                <p className="text-xs text-muted-foreground">
                  Committee assignments determine which policy areas a member can directly influence. Members on a committee review bills, hold hearings, and shape legislation before it reaches the full chamber for a vote.
                </p>
              </div>

              {/* Official Website Link */}
              {committeeInfo.url && (
                <a
                  href={committeeInfo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  Visit Official Committee Website
                </a>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
