(function(){
const C=window.GRADER_CONFIG||{};
const on=!!(C.SUPABASE_URL&&C.SUPABASE_ANON_KEY&&!/YOUR_/.test(C.SUPABASE_URL)&&window.supabase);
window.Cloud={on,saveResult(){}};
if(!on)return; // walang config: gumagana pa rin ang app nang walang login
const sb=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id);
const st=document.createElement('style');
st.textContent='#auth{position:fixed;inset:0;z-index:50;background:var(--bg);overflow:auto;padding:24px 16px}#auth .card{max-width:420px;margin:8vh auto 0}#auth .sw{background:none;border:0;color:var(--pri);font-weight:700;text-decoration:underline;width:100%;padding:12px 0 0}#auth input{margin-bottom:10px}';
document.head.appendChild(st);
const box=document.createElement('div');box.id='auth';box.hidden=true;
box.innerHTML=`<div class="card"><h1 id="aT">Mag-login</h1><p class="mut">Mag-login para magamit ang Grader.</p>
<div id="aS" hidden><input id="aN" placeholder="Buong pangalan"><input id="aSc" placeholder="Paaralan"></div>
<input id="aE" type="email" placeholder="Email" autocomplete="email"><input id="aP" type="password" placeholder="Password (6+ karakter)" autocomplete="current-password">
<p id="aM" class="warn"></p><button class="btn" id="aB" style="width:100%">Mag-login</button><button class="sw" id="aW">Wala pang account? Mag-sign up</button></div>`;
document.body.appendChild(box);
let up=false;
function mode(){$('aT').textContent=up?'Gumawa ng account':'Mag-login';$('aS').hidden=!up;$('aB').textContent=up?'Mag-sign up':'Mag-login';$('aW').textContent=up?'May account na? Mag-login':'Wala pang account? Mag-sign up';$('aM').textContent=''}
$('aW').onclick=()=>{up=!up;mode()};
$('aB').onclick=async()=>{
 const email=$('aE').value.trim(),password=$('aP').value;$('aM').textContent='';
 if(!email||password.length<6){$('aM').textContent='Ilagay ang email at password (6+ karakter).';return}
 const r=up?await sb.auth.signUp({email,password,options:{data:{full_name:$('aN').value.trim(),school:$('aSc').value.trim()}}})
          :await sb.auth.signInWithPassword({email,password});
 if(r.error){$('aM').textContent=r.error.message;return}
 if(up&&!r.data.session){up=false;mode();$('aM').textContent='Tingnan ang email mo para i-confirm ang account, tapos mag-login.'}};
async function gate(s){box.hidden=!!s;if(s){try{await sb.rpc('touch')}catch(e){}}}
sb.auth.getSession().then(({data})=>gate(data.session));
sb.auth.onAuthStateChange((_e,s)=>gate(s));
const h=document.querySelector('.top>div');
if(h){const b=document.createElement('button');b.textContent='Logout';
 b.style.cssText='margin-left:auto;background:none;border:1px solid currentColor;color:inherit;border-radius:10px;padding:6px 10px;font:inherit;font-size:13px;cursor:pointer';
 b.onclick=()=>sb.auth.signOut();h.appendChild(b)}
window.Cloud.saveResult=async r=>{try{
 await sb.from('results').insert({exam_type:r.ex,exam_title:r.ti,student_id:r.id,student_name:r.name,score:r.s,total:r.t,answers:r.a});
 await sb.rpc('bump_scan')}catch(e){}};
})();
