import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const api = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const site = "https://gpldroid.github.io/blogger-Templates";
const root = path.resolve("blogger-studio");
if (!api || !key) throw new Error("Missing Supabase public API configuration.");

const postFields = "id,blog_id,title,slug,excerpt,content_html,featured_image,published_at,created_at,updated_at,seo_title,seo_description,canonical_url,robots_index,robots_follow,og_title,og_description,og_image,schema_type,reading_time_minutes";
const pageFields = "id,blog_id,title,slug,content_html,created_at,updated_at,seo_title,seo_description";
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function slugOK(value) {
  return typeof value === "string" && value.length > 0 && value !== "." && value !== ".." && /^[\p{L}\p{N}\p{M}._~-]+$/u.test(value);
}
async function fetchRows(view, fields) {
  const url = new URL("/rest/v1/" + view, api);
  url.searchParams.set("select", fields);
  url.searchParams.set("limit", "1000");
  const response = await fetch(url, {headers:{apikey:key, Authorization:"Bearer " + key}});
  if (!response.ok) throw new Error("Supabase " + view + " failed (" + response.status + "): " + (await response.text()).slice(0,250));
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("Unexpected data for " + view);
  return rows;
}
function safeContent(html) {
  return String(html || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select|meta|base|link)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\/?(script|style|iframe|object|embed|form|input|button|textarea|select|meta|base|link)\b[^>]*\/?>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+style\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/\s+(href|src)\s*=\s*(["'])\s*(javascript:|data:text\/html)[\s\S]*?\2/gi, "")
    .replace(/\s+srcdoc\s*=\s*("[^"]*"|'[^']*')/gi, "");
}
function dateLabel(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "";
  return new Intl.DateTimeFormat("ar", {year:"numeric",month:"long",day:"numeric",timeZone:"UTC"}).format(new Date(value));
}
function render(item, kind) {
  const post = kind === "post";
  const title = item.seo_title || item.title || "";
  const description = item.seo_description || item.excerpt || item.title || "";
  const folder = (post ? "posts" : "pages") + "/" + encodeURIComponent(item.blog_id) + "/" + encodeURIComponent(item.slug) + "/";
  const url = site + "/" + folder;
  const canonical = (post && item.canonical_url) ? item.canonical_url : url;
  const image = post ? (item.og_image || item.featured_image || "") : "";
  const date = post ? (item.published_at || item.created_at) : (item.updated_at || item.created_at);
  const robots = post && item.robots_index === false ? "noindex,nofollow" : "index,follow";
  const schema = post ? {"@context":"https://schema.org","@type":item.schema_type || "Article","headline":item.title || "","description":description,"datePublished":item.published_at || item.created_at || undefined,"dateModified":item.updated_at || item.published_at || item.created_at || undefined,"mainEntityOfPage":canonical,...(image ? {image:image} : {})} : {"@context":"https://schema.org","@type":"WebPage","name":item.title || "","description":description,"url":canonical};
  const jsonld = JSON.stringify(schema).replace(/</g, "\\u003c");
  const css = "body{margin:0;background:#f4f7f4;color:#202820;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.9}.shell{max-width:900px;margin:30px auto;padding:clamp(16px,4vw,36px);background:#fff;border-radius:18px;box-shadow:0 8px 32px #1231}.brand{display:inline-block;color:#176b3a;text-decoration:none;font-weight:700;margin-bottom:18px}.title{font-size:clamp(1.8rem,5vw,2.8rem);line-height:1.4;margin:.3em 0}.desc{color:#5d6b60;font-size:1.05rem}.date{color:#6b7280;font-size:.9rem}.featured{display:block;max-width:100%;height:auto;border-radius:14px;margin:22px auto}.content{overflow-wrap:anywhere}.content img{max-width:100%;height:auto;border-radius:10px}.content pre{overflow:auto;padding:14px;background:#f1f5f2;border-radius:10px}.content blockquote{border-right:4px solid #26834a;margin:18px 0;padding:8px 16px;background:#f5faf6}.foot{border-top:1px solid #e5e7eb;margin-top:32px;padding-top:16px;color:#6b7280;font-size:.9rem}@media(max-width:600px){.shell{margin:0;border-radius:0;min-height:100vh}.title{font-size:1.7rem}}";
  return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc(title) + '</title><meta name="description" content="' + esc(description) + '"><meta name="robots" content="' + robots + '">' +
    '<link rel="canonical" href="' + esc(canonical) + '"><meta property="og:type" content="' + (post ? "article" : "website") + '">' +
    '<meta property="og:title" content="' + esc(item.og_title || title) + '"><meta property="og:description" content="' + esc(item.og_description || description) + '">' +
    '<meta property="og:url" content="' + esc(canonical) + '">' + (image ? '<meta property="og:image" content="' + esc(image) + '">' : '') +
    '<meta name="twitter:card" content="' + (image ? "summary_large_image" : "summary") + '"><script type="application/ld+json">' + jsonld + '</script><style>' + css + '</style></head><body>' +
    '<main class="shell"><a class="brand" href="/blogger-Templates/">استوديو بلوجر</a><article><header><h1 class="title">' + esc(item.title || "") + '</h1>' +
    (description ? '<p class="desc">' + esc(description) + '</p>' : '') +
    (date ? '<time class="date" datetime="' + esc(date) + '">' + esc(dateLabel(date)) + '</time>' : '') +
    '</header>' + (image ? '<img class="featured" src="' + esc(image) + '" alt="' + esc(item.title || "") + '" loading="eager">' : '') +
    '<div class="content">' + safeContent(item.content_html) + '</div></article><footer class="foot">© ' + new Date().getFullYear() + ' استوديو بلوجر</footer></main></body></html>';
}
async function save(item, kind) {
  if (!slugOK(item.slug) || !item.blog_id) { console.warn("Skipping invalid " + kind + " slug/blog_id"); return null; }
  const folder = (kind === "post" ? "posts" : "pages") + "/" + String(item.blog_id) + "/" + item.slug;
  const out = path.join(root, folder);
  await mkdir(out, {recursive:true});
  await writeFile(path.join(out, "index.html"), render(item, kind), "utf8");
  return {url:site + "/" + folder + "/", lastmod:item.updated_at || item.published_at || item.created_at};
}
const [posts,pages] = await Promise.all([fetchRows("published_posts",postFields),fetchRows("published_pages",pageFields)]);
const urls = [];
for (const p of posts) { const u = await save(p,"post"); if (u) urls.push(u); }
for (const p of pages) { const u = await save(p,"page"); if (u) urls.push(u); }
const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(u => '<url><loc>' + esc(u.url) + '</loc>' + (u.lastmod && !Number.isNaN(new Date(u.lastmod).getTime()) ? '<lastmod>' + new Date(u.lastmod).toISOString().slice(0,10) + '</lastmod>' : '') + '</url>').join("\n") +
  '\n</urlset>\n';
await writeFile(path.join(root,"sitemap.xml"),xml,"utf8");
console.log("Generated " + posts.length + " public post(s), " + pages.length + " public page(s), and sitemap.xml.");
