(() => {
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const toast=$('#toast'),sidebar=$('#sidebar'),modal=$('#postModal'),authModal=$('#authModal'),form=$('#postForm');
let timer,db=null,user=null,blog=null,editingPostId=null,categories=[],tags=[];
const URL='https://zxlhwrmuebyfiksjrhrb.supabase.co';
const KEY='sb_publishable_puKPQERSPv3lUowWlDio-Q_JVSZ9540';
const statusNames={draft:'مسودة',review:'قيد المراجعة',scheduled:'مجدول',published:'منشور',archived:'مؤرشف',trash:'سلة المحذوفات'};
function note(s){toast.textContent=s;toast.classList.add('visible');clearTimeout(timer);timer=setTimeout(()=>toast.classList.remove('visible'),3500)}
function authUI(){$('#authButton').textContent=user?'تسجيل الخروج':'تسجيل الدخول';$('.user-row b').textContent=user?.email||'حساب المدون';$('.user-row small').textContent=user?'متصل بقاعدة البيانات':'سجّل الدخول للبدء'}
function slugify(value){return value.normalize('NFKC').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-+|-+$/g,'').slice(0,75)||'article'}
function safeHtml(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;').replace(/\n/g,'<br>')}
const RICH_TAGS=new Set(['P','BR','STRONG','B','EM','I','U','H2','H3','H4','UL','OL','LI','A','IMG','BLOCKQUOTE','PRE','CODE','HR']);
function sanitizeRichHtml(value){
 const parsed=new DOMParser().parseFromString(String(value||''),'text/html');
 const cleanNode=node=>{
  [...node.childNodes].forEach(child=>{
   if(child.nodeType===Node.TEXT_NODE)return;
   if(child.nodeType!==Node.ELEMENT_NODE){child.remove();return}
   if(!RICH_TAGS.has(child.tagName)){child.replaceWith(...child.childNodes);return}
   const href=child.getAttribute('href')||'',src=child.getAttribute('src')||'',alt=child.getAttribute('alt')||'';
   [...child.attributes].forEach(attr=>child.removeAttribute(attr.name));
   if(child.tagName==='A'){
    if(!href||!(href.startsWith('/')||/^(https?:|mailto:|tel:|#)/i.test(href))){child.replaceWith(...child.childNodes);return}
    child.setAttribute('href',href);child.setAttribute('rel','noopener noreferrer');child.setAttribute('target','_blank')
   }
   if(child.tagName==='IMG'){
    if(!src.toLowerCase().startsWith('https://')){child.remove();return}
    child.setAttribute('src',src);child.setAttribute('alt',alt);child.setAttribute('loading','lazy')
   }
   cleanNode(child)
  })
 };
 cleanNode(parsed.body);return parsed.body.innerHTML
}
function richText(html){const doc=new DOMParser().parseFromString(html||'','text/html');return (doc.body.innerText||doc.body.textContent||'').trim()}
function editorFor(fieldId){return fieldId==='postContent'?$('#postContentEditor'):$('#pageContentEditor')}
function syncRichField(fieldId){const field=$('#'+fieldId),editor=editorFor(fieldId);if(field&&editor)field.value=sanitizeRichHtml(editor.innerHTML)}
function setRichEditor(fieldId,html,textFallback=''){
 const editor=editorFor(fieldId);if(!editor)return;
 editor.innerHTML=html?sanitizeRichHtml(html):safeHtml(textFallback).replace(/\n/g,'<br>');
 syncRichField(fieldId)
}
function insertAtEditor(editor,html){editor.focus();document.execCommand('insertHTML',false,html);syncRichField(editor.id==='postContentEditor'?'postContent':'pageContent')}
document.querySelectorAll('.rich-edit-area').forEach(editor=>{
 const fieldId=editor.id==='postContentEditor'?'postContent':'pageContent';
 editor.addEventListener('input',()=>syncRichField(fieldId));
 editor.addEventListener('paste',e=>{e.preventDefault();const text=(e.clipboardData||window.clipboardData).getData('text/plain');document.execCommand('insertText',false,text);syncRichField(fieldId)});
 editor.closest('.rich-editor')?.querySelectorAll('[data-command]').forEach(button=>button.addEventListener('click',()=>{
  editor.focus();const command=button.dataset.command,value=button.dataset.value;
  if(command==='createLink'){const url=prompt('أدخل رابطاً يبدأ بـ https:// أو http://');if(url&&/^https?:\/\//i.test(url.trim()))document.execCommand('createLink',false,url.trim());else if(url)note('الرابط غير صالح؛ استخدم http أو https.')}
  else if(command==='insertImage'){const url=prompt('أدخل رابط صورة مباشر يبدأ بـ https://');const alt=prompt('اكتب وصفاً بديلاً للصورة (alt):')||'';if(url&&/^https:\/\//i.test(url.trim()))insertAtEditor(editor,'<img src="'+safeHtml(url.trim())+'" alt="'+safeHtml(alt)+'">');else if(url)note('يجب أن يبدأ رابط الصورة بـ https://')}
  else if(command==='blockquote')document.execCommand('formatBlock',false,'blockquote');
  else document.execCommand(command,false,value||null);
  syncRichField(fieldId)
 }))
});
function publicContentHref(kind,slug){
 if(!blog||!slug)return '';
 const safeSlug=String(slug).split('/').map(encodeURIComponent).join('/');
 const url=new URL('./'+(kind==='post'?'posts':'pages')+'/'+encodeURIComponent(blog.id)+'/'+safeSlug+'/',document.baseURI);
 url.hash='';
 return url.href;
}
async function posts(){
 if(!user||!blog)return;
 const {data,error}=await db.from('posts').select('id,title,slug,status,visibility,updated_at,view_count,excerpt,content,content_html,seo_title,seo_description,published_at,category_id').eq('blog_id',blog.id).order('updated_at',{ascending:false}).limit(100);
 if(error){note('تعذر تحميل المقالات: '+error.message);return}
 const rows=$('#postRows');rows.replaceChildren();
 if(!data?.length){rows.innerHTML='<tr><td colspan="5" style="padding:22px">لا توجد مقالات بعد. أنشئ مسودتك الأولى.</td></tr>';return}
 data.forEach(p=>{
  const tr=document.createElement('tr'),td=document.createElement('td'),wrap=document.createElement('div'),thumb=document.createElement('span'),txt=document.createElement('span'),title=document.createElement('b'),slug=document.createElement('small');
  wrap.className='post-title-cell';thumb.className='post-thumb thumb-three';thumb.textContent='✳';title.textContent=p.title||'(بلا عنوان)';slug.textContent='/'+p.slug;txt.append(title,slug);wrap.append(thumb,txt);td.append(wrap);
  const st=document.createElement('td'),badge=document.createElement('span');badge.className='status '+p.status;badge.textContent=statusNames[p.status]||p.status;st.append(badge);
  const date=document.createElement('td');date.textContent=p.updated_at?new Date(p.updated_at).toLocaleString('ar'):'—';
  const views=document.createElement('td');views.className='number-cell';views.textContent=p.view_count||'—';
  const actions=document.createElement('td'),edit=document.createElement('button');edit.type='button';edit.className='row-action';edit.textContent=p.status==='trash'?'استعادة':'تحرير';edit.addEventListener('click',()=>p.status==='trash'?changeStatus(p,'draft'):openEdit(p));actions.append(edit);
  if(p.status==='published'&&p.visibility==='public'){const publicLink=document.createElement('a');publicLink.className='row-action';publicLink.textContent='فتح عام';publicLink.href=publicContentHref('post',p.slug);publicLink.target='_blank';publicLink.rel='noopener noreferrer';actions.append(publicLink)}
  if(p.status!=='trash'){const trash=document.createElement('button');trash.type='button';trash.className='row-action danger-action';trash.textContent='حذف';trash.addEventListener('click',()=>moveToTrash(p));actions.append(trash)}
  tr.append(td,st,date,views,actions);rows.append(tr)
 })
}
async function loadTaxonomy(){
 if(!user||!blog)return;
 const [catRes,tagRes]=await Promise.all([
  db.from('categories').select('id,name,slug,description').eq('blog_id',blog.id).order('name'),
  db.from('tags').select('id,name,slug').eq('blog_id',blog.id).order('name')
 ]);
 if(catRes.error||tagRes.error){note('تعذر تحميل التصنيفات والوسوم: '+(catRes.error||tagRes.error).message);return}
 categories=catRes.data||[];tags=tagRes.data||[];
 const select=$('#postCategory');select.replaceChildren(new Option('بلا تصنيف',''));
 categories.forEach(c=>select.add(new Option(c.name,c.id)));
 const choices=$('#postTagChoices');choices.replaceChildren();
 if(!tags.length){const empty=document.createElement('span');empty.className='muted';empty.textContent='لا توجد وسوم بعد.';choices.append(empty)}
 tags.forEach(t=>{const label=document.createElement('label'),input=document.createElement('input'),span=document.createElement('span');input.type='checkbox';input.name='postTags';input.value=t.id;span.textContent=t.name;label.append(input,span);choices.append(label)});
 renderTaxonomyList('#categoryList',categories,'category');renderTaxonomyList('#tagList',tags,'tag');
}
function renderTaxonomyList(selector,items,type){
 const list=$(selector);list.replaceChildren();
 if(!items.length){const li=document.createElement('li');li.className='muted';li.textContent=type==='category'?'لا توجد تصنيفات بعد.':'لا توجد وسوم بعد.';list.append(li);return}
 items.forEach(item=>{const li=document.createElement('li'),text=document.createElement('span'),name=document.createElement('b'),slug=document.createElement('small');name.textContent=item.name;slug.textContent='/'+item.slug;text.append(name,slug);li.append(text);if(type==='category'&&item.description){const desc=document.createElement('p');desc.textContent=item.description;li.append(desc)}list.append(li)})
}
async function addTaxonomy(type){
 if(!user||!blog){authModal.showModal();note('سجّل الدخول أولاً.');return}
 const category=type==='category',name=$(category?'#categoryName':'#tagName').value.trim(),description=category?$('#categoryDescription').value.trim():'';
 if(!name)return;
 const slug=slugify(name);
 const table=category?'categories':'tags';
 const payload=category?{blog_id:blog.id,name,slug,description}:{blog_id:blog.id,name,slug};
 const {error}=await db.from(table).insert(payload);
 if(error){note(error.code==='23505'?'هذا الاسم موجود بالفعل.':'تعذر إضافة '+(category?'التصنيف':'الوسم')+': '+error.message);return}
 $(category?'#categoryForm':'#tagForm').reset();await loadTaxonomy();note('تمت إضافة '+(category?'التصنيف':'الوسم')+' بنجاح.')
}
$('#categoryForm')?.addEventListener('submit',e=>{e.preventDefault();void addTaxonomy('category')});
$('#tagForm')?.addEventListener('submit',e=>{e.preventDefault();void addTaxonomy('tag')});

const MEDIA_BUCKET='blogger-media';
function mediaUrl(path){return db.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl}
async function loadMedia(){
 const gallery=$('#mediaGallery');if(!gallery)return;
 if(!user||!blog){gallery.replaceChildren();const p=document.createElement('p');p.className='muted';p.textContent='سجّل الدخول لعرض مكتبة الوسائط.';gallery.append(p);return}
 gallery.replaceChildren();const loading=document.createElement('p');loading.className='muted';loading.textContent='جارٍ تحميل الصور…';gallery.append(loading);
 const {data,error}=await db.from('media_assets').select('id,storage_path,original_name,mime_type,size_bytes,alt_text,width,height,created_at').eq('blog_id',blog.id).order('created_at',{ascending:false}).limit(100);
 gallery.replaceChildren();if(error){const p=document.createElement('p');p.className='muted';p.textContent='تعذر تحميل الوسائط: '+error.message;gallery.append(p);return}
 if(!data?.length){const p=document.createElement('p');p.className='muted';p.textContent='لا توجد صور بعد. ارفع أول صورة لاستخدامها في مقالاتك.';gallery.append(p);return}
 data.forEach(asset=>{
  const card=document.createElement('article');card.className='media-card';
  const img=document.createElement('img');img.src=mediaUrl(asset.storage_path);img.alt=asset.alt_text;img.loading='lazy';img.decoding='async';
  const info=document.createElement('div');info.className='media-card-info';
  const name=document.createElement('b');name.textContent=asset.original_name;
  const alt=document.createElement('p');alt.textContent=asset.alt_text;
  const size=document.createElement('small');size.textContent=(asset.size_bytes/1024).toFixed(1)+' KB'+(asset.width&&asset.height?' · '+asset.width+'×'+asset.height:'');
  const actions=document.createElement('div');actions.className='media-card-actions';
  const insert=document.createElement('button');insert.type='button';insert.className='row-action';insert.textContent='إدراج في المقال';insert.addEventListener('click',()=>insertMediaInPost(asset));
  const copy=document.createElement('button');copy.type='button';copy.className='row-action';copy.textContent='نسخ الرابط';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(mediaUrl(asset.storage_path));note('تم نسخ رابط الصورة.')}catch(e){note('تعذر النسخ تلقائياً؛ افتح الصورة لنسخ الرابط يدوياً.');window.open(mediaUrl(asset.storage_path),'_blank','noopener')}});
  const remove=document.createElement('button');remove.type='button';remove.className='row-action danger-action';remove.textContent='حذف';remove.addEventListener('click',()=>void deleteMedia(asset));
  actions.append(insert,copy,remove);info.append(name,alt,size,actions);card.append(img,info);gallery.append(card)
 })
}
function insertMediaInPost(asset){
 if(!user){authModal.showModal();return}
 resetEditor();modal.showModal();const editor=$('#postContentEditor'),url=mediaUrl(asset.storage_path);
 insertAtEditor(editor,'<img src="'+safeHtml(url)+'" alt="'+safeHtml(asset.alt_text)+'">');
 $('#postModalTitle').textContent='مقال جديد — صورة من مكتبة الوسائط';editor.focus();note('أُدرجت الصورة في محرر المقال. أضف النص ثم احفظ المقال.')
}
async function deleteMedia(asset){
 if(!confirm('حذف هذه الصورة نهائياً من مكتبة الوسائط؟'))return;
 const {error:storageError}=await db.storage.from(MEDIA_BUCKET).remove([asset.storage_path]);
 if(storageError){note('تعذر حذف ملف الصورة: '+storageError.message);return}
 const {error}=await db.from('media_assets').delete().eq('id',asset.id).eq('blog_id',blog.id);
 if(error){note('حُذف الملف لكن تعذر حذف سجل الوسائط: '+error.message);return}
 await loadMedia();note('تم حذف الصورة.')
}
$('#mediaUploadForm')?.addEventListener('submit',async e=>{
 e.preventDefault();if(!user||!blog){authModal.showModal();note('سجّل الدخول أولاً.');return}
 const file=$('#mediaFile').files?.[0],alt=$('#mediaAlt').value.trim(),button=$('#mediaUploadButton');
 if(!file||!alt){note('اختر صورة واكتب النص البديل.');return}
 const allowed=['image/jpeg','image/png','image/webp','image/gif','image/avif'];
 if(!allowed.includes(file.type)){note('نوع الصورة غير مدعوم.');return}
 if(file.size>5*1024*1024){note('حجم الصورة يتجاوز 5 ميغابايت.');return}
 button.disabled=true;button.textContent='جارٍ الرفع…';
 try{
  const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'}[file.type];
  const path=blog.id+'/'+user.id+'/'+crypto.randomUUID()+'.'+ext;
  const {error:uploadError}=await db.storage.from(MEDIA_BUCKET).upload(path,file,{contentType:file.type,cacheControl:'3600',upsert:false});
  if(uploadError)throw uploadError;
  let width=null,height=null;
  try{const dims=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve({width:image.naturalWidth,height:image.naturalHeight});image.onerror=reject;const objectUrl=window.URL.createObjectURL(file);image.onload=()=>{const result={width:image.naturalWidth,height:image.naturalHeight};window.URL.revokeObjectURL(objectUrl);resolve(result)};image.onerror=()=>{window.URL.revokeObjectURL(objectUrl);reject(new Error('تعذر قراءة أبعاد الصورة'))};image.src=objectUrl});width=dims.width;height=dims.height}catch(e){}
  const {error:rowError}=await db.from('media_assets').insert({blog_id:blog.id,uploaded_by:user.id,storage_path:path,original_name:file.name,mime_type:file.type,size_bytes:file.size,alt_text:alt,width,height});
  if(rowError){await db.storage.from(MEDIA_BUCKET).remove([path]);throw rowError}
  $('#mediaUploadForm').reset();await loadMedia();note('تم رفع الصورة وإضافتها إلى المكتبة.')
 }catch(error){note('فشل رفع الصورة: '+(error?.message||'خطأ غير معروف'))}
 finally{button.disabled=false;button.textContent='↑ رفع الصورة'}
});
$('#refreshMediaButton')?.addEventListener('click',()=>void loadMedia());


const pageModal=$('#pageModal'),pageForm=$('#pageForm');let editingPageId=null;
async function loadPages(){
 const rows=$('#pageRows');if(!rows)return;
 if(!user||!blog){rows.replaceChildren();const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=5;td.textContent='سجّل الدخول لإدارة الصفحات.';tr.append(td);rows.append(tr);return}
 const {data,error}=await db.from('pages').select('id,title,slug,status,updated_at,content,content_html,seo_title,seo_description').eq('blog_id',blog.id).order('updated_at',{ascending:false}).limit(100);
 rows.replaceChildren();if(error){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=5;td.textContent='تعذر تحميل الصفحات: '+error.message;tr.append(td);rows.append(tr);return}
 if(!data?.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=5;td.textContent='لا توجد صفحات بعد. أنشئ صفحتك الأولى.';tr.append(td);rows.append(tr);return}
 data.forEach(p=>{const tr=document.createElement('tr'),titleCell=document.createElement('td'),title=document.createElement('b'),slugCell=document.createElement('td'),statusCell=document.createElement('td'),status=document.createElement('span'),date=document.createElement('td'),actions=document.createElement('td'),edit=document.createElement('button');title.textContent=p.title;titleCell.append(title);if(p.status==='published'){const publicSlug=document.createElement('a');publicSlug.href=publicContentHref('page',p.slug);publicSlug.target='_blank';publicSlug.rel='noopener noreferrer';publicSlug.className='text-link';publicSlug.textContent='/'+p.slug;slugCell.append(publicSlug)}else slugCell.textContent='/'+p.slug;status.className='status '+p.status;status.textContent=({draft:'مسودة',published:'منشورة',archived:'مؤرشفة'})[p.status]||p.status;statusCell.append(status);date.textContent=p.updated_at?new Date(p.updated_at).toLocaleString('ar'):'—';edit.type='button';edit.className='row-action';edit.textContent='تحرير';edit.addEventListener('click',()=>openPageEdit(p));actions.append(edit);if(p.status==='published'){const publicLink=document.createElement('a');publicLink.className='row-action';publicLink.textContent='فتح عام';publicLink.href=publicContentHref('page',p.slug);publicLink.target='_blank';publicLink.rel='noopener noreferrer';actions.append(publicLink)}if(p.status!=='archived'){const archive=document.createElement('button');archive.type='button';archive.className='row-action danger-action';archive.textContent='أرشفة';archive.addEventListener('click',()=>void archivePage(p));actions.append(archive)}else{const restore=document.createElement('button');restore.type='button';restore.className='row-action';restore.textContent='إعادة كمسودة';restore.addEventListener('click',()=>void setPageStatus(p,'draft'));actions.append(restore)}tr.append(titleCell,slugCell,statusCell,date,actions);rows.append(tr)})
}
function openNewPage(){if(!user||!blog){authModal.showModal();note('سجّل الدخول أولاً.');return}editingPageId=null;pageForm.reset();setRichEditor('pageContent','');$('#pageId').value='';$('#pageModalTitle').textContent='إنشاء صفحة';$('#savePageButton').textContent='حفظ الصفحة';$('#pageStatus').value='draft';pageModal.showModal();restoreLocalDraft('page')}
function openPageEdit(p){editingPageId=p.id;pageForm.reset();$('#pageId').value=p.id;$('#pageTitle').value=p.title||'';$('#pageSlug').value=p.slug||'';setRichEditor('pageContent',p.content_html||'',p.content?.text||'');$('#pageSeoTitle').value=p.seo_title||'';$('#pageSeoDescription').value=p.seo_description||'';$('#pageStatus').value=p.status||'draft';$('#pageModalTitle').textContent='تحرير الصفحة';$('#savePageButton').textContent='حفظ التعديلات';pageModal.showModal();restoreLocalDraft('page')}
async function setPageStatus(p,status){const {error}=await db.from('pages').update({status,updated_at:new Date().toISOString()}).eq('id',p.id).eq('blog_id',blog.id);if(error){note('تعذر تحديث الصفحة: '+error.message);return}await loadPages();note('تم تحديث حالة الصفحة.')}
async function archivePage(p){if(!confirm('أرشفة هذه الصفحة؟ ستبقى محفوظة ويمكن إعادتها كمسودة.'))return;await setPageStatus(p,'archived')}
$('#newPageButton')?.addEventListener('click',openNewPage);
pageForm?.addEventListener('submit',async e=>{
 if(e.submitter?.value==='cancel')return;e.preventDefault();
 if(!user||!blog){note('سجّل الدخول أولاً.');return}
 syncRichField('pageContent');const title=$('#pageTitle').value.trim(),bodyHtml=$('#pageContent').value.trim(),body=richText(bodyHtml),slug=slugify($('#pageSlug').value.trim()||title),status=$('#pageStatus').value;
 if(!title||!body){note('أدخل عنوان الصفحة ومحتواها.');return}
 const payload={title,slug,content:{type:'plain_text',text:body},content_html:bodyHtml,seo_title:$('#pageSeoTitle').value.trim()||title,seo_description:$('#pageSeoDescription').value.trim(),status,updated_at:new Date().toISOString()};
 let error;
 if(editingPageId){({error}=await db.from('pages').update(payload).eq('id',editingPageId).eq('blog_id',blog.id))}
 else{Object.assign(payload,{blog_id:blog.id,author_id:user.id});({error}=await db.from('pages').insert(payload))}
 if(error){note('تعذر حفظ الصفحة: '+(error.code==='23505'?'الرابط المختصر مستخدم بالفعل.':error.message));return}
 clearTimeout(autosaveTimers.page);clearLocalDraft('page');pageModal.close();await loadPages();note(editingPageId?'تم تحديث الصفحة.':'تم إنشاء الصفحة وحفظها.')
});

async function sync(){
 if(!db)return;
 const {data:{session}}=await db.auth.getSession();user=session?.user||null;blog=null;authUI();
 if(!user){$('#postRows').innerHTML='<tr><td colspan="5" style="padding:22px">سجّل الدخول لعرض مقالاتك.</td></tr>';await Promise.all([loadMedia(),loadPages()]);return}
 const {data:blogs,error}=await db.from('blogs').select('id,name,slug').eq('owner_id',user.id).order('created_at').limit(1);
 if(error){note('خطأ تحميل المدونات: '+error.message);return}
 if(blogs.length)blog=blogs[0];else{const result=await db.from('blogs').insert({owner_id:user.id,name:'مدونتي الجديدة',slug:'blog-'+user.id.slice(0,8),language:'ar',timezone:'Africa/Casablanca'}).select('id,name,slug').single();if(result.error){note('تعذر إنشاء المدونة: '+result.error.message);return}blog=result.data}
 $('.workspace b').textContent=blog.name;await Promise.all([posts(),loadTaxonomy(),loadMedia(),loadPages()])
}
function resetEditor(){editingPostId=null;form.reset();setRichEditor('postContent','');$('#postModalTitle').textContent='إنشاء مقال جديد';$('#saveDraft').textContent='حفظ كمسودة';$('#postStatus').value='draft'}
function openPost(){if(!user){authModal.showModal();note('سجّل الدخول لحفظ المقال.');return}resetEditor();modal.showModal();restoreLocalDraft('post');setTimeout(()=>$('#postTitle').focus(),30)}
async function openEdit(p){if(!user||!blog)return;resetEditor();editingPostId=p.id;$('#postModalTitle').textContent='تحرير المقال';$('#saveDraft').textContent='حفظ التعديلات';$('#postTitle').value=p.title||'';$('#postExcerpt').value=p.excerpt||'';setRichEditor('postContent',p.content_html||'',p.content?.text||'');$('#seoTitle').value=p.seo_title||'';$('#seoDescription').value=p.seo_description||'';$('#postStatus').value=['draft','review','published','archived'].includes(p.status)?p.status:'draft';$('#postCategory').value=p.category_id||'';const {data:links,error}=await db.from('post_tags').select('tag_id').eq('post_id',p.id);if(error){note('تعذر تحميل وسوم المقال: '+error.message);return}const selected=new Set((links||[]).map(x=>x.tag_id));document.querySelectorAll('input[name="postTags"]').forEach(input=>input.checked=selected.has(input.value));modal.showModal();restoreLocalDraft('post');setTimeout(()=>$('#postTitle').focus(),30)}
async function changeStatus(p,status){if(!user||!blog)return;const patch={status,updated_at:new Date().toISOString()};if(status==='published'&&!p.published_at)patch.published_at=new Date().toISOString();const {error}=await db.from('posts').update(patch).eq('id',p.id).eq('blog_id',blog.id);if(error){note('تعذر تغيير حالة المقال: '+error.message);return}await posts();note('تم تحديث حالة المقال إلى: '+(statusNames[status]||status))}
async function moveToTrash(p){if(!confirm('نقل هذا المقال إلى سلة المحذوفات؟ يمكنك استعادته لاحقاً.'))return;await changeStatus(p,'trash')}
$('#menuToggle')?.addEventListener('click',()=>sidebar.classList.toggle('open'));
document.addEventListener('click',e=>{if(innerWidth<=900&&sidebar.classList.contains('open')&&!sidebar.contains(e.target)&&!e.target.closest('#menuToggle'))sidebar.classList.remove('open')});
$('#themeToggle')?.addEventListener('click',()=>{const dark=document.body.classList.toggle('dark');$('#themeToggle').setAttribute('aria-label',dark?'تفعيل المظهر الفاتح':'تفعيل المظهر الداكن');try{localStorage.setItem('blogger-studio-theme',dark?'dark':'light')}catch(e){}});
try{if(localStorage.getItem('blogger-studio-theme')==='dark')document.body.classList.add('dark')}catch(e){}
$('#newPost')?.addEventListener('click',openPost);$('#heroNewPost')?.addEventListener('click',openPost);
$('#authButton')?.addEventListener('click',async()=>{if(!db){note('تعذر تحميل Supabase JS.');return}if(user){const {error}=await db.auth.signOut();if(error)note(error.message);else{await sync();note('تم تسجيل الخروج')}}else authModal.showModal()});
$('#signInButton')?.addEventListener('click',async()=>{const email=$('#authEmail').value.trim(),password=$('#authPassword').value;const {error}=await db.auth.signInWithPassword({email,password});if(error){note('تعذر تسجيل الدخول: '+error.message);return}authModal.close();await sync()});
$('#resetPasswordButton')?.addEventListener('click',async()=>{const email=$('#authEmail').value.trim();if(!email){note('أدخل بريدك الإلكتروني أولاً.');$('#authEmail').focus();return}const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.href.split('#')[0]});if(error){note('تعذر إرسال رابط الاستعادة: '+error.message);return}note('إذا كان البريد مسجلاً، فسيصلك رابط استعادة كلمة المرور.')});
$('#signUpButton')?.addEventListener('click',async()=>{const email=$('#authEmail').value.trim(),password=$('#authPassword').value;if(password.length<8){note('كلمة المرور يجب ألا تقل عن 8 أحرف.');return}const {data,error}=await db.auth.signUp({email,password});if(error){note('تعذر إنشاء الحساب: '+error.message);return}if(!data.session)note('تحقق من بريدك الإلكتروني ثم سجّل الدخول.');else{authModal.close();await sync()}});
form?.addEventListener('submit',async e=>{
 e.preventDefault();if(!user||!blog){note('سجّل الدخول أولاً.');return}
 syncRichField('postContent');const title=$('#postTitle').value.trim(),excerpt=$('#postExcerpt').value.trim(),bodyHtml=$('#postContent').value.trim(),body=richText(bodyHtml),seoTitle=$('#seoTitle').value.trim(),seoDescription=$('#seoDescription').value.trim(),status=$('#postStatus').value,categoryId=$('#postCategory').value||null,selectedTagIds=[...document.querySelectorAll('input[name="postTags"]:checked')].map(input=>input.value);
 if(!title){$('#postTitle').focus();return}if(!body){note('أضف محتوى المقال قبل الحفظ.');$('#postContent').focus();return}
 const wasEditing=Boolean(editingPostId),payload={title,excerpt,category_id:categoryId,content:{type:'plain_text',text:body},content_html:bodyHtml,seo_title:seoTitle||title,seo_description:seoDescription||excerpt,status,updated_at:new Date().toISOString()};
 if(status==='published')payload.published_at=new Date().toISOString();
 let postId=editingPostId;
 if(editingPostId){const {error}=await db.from('posts').update(payload).eq('id',editingPostId).eq('blog_id',blog.id);if(error){note('لم تُحفظ التعديلات: '+error.message);return}}
 else{const slug=slugify(title)+'-'+Math.random().toString(36).slice(2,6);Object.assign(payload,{blog_id:blog.id,author_id:user.id,slug});const {data,error}=await db.from('posts').insert(payload).select('id').single();if(error){note('لم تحفظ المقالة: '+error.message);return}postId=data.id}
 const {error:clearError}=await db.from('post_tags').delete().eq('post_id',postId);
 if(clearError){note('تم حفظ المقال لكن تعذر تحديث وسومه: '+clearError.message);return}
 if(selectedTagIds.length){const {error:tagError}=await db.from('post_tags').insert(selectedTagIds.map(tag_id=>({post_id:postId,tag_id})));if(tagError){note('تم حفظ المقال لكن تعذر ربط الوسوم: '+tagError.message);return}}
 clearTimeout(autosaveTimers.post);clearLocalDraft('post');modal.close();resetEditor();await posts();note(wasEditing?'تم حفظ التعديلات.':'تم حفظ المقال بنجاح.')
});

const autosaveTimers={post:null,page:null};
function localDraftKey(kind){
 if(!user||!blog)return null;
 const id=kind==='post'?(editingPostId||'new'):(editingPageId||'new');
 return 'blogger-studio:draft:v1:'+user.id+':'+blog.id+':'+kind+':'+id;
}
function draftStatus(kind,message){
 const el=$('#'+(kind==='post'?'postAutosaveStatus':'pageAutosaveStatus'));
 if(el)el.textContent=message;
}
function readLocalDraft(kind){
 const key=localDraftKey(kind);if(!key)return null;
 try{const raw=localStorage.getItem(key);return raw?{key,data:JSON.parse(raw)}:null}catch(e){return null}
}
function collectDraft(kind){
 const page=kind==='page';
 syncRichField(page?'pageContent':'postContent');
 const value=(id)=>$('#'+id)?.value??'';
 const data={savedAt:Date.now(),title:value(page?'pageTitle':'postTitle'),slug:page?value('pageSlug'):'',excerpt:page?'':value('postExcerpt'),html:value(page?'pageContent':'postContent'),seoTitle:value(page?'pageSeoTitle':'seoTitle'),seoDescription:value(page?'pageSeoDescription':'seoDescription'),status:value(page?'pageStatus':'postStatus'),category:page?'':value('postCategory'),tags:page?[]:[...document.querySelectorAll('input[name="postTags"]:checked')].map(input=>input.value)};
 return data;
}
function saveLocalDraft(kind){
 if(!user||!blog)return;
 const data=collectDraft(kind);
 if(!data.title.trim()&&!richText(data.html)&&!data.seoTitle.trim()&&!data.seoDescription.trim())return;
 const key=localDraftKey(kind);if(!key)return;
 try{localStorage.setItem(key,JSON.stringify(data));draftStatus(kind,'حُفظت نسخة احتياطية محلياً في هذا المتصفح · '+new Date(data.savedAt).toLocaleTimeString('ar',{hour:'2-digit',minute:'2-digit'}))}
 catch(e){draftStatus(kind,'تعذر الحفظ المحلي؛ تحقق من مساحة المتصفح.')}
}
function scheduleLocalDraft(kind){
 clearTimeout(autosaveTimers[kind]);
 draftStatus(kind,'جارٍ حفظ نسخة محلية…');
 autosaveTimers[kind]=setTimeout(()=>saveLocalDraft(kind),650);
}
function restoreLocalDraft(kind){
 const found=readLocalDraft(kind);if(!found)return;
 const d=found.data||{};
 const date=d.savedAt?new Date(d.savedAt).toLocaleString('ar'):'وقت غير معروف';
 if(!confirm('عُثر على نسخة محلية للمحرر محفوظة بتاريخ '+date+'. هل تريد استعادتها؟ لن تتغير قاعدة البيانات إلا عند الضغط على حفظ.'))return;
 const page=kind==='page';
 const set=(id,v)=>{const el=$('#'+id);if(el&&v!==undefined)el.value=v};
 set(page?'pageTitle':'postTitle',d.title||'');
 if(page)set('pageSlug',d.slug||'');
 else{set('postExcerpt',d.excerpt||'');set('postCategory',d.category||'');document.querySelectorAll('input[name="postTags"]').forEach(input=>input.checked=(d.tags||[]).includes(input.value))}
 set(page?'pageSeoTitle':'seoTitle',d.seoTitle||'');set(page?'pageSeoDescription':'seoDescription',d.seoDescription||'');
 set(page?'pageStatus':'postStatus',d.status||(page?'draft':'draft'));
 setRichEditor(page?'pageContent':'postContent',d.html||'');
 draftStatus(kind,'تمت استعادة النسخة المحلية؛ احفظها لتحديث قاعدة البيانات.');
}
function clearLocalDraft(kind){
 const key=localDraftKey(kind);if(!key)return;
 try{localStorage.removeItem(key)}catch(e){}
 draftStatus(kind,'تم الحفظ في قاعدة البيانات.');
}
['post','page'].forEach(kind=>{
 const formEl=kind==='post'?form:$('#pageForm');
 formEl?.addEventListener('input',()=>{if((kind==='post'?modal:$('#pageModal'))?.open)scheduleLocalDraft(kind)});
 formEl?.addEventListener('change',()=>{if((kind==='post'?modal:$('#pageModal'))?.open)scheduleLocalDraft(kind)});
});

const previewModal=$('#contentPreviewModal');
function showContentPreview(kind){
 const isPage=kind==='page',field=isPage?'pageContent':'postContent',editor=editorFor(field);
 syncRichField(field);
 const title=(isPage?$('#pageTitle').value:$('#postTitle').value).trim()||(isPage?'صفحة بلا عنوان':'مقال بلا عنوان');
 const seoTitle=(isPage?$('#pageSeoTitle').value:$('#seoTitle').value).trim();
 const description=(isPage?$('#pageSeoDescription').value:$('#seoDescription').value).trim()||(isPage?'معاينة الصفحة قبل الحفظ':'معاينة المقال قبل الحفظ');
 $('#previewTitle').textContent=title;
 $('#previewDescription').textContent=(seoTitle?'عنوان SEO: '+seoTitle+' — ':'')+description;
 $('#previewBody').innerHTML=sanitizeRichHtml(editor?.innerHTML||'');
 previewModal.showModal()
}
$('#previewPostButton')?.addEventListener('click',()=>showContentPreview('post'));
$('#previewPageButton')?.addEventListener('click',()=>showContentPreview('page'));
$('#closePreviewButton')?.addEventListener('click',()=>previewModal.close());
$('#closePreviewFooter')?.addEventListener('click',()=>previewModal.close());
$('#rangeButton')?.addEventListener('click',()=>note('التحليلات ستضاف في مرحلة لاحقة.'));
document.querySelectorAll('.nav-link,.tool-item,.app-footer a,.hero-link').forEach(a=>a.addEventListener('click',e=>{const h=a.getAttribute('href');if(h==='#taxonomy'||h==='#media'||h==='#pages'){sidebar.classList.remove('open');return}if(h?.startsWith('#')&&!['#dashboard','#posts'].includes(h)){e.preventDefault();sidebar.classList.remove('open');note('هذا القسم ضمن مراحل التطوير التالية.')}}));
function init(){if(!window.supabase?.createClient){note('تعذر تحميل Supabase JS. تحقق من اتصال الإنترنت.');return}db=window.supabase.createClient(URL,KEY);db.auth.onAuthStateChange(()=>{setTimeout(()=>void sync(),0)});void sync()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();