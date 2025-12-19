export async function initCameraWithFallback(videoEl) {
  const constraintsList = [
    { video: { width: { exact: 640 }, height: { exact: 480 }, frameRate: { ideal: 30 }, facingMode: "user" }, audio: false },
    { video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 }, facingMode: "user" }, audio: false },
    { video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: "user" }, audio: false },
    { video: true, audio: false }
  ];
  let lastErr = null;
  for (const c of constraintsList) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(c);
      videoEl.srcObject = stream;
      await new Promise(res => (videoEl.onloadedmetadata = res));
      await videoEl.play();
      return;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("getUserMedia failed.");
}

export function resizeCanvasToVideo(canvasEl, videoEl) {
  if (!canvasEl || !videoEl) return;
  canvasEl.width  = videoEl.videoWidth  || 640;
  canvasEl.height = videoEl.videoHeight || 480;
}
