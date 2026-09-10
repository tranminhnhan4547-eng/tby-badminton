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

function updateOwnerPasswordVisibility(){
  const sec=document.getElementById('ownerPasswordSection');
  if(!sec)return;
  sec.hidden=currentAdminRole!=='owner';
}
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
  const links=[['TikTok',s.tiktok_url,'tiktok'],['YouTube',s.youtube_url,'youtube'],['Facebook',s.facebook_url,'facebook'],['Zalo',s.zalo_url,'zalo']].filter(x=>x[1]);
  $('#socialLinks').innerHTML=links.length?links.map(([name,url,key])=>`<a data-social="${key}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${name}</a>`).join(''):'<span class="muted">Các kênh mạng xã hội đang cập nhật.</span>';
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
  const maleCount=Number(e.male_count||0);
  const femaleCount=Number(e.female_count||0);
  const totalCount=Number(e.total_count ?? (maleCount+femaleCount));
  const totalSlots=Math.max(1,Number(e.total_slots||10));
  const totalPct=Math.min(100,Math.round((totalCount/totalSlots)*100));
  const cancelled=!!e.is_cancelled;
  const full=totalCount>=totalSlots;
  const open=!cancelled && !!e.is_open && !full;
  const players=[...(e.players||[])];
  const statusText=cancelled?'ĐÃ HỦY KÈO':(!e.is_open?'ĐÃ ĐÓNG ĐĂNG KÝ':(full?'ĐÃ ĐỦ SLOT':'ĐANG MỞ ĐĂNG KÝ'));
  const statusClass=cancelled?'cancelled':(open?'open':'closed');
  const buttonText=cancelled?'Kèo đã hủy':(!e.is_open?'Đã đóng đăng ký':(full?'Đã đủ slot':'Đăng ký slot →'));
  return `<article class="event-card ${cancelled?'event-cancelled':''}">
    ${e.image_url?`<img class="event-image" src="${esc(e.image_url)}" alt="Ảnh ${esc(e.title)}">`:''}
    <div class="date-box"><div><div class="day">${esc(fmtDate(e.event_date).split(',')[0])}</div><div class="date">${esc(e.event_date.slice(8,10))}/${esc(e.event_date.slice(5,7))}</div><div>${esc(e.event_date.slice(0,4))}</div></div></div>
    <div class="event-main"><span class="status ${statusClass}">${statusText}</span><h3>${esc(e.title)}</h3>
      <div class="meta"><span>📍 ${esc(e.venue)}</span><span>🕒 ${esc(e.start_time.slice(0,5))} – ${esc(e.end_time.slice(0,5))}</span><span>💰 Nam ${e.male_fee||0}k · Nữ ${e.female_fee||0}k</span><span>🏸 Trình: ${esc(e.level_range)}</span></div>
      <div class="slots">
        <div class="slot-box total"><div class="slot-title"><span>TỔNG SLOT</span><span>${totalCount}/${totalSlots}</span></div><div class="slot-count">${full?'Đã đủ':`Còn ${Math.max(0,totalSlots-totalCount)} slot`}</div><div class="bar"><span style="width:${totalPct}%"></span></div></div>
        <div class="slot-box"><div class="slot-title"><span>NAM</span><span>${maleCount} người</span></div><div class="slot-count small">${maleCount}</div></div>
        <div class="slot-box female"><div class="slot-title"><span>NỮ</span><span>${femaleCount} người</span></div><div class="slot-count small">${femaleCount}</div></div>
      </div>
    </div>
    <div class="event-side"><div class="player-list"><h4>Danh sách đã đăng ký</h4>${players.length?players.map(p=>`<div class="player"><span>${esc(p.full_name)}</span><span>${p.gender==='male'?'Nam':'Nữ'} · ${esc(p.level)}</span></div>`).join(''):'<span class="muted">Chưa có người đăng ký.</span>'}</div><button class="btn btn-primary" data-register="${e.id}" ${open?'':'disabled'}>${buttonText}</button></div>
  </article>`;
}
async function openRegister(id){
  const {data,error}=await supabase.from('events_public').select('*').eq('id',id).single();
  if(error)return alert(error.message); if(data.is_cancelled)return alert('Kèo này đã được hủy.');
  $('#eventId').value=id;$('#registerTitle').textContent=data.title;
  const addr=data.venue_address?`<br>📌 ${esc(data.venue_address)}`:'';
  $('#eventSummary').innerHTML=`📍 <b>${esc(data.venue)}</b>${addr}<br>📅 ${esc(fmtDate(data.event_date))}<br>🕒 ${esc(data.start_time.slice(0,5))} – ${esc(data.end_time.slice(0,5))}<br>🏸 ${esc(data.level_range)}`;
  $('#registerMsg').textContent='';
$('#registerDialog').showModal();
}
$('#registerForm').addEventListener('submit',async ev=>{
  ev.preventDefault();const btn=$('#submitRegister');btn.disabled=true;btn.textContent='Đang đăng ký…';
  const payload={event_id:$('#eventId').value,full_name:$('#fullName').value.trim(),gender:$('#gender').value,level:$('#level').value,phone:$('#phone').value.trim(),note:$('#note').value.trim()};
  const {data,error}=await supabase.rpc('register_player',payload);const msg=$('#registerMsg');
  if(error){
    msg.className='form-msg err';msg.textContent=error.message;
  }else{
    msg.className='form-msg ok';msg.textContent='Đăng ký thành công!';
    ev.target.reset();
    const d=(data&&typeof data==='object')?data:{};
    const courtText=(d.court_number??'').toString().trim();
    const court=courtText
      ? `<div class="success-court"><span>SÂN SỐ</span><strong>${esc(courtText)}</strong></div>`
      : `<div class="success-court"><span>SÂN SỐ</span><strong>Chưa cập nhật</strong></div>`;

    const body=$('#registrationSuccessBody');
    if(body){
      body.innerHTML=`
        <div class="success-row"><span>📅 Ngày</span><b>${esc(d.event_date?fmtDate(d.event_date):'')}</b></div>
        <div class="success-row"><span>🕒 Giờ</span><b>${esc((d.start_time||'').slice(0,5))} – ${esc((d.end_time||'').slice(0,5))}</b></div>
        <div class="success-row"><span>🏸 Sân</span><b>${esc(d.venue||'')}</b></div>
        <div class="success-row"><span>📍 Địa chỉ</span><b>${esc(d.venue_address||'')}</b></div>
        ${court}`;
    }

    // Hiện thông báo bằng dialog riêng để desktop/mobile đều nhìn thấy ngay.
    const regDialog=$('#registerDialog');
    const successDialog=$('#registrationSuccessDialog');
    if(regDialog?.open) regDialog.close();
    if(successDialog && !successDialog.open) successDialog.showModal();

    await loadEvents();
  }
  btn.disabled=false;btn.textContent='🏸 Đăng ký slot';
});

