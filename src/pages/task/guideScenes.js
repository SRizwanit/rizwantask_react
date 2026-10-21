/* গাইডের অ্যানিমেশন (Remotion-স্টাইল: ফ্রেম-ভিত্তিক ভেক্টর/SVG) — Task.logic.js থেকে লজিক অপরিবর্তিত।
   এখানে শুধু প্লেয়ারটি রিয়্যাক্টের উপযোগী করা হয়েছে: ধাপ-তালিকার `.on` ক্লাস নিজে না ঘেঁটে `onPhase(ph)` কলব্যাক ডাকে
   (ph = সক্রিয় ধাপের নম্বর, কমানো-মোশনে 'all')। */
/* eslint-disable */
import { IMG } from './guideImages.js';

// ================= গাইডের অ্যানিমেশন (Remotion-স্টাইল: ফ্রেম-ভিত্তিক ভেক্টর/SVG) =================
// প্রতিটি দৃশ্য (composition) = দৈর্ঘ্য (ফ্রেম) + frame→SVG ফাংশন; interpolate/spring Remotion-এর মতোই কাজ করে।
const FPS=30;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const E={lin:t=>t,out:t=>1-Math.pow(1-t,3),inOut:t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2};
function interpolate(f,inR,outR,ease){
  const n=inR.length;
  if(f<=inR[0])return outR[0]; if(f>=inR[n-1])return outR[n-1];
  let i=0; while(i<n-2&&f>inR[i+1])i++;
  let t=(f-inR[i])/((inR[i+1]-inR[i])||1); if(ease)t=ease(t);
  return outR[i]+(outR[i+1]-outR[i])*t;
}
function spring(f,o){
  o=o||{}; const k=o.stiffness||110,c=o.damping||11,m=o.mass||1, t=Math.max(0,f)/FPS;
  const w0=Math.sqrt(k/m), z=c/(2*Math.sqrt(k*m));
  if(z<1){const wd=w0*Math.sqrt(1-z*z); return 1-Math.exp(-z*w0*t)*(Math.cos(wd*t)+(z*w0/wd)*Math.sin(wd*t));}
  return 1-Math.exp(-w0*t)*(1+w0*t);
}
const bd=s=>String(s).replace(/\d/g,d=>'০১২৩৪৫৬৭৮৯'[d]);
const setA=(el,o)=>{ if(el)for(const k in o)el.setAttribute(k,o[k]); };
const tf=(el,x,y,s,r)=>{ if(el)el.setAttribute('transform','translate('+x+' '+y+') rotate('+(r||0)+') scale('+(s==null?1:s)+')'); };
const FONT="font-family=\"'Anek Bangla','Noto Serif Bengali',sans-serif\"";
const fadeIO=(f,dur)=>interpolate(f,[0,8],[0,1])*interpolate(f,[dur-10,dur],[1,0]);

// আঙুলের স্পর্শ (touch dot + ripple) — ভেক্টর দৃশ্যে ব্যবহার
const touchSvg=r=>'<circle id="gRp" r="'+r+'" fill="none" stroke="#fff" stroke-width="2.4" opacity="0"/><g id="gDot" opacity="0"><circle r="'+r*.55+'" fill="rgba(255,255,255,.92)" stroke="#0b5f4c" stroke-width="2"/><circle r="'+r*.18+'" fill="#0b5f4c"/></g>';
function touch(q,f,P,op){
  const m=interpolate(f,[P.t0,P.t1],[0,1],E.inOut);
  const x=P.from[0]+(P.to[0]-P.from[0])*m, y=P.from[1]+(P.to[1]-P.from[1])*m;
  const s=interpolate(f,[P.tp,P.tp+4,P.tp+9],[1,.78,1]);
  tf(q('gDot'),x,y,s); q('gDot').setAttribute('opacity',op*interpolate(f,[P.t0-6,P.t0],[0,1]));
  const rf=interpolate(f,[P.tp+2,P.tp+28],[0,1],E.out), rp=q('gRp');
  setA(rp,{cx:P.to[0],cy:P.to[1],r:P.r*(.5+2.2*rf),opacity:f>=P.tp+2?(1-rf)*.9*op:0});
}

