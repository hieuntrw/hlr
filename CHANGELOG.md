# Changelog

All notable changes to this project are documented in this file.

## Unreleased — 2025-12-14

### Summary

- Audit and unify frontend authorization checks across pages and components.
- Tighten server-side typings and remove `any` from server API routes and services where possible.
- Stabilize React hook dependencies to address `react-hooks/exhaustive-deps` warnings.
- Replace many raw `<img>` usages with `next/image` where appropriate.
- Convert several anonymous default exports into named service exports.
- Fix a blocking parse error in `app/lib/auth/AuthContext.tsx` and related type/ordering issues.

### Primary changes (representative)

- `app/lib/auth/AuthContext.tsx`
  - Fix parse error and stabilize auth guard behavior.

- `app/app/profile/page.tsx`
  - Refactor: memoized fetch helpers (`useCallback`), reorder initialization effect so helpers are available in deps, remove duplicate function definitions.

- `lib/services/financeService.ts`, `lib/services/rewardService.ts`, `lib/services/stravaService.ts`
  - Replaced anonymous default exports with named `financeService` / `rewardService` / `stravaService` constants and exports; added safer runtime guards for Supabase calls.

- `lib/theme/ThemeContext.tsx`
  - Memoized loader functions with `useCallback`, removed accidental duplicate definitions introduced during refactor.

- `components/Header.tsx`, `components/AdminLayout.tsx`, multiple pages under `app/`:
  - Converted many `<img>` elements to `next/image` to satisfy Next.js lint rules and improve image performance.

### Motivation

- Reduce build-time blocking TypeScript/parse errors and improve runtime safety by tightening types and adding runtime narrowings.
- Make frontend authorization checks consistent and explicit to avoid subtle permission leaks or inconsistent redirects.
- Improve developer experience by addressing lint warnings and stabilizing hooks, reducing future regressions.

### Testing performed

- `npm run lint` — no ESLint warnings reported after changes.
- `npm run build` — successful production build; prerendered pages generated.
- Created workspace backup: `backups/backup-autofix_auth-unify-20251214001930-20251214120932.tar.gz`.

### Commit / Branch

- Branch: `autofix/auth-unify-20251214001930`
- Commit (tip): `22429f8eb48ddceb20a67c0a6a8037203ef63c8b`

### Migration & rollout notes

- No DB schema or migration changes introduced in this PR.
- Deploy as usual; verify the following on staging before production:
  1. Login and redirect flows on `profile`, `dashboard`, and `admin` pages.
 2. Strava connect and token refresh logic (server endpoints under `/api/strava/*`).
 3. Avatar and image rendering where `next/image` was applied.

### Rollback

- Rollback by reverting the branch or the specific commit via git if any regression appears.

### Follow-ups (recommended)

- Centralize and expose a `requireAuth` / `withAuth` helper to reduce per-page duplication.
- Add CI job to run `npm run build` and `npm run lint` on PRs.
- Automate Strava token refresh via a scheduled edge function or server cron.
- Add integration tests for auth flows and critical server endpoints.

---

This entry was generated as part of the `autofix/auth-unify-20251214001930` work to audit and unify frontend authorization checks.
