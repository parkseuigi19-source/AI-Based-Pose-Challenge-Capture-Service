document.addEventListener('DOMContentLoaded', function () {
    function setupSingleSelect(groupId) {
        const group = document.getElementById(groupId);
        const buttons = group.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    setupSingleSelect('playerButtons');  // 인원 버튼
    setupSingleSelect('photoButtons');   // 사진 버튼

    // 시작 버튼 클릭
    const startBtn = document.getElementById('startGameButton');
    startBtn.addEventListener('click', () => {
        const player = document.querySelector('#playerButtons button.active')?.dataset.value;
        const photo = document.querySelector('#photoButtons button.active')?.dataset.value;

        if (!player || !photo) {
            alert('인원과 사진을 모두 선택해주세요.');
            return;
        }

        // 선택값 query parameter로 play.html 이동
        window.location.href = `/play?players=${player}&photos=${photo}`;
    });
});
