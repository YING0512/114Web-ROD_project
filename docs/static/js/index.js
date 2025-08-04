// 初始化語音 UI 與狀態
initSpeechUI();

// 點擊「語音導航」按鈕時，啟動語音指令模式（mode: 'index'）
document.getElementById('voiceNavBtn').onclick = function () {
    startVoiceCommand({ mode: 'index' });
}

// ===== 語音說明按鈕事件處理 =====
// 取得「語音說明」按鈕元素
const speechInfoBtn = document.getElementById('speechInfo');
// 點擊後顯示操作說明提示
speechInfoBtn.addEventListener('click', () => {
  alert('連續點擊畫面三下可切換語音開關');
});

// ===== 搜尋結果資料與批次索引 =====
// 儲存搜尋結果的資料陣列
let searchResultsData = [];
// 批次顯示的起始索引
let currentBatchStart = 0;
// 全域語音選擇旗標：用於判斷是否處於語音選擇模式
window.isVoiceSelection = false;

// ===== 地圖初始化 =====
// 建立 Leaflet 地圖，並設定預設中心座標與縮放等級
const map = L.map('map').setView([22.999728, 120.227028], 13);
// 加入 OpenStreetMap 的地圖圖磚
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// ===== 全域變數 =====
let userMarker = null;         // 使用者位置標記
let destinationMarker = null;  // 目的地標記
let routeLayer = null;         // 路徑圖層
let userLocation = null;       // 使用者經緯度
let currentHeading = 0;        // 使用者當前朝向（角度）
let isNavigating = false;      // 是否正在導航
let navigationSteps = [];      // 導航步驟清單
let positionCheck = null;      // 定時檢查位置的計時器

// 同步導航狀態到 window，全域可供語音模組檢查
window.isNavigating = isNavigating;

// ===== 顯示／隱藏導航提示 UI =====
function showNavigationPrompt() {
  // 導航中：隱藏搜尋列，顯示導航提示區塊
  document.getElementById('search-bar').style.display = 'none';
  document.getElementById('navigationPrompt').style.display = 'block';
}

function hideNavigationPrompt() {
  // 非導航：顯示搜尋列，隱藏導航提示區塊
  document.getElementById('search-bar').style.display = 'flex';
  document.getElementById('navigationPrompt').style.display = 'none';
}

// ===== Icon 工具函式 =====
// 建立用戶旋轉箭頭圖示（用於顯示朝向）
function createUserIcon() {
  return L.divIcon({
    className: '',
    html: '<div class="arrow-icon"></div>',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
}

// 建立預設目的地標記圖示
function createDefaultMarkerIcon() {
  return L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
    shadowSize: [41, 41]
  });
}

// 依 currentHeading 旋轉使用者圖示
function rotateUserIcon() {
  if (!userMarker) {
    console.warn("userMarker 尚未建立");
    return;
  }

  const el = userMarker.getElement();
  const iconDiv = el?.querySelector('.arrow-icon');
  if (!iconDiv) {
    console.warn("❌ 無法找到 .arrow-icon，可能使用的是預設 icon");
    return;
  }

  // 設定 CSS transform，將箭頭旋轉至使用者當前朝向
  iconDiv.style.transform = `translate(-50%, -50%) rotate(${currentHeading}deg)`;
}

// ===== 地圖狀態還原（頁面重新載入後） =====
window.addEventListener('load', () => {
  // 從 sessionStorage 取出先前儲存的地圖狀態
  const saved = sessionStorage.getItem('mapState');
  if (!saved) return;

  const state = JSON.parse(saved);
  // 恢復地圖中心點與縮放等級
  map.setView([state.center.lat, state.center.lng], state.zoom);

  // 若有儲存使用者位置，則建立標記並顯示
  if (state.userLocation) {
    userLocation = [state.userLocation.lat, state.userLocation.lng];
    userMarker = L.marker(
      userLocation,
      { icon: isNavigating ? createUserIcon() : createDefaultMarkerIcon() }
    )
    .addTo(map)
    .bindPopup("您的位置")
    .openPopup();
    rotateUserIcon(); // 旋轉圖示至儲存的朝向
  }

  // 若有儲存目的地資訊，則建立標記並顯示
  if (state.destination) {
    destinationMarker = L.marker(
      [state.destination.lat, state.destination.lng]
    )
    .addTo(map)
    .bindPopup(state.destination.name || "目的地")
    .openPopup();
  }

  // 若有儲存路徑 GeoJSON，則將路徑圖層加入地圖並調整檢視範圍
  if (state.routeGeoJSON) {
    routeLayer = L.geoJSON(
      state.routeGeoJSON,
      { style: { color: 'blue', weight: 5 } }
    ).addTo(map);
    map.fitBounds(routeLayer.getBounds());
  }

  // 恢復完成後，清除 sessionStorage 中的暫存
  sessionStorage.removeItem('mapState');
});

