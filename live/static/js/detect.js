const video       = document.getElementById('video');
const overlay     = document.getElementById('overlay');
const ctx         = overlay.getContext('2d');
const resultBox   = document.getElementById('result');
const speechBtn   = document.getElementById('speechToggle');
const speechIcon  = document.getElementById('speechIcon');
const speechLabel = document.getElementById('speechLabel');

// 語音控制
let speechEnabled    = true;
const SPEECH_COOLDOWN = 5000;
const FRAME_THRESHOLD = 3;
let lastSpeechTime   = 0;
let movementCounter  = 0;
let lastMovement     = "";

// 切換語音
speechBtn.addEventListener('click', toggleSpeech);
function toggleSpeech() {
  speechEnabled = !speechEnabled;
  if (speechEnabled) {
    speechIcon.className   = 'fa-solid fa-volume-high';
    speechLabel.innerText  = ' 開';
    speechBtn.classList.add('on');
    speechBtn.classList.remove('off');
    speechBtn.title        = '語音：開';
  } else {
    speechIcon.className   = 'fa-solid fa-volume-xmark';
    speechLabel.innerText  = ' 關';
    speechBtn.classList.add('off');
    speechBtn.classList.remove('on');
    speechBtn.title        = '語音：關';
  }
}

// 三連點切換語音
let clicks = 0, timer;
document.body.addEventListener('click', () => {
  clicks++;
  if (clicks === 1) {
    timer = setTimeout(() => clicks = 0, 600);
  } else if (clicks === 3) {
    clearTimeout(timer);
    clicks = 0;
    toggleSpeech();
  }
});

// 畫面上只塗物件框內區域
function drawBoxes(boxes) {
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  ctx.fillStyle = 'rgba(255,0,0,0.3)';
  boxes.forEach(b => {
    const [x1, y1, x2, y2] = b;
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
  });
}

// 播報語音
function speak(text) {
  const now = Date.now();
  if (!speechEnabled || now - lastSpeechTime < SPEECH_COOLDOWN) return;
  lastSpeechTime = now;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-TW';
  speechSynthesis.speak(u);
}

// 處理語音與幀門檻
function handleSpeech(resultText) {
  if (resultText === lastMovement) return;
  movementCounter++;
  if (movementCounter >= FRAME_THRESHOLD) {
    speak(resultText);
    lastMovement = resultText;
    movementCounter = 0;
  }
}

// 啟用相機並定期送檢
navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
  .then(stream => {
    video.srcObject = stream;
    return new Promise(r => video.onloadedmetadata = r);
  })
  .then(() => {
    // 同步 canvas 尺寸
    overlay.width  = video.videoWidth;
    overlay.height = video.videoHeight;
    // 設定相機容器高度
    const cam = document.querySelector('.camera-container');
    cam.style.height = `${video.videoHeight * (cam.clientWidth / video.videoWidth)}px`;
    cam.classList.add('fixed');

    setInterval(async () => {
      // 擷取畫面
      const tmp = document.createElement('canvas');
      tmp.width = overlay.width;
      tmp.height = overlay.height;
      tmp.getContext('2d').drawImage(video, 0, 0);

      const dataUrl = tmp.toDataURL('image/jpeg');
      const res = await fetch('/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl })
      });
      const { boxes, result } = await res.json();

      // 更新畫面與文字
      drawBoxes(boxes);
      resultBox.innerText = result;
      handleSpeech(result);
    }, 200);
  })
  .catch(e => console.error('無法啟用相機：', e));
