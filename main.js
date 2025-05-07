// Başlangıç harita nesnesi
const map = L.map('map', {
    zoomControl: true,  // Zoom kontrollerini aktif et
    zoomSnap: 0.5,      // Daha hassas zoom için
  }).setView([40.0, 27.0], 8);
  
  // Yakınlaştırma kontrollerinin pozisyonunu ayarla
  map.zoomControl.setPosition('topleft'); // sol üst köşeye alınıyor
  
  // Taban haritalar
  const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  
  const satellite = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0','mt1','mt2','mt3'],
    attribution: '&copy; Google'
  });
  
  let currentBase = "street";
  
  // GeoJSON katmanları
  let currentLayer;
  let allLayers = [];
  
  // Dosya seçici olayları
  document.getElementById('jsonSelector').addEventListener('change', async function () {
    const selected = this.value;
    clearLayers();
  
    if (selected === "hepsini-goster") {
      await loadAllGeoJSON();
    } else if (selected) {
      await loadGeoJSON(selected);
    }
  });
  
  // GeoJSON yükle
  async function loadGeoJSON(fileName) {
    try {
      const response = await fetch(`geojson/${fileName}`);
      const data = await response.json();
      currentLayer = L.geoJSON(data).addTo(map);
      map.fitBounds(currentLayer.getBounds());
    } catch (error) {
      console.error("Yükleme hatası:", error);
    }
  }
  
  // Hepsini yükle
  async function loadAllGeoJSON() {
    const selector = document.getElementById('jsonSelector');
    allLayers = [];
  
    for (const option of selector.options) {
      if (option.value && option.value !== "hepsini-goster") {
        try {
          const response = await fetch(`geojson/${option.value}`);
          const data = await response.json();
          const layer = L.geoJSON(data).addTo(map);
          allLayers.push(layer);
        } catch (error) {
          console.warn(`${option.value} yüklenemedi.`);
        }
      }
    }
  
    // Tüm katmanların sınırlarını birleştir
    const group = L.featureGroup(allLayers);
    map.fitBounds(group.getBounds());
  }
  
  // Katmanları temizle
  function clearLayers() {
    if (currentLayer) {
      map.removeLayer(currentLayer);
      currentLayer = null;
    }
    allLayers.forEach(layer => map.removeLayer(layer));
    allLayers = [];
  }
  
  // Ana ekrana dön butonu
  document.getElementById('homeButton').addEventListener('click', () => {
    map.setView([40.0, 27.0], 8);
  });
  
  // Altlık harita geçişi
  document.getElementById('basemapToggle').addEventListener('click', () => {
    if (currentBase === "street") {
      map.removeLayer(street);
      map.addLayer(satellite);
      currentBase = "satellite";
    } else {
      map.removeLayer(satellite);
      map.addLayer(street);
      currentBase = "street";
    }
  });
  
  // Ölçüm fonksiyonları
  let measureMode = false;
  let measurePoints = [];
  let measureLayer;
  let measureInfoBox;
  
  // Ölçüm butonu
  document.getElementById('measureButton').addEventListener('click', () => {
    if (!measureMode) {
      startMeasuring();
    } else {
      stopMeasuring();
    }
  });
  
  // Ölçüm modunu başlat
  function startMeasuring() {
    measureMode = true;
    measurePoints = [];
    
    // Ölçüm katmanını oluştur
    measureLayer = L.layerGroup().addTo(map);
    
    // Info kutusu oluştur veya göster
    if (!measureInfoBox) {
      measureInfoBox = L.DomUtil.create('div', 'measure-info');
      document.body.appendChild(measureInfoBox);
    }
    measureInfoBox.style.display = 'block';
    measureInfoBox.innerHTML = '📏 Haritaya tıklayarak ölçüm yapın. Bitirmek için ölçüm butonuna basın.';
    
    // Harita elemanına sınıf ekle
    L.DomUtil.addClass(map.getContainer(), 'leaflet-measuring');
    
    // Ölçüm butonuna aktif sınıfı ekle
    document.getElementById('measureButton').style.backgroundColor = '#e0e0e0';
    
    // Harita tıklama olayı
    map.on('click', onMapClick);
  }
  
  // Ölçüm modunu durdur
  function stopMeasuring() {
    measureMode = false;
    
    // Harita elemanından sınıfı kaldır
    L.DomUtil.removeClass(map.getContainer(), 'leaflet-measuring');
    
    // Ölçüm butonunu normal hale getir
    document.getElementById('measureButton').style.backgroundColor = 'white';
    
    // Harita tıklama olayını kaldır
    map.off('click', onMapClick);
    
    // Ölçüm katmanını temizle
    if (measureLayer) {
      map.removeLayer(measureLayer);
    }
    
    // Info kutusunu gizle
    if (measureInfoBox) {
      measureInfoBox.style.display = 'none';
    }
  }
  
  // Harita tıklama olayı
  function onMapClick(e) {
    const point = e.latlng;
    measurePoints.push(point);
    
    // Nokta ekle
    L.circleMarker(point, {
      color: '#ff4400',
      fillColor: '#ff4400',
      fillOpacity: 1,
      radius: 5
    }).addTo(measureLayer);
    
    // Eğer birden fazla nokta varsa, çizgiyi güncelle
    if (measurePoints.length > 1) {
      updateMeasureLine();
    }
  }
  
  // Ölçüm çizgisini güncelle
  function updateMeasureLine() {
    // Varsa önceki çizgiyi temizle
    measureLayer.eachLayer(layer => {
      if (layer instanceof L.Polyline && !(layer instanceof L.CircleMarker)) {
        measureLayer.removeLayer(layer);
      }
    });
    
    // Yeni çizgi oluştur
    L.polyline(measurePoints, {
      color: '#ff4400',
      weight: 3,
      opacity: 0.7,
      dashArray: '5, 10'
    }).addTo(measureLayer);
    
    // Toplam mesafeyi hesapla ve göster
    let totalDistance = 0;
    for (let i = 1; i < measurePoints.length; i++) {
      totalDistance += measurePoints[i-1].distanceTo(measurePoints[i]);
    }
    
    // Mesafeyi düzgün formatta göster
    let distanceText;
    if (totalDistance < 1000) {
      distanceText = `${Math.round(totalDistance)} metre`;
    } else {
      distanceText = `${(totalDistance / 1000).toFixed(2)} kilometre`;
    }
    
    measureInfoBox.innerHTML = `📏 Toplam Mesafe: <strong>${distanceText}</strong>`;
  }