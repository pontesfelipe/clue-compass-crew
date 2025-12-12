import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Download, BookOpen, Database, Workflow, Globe, Clock, Layout, Users, FileText, Vote, DollarSign, Calculator, MapPin, Shield, Bell, Brain } from "lucide-react";

// Version tracking
const DOCUMENTATION_VERSION = "1.0.0";
const LAST_UPDATED = "2024-12-12";

interface DocumentSection {
  id: string;
  title: string;
  content: string;
}

const generateMarkdownDocument = () => {
  return `# CivicScore Platform Documentation
Version: ${DOCUMENTATION_VERSION}
Last Updated: ${LAST_UPDATED}

---

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Data Model](#data-model)
4. [External Integrations](#external-integrations)
5. [Edge Functions](#edge-functions)
6. [Cron Jobs Schedule](#cron-jobs)
7. [Application Screens](#application-screens)
8. [Member Page Data Flow](#member-page-data-flow)
9. [User Alignment System](#user-alignment-system)
10. [Authentication & Authorization](#authentication)

---

## 1. Overview

CivicScore is a civic engagement platform that tracks and scores U.S. Congress members based on their legislative activity, voting records, and campaign finance data. The platform enables users to:

- **Explore Congress Members**: View detailed profiles of all 539 members (100 Senators + 435 Representatives + 4 Delegates)
- **Track Voting Records**: Access comprehensive voting history with party breakdowns
- **Analyze Campaign Finance**: Understand funding sources, PAC dependencies, and grassroots support
- **Calculate Alignment Scores**: Personalized politician-user alignment based on issue priorities
- **Monitor Legislative Activity**: Track bills, sponsorships, and legislative impact
- **Visualize State Performance**: Interactive maps showing state-level congressional performance

### Technology Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Edge Functions, Auth)
- **Data Sources**: Congress.gov API, FEC API, Senate.gov, House Clerk XML
- **AI Integration**: Lovable AI (Google Gemini 2.5 Flash)

---

## 2. Architecture

### Feature-Based Structure
\`\`\`
src/
├── components/          # Shared UI components
│   ├── ui/             # shadcn/ui components
│   └── admin/          # Admin-specific components
├── features/           # Feature modules
│   ├── alignment/      # User-politician alignment
│   ├── finance/        # Campaign finance
│   ├── members/        # Member data & components
│   ├── scores/         # Scoring engine
│   ├── states/         # State data hooks
│   └── votes/          # Vote types
├── hooks/              # Custom React hooks
├── pages/              # Route pages
├── lib/                # Utilities
└── integrations/       # Supabase client & types

supabase/
└── functions/          # Edge Functions (serverless backend)
\`\`\`

### Data Flow
\`\`\`
External APIs → Edge Functions → Database Tables → React Hooks → UI Components
     ↓              ↓                ↓                ↓            ↓
Congress.gov   sync-*        members, bills,    useMembers,   MemberCard,
FEC API        functions     votes, etc.        useBills      VotesList
\`\`\`

---

## 3. Data Model

### Core Tables

#### \`members\`
Stores all Congress members (539 total).
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| bioguide_id | text | Official Congress.gov ID |
| full_name | text | Member's full name |
| first_name, last_name | text | Name components |
| party | enum | D (Democrat), R (Republican), I (Independent) |
| chamber | enum | house, senate |
| state | text | State represented |
| district | text | District number (House only) |
| in_office | boolean | Currently serving |
| image_url | text | Official portrait URL |
| fec_candidate_id | text | FEC candidate identifier |
| twitter_handle | text | Twitter/X handle |
| website_url | text | Official website |
| office_address, phone | text | Contact information |

#### \`bills\`
Legislative bills (House and Senate).
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| congress | integer | Congress number (119 = 2025-2026) |
| bill_type | enum | hr, s, hjres, sjres, hconres, sconres, hres, sres |
| bill_number | integer | Bill number |
| title | text | Full title |
| short_title | text | Short/common title |
| summary | text | Official summary |
| bill_impact | text | AI-generated impact analysis |
| policy_area | text | Primary policy area |
| subjects | text[] | Subject tags |
| enacted | boolean | Whether signed into law |
| introduced_date, latest_action_date | date | Key dates |

#### \`votes\`
Roll call votes from both chambers.
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| congress, session | integer | Congress and session numbers |
| chamber | enum | house, senate |
| roll_number | integer | Roll call number |
| vote_date | date | Date of vote |
| question | text | Vote question/motion |
| result | text | Passed, Failed, etc. |
| total_yea, total_nay | integer | Vote counts |
| bill_id | uuid | Related bill (if any) |

#### \`member_votes\`
Individual member vote records.
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| member_id | uuid | FK to members |
| vote_id | uuid | FK to votes |
| position | enum | yea, nay, present, not_voting |
| position_normalized | text | Normalized position |
| weight | numeric | Vote weight for scoring |

#### \`bill_sponsorships\`
Bill sponsorship and co-sponsorship records.
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| bill_id | uuid | FK to bills |
| member_id | uuid | FK to members |
| is_sponsor | boolean | Primary sponsor |
| is_original_cosponsor | boolean | Original co-sponsor |
| cosponsored_date | date | Date co-sponsored |

#### \`member_scores\`
Calculated performance scores.
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| member_id | uuid | FK to members |
| user_id | uuid | NULL for public, user_id for personalized |
| overall_score | numeric | Composite score (0-100) |
| productivity_score | numeric | Bills sponsored/enacted |
| attendance_score | numeric | Voting participation |
| bipartisanship_score | numeric | Cross-party collaboration |
| issue_alignment_score | numeric | User-specific alignment |
| bills_sponsored, bills_cosponsored | integer | Activity counts |
| votes_cast, votes_missed | integer | Voting stats |

#### \`member_contributions\`
Campaign contribution records from FEC.
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| member_id | uuid | FK to members |
| contributor_name | text | Donor name |
| contributor_type | text | individual, pac, committee |
| contributor_state | text | Donor's state |
| industry | text | Industry category |
| amount | numeric | Contribution amount |
| cycle | integer | Election cycle (e.g., 2024) |

#### \`funding_metrics\`
Aggregated funding analysis.
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| member_id | uuid | FK to members |
| cycle | integer | Election cycle |
| total_receipts | numeric | Total campaign receipts |
| pct_from_individuals | numeric | % from individuals |
| pct_from_committees | numeric | % from PACs/committees |
| pct_from_small_donors | numeric | % from small donors |
| pct_from_in_state | numeric | % from home state |
| grassroots_support_score | numeric | Grassroots score (0-100) |
| pac_dependence_score | numeric | PAC dependence (0-100) |
| local_money_score | numeric | Local funding score (0-100) |

#### \`state_scores\`
Pre-computed state-level aggregates.
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| state | text | State name |
| member_count | integer | Total members |
| avg_member_score | numeric | Average score |
| democrat_count, republican_count | integer | Party breakdown |
| senate_count, house_count | integer | Chamber breakdown |
| avg_productivity, avg_attendance | numeric | Average metrics |
| avg_grassroots_support, avg_pac_dependence | numeric | Finance metrics |

### User & Alignment Tables

#### \`profiles\`
User profile information.
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Auth user ID |
| email | text | User email |
| first_name, last_name | text | Name fields |
| display_name | text | Display name |
| home_state | text | User's state |
| zip_code | text | Zip code |
| age_range | text | Age bracket |
| profile_complete | boolean | Wizard completed |
| profile_version | integer | For cache invalidation |

#### \`issues\`
Policy issues for alignment scoring.
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| slug | text | URL-safe identifier |
| label | text | Display name |
| description | text | Issue description |
| icon_name | text | Lucide icon name |
| is_active | boolean | Shown to users |
| sort_order | integer | Display order |

#### \`issue_questions\`
Questions for each issue.
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| issue_id | uuid | FK to issues |
| question_text | text | Question content |
| dimension | text | Scoring dimension |
| weight | numeric | Question weight |
| sort_order | integer | Display order |

#### \`user_answers\`
User responses to questions.
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Auth user ID |
| question_id | uuid | FK to issue_questions |
| answer_value | integer | -2 to +2 scale |

#### \`user_issue_priorities\`
User's priority issues.
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Auth user ID |
| issue_id | uuid | FK to issues |
| priority_level | integer | 1-5 importance |

#### \`politician_issue_positions\`
AI-computed politician positions.
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| politician_id | uuid | FK to members |
| issue_id | uuid | FK to issues |
| score_value | numeric | Position score (-1 to +1) |
| data_points_count | integer | Number of signals |

#### \`user_politician_alignment\`
Computed alignment scores.
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Auth user ID |
| politician_id | uuid | FK to members |
| overall_alignment | numeric | Alignment score (0-100) |
| breakdown | jsonb | Per-issue breakdown |
| profile_version | integer | Profile version at computation |

---

## 4. External Integrations

### Congress.gov API
**Purpose**: Primary source for member data, bills, and votes.

**Endpoints Used**:
- \`/member\` - Member biographical data
- \`/member/{bioguideId}\` - Member details
- \`/bill/{congress}/{type}\` - Bills by type
- \`/bill/{congress}/{type}/{number}\` - Bill details
- \`/bill/{congress}/{type}/{number}/cosponsors\` - Bill cosponsors

**Authentication**: API key in \`CONGRESS_GOV_API_KEY\` secret.

**Rate Limits**: 1000 requests/hour.

### FEC API
**Purpose**: Campaign finance data.

**Endpoints Used**:
- \`/candidates/search\` - Find candidate by name/state
- \`/schedules/schedule_a\` - Itemized contributions

**Authentication**: API key in \`FEC_API_KEY\` secret.

**Data Retrieved**:
- Individual contributions
- PAC contributions
- Contributor names and states
- Industry classifications

### House Clerk XML
**Purpose**: Detailed House vote records with member positions.

**URL Pattern**: \`https://clerk.house.gov/evs/{year}/roll{number}.xml\`

**Data Retrieved**:
- Individual member votes by bioguide_id
- Vote totals by party

### Senate.gov XML
**Purpose**: Senate vote records.

**URL Pattern**: \`https://www.senate.gov/legislative/LIS/roll_call_votes/vote{congress}{session}/vote_{congress}_{session}_{number}.xml\`

**Data Retrieved**:
- Individual senator votes (matched by last_name + state)
- Vote totals

### Lovable AI (Google Gemini 2.5 Flash)
**Purpose**: AI-powered analysis.

**Used For**:
- Member activity summaries
- Bill impact analysis
- Issue classification of bills

---

## 5. Edge Functions

### Data Sync Functions

#### \`sync-congress-members\`
**Purpose**: Sync all Congress members from Congress.gov.
**Frequency**: Daily at midnight UTC
**Tables Updated**: \`members\`
**Logic**:
1. Fetch all members from Congress.gov API
2. Determine chamber from district field (presence = House, absence = Senate)
3. Upsert into members table
4. Update sync_progress

#### \`sync-bills\`
**Purpose**: Sync bills and sponsorships.
**Frequency**: Every 6 hours
**Tables Updated**: \`bills\`, \`bill_sponsorships\`
**Logic**:
1. Fetch HR and S type bills
2. Store bill details with policy area
3. Fetch cosponsors for each bill
4. Create sponsorship records

#### \`sync-votes\`
**Purpose**: Sync roll call votes and member positions.
**Frequency**: Every 2 hours
**Tables Updated**: \`votes\`, \`member_votes\`
**Logic**:
1. Fetch vote list from Congress.gov
2. For House votes: Parse clerk.house.gov XML for positions
3. For Senate votes: Parse senate.gov XML, match by last_name + state
4. Calculate position weights for scoring

#### \`sync-member-details\`
**Purpose**: Fetch additional member details (committees, statements).
**Frequency**: Daily at 1 AM
**Tables Updated**: \`member_committees\`, \`member_statements\`

#### \`sync-fec-finance\`
**Purpose**: Sync FEC contribution data.
**Frequency**: Daily at 2 AM (incremental)
**Tables Updated**: \`member_contributions\`, \`member_sponsors\`
**Logic**:
1. Match members to FEC candidate IDs
2. Fetch itemized contributions (Schedule A)
3. Categorize contributors (individual, pac, committee)
4. Store granular contribution records

#### \`sync-fec-funding\`
**Purpose**: Compute funding metrics.
**Frequency**: Daily at 3 AM
**Tables Updated**: \`funding_metrics\`
**Logic**:
1. Aggregate contributions by member
2. Calculate percentages (in-state, small donors, PACs)
3. Compute scores (grassroots, PAC dependence, local money)

### Score Calculation Functions

#### \`calculate-member-scores\`
**Purpose**: Calculate overall member performance scores.
**Frequency**: Every 2 hours (30 min after votes)
**Tables Updated**: \`member_scores\`
**Components**:
- Productivity: Bills sponsored/enacted
- Attendance: Votes cast vs. available
- Bipartisanship: Cross-party cosponsorship

#### \`recalculate-state-scores\`
**Purpose**: Pre-compute state-level aggregates.
**Frequency**: Every 2 hours at :45
**Tables Updated**: \`state_scores\`
**Aggregates**: Average scores, member counts, party breakdown

### AI Functions

#### \`generate-member-summary\`
**Purpose**: Generate AI summary of member activity.
**Trigger**: User request (rate-limited to 1/month per member)
**Tables Updated**: \`member_summaries\`
**Model**: google/gemini-2.5-flash

#### \`generate-bill-impact\`
**Purpose**: Generate AI analysis of bill impact.
**Trigger**: Automatic during bill sync
**Tables Updated**: \`bills\` (bill_impact column)
**Output**: What It Does, Who It Affects, Benefits, Concerns, Status

#### \`classify-issue-signals\`
**Purpose**: Classify bills into policy issues.
**Frequency**: Every 6 hours at :15
**Tables Updated**: \`issue_signals\`
**Logic**:
1. Check policy_area_mappings first
2. Fall back to AI classification
3. Store direction (-1, 0, +1) and confidence

#### \`compute-politician-positions\`
**Purpose**: Aggregate issue signals into politician positions.
**Frequency**: Every 6 hours at :30
**Tables Updated**: \`politician_issue_positions\`
**Logic**:
1. Sum weighted signals by politician and issue
2. Normalize to -1 to +1 scale
3. Store with data point count

### User Functions

#### \`log-user-login\`
**Purpose**: Track user login activity.
**Trigger**: User login
**Tables Updated**: \`user_activity_log\`

#### \`delete-user\`
**Purpose**: Cascade delete user data.
**Trigger**: Admin or self-service
**Tables Affected**: All user-related tables

#### \`send-weekly-digest\`
**Purpose**: Send weekly activity digest emails.
**Frequency**: Weekly (Monday 8 AM)
**Status**: Currently disabled

---

## 6. Cron Jobs Schedule

| Job | Cron Expression | Time (UTC) | Function |
|-----|-----------------|------------|----------|
| sync-congress-members | 0 0 * * * | Daily 00:00 | Sync all members |
| sync-bills | 0 */6 * * * | Every 6h | Sync bills & sponsorships |
| sync-votes | 0 */2 * * * | Every 2h | Sync votes & positions |
| sync-member-details | 0 1 * * * | Daily 01:00 | Member committees, statements |
| sync-fec-finance | 0 2 * * * | Daily 02:00 | FEC contributions |
| sync-fec-funding | 0 3 * * * | Daily 03:00 | Funding metrics |
| calculate-member-scores | 30 */2 * * * | Every 2h at :30 | Member scores |
| recalculate-state-scores | 45 */2 * * * | Every 2h at :45 | State aggregates |
| classify-issue-signals | 15 */6 * * * | Every 6h at :15 | AI classification |
| compute-politician-positions | 30 */6 * * * | Every 6h at :30 | Position aggregation |
| get-floor-schedule | 0 4 * * * | Daily 04:00 | Congress floor schedule |

---

## 7. Application Screens

### Public Pages

| Route | Component | Description |
|-------|-----------|-------------|
| \`/\` | Index.tsx | Homepage with US map, stats, CTAs |
| \`/map\` | MapPage.tsx | Interactive state map with filters |
| \`/members\` | MembersPage.tsx | All 539 members alphabetically |
| \`/member/:id\` | MemberPage.tsx | Detailed member profile |
| \`/bills\` | BillsPage.tsx | Bill listing with filters |
| \`/bill/:id\` | BillPage.tsx | Bill details |
| \`/votes\` | VotesPage.tsx | Vote listing with filters |
| \`/state/:state\` | StatePage.tsx | State-specific members |
| \`/compare\` | ComparePage.tsx | Member comparison tool |
| \`/news\` | CongressNewsPage.tsx | Floor schedule, elections |

### Authenticated Pages

| Route | Component | Description |
|-------|-----------|-------------|
| \`/auth\` | AuthPage.tsx | Login/signup |
| \`/my-profile\` | MyProfilePage.tsx | User profile management |
| \`/my-profile/matches\` | MyMatchesPage.tsx | Top aligned politicians |
| \`/tracked\` | TrackedMembersPage.tsx | Tracked member activity |

### Admin Pages

| Route | Component | Description |
|-------|-----------|-------------|
| \`/admin\` | AdminPage.tsx | Admin dashboard (tabs) |

### Informational Pages

| Route | Component | Description |
|-------|-----------|-------------|
| \`/how-it-works\` | HowItWorksPage.tsx | Methodology explanation |
| \`/methodology\` | MethodologyPage.tsx | Scoring methodology |
| \`/data-sources\` | DataSourcesPage.tsx | Data source descriptions |
| \`/faq\` | FAQPage.tsx | Frequently asked questions |
| \`/terms\` | TermsPage.tsx | Terms & Conditions |
| \`/privacy\` | PrivacyPage.tsx | Privacy Policy |

---

## 8. Member Page Data Flow

The member detail page (\`/member/:id\`) aggregates data from multiple sources:

### Header Section
**Data Source**: \`members\` table
**Fields**: full_name, party, chamber, state, district, image_url
**Hook**: \`useMembers\`

### Score Ring
**Data Source**: \`member_scores\` table
**Fields**: overall_score, productivity_score, attendance_score, bipartisanship_score
**Hook**: \`useMembers\` (includes scores)

### AI Summary
**Data Source**: \`member_summaries\` table
**Trigger**: User clicks "Generate Summary"
**Edge Function**: \`generate-member-summary\`
**Rate Limit**: Once per month per member

### Alignment Widget
**Data Source**: \`user_politician_alignment\` table
**Requires**: Authenticated user with completed profile
**Hook**: \`useAlignment\`

### Voting Record
**Data Source**: \`member_votes\` JOIN \`votes\`
**Display**: Recent votes with position, result, date
**Drill-down**: VoteDetailDialog with party breakdown

### Sponsored Bills
**Data Source**: \`bill_sponsorships\` JOIN \`bills\`
**Display**: Bills where is_sponsor = true
**Drill-down**: BillDetailDialog with impact analysis

### Cosponsored Bills
**Data Source**: \`bill_sponsorships\` JOIN \`bills\`
**Display**: Bills where is_sponsor = false
**Sort**: By cosponsored_date

### Policy Areas
**Data Source**: Aggregated from \`bills\` via sponsorships
**Display**: Top 10 policy areas
**Comparison**: vs state peers, vs party peers

### Committees
**Data Source**: \`member_committees\` table
**Display**: Committee memberships with roles

### Financial Relationships
**Data Source**: \`member_contributions\`, \`member_sponsors\`, \`funding_metrics\`
**Display**: Contributors, lobbying, funding profile
**Hook**: \`useMemberFinance\`

### Contact Information
**Data Source**: \`members\` table
**Fields**: office_address, phone, website_url, twitter_handle

---

## 9. User Alignment System

### Profile Wizard Flow
1. **Basic Info**: First name, last name, zip code, age range
2. **Issue Selection**: Choose priority issues (with 1-5 importance slider)
3. **Questions**: Answer questions for each selected issue (-2 to +2 scale)
4. **Review**: See computed stance on each issue

### Alignment Calculation
\`\`\`
For each issue i with priority p_i:
  user_stance = weighted_average(answers for issue i)
  politician_stance = politician_issue_positions[politician][i]
  issue_alignment = 1 - |user_stance - politician_stance| / 2
  
overall_alignment = sum(issue_alignment_i * p_i) / sum(p_i)
\`\`\`

### Score Display
- Shown on member pages for logged-in users with profiles
- Top matches displayed on /my-profile/matches
- Segmented by in-state vs national

---

## 10. Authentication & Authorization

### Auth Flow
- Email/password signup with auto-confirm enabled
- Google OAuth support with metadata capture
- Session managed by Supabase Auth

### Role-Based Access Control
| Role | Capabilities |
|------|--------------|
| user | View data, track members, customize scores |
| admin | All user capabilities + admin dashboard access |

### RLS Policies
- Public data (members, bills, votes): Readable by all
- User data (profiles, answers, alignment): Readable only by owner
- Admin data (ai_usage_log): Readable only by admins

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-12-12 | Initial documentation |

---

*Generated by CivicScore Admin Dashboard*
`;
};

