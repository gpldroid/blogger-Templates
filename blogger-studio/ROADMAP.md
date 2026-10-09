# Blogger Studio roadmap

## Phase 1 — UI and new schema
- [x] Responsive RTL dashboard skeleton
- [x] Demo create-post modal (client preview only)
- [x] Dark/light toggle
- [x] First-pass PostgreSQL schema + RLS policies
- [ ] Run SQL migration in dedicated Supabase project
- [ ] Review/test RLS for each role and storage bucket

## Phase 2 — Authentication and workspace
- [ ] Email sign-up/login/password reset
- [ ] Create blog workspace after signup
- [ ] Blog switching and member invitations
- [ ] Role-aware permissions (owner/admin/editor/author/moderator/viewer)

## Phase 3 — Content operations
- [ ] Rich text/block editor, autosave, preview
- [ ] Draft/review/scheduled/published/archived/trash lifecycle
- [ ] Categories, tags, pages, internal links
- [ ] Media uploads, alt text and safe content types
- [ ] Comments moderation and spam workflow

## Phase 4 — SEO and webmaster tools
- [ ] Slug/canonical/meta title/description/OG fields
- [ ] Schema validation and previews
- [ ] sitemap.xml and robots.txt generation strategy
- [ ] Redirect manager and broken-link scanner
- [ ] Search preview and article checklist
- [ ] Google Search Console integration only after OAuth setup

## Phase 5 — Blogger-compatible tools
- [ ] Import/export posts and pages (Blogger XML/JSON where feasible)
- [ ] Theme/template manager and safe preview
- [ ] Menus/widgets/sidebar blocks
- [ ] Privacy, cookie and site settings
- [ ] Backup/export and restore verification
- [ ] Analytics connector(s) with explicit user authorization

## Important architecture note
This is a dashboard for managing blogs, not a fully hosted public blogging engine yet. Public post delivery, custom domains, SSR/static generation, comments endpoint protections, scheduled job execution, and search-engine crawlable sitemap publishing need backend/deployment decisions beyond a static GitHub Pages frontend. Database RLS is the security boundary; UI-only visibility is never sufficient authorization.
