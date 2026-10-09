# Blogger Studio roadmap

## Phase 1 — UI and new schema
- [x] Responsive RTL dashboard skeleton
- [x] Demo create-post modal (client preview only)
- [x] Dark/light toggle
- [x] First-pass PostgreSQL schema + RLS policies
- [x] Run initial SQL migrations in dedicated Supabase project
- [ ] Review/test RLS for each role and storage bucket

## Phase 2 — Authentication and workspace
- [x] Email sign-up/login
- [x] Password reset email request (redirect URL configuration required; password update screen remains to do)
- [x] Create blog workspace after signup
- [ ] Blog switching and member invitations
- [ ] Role-aware permissions (owner/admin/editor/author/moderator/viewer)

## Phase 3 — Content operations
- [x] Plain-text article create/edit with body and SEO metadata saving
- [x] Rich text editor for articles and pages: headings, emphasis, lists, links, quotes and HTTPS images (paste as plain text; sanitized HTML saved)\n- [ ] Autosave and preview
- [x] Basic article status controls: draft, review, published, archived, trash and restore\n- [ ] Scheduled publishing with a trusted server-side scheduler
- [x] Categories and tags: create and assign to articles\n- [x] Static pages: create/edit, SEO metadata, publish/draft/archive and restore to draft
- [ ] Internal links
- [x] Media library: image uploads, alt text, gallery, public URLs and safe content types
- [ ] Comments moderation and spam workflow

## Phase 4 — SEO and webmaster tools
- [x] Auto-generated slug and SEO title/description fields for new drafts
- [ ] Canonical/OG fields and public metadata rendering
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