/* ---------- স্ক্রিনশট-ভিত্তিক দৃশ্য: স্পটলাইট + রিং + নম্বর ব্যাজ + আঙুল ---------- */
function shotScene(key,W,H,T,opt){
  opt=opt||{};
  const D=opt.D||74, n=T.length, total=n*D+34, sw=W/120, pad=W/90, R=W/32;
  const svg='<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" '+FONT+'>'
   +'<image href="'+IMG[key]+'" width="'+W+'" height="'+H+'" preserveAspectRatio="none"/>'
   +(opt.swap?'<image id="gI2" href="'+IMG[opt.swap.key]+'" width="'+W+'" height="'+H+'" preserveAspectRatio="none" opacity="0"/>':'')
   +'<defs><mask id="gmk" maskUnits="userSpaceOnUse" x="0" y="0" width="'+W+'" height="'+H+'"><rect width="'+W+'" height="'+H+'" fill="#fff"/><rect id="gHole" fill="#000"/></mask></defs>'
   +'<rect id="gDim" width="'+W+'" height="'+H+'" fill="#03231b" mask="url(#gmk)" opacity="0"/>'
   +'<rect id="gRing" fill="none" stroke="#f2d27a" stroke-width="'+sw+'"/>'
   +'<g id="gBd" opacity="0"><circle r="'+R*.62+'" fill="#f2d27a" stroke="#4a3200" stroke-width="'+sw*.4+'"/><text id="gBn" text-anchor="middle" dominant-baseline="central" font-size="'+R*.8+'" font-weight="700" fill="#4a3200"></text></g>'
   +'<circle id="gRp" fill="none" stroke="#fff" stroke-width="'+sw*1.2+'" opacity="0"/>'
   +'<g id="gDot" opacity="0"><circle r="'+R*.55+'" fill="rgba(255,255,255,.92)" stroke="#0b5f4c" stroke-width="'+sw*.8+'"/><circle r="'+R*.18+'" fill="#0b5f4c"/></g>'
   +'</svg>';
  return {svg,dur:total,mount:q=>{
    const hole=q('gHole'),dim=q('gDim'),ring=q('gRing'),bdg=q('gBd'),bnT=q('gBn'),rp=q('gRp'),dot=q('gDot'),i2=q('gI2');
    let lastI=-1;
    return f=>{
      const idx=Math.min(n-1,Math.floor(f/D)), lf=f-idx*D, c=T[idx];
      const pv=idx?T[idx-1]:{x:c.x-W*.04,y:c.y-W*.04,w:c.w+W*.08,h:c.h+W*.08};
      const m=interpolate(lf,[0,16],[0,1],E.inOut), L=k=>pv[k]+(c[k]-pv[k])*m;
      const x=L('x')-pad,y=L('y')-pad,w=L('w')+2*pad,h=L('h')+2*pad,rx=Math.min(w,h)*.28;
      const op=interpolate(f,[0,10],[0,1])*interpolate(f,[total-12,total],[1,0]);
      setA(hole,{x,y,width:w,height:h,rx}); setA(ring,{x,y,width:w,height:h,rx,opacity:op*(.78+.22*Math.sin(f*.28))});
      dim.setAttribute('opacity',.62*op);
      if(lastI!==idx){bnT.textContent=bd(idx+1);lastI=idx;}
      tf(bdg,x+rx*.2,y+rx*.2,Math.max(0,spring(lf-6,{damping:9,stiffness:170}))); bdg.setAttribute('opacity',op);
      const ctr=k=>[k.x+k.w*.62,k.y+k.h*.7], cc=ctr(c), pc=idx?ctr(T[idx-1]):[cc[0]+W*.22,cc[1]+H*.9];   // আঙুল টার্গেটের কোণায়, যাতে আইকন ঢাকা না পড়ে
      const dm=interpolate(lf,[0,18],[0,1],E.inOut);
      tf(dot,pc[0]+(cc[0]-pc[0])*dm,pc[1]+(cc[1]-pc[1])*dm,interpolate(lf,[18,22,27],[1,.78,1]));
      dot.setAttribute('opacity',op);
      const rf=interpolate(lf,[20,46],[0,1],E.out);
      setA(rp,{cx:cc[0],cy:cc[1],r:R*(.5+2.2*rf),opacity:lf>=20?(1-rf)*.9*op:0});
      if(i2){const s=opt.swap.at; i2.setAttribute('opacity',idx>s?1:idx===s?interpolate(lf,[24,38],[0,1]):0);}
      return idx;
    };
  }};
}

