/* ====== 유틸 ====== */
const $ = (sel, el=document)=>el.querySelector(sel);
const $$ = (sel, el=document)=>[...el.querySelectorAll(sel)];
const fmt = (s)=> (s ?? '').toString().trim();
const toCSV = (rows)=>{
  const esc = v => { let text = String(v ?? ''); if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = "'" + text; return `"${text.replace(/"/g,'""')}"`; };
  return rows.map(r=>r.map(esc).join(',')).join('\n');
};

/* Server sessions only; legacy state remains available for manual backup. */
let csrf = '';
let authenticated = false;
async function api(path, options = {}) {
  const res = await fetch('/api/admin/' + path, {
    ...options, credentials: 'same-origin', cache: 'no-store',
    headers: {'Content-Type':'application/json', 'X-CSRF-Token':csrf}
  });
  if (res.status === 401) {
    authenticated = false; __rows = []; renderList([]);
    $('#loginPanel').hidden = false; $('#app').hidden = true;
  }
  let data;
  try { data = await res.json(); }
  catch { throw new Error('관리자 API 응답을 확인할 수 없습니다. 서버 배포와 경로 설정을 확인하세요.'); }
  if (!res.ok) throw new Error(data.error || '요청 실패');
  return data;
}
const store = {getOne(id) { return __rows.find(r => String(r.id) === String(id)) || {}; }};
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const listValue = value => Array.isArray(value) ? value.map(String) : (value ? [String(value)] : []);
function safeLink(value) {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? escapeHTML(u.href) : ''; }
  catch { return ''; }
}
async function fetchInquiries() {
  const json = await api('inquiries');
  if (!Array.isArray(json.data)) throw new Error('목록 응답 형식 오류');
  return json.data.map(r => ({...r, projectType:listValue(r.projectType), toneMood:listValue(r.toneMood), pages:String(r.pages ?? ''), scope:String(r.scope ?? '')}));
}

/* ====== 렌더 ====== */
function renderList(rows){
  const q = fmt($('#q')?.value).toLowerCase();
  const f = fmt($('#statusFilter')?.value);

  const filtered = rows.filter(r=>{
    const hay = [
      r.timestamp, (r.projectType||[]).join(' '), r.pages, r.scope,
      (r.toneMood||[]).join(' '), r.colorTone, r.customHex,
      r.budget, r.name, r.email, r.phone, r.channel, r.link
    ].join(' ').toLowerCase();
    const okQ = !q || hay.includes(q);
    const saved = store.getOne(r.id || r.timestamp);
    const okF = !f || (saved.status === f);
    return okQ && okF;
  });

  if(!filtered.length){
    $('#listArea').innerHTML = `<div class="empty">데이터가 없습니다.</div>`;
    return;
  }

  const html = `
    <table class="table" aria-label="문의 목록">
      <thead>
        <tr>
          <th style="width:130px">수신</th>
          <th>요청/정보</th>
          <th style="width:200px">연락처</th>
          <th style="width:220px">상태</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map(r=>{
          const id = r.id || r.timestamp;
          const s = store.getOne(id);
          const link = safeLink(r.link);
          return `
            <tr data-id="${escapeHTML(id)}">
              <td>
                <div>${escapeHTML(new Date(r.timestamp).toLocaleString())}</div>
                <div class="muted">${escapeHTML((r.projectType||[]).join(', '))}</div>
              </td>
              <td>
                <div><strong>${escapeHTML((r.pages||'').replace(/\n/g,' '))}</strong></div>
                <div class="muted" style="white-space:pre-wrap">${escapeHTML((r.scope||'').slice(0,500))}</div>
                <div class="muted">톤무드: ${escapeHTML((r.toneMood||[]).join(', '))} · 팔레트: ${escapeHTML(r.colorTone||'-')} · HEX: ${escapeHTML(r.customHex||'-')}</div>
                ${link ? `<div><a href="${link}" target="_blank" rel="noopener">참고링크</a></div>`:''}
              </td>
              <td>
                <div>${escapeHTML(r.name||'-')}</div>
                <div class="muted">${escapeHTML(r.email||'-')} · ${escapeHTML(r.phone||'-')} / ${escapeHTML(r.channel||'-')}</div>
              </td>
              <td>
                <div class="status">
                  <select class="js-status">
                    ${['','new','review','quote','hold','done'].map(v=>`<option value="${v}" ${s.status===v?'selected':''}>${v||'상태없음'}</option>`).join('')}
                  </select>
                  <button class="btn js-save" title="상태 저장(서버)">저장</button>
                </div>
                <div style="margin-top:6px">
                  <input class="js-note" placeholder="메모" value="${escapeHTML(s.note)}" />
                </div>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
  $('#listArea').innerHTML = html;

  // 바인딩
  $$('#listArea .js-save').forEach(btn=>{
    btn.addEventListener('click', async e=>{
      const tr = e.target.closest('tr'); const id = tr.dataset.id;
      const status = $('.js-status', tr).value;
      const note = $('.js-note', tr).value;
      btn.disabled = true;
      try {
        const current = store.getOne(id);
        const result = await api('inquiries/' + encodeURIComponent(id), {method:'PATCH', body:JSON.stringify({status,note,version:current.version})});
        Object.assign(current, {status,note,version:result.version});
        renderList(__rows);
        $('#adminMessage').textContent = '저장되었습니다.';
      } catch (error) { $('#adminMessage').textContent = error.message; }
      finally { btn.disabled = false; }
    });
  });
}