export function DocumentationContent() {
  const [activeSection, setActiveSection] = useState("overview");

  const handleDownload = () => {
    const markdown = generateMarkdownDocument();
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `civicscore-documentation-v${DOCUMENTATION_VERSION}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Platform Documentation
              </CardTitle>
              <CardDescription>
                Comprehensive documentation of CivicScore architecture, data model, and integrations
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline">v{DOCUMENTATION_VERSION}</Badge>
              <Badge variant="secondary">Updated: {LAST_UPDATED}</Badge>
              <Button onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download Markdown
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid grid-cols-5 mb-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="data-model">Data Model</TabsTrigger>
              <TabsTrigger value="integrations">Integrations</TabsTrigger>
              <TabsTrigger value="edge-functions">Edge Functions</TabsTrigger>
              <TabsTrigger value="screens">Screens</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Platform Overview</CardTitle>
                </CardHeader>
                <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                  <p>
                    CivicScore is a civic engagement platform that tracks and scores U.S. Congress members 
                    based on their legislative activity, voting records, and campaign finance data.
                  </p>
                  
                  <h4>Key Features</h4>
                  <ul>
                    <li><strong>Explore Congress Members</strong>: View detailed profiles of all 539 members</li>
                    <li><strong>Track Voting Records</strong>: Access comprehensive voting history with party breakdowns</li>
                    <li><strong>Analyze Campaign Finance</strong>: Understand funding sources and dependencies</li>
                    <li><strong>Calculate Alignment Scores</strong>: Personalized politician-user alignment</li>
                    <li><strong>Monitor Legislative Activity</strong>: Track bills and legislative impact</li>
                    <li><strong>Visualize State Performance</strong>: Interactive maps</li>
                  </ul>

                  <h4>Technology Stack</h4>
                  <div className="grid grid-cols-2 gap-4 not-prose mt-4">
                    <div className="p-4 rounded-lg border bg-card">
                      <h5 className="font-semibold mb-2">Frontend</h5>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>React 18 + TypeScript</li>
                        <li>Vite build tool</li>
                        <li>Tailwind CSS + shadcn/ui</li>
                        <li>React Router DOM</li>
                        <li>TanStack Query</li>
                      </ul>
                    </div>
                    <div className="p-4 rounded-lg border bg-card">
                      <h5 className="font-semibold mb-2">Backend</h5>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>Supabase (PostgreSQL)</li>
                        <li>Edge Functions (Deno)</li>
                        <li>Supabase Auth</li>
                        <li>Row Level Security</li>
                      </ul>
                    </div>
                  </div>

                  <h4 className="mt-6">Architecture Diagram</h4>
                  <div className="p-4 rounded-lg border bg-muted/50 font-mono text-sm">
                    <pre>{`
External APIs → Edge Functions → Database Tables → React Hooks → UI Components
     ↓              ↓                ↓                ↓            ↓
Congress.gov   sync-*        members, bills,    useMembers,   MemberCard,
FEC API        functions     votes, etc.        useBills      VotesList
Senate.gov                                      useVotes
                    `}</pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="data-model" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Database Schema
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="multiple" className="w-full">
                    <AccordionItem value="core">
                      <AccordionTrigger>
                        <span className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Core Tables (Members, Bills, Votes)
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4">
                          <div className="p-4 rounded-lg border">
                            <h5 className="font-semibold mb-2">members</h5>
                            <p className="text-sm text-muted-foreground mb-2">Stores all 539 Congress members.</p>
                            <div className="text-xs font-mono bg-muted p-2 rounded">
                              id, bioguide_id, full_name, first_name, last_name, party, chamber, state, district, in_office, image_url, fec_candidate_id, twitter_handle, website_url, office_address, phone
                            </div>
                          </div>
                          
                          <div className="p-4 rounded-lg border">
                            <h5 className="font-semibold mb-2">bills</h5>
                            <p className="text-sm text-muted-foreground mb-2">Legislative bills (House and Senate).</p>
                            <div className="text-xs font-mono bg-muted p-2 rounded">
                              id, congress, bill_type, bill_number, title, short_title, summary, bill_impact, policy_area, subjects[], enacted, introduced_date, latest_action_date
                            </div>
                          </div>
                          
                          <div className="p-4 rounded-lg border">
                            <h5 className="font-semibold mb-2">votes</h5>
                            <p className="text-sm text-muted-foreground mb-2">Roll call votes from both chambers.</p>
                            <div className="text-xs font-mono bg-muted p-2 rounded">
                              id, congress, session, chamber, roll_number, vote_date, question, result, total_yea, total_nay, bill_id
                            </div>
                          </div>
                          
                          <div className="p-4 rounded-lg border">
                            <h5 className="font-semibold mb-2">member_votes</h5>
                            <p className="text-sm text-muted-foreground mb-2">Individual member vote records.</p>
                            <div className="text-xs font-mono bg-muted p-2 rounded">
                              id, member_id, vote_id, position (yea/nay/present/not_voting), position_normalized, weight
                            </div>
                          </div>
                          
                          <div className="p-4 rounded-lg border">
                            <h5 className="font-semibold mb-2">bill_sponsorships</h5>
                            <p className="text-sm text-muted-foreground mb-2">Bill sponsorship records.</p>
                            <div className="text-xs font-mono bg-muted p-2 rounded">
                              id, bill_id, member_id, is_sponsor, is_original_cosponsor, cosponsored_date
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="scores">
                      <AccordionTrigger>
                        <span className="flex items-center gap-2">
                          <Calculator className="h-4 w-4" />
                          Scores & Metrics
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4">
                          <div className="p-4 rounded-lg border">
                            <h5 className="font-semibold mb-2">member_scores</h5>
                            <p className="text-sm text-muted-foreground mb-2">Calculated performance scores.</p>
                            <div className="text-xs font-mono bg-muted p-2 rounded">
                              id, member_id, user_id, overall_score, productivity_score, attendance_score, bipartisanship_score, issue_alignment_score, bills_sponsored, bills_cosponsored, votes_cast, votes_missed
                            </div>
                          </div>
                          
                          <div className="p-4 rounded-lg border">
                            <h5 className="font-semibold mb-2">state_scores</h5>
                            <p className="text-sm text-muted-foreground mb-2">Pre-computed state aggregates.</p>
                            <div className="text-xs font-mono bg-muted p-2 rounded">
                              id, state, member_count, avg_member_score, democrat_count, republican_count, senate_count, house_count, avg_productivity, avg_attendance, avg_grassroots_support, avg_pac_dependence
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="finance">
                      <AccordionTrigger>
                        <span className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Campaign Finance
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4">
                          <div className="p-4 rounded-lg border">
                            <h5 className="font-semibold mb-2">member_contributions</h5>
                            <p className="text-sm text-muted-foreground mb-2">FEC contribution records.</p>
                            <div className="text-xs font-mono bg-muted p-2 rounded">
                              id, member_id, contributor_name, contributor_type, contributor_state, industry, amount, cycle
                            </div>
                          </div>
                          
                          <div className="p-4 rounded-lg border">
                            <h5 className="font-semibold mb-2">funding_metrics</h5>
                            <p className="text-sm text-muted-foreground mb-2">Aggregated funding analysis.</p>
                            <div className="text-xs font-mono bg-muted p-2 rounded">
                              id, member_id, cycle, total_receipts, pct_from_individuals, pct_from_committees, pct_from_small_donors, pct_from_in_state, grassroots_support_score, pac_dependence_score, local_money_score
                            </div>
                          </div>
                          
                          <div className="p-4 rounded-lg border">
                            <h5 className="font-semibold mb-2">member_sponsors</h5>
                            <p className="text-sm text-muted-foreground mb-2">PAC and organizational sponsors.</p>
                            <div className="text-xs font-mono bg-muted p-2 rounded">
                              id, member_id, sponsor_name, sponsor_type, relationship_type, total_support, cycle
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="users">
                      <AccordionTrigger>
                        <span className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          User & Alignment
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4">
                          <div className="p-4 rounded-lg border">
                            <h5 className="font-semibold mb-2">profiles</h5>
                            <p className="text-sm text-muted-foreground mb-2">User profile information.</p>
                            <div className="text-xs font-mono bg-muted p-2 rounded">
                              id, user_id, email, first_name, last_name, display_name, home_state, zip_code, age_range, profile_complete, profile_version
                            </div>
                          </div>
                          
                          <div className="p-4 rounded-lg border">
                            <h5 className="font-semibold mb-2">issues / issue_questions</h5>
                            <p className="text-sm text-muted-foreground mb-2">Policy issues and questions for alignment.</p>
                            <div className="text-xs font-mono bg-muted p-2 rounded">
                              issues: id, slug, label, description, icon_name, is_active<br/>
                              issue_questions: id, issue_id, question_text, dimension, weight, sort_order
                            </div>
                          </div>
                          
                          <div className="p-4 rounded-lg border">
                            <h5 className="font-semibold mb-2">user_answers / user_issue_priorities</h5>
                            <p className="text-sm text-muted-foreground mb-2">User responses and priorities.</p>
                            <div className="text-xs font-mono bg-muted p-2 rounded">
                              user_answers: id, user_id, question_id, answer_value (-2 to +2)<br/>
                              user_issue_priorities: id, user_id, issue_id, priority_level (1-5)
                            </div>
                          </div>
                          
                          <div className="p-4 rounded-lg border">
                            <h5 className="font-semibold mb-2">politician_issue_positions</h5>
                            <p className="text-sm text-muted-foreground mb-2">AI-computed politician positions.</p>
                            <div className="text-xs font-mono bg-muted p-2 rounded">
                              id, politician_id, issue_id, score_value (-1 to +1), data_points_count
                            </div>
                          </div>
                          
                          <div className="p-4 rounded-lg border">
                            <h5 className="font-semibold mb-2">user_politician_alignment</h5>
                            <p className="text-sm text-muted-foreground mb-2">Computed alignment scores.</p>
                            <div className="text-xs font-mono bg-muted p-2 rounded">
                              id, user_id, politician_id, overall_alignment (0-100), breakdown (jsonb), profile_version
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="integrations" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      Congress.gov API
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Primary source for member data, bills, and votes.
                    </p>
                    <div className="space-y-2">
                      <h5 className="font-semibold text-sm">Endpoints Used</h5>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li><code>/member</code> - Member biographical data</li>
                        <li><code>/member/{'{bioguideId}'}</code> - Member details</li>
                        <li><code>/bill/{'{congress}'}/{'{type}'}</code> - Bills by type</li>
                        <li><code>/bill/.../cosponsors</code> - Bill cosponsors</li>
                      </ul>
                    </div>
                    <div className="p-2 rounded bg-muted text-xs">
                      <strong>Auth:</strong> CONGRESS_GOV_API_KEY<br/>
                      <strong>Rate Limit:</strong> 1000 requests/hour
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      FEC API
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Campaign finance data source.
                    </p>
                    <div className="space-y-2">
                      <h5 className="font-semibold text-sm">Endpoints Used</h5>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li><code>/candidates/search</code> - Find candidate by name/state</li>
                        <li><code>/schedules/schedule_a</code> - Itemized contributions</li>
                      </ul>
                    </div>
                    <div className="p-2 rounded bg-muted text-xs">
                      <strong>Auth:</strong> FEC_API_KEY<br/>
                      <strong>Data:</strong> Contributions, PACs, Industries
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Vote className="h-5 w-5" />
                      House Clerk XML
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Detailed House vote records with member positions.
                    </p>
                    <div className="p-2 rounded bg-muted text-xs font-mono">
                      clerk.house.gov/evs/{'{year}'}/roll{'{number}'}.xml
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Members matched by bioguide_id.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Vote className="h-5 w-5" />
                      Senate.gov XML
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Senate vote records.
                    </p>
                    <div className="p-2 rounded bg-muted text-xs font-mono break-all">
                      senate.gov/legislative/LIS/roll_call_votes/...
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Senators matched by last_name + state.
                    </p>
                  </CardContent>
                </Card>

                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5" />
                      Lovable AI (Google Gemini 2.5 Flash)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="p-4 rounded-lg border">
                        <h5 className="font-semibold mb-2">Member Summaries</h5>
                        <p className="text-sm text-muted-foreground">
                          AI-generated activity summaries. Rate-limited to 1/month per member.
                        </p>
                      </div>
                      <div className="p-4 rounded-lg border">
                        <h5 className="font-semibold mb-2">Bill Impact Analysis</h5>
                        <p className="text-sm text-muted-foreground">
                          Structured analysis: What It Does, Who It Affects, Benefits, Concerns.
                        </p>
                      </div>
                      <div className="p-4 rounded-lg border">
                        <h5 className="font-semibold mb-2">Issue Classification</h5>
                        <p className="text-sm text-muted-foreground">
                          Classify bills into policy issues with direction and confidence.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="edge-functions" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Workflow className="h-5 w-5" />
                    Edge Functions & Cron Schedule
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Function</th>
                          <th className="text-left p-2">Schedule</th>
                          <th className="text-left p-2">Tables Updated</th>
                          <th className="text-left p-2">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        <tr>
                          <td className="p-2 font-mono text-xs">sync-congress-members</td>
                          <td className="p-2"><Badge variant="outline">0 0 * * *</Badge></td>
                          <td className="p-2 text-muted-foreground">members</td>
                          <td className="p-2 text-muted-foreground">Sync all members from Congress.gov</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-mono text-xs">sync-bills</td>
                          <td className="p-2"><Badge variant="outline">0 */6 * * *</Badge></td>
                          <td className="p-2 text-muted-foreground">bills, bill_sponsorships</td>
                          <td className="p-2 text-muted-foreground">Sync HR and S bills with sponsorships</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-mono text-xs">sync-votes</td>
                          <td className="p-2"><Badge variant="outline">0 */2 * * *</Badge></td>
                          <td className="p-2 text-muted-foreground">votes, member_votes</td>
                          <td className="p-2 text-muted-foreground">Sync votes and member positions</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-mono text-xs">sync-member-details</td>
                          <td className="p-2"><Badge variant="outline">0 1 * * *</Badge></td>
                          <td className="p-2 text-muted-foreground">member_committees, member_statements</td>
                          <td className="p-2 text-muted-foreground">Fetch additional member details</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-mono text-xs">sync-fec-finance</td>
                          <td className="p-2"><Badge variant="outline">0 2 * * *</Badge></td>
                          <td className="p-2 text-muted-foreground">member_contributions, member_sponsors</td>
                          <td className="p-2 text-muted-foreground">Sync FEC contribution data</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-mono text-xs">sync-fec-funding</td>
                          <td className="p-2"><Badge variant="outline">0 3 * * *</Badge></td>
                          <td className="p-2 text-muted-foreground">funding_metrics</td>
                          <td className="p-2 text-muted-foreground">Compute funding metrics</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-mono text-xs">calculate-member-scores</td>
                          <td className="p-2"><Badge variant="outline">30 */2 * * *</Badge></td>
                          <td className="p-2 text-muted-foreground">member_scores</td>
                          <td className="p-2 text-muted-foreground">Calculate member performance scores</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-mono text-xs">recalculate-state-scores</td>
                          <td className="p-2"><Badge variant="outline">45 */2 * * *</Badge></td>
                          <td className="p-2 text-muted-foreground">state_scores</td>
                          <td className="p-2 text-muted-foreground">Pre-compute state aggregates</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-mono text-xs">classify-issue-signals</td>
                          <td className="p-2"><Badge variant="outline">15 */6 * * *</Badge></td>
                          <td className="p-2 text-muted-foreground">issue_signals</td>
                          <td className="p-2 text-muted-foreground">AI-classify bills into issues</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-mono text-xs">compute-politician-positions</td>
                          <td className="p-2"><Badge variant="outline">30 */6 * * *</Badge></td>
                          <td className="p-2 text-muted-foreground">politician_issue_positions</td>
                          <td className="p-2 text-muted-foreground">Aggregate signals to positions</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-mono text-xs">generate-member-summary</td>
                          <td className="p-2"><Badge variant="secondary">On demand</Badge></td>
                          <td className="p-2 text-muted-foreground">member_summaries</td>
                          <td className="p-2 text-muted-foreground">AI member activity summary</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-mono text-xs">generate-bill-impact</td>
                          <td className="p-2"><Badge variant="secondary">During sync</Badge></td>
                          <td className="p-2 text-muted-foreground">bills (bill_impact)</td>
                          <td className="p-2 text-muted-foreground">AI bill impact analysis</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="screens" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Layout className="h-5 w-5" />
                      Public Pages
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {[
                        { route: "/", name: "Homepage", desc: "US map, stats, CTAs" },
                        { route: "/map", name: "Map", desc: "Interactive state map" },
                        { route: "/members", name: "Members", desc: "All 539 members" },
                        { route: "/member/:id", name: "Member Detail", desc: "Full member profile" },
                        { route: "/bills", name: "Bills", desc: "Bill listing with filters" },
                        { route: "/votes", name: "Votes", desc: "Vote listing with filters" },
                        { route: "/state/:state", name: "State", desc: "State members" },
                        { route: "/compare", name: "Compare", desc: "Member comparison" },
                        { route: "/news", name: "Congress News", desc: "Floor schedule, elections" },
                      ].map((page) => (
                        <div key={page.route} className="flex items-center justify-between p-2 rounded border">
                          <div>
                            <code className="text-xs bg-muted px-1 rounded">{page.route}</code>
                            <span className="ml-2 text-sm font-medium">{page.name}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{page.desc}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Protected Pages
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h5 className="font-semibold mb-2">Authenticated</h5>
                        <div className="space-y-2">
                          {[
                            { route: "/auth", name: "Auth", desc: "Login/signup" },
                            { route: "/my-profile", name: "My Profile", desc: "Profile management" },
                            { route: "/my-profile/matches", name: "My Matches", desc: "Top aligned politicians" },
                            { route: "/tracked", name: "Tracked Members", desc: "Member activity" },
                          ].map((page) => (
                            <div key={page.route} className="flex items-center justify-between p-2 rounded border">
                              <div>
                                <code className="text-xs bg-muted px-1 rounded">{page.route}</code>
                                <span className="ml-2 text-sm font-medium">{page.name}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">{page.desc}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h5 className="font-semibold mb-2">Admin Only</h5>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-2 rounded border border-destructive/30">
                            <div>
                              <code className="text-xs bg-muted px-1 rounded">/admin</code>
                              <span className="ml-2 text-sm font-medium">Admin Dashboard</span>
                            </div>
                            <Badge variant="destructive">Admin</Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle>Member Page Data Sources</CardTitle>
                    <CardDescription>Where each section of the member detail page gets its data</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-3">
                      {[
                        { section: "Header", table: "members", fields: "name, party, chamber, state, image" },
                        { section: "Score Ring", table: "member_scores", fields: "overall, productivity, attendance, bipartisanship" },
                        { section: "AI Summary", table: "member_summaries", fields: "Generated on-demand" },
                        { section: "Alignment Widget", table: "user_politician_alignment", fields: "Requires user profile" },
                        { section: "Voting Record", table: "member_votes + votes", fields: "Position, result, date" },
                        { section: "Sponsored Bills", table: "bill_sponsorships + bills", fields: "Where is_sponsor=true" },
                        { section: "Cosponsored Bills", table: "bill_sponsorships + bills", fields: "Where is_sponsor=false" },
                        { section: "Policy Areas", table: "bills (aggregated)", fields: "Top 10 policy areas" },
                        { section: "Committees", table: "member_committees", fields: "Name, role, rank" },
                        { section: "Finance", table: "member_contributions, funding_metrics", fields: "Contributors, PACs, metrics" },
                        { section: "Contact", table: "members", fields: "address, phone, website, twitter" },
                      ].map((item) => (
                        <div key={item.section} className="p-3 rounded-lg border">
                          <h5 className="font-semibold text-sm">{item.section}</h5>
                          <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-mono">{item.table}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">{item.fields}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
