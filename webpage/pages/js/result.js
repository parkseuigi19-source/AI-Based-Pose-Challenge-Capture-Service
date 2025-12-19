document.addEventListener("DOMContentLoaded", function () {
  const data = window.resultData || {};
  console.log("[result data]", data);

  if (!data.date) return;

  let currentIndex = 0;
  const total = data.max_image || 1;

  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");

  if (total <= 1) {
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
  }

  // ---------------------------
  // 📸 이미지 + 정확도 갱신
  // ---------------------------
  function updateDisplay(index) {
    const userImage = document.getElementById("userImage");
    const targetImage = document.getElementById("targetImage");

    if (userImage) {
      userImage.src = `/static/result_images/capture/${data.date}/${data.folder}/${data.images_nm[index]}`;
    }
    if (targetImage) {
      targetImage.src = `/static/result_images/matching/${data.player}/${data.targets[index]}`;
    }

    document.getElementById("currentAccuracy").textContent = `${data.images_ac[index]}%`;
    document.getElementById("bestAccuracy").textContent = `${data.best_ac}%`;
  }

  // ✅ 최초 로드시 이미지+정확도 출력
  updateDisplay(currentIndex);

  // ✅ 이전/다음 버튼 클릭 시 이미지 + 정확도만 갱신
  prevBtn.addEventListener("click", () => {
    currentIndex = (currentIndex - 1 + total) % total;
    updateDisplay(currentIndex);
  });

  nextBtn.addEventListener("click", () => {
    currentIndex = (currentIndex + 1) % total;
    updateDisplay(currentIndex);
  });

  // ---------------------------
  // 🎬 비디오: 최초 1회만 세팅
  // ---------------------------
  const videoEl = document.getElementById("recordedVideo");
  if (videoEl) {
    const videoPath = `/static/result_images/video/${data.date}/${data.folder}/${data.date}.mp4`;

    videoEl.src = videoPath;
    const source = videoEl.querySelector("source");
    if (source) {
      source.src = videoPath;
    }

    videoEl.load();
    videoEl.playbackRate = 1.0;
  }

  // ---------------------------
  // 🎨 필터 버튼 & 다운로드
  // ---------------------------
  const effectButtonsContainer = document.getElementById("effectButtons");
  const downloadFilteredBtn = document.getElementById("downloadFilteredBtn");

  let selectedEffect = "none";

  if (effectButtonsContainer) {
    const effects = [
      { id: "none", label: "원본", css: "none", color: "linear-gradient(45deg, #ff6b6b, #4ecdc4)" },
      { id: "grayscale", label: "흑백", css: "grayscale(100%)", color: "#777" },
      { id: "smurf", label: "스머프", css: "hue-rotate(180deg) saturate(200%)", color: "linear-gradient(90deg, #00f, #0ff)" },
      { id: "sepia", label: "세피아", css: "sepia(100%)", color: "#d2b48c" },
    ];

    effects.forEach(effect => {
      const btn = document.createElement("div");
      btn.classList.add("filter-btn");
      if (effect.id === "none") {
        btn.classList.add("active");
        selectedEffect = "none";
      }

      // 카드형 버튼 구성
      btn.innerHTML = `
        <div class="preview" style="background:${effect.color}"></div>
        <span>${effect.label}</span>
      `;

      btn.addEventListener("click", () => {
        effectButtonsContainer.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        selectedEffect = effect.id; // 선택 필터 ID
        videoEl.style.filter = effect.css; // CSS 필터 적용
      });

      effectButtonsContainer.appendChild(btn);
    });
  }

  if (downloadFilteredBtn) {
    downloadFilteredBtn.addEventListener("click", async () => {
      if (!videoEl) return;

      const today = new Date().toISOString().split("T")[0];

      if (selectedEffect === "none") {
        // ✅ 원본 다운로드
        const a = document.createElement("a");
        a.href = `/static/result_images/video/${data.date}/${data.folder}/${data.date}.mp4`;
        a.download = `${today}_original.mp4`;
        a.click();
      } else {
        try {
          // ✅ 가상 video 생성 (원본 UI 유지)
          const tempVideo = document.createElement("video");
          tempVideo.src = videoEl.currentSrc || videoEl.src;
          tempVideo.muted = true;
          tempVideo.playsInline = true;   // ✅ iOS/크롬 자동재생 보장
          tempVideo.removeAttribute("loop"); // ended 이벤트 보장
          tempVideo.load();

          // ✅ 항상 처음부터 시작 보장
          tempVideo.pause();
          tempVideo.currentTime = 0;

          await tempVideo.play().then(() => {
            // 🎯 필터 적용 다운로드 (복제 video 사용)
            return window.downloadVideoWithEffects(tempVideo, [selectedEffect], today);
          });

          console.log(`필터 적용 다운로드 완료 (${selectedEffect})`);
        } catch (err) {
          console.error("필터 적용 다운로드 실패:", err);
          alert("필터 적용된 영상을 다운로드할 수 없습니다.");
        }
      }
    });
  }

  // ---------------------------
  // 🎯 필터 박스 위치 조정
  // ---------------------------
  function adjustFilterBox() {
    const filterBox = document.querySelector(".filter-controls");
    const retryBtn = document.querySelector(".result-buttons");

    if (videoEl && filterBox && retryBtn) {
      const rect = videoEl.getBoundingClientRect();
      const scrollY = window.scrollY;
      filterBox.style.top = rect.top + scrollY + "px";
      retryBtn.style.top = rect.top + scrollY + filterBox.offsetHeight + 15 + "px";
    }
  }

  window.addEventListener("load", adjustFilterBox);
  window.addEventListener("resize", adjustFilterBox);
});

