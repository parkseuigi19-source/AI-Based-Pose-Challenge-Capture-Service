from common import (
    FastAPI, Request, HTMLResponse, RedirectResponse, StaticFiles, Jinja2Templates,
    cv2, mp, Image, np, pd, os, json, shutil, time, datetime,
    IMG_PC_DIR, IMG_RESULT_DIR, MUSIC_DIR, PAGES_HTML_DIR, PAGES_CSS_DIR, PAGES_JS_DIR
)
from fastapi.responses import FileResponse
from fastapi import UploadFile, File
import base64

app = FastAPI()

# -------------------------
# 정적 파일 라우팅
# -------------------------
app.mount("/static/css", StaticFiles(directory=PAGES_CSS_DIR), name="css")
app.mount("/static/js", StaticFiles(directory=PAGES_JS_DIR), name="js")
app.mount("/static/images", StaticFiles(directory=IMG_PC_DIR), name="images")
app.mount("/static/result_images", StaticFiles(directory=IMG_RESULT_DIR), name="result_images")
app.mount("/static/music", StaticFiles(directory=MUSIC_DIR), name="music")

templates = Jinja2Templates(directory=PAGES_HTML_DIR)

# -------------------------
# favicon
# -------------------------
@app.get("/favicon.ico")
async def favicon():
    favicon_path = os.path.join(IMG_PC_DIR, "favicon.ico")
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path)
    return HTMLResponse(status_code=204)

# -------------------------
# 페이지 라우팅
# -------------------------
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("main.html", {"request": request})

@app.get("/setting", response_class=HTMLResponse)
async def get_setting(request: Request):
    return templates.TemplateResponse("setting.html", {"request": request})

@app.get("/play", response_class=HTMLResponse)
async def get_play(request: Request):
    today = datetime.now().strftime("%Y-%m-%d")

    # ---- 캡처 폴더 ----
    capture_base = os.path.join(IMG_RESULT_DIR, "capture", today)
    os.makedirs(capture_base, exist_ok=True)
    subfolders = [f for f in os.listdir(capture_base) if os.path.isdir(os.path.join(capture_base, f))]
    if not subfolders:
        folder_nm = "1"
    else:
        nums = [int(f) for f in subfolders if f.isdigit()]
        folder_nm = str(max(nums) + 1 if nums else 1)

    capture_path = os.path.join(capture_base, folder_nm)
    os.makedirs(capture_path, exist_ok=True)

    # ---- 비디오 폴더 (같은 번호) ----
    video_base = os.path.join(IMG_RESULT_DIR, "video", today)
    os.makedirs(video_base, exist_ok=True)
    video_path = os.path.join(video_base, folder_nm)
    os.makedirs(video_path, exist_ok=True)

    # ✅ 세션 초기화 + 공통 번호 공유
    result_store["capture_session"] = folder_nm
    result_store["capture_count"] = 0
    result_store["video_session"] = folder_nm

    print(f"[play] new session started: capture={capture_path}, video={video_path}")
    return templates.TemplateResponse("play.html", {"request": request})

# -------------------------
# 결과 데이터 보관소
# -------------------------
result_store = {}

@app.post("/result_redirect")
async def result_redirect(request: Request):
    data = await request.json()

    result_store["latest"] = {
        "date": data.get("date"),
        "folder": data.get("folder"),
        "player": data.get("player"),
        "max_image": data.get("max_image"),
        "images_nm": data.get("images_nm", []),
        "images_ac": data.get("images_ac", []),
        "best_ac": data.get("best_ac", 0),
        "targets": data.get("targets", [])
    }

    # ✅ 게임 종료 후 세션 정리
    if "capture_session" in result_store:
        del result_store["capture_session"]
    if "capture_count" in result_store:
        del result_store["capture_count"]
    if "video_session" in result_store:
        del result_store["video_session"]

    return RedirectResponse(url="/result", status_code=303)

@app.get("/result", response_class=HTMLResponse)
async def get_result(request: Request):
    data = result_store.get("latest", {})
    return templates.TemplateResponse("result.html", {
        "request": request,
        "data": data
    })

# -------------------------
# 캡처 (현재 세션 폴더에 저장)
# -------------------------
@app.post("/capture")
async def capture(req: Request):
    if "capture_session" not in result_store:
        return {"status": "error", "message": "No active capture session. /play 먼저 실행하세요."}

    data = await req.json()
    image = data["image"]

    today = datetime.now().strftime("%Y-%m-%d")
    base_folder = os.path.join(IMG_RESULT_DIR, "capture", today)
    folder_nm = result_store["capture_session"]
    subfolder_path = os.path.join(base_folder, folder_nm)

    # 파일 번호 증가
    result_store["capture_count"] += 1
    idx = result_store["capture_count"]
    filename = f"{today}_{idx}.jpg"
    filepath = os.path.join(subfolder_path, filename)

    with open(filepath, "wb") as f:
        f.write(base64.b64decode(image.split(",")[1]))

    print(f"[capture] saved {filepath}")
    return {"status": "ok", "session": folder_nm, "saved": filename}

# -------------------------
# 비디오 업로드 (세션 폴더에 저장)
# -------------------------
@app.post("/upload_video")
async def upload_video(file: UploadFile = File(...)):
    if "video_session" not in result_store:
        return {"status": "error", "message": "No active video session. /play 먼저 실행하세요."}

    today = datetime.now().strftime("%Y-%m-%d")
    base_folder = os.path.join(IMG_RESULT_DIR, "video", today)
    folder_nm = result_store["video_session"]
    subfolder_path = os.path.join(base_folder, folder_nm)
    os.makedirs(subfolder_path, exist_ok=True)

    mp4_path = os.path.join(subfolder_path, f"{today}.mp4")

    try:
        with open(mp4_path, "wb") as f:
            content = await file.read()
            f.write(content)
    except Exception as e:
        return {"status": "error", "message": str(e)}

    web_path = f"/static/result_images/video/{today}/{folder_nm}/{today}.mp4"
    print(f"[upload_video] saved {mp4_path}")
    return {"status": "ok", "path": web_path}

# -------------------------
# 실행
# -------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
