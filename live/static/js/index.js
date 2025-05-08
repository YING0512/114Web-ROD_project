const map = document.getElementById('map');
const marker = document.getElementById('mapMarker');

// 定位功能
document.getElementById('locateBtn').addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert('你的瀏覽器不支援定位功能。');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      map.setAttribute('center', `${lat},${lng}`);
      map.setAttribute('zoom', '15');
      marker.setAttribute('position', `${lat},${lng}`);
      marker.setAttribute('title', '你的位置');
    },
    () => alert('無法取得你的定位。')
  );
});

// 地點搜尋
document.getElementById('placePicker').addEventListener('gmpx-placechange', (e) => {
  const place = e.detail;
  if (!place.geometry) {
    alert('找不到結果！');
    return;
  }
  const { lat, lng } = place.geometry.location;
  map.setAttribute('center', `${lat},${lng}`);
  map.setAttribute('zoom', '16');
  marker.setAttribute('position', `${lat},${lng}`);
  marker.setAttribute('title', place.formatted_address || place.name);
});

// 跳到辨識頁
document.getElementById('cameraBtn').addEventListener('click', () => {
  window.location.href = '/detect';
});