/* ---------- ভেক্টর দৃশ্য ১: স্বাগতম ---------- */
function sceneWelcome(){
  const stars=[[40,30],[90,72],[150,24],[250,42],[372,112],[60,150],[340,172],[300,18],[120,160]].map((s,i)=>'<circle id="gs'+i+'" cx="'+s[0]+'" cy="'+s[1]+'" r="'+(1.5+(i%3)*.55)+'" fill="#f7e2a0"/>').join('');
  const lines=[0,1,2,3].map(i=>'<rect id="gl'+i+'" x="-68" y="'+(-20+i*13)+'" height="4" rx="2" fill="#0b5f4c" opacity=".38" width="0"/><rect id="gr'+i+'" x="16" y="'+(-20+i*13)+'" height="4" rx="2" fill="#0b5f4c" opacity=".38" width="0"/>').join('');
  const svg='<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg" '+FONT+'>'
   +'<defs><linearGradient id="gbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a4f40"/><stop offset="1" stop-color="#16a583"/></linearGradient>'
   +'<mask id="gmn"><rect x="280" y="0" width="120" height="100" fill="#fff"/><circle cx="347" cy="38" r="17" fill="#000"/></mask></defs>'
   +'<rect width="400" height="200" fill="url(#gbg)"/><g id="gR">'+stars
   +'<circle cx="338" cy="46" r="21" fill="#f2d27a" mask="url(#gmn)"/>'
   +'<g id="gBk"><rect x="-92" y="-44" width="184" height="86" rx="10" fill="#073b30"/>'
   +'<path d="M-4 -36C-28 -44-60 -42-84 -34V38C-60 30-28 28-4 36Z" fill="#fff"/><path d="M4 -36C28 -44 60 -42 84 -34V38C60 30 28 28 4 36Z" fill="#f8f3e3"/>'
   +'<rect x="-1.5" y="-36" width="3" height="72" fill="#c9972b"/>'+lines+'</g>'
   +'<g id="gCk"><circle r="17" fill="#f2d27a" stroke="#fff" stroke-width="3"/><path d="M-7 0L-2 6L8-5" fill="none" stroke="#4a3200" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></g>'
   +'</g></svg>';
  const dur=150;
  return {svg,dur,mount:q=>{
    const R=q('gR'),bk=q('gBk'),ck=q('gCk');
    return f=>{
      const s=.55+.45*spring(f,{damping:10,stiffness:90});
      tf(bk,200,112+Math.sin(f/14)*3,s);
      for(let i=0;i<4;i++){const w=interpolate(f,[24+i*9,42+i*9],[0,52-(i%2)*16]); q('gl'+i).setAttribute('width',w); q('gr'+i).setAttribute('width',w*.92);}
      for(let i=0;i<9;i++)q('gs'+i).setAttribute('opacity',.3+.7*(.5+.5*Math.sin(f/7+i*1.7)));
      tf(ck,262,66,Math.max(0,spring(f-58,{damping:8,stiffness:140})));
      R.setAttribute('opacity',fadeIO(f,dur));
    };
  }};
}

/* ---------- ভেক্টর দৃশ্য ২: কিতাব বেছে নেওয়া ---------- */
function sceneBook(){
  const cols=['#0b5f4c','#a8761f','#2c6e8f'], CX=[80,200,320];
  const cards=CX.map((x,i)=>'<g id="gc'+i+'"><rect x="-52" y="-72" width="104" height="144" rx="11" fill="#fff" stroke="#cfe3dc"/>'
   +'<rect x="-44" y="-64" width="88" height="62" rx="7" fill="'+cols[i]+'"/><path d="M-14 -46h28v30h-28z" fill="none" stroke="#f7e2a0" stroke-width="2.4" stroke-linejoin="round"/><path d="M0 -46v30" stroke="#f7e2a0" stroke-width="2.4"/>'
   +'<rect x="-44" y="6" width="78" height="6" rx="3" fill="#cfd8d4"/><rect x="-44" y="18" width="52" height="5" rx="2.5" fill="#e3eae7"/>'
   +'<rect x="-44" y="36" width="88" height="7" rx="3.5" fill="#dfeae6"/><rect id="gp'+i+'" x="-44" y="36" width="0" height="7" rx="3.5" fill="#16a583"/>'
   +'<rect x="-44" y="50" width="60" height="5" rx="2.5" fill="#e3b94f" opacity=".75"/></g>').join('');
  const svg='<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg" '+FONT+'>'
   +'<rect width="400" height="200" fill="#e8f4ef"/><g id="gR">'+cards
   +'<rect id="gSel" x="-56" y="-76" width="112" height="152" rx="14" fill="none" stroke="#f2d27a" stroke-width="3.5" opacity="0"/>'
   +'<g id="gBn" opacity="0"><rect x="100" y="176" width="200" height="20" rx="10" fill="#f2d27a"/><text x="200" y="186.5" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="700" fill="#4a3200">কিতাব খুলছে…</text></g>'
   +touchSvg(20)+'</g></svg>';
  const dur=140, pr=[.62,.35,.8];
  return {svg,dur,mount:q=>{
    const R=q('gR'),sel=q('gSel'),bn=q('gBn');
    return f=>{
      const op=fadeIO(f,dur), lift=spring(f-58,{damping:9,stiffness:160});
      for(let i=0;i<3;i++){
        q('gp'+i).setAttribute('width',interpolate(f,[8+i*4,44+i*4],[0,88*pr[i]],E.out));
        const sc=i===1?1+.07*Math.max(0,lift):1;
        tf(q('gc'+i),CX[i],98-(i===1?6*Math.max(0,lift):0),sc);
      }
      tf(sel,CX[1],92-0,1+.07*Math.max(0,lift)); sel.setAttribute('opacity',f>=58?Math.min(1,(f-58)/6):0);
      bn.setAttribute('opacity',interpolate(f,[74,84],[0,1]));
      touch(q,f,{from:[350,196],to:[200,84],t0:28,t1:52,tp:56,r:20},op);
      R.setAttribute('opacity',op);
    };
  }};
}

