import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.TBY_CONFIG || {};
const isConfigured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('YOUR_PROJECT') && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes('YOUR_ANON');
const supabase = isConfigured ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
    storage: window.localStorage
  }
}) : null;
const TBY_SITE_URL = 'https://tranminhnhan4547-eng.github.io/tby-badminton/';
const $ = s => document.querySelector(s);
const esc = (v='') => String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmtDate = d => new Intl.DateTimeFormat('vi-VN',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(d+'T00:00:00'));
const today = () => new Date().toISOString().slice(0,10);

let currentAdminUser=null, currentAdminRole=null, currentAdminEvents=[], currentSettings=null;
let pendingRemoveEventImage=false;
const fallbackSettings={
  hero_title:'Chơi hết mình.\nKết nối bền lâu.',
  hero_subtitle:'Đăng ký slot vãng lai nhanh, xem chỗ trống theo thời gian thực và nhận thông tin kèo ngay trên điện thoại.',
  rules_text:'Đi đúng giờ, có mặt sớm để khởi động.\nNếu bận, báo hủy sớm để nhường slot.\nChọn đúng trình để ghép trận cân bằng.\nChơi fair-play, tôn trọng đồng đội và đối thủ.',
  logo_url:'',hero_image_url:'',background_image_url:'',tiktok_url:'',youtube_url:'',facebook_url:'',zalo_url:''
};