// -------- 使用者定位 --------
// 更新並顯示使用者位置：接收緯度(lat)、經度(lng)
function updateUserLocation(lat, lng) {
  // 更新全域使用者位置變數
  userLocation = [lat, lng];
  // 根據是否正在導航，決定使用哪個圖示
  const icon = isNavigating ? createUserIcon() : createDefaultMarkerIcon();

  if (userMarker) {
    // 若已存在使用者標記，就更新位置與圖示
    userMarker.setLatLng(userLocation);
    userMarker.setIcon(icon);
  } else {
    // 否則建立新的使用者標記，並打開「您的位置」提示
    userMarker = L.marker(userLocation, { icon })
      .addTo(map)
      .bindPopup("您的位置")
      .openPopup();
  }

  // 旋轉使用者圖示到最新朝向
  rotateUserIcon();
  // 將地圖視角置中到使用者位置，並放大到等級 18
  map.setView(userLocation, 18);
}

// 若瀏覽器支援地理定位，持續監聽位置變化
if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    pos => {
      updateUserLocation(pos.coords.latitude, pos.coords.longitude);
    },
    () => alert('自動定位失敗，請手動點擊定位按鈕')
  );
} else {
  // 不支援定位時提示使用者
  alert('瀏覽器不支援定位功能');
}

// -------- 定位按鈕 --------
// 點擊「定位」按鈕後手動取得一次位置並開始導航
document.getElementById('locateBtn').addEventListener('click', () => {
  navigator.geolocation?.getCurrentPosition(
    pos => {
      // 開啟導航模式
      isNavigating = true;
      window.isNavigating = isNavigating;  // 同步全域導航狀態
      updateUserLocation(pos.coords.latitude, pos.coords.longitude);
    },
    () => alert('定位失敗')
  );
});

// -------- 裝置方向權限請求 --------
// 某些系統 (如 iOS) 需先請求方向感測權限
function requestOrientationPermission() {
  if (
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function'
  ) {
    // iOS 專用權限請求流程
    DeviceOrientationEvent.requestPermission()
      .then(state => {
        if (state === 'granted') {
          // 權限允許後監聽裝置方向事件
          window.addEventListener("deviceorientation", handleOrientation, true);
        } else {
          alert("請允許方向感測權限");
        }
      })
      .catch(console.error);
  } else {
    // 其他平台直接監聽裝置方向事件
    window.addEventListener("deviceorientation", handleOrientation, true);
  }
}

// -------- 裝置方向 --------
// 處理方向感測事件，計算 currentHeading 並更新圖示方向
function handleOrientation(event) {
  if (typeof event.webkitCompassHeading !== "undefined") {
    // iOS 瀏覽器提供的真北角度
    currentHeading = event.webkitCompassHeading;
  } else if (typeof event.alpha === "number") {
    // 其他瀏覽器以 alpha 角度轉換（順時針為正）
    currentHeading = 360 - event.alpha;
  }
  // 讓使用者圖示依新朝向旋轉
  rotateUserIcon();
}

// ====== 搜尋與導航 ======
// 取得搜尋輸入框與結果容器
const searchInput      = document.getElementById('searchInput');
const resultsContainer = document.getElementById('searchResults');
let debounceTimer = null;

// 文字輸入觸發搜尋（僅更新列表，不進行語音播報）
searchInput.addEventListener('input', (event) => {
  const q = searchInput.value.trim();
  // 若輸入為空，清空結果並返回
  if (!q) return resultsContainer.innerHTML = '';
  // 若為手動輸入，關閉語音選擇流程
  if (event.isTrusted) isVoiceSelection = false;
  // 清除先前定時器，防抖處理
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    // 使用 Nominatim API 搜尋地點
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(data => {
        // 無結果時顯示提示
        if (!data.length) return resultsContainer.innerHTML = '<li>找不到地點</li>';
        // 儲存搜尋資料並初始化批次索引
        searchResultsData = data;
        currentBatchStart = 0;
        // 顯示第一批結果（最多 5 筆）
        displayBatch();
        // ※ 語音流程由 speech.js 的 voiceBatchSelect 單次觸發
      })
      .catch(() => {
        // 錯誤時顯示搜尋錯誤
        resultsContainer.innerHTML = '<li>搜尋錯誤</li>';
      });
  }, 300);
});

