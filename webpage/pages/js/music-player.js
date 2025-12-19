// 더 간단하고 확실한 버전
class SimpleMusicPlayer {
    constructor() {
        this.isPlaying = false;
        this.musicFile = '/static/music/bgm1.mp3';
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.createPlayer());
        } else {
            this.createPlayer();
        }
    }

    createPlayer() {
        console.log('Creating simple music player...');

        const playerHTML = `
            <div id="music-player" class="music-player">
                <button id="music-toggle" class="music-toggle" title="음악 끄기">
                    <span id="music-icon">🎵</span>
                </button>
            </div>
            <audio id="background-audio" preload="auto" loop>
                <source src="${this.musicFile}" type="audio/mpeg">
            </audio>
        `;

        document.body.insertAdjacentHTML('beforeend', playerHTML);

        this.audio = document.getElementById('background-audio');
        this.toggleBtn = document.getElementById('music-toggle');
        this.musicIcon = document.getElementById('music-icon');

        // 버튼 클릭 이벤트
        this.toggleBtn.addEventListener('click', () => {
            console.log('Button clicked, current playing state:', this.isPlaying);
            
            if (this.isPlaying) {
                // 음악 중지
                this.audio.pause();
                this.isPlaying = false;
                this.musicIcon.textContent = '🔇';
                this.toggleBtn.title = '음악 켜기';
                console.log('Music stopped');
            } else {
                // 음악 시작
                this.audio.play().then(() => {
                    this.isPlaying = true;
                    this.musicIcon.textContent = '🎵';
                    this.toggleBtn.title = '음악 끄기';
                    console.log('Music started');
                }).catch(error => {
                    console.error('Play failed:', error);
                });
            }
        });

        // 자동 재생 시도
        this.startAutoplay();
    }

    startAutoplay() {
        console.log('Attempting autoplay...');
        
        // 첫 클릭 시 자동 시작
        const autoStart = () => {
            if (!this.isPlaying) {
                this.audio.play().then(() => {
                    this.isPlaying = true;
                    this.musicIcon.textContent = '🎵';
                    this.toggleBtn.title = '음악 끄기';
                    console.log('Auto-started music on user interaction');
                });
            }
            document.removeEventListener('click', autoStart);
        };
        
        document.addEventListener('click', autoStart);

        // 즉시 시도
        this.audio.play().then(() => {
            this.isPlaying = true;
            console.log('Immediate autoplay successful');
        }).catch(error => {
            console.log('Autoplay blocked, waiting for user click');
        });
    }
}

// 전역 인스턴스 생성
window.simpleMusicPlayer = new SimpleMusicPlayer();