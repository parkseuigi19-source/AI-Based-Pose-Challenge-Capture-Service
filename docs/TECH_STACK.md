# 기술 스택 정의서 (Technology Stack Definition)

## 1. 운영체제 및 환경 (OS & Environment)
- **OS**: Windows (개발 및 실행 환경)
- **Language**: Python 3.x

## 2. 웹 프레임워크 (Web Framework)
- **Backend**: FastAPI (v0.115.0)
    - 고성능 비동기 웹 프레임워크
    - API 엔드포인트 및 HTML 템플릿 서빙
- **Server**: Uvicorn (v0.30.6)
    - ASGI 웹 서버 구현체
- **Templating**: Jinja2 (v3.1.4)
    - 서버 사이드 HTML 렌더링

## 3. 컴퓨터 비전 및 AI (Computer Vision & AI)
- **YOLOv8**: Ultralytics (>=8.0.196)
    - 실시간 객체 탐지 및 포즈 추정 (`yolov8n-pose.pt` 모델 사용)
- **MediaPipe**: Google MediaPipe (v0.10.21)
    - 손/포즈 스켈레톤 추출 및 분석
- **OpenCV**: opencv-python (v4.8.0.76)
    - 영상 및 이미지 처리 (프레임 단위 조작)

## 4. 데이터 처리 및 분석 (Data Processing)
- **NumPy** (v1.26.4): 고성능 수치 계산 및 배열 처리
- **Pandas** (v2.1.1): 데이터 라벨링 및 결과 가공
- **Python-Multipart**: 폼(Form) 데이터 처리
- **Base64**: 이미지 데이터 인코딩/디코딩

## 5. 프론트엔드 (Frontend)
- **HTML5 / CSS3 / JavaScript (Vanilla)**
    - Jinja2 템플릿을 통한 동적 페이지 생성
    - `fetch` API를 이용한 비동기 서버 통신 (이미지 캡처, 비디오 업로드 등)

## 6. 개발 도구 및 기타 (Tools & Others)
- **tqdm**: 데이터 처리 진행률 시각화
- **Git**: 버전 관리
- **VS Code**: 통합 개발 환경 (권장)
