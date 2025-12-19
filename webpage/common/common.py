from common.import_data import os

# WebContent까지의 기본 경로
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))

# 이미지의 경로
IMG_DIR         = os.path.join(BASE_DIR, "images")
IMG_PC_DIR      = os.path.join(IMG_DIR, "pc")
IMG_MOBILE_DIR  = os.path.join(IMG_DIR, "mobile")

# result_images(출력 및 저장)의 경로
IMG_RESULT_DIR          = os.path.join(BASE_DIR, "result_images")
IMG_RESULT_CAP_DIR      = os.path.join(IMG_RESULT_DIR, "capture")
IMG_RESULT_CAP_SK_DIR   = os.path.join(IMG_RESULT_DIR, "capture_skeleton")
IMG_RESULT_MAT_DIR      = os.path.join(IMG_RESULT_DIR, "matching")
IMG_RESULT_MAT_SK_DIR   = os.path.join(IMG_RESULT_DIR, "matching_skeleton")
IMG_RESULT_VIDEO_DIR    = os.path.join(IMG_RESULT_DIR, "video")

# music(백그라운드 음악)의 경로
MUSIC_DIR = os.path.join(BASE_DIR, "music")

#pages(html, css, js)의 경로
PAGES_DIR       = os.path.join(BASE_DIR, "webpage", "pages")
PAGES_HTML_DIR  = os.path.join(PAGES_DIR, "html")
PAGES_CSS_DIR   = os.path.join(PAGES_DIR, "css")
PAGES_JS_DIR    = os.path.join(PAGES_DIR, "js")
