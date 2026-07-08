# CivicScore Audit & Improvement Plan

## Executive summary

The app has a solid foundation but three structural issues undermine its core promise ("neutral civic analytics"):

1. **The scoring engine partly fakes what it advertises.** `issue_alignment_score` is a legislative-activity proxy, not real alignment. `classify-issue-signals` embeds `conservative/progressive` direction — directly violating the golden rule.
2. **Half the data pipeline never runs.** State legislators, state bills, state votes, lobbying, committees, governors, and `compute-politician-positions` are missing from the scheduler. DB confirms: **0 state legislators, 0 state bills, 0 issue_signals of type bill/vote**, and `member_lobbying` crashes every run due to a `ReferenceError`.
3. **Data model is bloating silently.** `member_scores` has **1.54M rows for 544 members (~4,900 duplicates each)** — the unique constraint on `(member_id, user_id)` was never added, so every recalc INSERTs instead of upserting. This is the #1 slow query (7.4M ms cumulative).

## Consolidated findings (19 items → severity/area)

| # | Sev | Area | Finding |
|---|-----|------|---------|
| A | P0 | Data | `member_scores` missing unique index → 1.54M dup rows, 4,900/member |
| B | P0 | Pipeline | 7 sync jobs (state-legislators, state-bills, state-votes, lobbying, committees, governors, compute-positions) absent from `DEFAULT_JOBS` |
| C | P0 | Pipeline | `sync-lobbying/index.ts:366` `ReferenceError: years` crashes every run |
| D | P0 | Scoring | `calculate-member-scores` `issue_alignment_score` is activity proxy, not alignment (mislabeled in Methodology) |
| E | P0 | Scoring | `classify-issue-signals` uses `direction: -1 conservative / +1 progressive` — violates neutrality rule |
| F | P0 | UX | `MyMatchesPage` permanently empty for new users; alignment only computed on member-page visit |
| G | P0 | Content | `member_lobbying` has data (15k rows) but zero UI |
| H | P1 | Pipeline | `sync-orchestrator:217` `.not("id","in",<query>)` antipattern → anomaly check silently broken |
| I | P1 | Pipeline | Lobbying data is per-industry aggregate copied to every member (semantically wrong) |
| J | P1 | Scoring | `useAlignment` distance formula hardcodes `/4` scale with no validation |
| K | P1 | Scoring | 7,000+ state legislators locked at provisional 50/50/50/50 |
| L | P1 | UX | `useStateAlignments` N+1 queries per member |
| M | P1 | UX | `GovernorPage` has no score, alignment, finance, or committees |
| N | P1 | Content | `DataSourcesPage` static, missing OpenStates & Senate LDA |
| O | P1 | Content | `MethodologyPage` claims tiered `votes > sponsorships > inferred` weights; actual code uses flat 25/25/25/25 |
| P | P1 | Perf | `member_contributions` unbounded `SELECT *` scan (61k calls, 3.1M ms) — client fetches full table somewhere |
| Q | P2 | Pipeline | No cron trigger for `scheduled-sync` in `config.toml`; cleanup functions unscheduled |
| R | P2 | UX | State legislators use Congress-shaped `MemberPage`; no provisional badge; no browse route |
| S | P2 | Legal | `PrivacyPage`/`TermsPage` reference `support@civicscore.com`, no dates/jurisdiction |

## Proposed implementation — 3 phases

### Phase 1 · Trust & correctness (P0s)

**1.1 Database health**
- Migration: `CREATE UNIQUE INDEX CONCURRENTLY … ON member_scores (member_id, coalesce(user_id, '00000000-…'))`, dedupe existing rows (keep newest per `(member_id,user_id)`), reclaim ~1.5M rows.
- Add missing indexes for `member_contributions(member_id, cycle)` if not present.

