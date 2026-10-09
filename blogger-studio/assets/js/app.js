(() => {
'use strict';
const $ = (s, r=document) => r.querySelector(s);
const toast=$('#toast'), sidebar=$('#sidebar'), modal=$('#postModal'), authModal=$('#authModal'), form=$('#postForm');
let timer, db=null, user=null, blog=null;
const URL='https://zxlhwrmuebyfiksjrhrb.supabase.co';
const KEY='sb_publishable_puKPQERSPv3lUowWlDio-Q_JVSZ9540';
function note(s){toast.textContent=s;toast.classList.add('visible');clearTimeout(timer);timer=setTimeout(()=>toast.classList.remove('visible'),3000)}
function authUI(){ $('#authButton').textContent=user?'تسجيل الخروج':'تسجيل الدخول';$('.user-row b').textContent=user?.email||'حساب المدون';$('.user-row small').textContent=user?'متصل بقاعدة البيانات':'سجّل الدخول للبدء';}
async function posts(){
 if(!user||!blog)return;
 const {data,error}=await db.from('posts').select('id,title,slug,status,updated_at,view_count').eq('blog_id',blog.id).neq('status','trash').order('updated_at',{ascending:false}).limit(30);
 if(error){note('تعذر تحميل المقالات: '+error.message);return}
 const rows=$('#postRows');rows.replaceChildren();
 if(!data.length){rows.innerHTML='<tr><td colspan="5" style="padding:22px">لا توجد مقالات بعد. أنشئ مسودتك الأولى.</td></tr>';return}
 const names={draft:'مسودة',published:'منشور',review:'قيد المراجعة',scheduled:'مجدول',archived:'مؤرشف'};
 data.forEach(p=>{const tr=document.createElement('tr'),td=document.createElement('td'),wrap=document.createElement('div'),thumb=document.createElement('span'),txt=document.createElement('span'),title=document.createElement('b'),slug=document.createElement('small');wrap.className='post-title-cell';thumb.className='post-thumb thumb-three';thumb.textContent='✳';title.textContent=p.title||'(بلا عنوان)';slug.textContent='/'+p.slug;txt.append(title,slug);wrap.append(thumb,txt);td.append(wrap);const st=document.createElement('td'),badge=document.createElement('span');badge.className='status '+p.status;badge.textContent=names[p.status]||p.status;st.append(badge);const date=document.createElement('td');date.textContent=new Date(p.updated_at).toLocaleString('ar');const views=document.createElement('td');views.className='number-cell';views.textContent=p.view_count||'—';const actions=document.createElement('td'),more=document.createElement('button');more.className='more-btn';more.textContent='•••';more.setAttribute('aria-label','خيارات المقال');more.onclick=()=>note('معرّف المقال: '+p.id);actions.append(more);tr.append(td,st,date,views,actions);rows.append(tr)})
}
async function sync(){
 if(!db)return;
 const {data:{session}}=await db.auth.getSession();user=session?.user||null;blog=null;authUI();
 if(!user){$('#postRows').innerHTML='<tr><td colspan="5" style="padding:22px">سجّل الدخول لعرض مقالاتك.</td></tr>';return}
 const {data:blogs,error}=await db.from('blogs').select('id,name,slug').eq('owner_id',user.id).order('created_at').limit(1);
 if(error){note('خطأ تحميل المدونات: '+error.message);return}
 if(blogs.length)blog=blogs[0];else{
 const slug='blog-'+user.id.slice(0,8);
 const result=await db.from('blogs').insert({owner_id:user.id,name:'مدونتي الجديدة',slug,language:'ar',timezone:'Africa/Casablanca'}).select('id,name,slug').single();
 if(result.error){note('تعذر إنشاء المدونة: '+result.error.message);return}blog=result.data
 }
 $('.workspace b').textContent=blog.name;await posts();note('تم الاتصال بقاعدة البيانات.')
}
function openPost(){if(!user){authModal.showModal();note('سجّل الدخول لحفظ المقال.');return}modal.showModal();setTimeout(()=>$('#postTitle').focus(),30)}
$('#menuToggle')?.addEventListener('click',()=>sidebar.classList.toggle('open'));
document.addEventListener('click',e=>{if(innerWidth<=900&&sidebar.classList.contains('open')&&!sidebar.contains(e.target)&&!e.target.closest('#menuToggle'))sidebar.classList.remove('open')});
$('#themeToggle')?.addEventListener('click',()=>{const dark=document.body.classList.toggle('dark');$('#themeToggle').setAttribute('aria-label',dark?'تفعيل المظهر الفاتح':'تفعيل المظهر الداكن');try{localStorage.setItem('blogger-studio-theme',dark?'dark':'light')}catch(e){}});
try{if(localStorage.getItem('blogger-studio-theme')==='dark')document.body.classList.add('dark')}catch(e){}
$('#newPost')?.addEventListener('click',openPost);$('#heroNewPost')?.addEventListener('click',openPost);
$('#authButton')?.addEventListener('click',async()=>{if(!db){note('تعذر تحميل Supabase JS.');return}if(user){const {error}=await db.auth.signOut();if(error)note(error.message);else{await sync();note('تم تسجيل الخروج')}}else authModal.showModal()});
$('#signInButton')?.addEventListener('click',async()=>{const email=$('#authEmail').value.trim(),password=$('#authPassword').value;const {error}=await db.auth.signInWithPassword({email,password});if(error){note('تعذر تسجيل الدخول: '+error.message);return}authModal.close();await sync()});
$('#signUpButton')?.addEventListener('click',async()=>{const email=$('#authEmail').value.trim(),password=$('#authPassword').value;if(password.length<8){note('كلمة المرور يجب ألا تقل عن 8 أحرف.');return}const {data,error}=await db.auth.signUp({email,password});if(error){note('تعذر إنشاء الحساب: '+error.message);return}if(!data.session)note('تحقق من بريدك الإلكتروني ثم سجّل الدخول.');else{authModal.close();await sync()}});
form?.addEventListener('submit',async e=>{e.preventDefault();if(!user||!blog){note('سجّل الدخول أولاً.');return}const title=$('#postTitle').value.trim(),excerpt=$('#postExcerpt').value.trim(),body=$('#postContent').value.trim(),seoTitle=$('#seoTitle').value.trim(),seoDescription=$('#seoDescription').value.trim();if(!title){$('#postTitle').focus();return}if(!body){note('أضف محتوى المقال قبل الحفظ.');$('#postContent').focus();return}const slug=title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\\u0600-\\u06ff]+/g,'-').replace(/^-|-$/g,'').slice(0,80)+'-'+Math.random().toString(36).slice(2,6);const safeBody=body.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/\\n/g,'<br>');const {error}=await db.from('posts').insert({blog_id:blog.id,author_id:user.id,title,excerpt,slug,content:{type:'plain_text',text:body},content_html:'<p>'+safeBody+'</p>',seo_title:seoTitle||title,seo_description:seoDescription||excerpt,status:'draft',visibility:'public'});if(error){note('لم تحفظ المسودة: '+error.message);return}modal.close();form.reset();await posts();note('تم حفظ المسودة مع محتواها وإعدادات SEO.')});
$('#rangeButton')?.addEventListener('click',()=>note('التحليلات ستضاف في مرحلة لاحقة.'));
document.querySelectorAll('.nav-link,.tool-item,.app-footer a,.hero-link').forEach(a=>a.addEventListener('click',e=>{const h=a.getAttribute('href');if(h?.startsWith('#')&&!['#dashboard','#posts'].includes(h)){e.preventDefault();sidebar.classList.remove('open');note('هذا القسم ضمن مراحل التطوير التالية.')}}));
document.querySelectorAll('.more-btn').forEach(b=>b.addEventListener('click',()=>note('خيارات المقالات ستستكمل لاحقاً.')));
function init(){if(!window.supabase?.createClient){note('تعذر تحميل Supabase JS. تحقق من اتصال الإنترنت.');return}db=window.supabase.createClient(URL,KEY);db.auth.onAuthStateChange(()=>{setTimeout(()=>void sync(),0)});void sync()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();