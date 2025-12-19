# 시스템 아키텍처 (System Architecture)

## 1. 시스템 개요
본 시스템은 **FastAPI** 기반의 웹 애플리케이션으로, 사용자의 웹캠 또는 업로드된 비디오에서 **YOLOv8** 및 **MediaPipe**를 활용하여 동작(포즈)을 인식하고 분석 결과를 제공합니다.

## 2. 아키텍처 다이어그램 (텍스트 기술)

```mermaid
graph TD
    Client[사용자 (브라우저)] -->|HTTP Request / HTML| WebServer[FastAPI Web Server]
    Client -->|Video/Image Upload| WebServer
    
    subgraph "Backend System"
        WebServer -->|Route Handler| Controller[main.py (Router)]
        Controller -->|Render| Template[Jinja2 Templates]
        Controller -->|Process| AI_Module[AI/Vision Module]
        
        AI_Module -->|Pose Detection| YOLO[YOLOv8 (Pose)]
        AI_Module -->|Skeleton Extract| MediaPipe[MediaPipe]
        AI_Module -->|Image Proc| OpenCV[OpenCV]
        
        Controller -->|Read/Write| Storage[Local File System]
        Storage -- Save --> Results[Images/Videos/Logs]
    end
    
    subgraph "Data Flow"
        Storage -->|Static Files| Client
    end
```

## 3. 모듈별 상세 구성

### 가. 클라이언트 (Frontend)
- **인터페이스**: HTML/CSS/JS로 구성된 웹 페이지
- **기능**:
    - 웹캠 영상 스트리밍 및 표시
    - `/play` 페이지에서 게임/동작 수행
    - 실시간 캡처 이미지를 API로 전송
    - 결과 확인 및 설정 변경

### 나. 웹 서버 (Backend)
- **FastAPI**: RESTful API 및 페이지 라우팅 담당
- **주요 엔드포인트**:
    - `/`: 메인 홈
    - `/play`: 동작 인식 및 게임 플레이
    - `/capture`: 클라이언트로부터 이미지 수신 및 저장
    - `/upload_video`: 동영상 파일 업로드 처리
    - `/result`: 분석 결과 리포트

### 다. AI 분석 모듈 (Core Logic)
- **YOLOv8 Pose**: 신체 키포인트(관절) 탐지
- **MediaPipe**: 보조적 스켈레톤 추출 및 정밀 분석
- **Algorithm**: `make_pose_keypoints` 스크립트를 통해 프레임별 키포인트 좌표 추출 및 스코어링 계산

### 라. 데이터 저장소 (File System)
- **구조**:
    - `WebContent/images`: 시스템 리소스 (배경, 아이콘 등)
    - `WebContent/result_images`: 사용자 실행 결과 (캡처, 영상) 저장
    - 별도의 DB 없이 세션 정보(`result_store` 변수)와 로컬 파일 시스템을 활용하여 경량화