**1.2 Fix the lobbying crash**
- `sync-lobbying/index.ts:366`: `years: years` → `year`.
- Reframe `member_lobbying` as an industry-context table (or filter to industries linked to the member's committees/FEC sector) rather than blindly copying 10 rows per member.

**1.3 Schedule the missing jobs**
- Add to `scheduled-sync/DEFAULT_JOBS` and `sync-worker` dispatch: `sync-state-legislators` (weekly), `sync-state-bills` (12h), `sync-state-votes` (12h), `sync-lobbying` (daily), `sync-committees` (daily), `sync-governors` (daily), `compute-politician-positions` (6h).
- Confirm/add `cron.schedule()` for `scheduled-sync` itself (`*/10 * * * *`).
- Disable/delete the 4 stale orphan `sync_jobs` rows last run in 2025.

**1.4 Fix the scoring integrity issues (neutrality)**
- `classify-issue-signals`: replace `direction: -1/0/+1 conservative/progressive` with `alignment: -1/0/+1` framed only in terms of the *issue position* (supports/neutral/opposes the stated issue). Update the OpenAI prompt accordingly. Backfill old rows via a re-classification pass.
- `calculate-member-scores`: rename `issue_alignment_score` → `activity_diversity_score` (or drop from `overall_score` formula). Add a nullable `alignment_score` that is only populated once `compute-politician-positions` produces real data.
- Update `MethodologyPage` copy to match reality.

**1.5 Ship the lobbying UI**
- Add `MemberLobbyingCard` on `MemberPage` reading from `member_lobbying`, with cycle selector and "aggregate industry filings" clarification (until per-member attribution is possible).

**1.6 My Matches never-empty fix**
- On profile completion, trigger `compute-politician-positions` for the user's state members via edge function invoke.
- Distinguish `AlignmentWidget` empty states: "priorities not set" vs "questions not answered" vs "computing…".

### Phase 2 · Depth & UX (P1s)

**2.1 Governor detail parity**
- Add `AlignmentWidget`, party breakdown, term progress bar, and — if `governor_scores` table exists — a `ScoreRing`. Otherwise show explicit "limited scoring data" state.

**2.2 Alignment engine hardening**
- Batch `useStateAlignments` → single `.in("politician_id", ids)` query.
- Centralize score scale constant, validate at read/write, and document scale in Methodology.
- After state-bills/votes start syncing, extend `calculate-member-scores` to compute real state-legislator scores; drop the 50/50/50/50 lock.

**2.3 Live Data Sources page**
- Read from `data-status` edge fn: last-synced, record counts, health status per source. Add OpenStates + Senate LDA rows.

**2.4 Fix pipeline observability**
- `sync-orchestrator:217`: rewrite the "members without scores" query to fetch IDs first then filter, or use RPC.
- Wire `cleanup_old_rate_limits` / `cleanup_old_sync_operations` into `data-healing-agent`.

**2.5 Perf: unbounded `member_contributions` scan**
- Trace 61k-call query, add member_id filter or pagination.

### Phase 3 · Polish (P2s)

- State-legislator awareness in `MemberPage`: hide Congress-only sections when `level==='state'`, show provisional badge with tooltip.
- Add `/state-legislators` browse (or add a filter toggle to `MembersPage`).
- Legal pages: effective date, governing law, real contact address.
- Cron docs in `DEPLOYMENT_INSTRUCTIONS.md`.

## Technical details

- **DB migration** for A must handle NULL `user_id` in the partial unique index — Postgres treats NULLs as distinct, so either use `NULLS NOT DISTINCT` (PG15+) or a `COALESCE`-based expression index.
- **Deduplication** must run before the unique index is created; use `DELETE … USING (SELECT DISTINCT ON …)` keyed on newest `calculated_at`.
- **Re-classification** of `issue_signals` in 1.4 should be gated behind a manual admin trigger to control OpenAI credit spend.
- Compute-positions scheduling in B needs cursor-based batching (already partly built in Phase 1/2 P0 fixes) to avoid single-run timeouts.

## What I recommend doing first

**Ship Phase 1 in one pass.** Six of the seven P0s are small edits or migrations; the seventh (lobbying UI card) is ~1 new component. That single phase gets you: no more silent data bloat, all sync jobs actually running, neutrality restored in scoring, `My Matches` non-empty, and lobbying data visible.

Approve this plan and I'll implement Phase 1 end-to-end.