document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.close).close()));
$('#refreshBtn').addEventListener('click',loadEvents);$('#adminRefreshBtn').addEventListener('click',loadAdminEvents);$('#adminBtn').addEventListener('click',async()=>{if(!supabase)return alert('Hãy cấu hình Supabase trước.');$('#adminDialog').showModal();await syncAuth();});

async function syncAuth(){
  const {data:{user}}=await supabase.auth.getUser();currentAdminUser=null;currentAdminRole=null;updateOwnerPasswordVisibility();
  $('#authPane').hidden=!!user;$('#adminPane').hidden=true;$('#notAdminPane').hidden=true;$('#ownerSection').hidden=true;$('#siteSettingsSection').hidden=true;$('#videoAdminSection').hidden=true;
  if(!user)return;
  const {data:adminRow}=await supabase.from('admin_users').select('user_id,role').eq('user_id',user.id).maybeSingle();
  if(!adminRow){$('#notAdminPane').hidden=false;$('#notAdminIdentity').textContent=user.email||'Tài khoản này';return;}
  currentAdminUser=user;currentAdminRole=adminRow.role||'admin';$('#adminPane').hidden=false;$('#adminIdentity').textContent=`${user.email||'Quản lý'} · ${currentAdminRole.toUpperCase()}`;
  $('#eventEditorSection').hidden=currentAdminRole==='moderator';
  $('#eOpen').disabled=currentAdminRole!=='owner';$('#eOpenHint').textContent=currentAdminRole==='owner'?'(Bạn có quyền đóng/mở đăng ký)':'(Chỉ Owner được đóng/mở đăng ký)';
  if(currentAdminRole==='owner'){$('#ownerSection').hidden=false;$('#siteSettingsSection').hidden=false;$('#videoAdminSection').hidden=false;await Promise.all([loadOwnerAccess(),populateSettingsForm(),loadAdminVideos()]);}
  await loadAdminEvents();
}
// Điền lại email gần nhất để đăng nhập trên điện thoại nhanh hơn.
const lastTbyEmail=localStorage.getItem('tby_last_email');
if(lastTbyEmail){
  if($('#adminEmail')) $('#adminEmail').value=lastTbyEmail;
  if($('#signupEmail')) $('#signupEmail').value=lastTbyEmail;
}

document.querySelectorAll('[data-auth-mode]').forEach(btn=>btn.addEventListener('click',()=>{
  const mode=btn.dataset.authMode;
  document.querySelectorAll('[data-auth-mode]').forEach(x=>x.classList.toggle('active',x===btn));
  $('#loginForm').hidden=mode!=='login';
  $('#signupForm').hidden=mode!=='signup';
  $('#loginMsg').textContent='';
}));

$('#loginForm').addEventListener('submit',async ev=>{
  ev.preventDefault();
  const email=$('#adminEmail').value.trim();
  const password=$('#adminPassword').value;
  const m=$('#loginMsg');
  if(!email||!password){m.className='form-msg err';m.textContent='Nhập email và mật khẩu.';return;}
  m.className='form-msg';m.textContent='Đang đăng nhập…';
  const {error}=await supabase.auth.signInWithPassword({email,password});
  m.className=`form-msg ${error?'err':'ok'}`;
  if(error){
    const raw=error.message||'';
    if(raw.includes('Email not confirmed')){
      m.textContent='Supabase đang bật Confirm Email nên tài khoản này chưa đăng nhập được. Hãy tắt Confirm Email trong Authentication.';
    }else if(raw.includes('Invalid login credentials')){
      m.textContent='Email hoặc mật khẩu chưa đúng. Nếu vừa tạo tài khoản, hãy xác nhận email trước rồi thử lại.';
    }else{
      m.textContent=raw;
    }
    return;
  }
  m.textContent='Đăng nhập thành công.';
  await syncAuth();
});

