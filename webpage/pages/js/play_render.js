import * as utils from "./play_utils.js";
import { getDetector } from "./play_detector.js";
import { updateAccuracy } from "./play_main.js";

let latestPoses = [];
let estimating = false;
let renderRaf = null;

// ✅ 정확도 갱신 알림 기능 추가
function showAccuracyUpdateNotification(newAccuracy) {
  // 기존 알림이 있다면 제거
  const existingNotification = document.querySelector('.accuracy-update-notification');
  if (existingNotification) {
    existingNotification.remove();
  }

  // 알림 엘리먼트 생성
  const notification = document.createElement('div');
  notification.className = 'accuracy-update-notification';
  notification.innerHTML = `
    <div class="notification-content">
      🎉 정확도 갱신! ${newAccuracy}%
    </div>
  `;

  // 스타일 적용
  notification.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px 30px;
    border-radius: 15px;
    font-size: 24px;
    font-weight: bold;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    z-index: 1000;
    animation: accuracyPop 2s ease-out forwards;
    backdrop-filter: blur(10px);
    border: 2px solid rgba(255,255,255,0.2);
  `;

  // CSS 애니메이션 추가 (한 번만 추가)
  if (!document.querySelector('#accuracy-animation-styles')) {
    const style = document.createElement('style');
    style.id = 'accuracy-animation-styles';
    style.textContent = `
      @keyframes accuracyPop {
        0% {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.5);
        }
        20% {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1.2);
        }
        40% {
          transform: translate(-50%, -50%) scale(1);
        }
        100% {
          opacity: 0;
          transform: translate(-50%, -50%) scale(1);
        }
      }
      
      .notification-content {
        text-align: center;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
      }
    `;
    document.head.appendChild(style);
  }

  // DOM에 추가
  document.body.appendChild(notification);

  // 2초 후 제거
  setTimeout(() => {
    if (notification && notification.parentNode) {
      notification.remove();
    }
  }, 2000);
}

export function startEstimationPump(videoEl, fps = 12) {
  const detector = getDetector();
  const interval = Math.max(16, Math.floor(1000 / fps));

  async function pump() {
    if (!estimating && detector) {
      estimating = true;
      try {
        const poses = await detector.estimatePoses(videoEl, { flipHorizontal: false });
        latestPoses = poses || [];
      } finally {
        estimating = false;
      }
    }
    setTimeout(pump, interval);
  }
  pump();
}

export function startRenderLoop(canvasEl, ctx, targetKeyRef, bestAccRef) {
  const accNowEl = document.getElementById("accuracyNow");
  const accBestEl = document.getElementById("accuracyBest");

  function render() {
    if (ctx && canvasEl) ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    if (latestPoses && ctx) {
      const kpArr = latestPoses
        .filter(p => p && p.keypoints)
        .map(p => p.keypoints);

      utils.drawMultiSkeleton(kpArr, ctx);

      const target = targetKeyRef.value;
      if (target && kpArr.length) {
        let sim = 0;
        if (Array.isArray(target)) {
          sim = utils.computeMultiSimilarity(kpArr, target);
        } else {
          const vecMe = utils.normalizeKeypoints(kpArr[0]);
          const vecTarget = utils.normalizeKeypoints(target);
          sim = (vecMe && vecTarget) ? utils.computeSimilarity(vecMe, vecTarget) : 0;
        }

        const percent = Math.round(sim * 100);
        if (accNowEl) accNowEl.textContent = `${percent}%`;
        if (percent > bestAccRef.value) {
          bestAccRef.value = percent;
          if (accBestEl) accBestEl.textContent = `${bestAccRef.value}%`;

          // ✅ 정확도 갱신 알림 표시
            showAccuracyUpdateNotification(percent);
        }

        updateAccuracy(percent);
      }
    }
    renderRaf = requestAnimationFrame(render);
  }
  render();
}