/* ====== CSV 내보내기 ====== */
function exportCsv(rows){
  const header = ['timestamp','projectType','pages','scope','toneMood','colorTone','customHex','budget','name','email','phone','channel','link','status(note)'];
  const data = rows.map(r=>{
    const id = r.id || r.timestamp;
    const s = store.getOne(id);
    return [
      r.timestamp,
      (r.projectType||[]).join('|'),
      r.pages||'',
      (r.scope||'').replace(/\n/g, ' '),
      (r.toneMood||[]).join('|'),
      r.colorTone||'',
      r.customHex||'',
      r.budget||'',
      r.name||'',
      r.email||'',
      r.phone||'',
      r.channel||'',
      r.link||'',
      (s.status||'') + (s.note?`(${s.note})`:'' )
    ];
  });
  const blob = new Blob(['\ufeff', toCSV([header, ...data])], {type: 'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `dynov_inquiries_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}

/* ====== 부트 ====== */
let __rows = [];
async function boot(){
  $('#exportCsv').disabled = true;
  try {
    const session = await api('session'); csrf = session.csrf; authenticated = true;
    $('#loginPanel').hidden = true; $('#app').hidden = false;
    __rows = await fetchInquiries(); renderList(__rows);
    $('#adminMessage').textContent = '';
    $('#exportCsv').disabled = false;
  } catch(error) { $('#adminMessage').textContent = error.message; }
}
$('#loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const session = await api('login', {method:'POST',body:JSON.stringify({username:$('#username').value,password:$('#password').value})});
    csrf = session.csrf; $('#password').value = ''; await boot();
  } catch(error) { $('#loginMessage').textContent = error.message; }
});
$('#refresh').addEventListener('click', boot);
$('#exportCsv').addEventListener('click', ()=> {if(authenticated) exportCsv(__rows);});
$('#signOut').addEventListener('click', async ()=>{
  try {
    await api('logout', {method:'POST',body:'{}'});
    csrf = ''; authenticated = false; __rows = []; renderList([]);
    $('#loginPanel').hidden = false; $('#app').hidden = true;
  } catch(error) { $('#adminMessage').textContent = error.message; }
});
$('#q').addEventListener('input', ()=> renderList(__rows));
$('#statusFilter').addEventListener('change', ()=> renderList(__rows));
document.addEventListener('keydown', e=>{
  if (!authenticated || e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input,textarea,select,[contenteditable]')) return;
  if(e.key === '/') { e.preventDefault(); $('#q').focus(); }
  if(e.key.toLowerCase() === 'r'){ e.preventDefault(); $('#refresh').click(); }
});
// Discard obsolete credential only. Never delete legacy notes/status data automatically.
try { localStorage.removeItem('dynov_admin_key'); } catch { /* Storage may be disabled. */ }
boot();
