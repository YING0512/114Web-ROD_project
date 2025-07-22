// ===== 初始 DOM 元素取得 =====
// 取得 video、canvas、結果顯示、語音與按鈕等 DOM 元素引用
const video         = document.getElementById('video');
const overlay       = document.getElementById('overlay');
const ctx           = overlay.getContext('2d');
const resultEl      = document.getElementById('result');
const speechBtn     = document.getElementById('speechToggle');
const speechIcon    = document.getElementById('speechIcon');
const backBtn       = document.getElementById('backBtn');
const speechInfoBtn = document.getElementById('speechInfo');
const notice        = document.getElementById('speechNotice');

// ===== 語音播報參數設定 =====
let speechEnabled    = true;    // TODO: 預設語音為「開」
const SPEECH_COOLDOWN = 5000;    // 語音最短間隔：5 秒鐘
const FRAME_THRESHOLD = 3;       // 當同一結果連續出現的幀數門檻
let lastSpeechTime   = 0;        // 上次播報時間戳
let movementCounter  = 0;        // 連續相同結果計數器
let lastMovement     = "";       // 上次播報內容

// ===== 語音開關按鈕 點擊處理 =====
speechBtn.addEventListener('click', toggleSpeech);
function toggleSpeech() {
  speechEnabled = !speechEnabled;  // 切換狀態
  if (speechEnabled) {
    // 開啟語音：圖示 + 樣式 + title
    speechIcon.className = 'fa-solid fa-volume-high';
    speechBtn.classList.add('on');
    speechBtn.classList.remove('off');
    speechBtn.title = '語音：開';
  } else {
    // 關閉語音：圖示 + 樣式 + title
    speechIcon.className = 'fa-solid fa-volume-xmark';
    speechBtn.classList.add('off');
    speechBtn.classList.remove('on');
    speechBtn.title = '語音：關';
  }
}

// ===== 三連擊全頁 切換語音 =====
// 便於單手操作：連續點擊 3 下便觸發 toggleSpeech()
let clicks = 0, clickTimer;
document.body.addEventListener('click', () => {
  clicks++;
  if (clicks === 1) {
    // 首次點擊後啟動計時器，600ms 內若未三擊則重置
    clickTimer = setTimeout(() => { clicks = 0; }, 600);
  } else if (clicks === 3) {
    // 三擊完成，清除計時器並切換語音
    clearTimeout(clickTimer);
    clicks = 0;
    toggleSpeech();
  }
});

// ===== 進入頁面時 顯示「語音開啟中…」提示 =====
window.addEventListener('DOMContentLoaded', () => {
  if (speechEnabled) {
    notice.style.display = 'block';              // 顯示提示文字
    setTimeout(() => { notice.style.display = 'none'; }, 3000);  // 3 秒後隱藏
    speak("語音播報開啟中...");                  // 立即播報一次
  }
});

// ===== 語音操作資訊 按鈕 =====
speechInfoBtn.addEventListener('click', () => {
  alert('連續點擊畫面三下可切換語音開關');  // 跳出提示說明
});

// ===== 返回地圖 按鈕 行為 =====
backBtn.addEventListener('click', () => {
  window.history.back();      // 返回上一頁，維持先前操作狀態
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


// ===== 語音播報函式（含冷卻時間控制） =====
function speak(text) {
  const now = Date.now();
  if (!speechEnabled || now - lastSpeechTime < SPEECH_COOLDOWN) return;
  lastSpeechTime = now;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-TW';
  speechSynthesis.speak(u);
}

// 幀門檻 + 重複過濾，避免連續重複播報
function handleSpeech(resultText) {
  if (resultText === lastMovement) return;  // 相同文字則跳過
  movementCounter++;
  if (movementCounter >= FRAME_THRESHOLD) {
    speak(resultText);
    lastMovement    = resultText;
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
    speak(speechText);
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
        speak("您已抵達目的地");
      }
    }
  }, 2000);
}