// ===== 顯示一批（最多 5 筆） =====
function displayBatch() {
  // 清空現有列表
  resultsContainer.innerHTML = '';
  // 取出當前批次資料
  const batch = searchResultsData.slice(currentBatchStart, currentBatchStart + 5);
  batch.forEach((p, i) => {
    // 建立列表項目
    const li = document.createElement('li');
    li.textContent = p.display_name;
    li.style.cursor = 'pointer';
    // 點擊後處理目的地選擇
    li.addEventListener('click', () => handleDestinationSelect(p));
    resultsContainer.appendChild(li);
  });
  // *** 此函式僅負責列表渲染，語音辨識由 voiceBatchSelect 處理 ***
}

// ===== 語音批次選擇流程 =====
function voiceBatchSelect() {
  // 僅在語音選擇模式且有結果時執行
  if (!window.isVoiceSelection || !window.searchResultsData.length) return;

  // 取得當前批次
  const batch = window.searchResultsData.slice(window.currentBatchStart, window.currentBatchStart + 5);
  const numerals = ['一','二','三','四','五'];
  let i = 0;

  // 依序唸出每個選項
  function speakBatchOptions() {
    if (i < batch.length) {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(`第${i+1}筆，${batch[i].display_name}`);
      u.lang = 'zh-TW';
      u.onend = () => { i++; speakBatchOptions(); };
      speechSynthesis.speak(u);
    } else {
      // 唸完後提示使用者選擇或換組
      speechSynthesis.cancel();
      const tip = new SpeechSynthesisUtterance('請說第幾筆選擇，或說下一組');
      tip.lang = 'zh-TW';
      tip.onend = () => {
        // 延遲觸發語音辨識
        setTimeout(startVoiceSelect, 200);
      };
      speechSynthesis.speak(tip);
    }
  }

  // 啟動語音辨識以接收使用者回應
  function startVoiceSelect() {
    let recog = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recog.lang = 'zh-TW';
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    recog.start();

    recog.onresult = function(ev) {
      const transcript = ev.results[0][0].transcript.trim();
      // 中文與數字對應
      const numMap = {'一':1,'二':2,'三':3,'四':4,'五':5,'1':1,'2':2,'3':3,'4':4,'5':5};
      let sel = null;
      // 判斷使用者說哪個數字
      for (let k in numMap) {
        if (transcript.includes(k)) { sel = numMap[k]; break; }
      }
      if (sel != null) {
        const idx = currentBatchStart + sel - 1;
        // 若選擇有效則開始導航
        if (idx < searchResultsData.length) {
          speakNav('正在導航到目的地');
          handleDestinationSelect(searchResultsData[idx]);
          return;
        }
      }
      // 語音包含「下／下一／再來」時，切換下一批
      if (/下|下一|再來/.test(transcript)) {
        currentBatchStart += 5;
        if (currentBatchStart >= searchResultsData.length) currentBatchStart = 0;
        voiceBatchSelect();
        return;
      }
      // 無法辨識時提示並重試
      speakNav('請再說一次，第幾筆或下一組');
      setTimeout(voiceBatchSelect, 800);
    };
  }

  // 開始唸出本批選項
  speakBatchOptions();
}

// 將 voiceBatchSelect 暴露給 speech.js 主流程使用
window.voiceBatchSelect = voiceBatchSelect;


