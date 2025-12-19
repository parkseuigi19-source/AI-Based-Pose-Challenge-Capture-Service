#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
make_pose_keypoints.py

- 이미지들에서 포즈 키포인트를 추출해 JSON으로 저장
- 픽셀 좌표(keypoints_px, bbox_px) + 정규화(keypoints, bbox) 모두 저장
- 단일(.json) + 다인(.multi.json) 동시 출력
- 실패 이미지는 result_images/matching/failed/ 로 이동(기존 json도 함께 이동)
- 백엔드: ultralytics YOLO Pose(멀티) / MediaPipe Pose(단일) 자동 선택 또는 강제 지정

Author: you
"""

import os
import sys
import glob
import json
import shutil
import argparse
import datetime
from typing import List, Dict, Any, Tuple

# ---------------------------
# Optional deps
# ---------------------------
_HAS_ULTRA = False
_HAS_MP = False

try:
    from ultralytics import YOLO
    _HAS_ULTRA = True
except Exception:
    _HAS_ULTRA = False

try:
    import mediapipe as mp
    import cv2
    _HAS_MP = True
except Exception:
    _HAS_MP = False
    cv2 = None

from PIL import Image


# ---------------------------
# Constants / Keypoint name maps
# ---------------------------

# COCO 17 keypoints (YOLO pose order)
COCO_NAMES = [
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle"
]

# Map MediaPipe Pose landmarks to our common set (subset)
# (https://google.github.io/mediapipe/solutions/pose#pose-landmark-model-blazepose-ghum-3d)
MP_TO_COMMON = {
    "nose": "nose",
    "left_eye": "left_eye", "right_eye": "right_eye",
    "left_ear": "left_ear", "right_ear": "right_ear",
    "left_shoulder": "left_shoulder", "right_shoulder": "right_shoulder",
    "left_elbow": "left_elbow", "right_elbow": "right_elbow",
    "left_wrist": "left_wrist", "right_wrist": "right_wrist",
    "left_hip": "left_hip", "right_hip": "right_hip",
    "left_knee": "left_knee", "right_knee": "right_knee",
    "left_ankle": "left_ankle", "right_ankle": "right_ankle",
}

# MediaPipe indices to names (v0.10.x Pose)
MP_IDX2NAME = {
    0: "nose",
    1: "left_eye_inner", 2: "left_eye", 3: "left_eye_outer",
    4: "right_eye_inner", 5: "right_eye", 6: "right_eye_outer",
    7: "left_ear", 8: "right_ear",
    11: "left_shoulder", 12: "right_shoulder",
    13: "left_elbow", 14: "right_elbow",
    15: "left_wrist", 16: "right_wrist",
    23: "left_hip", 24: "right_hip",
    25: "left_knee", 26: "right_knee",
    27: "left_ankle", 28: "right_ankle",
}


# ---------------------------
# Helpers
# ---------------------------

def now_str() -> str:
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def is_image_path(p: str) -> bool:
    ext = os.path.splitext(p)[1].lower()
    return ext in (".jpg", ".jpeg", ".png", ".bmp", ".webp")

def ensure_dir(p: str):
    os.makedirs(p, exist_ok=True)

def bbox_from_points(pxys: List[Tuple[float, float]], W: int, H: int) -> Tuple[int,int,int,int]:
    xs = [x for x, y in pxys if x is not None and y is not None]
    ys = [y for x, y in pxys if x is not None and y is not None]
    if not xs or not ys:
        return 0, 0, W, H
    minx, maxx = max(0, min(xs)), min(W-1, max(xs))
    miny, maxy = max(0, min(ys)), min(H-1, max(ys))
    w = max(1, int(round(maxx - minx)))
    h = max(1, int(round(maxy - miny)))
    return int(round(minx)), int(round(miny)), w, h

def norm_xy(x: float, y: float, W: int, H: int) -> Tuple[float, float]:
    return (float(x) / float(W), float(y) / float(H))

def norm_bbox(x: int, y: int, w: int, h: int, W: int, H: int) -> Dict[str, float]:
    return {
        "x": float(x)/float(W),
        "y": float(y)/float(H),
        "w": float(w)/float(W),
        "h": float(h)/float(H),
    }

def move_to_failed(img_path: str, failed_root: str, overwrite: bool):
    """
    Move image and its paired .json/.multi.json to failed folder preserving relative subdirs.
    """
    ensure_dir(failed_root)

    base = os.path.splitext(img_path)[0]
    json1 = base + ".json"
    jsonm = base + ".multi.json"

    # Move image
    dst_img = os.path.join(failed_root, os.path.basename(img_path))
    if overwrite or not os.path.exists(dst_img):
        shutil.move(img_path, dst_img)

    # Move paired JSONs if exist
    for j in (json1, jsonm):
        if os.path.exists(j):
            dst_j = os.path.join(failed_root, os.path.basename(j))
            if overwrite or not os.path.exists(dst_j):
                shutil.move(j, dst_j)

def save_json(path: str, data: Dict[str, Any], overwrite: bool):
    if (not overwrite) and os.path.exists(path):
        print(f"[skip] exists: {path}")
        return
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"[save] {path}")


# ---------------------------
# Backends
# ---------------------------

class BackendBase:
    name = "base"
    def infer(self, img_bgr, min_conf: float) -> List[Dict[str, Any]]:
        """Return list of people dict: { 'score':float, 'keypoints_px': [{'name', 'x','y','score'}] }"""
        raise NotImplementedError

class UltraBackend(BackendBase):
    name = "ultra"
    def __init__(self):
        # yolo pose pretrained default
        # If you have a specific model file, put its path here
        self.model = YOLO("yolov8n-pose.pt")

    def infer(self, img_bgr, min_conf: float) -> List[Dict[str, Any]]:
        H, W = img_bgr.shape[:2]
        res = self.model.predict(source=img_bgr, verbose=False)
        people = []
        for r in res:
            if r.keypoints is None:
                continue
            kps = r.keypoints.data.cpu().numpy()  # shape: [num, 17, 3]
            # r.boxes.conf: per person conf
            scores = r.boxes.conf.cpu().numpy() if r.boxes is not None else [0.0]*len(kps)
            for i, kp in enumerate(kps):
                conf_person = float(scores[i]) if i < len(scores) else float(kp[:,2].mean())
                if conf_person < min_conf:
                    continue
                pts = []
                for idx, (x, y, s) in enumerate(kp):
                    name = COCO_NAMES[idx] if idx < len(COCO_NAMES) else f"k{idx}"
                    if s <= 0:
                        continue
                    # clamp
                    x = max(0, min(W-1, float(x)))
                    y = max(0, min(H-1, float(y)))
                    pts.append({"name": name, "x": x, "y": y, "score": float(s)})
                if not pts:
                    continue
                people.append({"score": conf_person, "keypoints_px": pts})
        # sort by x-center for stable slot
        def x_center(person):
            xs = [p["x"] for p in person["keypoints_px"]]
            return sum(xs)/len(xs) if xs else 0.0
        people.sort(key=x_center)
        # add slot index
        for i, p in enumerate(people):
            p["slot"] = i
        return people

class MPPoseBackend(BackendBase):
    name = "mediapipe"
    def __init__(self):
        # single-person
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(static_image_mode=True, model_complexity=1, enable_segmentation=False)

    def infer(self, img_bgr, min_conf: float) -> List[Dict[str, Any]]:
        # MediaPipe expects RGB
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        res = self.pose.process(img_rgb)
        H, W = img_bgr.shape[:2]
        if not res.pose_landmarks:
            return []
        pts = []
        # pick subset that maps to our common names
        for idx, lm in enumerate(res.pose_landmarks.landmark):
            if idx not in MP_IDX2NAME:
                continue
            name = MP_IDX2NAME[idx]
            if name not in MP_TO_COMMON:
                continue
            x = lm.x * W
            y = lm.y * H
            v = lm.visibility if hasattr(lm, "visibility") else 1.0
            # clamp
            x = max(0, min(W-1, float(x)))
            y = max(0, min(H-1, float(y)))
            pts.append({"name": MP_TO_COMMON[name], "x": x, "y": y, "score": float(v)})
        if not pts:
            return []
        score = sum(p["score"] for p in pts)/len(pts)
        if score < min_conf:
            return []
        # single person slot=0
        return [{"score": score, "slot": 0, "keypoints_px": pts}]


def pick_backend(backend_arg: str) -> BackendBase:
    b = backend_arg.lower()
    if b == "ultra":
        if not _HAS_ULTRA:
            print("[warn] ultralytics not installed; falling back to MediaPipe")
        else:
            return UltraBackend()
    if b == "mediapipe":
        if not _HAS_MP:
            print("[error] mediapipe/cv2 not available.")
            sys.exit(1)
        return MPPoseBackend()

    # auto
    if _HAS_ULTRA:
        print("[info] backend=auto -> using ultralytics YOLO pose")
        return UltraBackend()
    elif _HAS_MP:
        print("[info] backend=auto -> using MediaPipe pose (single person)")
        return MPPoseBackend()
    else:
        print("[error] No backend available. Install ultralytics or mediapipe+opencv.")
        sys.exit(1)


# ---------------------------
# Main
# ---------------------------

def process_image(img_path: str, backend: BackendBase, overwrite: bool, min_conf: float, failed_dir: str):
    try:
        # Load image (BGR if using OpenCV pipeline, but for PIL we need W,H only)
        if cv2 is not None:
            img_bgr = cv2.imdecode(
                np.fromfile(img_path, dtype=np.uint8), cv2.IMREAD_COLOR
            ) if "|" in sys.executable else cv2.imread(img_path)
            if img_bgr is None:
                # fallback PIL to compute size, but backend needs ndarray; mark fail
                with Image.open(img_path) as im:
                    W, H = im.size
                print(f"[fail] cannot read image by cv2: {img_path}")
                move_to_failed(img_path, failed_dir, overwrite)
                return
            H, W = img_bgr.shape[:2]
        else:
            with Image.open(img_path) as im:
                W, H = im.size
            # backend will fail anyway without cv2; guard
            print("[error] OpenCV not available; cannot run backend. Move to failed.")
            move_to_failed(img_path, failed_dir, overwrite)
            return

        people = backend.infer(img_bgr, min_conf=min_conf)
        base = os.path.splitext(img_path)[0]
        dirn = os.path.dirname(img_path)
        # failed dir is fixed to .../result_images/matching/failed under the *matching root* (handled by caller)

        if not people:
            print(f"[no person or low conf] {img_path}")
            move_to_failed(img_path, failed_dir, overwrite)
            return

        # build jsons
        created_at = now_str()

        # single choice: best person (by score), but also save .multi.json
        best = max(people, key=lambda p: p.get("score", 0.0))
        # slot order already assigned

        # build per-person dicts
        def build_person_dict(p: Dict[str, Any]) -> Dict[str, Any]:
            kpx = p["keypoints_px"]
            pxys = [(kp["x"], kp["y"]) for kp in kpx]
            bx, by, bw, bh = bbox_from_points(pxys, W, H)
            person = {
                "slot": int(p.get("slot", 0)),
                "bbox_px": {"x": bx, "y": by, "w": bw, "h": bh},
                "bbox": norm_bbox(bx, by, bw, bh, W, H),
                "keypoints_px": [{"name": kp["name"], "x": float(kp["x"]), "y": float(kp["y"]), "score": float(kp.get("score", 1.0))} for kp in kpx],
                "keypoints": [{"name": kp["name"], "x": norm_xy(kp["x"], kp["y"], W, H)[0], "y": norm_xy(kp["x"], kp["y"], W, H)[1]} for kp in kpx],
                "score": float(p.get("score", 0.0))
            }
            return person

        people_json = [build_person_dict(p) for p in people]
        best_json = build_person_dict(best)

        single_out = {
            "version": "1.1",
            "created_at": created_at,
            "source_size": {"w": W, "h": H},
            # 단일 파일에도 people 구조를 쓸 수도 있지만, 기존 호환을 위해 단일 인물 형태 유지
            "bbox_px": best_json["bbox_px"],
            "bbox": best_json["bbox"],
            "keypoints_px": best_json["keypoints_px"],
            "keypoints": best_json["keypoints"],
            "slot": best_json["slot"],
            "score": best_json["score"]
        }

        multi_out = {
            "version": "1.1",
            "created_at": created_at,
            "source_size": {"w": W, "h": H},
            "people": people_json
        }

        save_json(base + ".json", single_out, overwrite)
        save_json(base + ".multi.json", multi_out, overwrite)

    except Exception as e:
        print(f"[error] {img_path}: {e}")
        # on error, move to failed
        move_to_failed(img_path, failed_dir, overwrite)


def collect_images(root: str, recursive: bool, patterns: List[str]) -> List[str]:
    files = []
    if recursive:
        for pat in patterns:
            files.extend(glob.glob(os.path.join(root, "**", pat), recursive=True))
    else:
        for pat in patterns:
            files.extend(glob.glob(os.path.join(root, pat)))
    # filter only images
    files = [f for f in files if is_image_path(f)]
    files.sort()
    return files


def resolve_failed_dir(root: str) -> str:
    """
    - root 가 ".../result_images/matching" 인 경우 그 안의 "failed"를 반환
    - 하위(예: .../matching/1)를 넘겨도 상위 matching 을 찾아 failed 로 고정
    """
    # 탐색: root에서 위로 올라가며 'matching' 폴더를 찾는다
    cur = os.path.abspath(root)
    target = None
    for _ in range(5):
        base = os.path.basename(cur)
        if base.lower() == "matching":
            target = cur
            break
        parent = os.path.dirname(cur)
        if parent == cur:
            break
        cur = parent
    if target is None:
        target = os.path.abspath(root)
    failed = os.path.join(target, "failed")
    ensure_dir(failed)
    return failed


def parse_args():
    p = argparse.ArgumentParser(description="Generate pose keypoints JSONs (.json & .multi.json)")
    p.add_argument("--root", required=True, help="Root folder to scan (e.g., ...\\WebContent\\result_images\\matching)")
    p.add_argument("--recursive", action="store_true", help="Recurse into subdirectories")
    p.add_argument("--overwrite", action="store_true", help="Overwrite existing JSONs")
    p.add_argument("--min_conf", type=float, default=0.3, help="Minimum confidence to accept a person (0~1, default 0.3)")
    p.add_argument("--backend", choices=["auto","ultra","mediapipe"], default="auto", help="Pose backend (default: auto)")
    p.add_argument("--patterns", default="*.jpg,*.jpeg,*.png,*.bmp,*.webp", help="Comma-separated glob patterns")
    return p.parse_args()


def main():
    args = parse_args()
    root = args.root
    patterns = [s.strip() for s in args.patterns.split(",") if s.strip()]

    if not os.path.isdir(root):
        print(f"[error] root not found: {root}")
        sys.exit(1)

    failed_dir = resolve_failed_dir(root)
    print(f"[info] failed dir: {failed_dir}")

    backend = pick_backend(args.backend)
    print(f"[info] backend: {backend.name}")

    imgs = collect_images(root, args.recursive, patterns)
    print(f"[info] images: {len(imgs)} file(s)")

    if not imgs:
        return

    # numpy lazy import to support cv2.imdecode on Windows long path case
    global np
    import numpy as np

    for i, img in enumerate(imgs, 1):
        print(f"[{i}/{len(imgs)}] {img}")
        process_image(
            img_path=img,
            backend=backend,
            overwrite=args.overwrite,
            min_conf=args.min_conf,
            failed_dir=failed_dir
        )

    print("[done] All images processed.")


if __name__ == "__main__":
    main()
