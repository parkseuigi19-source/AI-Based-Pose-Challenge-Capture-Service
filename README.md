[README.md](https://github.com/user-attachments/files/24251137/README.md)
# AIX Mini Project

**AI 기반 동작 인식 및 분석 웹 서비스**  
본 프로젝트는 **FastAPI**와 **YOLOv8**, **MediaPipe**를 활용하여 사용자의 동작(Pose)을 실시간으로 인식하고 분석하는 웹 애플리케이션입니다.

---

## 1. 프로젝트 소개 (Project Introduction)

### 기획 의도
- 홈 트레이닝 및 헬스케어 수요에 맞춰, 별도의 장비 없이 웹캠만으로 자신의 운동 자세를 점검할 수 있는 서비스입니다.
- AI 비전 기술을 통해 동작을 데이터(스켈레톤, 점수)로 시각화하여 객관적인 피드백을 제공합니다.

### 주요 기능 (Feature)
1. **실시간 플레이 모드**: 웹캠을 통해 실시간으로 동작을 인식하고, 관절 포인트(Skeleton)를 화면에 오버레이하여 표시합니다.
2. **비디오 분석**: 동영상 파일을 업로드하여 프레임별 동작을 분석하고 결과를 리포트로 제공합니다.
3. **결과 리포트**: 수행한 동작에 대한 정확도 점수, 베스트 포즈 캡처 이미지, 다시보기 영상 등을 제공합니다.
4. **환경 설정**: 사용자 편의를 위한 난이도 조절 및 소스 선택(웹캠/비디오) 기능을 제공합니다.

---

## 2. 실행 방법 (How to Run)

### 필수 조건
- Python 3.8 이상
- 웹캠 (실시간 모드 사용 시)

### 설치 (Installation)
프로젝트 루트 디렉토리에서 필요한 라이브러리를 설치합니다.

```bash
cd AIX_MINI_PROJECT
pip install -r requirements/requirements.txt
```

### 실행 (Run)
`main.py`가 위치한 디렉토리로 이동하여 서버를 실행합니다.

**방법 A: 직접 실행**
```bash
cd WebContent/webpage
python main.py
# 또는
uvicorn main:app --reload
```

**방법 B: 배치 파일 실행**
- `WebContent/webpage/run_server.bat` 파일을 더블 클릭

### 접속 (Access)
브라우저에서 아래 주소로 접속하세요.
- **URL**: `http://127.0.0.1:8000`

---

## 3. 기술 스택 (Tech Stack)

| 구분 | 기술 / 라이브러리 | 설명 |
| :--- | :--- | :--- |
| **Backend** | **FastAPI**, Uvicorn | 고성능 비동기 웹 서버 및 API 구축 |
| **Vision AI** | **YOLOv8**, **MediaPipe**, OpenCV | 실시간 객체 탐지, 포즈 추정(Skeletal Tracking) 및 영상 처리 |
| **Data Proc** | NumPy, Pandas | 고성능 수치 계산, 데이터 라벨링 및 결과 가공 |
| **Frontend** | HTML5, CSS3, JS (Vanilla), Jinja2 | 사용자 인터페이스 및 서버 사이드 렌더링 |
| **Common** | Python 3.x | 메인 개발 언어 |

---

## 4. 디렉토리 구조 (Directory Structure)

```text
AIX_MINI_PROJECT/
├── WebContent/
│   ├── images/               # 웹 페이지용 정적 이미지 리소스 (로고, 아이콘 등)
│   ├── music/                # 배경 및 효과음 파일
│   ├── result_images/        # 사용자 결과 데이터 저장소 (생성됨)
│   │   ├── capture/          # 캡처된 이미지
│   │   └── video/            # 업로드/녹화된 비디오
│   ├── webpage/              # 웹 애플리케이션 핵심 소스
│   │   ├── common/           # 공통 모듈 및 설정 (__init__.py 등)
│   │   ├── css/              # 스타일시트 (.css)
│   │   ├── html/             # Jinja2 템플릿 파일 (.html)
│   │   ├── js/               # 클라이언트 스크립트 (.js)
│   │   ├── pages/            # 추가 페이지 로직
│   │   ├── main.py           # FastAPI 메인 실행 파일
│   │   └── run_server.bat    # 윈도우용 간편 실행 배치 파일
│   ├── make_pose_jsons.py    # 포즈 데이터 처리 스크립트
│   ├── make_pose_keypoints.py # 키포인트 추출 로직
│   └── yolov8n-pose.pt       # YOLOv8 포즈 사전 학습 모델
├── requirements/
│   └── requirements.txt      # 프로젝트 의존성 목록
└── README.md                 # 프로젝트 통합 설명서
```
