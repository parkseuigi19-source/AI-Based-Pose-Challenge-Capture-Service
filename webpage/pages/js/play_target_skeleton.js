import { initDetector, detectTargetKeys } from "./play_detector.js";
import { drawMultiSkeleton } from "./play_utils.js";

function waitImageLoaded(img) {
  return new Promise((resolve, reject) => {
    if (!img) return reject(new Error("#targetImage not found"));
    if (img.complete && img.naturalWidth > 0) return resolve();
    img.onload = () => resolve();
    img.onerror = (e) => reject(e);
  });
}

function ensureTargetCanvas(imgEl) {
  let canvas = document.getElementById("targetSkeletonCanvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "targetSkeletonCanvas";
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.pointerEvents = "none";
    imgEl.parentNode.style.position = imgEl.parentNode.style.position || "relative";
    imgEl.parentNode.appendChild(canvas);
  }
  return canvas;
}

function syncCanvasToImage(canvas, imgEl) {
  canvas.width = imgEl.naturalWidth || imgEl.width;
  canvas.height = imgEl.naturalHeight || imgEl.height;
  const rect = imgEl.getBoundingClientRect();
  canvas.style.width = rect.width + "px";
  canvas.style.height = rect.height + "px";
}

function drawTargetSkeleton(keysArray, imgEl) {
  if (!keysArray || !keysArray.length) return;
  const canvas = ensureTargetCanvas(imgEl);
  syncCanvasToImage(canvas, imgEl);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMultiSkeleton(keysArray, ctx);
}

async function main() {
  const img = document.getElementById("targetImage");
  if (!img) return;

  try {
    await waitImageLoaded(img);
    await initDetector();
    const keys = await detectTargetKeys(img);

    if (!window.targetKeyRef) window.targetKeyRef = { value: null };
    window.targetKeyRef.value = keys || [];
    window.targetKey = window.targetKeyRef.value;

    if (Array.isArray(window.targetKeyRef.value) && window.targetKeyRef.value.length) {
      drawTargetSkeleton(window.targetKeyRef.value, img);
    } else {
      const c = document.getElementById("targetSkeletonCanvas");
      if (c) c.getContext("2d").clearRect(0, 0, c.width, c.height);
    }

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        const c = document.getElementById("targetSkeletonCanvas");
        if (c) syncCanvasToImage(c, img);
      });
      ro.observe(img);
    }
  } catch (err) {
    console.error("[play_target_skeleton] error:", err);
    if (!window.targetKeyRef) window.targetKeyRef = { value: null };
    window.targetKeyRef.value = null;
    window.targetKey = null;
  }
}

window.addEventListener("DOMContentLoaded", main);
