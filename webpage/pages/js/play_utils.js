const JOINT_PAIRS = [
  ["left_shoulder","right_shoulder"],["left_shoulder","left_elbow"],["left_elbow","left_wrist"],
  ["right_shoulder","right_elbow"],["right_elbow","right_wrist"],["left_shoulder","left_hip"],
  ["right_shoulder","right_hip"],["left_hip","right_hip"],["left_hip","left_knee"],
  ["left_knee","left_ankle"],["right_hip","right_knee"],["right_knee","right_ankle"]
];

export function drawSkeleton(keypoints, ctx, color="rgba(239,68,68,.9)") {
  if (!keypoints || !ctx) return;
  const by = {}; keypoints.forEach(k => (by[k.name] = k));
  ctx.save();
  ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.beginPath();
  JOINT_PAIRS.forEach(([a,b]) => {
    const pa = by[a], pb = by[b];
    if (!pa || !pb) return;
    ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
  });
  ctx.stroke();
  keypoints.forEach(k => {
    if (!k) return;
    ctx.beginPath(); ctx.arc(k.x, k.y, 4, 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();
}

export function drawMultiSkeleton(allKeypoints, ctx) {
  if (!allKeypoints || !Array.isArray(allKeypoints)) return;
  const colors = [
    "rgba(34,197,94,.95)",  
    "rgba(59,130,246,.95)", 
    "rgba(244,114,182,.95)",
    "rgba(250,204,21,.95)"  
  ];
  allKeypoints.forEach((kp, i) => {
    drawSkeleton(kp, ctx, colors[i % colors.length]);
  });
}

export function normalizeKeypoints(keypoints) {
  if (!keypoints) return null;
  const byName = {};
  keypoints.forEach(k => (byName[k.name] = k));

  const lh = byName["left_hip"], rh = byName["right_hip"];
  const ls = byName["left_shoulder"], rs = byName["right_shoulder"];
  if (!lh || !rh || !ls || !rs) return null;

  const cx = (lh.x + rh.x) / 2, cy = (lh.y + rh.y) / 2;
  const torso = Math.hypot(((ls.x + rs.x) / 2 - cx), ((ls.y + rs.y) / 2 - cy)) || 1;

  const order = [
    "nose","left_eye","right_eye","left_shoulder","right_shoulder","left_elbow","right_elbow",
    "left_wrist","right_wrist","left_hip","right_hip","left_knee","right_knee","left_ankle","right_ankle"
  ];
  const arr = [];
  for (const n of order) {
    const p = byName[n];
    arr.push(p ? (p.x - cx) / torso : 0, p ? (p.y - cy) / torso : 0);
  }
  return arr;
}

export function computeSimilarity(a, b) {
  if (!a || !b) return 0;
  let dot = 0, na = 0, nb = 0;
  const L = Math.min(a.length, b.length);
  for (let i = 0; i < L; i++) {
    dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i];
  }
  const cos = dot / ((Math.sqrt(na) * Math.sqrt(nb)) || 1e-6);
  return (Math.max(-1, Math.min(1, cos)) + 1) / 2;
}

// ✅ 다대다 매칭 (탐욕적 평균)
export function computeMultiSimilarity(keysA, keysB) {
  const A = (keysA || []).map(normalizeKeypoints).filter(Boolean);
  const B = (keysB || []).map(normalizeKeypoints).filter(Boolean);
  if (!A.length || !B.length) return 0;

  const used = new Set();
  let sum = 0, cnt = 0;

  for (let i = 0; i < A.length; i++) {
    let bestJ = -1, best = -1;
    for (let j = 0; j < B.length; j++) {
      if (used.has(j)) continue;
      const s = computeSimilarity(A[i], B[j]);
      if (s > best) { best = s; bestJ = j; }
    }
    if (bestJ >= 0) {
      used.add(bestJ); sum += best; cnt++;
    }
  }
  return cnt ? (sum / cnt) : 0;
}
