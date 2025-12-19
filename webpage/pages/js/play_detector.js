let detector = null;

// ✅ MoveNet MultiPose로 초기화
export async function initDetector() {
  if (detector) return detector;
  await tf.setBackend("webgl");
  await tf.ready();
  detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    {
      modelType: poseDetection.movenet.modelType.MULTIPOSE_LIGHTNING,
      enableSmoothing: true
    }
  );
  return detector;
}

export function getDetector() {
  return detector;
}

// ✅ 기준 이미지에서 여러 명 포즈 추출
export async function detectTargetKeys(imgEl) {
  const det = await initDetector();
  const w = imgEl.naturalWidth || imgEl.width;
  const h = imgEl.naturalHeight || imgEl.height;
  const tmp = document.createElement("canvas");
  tmp.width = w; tmp.height = h;
  tmp.getContext("2d").drawImage(imgEl, 0, 0);

  const poses = await det.estimatePoses(tmp, { flipHorizontal: false });
  return (poses || [])
    .filter(p => p && p.keypoints && p.keypoints.length)
    .map(p => p.keypoints);
}

// ✅ 역호환 (첫 번째 사람만 반환)
export async function detectTargetKey(imgEl) {
  const arr = await detectTargetKeys(imgEl);
  return arr[0] || null;
}
