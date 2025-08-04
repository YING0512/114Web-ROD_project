initSpeechUI();
document.getElementById('voiceCommandBtn').onclick = function () {
  speechSynthesis.cancel(); 
  setTimeout(() => startVoiceCommand({ mode: 'detect' }), 300);
};

// ===== 初始 DOM 元素取得 =====
const video         = document.getElementById('video');
const overlay       = document.getElementById('overlay');
const ctx           = overlay.getContext('2d');
const resultEl      = document.getElementById('result');
const mapBtn        = document.getElementById('mapBtn');
const voiceBtn      = document.getElementById('voiceCommandBtn');

// ====== 語音說明按鈕說明（保留） ======
const speechInfoBtn = document.getElementById('speechInfo');
speechInfoBtn.addEventListener('click', () => {
  alert('連續點擊畫面三下可切換語音開關'); // 跳出提示說明
});

// ===== 返回地圖按鈕（直接跳回） =====
mapBtn.addEventListener('click', () => {
  window.history.back();
});

// ===== 繪製辨識遮罩 多邊形 =====
function drawMasks(masks) {
  ctx.clearRect(0, 0, overlay.width, overlay.height);  // 清空畫布
  ctx.fillStyle = 'rgba(0,255,0,0.3)';                 // 半透明綠色
  masks.forEach(poly => {
    ctx.beginPath();
    poly.forEach(([x, y], i) => {
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();  // 填滿多邊形
  });
}

function drawBoxes(boxes) {
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  ctx.strokeStyle = 'lime';
  ctx.lineWidth = 2;
  ctx.font = "16px Arial";
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.textBaseline = "top";

  boxes.forEach(box => {
    const { x1, y1, x2, y2, label, score } = box;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    const tag = `${label} ${Math.round(score * 100)}%`;
    const textWidth = ctx.measureText(tag).width;
    ctx.fillRect(x1, y1 - 20, textWidth + 6, 20);
    ctx.fillStyle = "#fff";
    ctx.fillText(tag, x1 + 3, y1 - 20 + 3);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
  });
}

// ===== 語音播報辨識（冷卻/去重邏輯依原本需求） =====
const SPEECH_COOLDOWN = 5000;
const FRAME_THRESHOLD = 3;
let lastSpeechTime = 0;
let movementCounter = 0;
let lastMovement = "";

function speak(text) {
  // 語音開關交由 speech.js 控制，這裡只負責冷卻與避免重複
  const now = Date.now();
  if (now - lastSpeechTime < SPEECH_COOLDOWN) return;
  lastSpeechTime = now;
  speakNav(text);
}

// 幀門檻 + 重複過濾，避免連續重複播報
function handleSpeech(resultText) {
  if (resultText === lastMovement) return;  // 相同文字則跳過
  movementCounter++;
  if (movementCounter >= FRAME_THRESHOLD) {
    speak(resultText);
    lastMovement = resultText;
    movementCounter = 0;
  }
}

// ===== 啟用相機並定時送影像至後端偵測 =====
navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
  .then(stream => {
    video.srcObject = stream;
    return new Promise(r => video.onloadedmetadata = r);
  })
  .then(() => {
    // 同步 overlay 大小與相機容器高度
    overlay.width  = video.videoWidth;
    overlay.height = video.videoHeight;
    const cam = document.querySelector('.camera-container');
    cam.style.height = `${video.videoHeight * (cam.clientWidth / video.videoWidth)}px`;
    cam.classList.add('fixed');

    const loader = document.getElementById('loader-wrapper');
    if (loader) {
      loader.classList.add('fade-out');
      setTimeout(() => {
        loader.remove();
      }, 2000);
    }

    // 每秒擷取影像並傳給 /detect API
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
      const { boxes, result } = await res.json();

      // 繪製遮罩並顯示文字結果
      if (boxes && boxes.length) drawBoxes(boxes);
      resultEl.innerText = result;
      handleSpeech(result);
    }, 1000);
  })
  .catch(e => console.error('無法啟用相機：', e));

// ===== MiniMap 初始化 & 還原主地圖狀態 =====
const miniMap = L.map('miniMap', {
  attributionControl: false,
  zoomControl: false
});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(miniMap);

// 從 sessionStorage 讀取地圖狀態並恢復
const saved = sessionStorage.getItem('mapState');
if (saved) {
  const state = JSON.parse(saved);

  // 還原中心與縮放
  if (state.center && state.zoom) {
    miniMap.setView([state.center.lat, state.center.lng], state.zoom);
  } else {
    miniMap.setView([22.999728, 120.227028], 13);
  }

  // 還原使用者定位點
  if (state.userLocation) {
    L.marker([state.userLocation.lat, state.userLocation.lng])
      .addTo(miniMap)
      .bindPopup('您的位置');
  }
  // 還原目的地點
  if (state.destination) {
    L.marker([state.destination.lat, state.destination.lng])
      .addTo(miniMap)
      .bindPopup(state.destination.name || '目的地');
  }
  // 還原路線並調整視野
  if (state.routeGeoJSON) {
    const mRoute = L.geoJSON(state.routeGeoJSON, { style: { color: 'blue', weight: 3 } })
      .addTo(miniMap);
    miniMap.fitBounds(mRoute.getBounds());
  }
  // 若有導航步驟則顯示於 detect 頁面
  if (state.steps && state.steps.length) {
    showDetectNavigationInstruction(state.steps, state.userLocation);
  }
} else {
  // 無儲存資料時使用預設位置
  miniMap.setView([22.999728, 120.227028], 13);
}

// ===== 偵測頁面導航指示顯示與播報 =====
function showDetectNavigationInstruction(steps, userLoc) {
  const navBox = document.getElementById('navigationPrompt');
  navBox.style.display = 'block';

  let idx = 0;
  // 根據 Maneuver 型別與 modifier 轉中文指令
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

  // 更新畫面文字並語音播報
  function update() {
    const step     = steps[idx];
    const nextStep = steps[idx+1];
    const speechText = nextStep
      ? `${Math.round(nextStep.distance)}公尺後${getManeuverText(nextStep.maneuver)}${nextStep.name || "無名道路"}`
      : "已抵達目的地";

    document.getElementById('currentRoad').textContent    = `目前在：${step.name || "無名道路"}`;
    document.getElementById('nextInstruction').textContent = speechText;
    speakNav(speechText); // 使用 speech.js 提供的 speakNav
  }

  update();  // 首次播報

  // 以 2 秒週期檢查使用者位置與下個導航點距離
  const checkNav = setInterval(() => {
    const userLatLng   = L.latLng(userLoc.lat, userLoc.lng);
    const targetLatLng = L.latLng(
      steps[idx].maneuver.location[1],
      steps[idx].maneuver.location[0]
    );
    // 若已接近則進入下一步
    if (userLatLng.distanceTo(targetLatLng) < 20) {
      idx++;
      if (idx < steps.length) {
        update();
      } else {
        clearInterval(checkNav);
        speakNav("您已抵達目的地");
      }
    }
  }, 2000);
}