/* play_cam_guide.js (FINAL)
   - Target image → .json / .multi.json 읽어 실루엣 가이드
   - 미러링: auto 감지 + URL/데이터 속성으로 강제 제어
     * ?mirror=1 (강제 on), ?mirror=0 (강제 off)
     * ?mirrorMode=auto|force|off  (기본 auto)
     * <body data-mirror="true">, <video data-mirror="true">, class="mirror", transform:scaleX(-1) 감지
   - contain-fit + 안전여백(safe viewport) + 가이드 클램프
   - Mini HUD: [좁게|기본|넓게] 프리셋만 (3초 자동숨김, 하단에서 마우스 접근 시 표시)
*/
(() => {
  const SIL_FILL = "rgba(0, 255, 200, 0.22)";
  const SIL_EDGE = "rgba(0, 255, 200, 0.95)";

  function pxScale(W, H){ return Math.max(2, Math.round(Math.min(W,H)*0.004)); }

  let videoEl, targetImg, guideCanvas, gctx;
  let players = Number(document.body.dataset.players || 1);
  let drawMode = "single", drawIndex = 0;
  let poseMetaSingle = null, poseMetaMulti = null;

  // 기본 설정
  const CFG = {
    fit: "contain",
    margin: 0.0,
    safeL: 0.05, safeR: 0.05, safeT: 0.05, safeB: 0.05,
    controls: (document.body.dataset.guideControls ?? "true") !== "false",
  };

  // ---------- utils ----------
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
  const has = (mp, ...n) => n.every(k => mp[k]);
  const clampPoint = (x,y,W,H)=>[clamp(x,0,W),clamp(y,0,H)];
  function getParam(name, fallback=null){ try{ return new URL(location.href).searchParams.get(name) ?? fallback; }catch{ return fallback; } }

  function normalizeAndPadBBox(b, pad=0){
    let x=b?.x??0, y=b?.y??0, w=b?.w??1, h=b?.h??1;
    x=clamp01(x); y=clamp01(y);
    w=Math.max(1e-6,Math.min(1-x,w)); h=Math.max(1e-6,Math.min(1-y,h));
    if(pad!==0){ const px=w*pad, py=h*pad;
      x=clamp01(x-px); y=clamp01(y-py);
      w=Math.max(1e-6,Math.min(1-x,w+2*px)); h=Math.max(1e-6,Math.min(1-y,h+2*py));
    }
    return {x,y,w,h};
  }

  function rectFromKeypoints(kps){
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const k of kps){
      if(!isFinite(k.x)||!isFinite(k.y)) continue;
      minX=Math.min(minX,k.x); minY=Math.min(minY,k.y);
      maxX=Math.max(maxX,k.x); maxY=Math.max(maxY,k.y);
    }
    return (isFinite(minX)&&isFinite(minY))
      ? {x:minX,y:minY,w:Math.max(1e-6,maxX-minX),h:Math.max(1e-6,maxY-minY)}
      : {x:0,y:0,w:1,h:1};
  }

  function getSafeViewport(W,H){
    const x=CFG.safeL*W, y=CFG.safeT*H;
    const w=Math.max(1, W-(CFG.safeL+CFG.safeR)*W);
    const h=Math.max(1, H-(CFG.safeT+CFG.safeB)*H);
    return {x,y,w,h};
  }

  function fitKeypointsIntoBBox(kps, bbox, W, H, mode='contain', view=null){
    const rect=rectFromKeypoints(kps),
          bw=Math.max(1e-6,bbox.w), bh=Math.max(1e-6,bbox.h);
    const sx=bw/rect.w, sy=bh/rect.h;
    const s = mode==='cover' ? Math.max(sx,sy) : mode==='fill' ? null : Math.min(sx,sy);

    const VX=view?view.x:0, VY=view?view.y:0, VW=view?view.w:W, VH=view?view.h:H;
    const out=[];
    for(const k of kps){
      const nx=k.x-rect.x, ny=k.y-rect.y; let fx,fy;
      if(mode==='fill'){ fx=bbox.x+nx*sx; fy=bbox.y+ny*sy; }
      else { const dx=bbox.x+(bw-rect.w*(s||1))/2, dy=bbox.y+(bh-rect.h*(s||1))/2; fx=dx+nx*(s||1); fy=dy+ny*(s||1); }
      let px=VX+(fx*VW), py=VY+(fy*VH);
      [px,py]=clampPoint(px,py,W,H);
      out.push({name:k.name,x:px,y:py});
    }
    return out;
  }

  function ensureOverlayCanvas(id, anchor, z=9999){
    let c=document.getElementById(id);
    if(!c){
      c=document.createElement("canvas");
      c.id=id; c.style.position="absolute"; c.style.pointerEvents="none"; c.style.zIndex=String(z);
      (anchor.parentElement||document.body).appendChild(c);
    }
    const parent=anchor.parentElement||document.body,
          prect=parent.getBoundingClientRect(),
          vrect=anchor.getBoundingClientRect();
    const left=vrect.left-prect.left+parent.scrollLeft,
          top=vrect.top-prect.top+parent.scrollTop;
    const cssW=vrect.width, cssH=vrect.height;
    c.style.left=`${left}px`; c.style.top=`${top}px`;
    c.style.width=`${cssW}px`; c.style.height=`${cssH}px`;
    c.width=Math.max(1,Math.round(cssW)); c.height=Math.max(1,Math.round(cssH));

    const tr=getComputedStyle(anchor).transform;
    c.style.transform = tr && tr!=="none" ? tr : "";
    c.style.transformOrigin = getComputedStyle(anchor).transformOrigin || "center center";
    return c;
  }

  // ---- mirroring ----
  function isMirroredVideo(el){
    // 데이터/바디 우선
    if (el?.dataset?.mirror === "true" || document.body.dataset.mirror === "true") return true;
    // URL legacy ?mirror=1
    try{
      const u=new URL(location.href);
      const m=u.searchParams.get("mirror");
      if (m==="1") return true;
      if (m==="0") return false;
    }catch{}
    // CSS transform
    const tr=getComputedStyle(el).transform;
    if (tr && tr!=="none"){
      const m=tr.match(/matrix\(([-\d\.eE]+),/);
      if (m){ const a=parseFloat(m[1]); if(!Number.isNaN(a) && a<0) return true; }
    }
    // class
    return el.classList.contains("mirror");
  }
  function getMirrorState(el){
    const mode=(getParam('mirrorMode','auto')||'').toLowerCase();
    const mParam = getParam('mirror', null); // backward compat
    if (mParam === "1") return true;
    if (mParam === "0") return false;
    if (mode === 'force') return true;
    if (mode === 'off') return false;
    return isMirroredVideo(el); // auto
  }

  // ---------- drawing ----------
  function fillCapsule(ctx,ax,ay,bx,by,r){
    const dx=bx-ax, dy=by-ay, len=Math.hypot(dx,dy)||1, nx=-dy/len, ny=dx/len;
    ctx.beginPath();
    ctx.arc(ax,ay,r,Math.atan2(ny,nx),Math.atan2(-ny,-nx),true);
    ctx.arc(bx,by,r,Math.atan2(-ny,-nx),Math.atan2(ny,nx),true);
    ctx.closePath(); ctx.fill();
  }

  function drawPersonSilhouette(ctx,W,H,person){
    if(!Array.isArray(person?.keypoints)) return;
    const EDGE=pxScale(W,H),
          LIMB_R=Math.max(6,Math.round(Math.min(W,H)*0.018)),
          FOREARM_R=Math.round(LIMB_R*0.85),
          SHIN_R=Math.round(LIMB_R*0.85),
          WRIST_R=Math.round(LIMB_R*0.55),
          ANKLE_R=Math.round(LIMB_R*0.55);

    const safeBBox=normalizeAndPadBBox(person.bbox||{x:0,y:0,w:1,h:1}, CFG.margin);
    const placed=fitKeypointsIntoBBox(person.keypoints, safeBBox, W, H, CFG.fit, getSafeViewport(W,H));
    const mp=Object.fromEntries(placed.map(k=>[k.name,{x:k.x,y:k.y}]));

    ctx.save();
    ctx.fillStyle=SIL_FILL; ctx.strokeStyle=SIL_EDGE;
    ctx.lineWidth=EDGE; ctx.lineJoin="round"; ctx.lineCap="round";

    if(has(mp,"left_shoulder","right_shoulder","right_hip","left_hip")){
      const ls=mp.left_shoulder, rs=mp.right_shoulder, rh=mp.right_hip, lh=mp.left_hip;
      ctx.beginPath(); ctx.moveTo(ls.x,ls.y); ctx.lineTo(rs.x,rs.y); ctx.lineTo(rh.x,rh.y); ctx.lineTo(lh.x,lh.y);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if(has(mp,"left_shoulder","left_elbow")) fillCapsule(ctx, mp.left_shoulder.x, mp.left_shoulder.y, mp.left_elbow.x, mp.left_elbow.y, LIMB_R);
    if(has(mp,"left_elbow","left_wrist")){ fillCapsule(ctx, mp.left_elbow.x, mp.left_elbow.y, mp.left_wrist.x, mp.left_wrist.y, FOREARM_R); ctx.beginPath(); ctx.arc(mp.left_wrist.x, mp.left_wrist.y, WRIST_R, 0, Math.PI*2); ctx.fill(); }
    if(has(mp,"right_shoulder","right_elbow")) fillCapsule(ctx, mp.right_shoulder.x, mp.right_shoulder.y, mp.right_elbow.x, mp.right_elbow.y, LIMB_R);
    if(has(mp,"right_elbow","right_wrist")){ fillCapsule(ctx, mp.right_elbow.x, mp.right_elbow.y, mp.right_wrist.x, mp.right_wrist.y, FOREARM_R); ctx.beginPath(); ctx.arc(mp.right_wrist.x, mp.right_wrist.y, WRIST_R, 0, Math.PI*2); ctx.fill(); }
    if(has(mp,"left_hip","left_knee")) fillCapsule(ctx, mp.left_hip.x, mp.left_hip.y, mp.left_knee.x, mp.left_knee.y, LIMB_R);
    if(has(mp,"left_knee","left_ankle")){ fillCapsule(ctx, mp.left_knee.x, mp.left_knee.y, mp.left_ankle.x, mp.left_ankle.y, SHIN_R); ctx.beginPath(); ctx.arc(mp.left_ankle.x, mp.left_ankle.y, ANKLE_R, 0, Math.PI*2); ctx.fill(); }
    if(has(mp,"right_hip","right_knee")) fillCapsule(ctx, mp.right_hip.x, mp.right_hip.y, mp.right_knee.x, mp.right_knee.y, LIMB_R);
    if(has(mp,"right_knee","right_ankle")){ fillCapsule(ctx, mp.right_knee.x, mp.right_knee.y, mp.right_ankle.x, mp.right_ankle.y, SHIN_R); ctx.beginPath(); ctx.arc(mp.right_ankle.x, mp.right_ankle.y, ANKLE_R, 0, Math.PI*2); ctx.fill(); }
    if(has(mp,"left_eye","right_eye","nose")){
      const le=mp.left_eye, re=mp.right_eye, n=mp.nose, cx=(le.x+re.x+n.x)/3, cy=(le.y+re.y+n.y)/3;
      const headR=Math.max(8, Math.hypot(re.x-le.x, re.y-le.y)*0.9);
      ctx.beginPath(); ctx.arc(cx,cy,headR,0,Math.PI*2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  function drawFallback(ctx,W,H){
    const T=pxScale(W,H);
    ctx.save();
    ctx.strokeStyle="rgba(0,255,255,0.9)";
    ctx.lineWidth=T; ctx.setLineDash([6,6]);
    ctx.beginPath(); ctx.arc(W/2,H*0.58, Math.min(W,H)*0.14, 0, Math.PI*2); ctx.stroke();

    ctx.strokeStyle="rgba(255,160,0,0.95)"; ctx.setLineDash([]);
    const pad=16, cols=(players===1?1:(players===2?2:2)), rows=(players<=2?1:2);
    const cellW=(W-pad*(cols+1))/cols, cellH=(H-pad*(rows+1))/rows;
    let idx=0;
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols && idx<players;c++,idx++){
        const x=pad+c*(cellW+pad), y=pad+r*(cellH+pad);
        ctx.strokeRect(x,y,cellW,cellH);
      }
    }
    ctx.restore();
  }

  function render(){
    if(!guideCanvas||!videoEl) return requestAnimationFrame(render);
    guideCanvas=ensureOverlayCanvas("camGuideOverlay", videoEl, 9999);
    const W=guideCanvas.width, H=guideCanvas.height;
    gctx=guideCanvas.getContext("2d");
    gctx.clearRect(0,0,W,H);

    const MIRROR = getMirrorState(videoEl);
    if (MIRROR){ gctx.save(); gctx.translate(W,0); gctx.scale(-1,1); }

    if(poseMetaMulti?.people?.length){
      if(drawMode==="all"){ for(const p of poseMetaMulti.people) drawPersonSilhouette(gctx,W,H,p); }
      else { const idx=Math.max(0,Math.min(drawIndex, poseMetaMulti.people.length-1)); drawPersonSilhouette(gctx,W,H, poseMetaMulti.people[idx]); }
    } else if (poseMetaSingle?.keypoints) {
      drawPersonSilhouette(gctx,W,H, poseMetaSingle);
    } else {
      drawFallback(gctx,W,H);
    }

    if (MIRROR) gctx.restore();
    requestAnimationFrame(render);
  }

  // ---------- meta & params ----------
  async function tryLoadPoseMetaFromImage(imgEl){
    poseMetaSingle=poseMetaMulti=null;
    if(!imgEl) return;
    const src=imgEl.getAttribute("src")||"";
    if(!src) return;

    const toMulti=src.replace(/\.(jpg|jpeg|png)$/i,".multi.json");
    const toSingle=src.replace(/\.(jpg|jpeg|png)$/i,".json");

    try{ const r=await fetch(toMulti,{cache:"no-store"}); if(r.ok){ const d=await r.json(); if(Array.isArray(d?.people)){ d.people.sort((a,b)=>((a.bbox?.x??0)+(a.bbox?.w??0)/2)-((b.bbox?.x??0)+(b.bbox?.w??0)/2)); poseMetaMulti=d; } } }catch(_){}
    try{ const r=await fetch(toSingle,{cache:"no-store"}); if(r.ok){ const d=await r.json(); if(d?.bbox&&Array.isArray(d?.keypoints)) poseMetaSingle=d; } }catch(_){}

    const url=new URL(location.href);
    CFG.fit    = (url.searchParams.get("fit") || document.body.dataset.fit || CFG.fit).toLowerCase();
    CFG.margin = parseFloat(url.searchParams.get("pad") ?? document.body.dataset.pad ?? CFG.margin) || 0;

    // 안전 여백 파라미터
    const all=parseFloat(url.searchParams.get("safeAll") ?? document.body.dataset.safeAll ?? "");
    if(!Number.isNaN(all)){ const v=Math.max(0, Math.min(0.4, all)); CFG.safeL=CFG.safeR=CFG.safeT=CFG.safeB=v; }
    const safe=(url.searchParams.get("safe") ?? document.body.dataset.safe ?? "").trim();
    if(safe){
      const p=safe.split(",").map(parseFloat);
      if(p.length===4 && p.every(v=>!Number.isNaN(v))){ CFG.safeL=p[0]; CFG.safeT=p[1]; CFG.safeR=p[2]; CFG.safeB=p[3]; }
    }

    if(!url.searchParams.get("people") && !document.body.dataset.people && poseMetaMulti?.people?.length>1) drawMode="all";
    updateMiniHUD();
  }

  // ---------- MINI HUD (only presets) ----------
  let hud, hideTimer=null;
  function createMiniHUD(){
    if(!CFG.controls || hud) return;

    const style=document.createElement("style");
    style.textContent = `
      #poseMiniHUD{
        position:fixed; left:50%; bottom:52px; transform:translateX(-50%);
        display:flex; gap:8px; padding:6px 8px; border-radius:14px;
        background:rgba(0,0,0,.28); border:1px solid rgba(255,255,255,.18);
        backdrop-filter: blur(6px); color:#fff; z-index:100000;
        transition:opacity .25s ease, transform .25s ease;
      }
      #poseMiniHUD.hidden{ opacity:0; pointer-events:none; transform:translate(-50%, 10px); }
      #poseMiniHUD button{
        padding:8px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.15);
        background:rgba(255,255,255,.08); color:#fff; font:13px/1.1 ui-sans-serif, system-ui, -apple-system, Segoe UI;
        cursor:pointer; user-select:none; -webkit-user-select:none; touch-action:manipulation;
        transition: background .15s ease, transform .05s ease, box-shadow .15s ease;
      }
      #poseMiniHUD button:hover{ background:rgba(255,255,255,.14); }
      #poseMiniHUD button:active{ transform:translateY(1px); background:rgba(255,255,255,.18); }
      #poseMiniHUD button.on{ box-shadow:0 0 0 2px rgba(0,255,210,.9) inset; }
      @media (max-width: 820px){
        #poseMiniHUD{ padding:6px 8px; bottom:60px; }
        #poseMiniHUD button{ padding:10px 14px; font-size:13px; }
      }
    `;
    document.head.appendChild(style);

    hud=document.createElement("div"); hud.id="poseMiniHUD";
    const bN=document.createElement("button"); bN.textContent="좁게";
    const bD=document.createElement("button"); bD.textContent="기본";
    const bW=document.createElement("button"); bW.textContent="넓게";
    bN.onclick=()=>applyPreset("narrow");
    bD.onclick=()=>applyPreset("default");
    bW.onclick=()=>applyPreset("wide");
    hud.append(bN,bD,bW);
    document.body.appendChild(hud);

    hud.addEventListener("mouseenter", ()=>clearTimeout(hideTimer));
    hud.addEventListener("mouseleave", startAutoHide);
    window.addEventListener("mousemove", (e)=>{ if(e.clientY > window.innerHeight - 140) showHUD(); });
  }
  function showHUD(){ if(!hud) return; hud.classList.remove("hidden"); startAutoHide(); }
  function startAutoHide(){ if(!hud) return; clearTimeout(hideTimer); hideTimer=setTimeout(()=>hud.classList.add("hidden"), 3000); }
  function applyPreset(name){
    if(name==="narrow") CFG.safeL=CFG.safeR=CFG.safeT=CFG.safeB=0.02;
    else if(name==="wide") CFG.safeL=CFG.safeR=CFG.safeT=CFG.safeB=0.10;
    else CFG.safeL=CFG.safeR=CFG.safeT=CFG.safeB=0.05;
    updateMiniHUD(); showHUD();
  }
  function updateMiniHUD(){
    if(!hud) return;
    const [bN,bD,bW]=hud.querySelectorAll("button");
    const v=CFG.safeL;
    bN.classList.toggle("on", Math.abs(v-0.02)<1e-6);
    bD.classList.toggle("on", Math.abs(v-0.05)<1e-6);
    bW.classList.toggle("on", Math.abs(v-0.10)<1e-6);
  }
  window.addEventListener("keydown",(e)=>{ if(e.key==="1")applyPreset("narrow"); if(e.key==="2")applyPreset("default"); if(e.key==="3")applyPreset("wide"); });

  // ---------- init ----------
  async function init(){
    videoEl=document.getElementById("webcam");
    targetImg=document.getElementById("targetImage");
    if(!videoEl) return setTimeout(init,200);
    guideCanvas=ensureOverlayCanvas("camGuideOverlay", videoEl, 9999);
    gctx=guideCanvas.getContext("2d");

    createMiniHUD();

    if(targetImg){
      const mo=new MutationObserver(async muts=>{
        for(const m of muts) if(m.type==="attributes" && m.attributeName==="src") await tryLoadPoseMetaFromImage(targetImg);
      });
      mo.observe(targetImg,{attributes:true});
      await tryLoadPoseMetaFromImage(targetImg);
    }
    showHUD();
    requestAnimationFrame(render);
  }
  if(document.readyState==="complete"||document.readyState==="interactive") setTimeout(init,0);
  else window.addEventListener("DOMContentLoaded", init);

  window.addEventListener("resize", ()=>{ if(guideCanvas&&videoEl) ensureOverlayCanvas("camGuideOverlay", videoEl, 9999); });
  window.addEventListener("playersChange", e=>{ const n=Number(e.detail?.players); if(n>=1&&n<=4) players=n; });
})();