/* =====================================================================================
   Zoom Modal: v6 inline (static path + hint overlay)
   ===================================================================================== */
(function () {
  const PATHS = {
    user: "/static/result_images/capture/",
    target: "/static/result_images/matching/",
    video: "/static/result_images/video/",
  };

  function ready(fn){ if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",fn,{once:true});}else{fn();} }
  const isValidSrc = (s)=>!!s && typeof s==="string" && s.trim() !== "" && s !== "about:blank";
  const buildSrc = (role, filename)=> filename ? (PATHS[role]||"/") + filename.replace(/^[/\\]+/,"") : null;

  function parseQuery(){
    const out={}; const sp=new URLSearchParams(location.search);
    for(const [k,v] of sp.entries()) out[k]=v;
    return out;
  }

  function attachZoomHintOver(el, text="클릭 시 확대됩니다"){
    if(!el) return;
    const parent = el.parentElement; if(!parent) return;
    if(getComputedStyle(parent).position === "static"){ parent.style.position = "relative"; }
    if(parent.querySelector(".zoom-hint-layer")) return;
    const layer = document.createElement("div");
    layer.className = "zoom-hint-layer";
    layer.innerHTML = `<div class="zoom-hint-badge">${text}</div>`;
    parent.appendChild(layer);
    requestAnimationFrame(()=> layer.classList.add("show"));
    const hide = ()=> layer.classList.remove("show");
    setTimeout(()=> layer.classList.remove("/show/"), 2500);
    el.addEventListener("click", hide, { once:true });
    document.addEventListener("zoom-modal-open", hide, { once:true });
  }

  function resolveImageSrc(el, role){
    if(!el) return null;
    const q=parseQuery(); const ss=window.sessionStorage;

    const current = el.getAttribute("src");
    if(isValidSrc(current) && el.naturalWidth>0) return current;

    const dataFilename = el.getAttribute("data-filename");
    if(dataFilename){ const built=buildSrc(role,dataFilename); if(isValidSrc(built)) return built; }

    const ds = el.getAttribute("data-src");
    if(isValidSrc(ds)) return ds;

    const keys = role==="user" ? ["result_userImage","capturedImageSrc","userImageSrc"]
                               : ["result_targetImage","targetImageSrc","poseImageSrc"];
    for(const k of keys){ const v=ss?.getItem?.(k); if(isValidSrc(v)) return v; }

    const qpKey = role==="user" ? "user_img" : "target_img";
    const qpVal = q[qpKey];
    if(isValidSrc(qpVal)){
      if(!/^https?:\/\//i.test(qpVal) && !/^\//.test(qpVal)){ const builtQ=buildSrc(role,qpVal); if(isValidSrc(builtQ)) return builtQ; }
      return qpVal;
    }
    return null;
  }

  function resolveVideoSrc(videoEl){
    if(!videoEl) return null;
    const q=parseQuery(); const ss=window.sessionStorage;
    const current = videoEl.getAttribute("src"); if(isValidSrc(current)) return current;
    const fn = videoEl.getAttribute("data-filename"); if(fn){ const b=buildSrc("video",fn); if(isValidSrc(b)) return b; }
    const ds = videoEl.getAttribute("data-src"); if(isValidSrc(ds)) return ds;
    for(const k of ["result_videoSrc","capturedVideoSrc"]){ const v=ss?.getItem?.(k); if(isValidSrc(v)) return v; }
    const qp=q["video"]; if(isValidSrc(qp)){ if(!/^https?:\/\//i.test(qp) && !/^\//.test(qp)){ const b=buildSrc("video",qp); if(isValidSrc(b)) return b; } return qp; }
    return null;
  }

  function init(){
    const modal=document.getElementById("zoomModal");
    const backdrop=document.getElementById("zoomBackdrop");
    const content=document.getElementById("zoomContent");
    const img=document.getElementById("zoomImage");
    const btnIn=document.getElementById("zoomInBtn");
    const btnOut=document.getElementById("zoomOutBtn");
    const btnReset=document.getElementById("zoomResetBtn");
    const btnClose=document.getElementById("zoomCloseBtn");
    if(!modal||!content||!img){ console.warn("[zoom-modal] elements missing"); return; }

    const userImage=document.getElementById("userImage");
    const targetImage=document.getElementById("targetImage");
    const videoEl=document.getElementById("resultVideo");

    const rU=resolveImageSrc(userImage,"user");
    if(rU && (!userImage.getAttribute("src") || userImage.naturalWidth===0)){ userImage.setAttribute("src",rU); userImage.classList.add("zoom-ready"); }
    const rT=resolveImageSrc(targetImage,"target");
    if(rT && (!targetImage.getAttribute("src") || targetImage.naturalWidth===0)){ targetImage.setAttribute("src",rT); targetImage.classList.add("zoom-ready"); }
    const rV=resolveVideoSrc(videoEl); if(videoEl && rV){ videoEl.setAttribute("src", rV); }

    attachZoomHintOver(userImage, "클릭 시 확대됩니다");

    let scale=1, tx=0, ty=0, dragging=false, startX=0, startY=0, startTx=0, startTy=0;
    const MIN=0.5, MAX=6, STEP=0.2;
    const apply=()=> img.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
    const clamp=v=> Math.min(MAX, Math.max(MIN, v));
    const reset=()=>{ scale=1; tx=0; ty=0; apply(); };
    const open=(src)=>{ if(!isValidSrc(src)){ return; } img.src=src; reset(); modal.classList.add("open"); modal.setAttribute("aria-hidden","false"); document.body.style.overflow="hidden"; document.dispatchEvent(new Event("zoom-modal-open")); };
    const close=()=>{ modal.classList.remove("open"); modal.setAttribute("aria-hidden","true"); document.body.style.overflow=""; };

    function bindZoom(el){ if(!el) return; el.addEventListener("click", ()=>{ const src=el.getAttribute("src")||el.getAttribute("data-src"); if(!isValidSrc(src)) return; open(src); }); }
    bindZoom(userImage); bindZoom(targetImage);
    document.querySelectorAll("[data-zoomable]").forEach(bindZoom);

    btnIn?.addEventListener("click", ()=>{ scale=clamp(scale+STEP); apply(); });
    btnOut?.addEventListener("click", ()=>{ scale=clamp(scale-STEP); apply(); });
    btnReset?.addEventListener("click", reset);
    btnClose?.addEventListener("click", close);
    backdrop?.addEventListener("click", close);
    document.addEventListener("keydown", (e)=>{ if(modal.classList.contains("open") && e.key==="Escape") close(); });

    content.addEventListener("wheel", (e)=>{
      if(!modal.classList.contains("open")) return;
      e.preventDefault();
      const r=img.getBoundingClientRect();
      const cx=(e.clientX - r.left - r.width/2);
      const cy=(e.clientY - r.top - r.height/2);
      const prev=scale; scale=clamp(scale * (Math.sign(e.deltaY)>0 ? 0.9 : 1.1));
      const ratio=scale/prev - 1; tx -= cx*ratio; ty -= cy*ratio; apply();
    }, {passive:false});

    function onDown(e){ if(!modal.classList.contains("open") || e.target!==img) return;
      dragging=true; content.classList.add("dragging");
      startX=(e.touches?.[0]?.clientX ?? e.clientX); startY=(e.touches?.[0]?.clientY ?? e.clientY);
      startTx=tx; startTy=ty; e.preventDefault();
    }
    function onMove(e){ if(!dragging) return; const x=(e.touches?.[0]?.clientX ?? e.clientX); const y=(e.touches?.[0]?.clientY ?? e.clientY); tx=startTx+(x-startX); ty=startTy+(y-startY); apply(); }
    function onUp(){ dragging=false; content.classList.remove("dragging"); }
    img.addEventListener("mousedown", onDown); window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
    img.addEventListener("touchstart", onDown, {passive:false}); window.addEventListener("touchmove", onMove, {passive:false}); window.addEventListener("touchend", onUp);
  }
  ready(init);
})();

/* =====================================================================
   Zoom Modal - Save Button (v7 add-on)
   ===================================================================== */
(function () {
  function ready(fn){
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once:true });
    } else { fn(); }
  }

  ready(function () {
    var controls = document.querySelector(".zoom-controls");
    if (!controls) return;

    var btnSave = document.getElementById("zoomSaveBtn");
    if (!btnSave) {
      btnSave = document.createElement("button");
      btnSave.id = "zoomSaveBtn";
      btnSave.type = "button";
      btnSave.setAttribute("aria-label", "저장");
      btnSave.textContent = "저장";

      var btnClose = document.getElementById("zoomCloseBtn");
      if (btnClose && btnClose.parentElement === controls) {
        controls.insertBefore(btnSave, btnClose);
      } else {
        controls.appendChild(btnSave);
      }
    }

    var img = document.getElementById("zoomImage");
    btnSave.addEventListener("click", function () {
      if (!img || !img.src) {
        alert("저장할 이미지가 없습니다.");
        return;
      }
      try {
        var a = document.createElement("a");
        a.href = img.src;
        var name = "download.png";
        try {
          var parts = (img.src || "").split("/");
          var last = parts[parts.length - 1];
          if (last) name = decodeURIComponent(last.split("?")[0]) || name;
        } catch (e) {}
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (err) {
        console.warn("[zoom-modal] Save failed:", err);
        alert("이미지를 저장할 수 없습니다.");
      }
    });
  });
})();

/* =====================================================================
   모달 닫기 애니메이션 + 저장 토스트
   ===================================================================== */
(function () {
  function ready(fn){
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once:true });
    } else { fn(); }
  }

  function getToastEl() {
    let el = document.getElementById("zoomToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "zoomToast";
      el.className = "zoom-toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    return el;
  }
  let toastTimer = null;
  function showToast(message, ms=1400) {
    const el = getToastEl();
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), ms);
  }

  ready(function () {
    const btnSave = document.getElementById("zoomSaveBtn");
    const img = document.getElementById("zoomImage");

    if (btnSave) {
      const origHandler = () => {
        if (!img || !img.src) {
          showToast("저장할 이미지가 없어요");
          return;
        }
        try {
          const a = document.createElement("a");
          a.href = img.src;
          let name = "download.png";
          try {
            const parts = (img.src || "").split("/");
            const last = parts[parts.length - 1];
            if (last) name = decodeURIComponent(last.split("?")[0]) || name;
          } catch (e) {}

          a.download = name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);

          showToast("다운로드 시작!");
        } catch (err) {
          console.warn("[zoom-modal] Save failed:", err);
          showToast("저장 실패 😥");
        }
      };

      btnSave.replaceWith(btnSave.cloneNode(true));
      const safeBtn = document.getElementById("zoomSaveBtn");
      safeBtn.addEventListener("click", origHandler);
      safeBtn.title = "저장 (다운로드)";
      safeBtn.setAttribute("aria-label", "저장");
    }
  });
})();
