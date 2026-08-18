const $=id=>document.getElementById(id);let leads=[],customers={},spends=[],session=null,editId=null,addingNew=false;
const fmtRp=n=>'Rp'+new Intl.NumberFormat('id-ID',{maximumFractionDigits:0}).format(Number(n||0));
const fmtDate=s=>s?new Date(s).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}):'-';
const dOnly=s=>s?new Date(s).toLocaleDateString('id-ID',{dateStyle:'medium'}):'-';
const statusName={new:'Baru',replied:'Sudah Dibalas',follow_up:'Follow Up',deal:'Deal',lost:'Tidak Deal'};
const chName={instagram_lama:'IG Lama',instagram_baru:'IG Baru',tiktok:'TikTok',walk_in:'Walk-in'};
const entryName={dm_organic:'DM Organik',ads:'Iklan',dm_tiktok:'DM TikTok',walk_in:'Datang Langsung'};
const reasonName={harga:'Harga',lokasi:'Lokasi',hanya_tanya:'Hanya bertanya',tidak_membalas:'Tidak membalas',jadwal:'Jadwal tidak cocok',slot_penuh:'Slot penuh',treatment_tidak_tersedia:'Treatment tidak tersedia',therapist_tidak_tersedia:'Therapist tidak tersedia',memilih_tempat_lain:'Memilih tempat lain',promo_tidak_cocok:'Promo tidak cocok',batal_datang:'Batal datang',lainnya:'Lainnya'};
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function normalizePhone(v){let x=(v||'').replace(/\D/g,'');if(x.startsWith('0'))x='62'+x.slice(1);if(x&&!x.startsWith('62'))x='62'+x;return x||null}
function sourceLabel(l){return `${chName[l.channel]||l.channel}${l.entry_type==='ads'?' Ads':l.entry_type==='dm_organic'?' Organic':''}`}
function destinationFor(ch){return ch==='instagram_lama'?'A':(ch==='instagram_baru'||ch==='tiktok')?'B':null}
function entryOptions(ch,selected){let opts=ch==='tiktok'?[['dm_tiktok','DM TikTok']]:ch==='walk_in'?[['walk_in','Datang Langsung']]:[['dm_organic','DM Organik'],['ads','Iklan']];return opts.map(([v,n])=>`<option value="${v}" ${v===selected?'selected':''}>${n}</option>`).join('')}
function channelOptions(selected){return Object.entries(chName).map(([v,n])=>`<option value="${v}" ${v===selected?'selected':''}>${n}</option>`).join('')}
function statusOptions(selected){return Object.entries(statusName).map(([v,n])=>`<option value="${v}" ${v===selected?'selected':''}>${n}</option>`).join('')}
function reasonOptions(selected){return `<option value="">Pilih alasan</option>`+Object.entries(reasonName).map(([v,n])=>`<option value="${v}" ${v===selected?'selected':''}>${n}</option>`).join('')}
function localDateTimeValue(s){if(!s)return'';const d=new Date(s);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
function dateRange(){let f=$('dashFrom').value,t=$('dashTo').value;return{from:f?new Date(f+'T00:00:00+07:00'):null,to:t?new Date(t+'T23:59:59+07:00'):null}}
function filteredPeriod(){const{from,to}=dateRange();return leads.filter(l=>(!from||new Date(l.lead_at)>=from)&&(!to||new Date(l.lead_at)<=to))}
