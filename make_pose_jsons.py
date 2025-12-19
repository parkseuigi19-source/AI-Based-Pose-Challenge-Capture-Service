# make_pose_jsons.py
from pathlib import Path
import json

# 1) 현재 스크립트 위치 기준으로 경로 계산
HERE = Path(__file__).resolve().parent
ROOT = HERE / "result_images" / "matching"   # WebContent/result_images/matching

# 2) 폴더별 기본 bbox 값 (0~1 정규화 좌표)
DEFAULTS = {
    # 중앙 한 명, 머리~발끝 커버
    "1": {"x": 0.28, "y": 0.05, "w": 0.44, "h": 0.90},

    # 좌우 두 명, 넉넉한 범위
    "2": {"x": 0.10, "y": 0.05, "w": 0.80, "h": 0.90},

    # 세 명, 가로로 넓게
    "3": {"x": 0.08, "y": 0.08, "w": 0.84, "h": 0.82},

    # 네 명, 거의 전체 화면 (2x2 배치)
    "4": {"x": 0.05, "y": 0.05, "w": 0.90, "h": 0.88},
}

def gen():
    print(f"ROOT = {ROOT}")
    for group in ["1", "2", "3", "4"]:
        img_dir = ROOT / group
        if not img_dir.exists():
            print(f"❌ 폴더 없음: {img_dir}")
            continue

        # jpg / jpeg / png 모두 처리
        images = []
        for pat in ("*.jpg", "*.jpeg", "*.png"):
            images += list(img_dir.glob(pat))

        if not images:
            print(f"⚠ 이미지 없음: {img_dir}")
            continue

        for img_path in images:
            json_path = img_path.with_suffix(".json")
            if json_path.exists():
                print(f"⏭ 이미 있음: {json_path.name}")
                continue

            data = {"bbox": DEFAULTS[group]}
            json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"✅ 생성됨: {json_path.name}")

    print("🎉 모든 JSON 파일 생성 완료!")

if __name__ == "__main__":
    gen()