// ===== 目的地選擇與導航啟動（狀態同步） =====
function handleDestinationSelect(place) {
  // 取消先前任何正在播放的語音
  speechSynthesis.cancel();

  // 解析 place 中的緯度與經度
  const lat = parseFloat(place.lat);
  const lon = parseFloat(place.lon);
  if (isNaN(lat) || isNaN(lon)) {
    // 座標解析失敗時提醒使用者，並重置語音選擇旗標
    alert("目的地座標有誤");
    window.isVoiceSelection = false;
    return;
  }

  // 如果已存在舊的目的地標記，先移除
  if (destinationMarker) map.removeLayer(destinationMarker);
  // 新增新的目的地標記，並開啟 Popup 顯示名稱
  destinationMarker = L.marker([lat, lon])
    .addTo(map)
    .bindPopup(place.display_name)
    .openPopup();
  // 調整地圖中心與縮放到目的地
  map.setView([lat, lon], 15);
  // 清空搜尋結果列表與輸入欄位
  resultsContainer.innerHTML = '';
  searchInput.value = '';

  // 若非語音流程時，詢問是否立即導航
  if (!window.isVoiceSelection) {
    if (!confirm("已選擇目的地，是否立即導航？")) {
      return;
    }
  }

  // 將語音選擇旗標歸零
  window.isVoiceSelection = false;

  // 檢查是否有有效的使用者位置
  if (!userLocation || userLocation.length !== 2 || userLocation.some(isNaN)) {
    alert("⚠️ 尚未取得有效的使用者位置，請先啟用定位功能再試一次。");
    window.isVoiceSelection = false;
    return;
  }

  // 請求裝置方向權限，以便後續旋轉使用者圖示
  requestOrientationPermission();

  // 組裝路線規劃 API 的參數與 URL
  const startLon = userLocation[1];
  const startLat = userLocation[0];
  const destLon  = lon;
  const destLat  = lat;
  const url = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${destLon},${destLat}?overview=full&geometries=geojson&steps=true`;

  // 發送路線規劃請求
  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      // 取得 GeoJSON 格式的路徑
      const route = data.routes[0].geometry;
      // 移除舊的路徑圖層（若存在）
      if (routeLayer) {
        map.removeLayer(routeLayer);
        routeLayer = null;
      }
      // 新增路徑圖層並顯示
      routeLayer = L.geoJSON(route, { style: { color: 'blue', weight: 5 } })
        .addTo(map);
      // 調整地圖視野以包含整條路徑
      map.fitBounds(routeLayer.getBounds());

      // 取得導航步驟列表
      const steps = data.routes[0].legs?.[0]?.steps || [];
      navigationSteps = steps;

      // 非語音流程時，語音提示開始導航
      if (!window.isVoiceSelection) {
        speakNav(`正在導航到${place.display_name}`);
      }
      // 如果有導航步驟，顯示第一條指令
      if (steps.length) showNavigationInstruction(steps);

      // 設定並同步導航狀態
      isNavigating = true;
      window.isNavigating = isNavigating;
      // 更新使用者位置與圖示方向
      updateUserLocation(userLocation[0], userLocation[1]);
      // 新增「取消導航」按鈕
      addCancelNavigationButton();
      // 重置語音選擇旗標
      window.isVoiceSelection = false;
    })
    .catch(err => {
      // 路線規劃失敗時顯示錯誤並切換到簡易導航提示介面
      console.error("路線規劃錯誤:", err);
      alert("路線規劃錯誤");
      showNavigationPrompt();
      addCancelNavigationButton();
      window.isVoiceSelection = false;
    });
}

// ===== 建立「取消導航」按鈕 =====
function addCancelNavigationButton() {
  // 取得導航提示容器
  const navBox = document.getElementById('navigationPrompt');
  
  // 若已存在取消按鈕，則不重複建立
  if (navBox.querySelector('.cancelRouteBtn')) return;

  // 建立新的按鈕元素
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'cancelRouteBtn';
  cancelBtn.textContent = '取消導航';

  // 按下按鈕即取消導航流程
  cancelBtn.addEventListener('click', () => {
    // 隱藏導航提示
    hideNavigationPrompt();

    // 移除路徑圖層與目的地標記
    if (routeLayer) {
      map.removeLayer(routeLayer);
      routeLayer = null;
    }
    if (destinationMarker) {
      map.removeLayer(destinationMarker);
      destinationMarker = null;
    }

    // 重置導航狀態
    isNavigating = false;
    window.isNavigating = isNavigating; // 同步全域狀態
    navigationSteps = [];

    // 移除並重新建立使用者標記為預設圖示
    if (userMarker) {
      map.removeLayer(userMarker);
      destinationMarker = null;
      userMarker = L.marker(userLocation, { icon: createDefaultMarkerIcon() })
        .addTo(map)
        .bindPopup("您的位置")
        .openPopup();
    }

    // 移除頁面上現有的取消導航按鈕
    const existingCancelBtn = document.querySelector('.cancelRouteBtn');
    if (existingCancelBtn) existingCancelBtn.remove();

    // 還原搜尋列與結果列表狀態
    document.getElementById('search-bar').style.display = 'flex';
    resultsContainer.innerHTML = '';
    resultsContainer.style.display = 'block';
    searchInput.disabled = false;

    // 停止位置檢查計時器
    if (positionCheck) {
      clearInterval(positionCheck);
      positionCheck = null;
    }

    // 清空文字導航指示
    document.getElementById('currentRoad').textContent = '';
    document.getElementById('nextInstruction').textContent = '';
    document.getElementById('navigationPrompt').style.display = 'none';

    // ✅ 只有在取消導航時，才清除先前儲存的地圖狀態
    sessionStorage.removeItem('mapState');
  });

  // 將取消按鈕新增到導航提示容器
  navBox.appendChild(cancelBtn);
}


// ===== 顯示導航指示（含語音播報） =====
function showNavigationInstruction(steps) {
  // 顯示搜尋列以外的導航提示區塊
  showNavigationPrompt();
  const navBox = document.getElementById('navigationPrompt');
  navBox.style.display = 'block';

  // 目前正在執行的步驟索引
  let currentStepIndex = 0;

  // 依照 OSRM 回傳的 maneuver 資訊，轉換為中文指令文字
  function getManeuverText(m) {
    switch (m.type) {
      case "turn":
        if (m.modifier === "left")     return "左轉進入";
        if (m.modifier === "right")    return "右轉進入";
        if (m.modifier === "straight") return "直行進入";
        // 其他 modifier 自動帶入
        return `${m.modifier} 轉入`;
      case "arrive":
        // 抵達目的地
        return "抵達";
      default:
        // 無法辨識類型時，回傳原始 type
        return `${m.type}`;
    }
  }

  // ===== 更新並顯示當前／下一步導航指示 =====
  function updateInstruction() {
    // 取得目前步驟與下一步驟
    const step     = steps[currentStepIndex];
    const nextStep = steps[currentStepIndex + 1];

    // 計算要播報的文字：若有下一步，則顯示距離及轉向，否則顯示已抵達
    const speechText = nextStep
      ? `${Math.round(nextStep.distance)}公尺後${getManeuverText(nextStep.maneuver)}${nextStep.name || "無名道路"}`
      : "已抵達目的地";

    // 顯示文字於畫面
    document.getElementById('currentRoad').textContent    = `目前在：${step.name || "無名道路"}`;
    document.getElementById('nextInstruction').textContent = speechText;

    // 播報語音導航提示（呼叫 speech.js 中的 speakNav）
    speakNav(speechText);
  }

  // 立即呼叫一次以初始化指示
  updateInstruction();

  // ===== 定期檢查使用者位置以前進步驟 =====
  positionCheck = setInterval(() => {
    if (!userLocation) return;  // 尚未有定位資料則跳過

    // 建立 Leaflet LatLng 物件
    const userLatLng = L.latLng(userLocation[0], userLocation[1]);
    const step       = steps[currentStepIndex];
    const latLng     = L.latLng(
      step.maneuver.location[1],
      step.maneuver.location[0]
    );

    // 若使用者接近當前步驟目的地點（20 公尺內），則進入下一步
    if (userLatLng.distanceTo(latLng) < 20) {
      currentStepIndex++;
      if (currentStepIndex < steps.length) {
        // 還有後續步驟，更新指示
        updateInstruction();
      } else {
        // 完成所有步驟：清除檢查計時器、播報抵達、結束導航
        clearInterval(positionCheck);
        speakNav("您已抵達目的地");
        hideNavigationPrompt();
        isNavigating = false;
        window.isNavigating = isNavigating;  // 同步全域狀態
      }
    }
  }, 2000);  // 每 2 秒檢查一次
}
// ===== 切換到影像辨識前，儲存當前地圖狀態 =====
document.getElementById('cameraBtn').addEventListener('click', () => {
  // 讀取地圖中心與縮放
  const center = map.getCenter();
  const state = {
    center:   { lat: center.lat, lng: center.lng },
    zoom:      map.getZoom(),
    userLocation: userLocation 
      ? { lat: userLocation[0], lng: userLocation[1] }
      : null,
    destination: destinationMarker
      ? {
          lat: destinationMarker.getLatLng().lat,
          lng: destinationMarker.getLatLng().lng,
          name: destinationMarker.getPopup().getContent()
        }
      : null,
    routeGeoJSON: routeLayer ? routeLayer.toGeoJSON() : null,
    steps:       navigationSteps
  };
  // 將地圖狀態存入 sessionStorage，以便 detect.html 還原
  sessionStorage.setItem('mapState', JSON.stringify(state));
  // 轉址到辨識頁面
  window.location.href = '/detect';
});

// ===== 頁面載入完成後隱藏 Loading 畫面 =====
window.addEventListener('load', function () {
  const loader = document.getElementById('loader-wrapper');
  if (loader) {
    // 加入淡出效果 class
    loader.classList.add('fade-out');
    // 2 秒後移除整個 loading wrapper
    setTimeout(() => {
      loader.remove();
    }, 2000);
  }
});
