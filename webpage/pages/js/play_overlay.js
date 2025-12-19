import { stopWebcamRecordingAndUpload } from "./play_main.js";

export function showSavingOverlay() {
  const overlay = document.getElementById("savingOverlay");
  if (overlay) overlay.classList.remove("hidden");
}

export function hideSavingOverlay() {
  const overlay = document.getElementById("savingOverlay");
  if (overlay) overlay.classList.add("hidden");
}

export function updateSavingProgress(percent) {
  const bar = document.getElementById("savingProgress");
  if (bar) bar.style.width = percent + "%";
  const text = document.getElementById("savingText");
  if (text) text.innerText = `영상 저장 중... ${percent}%`;
}

// ----------------------------
// 로딩 오버레이
// ----------------------------
export async function showLoadingOverlay() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.classList.remove("hidden");
  if (window.CamGuide) window.CamGuide.hide();
}

export function hideLoadingOverlay() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.classList.add("hidden");
}

// ----------------------------
// 라운드 준비/시작 오버레이
// ----------------------------
export async function showRoundOverlay(roundIdx) {
  return new Promise(resolve => {
    const overlay = document.getElementById("roundOverlay");
    const textEl = document.getElementById("roundText");
    if (!overlay || !textEl) return resolve();

    // 🔹 준비할 때는 가이드 숨기기
    if (window.CamGuide) window.CamGuide.hide();

    overlay.classList.remove("hidden");
    textEl.textContent = `${roundIdx}번째 준비...`;

    setTimeout(() => { textEl.textContent = "시작!"; }, 2300);

    setTimeout(() => {
      overlay.classList.add("hidden");

      // 🔹 "시작!" 끝나면 가이드 다시 보이게
      if (window.CamGuide) window.CamGuide.show();

      resolve();
    }, 3300);
  });
}

// ----------------------------
// 종료 오버레이
// ----------------------------
export async function showEndOverlay(attemptNum, bestAcc) {
  return new Promise(resolve => {
    const overlay = document.getElementById("endOverlay");
    const textEl = document.getElementById("endText");
    if (!overlay || !textEl) return resolve();

    // 🔹 종료할 때는 가이드 숨기기
    if (window.CamGuide) window.CamGuide.hide();

    overlay.classList.remove("hidden");
    textEl.textContent = "종료!";

    setTimeout(async () => {
      overlay.classList.add("hidden");

      await stopWebcamRecordingAndUpload();
      location.href = `/result?n=${attemptNum}&a=${bestAcc.value}`;
      resolve();
    }, 2000);
  });
}
