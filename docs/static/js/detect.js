// 初始化語音控制 UI
initSpeechUI();
// 點擊「語音指令」按鈕時，先停止目前語音，延遲啟動偵測模式
document.getElementById('voiceCommandBtn').onclick = function () {
  speechSynthesis.cancel();
  setTimeout(() => startVoiceCommand({ mode: 'detect' }), 300);
};

// ===== 初始 DOM 元素取得 =====
// 取得影片元素（camera stream）
const video    = document.getElementById('video');
// 取得繪製遮罩的 canvas 元素
const overlay  = document.getElementById('overlay');
// 取得 canvas 的繪圖上下文
const ctx      = overlay.getContext('2d');
// 取得顯示結果文字的元素
const resultEl = document.getElementById('result');
// 取得「返回地圖」按鈕
const mapBtn   = document.getElementById('mapBtn');
// 取得「語音指令」按鈕
const voiceBtn = document.getElementById('voiceCommandBtn');

// ===== 語音說明按鈕事件（保留） =====
// 取得語音說明按鈕，點擊跳出提示
const speechInfoBtn = document.getElementById('speechInfo');
speechInfoBtn.addEventListener('click', () => {
  alert('連續點擊畫面三下可切換語音開關');
});

// ===== 返回地圖按鈕 =====
// 點擊後使用瀏覽器回上一頁
mapBtn.addEventListener('click', () => {
  window.history.back();
});

// ===== 繪製多邊形遮罩 =====
function drawMasks(masks) {
  // 清空畫布
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  // 設定半透明綠色填充
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

// ===== 繪製框與標籤 =====
function drawBoxes(boxes) {
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  ctx.strokeStyle = 'lime';
  ctx.lineWidth = 2;
  ctx.font = "16px Arial";
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.textBaseline = "top";

  const DIST_K = 800; // 距離估算常數，可自行調整

  boxes.forEach(box => {
    const { x1, y1, x2, y2, label, score } = box;

    // 計算框高度（像素）
    const boxHeight = y2 - y1;

    // 避免框太小算出無限大距離
    let distance = (DIST_K / boxHeight);
    if (distance > 20) distance = 20; // 限制最大距離 20m，可調整

    // 四捨五入到小數1位
    const distanceText = distance.toFixed(1) + "m";

    // 畫框
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

    // 產生標籤文字（加入距離）
    const tag = `${label} ${Math.round(score * 100)}%  ${distanceText}`;

    const textWidth = ctx.measureText(tag).width;

    // 半透明背景
    ctx.fillRect(x1, y1 - 20, textWidth + 6, 20);

    // 文字
    ctx.fillStyle = "#fff";
    ctx.fillText(tag, x1 + 3, y1 - 20 + 3);

    ctx.fillStyle = "rgba(0,0,0,0.5)";
  });
}

// ===== 語音播報辨識結果（冷卻 & 去重） =====
const SPEECH_COOLDOWN = 3000; // 語音最小間隔 (ms)
const FRAME_THRESHOLD = 3;   // 幀數門檻
let lastSpeechTime   = 0;    // 上次播報時間
let movementCounter  = 0;    // 累計驗證次數
let lastMovement     = "";   // 上次播報文字
let speechTextFromBoxes = "";

function speak(text) {
  const now = Date.now();
  // 若距離上次播報未達冷卻時間，則跳過
  if (now - lastSpeechTime < SPEECH_COOLDOWN) return;
  lastSpeechTime = now;
  speakNav(text);  // 呼叫語音播報函式
}

// 門檻 & 去重邏輯：需累計足夠幀數且文字不得與上次相同
function handleSpeech(resultText) {
  if (resultText === lastMovement) return;
  movementCounter++;
  if (movementCounter >= FRAME_THRESHOLD) {
    speak(resultText);
    lastMovement = resultText;
    movementCounter = 0;
  }
}

// ===== 啟用相機並定時送影像偵測 =====
navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
  .then(stream => {
    // 設定影片來源
    video.srcObject = stream;
    return new Promise(r => video.onloadedmetadata = r);
  })
  .then(() => {
    // 同步 overlay 與影片尺寸
    overlay.width  = video.videoWidth;
    overlay.height = video.videoHeight;
    const cam = document.querySelector('.camera-container');
    cam.style.height = `${video.videoHeight * (cam.clientWidth / video.videoWidth)}px`;
    cam.classList.add('fixed');

    // 移除載入動畫
    const loader = document.getElementById('loader-wrapper');
    if (loader) {
      loader.classList.add('fade-out');
      setTimeout(() => loader.remove(), 2000);
    }

    // 每秒擷取一張影像並呼叫 /detect API
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

      // 繪製結果並更新文字
      if (boxes && boxes.length) drawBoxes(boxes);
      resultEl.innerText = result;
      handleSpeech(result);
    }, 1000);
  })
  .catch(e => console.error('無法啟用相機：', e));