/* ---------- ভেক্টর দৃশ্য ৩: রিভিউ, আয় ও পেমেন্ট রিকোয়েস্ট ---------- */
function sceneEarn(){
  const rows=[{y:14,t:'পেইজ ১২',ok:1},{y:64,t:'পেইজ ১৩',ok:1},{y:114,t:'পেইজ ১৪',ok:0}];
  const rs=rows.map((r,i)=>'<g id="gr'+i+'"><rect x="14" y="'+r.y+'" width="184" height="42" rx="10" fill="#fff" stroke="#cfe3dc"/>'
   +'<rect x="27" y="'+(r.y+9)+'" width="17" height="24" rx="3" fill="#e8f1ed" stroke="#9db8af"/><rect x="31" y="'+(r.y+16)+'" width="9" height="2.5" rx="1.2" fill="#9db8af"/><rect x="31" y="'+(r.y+22)+'" width="9" height="2.5" rx="1.2" fill="#9db8af"/>'
   +'<text x="54" y="'+(r.y+21)+'" dominant-baseline="central" font-size="13" font-weight="600" fill="#12372f">'+r.t+'</text>'
   +'<g id="gs'+i+'" opacity="0"><rect x="-33" y="-12" width="66" height="24" rx="6" fill="#fff" stroke="'+(r.ok?'#16a583':'#d64545')+'" stroke-width="2.4"/>'
   +'<text x="0" y="0.5" text-anchor="middle" dominant-baseline="central" font-size="11.5" font-weight="700" fill="'+(r.ok?'#0d7a5f':'#c0392b')+'">'+(r.ok?'অনুমোদিত':'সংশোধন')+'</text></g></g>').join('');
  const coins=[0,1].map(i=>'<g id="gk'+i+'" opacity="0"><circle r="8" fill="#f2d27a" stroke="#a8761f" stroke-width="1.6"/><circle r="4.4" fill="none" stroke="#a8761f" stroke-width="1.2"/></g>').join('');
  const svg='<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg" '+FONT+'>'
   +'<rect width="400" height="200" fill="#eef7f3"/><g id="gR">'+rs
   +'<g id="gW"><rect x="-36" y="-22" width="72" height="46" rx="9" fill="#0b5f4c"/><path d="M-36 -8h72" stroke="#f2d27a" stroke-width="2.2" opacity=".7"/><rect x="12" y="-2" width="24" height="16" rx="6" fill="#0a4f40" stroke="#f2d27a" stroke-width="2"/><circle cx="23" cy="6" r="3.2" fill="#f2d27a"/></g>'
   +'<text id="gAm" x="297" y="112" text-anchor="middle" font-size="25" font-weight="700" fill="#0b4f40">০.০০ ৳</text>'
   +'<text x="297" y="130" text-anchor="middle" font-size="11" fill="#59706a">মোট আয়</text>'
   +'<g id="gBt"><rect id="gBtR" x="-76" y="-18" width="152" height="36" rx="11" fill="#0b5f4c"/><text id="gBtT" x="0" y="1" text-anchor="middle" dominant-baseline="central" font-size="12.5" font-weight="700" fill="#fff">পেমেন্ট রিকোয়েস্ট</text></g>'
   +coins+touchSvg(18)+'</g></svg>';
  const dur=250, ST=[36,62,88], ARR=[70,96];
  return {svg,dur,mount:q=>{
    const R=q('gR'),amt=q('gAm'),W=q('gW'),bt=q('gBt'),btR=q('gBtR'),btT=q('gBtT'); let lastT='';
    return f=>{
      const op=fadeIO(f,dur);
      for(let i=0;i<3;i++){
        const ap=interpolate(f,[6+i*10,20+i*10],[0,1],E.out);
        tf(q('gr'+i),(1-ap)*-30,0,1); q('gr'+i).setAttribute('opacity',ap);
        const sp=spring(f-ST[i],{damping:7,stiffness:220}), g=q('gs'+i);
        tf(g,150,rows[i].y+21,f>=ST[i]?1+.9*(1-Math.min(1,sp)):2,-9); g.setAttribute('opacity',f>=ST[i]?Math.min(1,(f-ST[i])/3):0);
      }
      let earned=0;
      for(let i=0;i<2;i++){
        const t=interpolate(f,[ST[i]+10,ARR[i]],[0,1],E.inOut), c=q('gk'+i);
        const x=205+(297-205)*t, y=rows[i].y+21+(52-rows[i].y-21)*t-34*Math.sin(Math.PI*t);
        tf(c,x,y,1); c.setAttribute('opacity',(f>ST[i]+10&&f<ARR[i])?1:0);
        if(f>=ARR[i])earned+=.2;
      }
      const bump=Math.max(spring(f-ARR[0],{damping:6,stiffness:260}),0), bump2=Math.max(spring(f-ARR[1],{damping:6,stiffness:260}),0);
      tf(W,297,58,1+.1*Math.sin(Math.PI*Math.min(1,bump))*(f<ARR[1]?1:0)+.1*Math.sin(Math.PI*Math.min(1,bump2))*(f>=ARR[1]?1:0));
      amt.textContent=bd(earned.toFixed(2))+' ৳';
      const bp=Math.max(spring(f-140,{damping:11,stiffness:120}),0);
      tf(bt,297,162+(1-Math.min(1,bp))*34,1); bt.setAttribute('opacity',Math.min(1,bp));
      const pressed=f>=186; btR.setAttribute('fill',pressed?'#16a583':'#0b5f4c');
      const tx=pressed?'✓ রিকোয়েস্ট পাঠানো হয়েছে':'পেমেন্ট রিকোয়েস্ট'; if(tx!==lastT){btT.textContent=tx;btT.setAttribute('font-size',pressed?'11':'12.5');lastT=tx;}
      touch(q,f,{from:[392,196],to:[338,170],t0:158,t1:180,tp:184,r:18},op);
      R.setAttribute('opacity',op);
      return f<84?0:f<150?1:2;
    };
  }};
}

