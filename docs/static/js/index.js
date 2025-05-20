// ===== 語音播報設定 =====
const speechBtn       = document.getElementById('speechToggle');
const speechIcon      = document.getElementById('speechIcon');
const speechInfoBtn   = document.getElementById('speechInfo');
const speechNotice    = document.getElementById('speechNotice');

let speechEnabled     = true;
const SPEECH_COOLDOWN = 5000;
const FRAME_THRESHOLD = 3;
let lastSpeechTime    = 0;
let movementCounter   = 0;
let lastInstruction   = "";
let navigationSteps = [];
let positionCheck = null;


// 切換語音開關
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

// 三連擊切換（單手操作）
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

// 進入頁面時顯示提示並播報
window.addEventListener('DOMContentLoaded', () => {
  if (speechEnabled) {
    speechNotice.style.display = 'block';
    setTimeout(() => { speechNotice.style.display = 'none'; }, 3000);
    speak("語音播報開啟中…");
  }
});

// 資訊按鈕：顯示操作說明
speechInfoBtn.addEventListener('click', () => {
  alert('連續點擊畫面三下可切換語音開關');
});

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
  const mapEl = document.getElementById('map');
}

// -------- 搜尋與導航 --------
const searchInput = document.getElementById('searchInput');
const resultsContainer = document.getElementById('searchResults');
let debounceTimer = null;

// ===== 語音輸入辨識設定 =====
const voiceNavBtn     = document.getElementById('voiceNavBtn');
const recognition     = new (window.SpeechRecognition || window.webkitSpeechRecognition)();

recognition.lang         = 'zh-TW';
recognition.interimResults= false;
recognition.maxAlternatives= 1;

voiceNavBtn.addEventListener('click', () => {
  recognition.start();
});

recognition.addEventListener('result', (event) => {
  const transcript = event.results[0][0].transcript;
  searchInput.value = transcript;
  searchInput.dispatchEvent(new Event('input'));
});

recognition.addEventListener('speechend', () => {
  recognition.stop();
});

recognition.addEventListener('error', (event) => {
  console.error('語音識別錯誤', event.error);
  alert('語音識別錯誤：' + event.error);
});

searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim();
  if (!query) return resultsContainer.innerHTML = '';

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
      .then(res => res.json())
      .then(data => {
        resultsContainer.innerHTML = '';
        if (!data.length) return resultsContainer.innerHTML = '<li>找不到地點</li>';

        data.slice(0, 5).forEach(place => {
          const li = document.createElement('li');
          li.textContent = place.display_name;
          li.style.cursor = 'pointer';
          li.addEventListener('click', () => handleDestinationSelect(place));
          resultsContainer.appendChild(li);
        });
      })
      .catch(() => resultsContainer.innerHTML = '<li>搜尋錯誤</li>');
  }, 300);
});

function handleDestinationSelect(place) {
  const lat = parseFloat(place.lat);
  const lon = parseFloat(place.lon);

  if (isNaN(lat) || isNaN(lon)) {
    alert("目的地座標有誤");
    return;
  }

  if (destinationMarker) map.removeLayer(destinationMarker);
  destinationMarker = L.marker([lat, lon]).addTo(map).bindPopup(place.display_name).openPopup();
  map.setView([lat, lon], 15);
  resultsContainer.innerHTML = '';
  searchInput.value = '';

  if (!confirm("已選擇目的地，是否立即導航？")) return;

  if (!userLocation || userLocation.length !== 2 || userLocation.some(isNaN)) {
  alert("⚠️ 尚未取得有效的使用者位置，請先啟用定位功能再試一次。");
  return;
}


  requestOrientationPermission();

  const startLon = userLocation[1];
  const startLat = userLocation[0];
  const destLon = lon;
  const destLat = lat;

  const url = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${destLon},${destLat}?overview=full&geometries=geojson&steps=true`;

    fetch(url)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (!data || !data.routes || !data.routes.length) {
        throw new Error("無有效路線資料");
      }

      const route = data.routes[0].geometry;
      const steps = data.routes[0].legs?.[0]?.steps;
      navigationSteps = steps;                                // ◎ 保存 steps
      speakNav(`正在導航到${place.display_name}`);             // ◎ 播報目的地
      if (steps && steps.length) showNavigationInstruction(steps);
      isNavigating = true;
      updateUserLocation(userLocation[0], userLocation[1]);
      addCancelNavigationButton();
        })
        .catch((err) => {
          console.error("路線規劃錯誤:", err);
          alert("路線規劃錯誤");
          // 即便規劃失敗，若畫面上已有路線，也要顯示【取消導航】按鈕
          showNavigationPrompt();
          addCancelNavigationButton();
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
  navigationSteps = [];

  if (userMarker) {
    map.removeLayer(userMarker);
    userMarker = L.marker(userLocation, { icon: createDefaultMarkerIcon() })
      .addTo(map).bindPopup("您的位置").openPopup();
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
    speakNav(speechText);
  }

  updateInstruction(); // ◎ 立即顯示並播報第一條指示

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
    steps:       navigationSteps                           // ◎ 新增 steps
  };
  sessionStorage.setItem('mapState', JSON.stringify(state));
  window.location.href = '/detect';
});

