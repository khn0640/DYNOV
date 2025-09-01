/* ====== 환경 ====== */
/** 1) 문의 수집용 WebApp은 inquiry.js에서 이미 사용 중 (POST)  */
const FORM_POST_URL = '<<inquiry.js에 있는 기존 WebApp URL과 동일하게 사용>>';
/** 2) 관리자 조회용 API (GAS에서 doGet으로 JSON 응답) */
const ADMIN_LIST_URL = FORM_POST_URL + '?mode=list';   // 예: &sheet=Inquiry 같은 파라미터 추가 가능
/** 3) 매우 단순한 패스코드 (배포 전 .env/서버로 이관 권장) */
const ADMIN_PASSCODE = 'dynov-admin'; // TODO: 변경하세요

/* ====== 유틸 ====== */
const $ = (sel, el=document)=>el.querySelector(sel);
const $$ = (sel, el=document)=>[...el.querySelectorAll(sel)];
const fmt = (s)=> (s ?? '').toString().trim();
const toCSV = (rows)=>{
  const esc = v => `"${String(v ?? '').replace(/"/g,'""')}"`;
  return rows.map(r=>r.map(esc).join(',')).join('\n');
};

/* ====== 인증(아주 라이트) ====== */
(function authGate(){
  const key = localStorage.getItem('dynov_admin_key');
  if(key === ADMIN_PASSCODE) return;
  const input = prompt('관리자 패스코드를 입력하세요');
  if(input !== ADMIN_PASSCODE){
    alert('접근 거부');
    location.href = 'index.html';
  }else{
    localStorage.setItem('dynov_admin_key', ADMIN_PASSCODE);
  }
})();

/* ====== 상태 저장소(로컬) ======
   - 서버 연동 전까지 브라우저에만 저장(간단·즉시)
   - 키: inquiry:{timestamp or id}
*/
const store = {
  key: 'dynov_admin_state_v1',
  get(){ try{ return JSON.parse(localStorage.getItem(this.key)) || {}; } catch(e){ return {}; } },
  set(data){ localStorage.setItem(this.key, JSON.stringify(data)); },
  patch(id, partial){
    const s = this.get(); s[id] = { ...(s[id]||{}), ...partial, updatedAt: new Date().toISOString() }; this.set(s);
  },
  getOne(id){ return this.get()[id] || {}; }
};

/* ====== 데이터 로드 ====== */
async function fetchInquiries(){
  // 가정: GAS doGet에서 JSON 배열 반환
  // [{timestamp, projectType[], pages, scope, toneMood[], colorTone, customHex, budget, name, email, phone, channel, link, consent}]
  // ※ 실제 컬럼은 inquiry.js의 collectPayload와 동일(프론트에서 POST)  :contentReference[oaicite:0]{index=0}
  try{
    const res = await fetch(ADMIN_LIST_URL, { cache:'no-store' });
    if(!res.ok) throw new Error('응답 오류');
    const json = await res.json();
    return Array.isArray(json) ? json : (json.data || []);
  }catch(e){
    console.error(e);
    alert('목록을 불러오지 못했습니다. (API 미구현/오류 가능)');
    return [];
  }
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
          return `
            <tr data-id="${id}">
              <td>
                <div>${new Date(r.timestamp).toLocaleString()}</div>
                <div class="muted">${(r.projectType||[]).join(', ')}</div>
              </td>
              <td>
                <div><strong>${(r.pages||'').replace(/\n/g,' ')}</strong></div>
                <div class="muted" style="white-space:pre-wrap">${(r.scope||'').slice(0,500)}</div>
                <div class="muted">톤무드: ${(r.toneMood||[]).join(', ')} · 팔레트: ${r.colorTone||'-'} · HEX: ${r.customHex||'-'}</div>
                ${r.link ? `<div><a href="${r.link}" target="_blank" rel="noopener">참고링크</a></div>`:''}
              </td>
              <td>
                <div>${r.name||'-'}</div>
                <div class="muted">${r.email||'-'} · ${r.phone||'-'} / ${r.channel||'-'}</div>
              </td>
              <td>
                <div class="status">
                  <select class="js-status">
                    ${['','new','review','quote','hold','done'].map(v=>`<option value="${v}" ${s.status===v?'selected':''}>${v||'상태없음'}</option>`).join('')}
                  </select>
                  <button class="btn js-save" title="상태 저장(로컬)">저장</button>
                </div>
                <div style="margin-top:6px">
                  <input class="js-note" placeholder="메모" value="${s.note?String(s.note).replace(/"/g,'&quot;'):''}" />
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
    btn.addEventListener('click', e=>{
      const tr = e.target.closest('tr'); const id = tr.dataset.id;
      const status = $('.js-status', tr).value;
      const note = $('.js-note', tr).value;
      store.patch(id, { status, note });
      btn.textContent = '저장됨';
      setTimeout(()=> btn.textContent='저장', 800);
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
  const blob = new Blob([toCSV([header, ...data])], {type: 'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `dynov_inquiries_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

/* ====== 부트 ====== */
let __rows = [];
async function boot(){
  __rows = await fetchInquiries();
  renderList(__rows);
}
boot();

$('#refresh').addEventListener('click', boot);
$('#exportCsv').addEventListener('click', ()=> exportCsv(__rows));
$('#signOut').addEventListener('click', ()=>{
  localStorage.removeItem('dynov_admin_key'); location.reload();
});
$('#q').addEventListener('input', ()=> renderList(__rows));
$('#statusFilter').addEventListener('change', ()=> renderList(__rows));
document.addEventListener('keydown', (e)=>{
  if(e.key === '/') { e.preventDefault(); $('#q').focus(); }
  if(e.key.toLowerCase() === 'r'){ e.preventDefault(); $('#refresh').click(); }
});
