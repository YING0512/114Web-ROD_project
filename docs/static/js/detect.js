// ===== 初始 DOM 取得 =====
const video        = document.getElementById('video');
const overlay      = document.getElementById('overlay');
const ctx          = overlay.getContext('2d');
const resultEl     = document.getElementById('result');
const speechBtn    = document.getElementById('speechToggle');
const speechIcon   = document.getElementById('speechIcon');
const backBtn      = document.getElementById('backBtn');
const speechInfoBtn= document.getElementById('speechInfo');
const notice       = document.getElementById('speechNotice');

let speechEnabled   = true;            // 語音預設開啟
const SPEECH_COOLDOWN = 5000;          // 語音最短間隔
const FRAME_THRESHOLD = 3;             // 辨識結果語音連續幀門檻
let lastSpeechTime  = 0;
let movementCounter = 0;
let lastMovement    = "";

// ===== 切換語音開關 =====
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

// ===== 連點三下切換語音（方便單手操作） =====
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

// ===== 進入頁面時提示「語音開啟中…」 =====
window.addEventListener('DOMContentLoaded', () => {
  if (speechEnabled) {
    notice.style.display = 'block';
    setTimeout(() => { notice.style.display = 'none'; }, 3000);
    speak("語音播報開啟中...");
  }
});

// 資訊按鈕：顯示操作說明
speechInfoBtn.addEventListener('click', () => {
  alert('連續點擊畫面三下可切換語音開關');
});

// 返回地圖按鈕：直接回到首頁
backBtn.addEventListener('click', () => {
  window.location.href = '/';
});

// ===== 在畫面上繪製多邊形遮罩 =====
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

// ===== 語音播報函式，加入冷卻時間 =====
function speak(text) {
  const now = Date.now();
  if (!speechEnabled || now - lastSpeechTime < SPEECH_COOLDOWN) return;
  lastSpeechTime = now;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-TW';
  speechSynthesis.speak(u);
}

// 幀門檻 + 重複過濾，避免頻繁播報
function handleSpeech(resultText) {
  if (resultText === lastMovement) return;
  movementCounter++;
  if (movementCounter >= FRAME_THRESHOLD) {
    speak(resultText);
    lastMovement    = resultText;
    movementCounter = 0;
  }
}

// ===== 啟用相機並每秒送圖檢測 =====
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
      // 擷取影像
      const tmp = document.createElement('canvas');
      tmp.width  = overlay.width;
      tmp.height = overlay.height;
      tmp.getContext('2d').drawImage(video, 0, 0);

      // 傳給後端辨識
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

// ===== 小地圖 MiniMap 初始化 & 還原主地圖狀態 =====
const miniMap = L.map('miniMap', {
  attributionControl: false,
  zoomControl: false
});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(miniMap);

// 讀取暫存，還原主地圖中心、定位、目的地、路線
const saved = sessionStorage.getItem('mapState');
if (saved) {
  const state = JSON.parse(saved);
  if (state.center && state.zoom) {
    miniMap.setView([state.center.lat, state.center.lng], state.zoom);
  } else {
    miniMap.setView([22.999728, 120.227028], 13);
  }

  if (state.userLocation) {
    L.marker([state.userLocation.lat, state.userLocation.lng])
      .addTo(miniMap)
      .bindPopup('您的位置');
  }
  if (state.destination) {
    L.marker([state.destination.lat, state.destination.lng])
      .addTo(miniMap)
      .bindPopup(state.destination.name || '目的地');
  }
  if (state.routeGeoJSON) {
    const mRoute = L.geoJSON(state.routeGeoJSON, { style: { color: 'blue', weight: 3 } })
      .addTo(miniMap);
    miniMap.fitBounds(mRoute.getBounds());
  }
  if (state.steps && state.steps.length) {
    showDetectNavigationInstruction(state.steps, state.userLocation);
  }
} else {
  miniMap.setView([22.999728, 120.227028], 13);
}

function showDetectNavigationInstruction(steps, userLoc) {
  const navBox = document.getElementById('navigationPrompt');
  navBox.style.display = 'block';

  let idx = 0;
  function getManeuverText(m) {
    switch (m.type) {
      case "turn":
        if (m.modifier === "left")     return "左轉進入";
        if (m.modifier === "right")    return "右轉進入";
        if (m.modifier === "straight") return "直行進入";
        return `${m.modifier} 轉入`;
      case "arrive":
        return "抵達";
      default:
        return `${m.type}`;
    }
  }

  function update() {
    const step     = steps[idx];
    const nextStep = steps[idx+1];
    const speechText = nextStep
      ? `${Math.round(nextStep.distance)}公尺後${getManeuverText(nextStep.maneuver)}${nextStep.name || "無名道路"}`
      : "已抵達目的地";

    document.getElementById('currentRoad').textContent   = `目前在：${step.name || "無名道路"}`;
    document.getElementById('nextInstruction').textContent = speechText;
    speak(speechText); // 使用 detect.js 內的 speak() 進行播報
  }

  update(); // 先播第一條

  const checkNav = setInterval(() => {
    const userLatLng = L.latLng(userLoc.lat, userLoc.lng);
    const targetLatLng = L.latLng(
      steps[idx].maneuver.location[1],
      steps[idx].maneuver.location[0]
    );
    if (userLatLng.distanceTo(targetLatLng) < 20) {
      idx++;
      if (idx < steps.length) {
        update();
      } else {
        clearInterval(checkNav);
        speak("您已抵達目的地");
      }
    }
  }, 2000);
}
