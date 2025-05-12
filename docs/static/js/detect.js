const video       = document.getElementById('video');
const overlay     = document.getElementById('overlay');
const ctx         = overlay.getContext('2d');
const resultEl    = document.getElementById('result');
const speechBtn   = document.getElementById('speechToggle');
const speechIcon  = document.getElementById('speechIcon');
const backBtn     = document.getElementById('backBtn');


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
    speechIcon.className = 'fa-solid fa-volume-high';
    speechBtn.classList.add('on');
    speechBtn.classList.remove('off');
    speechBtn.title = '語音：開';
  } else {
    speechIcon.className = 'fa-solid fa-volume-xmark';
    speechBtn.classList.add('off');
    speechBtn.classList.remove('on');
    speechBtn.title = '語音：關';
  }
}

// 三連點切換語音
let clicks = 0, clickTimer;
document.body.addEventListener('click', () => {
  clicks++;
  if (clicks === 1) {
    clickTimer = setTimeout(() => { clicks = 0; }, 600);
  } else if (clicks === 3) {
    clearTimeout(clickTimer);
    clicks = 0;
    toggleSpeech();
  }
});

backBtn.addEventListener('click', () => {
  window.location.href = '/';
});

// 在畫面上只塗物件範圍內的多邊形遮罩
function drawMasks(masks) {
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  ctx.fillStyle = 'rgba(0,255,0,0.3)';
  masks.forEach(poly => {
    ctx.beginPath();
    poly.forEach(([x, y], i) => {
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
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

// 幀門檻與語音重複過濾
function handleSpeech(resultText) {
  if (resultText === lastMovement) return;
  movementCounter++;
  if (movementCounter >= FRAME_THRESHOLD) {
    speak(resultText);
    lastMovement    = resultText;
    movementCounter = 0;
  }
}

// 啟用相機並定期送圖檢測
navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
  .then(stream => {
    video.srcObject = stream;
    return new Promise(r => video.onloadedmetadata = r);
  })
  .then(() => {
    // 同步 overlay 大小
    overlay.width  = video.videoWidth;
    overlay.height = video.videoHeight;
    const cam = document.querySelector('.camera-container');
    cam.style.height = `${video.videoHeight * (cam.clientWidth / video.videoWidth)}px`;
    cam.classList.add('fixed');

    setInterval(async () => {
      const tmp = document.createElement('canvas');
      tmp.width  = overlay.width;
      tmp.height = overlay.height;
      tmp.getContext('2d').drawImage(video, 0, 0);

      const dataUrl = tmp.toDataURL('image/jpeg');
      const res = await fetch('/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl })
      });
      const { masks, result } = await res.json();

      if (masks && masks.length) {
        drawMasks(masks);
      }
      resultEl.innerText = result;
      handleSpeech(result);
    }, 1000);
  })
  .catch(e => console.error('無法啟用相機：', e));

// --- Mini Map 初始化（修改前的初始值改為暫存後的狀態） ---
const miniMap = L.map('miniMap', {
  attributionControl: false,
  zoomControl: false
});

// 嘗試從 sessionStorage 還原
const saved = sessionStorage.getItem('mapState');
if (saved) {
  const state = JSON.parse(saved);
  if (state.center && state.zoom) {
    miniMap.setView([state.center.lat, state.center.lng], state.zoom);
  } else {
    miniMap.setView([22.999728, 120.227028], 13);
  }
} else {
  miniMap.setView([22.999728, 120.227028], 13);
}

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(miniMap);

// **返回地圖：只要導回首頁，index.js 就會自動還原先前地圖狀態**
backBtn.addEventListener('click', () => {
  window.location.href = '/';
});