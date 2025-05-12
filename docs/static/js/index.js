// 初始化地圖
const map = L.map('map').setView([22.999728, 120.227028], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

let userMarker = null;
let destinationMarker = null;
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


// 初次載入即定位
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition((position) => {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    userLocation = [lat, lng];

    if (userMarker) {
      map.removeLayer(userMarker);
    }

    userMarker = L.marker(userLocation).addTo(map)
      .bindPopup("您的位置")
      .openPopup();

    map.setView(userLocation, 18);
  }, () => {
    alert('自動定位失敗，請手動點擊定位按鈕');
  });
} else {
  alert('瀏覽器不支援定位功能');
}

// 定位按鈕
document.getElementById('locateBtn').addEventListener('click', () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      userLocation = [lat, lng];

      if (userMarker) {
        map.removeLayer(userMarker);
      }

      userMarker = L.marker(userLocation).addTo(map)
        .bindPopup("您的位置")
        .openPopup();

      map.setView(userLocation, 18);
    }, () => {
      alert('定位失敗');
    });
  } else {
    alert('瀏覽器不支援定位功能');
  }
});

// 搜尋功能
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
          
            if (destinationMarker) {
              map.removeLayer(destinationMarker);
            }
          
            destinationMarker = L.marker([lat, lon]).addTo(map)
              .bindPopup(place.display_name)
              .openPopup();
          
            map.setView([lat, lon], 15);
          
            // 清空舊結果與按鈕
            resultsContainer.innerHTML = '';
            searchInput.value = '';
                      
            const confirmNav = confirm("已選擇目的地，是否立即導航？");
          
            if (confirmNav) {
              if (!userLocation) {
                alert("請先啟用定位功能");
                return;
              }
          
              const url = `https://router.project-osrm.org/route/v1/driving/${userLocation[1]},${userLocation[0]};${lon},${lat}?overview=full&geometries=geojson`;
          
              fetch(url)
                .then(res => res.json())
                .then(data => {
                  if (data.routes.length === 0) {
                    alert("找不到路線");
                    return;
                  }
          
                  const route = data.routes[0].geometry;
          
                  if (routeLayer) {
                    map.removeLayer(routeLayer);
                  }
          
                  routeLayer = L.geoJSON(route, {
                    style: {
                      color: 'blue',
                      weight: 5
                    }
                  }).addTo(map);
          
                  map.fitBounds(L.geoJSON(route).getBounds());
          
                  // 插入取消導航按鈕
                  const cancelLi = document.createElement('li');
                  const cancelBtn = document.createElement('button');
                  cancelBtn.className = 'cancelRouteBtn';
                  cancelBtn.textContent = '取消導航';
          
                  cancelBtn.addEventListener('click', () => {
                    if (routeLayer) {
                      map.removeLayer(routeLayer);
                      routeLayer = null;
                    }
                    if (destinationMarker) {
                      map.removeLayer(destinationMarker);
                      destinationMarker = null;
                    }
                    resultsContainer.innerHTML = ''; // 清空搜尋結果和按鈕
                    resultsContainer.style.display = 'none';
                  });
          
                  cancelLi.appendChild(cancelBtn);
                  resultsContainer.appendChild(cancelLi);
                })
                .catch(() => {
                  alert("路線規劃錯誤");
                });
            } else {
              alert("已選擇目的地，如需重新導航請重新搜尋");
            }
          });
          
          resultsContainer.appendChild(li);
        });
      })
      .catch(() => {
        resultsContainer.innerHTML = '<li>搜尋錯誤</li>';
      });
  }, 300);
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
  window.location.href = '/detect';})
