const map = document.getElementById('map');
const marker = document.getElementById('mapMarker');
const placePicker = document.getElementById('placePicker');

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

// 地點搜尋功能
placePicker.addEventListener('gmpx-placechange', () => {
  const place = placePicker.value;

  if (!place || !place.id) {
    alert('請重新輸入地址');
    return;
  }

  const service = new google.maps.places.PlacesService(document.createElement('div'));
  service.getDetails(
    {
      placeId: place.id,
      fields: ['name', 'formatted_address', 'geometry']
    },
    (result, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && result.geometry?.location) {
        const lat = result.geometry.location.lat();
        const lng = result.geometry.location.lng();

        map.setAttribute('center', `${lat},${lng}`);
        map.setAttribute('zoom', '16');
        marker.setAttribute('position', `${lat},${lng}`);
        marker.setAttribute('title', result.formatted_address || result.name || '選擇的位置');
      } else {
        alert('找不到該地點的座標。');
      }
    }
  );
});


// 跳到辨識頁
document.getElementById('cameraBtn').addEventListener('click', () => {
  window.location.href = '/detect';
});
