initSpeechUI();
document.getElementById('voiceNavBtn').onclick = function () {
    startVoiceCommand({ mode: 'index' });
}

// ===== 語音說明按鈕事件處理 =====
const speechInfoBtn = document.getElementById('speechInfo');
speechInfoBtn.addEventListener('click', () => {
  alert('連續點擊畫面三下可切換語音開關');
});

// ===== 搜尋結果資料與批次索引 =====
let searchResultsData = [];
let currentBatchStart = 0;
window.isVoiceSelection = false; // 全域語音選擇旗標

// 初始化地圖
const map = L.map('map').setView([22.999728, 120.227028], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// 全域變數
let userMarker = null;
let destinationMarker = null;
let routeLayer = null;
let userLocation = null;
let currentHeading = 0;
let isNavigating = false;
let navigationSteps = [];
let positionCheck = null;

// 狀態同步到 window 供語音檢查
window.isNavigating = isNavigating;

// -------- 顯示切換工具 --------
function showNavigationPrompt() {
  document.getElementById('search-bar').style.display = 'none';
  document.getElementById('navigationPrompt').style.display = 'block';
}

function hideNavigationPrompt() {
  document.getElementById('search-bar').style.display = 'flex';
  document.getElementById('navigationPrompt').style.display = 'none';
}

// -------- Icon 工具 --------
function createUserIcon() {
  return L.divIcon({
    className: '',
    html: '<div class="arrow-icon"></div>',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
}
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

  iconDiv.style.transform = `translate(-50%, -50%) rotate(${currentHeading}deg)`;
}

// -------- 地圖狀態還原 --------
window.addEventListener('load', () => {
  const saved = sessionStorage.getItem('mapState');
  if (!saved) return;
  const state = JSON.parse(saved);
  map.setView([state.center.lat, state.center.lng], state.zoom);

  if (state.userLocation) {
    userLocation = [state.userLocation.lat, state.userLocation.lng];
    userMarker = L.marker(userLocation, { icon: isNavigating ? createUserIcon() : createDefaultMarkerIcon() }).addTo(map).bindPopup("您的位置").openPopup();
    rotateUserIcon();
  }

  if (state.destination) {
    destinationMarker = L.marker([state.destination.lat, state.destination.lng]).addTo(map).bindPopup(state.destination.name || "目的地").openPopup();
  }

  if (state.routeGeoJSON) {
    routeLayer = L.geoJSON(state.routeGeoJSON, { style: { color: 'blue', weight: 5 } }).addTo(map);
    map.fitBounds(routeLayer.getBounds());
  }

  sessionStorage.removeItem('mapState');
});

// -------- 使用者定位 --------
function updateUserLocation(lat, lng) {
  userLocation = [lat, lng];
  const icon = isNavigating ? createUserIcon() : createDefaultMarkerIcon();

  if (userMarker) {
    userMarker.setLatLng(userLocation);
    userMarker.setIcon(icon);
  } else {
    userMarker = L.marker(userLocation, { icon }).addTo(map).bindPopup("您的位置").openPopup();
  }

  rotateUserIcon();
  map.setView(userLocation, 18);
}

if (navigator.geolocation) {
  navigator.geolocation.watchPosition(pos => {
    updateUserLocation(pos.coords.latitude, pos.coords.longitude);
  }, () => alert('自動定位失敗，請手動點擊定位按鈕'));
} else {
  alert('瀏覽器不支援定位功能');
}

// -------- 定位按鈕 --------
document.getElementById('locateBtn').addEventListener('click', () => {
  navigator.geolocation?.getCurrentPosition(pos => {
    isNavigating = true;
    window.isNavigating = isNavigating; // 狀態同步
    updateUserLocation(pos.coords.latitude, pos.coords.longitude);
  }, () => alert('定位失敗'));
});

function requestOrientationPermission() {
  if (
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function'
  ) {
    DeviceOrientationEvent.requestPermission()
      .then(state => {
        if (state === 'granted') {
          window.addEventListener("deviceorientation", handleOrientation, true);
        } else {
          alert("請允許方向感測權限");
        }
      })
      .catch(console.error);
  } else {
    window.addEventListener("deviceorientation", handleOrientation, true);
  }
}

// -------- 裝置方向 --------
function handleOrientation(event) {
  if (typeof event.webkitCompassHeading !== "undefined") {
    currentHeading = event.webkitCompassHeading;
  } else if (typeof event.alpha === "number") {
    currentHeading = 360 - event.alpha;
  }
  rotateUserIcon();
}

// ====== 搜尋與導航 ======
const searchInput      = document.getElementById('searchInput');
const resultsContainer = document.getElementById('searchResults');
let debounceTimer = null;

// 文字輸入觸發搜尋（僅更新列表，不播報）
searchInput.addEventListener('input', (event) => {
  const q = searchInput.value.trim();
  if (!q) return resultsContainer.innerHTML = '';
  if (event.isTrusted) isVoiceSelection = false; // 手動輸入關閉語音流程
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`)
      .then(r => r.json()).then(data => {
        if (!data.length) return resultsContainer.innerHTML = '<li>找不到地點</li>';
        searchResultsData = data;
        currentBatchStart = 0;
        displayBatch();
        // ※ displayBatch 只負責顯示，語音主流程只由 speech.js 呼叫一次 voiceBatchSelect
      }).catch(() => resultsContainer.innerHTML = '<li>搜尋錯誤</li>');
  }, 300);
});

// ===== 顯示一批（最多 5 筆），語音模式下只顯示不重複進入語音流程 =====
function displayBatch() {
  resultsContainer.innerHTML = '';
  const batch = searchResultsData.slice(currentBatchStart, currentBatchStart + 5);
  batch.forEach((p, i) => {
    const li = document.createElement('li');
    li.textContent = p.display_name;
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => handleDestinationSelect(p));
    resultsContainer.appendChild(li);
  });
  // *** 不在這裡朗讀及進入語音辨識，只由 speech.js 語音主流程呼叫一次 voiceBatchSelect ***
}

// ===== 語音批次選擇流程 =====
function voiceBatchSelect() {
  if (!window.isVoiceSelection || !window.searchResultsData.length) return;
  // -- 唸出這一批 --
  const batch = window.searchResultsData.slice(window.currentBatchStart, window.currentBatchStart + 5);
  const numerals = ['一','二','三','四','五'];
  let i = 0;

  function speakBatchOptions() {
    if (i < batch.length) {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(`第${i+1}筆，${batch[i].display_name}`);
      u.lang = 'zh-TW';
      u.onend = () => { i++; speakBatchOptions(); };
      speechSynthesis.speak(u);
    } else {
      speechSynthesis.cancel();
      const tip = new SpeechSynthesisUtterance('請說第幾筆選擇，或說下一組');
      tip.lang = 'zh-TW';
      tip.onend = () => {
        setTimeout(startVoiceSelect, 200);
      };
      speechSynthesis.speak(tip);
    }
  }

  // 唸選項+提示後進語音辨識
  function startVoiceSelect() {
    let recog = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recog.lang = 'zh-TW';
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    recog.start();
    recog.onresult = function(ev) {
      const transcript = ev.results[0][0].transcript.trim();
      const numMap = {'一':1,'二':2,'三':3,'四':4,'五':5,'1':1,'2':2,'3':3,'4':4,'5':5};
      let sel = null;
      for (let k in numMap) {
        if (transcript.includes(k)) { sel = numMap[k]; break; }
      }
      if (sel != null) {
        const idx = currentBatchStart + sel - 1;
        if (idx < searchResultsData.length) {
          speakNav('正在導航到目的地');
          // 這裡**不要設 window.isVoiceSelection = false**，由 handleDestinationSelect 去處理！
          handleDestinationSelect(searchResultsData[idx]);
          return;
        }
      }
      if (/下|下一|再來/.test(transcript)) {
        currentBatchStart += 5;
        if (currentBatchStart >= searchResultsData.length) currentBatchStart = 0;
        // 下一組之後重播新的一組
        voiceBatchSelect();
        return;
      }
      // 無匹配則再來一次
      speakNav('請再說一次，第幾筆或下一組');
      setTimeout(voiceBatchSelect, 800);
    };
  }

  speakBatchOptions();
}

// 供 speech.js 語音主流程直接觸發
window.voiceBatchSelect = voiceBatchSelect;

// ===== 目的地選擇與導航啟動（狀態同步） =====
function handleDestinationSelect(place) {
  speechSynthesis.cancel();

  const lat = parseFloat(place.lat);
  const lon = parseFloat(place.lon);
  if (isNaN(lat) || isNaN(lon)) {
    alert("目的地座標有誤");
    window.isVoiceSelection = false;
    return;
  }

  if (destinationMarker) map.removeLayer(destinationMarker);
  destinationMarker = L.marker([lat, lon]).addTo(map).bindPopup(place.display_name).openPopup();
  map.setView([lat, lon], 15);
  resultsContainer.innerHTML = '';
  searchInput.value = '';

  // 只在「非語音流程」時詢問
  if (!window.isVoiceSelection) {
    if (!confirm("已選擇目的地，是否立即導航？")) {
      return;
    }
  }

  // 只在這裡歸零
  window.isVoiceSelection = false;

  if (!userLocation || userLocation.length !== 2 || userLocation.some(isNaN)) {
    alert("⚠️ 尚未取得有效的使用者位置，請先啟用定位功能再試一次。");
    window.isVoiceSelection = false;
    return;
  }

  requestOrientationPermission();

  const startLon = userLocation[1];
  const startLat = userLocation[0];
  const destLon  = lon;
  const destLat  = lat;
  const url = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${destLon},${destLat}?overview=full&geometries=geojson&steps=true`;

  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      const route = data.routes[0].geometry;
      if (routeLayer) {
        map.removeLayer(routeLayer);
        routeLayer = null;
      }
      routeLayer = L.geoJSON(route, { style: { color: 'blue', weight: 5 } }).addTo(map);
      map.fitBounds(routeLayer.getBounds());

      const steps = data.routes[0].legs?.[0]?.steps || [];
      navigationSteps = steps;
      if (!window.isVoiceSelection) {
        speakNav(`正在導航到${place.display_name}`);
      }
      if (steps.length) showNavigationInstruction(steps);
      isNavigating = true;
      window.isNavigating = isNavigating; // 狀態同步
      updateUserLocation(userLocation[0], userLocation[1]);
      addCancelNavigationButton();
      window.isVoiceSelection = false;
    })
    .catch(err => {
      console.error("路線規劃錯誤:", err);
      alert("路線規劃錯誤");
      showNavigationPrompt();
      addCancelNavigationButton();
      window.isVoiceSelection = false;
    });
}




function addCancelNavigationButton() {
  const navBox = document.getElementById('navigationPrompt');
  
  // 防止重複建立按鈕
  if (navBox.querySelector('.cancelRouteBtn')) return;

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'cancelRouteBtn';
  cancelBtn.textContent = '取消導航';

  cancelBtn.addEventListener('click', () => {
    hideNavigationPrompt();

    if (routeLayer) {
      map.removeLayer(routeLayer);
      routeLayer = null;
    }
    if (destinationMarker) {
      map.removeLayer(destinationMarker);
      destinationMarker = null;
    }

    isNavigating = false;
    window.isNavigating = isNavigating; // 狀態同步
    navigationSteps = [];

    if (userMarker) {
      map.removeLayer(userMarker);
      destinationMarker = null;
      userMarker = L.marker(userLocation, { icon: createDefaultMarkerIcon() })
        .addTo(map)
        .bindPopup("您的位置")
        .openPopup();
    }

    const existingCancelBtn = document.querySelector('.cancelRouteBtn');
    if (existingCancelBtn) existingCancelBtn.remove();

    document.getElementById('search-bar').style.display = 'flex';
    resultsContainer.innerHTML = '';
    resultsContainer.style.display = 'block';
    searchInput.disabled = false;

    if (positionCheck) {
      clearInterval(positionCheck);
      positionCheck = null;
    }

    document.getElementById('currentRoad').textContent = '';
    document.getElementById('nextInstruction').textContent = '';
    document.getElementById('navigationPrompt').style.display = 'none';

    // ✅ 加在這裡：取消導航時才清除儲存的導航狀態
    sessionStorage.removeItem('mapState');
  });

  navBox.appendChild(cancelBtn);
}


// ===== 顯示導航指示（含語音播報） =====
function showNavigationInstruction(steps) {
  showNavigationPrompt();
  const navBox = document.getElementById('navigationPrompt');
  navBox.style.display = 'block';

  let currentStepIndex = 0;

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

  function updateInstruction() {
    const step     = steps[currentStepIndex];
    const nextStep = steps[currentStepIndex + 1];

    // 計算語音播報內容
    const speechText = nextStep
      ? `${Math.round(nextStep.distance)}公尺後${getManeuverText(nextStep.maneuver)}${nextStep.name || "無名道路"}`
      : "已抵達目的地";

    // 顯示文字
    document.getElementById('currentRoad').textContent   = `目前在：${step.name || "無名道路"}`;
    document.getElementById('nextInstruction').textContent = speechText;

    // 語音播報
    speakNav(speechText); // 直接呼叫 speech.js 的 speakNav
  }

  updateInstruction();

  positionCheck = setInterval(() => {
    if (!userLocation) return;
    const userLatLng = L.latLng(userLocation[0], userLocation[1]);
    const step       = steps[currentStepIndex];
    const latLng     = L.latLng(
      step.maneuver.location[1],
      step.maneuver.location[0]
    );
    if (userLatLng.distanceTo(latLng) < 20) {
      currentStepIndex++;
      if (currentStepIndex < steps.length) {
        updateInstruction();
      } else {
        clearInterval(positionCheck);
        speakNav("您已抵達目的地");
        hideNavigationPrompt();
        isNavigating = false;
        window.isNavigating = isNavigating; // 狀態同步
      }
    }
  }, 2000);
}

// **切換到影像辨識前，先儲存目前地圖狀態到 sessionStorage**
document.getElementById('cameraBtn').addEventListener('click', () => {
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
  sessionStorage.setItem('mapState', JSON.stringify(state));
  window.location.href = '/detect';
});


// ===== 頁面載入完成後淡出載入畫面 =====
window.addEventListener('load', function () {
  const loader = document.getElementById('loader-wrapper');
  if (loader) {
    loader.classList.add('fade-out');
    setTimeout(() => {
      loader.remove();
    }, 2000);
  }
});