/* ---------- ভেক্টর দৃশ্য: দৈনিক লক্ষ্য, টানা দিন ও চালিয়ে যান ---------- */
function sceneGoal(){
  const svg='<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg" '+FONT+'>'
   +'<rect width="400" height="200" fill="#e8f4ef"/><g id="gR">'
   +'<g id="gg0"><rect x="22" y="16" width="176" height="92" rx="14" fill="#fff" stroke="#cfe3dc"/>'
   +'<text x="38" y="40" font-size="12" font-weight="700" fill="#0b5f4c">আজকের লক্ষ্য</text>'
   +'<text id="gNum" x="38" y="74" font-size="28" font-weight="700" fill="#0b5f4c">০</text><text x="72" y="74" font-size="14" fill="#6b7280">/ ২০ পেইজ</text>'
   +'<rect x="38" y="86" width="144" height="8" rx="4" fill="#dfeae6"/><rect id="gBar" x="38" y="86" width="0" height="8" rx="4" fill="#16a583"/></g>'
   +'<g id="gg1"><rect x="212" y="16" width="166" height="92" rx="14" fill="#fff" stroke="#cfe3dc"/>'
   +'<text x="228" y="40" font-size="12" font-weight="700" fill="#a8761f">টানা কাজ</text>'
   +'<text id="gStr" x="228" y="74" font-size="28" font-weight="700" fill="#a8761f">০</text><text x="258" y="74" font-size="14" fill="#6b7280">দিন</text>'
   +[0,1,2].map(i=>'<circle id="gb'+i+'" cx="'+(236+i*28)+'" cy="92" r="7" fill="#dfeae6"/>').join('')+'</g>'
   +'<g id="gg2"><rect x="22" y="124" width="356" height="52" rx="26" fill="#0b5f4c"/><path d="M118 142l14 8-14 8z" fill="#f7e2a0"/>'
   +'<text x="214" y="150.5" text-anchor="middle" dominant-baseline="central" font-size="16" font-weight="700" fill="#f7e2a0">চালিয়ে যান</text></g>'
   +touchSvg(18)+'</g></svg>';
  const dur=180;
  return {svg,dur,mount:q=>{
    const R=q('gR'),bar=q('gBar'),num=q('gNum'),str=q('gStr'),g2=q('gg2');
    return f=>{
      const ph=f<56?0:f<112?1:2, op=fadeIO(f,dur);
      const n=Math.round(interpolate(f,[6,50],[0,14],E.out));
      bar.setAttribute('width',interpolate(f,[6,50],[0,144*14/20],E.out)); num.textContent=bd(n);
      str.textContent=bd(Math.round(interpolate(f,[58,90],[0,7],E.out)));
      for(let i=0;i<3;i++)q('gb'+i).setAttribute('fill',f>74+i*10?'#f2d27a':'#dfeae6');
      const pop=1+.04*Math.max(0,spring(f-114,{damping:8,stiffness:170}));
      tf(g2,200*(1-pop),150*(1-pop),pop);
      touch(q,f,{from:[350,196],to:[250,150],t0:112,t1:136,tp:140,r:18},op);
      R.setAttribute('opacity',op);
      return ph;
    };
  }};
}

