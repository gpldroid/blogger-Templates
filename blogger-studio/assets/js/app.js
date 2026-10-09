(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const sidebar = $('#sidebar');
  const toast = $('#toast');
  const modal = $('#postModal');
  const postForm = $('#postForm');
  const titleInput = $('#postTitle');
  let toastTimer;

  function notify(message) {
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
  }

  function openPostModal() {
    if (typeof modal.showModal === 'function') modal.showModal();
    else notify('المتصفح لا يدعم نافذة إنشاء المقال.');
    setTimeout(() => titleInput.focus(), 50);
  }

  $('#menuToggle')?.addEventListener('click', () => sidebar.classList.toggle('open'));
  document.addEventListener('click', event => {
    if (window.innerWidth <= 900 && sidebar.classList.contains('open') && !sidebar.contains(event.target) && !event.target.closest('#menuToggle')) {
      sidebar.classList.remove('open');
    }
  });

  $('#themeToggle')?.addEventListener('click', () => {
    const dark = document.body.classList.toggle('dark');
    $('#themeToggle').setAttribute('aria-label', dark ? 'تفعيل المظهر الفاتح' : 'تفعيل المظهر الداكن');
    try { localStorage.setItem('blogger-studio-theme', dark ? 'dark' : 'light'); } catch (_) { /* Storage may be disabled. */ }
  });
  try {
    if (localStorage.getItem('blogger-studio-theme') === 'dark') document.body.classList.add('dark');
  } catch (_) { /* Use light mode when storage is unavailable. */ }

  $('#newPost')?.addEventListener('click', openPostModal);
  $('#heroNewPost')?.addEventListener('click', openPostModal);

  postForm?.addEventListener('submit', event => {
    // This static starter deliberately does not pretend to write to a database.
    event.preventDefault();
    const title = titleInput.value.trim();
    if (!title) {
      titleInput.focus();
      return;
    }
    const body = $('#postExcerpt').value.trim();
    const row = document.createElement('tr');
    const titleCell = document.createElement('td');
    const titleWrap = document.createElement('div');
    titleWrap.className = 'post-title-cell';
    const thumb = document.createElement('span');
    thumb.className = 'post-thumb thumb-three';
    thumb.textContent = '✳';
    const words = document.createElement('span');
    const heading = document.createElement('b');
    heading.textContent = title;
    const description = document.createElement('small');
    description.textContent = body || 'مسودة جديدة · لم تُحفظ سحابياً';
    words.append(heading, description);
    titleWrap.append(thumb, words);
    titleCell.append(titleWrap);
    const statusCell = document.createElement('td');
    const status = document.createElement('span');
    status.className = 'status draft';
    status.textContent = 'مسودة تجريبية';
    statusCell.append(status);
    const updatedCell = document.createElement('td');
    updatedCell.textContent = 'الآن';
    const viewsCell = document.createElement('td');
    viewsCell.className = 'number-cell';
    viewsCell.textContent = '—';
    const moreCell = document.createElement('td');
    const more = document.createElement('button');
    more.className = 'more-btn';
    more.setAttribute('aria-label', 'خيارات المقال');
    more.textContent = '•••';
    moreCell.append(more);
    row.append(titleCell, statusCell, updatedCell, viewsCell, moreCell);
    $('#postRows').prepend(row);
    modal.close();
    postForm.reset();
    notify('أُضيفت المسودة إلى المعاينة فقط. اربط Supabase لتفعيل الحفظ الحقيقي.');
  });

  $('#rangeButton')?.addEventListener('click', () => notify('تغيير نطاق الإحصاءات سيتفعّل بعد ربط بيانات التحليلات.'));
  document.querySelectorAll('.nav-link, .tool-item, .app-footer a, .hero-link').forEach(link => {
    link.addEventListener('click', event => {
      const target = link.getAttribute('href');
      if (target && target.startsWith('#') && !['#dashboard', '#posts'].includes(target)) {
        event.preventDefault();
        sidebar.classList.remove('open');
        notify('قسم ' + link.textContent.trim() + ' ضمن خارطة التطوير وسيتم تفعيله على مراحل.');
      }
    });
  });
  document.querySelectorAll('.more-btn').forEach(button => button.addEventListener('click', () => notify('قائمة الإجراءات ستُربط بعمليات إدارة المقالات.')));
})();
