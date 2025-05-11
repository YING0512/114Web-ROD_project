// 初始化地圖，設定中心點與縮放層級
const map = L.map('map').setView([22.999728, 120.227028], 13);  // 設定地圖初始中心為台南市

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

let userMarker = null;
let destinationMarker = null; // 目標地點的 Marker 物件
let routeLayer = null;
let userLocation = null; // 使用者目前位置的經緯度

// **還原先前地圖狀態（若有）**
window.addEventListener('load', () => {
  const saved = sessionStorage.getItem('mapState');
  if (saved) {
    const state = JSON.parse(saved);
    // 還原地圖視角
    map.setView([state.center.lat, state.center.lng], state.zoom);

    // 還原定位
    if (state.userLocation) {
      userLocation = [state.userLocation.lat, state.userLocation.lng];
      if (userMarker) map.removeLayer(userMarker);
      userMarker = L.marker(userLocation).addTo(map)
        .bindPopup("您的位置")
        .openPopup();
    }

    // 還原目的地
    if (state.destination) {
      const d = state.destination;
      if (destinationMarker) map.removeLayer(destinationMarker);
      destinationMarker = L.marker([d.lat, d.lng]).addTo(map)
        .bindPopup(d.name || "目的地")
        .openPopup();
    }

    // 還原導航路線
    if (state.routeGeoJSON) {
      routeLayer = L.geoJSON(state.routeGeoJSON, {
        style: { color: 'blue', weight: 5 }
      }).addTo(map);
      map.fitBounds(L.geoJSON(state.routeGeoJSON).getBounds());
    }

    // 清除暫存
    sessionStorage.removeItem('mapState');
  }
});

// 定位功能
document.getElementById('locateBtn').addEventListener('click', () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      userLocation = [lat, lng];

      // 每次定位前，先移除舊的 userMarker
      if (userMarker) {
        map.removeLayer(userMarker);
      }

      // 加入新的 userMarker
      userMarker = L.marker(userLocation).addTo(map)
        .bindPopup("您的位置")
        .openPopup();

      // 將地圖移動到使用者位置，縮放層級 18 比較貼近
      map.setView(userLocation, 18);
    }, (error) => {
      alert('定位失敗');
    });
  } else {
    alert('瀏覽器不支援定位功能');
  }
});

// 搜尋功能：輸入時即顯示地點建議清單（即時搜尋）
const searchInput = document.getElementById('searchInput');
const resultsContainer = document.getElementById('searchResults');

let debounceTimer = null;

searchInput.addEventListener('input', () => {
  const query = searchInput.value;
  if (!query.trim()) {
    resultsContainer.innerHTML = '';
    return;
  }

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
      .then(response => response.json())
      .then(data => {
        resultsContainer.innerHTML = '';

        if (data.length === 0) {
          const li = document.createElement('li');
          li.textContent = '找不到地點';
          resultsContainer.appendChild(li);
          return;
        }

        data.slice(0, 5).forEach(place => {
          const li = document.createElement('li');
          li.textContent = place.display_name;
          li.style.cursor = 'pointer';
          li.addEventListener('click', () => {
            const lat = parseFloat(place.lat);
            const lon = parseFloat(place.lon);

            // 移除舊的目標地點 Marker
            if (destinationMarker) {
              map.removeLayer(destinationMarker);
            }

            destinationMarker = L.marker([lat, lon]).addTo(map)
              .bindPopup(place.display_name)
              .openPopup();

            map.setView([lat, lon], 15);

            resultsContainer.innerHTML = '';
            searchInput.value = '';

            alert("已選擇目的地，如需導航請再次點擊導航按鈕");
          });
          resultsContainer.appendChild(li);
        });
      })
      .catch(() => {
        resultsContainer.innerHTML = '<li>搜尋錯誤</li>';
      });
  }, 300);
});

// 相機按鈕事件
document.getElementById('cameraBtn').addEventListener('click', () => {
  window.location.href = '/detect';
});

// 導航按鈕事件
document.getElementById('navigateBtn').addEventListener('click', () => {
  if (!userLocation) {
    alert("請先啟用定位功能");
    return;
  }

  if (!destinationMarker) {
    alert("請先搜尋並點選目的地");
    return;
  }

  // 若已存在導航路線，代表是第二次點擊，此時移除路線與目標 marker 並退出
  if (routeLayer) {
    map.removeLayer(routeLayer);
    routeLayer = null;

    if (destinationMarker) {
      map.removeLayer(destinationMarker);
      destinationMarker = null;
    }

    alert("已取消導航路線與目標地點");
    return;
  }

  // 第一次點擊：規劃導航路線
  const destLatLng = destinationMarker.getLatLng();
  const url = `https://router.project-osrm.org/route/v1/driving/${userLocation[1]},${userLocation[0]};${destLatLng.lng},${destLatLng.lat}?overview=full&geometries=geojson`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (data.routes.length === 0) {
        alert("找不到路線");
        return;
      }

      const route = data.routes[0].geometry;

      routeLayer = L.geoJSON(route, {
        style: {
          color: 'blue',
          weight: 5
        }
      }).addTo(map);

      map.fitBounds(L.geoJSON(route).getBounds());
    })
    .catch(() => {
      alert("路線規劃錯誤");
    });
});

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
  window.location.href = '/detect';
});