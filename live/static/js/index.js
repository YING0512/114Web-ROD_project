// 初始化地圖
const map = L.map('map').setView([22.999728, 120.227028], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

let userMarker = null;
let destinationMarker = null;
let routeLayer = null;
let userLocation = null;

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

            resultsContainer.innerHTML = '';
            searchInput.value = '';
            resultsContainer.style.display = 'block'; // 顯示搜尋結果清單

            const confirmNav = confirm("已選擇目的地，是否立即導航？");

            // 移除舊的取消導航按鈕（如果有的話）
            const oldCancelBtn = document.querySelector('.cancelRouteBtn');
            if (oldCancelBtn && oldCancelBtn.parentElement) {
              oldCancelBtn.parentElement.remove();
            }

            // 插入取消導航按鈕
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'cancelRouteBtn';
            cancelBtn.textContent = '取消導航';

            const cancelLi = document.createElement('li');
            cancelBtn.addEventListener('click', () => {
              if (routeLayer) {
                map.removeLayer(routeLayer);
                routeLayer = null;
              }
              if (destinationMarker) {
                map.removeLayer(destinationMarker);
                destinationMarker = null;
              }
              resultsContainer.innerHTML = ''; // ✅ 先清空所有搜尋結果與按鈕
              resultsContainer.style.display = 'none'; // 隱藏搜尋結果清單
            });
            resultsContainer.appendChild(cancelLi);

            cancelLi.appendChild(cancelBtn);
            resultsContainer.appendChild(cancelLi);

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

// 相機按鈕事件
document.getElementById('cameraBtn').addEventListener('click', () => {
  window.location.href = '/detect';
});