async function loadSiteSettings(){
  if(!supabase){applySettings(fallbackSettings);return;}
  const {data,error}=await supabase.from('site_settings').select('*').eq('id',1).maybeSingle();
  currentSettings={...fallbackSettings,...(error?{}:data||{})};
  applySettings(currentSettings);
}
function applySettings(s){
  $('#heroTitle').innerHTML=esc(s.hero_title||fallbackSettings.hero_title).replace(/\n/g,'<br>');
  $('#heroSubtitle').textContent=s.hero_subtitle||fallbackSettings.hero_subtitle;
  if(s.logo_url){$('#headerLogo').src=s.logo_url;$('#footerLogo').src=s.logo_url;}
  $('#heroSection').style.backgroundImage=s.hero_image_url?`linear-gradient(120deg,rgba(5,42,74,.48),rgba(7,89,173,.40)),url("${s.hero_image_url}")`:'';
  document.body.style.backgroundImage=s.background_image_url?`linear-gradient(rgba(244,248,252,.93),rgba(244,248,252,.93)),url("${s.background_image_url}")`:'';
  const rules=(s.rules_text||fallbackSettings.rules_text).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  $('#rulesList').innerHTML=(rules.length?rules:['Nội quy đang được cập nhật.']).map((r,i)=>`<article><b>${String(i+1).padStart(2,'0')}</b><p>${esc(r)}</p></article>`).join('');
  const links=[['TikTok',s.tiktok_url],['YouTube',s.youtube_url],['Facebook',s.facebook_url],['Zalo',s.zalo_url]].filter(x=>x[1]);
  $('#socialLinks').innerHTML=links.length?links.map(([name,url])=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${name}</a>`).join(''):'<span class="muted">Các kênh mạng xã hội đang cập nhật.</span>';
}

async function loadEvents(){
  const root=$('#events');
  if(!supabase){root.innerHTML='<div class="empty-card">Chưa cấu hình Supabase.</div>';return;}
  root.innerHTML='<div class="empty-card">Đang tải lịch kèo…</div>';
  const {data,error}=await supabase.from('events_public').select('*').gte('event_date',today()).order('event_date').order('start_time');
  if(error){root.innerHTML=`<div class="empty-card">Lỗi tải dữ liệu: ${esc(error.message)}</div>`;return;}
  if(!data?.length){root.innerHTML='<div class="empty-card">Hiện chưa có kèo mới.</div>';return;}
  root.innerHTML=data.map(eventCard).join('');
  root.querySelectorAll('[data-register]').forEach(btn=>btn.addEventListener('click',()=>openRegister(btn.dataset.register)));
}
function eventCard(e){
  const malePct=Math.min(100,Math.round((e.male_count/Math.max(1,e.male_slots))*100));
  const femalePct=Math.min(100,Math.round((e.female_count/Math.max(1,e.female_slots))*100));
  const cancelled=!!e.is_cancelled;
  const open=!cancelled && e.is_open && (e.male_count<e.male_slots || e.female_count<e.female_slots);
  const players=[...(e.players||[])];
  const statusText=cancelled?'ĐÃ HỦY KÈO':(open?'ĐANG MỞ ĐĂNG KÝ':'ĐÃ ĐÓNG / ĐỦ SLOT');
  const statusClass=cancelled?'cancelled':(open?'open':'closed');
  return `<article class="event-card ${cancelled?'event-cancelled':''}">
    ${e.image_url?`<img class="event-image" src="${esc(e.image_url)}" alt="Ảnh ${esc(e.title)}">`:''}
    <div class="date-box"><div><div class="day">${esc(fmtDate(e.event_date).split(',')[0])}</div><div class="date">${esc(e.event_date.slice(8,10))}/${esc(e.event_date.slice(5,7))}</div><div>${esc(e.event_date.slice(0,4))}</div></div></div>
    <div class="event-main"><span class="status ${statusClass}">${statusText}</span><h3>${esc(e.title)}</h3>
      <div class="meta"><span>📍 ${esc(e.venue)}</span><span>🕒 ${esc(e.start_time.slice(0,5))} – ${esc(e.end_time.slice(0,5))}</span><span>💰 Nam ${e.male_fee||0}k · Nữ ${e.female_fee||0}k</span><span>🏸 Trình: ${esc(e.level_range)}</span></div>
      <div class="slots"><div class="slot-box"><div class="slot-title"><span>NAM</span><span>${e.male_count}/${e.male_slots}</span></div><div class="slot-count">${e.male_slots-e.male_count>0?`Còn ${e.male_slots-e.male_count}`:'Đủ'}</div><div class="bar"><span style="width:${malePct}%"></span></div></div><div class="slot-box female"><div class="slot-title"><span>NỮ</span><span>${e.female_count}/${e.female_slots}</span></div><div class="slot-count">${e.female_slots-e.female_count>0?`Còn ${e.female_slots-e.female_count}`:'Đủ'}</div><div class="bar"><span style="width:${femalePct}%"></span></div></div></div>
    </div>
    <div class="event-side"><div class="player-list"><h4>Danh sách đã đăng ký</h4>${players.length?players.map(p=>`<div class="player"><span>${esc(p.full_name)}</span><span>${p.gender==='male'?'Nam':'Nữ'} · ${esc(p.level)}</span></div>`).join(''):'<span class="muted">Chưa có người đăng ký.</span>'}</div><button class="btn btn-primary" data-register="${e.id}" ${open?'':'disabled'}>${cancelled?'Kèo đã hủy':(open?'Đăng ký slot →':'Hết slot')}</button></div>
  </article>`;
}
async function openRegister(id){
  const {data,error}=await supabase.from('events_public').select('*').eq('id',id).single();
  if(error)return alert(error.message); if(data.is_cancelled)return alert('Kèo này đã được hủy.');
  $('#eventId').value=id;$('#registerTitle').textContent=data.title;
  $('#eventSummary').innerHTML=`📍 <b>${esc(data.venue)}</b><br>📅 ${esc(fmtDate(data.event_date))}<br>🕒 ${esc(data.start_time.slice(0,5))} – ${esc(data.end_time.slice(0,5))}<br>🏸 ${esc(data.level_range)}`;
  $('#registerMsg').textContent='';$('#registerDialog').showModal();
}
$('#registerForm').addEventListener('submit',async ev=>{
  ev.preventDefault();const btn=$('#submitRegister');btn.disabled=true;btn.textContent='Đang đăng ký…';
  const payload={event_id:$('#eventId').value,full_name:$('#fullName').value.trim(),gender:$('#gender').value,level:$('#level').value,phone:$('#phone').value.trim(),note:$('#note').value.trim()};
  const {error}=await supabase.rpc('register_player',payload);const msg=$('#registerMsg');
  if(error){msg.className='form-msg err';msg.textContent=error.message;}else{msg.className='form-msg ok';msg.textContent='Đăng ký thành công!';ev.target.reset();setTimeout(()=>$('#registerDialog').close(),900);await loadEvents();}
  btn.disabled=false;btn.textContent='🏸 Đăng ký slot';
});

document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.close).close()));
$('#refreshBtn').addEventListener('click',loadEvents);$('#adminRefreshBtn').addEventListener('click',loadAdminEvents);$('#adminBtn').addEventListener('click',async()=>{if(!supabase)return alert('Hãy cấu hình Supabase trước.');$('#adminDialog').showModal();await syncAuth();});

async function syncAuth(){
  const {data:{user}}=await supabase.auth.getUser();currentAdminUser=null;currentAdminRole=null;
  $('#authPane').hidden=!!user;$('#adminPane').hidden=true;$('#notAdminPane').hidden=true;$('#ownerSection').hidden=true;$('#siteSettingsSection').hidden=true;
  if(!user)return;
  const {data:adminRow}=await supabase.from('admin_users').select('user_id,role').eq('user_id',user.id).maybeSingle();
  if(!adminRow){$('#notAdminPane').hidden=false;$('#notAdminIdentity').textContent=user.email||'Tài khoản này';await loadMyRequest();return;}
  currentAdminUser=user;currentAdminRole=adminRow.role||'admin';$('#adminPane').hidden=false;$('#adminIdentity').textContent=`${user.email||'Quản lý'} · ${currentAdminRole.toUpperCase()}`;
  $('#eventEditorSection').hidden=currentAdminRole==='moderator';
  if(currentAdminRole==='owner'){$('#ownerSection').hidden=false;$('#siteSettingsSection').hidden=false;await Promise.all([loadOwnerAccess(),populateSettingsForm()]);}
  await loadAdminEvents();
}
$('#loginForm').addEventListener('submit',async ev=>{
  ev.preventDefault();
  const email=$('#adminEmail').value.trim();
  const m=$('#loginMsg');
  if(!email){m.className='form-msg err';m.textContent='Nhập email trước.';return;}
  m.className='form-msg';m.textContent='Đang gửi link đăng nhập…';
  const {error}=await supabase.auth.signInWithOtp({
    email,
    options:{
      emailRedirectTo:TBY_SITE_URL,
      shouldCreateUser:true
    }
  });
  m.className=`form-msg ${error?'err':'ok'}`;
  if(error){
    m.textContent=(error.message||'').toLowerCase().includes('rate limit')
      ? 'Supabase đang giới hạn gửi email. Chờ một lúc rồi thử lại 1 lần.'
      : error.message;
  }else{
    m.textContent='Đã gửi link đăng nhập. Mở email mới nhất và bấm link.';
  }
});
$('#logoutBtn').addEventListener('click',async()=>{await supabase.auth.signOut();await syncAuth();});
$('#notAdminLogoutBtn').addEventListener('click',async()=>{await supabase.auth.signOut();await syncAuth();});
supabase?.auth.onAuthStateChange(async(event)=>{
  if(event==='SIGNED_IN'){
    // Magic Link trên điện thoại: tự mở lại khu Admin sau khi session được nhận.
    await syncAuth();
    if(!$('#adminDialog').open) $('#adminDialog').showModal();
  }else if(event==='SIGNED_OUT'){
    await syncAuth();
  }
});

async function recoverMobileAuthSession(){
  if(!supabase)return;
  try{
    // Magic Link kiểu implicit chứa access_token trong hash. Cách này hoạt động
    // ngay cả khi yêu cầu link ở Safari nhưng Gmail mở link bằng browser tích hợp.
    const hash=new URLSearchParams(location.hash.replace(/^#/,''));
    const access_token=hash.get('access_token');
    const refresh_token=hash.get('refresh_token');
    if(access_token && refresh_token){
      const {error}=await supabase.auth.setSession({access_token,refresh_token});
      if(error)throw error;
      history.replaceState({},document.title,TBY_SITE_URL);
      await syncAuth();
      if(!$('#adminDialog').open) $('#adminDialog').showModal();
      return;
    }

    // Hỗ trợ callback dạng ?code= nếu Supabase/provider trả PKCE code.
    const url=new URL(location.href);
    const code=url.searchParams.get('code');
    if(code){
      const {error}=await supabase.auth.exchangeCodeForSession(code);
      if(!error){
        history.replaceState({},document.title,TBY_SITE_URL);
        await syncAuth();
        if(!$('#adminDialog').open) $('#adminDialog').showModal();
        return;
      }
    }

    // Nếu session đã được Supabase tự phục hồi từ localStorage, nhận luôn.
    const {data:{session}}=await supabase.auth.getSession();
    if(session?.user){
      await syncAuth();
    }
  }catch(err){
    console.error('TBY mobile auth recovery:',err);
  }
}

function resetEventForm(){
  $('#eventForm').reset();$('#editingEventId').value='';$('#eLevel').value='Yếu+ → TB-';$('#eMale').value=5;$('#eFemale').value=5;$('#eMaleFee').value=65;$('#eFemaleFee').value=55;$('#eOpen').checked=true;$('#eventFormHeading').textContent='Tạo kèo mới';$('#saveEventBtn').textContent='Tạo kèo';$('#cancelEditBtn').hidden=true;$('#eventImagePreview').hidden=true;$('#removeEventImageBtn').hidden=true;$('#eImageFile').value='';pendingRemoveEventImage=false;
}
$('#cancelEditBtn').addEventListener('click',resetEventForm);
$('#eImageFile').addEventListener('change',()=>{const f=$('#eImageFile').files[0];if(!f)return;$('#eventImagePreview').src=URL.createObjectURL(f);$('#eventImagePreview').hidden=false;$('#removeEventImageBtn').hidden=false;pendingRemoveEventImage=false;});
$('#removeEventImageBtn').addEventListener('click',()=>{$('#eImageFile').value='';$('#eventImagePreview').hidden=true;$('#removeEventImageBtn').hidden=true;pendingRemoveEventImage=true;});

async function uploadMedia(file,path){
  if(!file)return null;const ext=(file.name.split('.').pop()||'jpg').toLowerCase();const finalPath=`${path}.${ext}`;
  const {error}=await supabase.storage.from('tby-media').upload(finalPath,file,{upsert:true,contentType:file.type||undefined});if(error)throw error;
  return supabase.storage.from('tby-media').getPublicUrl(finalPath).data.publicUrl;
}
function storagePathFromUrl(url){try{const marker='/storage/v1/object/public/tby-media/';const i=url.indexOf(marker);return i>=0?decodeURIComponent(url.slice(i+marker.length)):null;}catch{return null;}}
async function removeMediaUrl(url){const p=storagePathFromUrl(url);if(p)await supabase.storage.from('tby-media').remove([p]);}

$('#eventForm').addEventListener('submit',async ev=>{
  ev.preventDefault();if(!currentAdminUser||!['owner','admin'].includes(currentAdminRole))return alert('Chỉ Owner/Admin mới được chỉnh kèo.');
  const id=$('#editingEventId').value||null;const old=id?currentAdminEvents.find(x=>x.id===id):null;
  const p={title:$('#eTitle').value.trim(),venue:$('#eVenue').value.trim(),event_date:$('#eDate').value,start_time:$('#eStart').value,end_time:$('#eEnd').value,level_range:$('#eLevel').value.trim(),male_slots:+$('#eMale').value,female_slots:+$('#eFemale').value,male_fee:+$('#eMaleFee').value||0,female_fee:+$('#eFemaleFee').value||0,is_open:$('#eOpen').checked};
  const m=$('#adminMsg');m.textContent='Đang lưu…';m.className='form-msg';
  try{
    let eventId=id;
    if(id){const {error}=await supabase.from('events').update(p).eq('id',id);if(error)throw error;}else{const {data,error}=await supabase.from('events').insert({...p,is_cancelled:false}).select('id').single();if(error)throw error;eventId=data.id;}
    if(pendingRemoveEventImage&&old?.image_url){await removeMediaUrl(old.image_url);const {error}=await supabase.from('events').update({image_url:null}).eq('id',eventId);if(error)throw error;}
    const file=$('#eImageFile').files[0];if(file){if(old?.image_url)await removeMediaUrl(old.image_url);const url=await uploadMedia(file,`events/${eventId}-${Date.now()}`);const {error}=await supabase.from('events').update({image_url:url}).eq('id',eventId);if(error)throw error;}
    m.className='form-msg ok';m.textContent=id?'Đã cập nhật kèo.':'Tạo kèo thành công.';resetEventForm();await Promise.all([loadEvents(),loadAdminEvents()]);
  }catch(err){m.className='form-msg err';m.textContent=err.message||String(err);}
});

async function loadAdminEvents(){
  const root=$('#adminEventList');if(!currentAdminUser){root.innerHTML='';return;}root.innerHTML='<div class="admin-empty">Đang tải kèo…</div>';
  const {data,error}=await supabase.from('events_public').select('*').order('event_date',{ascending:false}).order('start_time',{ascending:false}).limit(50);if(error){root.innerHTML=`<div class="admin-empty">${esc(error.message)}</div>`;return;}
  currentAdminEvents=data||[];if(!currentAdminEvents.length){root.innerHTML='<div class="admin-empty">Chưa có kèo nào.</div>';return;}root.innerHTML=currentAdminEvents.map(adminEventCard).join('');
  root.querySelectorAll('[data-admin-edit]').forEach(b=>b.addEventListener('click',()=>editEvent(b.dataset.adminEdit)));
  root.querySelectorAll('[data-admin-cancel]').forEach(b=>b.addEventListener('click',()=>toggleCancelEvent(b.dataset.adminCancel,b.dataset.cancelled==='true')));
  root.querySelectorAll('[data-admin-delete]').forEach(b=>b.addEventListener('click',()=>deleteEvent(b.dataset.adminDelete)));
  root.querySelectorAll('[data-admin-players]').forEach(b=>b.addEventListener('click',()=>loadAdminPlayers(b.dataset.adminPlayers)));
}
function adminEventCard(e){const cancelled=!!e.is_cancelled;return `<article class="admin-event-item"><div class="admin-event-info"><strong>${esc(e.title)}</strong><span>${esc(e.event_date)} · ${esc(e.start_time.slice(0,5))}–${esc(e.end_time.slice(0,5))} · ${esc(e.venue)}</span><span>Nam ${e.male_count}/${e.male_slots} · Nữ ${e.female_count}/${e.female_slots}${cancelled?' · ĐÃ HỦY':''}</span></div><div class="admin-actions"><button type="button" class="btn btn-ghost btn-sm" data-admin-players="${e.id}">Người đăng ký</button>${currentAdminRole!=='moderator'?`<button type="button" class="btn btn-outline btn-sm" data-admin-edit="${e.id}">Sửa kèo</button><button type="button" class="btn ${cancelled?'btn-success':'btn-warning'} btn-sm" data-admin-cancel="${e.id}" data-cancelled="${cancelled}">${cancelled?'Mở lại kèo':'Hủy kèo'}</button><button type="button" class="btn btn-danger btn-sm" data-admin-delete="${e.id}">Xóa kèo</button>`:''}</div><div class="admin-players" id="players-${e.id}" hidden></div></article>`;}
function editEvent(id){if(!['owner','admin'].includes(currentAdminRole))return;const e=currentAdminEvents.find(x=>x.id===id);if(!e)return;$('#editingEventId').value=e.id;$('#eTitle').value=e.title;$('#eVenue').value=e.venue;$('#eDate').value=e.event_date;$('#eStart').value=e.start_time.slice(0,5);$('#eEnd').value=e.end_time.slice(0,5);$('#eLevel').value=e.level_range;$('#eMale').value=e.male_slots;$('#eFemale').value=e.female_slots;$('#eMaleFee').value=e.male_fee||0;$('#eFemaleFee').value=e.female_fee||0;$('#eOpen').checked=!!e.is_open;$('#eImageFile').value='';pendingRemoveEventImage=false;$('#eventFormHeading').textContent='Sửa kèo';$('#saveEventBtn').textContent='Lưu thay đổi';$('#cancelEditBtn').hidden=false;if(e.image_url){$('#eventImagePreview').src=e.image_url;$('#eventImagePreview').hidden=false;$('#removeEventImageBtn').hidden=false;}else{$('#eventImagePreview').hidden=true;$('#removeEventImageBtn').hidden=true;}$('#eventEditorSection').scrollIntoView({behavior:'smooth',block:'start'});}
async function toggleCancelEvent(id,isCancelled){if(!['owner','admin'].includes(currentAdminRole))return alert('Chỉ Owner/Admin mới được thay đổi kèo.');if(!confirm(`Bạn có chắc muốn ${isCancelled?'mở lại':'hủy'} kèo này?`))return;const patch=isCancelled?{is_cancelled:false,is_open:true}:{is_cancelled:true,is_open:false};const {error}=await supabase.from('events').update(patch).eq('id',id);if(error)return alert(error.message);await Promise.all([loadEvents(),loadAdminEvents()]);}
async function deleteEvent(id){if(!['owner','admin'].includes(currentAdminRole))return alert('Chỉ Owner/Admin mới được xóa kèo.');const e=currentAdminEvents.find(x=>x.id===id);if(!confirm(`XÓA VĨNH VIỄN kèo “${e?.title||''}”?\nToàn bộ người đăng ký cũng sẽ bị xóa.`))return;if(e?.image_url)await removeMediaUrl(e.image_url);const {error}=await supabase.from('events').delete().eq('id',id);if(error)return alert(error.message);await Promise.all([loadEvents(),loadAdminEvents()]);}
async function loadAdminPlayers(eventId){const box=$(`#players-${eventId}`);if(!box)return;if(!box.hidden){box.hidden=true;return;}box.hidden=false;box.innerHTML='<div class="admin-empty">Đang tải danh sách…</div>';const {data,error}=await supabase.rpc('admin_get_registrations',{p_event_id:eventId});if(error){box.innerHTML=`<div class="admin-empty">${esc(error.message)}</div>`;return;}if(!data?.length){box.innerHTML='<div class="admin-empty">Chưa có người đăng ký.</div>';return;}box.innerHTML=data.map(r=>`<div class="admin-player-row"><div><strong>${esc(r.full_name)}</strong><span>${r.gender==='male'?'Nam':'Nữ'} · ${esc(r.level)} · ${esc(r.phone||'')}</span>${r.note?`<small>Ghi chú: ${esc(r.note)}</small>`:''}<small>Đăng ký: ${new Date(r.created_at).toLocaleString('vi-VN')}</small></div><button type="button" class="btn btn-danger btn-sm" data-delete-registration="${r.id}" data-event-id="${eventId}" data-name="${esc(r.full_name)}">Xóa slot</button></div>`).join('');box.querySelectorAll('[data-delete-registration]').forEach(b=>b.addEventListener('click',()=>deleteRegistration(b.dataset.deleteRegistration,b.dataset.eventId,b.dataset.name)));}
async function deleteRegistration(id,eventId,name){if(!confirm(`Xóa slot đăng ký của “${name}”?`))return;const {error}=await supabase.from('registrations').delete().eq('id',id);if(error)return alert(error.message);await Promise.all([loadEvents(),loadAdminEvents()]);const btn=document.querySelector(`[data-admin-players="${eventId}"]`);if(btn)await loadAdminPlayers(eventId);}

async function loadMyRequest(){const {data:{user}}=await supabase.auth.getUser();if(!user)return;const {data}=await supabase.from('admin_requests').select('status').eq('user_id',user.id).maybeSingle();const m=$('#requestMsg');if(data?.status==='pending'){m.className='form-msg ok';m.textContent='Yêu cầu đang chờ Owner duyệt.';$('#requestAdminBtn').disabled=true;}else if(data?.status==='rejected'){m.className='form-msg err';m.textContent='Yêu cầu trước đã bị từ chối. Bạn có thể gửi lại.';$('#requestAdminBtn').disabled=false;}else{m.textContent='';$('#requestAdminBtn').disabled=false;}}
$('#requestAdminBtn').addEventListener('click',async()=>{const full_name=$('#requestName').value.trim();if(!full_name)return alert('Nhập họ tên trước.');const {error}=await supabase.rpc('submit_admin_request',{p_full_name:full_name,p_note:$('#requestNote').value.trim()});const m=$('#requestMsg');m.className=`form-msg ${error?'err':'ok'}`;m.textContent=error?error.message:'Đã gửi yêu cầu. Chờ Owner duyệt.';if(!error)await loadMyRequest();});
$('#ownerRefreshBtn').addEventListener('click',loadOwnerAccess);async function loadOwnerAccess(){if(currentAdminRole!=='owner')return;await Promise.all([loadPendingAdmins(),loadManagers()]);}
async function loadPendingAdmins(){const root=$('#pendingAdminList');root.innerHTML='<div class="admin-empty">Đang tải yêu cầu…</div>';const {data,error}=await supabase.rpc('owner_list_admin_requests');if(error){root.innerHTML=`<div class="admin-empty">${esc(error.message)}</div>`;return;}if(!data?.length){root.innerHTML='<div class="admin-empty">Không có tài khoản chờ duyệt.</div>';return;}root.innerHTML=data.map(r=>`<article class="admin-event-item manager-row"><div class="who"><strong>${esc(r.full_name||r.email||'Tài khoản')}</strong><span>${esc(r.email||'')} · ${new Date(r.created_at).toLocaleString('vi-VN')}</span>${r.note?`<span>${esc(r.note)}</span>`:''}</div><div class="manager-actions"><select class="role-select" id="approve-role-${r.user_id}"><option value="admin">Admin</option><option value="moderator">Moderator</option></select><button class="btn btn-success btn-sm" data-approve-user="${r.user_id}">✓ Duyệt</button><button class="btn btn-danger btn-sm" data-reject-user="${r.user_id}">Từ chối</button></div></article>`).join('');root.querySelectorAll('[data-approve-user]').forEach(b=>b.addEventListener('click',()=>approveManager(b.dataset.approveUser)));root.querySelectorAll('[data-reject-user]').forEach(b=>b.addEventListener('click',()=>rejectManager(b.dataset.rejectUser)));}
async function approveManager(userId){const role=$(`#approve-role-${userId}`).value;if(!confirm(`Duyệt với quyền ${role.toUpperCase()}?`))return;const {error}=await supabase.rpc('owner_approve_admin_request',{p_user_id:userId,p_role:role});if(error)return alert(error.message);await loadOwnerAccess();}
async function rejectManager(userId){if(!confirm('Từ chối yêu cầu này?'))return;const {error}=await supabase.rpc('owner_reject_admin_request',{p_user_id:userId});if(error)return alert(error.message);await loadOwnerAccess();}
async function loadManagers(){const root=$('#managerList');root.innerHTML='<div class="admin-empty">Đang tải danh sách quyền…</div>';const {data,error}=await supabase.rpc('owner_list_managers');if(error){root.innerHTML=`<div class="admin-empty">${esc(error.message)}</div>`;return;}root.innerHTML=(data||[]).map(r=>`<article class="admin-event-item manager-row"><div class="who"><strong>${esc(r.email||r.user_id)}</strong><span class="manager-badge ${esc(r.role)}">${esc((r.role||'admin').toUpperCase())}</span></div><div class="manager-actions">${r.role==='owner'?'<span class="muted">Owner chính</span>':`<select class="role-select" data-role-user="${r.user_id}"><option value="admin" ${r.role==='admin'?'selected':''}>Admin</option><option value="moderator" ${r.role==='moderator'?'selected':''}>Moderator</option></select><button class="btn btn-ghost btn-sm" data-save-role="${r.user_id}">Lưu quyền</button><button class="btn btn-danger btn-sm" data-revoke-user="${r.user_id}">Thu hồi</button>`}</div></article>`).join('');root.querySelectorAll('[data-save-role]').forEach(b=>b.addEventListener('click',()=>changeManagerRole(b.dataset.saveRole)));root.querySelectorAll('[data-revoke-user]').forEach(b=>b.addEventListener('click',()=>revokeManager(b.dataset.revokeUser)));}
async function changeManagerRole(userId){const role=document.querySelector(`[data-role-user="${userId}"]`).value;const {error}=await supabase.rpc('owner_change_manager_role',{p_user_id:userId,p_role:role});if(error)return alert(error.message);await loadManagers();}
async function revokeManager(userId){if(!confirm('Thu hồi toàn bộ quyền quản lý?'))return;const {error}=await supabase.rpc('owner_revoke_manager',{p_user_id:userId});if(error)return alert(error.message);await loadOwnerAccess();}

async function populateSettingsForm(){await loadSiteSettings();const s=currentSettings||fallbackSettings;$('#sHeroTitle').value=s.hero_title||'';$('#sHeroSubtitle').value=s.hero_subtitle||'';$('#sRules').value=s.rules_text||'';$('#sTikTok').value=s.tiktok_url||'';$('#sYouTube').value=s.youtube_url||'';$('#sFacebook').value=s.facebook_url||'';$('#sZalo').value=s.zalo_url||'';}
$('#siteSettingsForm').addEventListener('submit',async ev=>{ev.preventDefault();if(currentAdminRole!=='owner')return alert('Chỉ Owner được chỉnh giao diện website.');const m=$('#siteSettingsMsg');m.textContent='Đang lưu…';m.className='form-msg';try{let s={...(currentSettings||fallbackSettings),hero_title:$('#sHeroTitle').value.trim(),hero_subtitle:$('#sHeroSubtitle').value.trim(),rules_text:$('#sRules').value.trim(),tiktok_url:$('#sTikTok').value.trim(),youtube_url:$('#sYouTube').value.trim(),facebook_url:$('#sFacebook').value.trim(),zalo_url:$('#sZalo').value.trim()};const files=[['sLogoFile','logo_url','site/logo'],['sHeroFile','hero_image_url','site/hero'],['sBackgroundFile','background_image_url','site/background']];for(const [input,key,path] of files){const f=$(`#${input}`).files[0];if(f){if(s[key])await removeMediaUrl(s[key]);s[key]=await uploadMedia(f,`${path}-${Date.now()}`);}}const {error}=await supabase.from('site_settings').upsert({id:1,...s,updated_at:new Date().toISOString()});if(error)throw error;m.className='form-msg ok';m.textContent='Đã cập nhật website.';currentSettings=s;applySettings(s);ev.target.querySelectorAll('input[type=file]').forEach(x=>x.value='');}catch(err){m.className='form-msg err';m.textContent=err.message||String(err);}});

await recoverMobileAuthSession();
await Promise.all([loadSiteSettings(),loadEvents()]);
