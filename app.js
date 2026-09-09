import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.TBY_CONFIG || {};
const isConfigured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('YOUR_PROJECT') && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes('YOUR_ANON');
const supabase = isConfigured ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

const $ = (s) => document.querySelector(s);
const fmtDate = (d) => new Intl.DateTimeFormat('vi-VN',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(d+'T00:00:00'));
const esc = (v='') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function loadEvents(){
  const root = $('#events');
  if(!supabase){root.innerHTML = `<div class="empty-card">Chưa cấu hình Supabase. Mở <b>config.js</b> và điền URL + anon key.</div>`;return;}
  root.innerHTML='<div class="empty-card">Đang tải lịch kèo…</div>';
  const {data,error}=await supabase.from('events_public').select('*').gte('event_date',new Date().toISOString().slice(0,10)).order('event_date').order('start_time');
  if(error){root.innerHTML=`<div class="empty-card">Lỗi tải dữ liệu: ${esc(error.message)}</div>`;return;}
  if(!data?.length){root.innerHTML='<div class="empty-card">Hiện chưa có kèo mới.</div>';return;}
  root.innerHTML=data.map(eventCard).join('');
  root.querySelectorAll('[data-register]').forEach(btn=>btn.addEventListener('click',()=>openRegister(btn.dataset.register)));
}

function eventCard(e){
  const malePct=Math.min(100,Math.round((e.male_count/Math.max(1,e.male_slots))*100));
  const femalePct=Math.min(100,Math.round((e.female_count/Math.max(1,e.female_slots))*100));
  const open=e.is_open && (e.male_count<e.male_slots || e.female_count<e.female_slots);
  const players=[...(e.players||[])].slice(0,8);
  return `<article class="event-card">
    <div class="date-box"><div><div class="day">${esc(fmtDate(e.event_date).split(',')[0])}</div><div class="date">${esc(e.event_date.slice(8,10))}/${esc(e.event_date.slice(5,7))}</div><div>${esc(e.event_date.slice(0,4))}</div></div></div>
    <div class="event-main">
      <span class="status ${open?'open':'closed'}">${open?'ĐANG MỞ ĐĂNG KÝ':'ĐÃ ĐÓNG / ĐỦ SLOT'}</span>
      <h3>${esc(e.title)}</h3>
      <div class="meta"><span>📍 ${esc(e.venue)}</span><span>🕒 ${esc(e.start_time.slice(0,5))} – ${esc(e.end_time.slice(0,5))}</span><span>💰 Nam ${e.male_fee||0}k · Nữ ${e.female_fee||0}k</span><span>🏸 Trình: ${esc(e.level_range)}</span></div>
      <div class="slots">
        <div class="slot-box"><div class="slot-title"><span>NAM</span><span>${e.male_count}/${e.male_slots}</span></div><div class="slot-count">${e.male_slots-e.male_count>0?`Còn ${e.male_slots-e.male_count}`:'Đủ'}</div><div class="bar"><span style="width:${malePct}%"></span></div></div>
        <div class="slot-box female"><div class="slot-title"><span>NỮ</span><span>${e.female_count}/${e.female_slots}</span></div><div class="slot-count">${e.female_slots-e.female_count>0?`Còn ${e.female_slots-e.female_count}`:'Đủ'}</div><div class="bar"><span style="width:${femalePct}%"></span></div></div>
      </div>
    </div>
    <div class="event-side">
      <div class="player-list"><h4>Danh sách đã đăng ký</h4>${players.length?players.map(p=>`<div class="player"><span>${esc(p.full_name)}</span><span>${p.gender==='male'?'Nam':'Nữ'} · ${esc(p.level)}</span></div>`).join(''):'<span class="muted">Chưa có người đăng ký.</span>'}</div>
      <button class="btn btn-primary" data-register="${e.id}" ${open?'':'disabled'}>${open?'Đăng ký slot →':'Hết slot'}</button>
    </div>
  </article>`;
}

async function openRegister(id){
  const {data,error}=await supabase.from('events_public').select('*').eq('id',id).single();
  if(error)return alert(error.message);
  $('#eventId').value=id; $('#registerTitle').textContent=data.title;
  $('#eventSummary').innerHTML=`📍 <b>${esc(data.venue)}</b><br>📅 ${esc(fmtDate(data.event_date))}<br>🕒 ${esc(data.start_time.slice(0,5))} – ${esc(data.end_time.slice(0,5))}<br>🏸 ${esc(data.level_range)}`;
  $('#registerMsg').textContent='';
  $('#registerDialog').showModal();
}

$('#registerForm').addEventListener('submit',async (ev)=>{
  ev.preventDefault(); if(!supabase)return;
  const btn=$('#submitRegister'); btn.disabled=true; btn.textContent='Đang đăng ký…';
  const payload={event_id:$('#eventId').value,full_name:$('#fullName').value.trim(),gender:$('#gender').value,level:$('#level').value,phone:$('#phone').value.trim(),note:$('#note').value.trim()};
  const {error}=await supabase.rpc('register_player',payload);
  const msg=$('#registerMsg');
  if(error){msg.className='form-msg err';msg.textContent=error.message;}
  else{msg.className='form-msg ok';msg.textContent='Đăng ký thành công! Slot đã được cập nhật.'; ev.target.reset(); setTimeout(()=>$('#registerDialog').close(),1200); await loadEvents();}
  btn.disabled=false; btn.textContent='🏸 Đăng ký slot';
});

document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.close).close()));
$('#refreshBtn').addEventListener('click',loadEvents);
$('#adminBtn').addEventListener('click',async()=>{if(!supabase)return alert('Hãy cấu hình Supabase trước.');$('#adminDialog').showModal();await syncAuth();});

async function syncAuth(){
  const {data:{user}}=await supabase.auth.getUser();
  $('#authPane').hidden=!!user; $('#adminPane').hidden=!user;
  if(user)$('#adminIdentity').textContent=user.email||'Admin';
}
$('#loginForm').addEventListener('submit',async ev=>{ev.preventDefault();const email=$('#adminEmail').value.trim();const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});const m=$('#loginMsg');m.className=`form-msg ${error?'err':'ok'}`;m.textContent=error?error.message:'Đã gửi magic link. Kiểm tra email để đăng nhập.';});
$('#logoutBtn').addEventListener('click',async()=>{await supabase.auth.signOut();await syncAuth();});
supabase?.auth.onAuthStateChange(()=>syncAuth());

$('#eventForm').addEventListener('submit',async ev=>{ev.preventDefault();const p={title:$('#eTitle').value.trim(),venue:$('#eVenue').value.trim(),event_date:$('#eDate').value,start_time:$('#eStart').value,end_time:$('#eEnd').value,level_range:$('#eLevel').value.trim(),male_slots:+$('#eMale').value,female_slots:+$('#eFemale').value,male_fee:+$('#eMaleFee').value||0,female_fee:+$('#eFemaleFee').value||0,is_open:$('#eOpen').checked};const {error}=await supabase.from('events').insert(p);const m=$('#adminMsg');m.className=`form-msg ${error?'err':'ok'}`;m.textContent=error?error.message:'Tạo kèo thành công.';if(!error){ev.target.reset();$('#eOpen').checked=true;await loadEvents();}});

loadEvents();