// ===== MiniMap 初始化 & 還原主地圖狀態 =====
// 建立一個小地圖容器，並關閉預設的 attribution 及縮放按鈕
const miniMap = L.map('miniMap', {
  attributionControl: false,
  zoomControl: false
});
// 使用 OpenStreetMap 圖磚，設定最大縮放層級為 19
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(miniMap);

// 從 sessionStorage 讀取先前儲存的地圖狀態
const saved = sessionStorage.getItem('mapState');
if (saved) {
  const state = JSON.parse(saved);

  // 若有儲存中心點與縮放，則還原；否則使用預設座標
  if (state.center && state.zoom) {
    miniMap.setView([state.center.lat, state.center.lng], state.zoom);
  } else {
    miniMap.setView([22.999728, 120.227028], 13);
  }

  // 還原使用者定位點標記
  if (state.userLocation) {
    L.marker([state.userLocation.lat, state.userLocation.lng])
      .addTo(miniMap)
      .bindPopup('您的位置');
  }
  // 還原目的地標記
  if (state.destination) {
    L.marker([state.destination.lat, state.destination.lng])
      .addTo(miniMap)
      .bindPopup(state.destination.name || '目的地');
  }
  // 還原路線圖層並自動調整地圖視野
  if (state.routeGeoJSON) {
    const mRoute = L.geoJSON(state.routeGeoJSON, { style: { color: 'blue', weight: 3 } })
      .addTo(miniMap);
    miniMap.fitBounds(mRoute.getBounds());
  }
  // 若有導航步驟資料，呼叫 detect 頁面的顯示函式
  if (state.steps && state.steps.length) {
    showDetectNavigationInstruction(state.steps, state.userLocation);
  }
} else {
  // 無儲存資料時，預設顯示台灣某座標
  miniMap.setView([22.999728, 120.227028], 13);
}


// ===== 偵測頁面導航指示顯示與播報 =====
function showDetectNavigationInstruction(steps, userLoc) {
  // 顯示導航提示區塊
  const navBox = document.getElementById('navigationPrompt');
  navBox.style.display = 'block';

  let idx = 0;  // 當前步驟索引

  // 根據 maneuver 物件的 type 與 modifier，回傳中文指令
  function getManeuverText(m) {
    switch (m.type) {
      case "turn":
        if (m.modifier === "left")     return "左轉進入";
        if (m.modifier === "right")    return "右轉進入";
        if (m.modifier === "straight") return "直行進入";
        return `${m.modifier} 轉入`;  // 其他方向
      case "arrive":
        return "抵達";  // 抵達終點
      default:
        return `${m.type}`;  // 無法辨識時直接回傳原始 type
    }
  }

  // 更新頁面上顯示的文字指示，並以語音播報
  function update() {
    const step     = steps[idx];
    const nextStep = steps[idx + 1];
    // 若存在下一步，播報距離與轉向；否則宣告抵達
    const speechText = nextStep
      ? `${Math.round(nextStep.distance)}公尺後${getManeuverText(nextStep.maneuver)}${nextStep.name || "無名道路"}`
      : "已抵達目的地";

    // 更新畫面上「目前路段」與「下一步指示」
    document.getElementById('currentRoad').textContent    = `目前在：${step.name || "無名道路"}`;
    document.getElementById('nextInstruction').textContent = speechText;
    // 呼叫語音播報函式（由 speech.js 提供）
    speakNav(speechText);
  }

  update();  // 首次播報與顯示

  // 每 2 秒檢查使用者位置，判斷是否已接近當前步驟點
  const checkNav = setInterval(() => {
    // 將使用者位置與當前步驟的 maneuver 座標轉為 Leaflet LatLng
    const userLatLng   = L.latLng(userLoc.lat, userLoc.lng);
    const targetLatLng = L.latLng(
      steps[idx].maneuver.location[1],
      steps[idx].maneuver.location[0]
    );
    // 若距離小於 20 公尺，視為完成此步驟
    if (userLatLng.distanceTo(targetLatLng) < 20) {
      idx++;
      if (idx < steps.length) {
        // 還有後續步驟，更新指示
        update();
      } else {
        // 完成所有步驟：停止檢查並播報抵達
        clearInterval(checkNav);
        speakNav("您已抵達目的地");
      }
    }
  }, 2000);
}