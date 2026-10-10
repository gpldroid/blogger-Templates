(() => {
'use strict';
const API_URL='https://zxlhwrmuebyfiksjrhrb.supabase.co';
const PUBLIC_KEY='sb_publishable_puKPQERSPv3lUowWlDio-Q_JVSZ9540';
const $=selector=>document.querySelector(selector);
const state=$('#publicState');
const article=$('#publicArticle');
$('#year').textContent=String(new Date().getFullYear());
const query=new URLSearchParams(window.location.search);
const blogId=query.get('blog')||'';
const kind=query.get('type')||'post';
const slug=(query.get('slug')||'').trim();
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function fail(message){
 document.body.classList.add('is-error');
 state.replaceChildren();
 const heading=document.createElement('strong');
 heading.textContent='تعذر عرض المحتوى';
 const detail=document.createElement('p');
 detail.textContent=message;
 state.append(heading,detail);
}
const allowedTags=new Set(['P','BR','STRONG','B','EM','I','U','H2','H3','H4','UL','OL','LI','A','IMG','BLOCKQUOTE','PRE','CODE','HR']);
function cleanHtml(value){
 const parsed=new DOMParser().parseFromString(String(value||''),'text/html');
 const walk=node=>[...node.childNodes].forEach(child=>{
  if(child.nodeType===Node.TEXT_NODE)return;
  if(child.nodeType!==Node.ELEMENT_NODE){child.remove();return}
  if(!allowedTags.has(child.tagName)){child.replaceWith(...child.childNodes);return}
  const tag=child.tagName,href=child.getAttribute('href')||'',src=child.getAttribute('src')||'',alt=child.getAttribute('alt')||'';
  [...child.attributes].forEach(attr=>child.removeAttribute(attr.name));
  if(tag==='A'){
   if(!href||!(/^(https?:|mailto:|tel:|#)/i.test(href)||href.startsWith('/'))){child.replaceWith(...child.childNodes);return}
   child.setAttribute('href',href);child.setAttribute('rel','noopener noreferrer');child.setAttribute('target','_blank');
  }
  if(tag==='IMG'){
   if(!/^https:\/\//i.test(src)){child.remove();return}
   child.setAttribute('src',src);child.setAttribute('alt',alt);child.setAttribute('loading','lazy');child.setAttribute('decoding','async');
  }
  walk(child);
 });
 walk(parsed.body);
 return parsed.body.innerHTML;
}
function setMeta(name,value,isProperty=false){
 if(!value)return;
 const selector=isProperty?'meta[property="'+name+'"]':'meta[name="'+name+'"]';
 let element=document.head.querySelector(selector);
 if(!element){element=document.createElement('meta');element.setAttribute(isProperty?'property':'name',name);document.head.append(element)}
 element.content=String(value);
}
async function loadContent(){
 if(!uuidPattern.test(blogId)||!slug||!['post','page'].includes(kind)){
  fail('الرابط غير مكتمل أو غير صالح. افتح الرابط العام من لوحة التحكم بعد نشر المحتوى.');return;
 }
 if(!window.supabase||!window.supabase.createClient){
  fail('تعذر تحميل خدمة عرض المحتوى. أعد تحميل الصفحة لاحقاً.');return;
 }
 const client=window.supabase.createClient(API_URL,PUBLIC_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const table=kind==='page'?'published_pages':'published_posts';
 const fields=kind==='page'
  ?'id,blog_id,title,slug,content_html,created_at,updated_at,seo_title,seo_description'
  :'id,blog_id,title,slug,excerpt,content_html,featured_image,published_at,created_at,seo_title,seo_description,canonical_url,robots_index,robots_follow,og_title,og_description,og_image,schema_type,reading_time_minutes';
 const {data,error}=await client.from(table).select(fields).eq('blog_id',blogId).eq('slug',slug).maybeSingle();
 if(error){console.error('Published content request failed',error);fail('تعذر جلب المحتوى المنشور. تحقق من إعدادات قاعدة البيانات ثم أعد المحاولة.');return}
 if(!data){fail('لم يتم العثور على محتوى منشور بهذا الرابط. ربما أُلغي النشر أو تغيّر الرابط.');return}
 $('#contentType').textContent=kind==='page'?'صفحة ثابتة':'مقال';
 $('#contentTitle').textContent=data.title||'محتوى بلا عنوان';
 const description=data.seo_description||data.excerpt||'';
 if(description){$('#contentDescription').textContent=description;$('#contentDescription').hidden=false}
 const publishedDate=data.published_at||data.created_at;
 if(publishedDate){$('#contentDate').dateTime=publishedDate;$('#contentDate').textContent=new Date(publishedDate).toLocaleDateString('ar',{year:'numeric',month:'long',day:'numeric'})}
 const featured=$('#featuredImage');
 if(kind==='post'&&data.featured_image&&/^https:\/\//i.test(data.featured_image)){featured.src=data.featured_image;featured.alt=data.title||'';featured.hidden=false}
 $('#contentBody').innerHTML=cleanHtml(data.content_html||'<p>لا يوجد محتوى نصي لهذه الصفحة.</p>');
 document.title=(data.seo_title||data.title||'محتوى منشور')+' | Blogger Studio';
 setMeta('description',description);
 setMeta('og:title',data.og_title||data.seo_title||data.title,true);
 setMeta('og:description',data.og_description||description,true);
 setMeta('og:type',kind==='post'?'article':'website',true);
 setMeta('og:image',data.og_image||data.featured_image,true);
 if(data.canonical_url){
  let canonical=document.querySelector('link[rel="canonical"]');
  if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.append(canonical)}
  canonical.href=data.canonical_url;
 }
 if(data.robots_index===false)setMeta('robots','noindex,nofollow');
 state.hidden=true;
 article.hidden=false;
}
void loadContent();
})();