$('#signupForm').addEventListener('submit',async ev=>{
  ev.preventDefault();
  const email=$('#signupEmail').value.trim().toLowerCase();
  const password=$('#signupPassword').value;
  const password2=$('#signupPassword2').value;
  const m=$('#loginMsg');

  if(!email){m.className='form-msg err';m.textContent='Nhập email.';return;}
  if(password.length<6){m.className='form-msg err';m.textContent='Mật khẩu cần ít nhất 6 ký tự.';return;}
  if(password!==password2){m.className='form-msg err';m.textContent='Hai mật khẩu không giống nhau.';return;}

  m.className='form-msg';m.textContent='Đang tạo tài khoản…';

  const {data,error}=await supabase.auth.signUp({email,password});

  if(error){
    m.className='form-msg err';
    const msg=error.message||'';
    if(msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already been registered')){
      m.textContent='Email này đã có tài khoản. Hãy chuyển sang Đăng nhập.';
    }else{
      m.textContent=msg;
    }
    return;
  }

  localStorage.setItem('tby_last_email',email);

  if(!data?.session){
    m.className='form-msg err';
    m.textContent='Supabase vẫn đang bật Confirm Email. Hãy tắt Confirm Email trong Authentication để dùng luồng đăng ký nhanh.';
    return;
  }

  m.className='form-msg ok';
  m.textContent='Tạo tài khoản thành công. Tài khoản đang chờ Owner duyệt.';
  await syncAuth();
});

$('#magicLinkBtn').addEventListener('click',async()=>{
  const email=($('#adminEmail').value||$('#signupEmail').value||'').trim();
  const m=$('#loginMsg');
  if(!email){m.className='form-msg err';m.textContent='Nhập email trước rồi bấm Magic Link.';return;}
  m.className='form-msg';m.textContent='Đang gửi Magic Link…';
  const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:TBY_SITE_URL,shouldCreateUser:true}});
  m.className=`form-msg ${error?'err':'ok'}`;
  m.textContent=error?((error.message||'').toLowerCase().includes('rate limit')?'Supabase đang giới hạn gửi email. Chờ một lúc rồi thử lại.':error.message):'Đã gửi Magic Link. Hãy mở email mới nhất.';
});
$('#logoutBtn').addEventListener('click',async()=>{await supabase.auth.signOut();await syncAuth();});
$('#notAdminLogoutBtn').addEventListener('click',async()=>{await supabase.auth.signOut();await syncAuth();});
supabase?.auth.onAuthStateChange(async(event)=>{
  if(event==='SIGNED_IN'){
    // Magic Link trên điện thoại: tự mở lại khu Admin sau khi session được nhận.
    await syncAuth();
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
        return;
      }
    }

    // Nếu session đã được Supabase tự phục hồi từ localStorage, nhận luôn.
    const {data:{session}}=await supabase.auth.getSession();
    if(session?.user){
      if(session.user.email)localStorage.setItem('tby_last_email',session.user.email);
      await syncAuth();
    }
  }catch(err){
    console.error('TBY mobile auth recovery:',err);
  }
}