/* ---------- ভেক্টর দৃশ্য ৪: র‍্যাংক, নোটিশ, টিকেট, প্রোফাইল ---------- */
function sceneCommunity(){
  const CX=[50,150,250,350], LB=['র‍্যাংক','নোটিশ','টিকেট','প্রোফাইল'];
  const podium='<rect id="gb0" x="-25" width="15" rx="3" fill="#c9d6d1"/><rect id="gb1" x="-7.5" width="15" rx="3" fill="#f2d27a"/><rect id="gb2" x="10" width="15" rx="3" fill="#d9a066"/><circle id="gcr" cx="0" cy="-34" r="6" fill="#f7e2a0" stroke="#a8761f" stroke-width="1.6"/>';
  const bell='<g id="gbl"><path d="M0 -28C-15 -28 -22 -17 -22 -3V12L-30 22H30L22 12V-3C22 -17 15 -28 0 -28Z" fill="#f2d27a" stroke="#a8761f" stroke-width="2"/><circle cx="0" cy="-31" r="3.4" fill="#f2d27a" stroke="#a8761f" stroke-width="1.6"/><circle cx="0" cy="30" r="5" fill="#c9972b"/></g><circle id="gnd" cx="19" cy="-22" r="7" fill="#e5484d" stroke="#fff" stroke-width="2"/>';
  const ticket='<rect x="-36" y="-22" width="72" height="44" rx="9" fill="#f2d27a" stroke="#a8761f" stroke-width="2"/><path d="M14 -20V20" stroke="#a8761f" stroke-width="2" stroke-dasharray="3 3"/><rect x="-26" y="-10" width="32" height="5" rx="2.5" fill="#4a3200" opacity=".7"/><rect x="-26" y="2" width="22" height="5" rx="2.5" fill="#4a3200" opacity=".45"/><circle cx="25" cy="0" r="5" fill="#4a3200" opacity=".6"/>';
  const user='<circle id="gpr" r="26" fill="none" stroke="#f2d27a" stroke-width="2.4" opacity="0"/><circle r="27" fill="#0a4f40" stroke="#f2d27a" stroke-width="3"/><circle cx="0" cy="-7" r="9" fill="#f7e2a0"/><path d="M-16 20C-16 8 16 8 16 20Z" fill="#f7e2a0"/>';
  const bodies=[podium,bell,ticket,user];
  const items=CX.map((x,i)=>'<g id="gi'+i+'"><g>'+bodies[i]+'</g><text x="0" y="62" text-anchor="middle" font-size="13" font-weight="700" fill="#f7e2a0">'+LB[i]+'</text></g>').join('');
  const svg='<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg" '+FONT+'>'
   +'<defs><linearGradient id="gbg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a4f40"/><stop offset="1" stop-color="#127a63"/></linearGradient></defs>'
   +'<rect width="400" height="200" fill="url(#gbg2)"/><g id="gR">'+items+'</g></svg>';
  const dur=190, ST=[6,46,90,134];
  return {svg,dur,mount:q=>{
    const R=q('gR'),gb=[q('gb0'),q('gb1'),q('gb2')],bl=q('gbl'),nd=q('gnd'),pr=q('gpr');
    return f=>{
      const ph=f<44?0:f<88?1:f<132?2:3;
      for(let i=0;i<4;i++){
        const s=Math.max(0,spring(f-ST[i],{damping:9,stiffness:150}));
        const hi=ph===i?1.1:1;
        tf(q('gi'+i),CX[i],88,s*hi); q('gi'+i).setAttribute('opacity',Math.min(1,s*1.2));
      }
      const H=[34,50,24];
      for(let k=0;k<3;k++){const h=interpolate(f,[ST[0]+6+k*6,ST[0]+26+k*6],[0,H[k]],E.out); setA(gb[k],{y:30-h,height:h});}
      const t=Math.max(0,f-ST[1]-6)/FPS, ang=ph===1||f>ST[1]?22*Math.exp(-t*.9)*Math.sin(t*16):0;
      bl.setAttribute('transform','translate(0 -31) rotate('+ang+') translate(0 31)');
      nd.setAttribute('opacity',Math.min(1,Math.max(0,spring(f-ST[1]-14,{damping:7,stiffness:200}))));
      const rf=((f-ST[3])%40)/40; setA(pr,{r:26+16*rf,opacity:f>ST[3]?(1-rf)*.9:0});
      R.setAttribute('opacity',fadeIO(f,dur));
      return ph;
    };
  }};
}

