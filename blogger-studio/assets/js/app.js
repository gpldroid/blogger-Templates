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
function safeHtml(value){return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/\n/g,'<br>')}
async function posts(){
 if(!user||!blog)return;
 const {data,error}=await db.from('posts').select('id,title,slug,status,updated_at,view_count,excerpt,content,content_html,seo_title,seo_description,published_at,category_id').eq('blog_id',blog.id).order('updated_at',{ascending:false}).limit(100);
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
async function sync(){
 if(!db)return;
 const {data:{session}}=await db.auth.getSession();user=session?.user||null;blog=null;authUI();
 if(!user){$('#postRows').innerHTML='<tr><td colspan="5" style="padding:22px">سجّل الدخول لعرض مقالاتك.</td></tr>';return}
 const {data:blogs,error}=await db.from('blogs').select('id,name,slug').eq('owner_id',user.id).order('created_at').limit(1);
 if(error){note('خطأ تحميل المدونات: '+error.message);return}
 if(blogs.length)blog=blogs[0];else{const result=await db.from('blogs').insert({owner_id:user.id,name:'مدونتي الجديدة',slug:'blog-'+user.id.slice(0,8),language:'ar',timezone:'Africa/Casablanca'}).select('id,name,slug').single();if(result.error){note('تعذر إنشاء المدونة: '+result.error.message);return}blog=result.data}
 $('.workspace b').textContent=blog.name;await Promise.all([posts(),loadTaxonomy()])
}
function resetEditor(){editingPostId=null;form.reset();$('#postModalTitle').textContent='إنشاء مقال جديد';$('#saveDraft').textContent='حفظ كمسودة';$('#postStatus').value='draft'}
function openPost(){if(!user){authModal.showModal();note('سجّل الدخول لحفظ المقال.');return}resetEditor();modal.showModal();setTimeout(()=>$('#postTitle').focus(),30)}
async function openEdit(p){if(!user||!blog)return;resetEditor();editingPostId=p.id;$('#postModalTitle').textContent='تحرير المقال';$('#saveDraft').textContent='حفظ التعديلات';$('#postTitle').value=p.title||'';$('#postExcerpt').value=p.excerpt||'';$('#postContent').value=p.content?.text||(p.content_html||'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/?p>/gi,'');$('#seoTitle').value=p.seo_title||'';$('#seoDescription').value=p.seo_description||'';$('#postStatus').value=['draft','review','published','archived'].includes(p.status)?p.status:'draft';$('#postCategory').value=p.category_id||'';const {data:links,error}=await db.from('post_tags').select('tag_id').eq('post_id',p.id);if(error){note('تعذر تحميل وسوم المقال: '+error.message);return}const selected=new Set((links||[]).map(x=>x.tag_id));document.querySelectorAll('input[name="postTags"]').forEach(input=>input.checked=selected.has(input.value));modal.showModal();setTimeout(()=>$('#postTitle').focus(),30)}
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
 const title=$('#postTitle').value.trim(),excerpt=$('#postExcerpt').value.trim(),body=$('#postContent').value.trim(),seoTitle=$('#seoTitle').value.trim(),seoDescription=$('#seoDescription').value.trim(),status=$('#postStatus').value,categoryId=$('#postCategory').value||null,selectedTagIds=[...document.querySelectorAll('input[name="postTags"]:checked')].map(input=>input.value);
 if(!title){$('#postTitle').focus();return}if(!body){note('أضف محتوى المقال قبل الحفظ.');$('#postContent').focus();return}
 const wasEditing=Boolean(editingPostId),payload={title,excerpt,category_id:categoryId,content:{type:'plain_text',text:body},content_html:'<p>'+safeHtml(body)+'</p>',seo_title:seoTitle||title,seo_description:seoDescription||excerpt,status,updated_at:new Date().toISOString()};
 if(status==='published')payload.published_at=new Date().toISOString();
 let postId=editingPostId;
 if(editingPostId){const {error}=await db.from('posts').update(payload).eq('id',editingPostId).eq('blog_id',blog.id);if(error){note('لم تُحفظ التعديلات: '+error.message);return}}
 else{const slug=slugify(title)+'-'+Math.random().toString(36).slice(2,6);Object.assign(payload,{blog_id:blog.id,author_id:user.id,slug});const {data,error}=await db.from('posts').insert(payload).select('id').single();if(error){note('لم تحفظ المقالة: '+error.message);return}postId=data.id}
 const {error:clearError}=await db.from('post_tags').delete().eq('post_id',postId);
 if(clearError){note('تم حفظ المقال لكن تعذر تحديث وسومه: '+clearError.message);return}
 if(selectedTagIds.length){const {error:tagError}=await db.from('post_tags').insert(selectedTagIds.map(tag_id=>({post_id:postId,tag_id})));if(tagError){note('تم حفظ المقال لكن تعذر ربط الوسوم: '+tagError.message);return}}
 modal.close();resetEditor();await posts();note(wasEditing?'تم حفظ التعديلات.':'تم حفظ المقال بنجاح.')
});
$('#rangeButton')?.addEventListener('click',()=>note('التحليلات ستضاف في مرحلة لاحقة.'));
document.querySelectorAll('.nav-link,.tool-item,.app-footer a,.hero-link').forEach(a=>a.addEventListener('click',e=>{const h=a.getAttribute('href');if(h==='#taxonomy'){sidebar.classList.remove('open');return}if(h?.startsWith('#')&&!['#dashboard','#posts'].includes(h)){e.preventDefault();sidebar.classList.remove('open');note('هذا القسم ضمن مراحل التطوير التالية.')}}));
function init(){if(!window.supabase?.createClient){note('تعذر تحميل Supabase JS. تحقق من اتصال الإنترنت.');return}db=window.supabase.createClient(URL,KEY);db.auth.onAuthStateChange(()=>{setTimeout(()=>void sync(),0)});void sync()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();