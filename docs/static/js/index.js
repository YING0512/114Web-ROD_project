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

      if (!route) throw new Error("路線資料缺失");

      if (routeLayer) map.removeLayer(routeLayer);
      routeLayer = L.geoJSON(route, { style: { color: 'blue', weight: 5 } }).addTo(map);
      map.fitBounds(routeLayer.getBounds());

      if (steps && steps.length) showNavigationInstruction(steps);

      isNavigating = true;
      updateUserLocation(userLocation[0], userLocation[1]);
      addCancelNavigationButton();
    })
    .catch((err) => {
      console.error("路線規劃錯誤:", err);
      alert("路線規劃錯誤");
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
    if (routeLayer) map.removeLayer(routeLayer);
    if (destinationMarker) map.removeLayer(destinationMarker);
    isNavigating = false;

    // 重設使用者標記為預設樣式
    if (userMarker) {
      map.removeLayer(userMarker);
      userMarker = L.marker(userLocation, { icon: createDefaultMarkerIcon() })
        .addTo(map).bindPopup("您的位置").openPopup();
    }

    // 清空搜尋結果
    resultsContainer.innerHTML = '';
    resultsContainer.style.display = 'none';

    // 移除按鈕
    cancelBtn.remove();
  });

  navBox.appendChild(cancelBtn); // ✅ 正確：加在導航提示區塊
}

function showNavigationInstruction(steps) {
  showNavigationPrompt();
  const navBox = document.getElementById('navigationPrompt');
  navBox.style.display = 'block';

  let currentStepIndex = 0;

  function updateInstruction() {
    const step = steps[currentStepIndex];
    if (!step) return;

    const currentRoad = step.name || "無名道路";
    const nextStep = steps[currentStepIndex + 1];
    const nextInstruction = nextStep
      ? `${getManeuverText(nextStep.maneuver)}${nextStep.name || "無名道路"}`
      : "已抵達目的地";

    document.getElementById('currentRoad').textContent = `目前在：${currentRoad}`;
    document.getElementById('nextInstruction').textContent = `接下來：${nextInstruction}`;
  }

  function getManeuverText(m) {
    switch (m.type) {
      case "turn":
        if (m.modifier === "left") return "左轉進入";
        if (m.modifier === "right") return "右轉進入";
        if (m.modifier === "straight") return "直行進入";
        return `${m.modifier} 轉入`;
      case "arrive":
        return "抵達";
      default:
        return `${m.type}`;
    }
  }

  const updateInterval = setInterval(() => {
    if (!userLocation) return;

    const userLatLng = L.latLng(userLocation[0], userLocation[1]);

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const latLng = L.latLng(step.maneuver.location[1], step.maneuver.location[0]);
      if (userLatLng.distanceTo(latLng) < 30) {
        currentStepIndex = i;
        updateInstruction();
        break;
      }
    }

    if (currentStepIndex >= steps.length - 1) {
      clearInterval(updateInterval);
      document.getElementById('nextInstruction').textContent = '已抵達目的地';
    }
  }, 2000);
}



// **切換到影像辨識前，先儲存目前地圖狀態到 sessionStorage**
document.getElementById('cameraBtn').addEventListener('click', () => {
  const center = map.getCenter();
  const state = {
    center: { lat: center.lat, lng: center.lng },
    zoom: map.getZoom(),
    userLocation: userLocation ? { lat: userLocation[0], lng: userLocation[1] } : null,
    destination: destinationMarker ? {
      lat: destinationMarker.getLatLng().lat,
      lng: destinationMarker.getLatLng().lng,
      name: destinationMarker.getPopup().getContent()
    } : null,
    routeGeoJSON: routeLayer ? routeLayer.toGeoJSON() : null
  };
  sessionStorage.setItem('mapState', JSON.stringify(state));
  window.location.href = '/detect';})