/* ---------- প্লেয়ার ---------- */
let gAnim=null;
export function stopAnim(){ if(gAnim){cancelAnimationFrame(gAnim.id);gAnim=null;} }
export function playScene(sc,stage,onPhase){
  stopAnim(); stage.innerHTML=sc.svg;
  const q=id=>stage.querySelector('#'+id), upd=sc.mount(q); let last=-1;
  const apply=f=>{ const ph=upd(f); if(ph!==undefined&&ph!==last){last=ph;onPhase(ph);} };
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches){ apply(Math.floor(sc.dur*.72)); onPhase('all'); return; }
  const t0=performance.now(); gAnim={id:0};
  const tick=now=>{ apply(Math.floor((now-t0)/1000*FPS)%sc.dur); if(gAnim)gAnim.id=requestAnimationFrame(tick); };
  gAnim.id=requestAnimationFrame(tick);
}

// ================= প্রথমবারের গাইড (ধাপে ধাপে, অ্যানিমেটেড) =================
export const GUIDE=[
  {tag:'স্বাগতম',t:'আসসালামু আলাইকুম, স্বাগতম!',d:'এই অ্যাপে কিতাবের পেইজ এ আই কে দিয়ে টেক্সট করিয়ে, সে টেক্সট দেখে ভুল শুধরে প্রুফ করবেন। কাজের বিনিময়ে প্রতি অনুমোদিত পেইজে নির্দিষ্ট রেটে আয় হবে।',subs:[],sc:sceneWelcome},
  {tag:'শুরুতে',t:'কিতাব বেছে নিন',d:'কিতাবের কার্ডে চাপ দিন। প্রতিটি কার্ডে রেট ও অগ্রগতির বার (কত পেইজ হলো, কত বাকি) দেখা যায়।',subs:[],sc:sceneBook},
  {tag:'ধাপ ১',t:'ছবি ডাউনলোড করে প্রম্পট কপি করুন',d:'পেইজ খুললে উপরের টুলবারে ছবি ডাউনলোডের বোতাম ও তার পাশে এআই (✦) চিহ্ন পাবেন।',
    subs:['টাস্ক থেকে ডাউনলোড বোতামে চাপ দিয়ে পেইজের ছবিটি ফোনে নামান।','পাশের এআই (✦) চিহ্নে ক্লিক করুন — প্রম্পট কপি হয়ে যাবে।'],
    sc:()=>shotScene('a',400,124,[{x:12,y:10,w:52,h:36},{x:133,y:10,w:52,h:36}])},
  {tag:'ধাপ ২',t:'ছবি ও প্রম্পট Meta AI বা ChatGPT-কে দিন',d:'meta.ai বা chatgpt.com খুলে ডাউনলোড করা ছবি এবং কপি করা প্রম্পট একসাথে পাঠান।',
    subs:['"+" চেপে ডাউনলোড করা ছবিটি যোগ করুন।','কপি করা প্রম্পট লেখার ঘরে পেস্ট করুন।','পাঠানোর তীর (↑) চাপুন — Meta AI ছবি থেকে টেক্সট বের করে দেবে।'],
    sc:()=>shotScene('b',680,245,[{x:37,y:150,w:60,h:60},{x:20,y:40,w:620,h:70},{x:585,y:152,w:56,h:56}])},
  {tag:'ধাপ ৩',t:'AI-র দেওয়া টেক্সট কপি করুন',d:'Meta AI বা ChatGPT-এর উত্তর শেষ হলে নিচের কপি আইকনে চাপ দিন। এতে পুরো টেক্সট একবারে কপি হবে।',
    subs:['উত্তরের নিচের কপি আইকনে চাপ দিন, তারপর অ্যাপে ফিরে আসুন।'],
    sc:()=>shotScene('c',680,170,[{x:112,y:110,w:56,h:56}],{D:96})},
  {tag:'ধাপ ৪',t:'টেক্সট বক্সে হেডিং চালু করে পেস্ট করুন',d:'অ্যাপের পেইজে ফিরে টেক্সট বক্সে কপি করা টেক্সট বসান। পেইজে শিরোনাম (হেডিং) থাকলে টেক্সট বক্সে হেডিং চালু করে নিন।',
    subs:['টেক্সট বক্সের পেস্ট (📋) আইকনে চাপ দিন — কপি করা টেক্সট বসে যাবে।','অক্ষর সংখ্যা দেখে নিশ্চিত হন যে টেক্সট এসেছে।','টেক্সট বক্সে লেখাটি ছবির সাথে মিলছে কি না পড়ে দেখুন।'],
    sc:()=>shotScene('d0',380,175,[{x:238,y:7,w:47,h:36},{x:290,y:13,w:80,h:22},{x:30,y:75,w:330,h:50}],{swap:{key:'d',at:0}})},
  {tag:'ধাপ ৫',t:'সেভ করুন',d:'টেক্সট বসানোর পর নিচের বারের "সেভ" দিয়ে সংরক্ষণ করুন।',
    subs:['"সেভ" — শুধু এই পেইজ সংরক্ষণ হবে।','"সেভ ও পরের" — সংরক্ষণ করে সরাসরি পরের পেইজে চলে যাবে।'],
    sc:()=>shotScene('e',720,64,[{x:12,y:12,w:93,h:44},{x:118,y:12,w:166,h:44}],{D:84})},
  {tag:'ধাপ ৬',t:'প্রুফ করে "প্রুফড" চিহ্ন দিন',d:'ছবি ও টেক্সট মিলিয়ে ভুল ঠিক করুন, তারপর প্রুফড চিহ্ন দিন। অ্যাডমিন পরে আপনার কাজ রিভিউ করে "অনুমোদিত" বা "সংশোধন দরকার" চিহ্ন দেবেন।',
    subs:['ছবির সাথে টেক্সট মিলিয়ে ভুল শুধরে নিন।','নিচের "প্রুফড" বক্সে টিক দিন — পেইজটি রিভিউতে যাবে।','"সেভ ও পরের" চেপে পরের পেইজে যান।'],
    sc:()=>shotScene('e',720,64,[{x:294,y:12,w:112,h:44},{x:118,y:12,w:166,h:44}],{D:84})},
  {tag:'ফলাফল',t:'আয় ও পেমেন্ট',d:'"পেমেন্ট" ট্যাবে মোট আয়, বাকি টাকা ও ইতিহাস দেখুন। আয় গোনা হয় শুধু অ্যাডমিন যে পেইজ অনুমোদিত করেছেন সেগুলোর।',
    subs:['"অনুমোদিত" পেইজ আপনার আয়ে যোগ হয়।','"সংশোধন দরকার" হলে ঠিক করে আবার "প্রুফড" চাপুন — ভুল পেইজে আয় গোনা হয় না।','নির্দিষ্ট পরিমাণ হলে "পেমেন্ট রিকোয়েস্ট" চেপে টাকা চাইতে পারবেন।'],
    sc:sceneEarn},
  {tag:'নতুন',t:'লক্ষ্য, টানা দিন ও চালিয়ে যান',d:'টাস্ক ট্যাবের উপরের কার্ডে আজকের লক্ষ্য, টানা কাজের দিন ও ব্যাজ দেখা যায়। \"চালিয়ে যান\" বাটনে শেষ কাজের জায়গায় ফেরা যায়।',
    subs:['লক্ষ্যের ঘরে চাপ দিয়ে দৈনিক লক্ষ্য (কত পেইজ) বদলান।','প্রতিদিন অন্তত একটি পেইজ প্রুফড করলে টানা দিন বাড়ে; ৩, ৭, ১৫, ৩০ দিনে ব্যাজ মেলে।','\"চালিয়ে যান\" চাপলে শেষ যে কিতাব ও পেইজে ছিলেন সেখানে সরাসরি খুলবে।'],
    sc:sceneGoal},
  {tag:'সাহায্য',t:'লিডারবোর্ড, নোটিশ ও সাহায্য',d:'"র‍্যাংক" ট্যাবে সবার মধ্যে আপনার অবস্থান দেখুন। অ্যাডমিনের ঘোষণা ডায়ালগে আসবে। উপরের টুলবারের প্রোফাইল আইকনে আপনার সব তথ্য আছে।',
    subs:['"র‍্যাংক" ট্যাবে আজ, এই সপ্তাহ ও সব সময়ের তালিকা দেখুন।','অ্যাডমিনের ঘোষণা ডায়ালগে আসবে; আগেরগুলো প্রোফাইলের "নোটিশ ও ঘোষণা"-তে।','সমস্যা হলে প্রোফাইল থেকে টিকেট খুলুন বা হোয়াটসঅ্যাপে যোগাযোগ করুন।','উপরের প্রোফাইল আইকনে মোবাইল/পেমেন্ট নাম্বার, থিম, হোম স্ক্রিনে ইনস্টল ও লগআউট।'],
    sc:sceneCommunity}
];
