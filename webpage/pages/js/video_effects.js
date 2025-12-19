const videoEffects = {
  sepia: {
    name: '세피아',
    apply: (canvas, ctx) => {
      ctx.filter = 'sepia(100%)';
      ctx.drawImage(canvas._originalCanvas, 0, 0);
      ctx.filter = 'none';
    }
  },
  grayscale: {
    name: '흑백',
    apply: (canvas, ctx) => {
      ctx.filter = 'grayscale(100%)';
      ctx.drawImage(canvas._originalCanvas, 0, 0);
      ctx.filter = 'none';
    }
  },
  smurf: {
    name: '스머프',
    apply: (canvas, ctx) => {
      ctx.filter = 'hue-rotate(180deg) saturate(200%)';
      ctx.drawImage(canvas._originalCanvas, 0, 0);
      ctx.filter = 'none';
    }
  },
  bright: {
    name: '밝게',
    apply: (canvas, ctx) => {
      ctx.filter = 'brightness(150%)';
      ctx.drawImage(canvas._originalCanvas, 0, 0);
      ctx.filter = 'none';
    }
  },
  warm: {
    name: '따뜻함',
    apply: (canvas, ctx) => {
      ctx.filter = 'sepia(30%) saturate(140%) brightness(110%)';
      ctx.drawImage(canvas._originalCanvas, 0, 0);
      ctx.filter = 'none';
    }
  }
};

// 🎨 효과 목록
window.getAvailableVideoEffects = function() {
  return Object.keys(videoEffects).map(id => ({
    id: id,
    name: videoEffects[id].name
  }));
};

// 🎬 메인 처리 시스템
window.VideoEffectsProcessor = {
  async applyEffectsToVideo(videoElement, selectedEffects = [], options = {}) {
    const { onProgress } = options;
    const progressCallback = onProgress || (() => {});

    try {
      progressCallback(0);

      const videoWidth = videoElement.videoWidth || 640;
      const videoHeight = videoElement.videoHeight || 480;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = videoWidth;
      canvas.height = videoHeight;

      const originalCanvas = document.createElement('canvas');
      const originalCtx = originalCanvas.getContext('2d');
      originalCanvas.width = videoWidth;
      originalCanvas.height = videoHeight;
      canvas._originalCanvas = originalCanvas;

      const stream = canvas.captureStream(30);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8'
      });

      const chunks = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      mediaRecorder.start();

      return new Promise((resolve, reject) => {
        videoElement.currentTime = 0;
        const totalDuration = videoElement.duration || 10;

        // 🎯 진행률 업데이트 (timeupdate 기반)
        videoElement.addEventListener("timeupdate", () => {
          const percent = Math.min(
            100,
            Math.max(1, Math.round((videoElement.currentTime / totalDuration) * 100))
          );
          progressCallback(percent);
        });

        // 🎯 종료 처리
        videoElement.addEventListener("ended", () => {
          if (mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
            mediaRecorder.onstop = () => {
              const blob = new Blob(chunks, { type: "video/webm" });
              resolve(blob);
            };
          }
        });

        // 🎯 프레임 그리기 루프
        const drawFrame = () => {
          if (videoElement.paused || videoElement.ended) return;

          originalCtx.drawImage(videoElement, 0, 0, videoWidth, videoHeight);
          ctx.clearRect(0, 0, videoWidth, videoHeight);

          if (selectedEffects.length === 0) {
            ctx.drawImage(originalCanvas, 0, 0);
          } else {
            selectedEffects.forEach(effectId => {
              if (videoEffects[effectId]) {
                videoEffects[effectId].apply(canvas, ctx);
              }
            });
          }

          requestAnimationFrame(drawFrame);
        };

        videoElement.muted = true;
        videoElement.playsInline = true;
        videoElement.play()
          .then(() => requestAnimationFrame(drawFrame))
          .catch(reject);

        videoElement.onerror = reject;
        mediaRecorder.onerror = reject;
      });
    } catch (error) {
      console.error('효과 처리 중 오류:', error);
      throw error;
    }
  }
};

// 🎯 다운로드 함수 (필터 이름 반영)
window.downloadVideoWithEffects = async function(videoElement, selectedEffects = [], today = "video") {
  if (!videoElement || !videoElement.src) {
    alert('다운로드할 비디오가 없습니다.');
    return;
  }

  if (!selectedEffects || selectedEffects.length === 0) {
    downloadOriginalVideo(videoElement, today);
    return;
  }

  const overlay = createProgressOverlay();
  document.body.appendChild(overlay);

  try {
    const processedBlob = await window.VideoEffectsProcessor.applyEffectsToVideo(
      videoElement,
      selectedEffects,
      {
        onProgress: (percent) => {
          updateProgressOverlay(overlay, `효과 적용 중... ${percent}%`, percent);
        }
      }
    );

    if (processedBlob) {
      updateProgressOverlay(overlay, '다운로드 준비 중...', 100);

      const url = URL.createObjectURL(processedBlob);
      const link = document.createElement('a');
      link.href = url;
      const effectName = selectedEffects[0] || "effect";
      link.download = `${today}_${effectName}.mp4`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  } catch (error) {
    console.error('효과 적용 실패:', error);
    alert('효과 적용 중 오류가 발생했습니다. 원본을 다운로드합니다.');
    downloadOriginalVideo(videoElement, today);
  } finally {
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay);
    }
  }
};

function downloadOriginalVideo(videoElement, today) {
  const link = document.createElement('a');
  link.href = videoElement.src;
  link.download = `${today}_original.mp4`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function createProgressOverlay() {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.85);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    color: white;
    font-family: Arial, sans-serif;
  `;

  const text = document.createElement('div');
  text.style.cssText = `
    font-size: 1.8rem;
    font-weight: 600;
    margin-bottom: 20px;
  `;
  text.textContent = '처리 시작...';

  const progressContainer = document.createElement('div');
  progressContainer.style.cssText = `
    width: 60%;
    height: 25px;
    border: 2px solid #fff;
    border-radius: 8px;
    overflow: hidden;
  `;

  const progressBar = document.createElement('div');
  progressBar.style.cssText = `
    width: 0%;
    height: 100%;
    background: lime;
    transition: width 0.2s linear;
  `;

  progressContainer.appendChild(progressBar);
  overlay.appendChild(text);
  overlay.appendChild(progressContainer);

  overlay._textEl = text;
  overlay._progressEl = progressBar;

  return overlay;
}

function updateProgressOverlay(overlay, text, percent) {
  if (overlay._textEl) overlay._textEl.textContent = text;
  if (overlay._progressEl) {
    overlay._progressEl.style.width = percent + '%';
    overlay._progressEl.offsetWidth; // 🔑 강제 리플로우
  }
}
