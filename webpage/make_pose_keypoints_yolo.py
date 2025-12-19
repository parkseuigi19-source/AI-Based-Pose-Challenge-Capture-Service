# -*- coding: utf-8 -*-
"""
YOLOv8-Pose 기반 포즈 키포인트 추출 (실패율 개선 버전)
- 입력 크기 고정 (imgsz=960)
- min_conf 강화 (0.5 이상)
- Top-1 인물 선택 시 keypoints 수 + 평균 점수 고려
- 실패 JSON에 meta.failed=True 기록
"""

import os, sys, json, argparse, datetime, shutil
from pathlib import Path
import cv2
import numpy as np

try:
    from ultralytics import YOLO
except ImportError:
    print("[ERROR] ultralytics 라이브러리가 없습니다. 먼저 실행하세요:")
    print("  pip install ultralytics opencv-python numpy tqdm")
    sys.exit(1)

try:
    from tqdm import tqdm
except ImportError:
    tqdm = lambda x, **kw: x

COCO_KP_NAMES = [
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle"
]

def normalize_keypoints_xy(kpts, w, h):
    out = []
    for i, (xx, yy, c) in enumerate(kpts):
        name = COCO_KP_NAMES[i] if i < len(COCO_KP_NAMES) else f"kpt_{i}"
        nx = max(0.0, min(1.0, float(xx) / w))
        ny = max(0.0, min(1.0, float(yy) / h))
        out.append({"name": name, "x": nx, "y": ny, "score": float(c)})
    return out

def normalize_bbox_xyxy(xyxy, w, h):
    x1, y1, x2, y2 = xyxy
    return dict(
        x=max(0.0, float(x1) / w),
        y=max(0.0, float(y1) / h),
        w=max(1e-6, float(x2 - x1) / w),
        h=max(1e-6, float(y2 - y1) / h),
    )

def extract_with_yolo(image_bgr, model, min_conf=0.5, device=None, imgsz=960):
    h, w = image_bgr.shape[:2]
    img_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    results = model.predict(source=img_rgb, conf=min_conf, verbose=False, device=device, imgsz=imgsz)

    people = []
    if not results: 
        return people
    r = results[0]
    if getattr(r, "keypoints", None) is None or r.keypoints.data is None:
        return people

    xyxy = r.boxes.xyxy.cpu().numpy() if r.boxes.xyxy is not None else None
    conf = r.boxes.conf.cpu().numpy() if r.boxes.conf is not None else None
    kpts = r.keypoints.data.cpu().numpy()  # (N,17,3)

    for i in range(kpts.shape[0]):
        kp_norm = normalize_keypoints_xy(kpts[i], w, h)
        bbox = normalize_bbox_xyxy(xyxy[i], w, h) if xyxy is not None else dict(x=0.1,y=0.08,w=0.8,h=0.84)
        score = float(conf[i]) if conf is not None else 0.0
        valid_kps = [k for k in kp_norm if k["score"] > 0.3]
        avg_score = np.mean([k["score"] for k in valid_kps]) if valid_kps else 0.0

        people.append({
            "bbox": bbox,
            "keypoints": kp_norm,
            "score": score,
            "num_valid": len(valid_kps),
            "avg_score": avg_score
        })
    return people

def save_json(json_path, person, img_wh, model_name, failed=False):
    payload = {
        "bbox": {k: round(float(v), 6) for k, v in person.get("bbox", {}).items()},
        "keypoints": person.get("keypoints", []),
        "meta": {
            "model": f"ultralytics.{model_name}",
            "image_w": int(img_wh[0]),
            "image_h": int(img_wh[1]),
            "created": datetime.datetime.now().isoformat(timespec="seconds"),
            "failed": failed
        }
    }
    os.makedirs(os.path.dirname(json_path), exist_ok=True)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

def main():
    ap = argparse.ArgumentParser(description="YOLOv8-Pose 기반 포즈 추출 (실패율 개선)")
    ap.add_argument("--root", type=str, default="./result_images/matching", help="대상 이미지 루트")
    ap.add_argument("--model", type=str, default="yolov8n-pose.pt", help="YOLO pose 가중치")
    ap.add_argument("--device", type=str, default=None, help="cuda:0 / cpu")
    ap.add_argument("--min_conf", type=float, default=0.5, help="탐지 임계값")
    ap.add_argument("--imgsz", type=int, default=960, help="입력 이미지 크기")
    ap.add_argument("--overwrite", action="store_true", help="기존 JSON 덮어쓰기")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    if not root.is_dir():
        print(f"[ERROR] 폴더가 없습니다: {root}")
        sys.exit(1)

    targets = [str(p) for p in root.glob("*") if p.suffix.lower() in [".jpg",".jpeg",".png"]]
    if not targets:
        print("[INFO] 이미지가 없습니다.")
        return

    model = YOLO(args.model)
    ok, fail = 0, 0

    for img_path in tqdm(sorted(targets), desc="processing"):
        json_path = os.path.splitext(img_path)[0] + ".json"
        if (not args.overwrite) and os.path.exists(json_path):
            continue

        img = cv2.imread(img_path)
        if img is None:
            print(f"[WARN] 이미지 로드 실패: {img_path}")
            continue

        h, w = img.shape[:2]
        people = extract_with_yolo(img, model, min_conf=args.min_conf, device=args.device, imgsz=args.imgsz)

        if not people:
            save_json(json_path, {"bbox": {}, "keypoints": []}, (w, h), args.model, failed=True)
            fail += 1
            continue

        # Top-1 선택: keypoints 수 > 평균 점수 > bbox 크기
        people_sorted = sorted(
            people,
            key=lambda p: (p["num_valid"], p["avg_score"], p["bbox"]["w"]*p["bbox"]["h"]),
            reverse=True
        )
        save_json(json_path, people_sorted[0], (w, h), args.model, failed=False)
        ok += 1

    print(f"[DONE] 성공: {ok} / 실패: {fail} (총 {len(targets)})")

if __name__ == "__main__":
    main()