function resetEventForm(){
  $('#eventForm').reset();$('#editingEventId').value='';$('#eVenueAddress').value='';$('#eCourtNumber').value='';$('#eLevel').value='Yếu+ → TB-';$('#eTotal').value=10;$('#eMaleFee').value=65;$('#eFemaleFee').value=55;$('#eOpen').checked=true;$('#eventFormHeading').textContent='Tạo kèo mới';$('#saveEventBtn').textContent='Tạo kèo';$('#cancelEditBtn').hidden=true;$('#eventImagePreview').hidden=true;$('#removeEventImageBtn').hidden=true;$('#eImageFile').value='';pendingRemoveEventImage=false;$('#eOpen').disabled=currentAdminRole!=='owner';
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
  const totalSlots=Math.max(1,+$('#eTotal').value||1);const p={title:$('#eTitle').value.trim(),venue:$('#eVenue').value.trim(),venue_address:$('#eVenueAddress').value.trim(),event_date:$('#eDate').value,start_time:$('#eStart').value,end_time:$('#eEnd').value,level_range:$('#eLevel').value.trim(),total_slots:totalSlots,male_fee:+$('#eMaleFee').value||0,female_fee:+$('#eFemaleFee').value||0};if(currentAdminRole==='owner')p.is_open=$('#eOpen').checked;
  const m=$('#adminMsg');m.textContent='Đang lưu…';m.className='form-msg';
  try{
    let eventId=id;
    if(id){const {error}=await supabase.from('events').update(p).eq('id',id);if(error)throw error;}else{const createPayload={...p,is_cancelled:false,is_open:currentAdminRole==='owner'?$('#eOpen').checked:true};const {data,error}=await supabase.from('events').insert(createPayload).select('id').single();if(error)throw error;eventId=data.id;}
    const {error:courtErr}=await supabase.rpc('admin_set_event_court',{p_event_id:eventId,p_court_number:$('#eCourtNumber').value.trim()||null});
    if(courtErr)throw courtErr;
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
  root.querySelectorAll('[data-admin-registration]').forEach(b=>b.addEventListener('click',()=>toggleRegistration(b.dataset.adminRegistration,b.dataset.open==='true')));
  root.querySelectorAll('[data-admin-delete]').forEach(b=>b.addEventListener('click',()=>deleteEvent(b.dataset.adminDelete)));
  root.querySelectorAll('[data-admin-players]').forEach(b=>b.addEventListener('click',()=>loadAdminPlayers(b.dataset.adminPlayers)));
}
function adminEventCard(e){
  const cancelled=!!e.is_cancelled;
  const maleCount=Number(e.male_count||0),femaleCount=Number(e.female_count||0);
  const totalCount=Number(e.total_count ?? (maleCount+femaleCount));
  const totalSlots=Math.max(1,Number(e.total_slots||10));
  const regState=!e.is_open?'ĐÃ ĐÓNG ĐĂNG KÝ':(totalCount>=totalSlots?'ĐÃ ĐỦ SLOT':'ĐANG MỞ');
  const ownerRegistrationButton=currentAdminRole==='owner'&&!cancelled?`<button type="button" class="btn ${e.is_open?'btn-warning':'btn-success'} btn-sm" data-admin-registration="${e.id}" data-open="${!!e.is_open}">${e.is_open?'Đóng đăng ký':'Mở đăng ký'}</button>`:'';
  return `<article class="admin-event-item"><div class="admin-event-info"><strong>${esc(e.title)}</strong><span>${esc(e.event_date)} · ${esc(e.start_time.slice(0,5))}–${esc(e.end_time.slice(0,5))} · ${esc(e.venue)}</span><span>Tổng ${totalCount}/${totalSlots} · Nam ${maleCount} · Nữ ${femaleCount} · ${regState}${cancelled?' · ĐÃ HỦY':''}</span></div><div class="admin-actions"><button type="button" class="btn btn-ghost btn-sm" data-admin-players="${e.id}">Người đăng ký</button>${ownerRegistrationButton}${currentAdminRole!=='moderator'?`<button type="button" class="btn btn-outline btn-sm" data-admin-edit="${e.id}">Sửa kèo</button><button type="button" class="btn ${cancelled?'btn-success':'btn-warning'} btn-sm" data-admin-cancel="${e.id}" data-cancelled="${cancelled}">${cancelled?'Mở lại kèo':'Hủy kèo'}</button><button type="button" class="btn btn-danger btn-sm" data-admin-delete="${e.id}">Xóa kèo</button>`:''}</div><div class="admin-players" id="players-${e.id}" hidden></div></article>`;
}
function editEvent(id){
  if(!['owner','admin'].includes(currentAdminRole))return;
  const e=currentAdminEvents.find(x=>x.id===id);if(!e)return;
  $('#editingEventId').value=e.id;$('#eTitle').value=e.title;$('#eVenue').value=e.venue;$('#eVenueAddress').value=e.venue_address||'';$('#eCourtNumber').value='';$('#eDate').value=e.event_date;$('#eStart').value=e.start_time.slice(0,5);$('#eEnd').value=e.end_time.slice(0,5);$('#eLevel').value=e.level_range;$('#eTotal').value=e.total_slots||10;$('#eMaleFee').value=e.male_fee||0;$('#eFemaleFee').value=e.female_fee||0;$('#eOpen').checked=!!e.is_open;$('#eOpen').disabled=currentAdminRole!=='owner';$('#eImageFile').value='';pendingRemoveEventImage=false;$('#eventFormHeading').textContent='Sửa kèo';$('#saveEventBtn').textContent='Lưu thay đổi';$('#cancelEditBtn').hidden=false;
  if(e.image_url){$('#eventImagePreview').src=e.image_url;$('#eventImagePreview').hidden=false;$('#removeEventImageBtn').hidden=false;}else{$('#eventImagePreview').hidden=true;$('#removeEventImageBtn').hidden=true;}
  supabase.rpc('admin_get_event_court',{p_event_id:e.id}).then(({data,error})=>{
    if(!error&&data!==null&&data!==undefined)$('#eCourtNumber').value=typeof data==='string'?data:(data.court_number||'');
  });
  $('#eventEditorSection').scrollIntoView({behavior:'smooth',block:'start'});
}
async function toggleRegistration(id,isOpen){
  if(currentAdminRole!=='owner')return alert('Chỉ Owner mới được đóng/mở đăng ký.');
  const e=currentAdminEvents.find(x=>x.id===id);if(e?.is_cancelled)return alert('Kèo đang bị hủy. Hãy mở lại kèo trước.');
  if(!confirm(`${isOpen?'Đóng':'Mở lại'} đăng ký cho kèo này?`))return;
  const {error}=await supabase.rpc('owner_set_registration_open',{p_event_id:id,p_is_open:!isOpen});
  if(error)return alert(error.message);
  await Promise.all([loadEvents(),loadAdminEvents()]);
}
async function toggleCancelEvent(id,isCancelled){if(!['owner','admin'].includes(currentAdminRole))return alert('Chỉ Owner/Admin mới được thay đổi kèo.');if(!confirm(`Bạn có chắc muốn ${isCancelled?'mở lại':'hủy'} kèo này?`))return;const patch=isCancelled?{is_cancelled:false,is_open:true}:{is_cancelled:true,is_open:false};const {error}=await supabase.from('events').update(patch).eq('id',id);if(error)return alert(error.message);await Promise.all([loadEvents(),loadAdminEvents()]);}
async function deleteEvent(id){if(!['owner','admin'].includes(currentAdminRole))return alert('Chỉ Owner/Admin mới được xóa kèo.');const e=currentAdminEvents.find(x=>x.id===id);if(!confirm(`XÓA VĨNH VIỄN kèo “${e?.title||''}”?\nToàn bộ người đăng ký cũng sẽ bị xóa.`))return;if(e?.image_url)await removeMediaUrl(e.image_url);const {error}=await supabase.from('events').delete().eq('id',id);if(error)return alert(error.message);await Promise.all([loadEvents(),loadAdminEvents()]);}
async function loadAdminPlayers(eventId){const box=$(`#players-${eventId}`);if(!box)return;if(!box.hidden){box.hidden=true;return;}box.hidden=false;box.innerHTML='<div class="admin-empty">Đang tải danh sách…</div>';const {data,error}=await supabase.rpc('admin_get_registrations',{p_event_id:eventId});if(error){box.innerHTML=`<div class="admin-empty">${esc(error.message)}</div>`;return;}if(!data?.length){box.innerHTML='<div class="admin-empty">Chưa có người đăng ký.</div>';return;}box.innerHTML=data.map(r=>`<div class="admin-player-row"><div><strong>${esc(r.full_name)}</strong><span>${r.gender==='male'?'Nam':'Nữ'} · ${esc(r.level)} · ${esc(r.phone||'')}</span>${r.note?`<small>Ghi chú: ${esc(r.note)}</small>`:''}<small>Đăng ký: ${new Date(r.created_at).toLocaleString('vi-VN')}</small></div><button type="button" class="btn btn-danger btn-sm" data-delete-registration="${r.id}" data-event-id="${eventId}" data-name="${esc(r.full_name)}">Xóa slot</button></div>`).join('');box.querySelectorAll('[data-delete-registration]').forEach(b=>b.addEventListener('click',()=>deleteRegistration(b.dataset.deleteRegistration,b.dataset.eventId,b.dataset.name)));}
async function deleteRegistration(id,eventId,name){if(!confirm(`Xóa slot đăng ký của “${name}”?`))return;const {error}=await supabase.from('registrations').delete().eq('id',id);if(error)return alert(error.message);await Promise.all([loadEvents(),loadAdminEvents()]);const btn=document.querySelector(`[data-admin-players="${eventId}"]`);if(btn)await loadAdminPlayers(eventId);}

$('#ownerRefreshBtn').addEventListener('click',loadOwnerAccess);async function loadOwnerAccess(){if(currentAdminRole!=='owner')return;await Promise.all([loadPendingAdmins(),loadManagers()]);}
async function loadPendingAdmins(){const root=$('#pendingAdminList');root.innerHTML='<div class="admin-empty">Đang tải yêu cầu…</div>';const {data,error}=await supabase.rpc('owner_list_admin_requests');if(error){root.innerHTML=`<div class="admin-empty">${esc(error.message)}</div>`;return;}if(!data?.length){root.innerHTML='<div class="admin-empty">Không có tài khoản chờ duyệt.</div>';return;}root.innerHTML=data.map(r=>`<article class="admin-event-item manager-row"><div class="who"><strong>${esc(r.full_name||r.email||'Tài khoản')}</strong><span>${esc(r.email||'')} · ${new Date(r.created_at).toLocaleString('vi-VN')}</span>${r.note?`<span>${esc(r.note)}</span>`:''}</div><div class="manager-actions"><select class="role-select" id="approve-role-${r.user_id}"><option value="admin">Admin</option><option value="moderator">Moderator</option></select><button class="btn btn-success btn-sm" data-approve-user="${r.user_id}">✓ Duyệt</button><button class="btn btn-danger btn-sm" data-reject-user="${r.user_id}">Từ chối</button></div></article>`).join('');root.querySelectorAll('[data-approve-user]').forEach(b=>b.addEventListener('click',()=>approveManager(b.dataset.approveUser)));root.querySelectorAll('[data-reject-user]').forEach(b=>b.addEventListener('click',()=>rejectManager(b.dataset.rejectUser)));}
async function approveManager(userId){const role=$(`#approve-role-${userId}`).value;if(!confirm(`Duyệt với quyền ${role.toUpperCase()}?`))return;const {error}=await supabase.rpc('owner_approve_admin_request',{p_user_id:userId,p_role:role});if(error)return alert(error.message);await loadOwnerAccess();}
async function rejectManager(userId){if(!confirm('Từ chối yêu cầu này?'))return;const {error}=await supabase.rpc('owner_reject_admin_request',{p_user_id:userId});if(error)return alert(error.message);await loadOwnerAccess();}
async function loadManagers(){const root=$('#managerList');root.innerHTML='<div class="admin-empty">Đang tải danh sách quyền…</div>';const {data,error}=await supabase.rpc('owner_list_managers');if(error){root.innerHTML=`<div class="admin-empty">${esc(error.message)}</div>`;return;}root.innerHTML=(data||[]).map(r=>`<article class="admin-event-item manager-row"><div class="who"><strong>${esc(r.email||r.user_id)}</strong><span class="manager-badge ${esc(r.role)}">${esc((r.role||'admin').toUpperCase())}</span></div><div class="manager-actions">${r.role==='owner'?'<span class="muted">Owner chính</span>':`<select class="role-select" data-role-user="${r.user_id}"><option value="admin" ${r.role==='admin'?'selected':''}>Admin</option><option value="moderator" ${r.role==='moderator'?'selected':''}>Moderator</option></select><button class="btn btn-ghost btn-sm" data-save-role="${r.user_id}">Lưu quyền</button><button class="btn btn-danger btn-sm" data-revoke-user="${r.user_id}">Thu hồi</button>`}</div></article>`).join('');root.querySelectorAll('[data-save-role]').forEach(b=>b.addEventListener('click',()=>changeManagerRole(b.dataset.saveRole)));root.querySelectorAll('[data-revoke-user]').forEach(b=>b.addEventListener('click',()=>revokeManager(b.dataset.revokeUser)));}
async function changeManagerRole(userId){const role=document.querySelector(`[data-role-user="${userId}"]`).value;const {error}=await supabase.rpc('owner_change_manager_role',{p_user_id:userId,p_role:role});if(error)return alert(error.message);await loadManagers();}
async function revokeManager(userId){if(!confirm('Thu hồi toàn bộ quyền quản lý?'))return;const {error}=await supabase.rpc('owner_revoke_manager',{p_user_id:userId});if(error)return alert(error.message);await loadOwnerAccess();}



let videoObserver=null;

function getVideoPlatform(url=''){
  const u=String(url).trim();
  if(/youtu\.be|youtube\.com/i.test(u)) return 'youtube';
  if(/tiktok\.com/i.test(u)) return 'tiktok';
  if(/facebook\.com|fb\.watch/i.test(u)) return 'facebook';
  return 'link';
}
function youtubeId(url=''){
  try{
    const u=new URL(url);
    if(u.hostname.includes('youtu.be')) return u.pathname.split('/').filter(Boolean)[0]||'';
    const shorts=u.pathname.match(/\/shorts\/([^/?#]+)/);
    if(shorts) return shorts[1];
    const embed=u.pathname.match(/\/embed\/([^/?#]+)/);
    if(embed) return embed[1];
    return u.searchParams.get('v')||'';
  }catch{return '';}
}
function tiktokId(url=''){
  const m=String(url).match(/\/video\/(\d+)/);
  return m?m[1]:'';
}
function externalVideoMarkup(v){
  const url=v.source_url||v.video_url||'';
  const type=v.source_type&&v.source_type!=='upload'?v.source_type:getVideoPlatform(url);

  if(type==='youtube'){
    const id=youtubeId(url);
    if(!id) return `<a class="video-link-fallback" href="${esc(url)}" target="_blank" rel="noopener">Mở video YouTube ↗</a>`;
    const src=`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&mute=1&loop=1&playlist=${encodeURIComponent(id)}&playsinline=1&controls=1&rel=0`;
    return `<iframe class="tby-embed tby-external-video" data-src="${esc(src)}" title="${esc(v.title||'Video TBY')}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
  }

  if(type==='tiktok'){
    const id=tiktokId(url);
    if(!id) return `<a class="video-link-fallback" href="${esc(url)}" target="_blank" rel="noopener">Mở video TikTok ↗</a>`;
    const src=`https://www.tiktok.com/player/v1/${encodeURIComponent(id)}?autoplay=1&loop=1&music_info=1&description=1`;
    return `<iframe class="tby-embed tby-external-video" data-src="${esc(src)}" title="${esc(v.title||'Video TBY')}" allow="autoplay; encrypted-media" allowfullscreen loading="lazy"></iframe>`;
  }

  if(type==='facebook'){
    const src=`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=true&mute=true`;
    return `<iframe class="tby-embed tby-external-video" data-src="${esc(src)}" title="${esc(v.title||'Video TBY')}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
  }

  return `<a class="video-link-fallback" href="${esc(url)}" target="_blank" rel="noopener">Mở video ↗</a>`;
}

function setupVideoAutoplay(){
  if(videoObserver)videoObserver.disconnect();
  const media=[...document.querySelectorAll('.tby-video,.tby-external-video')];
  if(!('IntersectionObserver' in window)) {
    document.querySelectorAll('.tby-external-video[data-src]').forEach(f=>{ if(!f.src) f.src=f.dataset.src; });
    return;
  }

  videoObserver=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      const el=entry.target;
      const active=entry.isIntersecting && entry.intersectionRatio>=0.62;

      if(el.tagName==='VIDEO'){
        if(active){
          document.querySelectorAll('.tby-video').forEach(other=>{if(other!==el)other.pause();});
          el.play().catch(()=>{});
        } else el.pause();
      } else if(el.tagName==='IFRAME'){
        // Chỉ nạp embed khi người dùng cuộn gần tới để giảm tải.
        if(active && !el.src && el.dataset.src) el.src=el.dataset.src;
      }
    });
  },{threshold:[0,.62,1]});

  media.forEach(v=>videoObserver.observe(v));
}

function publicVideoCard(v){
  const type=v.source_type||'upload';
  const media=type==='upload'
    ? `<video class="tby-video" src="${esc(v.video_url)}" muted loop playsinline preload="metadata"></video><button type="button" class="video-sound" data-video-sound>🔇 Bật tiếng</button>`
    : externalVideoMarkup(v);
  const badge=type==='upload'?'TBY':type.toUpperCase();
  return `<article class="video-card">
    <div class="video-frame">${media}<span class="video-source-badge">${esc(badge)}</span></div>
    <h3>${esc(v.title||'TBY')}</h3>
  </article>`;
}

async function loadTeamVideos(){
  const root=$('#videoFeed');if(!root||!supabase)return;
  root.innerHTML='<div class="empty-card">Đang tải video…</div>';
  const {data,error}=await supabase.from('team_videos').select('*').eq('is_visible',true).order('sort_order').order('created_at',{ascending:false});
  if(error){root.innerHTML=`<div class="empty-card">${esc(error.message)}</div>`;return;}
  if(!data?.length){root.innerHTML='<div class="empty-card">Chưa có video TBY.</div>';return;}
  root.innerHTML=data.map(publicVideoCard).join('');
  root.querySelectorAll('[data-video-sound]').forEach(btn=>btn.addEventListener('click',()=>{
    const v=btn.parentElement.querySelector('video');
    v.muted=!v.muted;
    btn.textContent=v.muted?'🔇 Bật tiếng':'🔊 Tắt tiếng';
    if(v.paused)v.play().catch(()=>{});
  }));
  setupVideoAutoplay();
}

function adminVideoPreview(v){
  const type=v.source_type||'upload';
  if(type==='upload') return `<video src="${esc(v.video_url)}" muted playsinline preload="metadata"></video>`;
  const label=type==='youtube'?'YouTube':type==='tiktok'?'TikTok':type==='facebook'?'Facebook':'Link';
  return `<div class="video-platform-preview">${esc(label)}</div>`;
}
async function loadAdminVideos(){
  if(currentAdminRole!=='owner')return;
  const root=$('#videoAdminList');root.innerHTML='<div class="admin-empty">Đang tải video…</div>';
  const {data,error}=await supabase.from('team_videos').select('*').order('sort_order').order('created_at',{ascending:false});
  if(error){root.innerHTML=`<div class="admin-empty">${esc(error.message)}</div>`;return;}
  if(!data?.length){root.innerHTML='<div class="admin-empty">Chưa có video.</div>';return;}
  root.innerHTML=data.map(v=>{
    const type=v.source_type||'upload';
    const srcLabel=type==='upload'?'Upload':type==='youtube'?'YouTube':type==='tiktok'?'TikTok':type==='facebook'?'Facebook':'Link';
    return `<article class="admin-event-item video-admin-row">
      <div class="video-admin-preview">${adminVideoPreview(v)}</div>
      <div class="who"><strong>${esc(v.title||'Video TBY')}</strong><span>${esc(srcLabel)} · ${v.is_visible?'Đang hiển thị':'Đang ẩn'} · ${new Date(v.created_at).toLocaleString('vi-VN')}</span></div>
      <div class="manager-actions">
        <button class="btn btn-ghost btn-sm" data-video-toggle="${v.id}" data-visible="${!!v.is_visible}">${v.is_visible?'Ẩn video':'Hiện video'}</button>
        <button class="btn btn-danger btn-sm" data-video-delete="${v.id}" data-url="${esc(v.video_url||'')}" data-type="${esc(type)}">Xóa</button>
      </div>
    </article>`;
  }).join('');
  root.querySelectorAll('[data-video-toggle]').forEach(b=>b.addEventListener('click',()=>toggleVideoVisibility(b.dataset.videoToggle,b.dataset.visible==='true')));
  root.querySelectorAll('[data-video-delete]').forEach(b=>b.addEventListener('click',()=>deleteTeamVideo(b.dataset.videoDelete,b.dataset.url,b.dataset.type)));
}

$('#videoAdminRefreshBtn').addEventListener('click',loadAdminVideos);

const videoSourceType=$('#videoSourceType');
if(videoSourceType){
  videoSourceType.addEventListener('change',()=>{
    const useLink=videoSourceType.value==='link';
    $('#videoFileWrap').hidden=useLink;
    $('#videoLinkWrap').hidden=!useLink;
    $('#videoFile').required=!useLink;
    $('#videoLink').required=useLink;
  });
}

$('#videoUploadForm').addEventListener('submit',async ev=>{
  ev.preventDefault();
  if(currentAdminRole!=='owner')return alert('Chỉ Owner được thêm video.');

  const mode=$('#videoSourceType')?.value||'upload';
  const file=$('#videoFile').files[0];
  const link=$('#videoLink')?.value.trim()||'';
  const m=$('#videoAdminMsg'),btn=$('#videoUploadBtn');

  if(mode==='upload'&&!file){m.className='form-msg err';m.textContent='Hãy chọn file video.';return;}
  if(mode==='link'&&!link){m.className='form-msg err';m.textContent='Hãy dán link video.';return;}
  if(file&&file.size>50*1024*1024){m.className='form-msg err';m.textContent='Video vượt quá 50 MB.';return;}

  btn.disabled=true;btn.textContent='Đang thêm…';m.className='form-msg';

  try{
    let row={
      title:$('#videoTitle').value.trim()||'Video TBY',
      is_visible:$('#videoVisible').checked,
      source_type:'upload',
      source_url:null,
      video_url:''
    };

    if(mode==='upload'){
      m.textContent='Đang tải video lên Supabase…';
      const url=await uploadMedia(file,`videos/${crypto.randomUUID?crypto.randomUUID():Date.now()}`);
      row.video_url=url;
      row.source_type='upload';
    }else{
      const platform=getVideoPlatform(link);
      if(!['youtube','tiktok','facebook'].includes(platform)){
        throw new Error('Hiện hỗ trợ link YouTube, TikTok hoặc Facebook.');
      }
      row.source_type=platform;
      row.source_url=link;
      // Giữ video_url có giá trị để tương thích schema cũ NOT NULL.
      row.video_url=link;
      m.textContent=`Đang thêm link ${platform}…`;
    }

    const {error}=await supabase.from('team_videos').insert(row);
    if(error){
      if(mode==='upload'&&row.video_url) await removeMediaUrl(row.video_url);
      throw error;
    }

    ev.target.reset();
    $('#videoVisible').checked=true;
    if(videoSourceType){
      videoSourceType.value='upload';
      videoSourceType.dispatchEvent(new Event('change'));
    }
    m.className='form-msg ok';m.textContent='Đã thêm video.';
    await Promise.all([loadTeamVideos(),loadAdminVideos()]);
  }catch(err){m.className='form-msg err';m.textContent=err.message||String(err);}

  btn.disabled=false;btn.textContent='Thêm video';
});

async function toggleVideoVisibility(id,isVisible){
  if(currentAdminRole!=='owner')return;
  const {error}=await supabase.from('team_videos').update({is_visible:!isVisible,updated_at:new Date().toISOString()}).eq('id',id);
  if(error)return alert(error.message);
  await Promise.all([loadTeamVideos(),loadAdminVideos()]);
}
async function deleteTeamVideo(id,url,type='upload'){
  if(currentAdminRole!=='owner'||!confirm('Xóa video này khỏi TBY?'))return;
  const {error}=await supabase.from('team_videos').delete().eq('id',id);
  if(error)return alert(error.message);
  if(type==='upload'&&url) await removeMediaUrl(url);
  await Promise.all([loadTeamVideos(),loadAdminVideos()]);
}

async function populateSettingsForm(){await loadSiteSettings();const s=currentSettings||fallbackSettings;$('#sHeroTitle').value=s.hero_title||'';$('#sHeroSubtitle').value=s.hero_subtitle||'';$('#sRules').value=s.rules_text||'';$('#sTikTok').value=s.tiktok_url||'';$('#sYouTube').value=s.youtube_url||'';$('#sFacebook').value=s.facebook_url||'';$('#sZalo').value=s.zalo_url||'';}
$('#siteSettingsForm').addEventListener('submit',async ev=>{ev.preventDefault();if(currentAdminRole!=='owner')return alert('Chỉ Owner được chỉnh giao diện website.');const m=$('#siteSettingsMsg');m.textContent='Đang lưu…';m.className='form-msg';try{let s={...(currentSettings||fallbackSettings),hero_title:$('#sHeroTitle').value.trim(),hero_subtitle:$('#sHeroSubtitle').value.trim(),rules_text:$('#sRules').value.trim(),tiktok_url:$('#sTikTok').value.trim(),youtube_url:$('#sYouTube').value.trim(),facebook_url:$('#sFacebook').value.trim(),zalo_url:$('#sZalo').value.trim()};const files=[['sLogoFile','logo_url','site/logo'],['sHeroFile','hero_image_url','site/hero'],['sBackgroundFile','background_image_url','site/background']];for(const [input,key,path] of files){const f=$(`#${input}`).files[0];if(f){if(s[key])await removeMediaUrl(s[key]);s[key]=await uploadMedia(f,`${path}-${Date.now()}`);}}const {error}=await supabase.from('site_settings').upsert({id:1,...s,updated_at:new Date().toISOString()});if(error)throw error;m.className='form-msg ok';m.textContent='Đã cập nhật website.';currentSettings=s;applySettings(s);ev.target.querySelectorAll('input[type=file]').forEach(x=>x.value='');}catch(err){m.className='form-msg err';m.textContent=err.message||String(err);}});

await recoverMobileAuthSession();
await Promise.all([loadSiteSettings(),loadEvents(),loadTeamVideos()]);


document.getElementById('ownerPasswordForm')?.addEventListener('submit',async ev=>{
  ev.preventDefault();
  const m=document.getElementById('ownerPasswordMsg');
  const p1=document.getElementById('ownerNewPassword')?.value||'';
  const p2=document.getElementById('ownerNewPassword2')?.value||'';

  if(currentAdminRole!=='owner'){
    m.className='form-msg err';
    m.textContent='Chỉ Owner được đổi mật khẩu tại đây.';
    return;
  }
  if(p1.length<6){
    m.className='form-msg err';
    m.textContent='Mật khẩu cần ít nhất 6 ký tự.';
    return;
  }
  if(p1!==p2){
    m.className='form-msg err';
    m.textContent='Hai mật khẩu chưa giống nhau.';
    return;
  }

  m.className='form-msg';
  m.textContent='Đang lưu mật khẩu…';

  const {error}=await supabase.auth.updateUser({password:p1});
  if(error){
    m.className='form-msg err';
    m.textContent=error.message||'Không đổi được mật khẩu.';
    return;
  }

  document.getElementById('ownerNewPassword').value='';
  document.getElementById('ownerNewPassword2').value='';
  m.className='form-msg ok';
  m.textContent='Đã đặt mật khẩu mới. Từ giờ bạn có thể đăng nhập bằng email + mật khẩu trên điện thoại và PC.';
});









function lookupResultCard(x){
  const court=x.court_number
    ? `<div class="lookup-court-number"><span>SÂN SỐ</span><strong>${esc(x.court_number)}</strong></div>`
    : `<div class="lookup-court-number"><span>SÂN SỐ</span><strong>Liên hệ quản lý</strong></div>`;
  return `<article class="lookup-result-card">
    <div class="lookup-status">✅ ĐÃ ĐĂNG KÝ</div>
    <h3>${esc(x.title||'Kèo TBY')}</h3>
    <div class="lookup-row"><span>👤 Người đăng ký</span><b>${esc(x.full_name||'')}</b></div>
    <div class="lookup-row"><span>🏸 Sân</span><b>${esc(x.venue||'')}</b></div>
    <div class="lookup-row"><span>📍 Địa chỉ</span><b>${esc(x.venue_address||'')}</b></div>
    <div class="lookup-row"><span>📅 Ngày</span><b>${esc(x.event_date?fmtDate(x.event_date):'')}</b></div>
    <div class="lookup-row"><span>🕒 Giờ</span><b>${esc((x.start_time||'').slice(0,5))} – ${esc((x.end_time||'').slice(0,5))}</b></div>
    ${court}
  </article>`;
}
async function lookupRegistration(){
  const q=$('#registrationLookupInput')?.value.trim()||'';
  const msg=$('#registrationLookupMsg'),root=$('#registrationLookupResults');
  if(!q){msg.className='form-msg err';msg.textContent='Nhập tên đăng ký hoặc SĐT/Zalo.';root.innerHTML='';return;}
  msg.className='form-msg';msg.textContent='Đang tra cứu…';root.innerHTML='';
  const {data,error}=await supabase.rpc('lookup_registration_court',{p_query:q});
  if(error){msg.className='form-msg err';msg.textContent=error.message;return;}
  const rows=Array.isArray(data)?data:(data?[data]:[]);
  if(!rows.length){msg.className='form-msg err';msg.textContent='Không tìm thấy đăng ký phù hợp.';return;}
  msg.className='form-msg ok';msg.textContent=`Tìm thấy ${rows.length} đăng ký.`;
  root.innerHTML=rows.map(lookupResultCard).join('');
}
$('#registrationLookupBtn')?.addEventListener('click',lookupRegistration);
$('#registrationLookupInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')lookupRegistration();});



$('#successHomeBtn')?.addEventListener('click',()=>{
  const d=$('#registrationSuccessDialog');
  if(d?.open)d.close();
  window.scrollTo({top:0,behavior:'smooth'});
});
$('#successLookupBtn')?.addEventListener('click',()=>{
  const d=$('#registrationSuccessDialog');
  if(d?.open)d.close();
  document.querySelector('#tra-cuu-dang-ky')?.scrollIntoView({behavior:'smooth',block:'start'});
});



// Admin chỉ mở khi người dùng bấm nút Admin.
window.addEventListener('pageshow', () => {
  const dlg = document.getElementById('adminDialog');
  if (dlg?.open) dlg.close();
});

