// ბუნება: ლანდშაფტები, საშიში პროცესები, მიწისქვეშა წყლები, მიწისძვრები, მეტეო- და ჰიდროსადგურები, ბუნების პანელი
// Part of the atlas script, split from the former js/main.js. Files are loaded in
// order by index.html; theme files only define things, their start-up code is
// in initNatureLandscapeHazards(), called from app.js once every file is loaded.


// ===== Landscape Layers =====
var landscapeLayer = null;

var landscapeAntropLayer = null;

var landscapeData = null;

var landscapeAntropData = null;

var LANDSCAPE_ORDER = [
  "ქვედა მთები (რცხილა, მხე)",
  "საშ. მთები (წიფლნარები)",
  "სუბალპური ტყე-ბუჩქნარები",
  "ალპური მდელოები",
  "მთისწინეთი (არიდული)",
  "ვაკეები (ნახევრარუდული)",
  "მდინარეთა ჭალები",
];

var ANTROP_ORDER = [
  "უმნიშვნელოდ შეცვლილი",
  "საშუალოდ შეცვლილი",
  "ძლიერ შეცვლილი",
  "პრაქტიკულად გარდაქმნილი",
];

function buildLandscapeLayer(data, layerRef) {
  clearLayer(layerRef.layer);
  var noBorder = layerRef.noBorder || false;
  layerRef.layer = L.geoJSON(data, {
    style: function (feat) {
      return {
        fillColor: feat.properties.LandColor,
        fillOpacity: 0.72,
        // თხელი კონტური იმავე ფერის მუქ ტონში — ერთნაირი
        // მეზობელი პოლიგონებიც კარგად გამოიყოფა
        color: noBorder ? darken(feat.properties.LandColor) : "#888",
        weight: noBorder ? 0.5 : 0.5,
        opacity: noBorder ? 0.85 : 0.7,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      var _tip = p.LandLabel || "";
      if (_tip)
        areaTooltip(layer, _tip);
      layer.on("click", function () {
        showInfoLandscape(p);
        showBottomChartLandscape(p, data, layerRef.order);
      });
      layer.on("mouseover", function () {
        layer.setStyle({ weight: 2, fillOpacity: 0.9 });
      });
      layer.on("mouseout", function () {
        layerRef.layer.resetStyle(layer);
      });
    },
  }).addTo(map);
  updateLandscapeLegend(data, layerRef.order);
  setInfoBtn("landscape");
}

var landscapeLayerRef = { layer: null, order: LANDSCAPE_ORDER };

var landscapeAntropLayerRef = {
  layer: null,
  order: ANTROP_ORDER,
  noBorder: true,
};

function loadLandscape() {
  setInfoBtn("landscape");
  if (landscapeData) {
    buildLandscapeLayer(landscapeData, landscapeLayerRef);
    loadNatureMuniCenters();
    return;
  }
  fetch(dataUrl("data/landscape.geojson"))
    .then((r) => r.json())
    .then((data) => {
      landscapeData = data;
      buildLandscapeLayer(data, landscapeLayerRef);
      loadNatureMuniCenters();
    });
}

function loadLandscapeAntrop() {
  setInfoBtn("landscape");
  if (landscapeAntropData) {
    buildLandscapeLayer(landscapeAntropData, landscapeAntropLayerRef);
    loadNatureMuniCenters();
    return;
  }
  fetch(dataUrl("data/landscape_antrop.geojson"))
    .then((r) => r.json())
    .then((data) => {
      landscapeAntropData = data;
      buildLandscapeLayer(data, landscapeAntropLayerRef);
      loadNatureMuniCenters();
    });
}

function updateLandscapeLegend(data, order) {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var seen = {};
  data.features.forEach(function (f) {
    var p = f.properties;
    if (!seen[p.LandLabel]) seen[p.LandLabel] = p.LandColor;
  });

  var html = `<div class="section-title">ლანდშაფტის ტიპი</div><div class="ethnics-legend">`;
  order.forEach(function (label) {
    if (!seen[label]) return;
    html += `<div class="eth-legend-item"><span class="eth-dot" style="background:${seen[label]};border:1px solid rgba(0,0,0,0.15);border-radius:3px;"></span><span style="font-size:10px;">${label}</span></div>`;
  });
  html += "</div>";
  el.innerHTML = html;
}

function showInfoLandscape(p) {
  showInfoCard(`
    <div class="info-name" style="font-size:13px;">${p.LandLabel}</div>
    <span class="info-type-badge badge-village" style="background:${p.LandColor}33;color:#333;border:1px solid ${p.LandColor}88;">${p.Area_km2} კმ²</span>
    <div style="margin-top:10px;font-size:10px;color:var(--text-muted);line-height:1.6;">${p.Name_Geo || p.Name_Eng || "–"}</div>`);
}

function showBottomChartLandscape(p, data, order) {
  var ctx = prepareBottomChart();

  // ჯამური ფართობი ლეიბლების მიხედვით
  var areas = {},
    colors = {};
  data.features.forEach(function (f) {
    var k = f.properties.LandLabel;
    areas[k] = (areas[k] || 0) + (f.properties.Area_km2 || 0);
    colors[k] = f.properties.LandColor;
  });

  // order-ის მიხედვით, მაგრამ ფართობის კლებადობით
  var sorted = Object.keys(areas).sort(function (a, b) {
    return areas[b] - areas[a];
  });

  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted.map((k) => k),
      datasets: [
        {
          label: "ფართობი (კმ²)",
          data: sorted.map((function (k) {
            var v = areas[k];
            if (v < 1) return Math.round(v * 100) / 100;
            if (v < 10) return Math.round(v * 10) / 10;
            return Math.round(v);
          })),
          minBarLength: 5,
          backgroundColor: sorted.map((k) => colors[k] + "CC"),
          borderColor: sorted.map((k) => colors[k]),
          borderWidth: 2,
          borderRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      layout: { padding: { top: 18 } },
      layout: { padding: { top: 18 } },
      maintainAspectRatio: false,
      plugins: {
        title: chartTitle(`${p.LandLabel} — ლანდშაფტები ფართობის მიხედვით (კმ²)`, 12),
        tooltip: {
          callbacks: { label: (c) => ` ${c.parsed.y.toLocaleString()} კმ²` },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: {
            font: { size: 10, weight: "500" },
            color: "#6B6862",
            callback: (v) => v.toLocaleString() + " კმ²",
          },
        },
        x: {
          ticks: {
            font: { size: 11, weight: "500" },
            color: "#1A1A18",
            maxRotation: 25,
          },
          grid: { display: false },
        },
      },
    },
  });
  if (p)
    highlightBottomBars(function (l, i) {
      return sorted[i] === p.LandLabel;
    });
}

// ===== Hazard Layers =====
var hazardZoningLayer = null;

var hazardLandslideLayer = null;

var hazardRockfallLayer = null;

var hazardZoningData = null;

var hazardLandslideData = null;

var hazardRockfallData = null;

var HAZARD_ZONING_ORDER = ["მაღალი", "საშუალო", "დაბალი"];

function loadHazard() {
  var loaded = 0;
  function tryRender() {
    if (++loaded === 3) renderHazardLayers();
  }
  if (!hazardZoningData)
    fetch(dataUrl("data/landslide_zoning.geojson"))
      .then((r) => r.json())
      .then((d) => {
        hazardZoningData = d;
        tryRender();
      });
  else tryRender();
  if (!hazardLandslideData)
    fetch(dataUrl("data/landslide.geojson"))
      .then((r) => r.json())
      .then((d) => {
        hazardLandslideData = d;
        tryRender();
      });
  else tryRender();
  if (!hazardRockfallData)
    fetch(dataUrl("data/rockfall.geojson"))
      .then((r) => r.json())
      .then((d) => {
        hazardRockfallData = d;
        tryRender();
      });
  else tryRender();
}

function renderHazardLayers() {
  // ზონირება — polygon ფენა
  clearLayer(hazardZoningLayer);
  hazardZoningLayer = L.geoJSON(hazardZoningData, {
    style: function (feat) {
      return {
        fillColor: feat.properties.ZoneColor,
        fillOpacity: 0.7,
        color: "#999",
        weight: 0.4,
        opacity: 0.5,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      var _tip = p.Name_Geo || "";
      if (_tip)
        areaTooltip(layer, _tip);
      layer.on("click", function () {
        showInfoHazardZone(p);
        showBottomChartHazard();
        highlightBottomBars(p.Name_Geo);
      });
      layer.on("mouseover", function () {
        layer.setStyle({ weight: 1.5, fillOpacity: 0.9 });
      });
      layer.on("mouseout", function () {
        hazardZoningLayer.resetStyle(layer);
      });
    },
  }).addTo(map);

  // მეწყერი — წითელი წერტილები
  clearLayer(hazardLandslideLayer);
  hazardLandslideLayer = L.geoJSON(hazardLandslideData, {
    pointToLayer: function (feature, latlng) {
      var marker = L.circleMarker(latlng, {
        radius: 5,
        fillColor: "#C0392B",
        color: "#7B241C",
        weight: 1.2,
        fillOpacity: 0.85,
      });
      pointTooltip(marker, feature.properties.Name_Geo || "მეწყერი", -6);
      marker.on("click", function () {
        showInfoHazardPoint(feature.properties, "landslide");
        showBottomChartHazard();
      });
      return marker;
    },
  }).addTo(map);

  // კლდეზვავი — ნარინჯი სამკუთხა სიმბოლო
  clearLayer(hazardRockfallLayer);
  hazardRockfallLayer = L.geoJSON(hazardRockfallData, {
    pointToLayer: function (feature, latlng) {
      var svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="14" viewBox="0 0 16 14">
        <polygon points="8,1 15,13 1,13" fill="#E67E22" stroke="#A04000" stroke-width="1.2"/>
      </svg>`;
      var icon = L.divIcon({
        html: svg,
        iconSize: [16, 14],
        iconAnchor: [8, 13],
        className: "",
      });
      var marker = L.marker(latlng, { icon: icon });
      pointTooltip(marker, feature.properties.Name_Geo || "კლდეზვავი", -14);
      marker.on("click", function () {
        showInfoHazardPoint(feature.properties, "rockfall");
        showBottomChartHazard();
      });
      return marker;
    },
  }).addTo(map);

  updateHazardLegend();
  setInfoBtn("hazard");
  loadNatureMuniCenters();
}

function updateHazardLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  // ზონირების ფერები
  var zoneColors = { მაღალი: "#AD9F90", საშუალო: "#CBC3B9", დაბალი: "#E9E3DC" };
  var html = `<div class="section-title">მეწყ./კლდეზვ. ზონები</div>
  <div class="ethnics-legend">`;
  HAZARD_ZONING_ORDER.forEach(function (label) {
    html += `<div class="eth-legend-item"><span class="eth-dot" style="background:${zoneColors[label]};border:1px solid rgba(0,0,0,0.15);border-radius:3px;"></span><span style="font-size:10px;">${label}</span></div>`;
  });
  html += `</div><div class="section-title" style="margin-top:10px;">სახეობა</div>
  <div class="ethnics-legend">
    <div class="eth-legend-item">
      <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#C0392B;border:1.5px solid #7B241C;flex-shrink:0;"></span>
      <span style="font-size:10px;">მეწყერი (${hazardLandslideData ? hazardLandslideData.features.length : ""})</span>
    </div>
    <div class="eth-legend-item">
      <svg width="13" height="12" viewBox="0 0 16 14" style="flex-shrink:0;"><polygon points="8,1 15,13 1,13" fill="#E67E22" stroke="#A04000" stroke-width="1.2"/></svg>
      <span style="font-size:10px;">კლდეზვავი/დაქვათაცვენა (${hazardRockfallData ? hazardRockfallData.features.length : ""})</span>
    </div>
  </div>`;
  el.innerHTML = html;
}

function showInfoHazardZone(p) {
  showInfoCard(`
    <div class="info-name">${p.Name_Geo || "–"}</div>
    <span class="info-type-badge badge-village" style="background:${p.ZoneColor}55;color:#444;border:1px solid ${p.ZoneColor};">${p.Name_Eng || ""}</span>
    <div class="info-row" style="margin-top:8px;"><span class="info-key">ფართობი</span><span class="info-val">${p.Area_km2} კმ²</span></div>`);
}

function showInfoHazardPoint(p, type) {
  var color = type === "landslide" ? "#C0392B" : "#E67E22";
  var label = type === "landslide" ? "მეწყერი" : "კლდეზვავი/დაქვათაცვენა";
  showInfoCard(`
    <div class="info-name">${p.Name_Geo || p.Name_Eng || "–"}</div>
    <span class="info-type-badge" style="background:${color}22;color:${color};border:1px solid ${color}55;">${label}</span>`);
}

function showBottomChartHazard() {
  var ctx = prepareBottomChart();

  // ზონირება — ფართობი
  var areas = {},
    colors = {};
  hazardZoningData.features.forEach(function (f) {
    var k = f.properties.Name_Geo;
    areas[k] = (areas[k] || 0) + (f.properties.Area_km2 || 0);
    colors[k] = f.properties.ZoneColor;
  });
  var sorted = HAZARD_ZONING_ORDER.filter((k) => areas[k]);

  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted,
      datasets: [
        {
          label: "ფართობი (კმ²)",
          data: sorted.map((function (k) {
            var v = areas[k];
            if (v < 1) return Math.round(v * 100) / 100;
            if (v < 10) return Math.round(v * 10) / 10;
            return Math.round(v);
          })),
          minBarLength: 5,
          backgroundColor: sorted.map((k) => colors[k]),
          borderColor: sorted.map((k) =>
            colors[k]
              .replace(/^#/, "")
              .match(/../g)
              .map((h) =>
                Math.max(0, parseInt(h, 16) - 30)
                  .toString(16)
                  .padStart(2, "0"),
              )
              .reduce((a, b) => a + b, "#"),
          ),
          borderWidth: 1.5,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      layout: { padding: { top: 18 } },
      maintainAspectRatio: false,
      plugins: {
        title: chartTitle("მეწყ./კლდეზვ. ზონირება — ფართობი (კმ²)", 12),
        tooltip: {
          callbacks: { label: (c) => ` ${c.parsed.y.toLocaleString()} კმ²` },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: {
            font: { size: 10, weight: "500" },
            color: "#6B6862",
            callback: (v) => v.toLocaleString() + " კმ²",
          },
        },
        x: {
          ticks: { font: { size: 11, weight: "500" }, color: "#1A1A18" },
          grid: { display: false },
        },
      },
    },
  });
}

// ===== GroundWater Layer =====
var groundwaterZoningLayer = null;

var groundwaterPointLayer = null;

var groundwaterZoningData = null;

var groundwaterPointData = null;

var HYDROGEO_ORDER = ["III9", "III12", "IV2", "IV3", "V1", "V2"];

var HYDROGEO_COLORS = {
  III9: "#B8D4E8",
  III12: "#7BB8D4",
  IV2: "#C8E6C9",
  IV3: "#A5D6A7",
  V1: "#FFE0B2",
  V2: "#FFCC80",
};

function loadGroundwater() {
  var loaded = 0;
  function tryRender() {
    if (++loaded === 2) renderGroundwaterLayers();
  }
  if (!groundwaterZoningData)
    fetch(dataUrl("data/hydrogeology_zoning.geojson"))
      .then((r) => r.json())
      .then((d) => {
        groundwaterZoningData = d;
        tryRender();
      });
  else tryRender();
  if (!groundwaterPointData)
    fetch(dataUrl("data/groundwater.geojson"))
      .then((r) => r.json())
      .then((d) => {
        groundwaterPointData = d;
        tryRender();
      });
  else tryRender();
}

function renderGroundwaterLayers() {
  // ზონირება — polygon
  clearLayer(groundwaterZoningLayer);
  groundwaterZoningLayer = L.geoJSON(groundwaterZoningData, {
    style: function (feat) {
      return {
        fillColor: feat.properties.ZoneColor,
        fillOpacity: 0.65,
        color: "#5599AA",
        weight: 1,
        opacity: 0.7,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      var _tip = p.ShortLabel || "";
      if (_tip)
        areaTooltip(layer, _tip);
      layer.on("click", function () {
        showInfoGWZone(p);
        showBottomChartGW();
        highlightBottomBars(p.ShortLabel);
      });
      layer.on("mouseover", function () {
        layer.setStyle({ weight: 2, fillOpacity: 0.85 });
      });
      layer.on("mouseout", function () {
        groundwaterZoningLayer.resetStyle(layer);
      });
    },
  }).addTo(map);

  // წყალპუნქტები — SVG სიმბოლოები
  clearLayer(groundwaterPointLayer);
  groundwaterPointLayer = L.geoJSON(groundwaterPointData, {
    pointToLayer: function (feature, latlng) {
      var p = feature.properties;
      var isBorehole = p.Type_Geo === "ჭაბურღილი";

      // ჭაბურღილი — წრე + გვერდის ხაზები + კვადრატი გარშემო
      var boreholdSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15.86 12.39" width="28" height="22">
        <line x1="3.68" y1="6.15" x2="0.19" y2="6.15" stroke="#010101" stroke-width="0.7" fill="none"/>
        <line x1="15.67" y1="6.15" x2="12.18" y2="6.15" stroke="#010101" stroke-width="0.7" fill="none"/>
        <path d="M12.18,6.15c0,2.35-1.9,4.25-4.25,4.25S3.68,8.5,3.68,6.15c0-2.35,1.9-4.25,4.25-4.25S12.18,3.81,12.18,6.15" fill="#F15D42"/>
        <path d="M3.68,6.15c0-2.35,1.9-4.25,4.25-4.25s4.25,1.9,4.25,4.25" fill="#16A94A"/>
        <path d="M12.18,6.15c0,2.35-1.9,4.25-4.25,4.25S3.68,8.5,3.68,6.15c0-2.35,1.9-4.25,4.25-4.25S12.18,3.81,12.18,6.15z" fill="none" stroke="#0578B7" stroke-width="0.7"/>
        <rect x="3.47" y="1.74" width="8.92" height="8.92" fill="none" stroke="#010101" stroke-width="0.5"/>
      </svg>`;

      // წყარო — წრე + გვერდის ხაზი
      var springSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 13.58 9.72" width="24" height="18">
        <line x1="12.79" y1="4.86" x2="9.3" y2="4.86" stroke="#010101" stroke-width="0.7" fill="none"/>
        <path d="M9.3,4.86c0,2.35-1.9,4.25-4.25,4.25s-4.25-1.9-4.25-4.25c0-2.35,1.9-4.25,4.25-4.25S9.3,2.51,9.3,4.86" fill="#F15D42"/>
        <path d="M0.79,4.86c0-2.35,1.9-4.25,4.25-4.25S9.3,2.51,9.3,4.86" fill="#16A94A"/>
        <path d="M9.3,4.86c0,2.35-1.9,4.25-4.25,4.25s-4.25-1.9-4.25-4.25c0-2.35,1.9-4.25,4.25-4.25S9.3,2.51,9.3,4.86z" fill="none" stroke="#0578B7" stroke-width="0.7"/>
      </svg>`;

      var svgHtml = isBorehole ? boreholdSVG : springSVG;
      var iconW = isBorehole ? 28 : 24;
      var iconH = isBorehole ? 22 : 18;
      var anchorX = isBorehole ? 14 : 6; // ჭაბ: ცენტრი; წყარო: მარცხენა ხაზის ბოლო
      var anchorY = isBorehole ? 11 : 9;

      var icon = L.divIcon({
        html: svgHtml,
        iconSize: [iconW, iconH],
        iconAnchor: [anchorX, anchorY],
        className: "",
      });
      var marker = L.marker(latlng, { icon: icon });
      pointTooltip(marker, `${p.Number} ${p.Name_Geo}`, -iconH);
      marker.on("click", function () {
        showInfoGWPoint(p);
        showBottomChartGWPoint(p);
      });
      return marker;
    },
  }).addTo(map);

  updateGWLegend();
  setInfoBtn("groundwater");
  loadNatureMuniCenters();
}

function updateGWLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html = `<div class="section-title">ჰიდროგეოლ. დარაიონება</div><div class="ethnics-legend">`;
  var seen = {};
  groundwaterZoningData.features.forEach(function (f) {
    var p = f.properties;
    if (!seen[p.Code]) {
      seen[p.Code] = 1;
      html += `<div class="eth-legend-item"><span class="eth-dot" style="background:${p.ZoneColor};border:1px solid #5599AA88;border-radius:3px;"></span><span style="font-size:9px;">${p.ShortLabel}</span></div>`;
    }
  });
  html += `</div><div class="section-title" style="margin-top:10px;">წყალპუნქტები</div>
  <div class="ethnics-legend">
    <div class="eth-legend-item">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15.86 12.39" width="22" height="17" style="flex-shrink:0;">
        <line x1="3.68" y1="6.15" x2="0.19" y2="6.15" stroke="#010101" stroke-width="0.7" fill="none"/>
        <line x1="15.67" y1="6.15" x2="12.18" y2="6.15" stroke="#010101" stroke-width="0.7" fill="none"/>
        <path d="M12.18,6.15c0,2.35-1.9,4.25-4.25,4.25S3.68,8.5,3.68,6.15c0-2.35,1.9-4.25,4.25-4.25S12.18,3.81,12.18,6.15" fill="#F15D42"/>
        <path d="M3.68,6.15c0-2.35,1.9-4.25,4.25-4.25s4.25,1.9,4.25,4.25" fill="#16A94A"/>
        <path d="M12.18,6.15c0,2.35-1.9,4.25-4.25,4.25S3.68,8.5,3.68,6.15c0-2.35,1.9-4.25,4.25-4.25S12.18,3.81,12.18,6.15z" fill="none" stroke="#0578B7" stroke-width="0.7"/>
        <rect x="3.47" y="1.74" width="8.92" height="8.92" fill="none" stroke="#010101" stroke-width="0.5"/>
      </svg>
      <span style="font-size:10px;">ჭაბურღილი</span>
    </div>
    <div class="eth-legend-item">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 13.58 9.72" width="20" height="15" style="flex-shrink:0;">
        <line x1="12.79" y1="4.86" x2="9.3" y2="4.86" stroke="#010101" stroke-width="0.7" fill="none"/>
        <path d="M9.3,4.86c0,2.35-1.9,4.25-4.25,4.25s-4.25-1.9-4.25-4.25c0-2.35,1.9-4.25,4.25-4.25S9.3,2.51,9.3,4.86" fill="#F15D42"/>
        <path d="M0.79,4.86c0-2.35,1.9-4.25,4.25-4.25S9.3,2.51,9.3,4.86" fill="#16A94A"/>
        <path d="M9.3,4.86c0,2.35-1.9,4.25-4.25,4.25s-4.25-1.9-4.25-4.25c0-2.35,1.9-4.25,4.25-4.25S9.3,2.51,9.3,4.86z" fill="none" stroke="#0578B7" stroke-width="0.7"/>
      </svg>
      <span style="font-size:10px;">წყარო</span>
    </div>
  </div>`;
  el.innerHTML = html;
}

function showInfoGWZone(p) {
  showInfoCard(`
    <div class="info-name" style="font-size:12px;">${p.ShortLabel}</div>
    <span class="info-type-badge badge-village" style="background:${p.ZoneColor};color:#333;border:1px solid #5599AA55;">${p.Code}</span>
    <div class="info-row" style="margin-top:8px;"><span class="info-key">ფართობი</span><span class="info-val">${p.Area_km2} კმ²</span></div>
    <div class="section-note">${p.Name_Geo}</div>`);
}

function showInfoGWPoint(p) {
  var isBH = p.Type_Geo === "ჭაბურღილი";
  var color = isBH ? "#1565C0" : "#0288D1";
  showInfoCard(`
    <div class="info-name">${p.Number} ${p.Name_Geo}</div>
    <span class="info-type-badge" style="background:${color}22;color:${color};border:1px solid ${color}55;">${p.Type_Geo}</span>
    <div class="info-row"><span class="info-key">მუნიც.</span><span class="info-val">${p.Munic_Geo || "–"}</span></div>
    <div class="info-row"><span class="info-key">ტემპ.</span><span class="info-val">${p.Temp_Geo || "–"}</span></div>
    <hr style="margin:8px 0;border-top:1px solid #f0ede8;">
    <div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;">მინერალიზაცია და ქიმ. შემადგ. (%)</div>
    <div class="info-row"><span class="info-key">M (გ/ლ)</span><span class="info-val pop-num">${p.Mineral_M || "–"}</span></div>
    <div class="info-row"><span class="info-key">HCO₃</span><span class="info-val">${p.HCO3 || 0}%</span></div>
    <div class="info-row"><span class="info-key">SO₄</span><span class="info-val">${p.SO4 || 0}%</span></div>
    <div class="info-row"><span class="info-key">Ca</span><span class="info-val">${p.Ca || 0}%</span></div>
    <div class="info-row"><span class="info-key">Mg</span><span class="info-val">${p.Mg || 0}%</span></div>
    <div class="info-row"><span class="info-key">Na+K</span><span class="info-val">${p.Na_K || 0}%</span></div>`);
}

function showBottomChartGW() {
  var ctx = prepareBottomChart();

  var areas = {},
    colors = {},
    labels = {};
  groundwaterZoningData.features.forEach(function (f) {
    var p = f.properties;
    areas[p.Code] = (areas[p.Code] || 0) + p.Area_km2;
    colors[p.Code] = p.ZoneColor;
    labels[p.Code] = p.ShortLabel;
  });
  var sorted = HYDROGEO_ORDER.filter((k) => areas[k]).sort(function (a, b) {
    return areas[b] - areas[a];
  });

  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted.map((k) => labels[k]),
      datasets: [
        {
          label: "ფართობი (კმ²)",
          data: sorted.map((function (k) {
            var v = areas[k];
            if (v < 1) return Math.round(v * 100) / 100;
            if (v < 10) return Math.round(v * 10) / 10;
            return Math.round(v);
          })),
          minBarLength: 5,
          backgroundColor: sorted.map((k) => colors[k]),
          borderColor: sorted.map((k) => "#5599AA"),
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      layout: { padding: { top: 18 } },
      maintainAspectRatio: false,
      plugins: {
        title: chartTitle("ჰიდროგეოლ. ზონირება — ფართობი (კმ²)", 12),
        tooltip: {
          callbacks: { label: (c) => ` ${c.parsed.y.toLocaleString()} კმ²` },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: {
            font: { size: 10, weight: "500" },
            color: "#6B6862",
            callback: (v) => v.toLocaleString() + " კმ²",
          },
        },
        x: {
          ticks: {
            font: { size: 11, weight: "500" },
            color: "#1A1A18",
            maxRotation: 25,
          },
          grid: { display: false },
        },
      },
    },
  });
}

function showBottomChartGWPoint(p) {
  var ctx = prepareBottomChart();

  var ions = ["HCO3", "SO4", "Cl", "Ca", "Mg", "Na_K"];
  var labels = ["HCO₃", "SO₄", "Cl", "Ca", "Mg", "Na+K"];
  var ionColors = [
    "#1E88E5",
    "#FDD835",
    "#EF5350",
    "#43A047",
    "#8E24AA",
    "#FB8C00",
  ];
  var vals = ions.map((k) => p[k] || 0);

  bottomChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [
        {
          data: vals,
          backgroundColor: ionColors.map((c) => c + "BB"),
          borderColor: ionColors,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true,
          position: "right",
          labels: {
            font: { size: 10 },
            color: "#1A1A18",
            padding: 8,
          },
        },
        title: chartTitle(`${p.Number} ${p.Name_Geo} — ქიმიური შემადგენლობა (%) | M=${p.Mineral_M} გ/ლ`),
        tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.parsed}%` } },
      },
    },
  });
}

// ===== Earthquake Layer =====
var eqNewLayer = null;

var eqOldLayer = null;

var eqStationLayer = null;

var eqNewData = null;

var eqOldData = null;

var eqStationData = null;

var MAG_CLASSES = [
  { label: "< 3", color: "#FFCCCC", r: 3 },
  { label: "3.1–4", color: "#FF8C8C", r: 5 },
  { label: "4.1–5", color: "#FF4444", r: 7 },
  { label: "5.1–6", color: "#CC0000", r: 9 },
  { label: "> 6", color: "#7B0000", r: 12 },
];

// სეისმური სადგურის SVG სიმბოლოები
var SEISMIC_SVG_ACTIVE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15.86 12.39" width="22" height="17">
  <polygon points="2.77,10.72 7.99,1.67 13.09,10.72" fill="#67BD55"/>
  <polygon points="2.77,10.72 7.99,1.67 13.09,10.72" fill="none" stroke="#010101" stroke-width="0.4"/>
</svg>`;

var SEISMIC_SVG_INACTIVE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15.86 12.39" width="22" height="17">
  <polygon points="2.77,10.72 7.99,1.67 13.09,10.72" fill="#F2EA2A"/>
  <polygon points="2.77,10.72 7.99,1.67 13.09,10.72" fill="none" stroke="#010101" stroke-width="0.4"/>
</svg>`;

function loadEarthquake() {
  var loaded = 0;
  function tryRender() {
    if (++loaded === 3) renderEarthquakeLayers();
  }
  if (!eqNewData)
    fetch(dataUrl("data/earthquakes_new.geojson"))
      .then((r) => r.json())
      .then((d) => {
        eqNewData = d;
        tryRender();
      });
  else tryRender();
  if (!eqOldData)
    fetch(dataUrl("data/earthquakes_old.geojson"))
      .then((r) => r.json())
      .then((d) => {
        eqOldData = d;
        tryRender();
      });
  else tryRender();
  if (!eqStationData)
    fetch(dataUrl("data/seismic_stations.geojson"))
      .then((r) => r.json())
      .then((d) => {
        eqStationData = d;
        tryRender();
      });
  else tryRender();
}

function renderEarthquakeLayers() {
  clearLayer(eqNewLayer);
  clearLayer(eqOldLayer);
  clearLayer(eqStationLayer);

  // ინსტრუმენტული — წრეები
  eqNewLayer = L.geoJSON(eqNewData, {
    pointToLayer: function (feature, latlng) {
      var p = feature.properties;
      var marker = L.circleMarker(latlng, {
        radius: p.Radius,
        fillColor: p.Color,
        color: darken(p.Color),
        weight: 0.6,
        fillOpacity: 0.7,
      });
      pointTooltip(marker, `მაგნიტუდა ${p.Mw} | ${p.Year}`);
      marker.on("click", function () {
        showInfoEQ(p, "instrumental");
        showBottomChartEQ();
        highlightBottomBars(p.MagClass);
      });
      return marker;
    },
  }).addTo(map);

  // ისტორიული — კვადრატი
  eqOldLayer = L.geoJSON(eqOldData, {
    pointToLayer: function (feature, latlng) {
      var p = feature.properties;
      var size = p.Radius * 3;
      var svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <rect x="1" y="1" width="${size - 2}" height="${size - 2}" fill="${p.Color}" stroke="${darken(p.Color)}" stroke-width="1"/>
      </svg>`;
      var icon = L.divIcon({
        html: svg,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        className: "",
      });
      var marker = L.marker(latlng, { icon: icon });
      pointTooltip(marker, `მაგნიტუდა ${p.Mw} | ${p.Year} (ისტ.)`, -size / 2);
      marker.on("click", function () {
        showInfoEQ(p, "historical");
        showBottomChartEQ();
      });
      return marker;
    },
  }).addTo(map);

  // სეისმური სადგურები
  eqStationLayer = L.geoJSON(eqStationData, {
    pointToLayer: function (feature, latlng) {
      var p = feature.properties;
      var svgHtml = p.Active ? SEISMIC_SVG_ACTIVE : SEISMIC_SVG_INACTIVE;
      var icon = L.divIcon({
        html: svgHtml,
        iconSize: [22, 17],
        iconAnchor: [11, 17],
        className: "",
      });
      var marker = L.marker(latlng, { icon: icon, zIndexOffset: 1000 });
      pointTooltip(marker, "სეისმური სადგური — " + p.Name_Geo, -18);
      marker.on("click", function () {
        showInfoSeismicStation(p, latlng);
        showBottomChartStations("seismic");
        highlightBottomBars(p.Active ? "მოქმედი" : "შეჩერებული");
      });
      return marker;
    },
  }).addTo(map);

  updateEQLegend();
  loadNatureMuniCenters();
  setInfoBtn("earthquakes");
}

function darken(hex) {
  var r = parseInt(hex.slice(1, 3), 16),
    g = parseInt(hex.slice(3, 5), 16),
    b = parseInt(hex.slice(5, 7), 16);
  return (
    "#" +
    [Math.max(0, r - 40), Math.max(0, g - 40), Math.max(0, b - 40)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

function updateEQLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html = `<div class="section-title">მაგნიტუდა</div>
  <div class="ethnics-legend">`;
  MAG_CLASSES.forEach(function (mc) {
    html += `<div class="eth-legend-item">
      <span style="display:inline-block;width:${mc.r * 2}px;height:${mc.r * 2}px;border-radius:50%;background:${mc.color};border:1px solid ${darken(mc.color)};flex-shrink:0;"></span>
      <span style="font-size:10px;">${mc.label}</span>
    </div>`;
  });
  html += `</div>
  <div style="margin-top:8px;font-size:10px;color:var(--text-muted);">
    ⬤ ინსტრუმენტული (1900+)<br>◼ ისტორიული (1900-მდე)
  </div>
  <div class="section-title" style="margin-top:10px;">სეისმ. სადგურები</div>
  <div class="ethnics-legend">
    <div class="eth-legend-item">
      ${SEISMIC_SVG_ACTIVE}<span style="font-size:10px;">მოქმედი</span>
    </div>
    <div class="eth-legend-item">
      ${SEISMIC_SVG_INACTIVE}<span style="font-size:10px;">შეჩერებული</span>
    </div>
  </div>`;
  el.innerHTML = html;
}

function showInfoEQ(p, period) {
  var periodLabel =
    period === "instrumental"
      ? "ინსტრუმენტული (1900+)"
      : "ისტორიული (1900-მდე)";
  showInfoCard(`
    <div class="info-name">მაგნიტუდა ${p.Mw}</div>
    <span class="info-type-badge badge-city" style="background:${p.Color}33;color:${darken(p.Color)};border:1px solid ${p.Color}88;">${p.MagClass}</span>
    <div class="info-row"><span class="info-key">წელი</span><span class="info-val">${p.Year}</span></div>
    <div class="info-row"><span class="info-key">პერიოდი</span><span class="info-val" style="font-size:10px;">${periodLabel}</span></div>`);
}

function showBottomChartEQ() {
  var ctx = prepareBottomChart();

  // მაგნიტუდის განაწილება
  var counts = {};
  MAG_CLASSES.forEach(function (mc) {
    counts[mc.label] = 0;
  });
  eqNewData.features.forEach(function (f) {
    counts[f.properties.MagClass] = (counts[f.properties.MagClass] || 0) + 1;
  });

  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: MAG_CLASSES.map((mc) => mc.label),
      datasets: [
        {
          label: "მიწისძვრათა რ-ბა",
          data: MAG_CLASSES.map((mc) => counts[mc.label] || 0),
          backgroundColor: MAG_CLASSES.map((mc) => mc.color + "CC"),
          borderColor: MAG_CLASSES.map((mc) => darken(mc.color)),
          borderWidth: 1.5,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      layout: { padding: { top: 18 } },
      maintainAspectRatio: false,
      plugins: {
        title: chartTitle(`მიწისძვრები მაგნიტუდის მიხედვით — სულ ${eqNewData.features.length + eqOldData.features.length}`, 12),
        tooltip: { callbacks: { label: (c) => ` ${c.parsed.y} მიწისძვრა` } },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: { font: { size: 10, weight: "500" }, color: "#6B6862" },
        },
        x: {
          ticks: { font: { size: 11, weight: "500" }, color: "#1A1A18" },
          grid: { display: false },
        },
      },
    },
  });
}

// ===== Meteo & Hydro Stations =====
var meteoLayer = null;

var hydroLayer = null;

var meteoData = null;

var hydroData = null;

function removeAllNatureLayers() {
  madflowZoningLayer = clearLayer(madflowZoningLayer);
  madflowPointLayer = clearLayer(madflowPointLayer);
  madflowErosionLayer = clearLayer(madflowErosionLayer);
  forestLayer = clearLayer(forestLayer);
  vegetationLayer = clearLayer(vegetationLayer);
  _avgTempRef.layer = clearLayer(_avgTempRef.layer);
  _maxTempRef.layer = clearLayer(_maxTempRef.layer);
  _precipRef.layer = clearLayer(_precipRef.layer);
  _hotRef.layer = clearLayer(_hotRef.layer);
  _tropRef.layer = clearLayer(_tropRef.layer);
  _frostRef.layer = clearLayer(_frostRef.layer);
  heatWavesLayer = clearLayer(heatWavesLayer);
  droughtLayer = clearLayer(droughtLayer);
  hailTotalLayer = clearLayer(hailTotalLayer);
  hail100Layer = clearLayer(hail100Layer);
  soilsLayer = clearLayer(soilsLayer);
  soilsBornLayer = clearLayer(soilsBornLayer);
  geologyLayer = clearLayer(geologyLayer);
  foultsLayer = clearLayer(foultsLayer);
  metalOreLayer = clearLayer(metalOreLayer);
  nonmetalOreLayer = clearLayer(nonmetalOreLayer);
  oilGasLayer = clearLayer(oilGasLayer);
  agrovlimatLayer = clearLayer(agrovlimatLayer);
  meteoLayer = clearLayer(meteoLayer);
  hydroLayer = clearLayer(hydroLayer);
  landscapeLayerRef.layer = clearLayer(landscapeLayerRef.layer);
  landscapeAntropLayerRef.layer = clearLayer(landscapeAntropLayerRef.layer);
  hazardZoningLayer = clearLayer(hazardZoningLayer);
  hazardLandslideLayer = clearLayer(hazardLandslideLayer);
  hazardRockfallLayer = clearLayer(hazardRockfallLayer);
  groundwaterZoningLayer = clearLayer(groundwaterZoningLayer);
  groundwaterPointLayer = clearLayer(groundwaterPointLayer);
  eqNewLayer = clearLayer(eqNewLayer);
  eqOldLayer = clearLayer(eqOldLayer);
  eqStationLayer = clearLayer(eqStationLayer);
  removeNatureMuniCenters();
}

// SVG სიმბოლოები
function meteoIcon(active) {
  var fill = active ? "#E8540A" : "#999";
  var stroke = active ? "#8B2A00" : "#666";
  // მზის სიმბოლო — წრე + სხივები
  var svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
    <circle cx="11" cy="11" r="5" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
    <line x1="11" y1="1" x2="11" y2="4.5" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="11" y1="17.5" x2="11" y2="21" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="1" y1="11" x2="4.5" y2="11" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="17.5" y1="11" x2="21" y2="11" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="3.5" y1="3.5" x2="6" y2="6" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="16" y1="16" x2="18.5" y2="18.5" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="18.5" y1="3.5" x2="16" y2="6" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="6" y1="16" x2="3.5" y2="18.5" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    className: "",
  });
}

function hydroIcon(active) {
  var fill = active ? "#1565C0" : "#999";
  var stroke = active ? "#0D47A1" : "#666";
  // წვეთის სიმბოლო
  var svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="24" viewBox="0 0 20 24">
    <path d="M10 2 C10 2, 2 12, 2 16 C2 20.4 5.6 23 10 23 C14.4 23 18 20.4 18 16 C18 12 10 2 10 2 Z"
      fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    iconSize: [20, 24],
    iconAnchor: [10, 23],
    className: "",
  });
}

function buildMeteoLayer(data) {
  clearLayer(meteoLayer);
  meteoLayer = L.geoJSON(data, {
    pointToLayer: function (feature, latlng) {
      var p = feature.properties;
      var marker = L.marker(latlng, { icon: meteoIcon(p.Active) });
      marker.on("click", function () {
        showInfoMeteo(p);
        showBottomChartStations("meteo");
        highlightBottomBars(p.Active ? "მოქმედი" : "დახურული");
      });
      pointTooltip(marker, p.Name_Geo || "", -8);
      return marker;
    },
  }).addTo(map);
  updateStationLegend("meteo", data);
}

function buildHydroLayer(data) {
  clearLayer(hydroLayer);
  hydroLayer = L.geoJSON(data, {
    pointToLayer: function (feature, latlng) {
      var p = feature.properties;
      var marker = L.marker(latlng, { icon: hydroIcon(p.Active) });
      marker.on("click", function () {
        showInfoHydro(p);
        showBottomChartStations("hydro");
        highlightBottomBars(p.Active ? "მოქმედი" : "დახურული");
      });
      pointTooltip(marker, p.Name_Geo || "", -12);
      return marker;
    },
  }).addTo(map);
  updateStationLegend("hydro", data);
}

function loadMeteo() {
  setInfoBtn("meteo");
  if (meteoData) {
    buildMeteoLayer(meteoData);
    loadNatureMuniCenters();
    return;
  }
  fetch(dataUrl("data/meteo_stations.geojson"))
    .then((r) => r.json())
    .then((data) => {
      meteoData = data;
      buildMeteoLayer(data);
      loadNatureMuniCenters();
    });
}

function loadHydro() {
  setInfoBtn("hydro");
  if (hydroData) {
    buildHydroLayer(hydroData);
    loadNatureMuniCenters();
    return;
  }
  fetch(dataUrl("data/hydro_stations.geojson"))
    .then((r) => r.json())
    .then((data) => {
      hydroData = data;
      buildHydroLayer(data);
      loadNatureMuniCenters();
    });
}

function updateStationLegend(type, data) {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var isMeteo = type === "meteo";
  var title = isMeteo ? "მეტეოსადგურები" : "ჰიდრ. სადგურები";
  var actColor = isMeteo ? "#E8540A" : "#1565C0";
  var html = `<div class="section-title">${title}</div>
  <div class="ethnics-legend">
    <div class="eth-legend-item">
      <span class="eth-dot" style="background:${actColor};border:1px solid rgba(0,0,0,0.2);border-radius:50%;"></span>
      <span>მოქმედი</span>
    </div>
    <div class="eth-legend-item">
      <span class="eth-dot" style="background:#999;border:1px solid rgba(0,0,0,0.2);border-radius:50%;"></span>
      <span>დახურული</span>
    </div>
  </div>`;
  // სტატისტიკა
  var active = data.features.filter((f) => f.properties.Active).length;
  var inactive = data.features.length - active;
  html += `<div style="margin-top:10px;background:#f8f7f4;border-radius:8px;padding:8px;">
    <div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;">სტატისტიკა</div>
    <div class="info-row"><span class="info-key">სულ</span><span class="info-val">${data.features.length}</span></div>
    <div class="info-row"><span class="info-key">მოქმედი</span><span class="info-val" style="color:${actColor}">${active}</span></div>
    <div class="info-row"><span class="info-key">დახურული</span><span class="info-val" style="color:#999">${inactive}</span></div>
  </div>`;
  el.innerHTML = html;
}

function showInfoSeismicStation(p, latlng) {
  var badge = p.Active
    ? `<span class="info-type-badge badge-village" style="background:#FDECEA;color:#C62828;border:1px solid #C6282855;">მოქმედი</span>`
    : `<span class="info-type-badge badge-city" style="background:#f3f4f6;color:#999;border:1px solid #ccc;">შეჩერებული</span>`;
  showInfoCard(`
    <div class="info-name">სეისმური სადგური</div>
    ${badge}
    <div class="info-row"><span class="info-key">განედი</span><span class="info-val">${latlng.lat.toFixed(4)}°</span></div>
    <div class="info-row"><span class="info-key">გრძედი</span><span class="info-val">${latlng.lng.toFixed(4)}°</span></div>
  `);
}

function showInfoMeteo(p) {
  var badge = p.Active
    ? `<span class="info-type-badge badge-village" style="background:#FEE8DC;color:#E8540A;border:1px solid #E8540A55;">მოქმედი</span>`
    : `<span class="info-type-badge badge-city" style="background:#f3f4f6;color:#999;border:1px solid #ccc;">დახურული</span>`;
  showInfoCard(`
    <div class="info-name">${p.Name_Geo || p.Name_Eng || "–"}</div>
    ${badge}
    <div class="info-row"><span class="info-key">სადგ. ID</span><span class="info-val">${p.Station_ID || "–"}</span></div>
    <div class="info-row"><span class="info-key">ტიპი</span><span class="info-val">${p.Station_Ty || "–"}</span></div>
    <div class="info-row"><span class="info-key">სიმაღლე</span><span class="info-val">${p.Elevation != null ? p.Elevation + " მ" : "–"}</span></div>
    <div class="info-row"><span class="info-key">მუნიციპალიტეტი</span><span class="info-val">${p.Municipality_Geo || p.District || "–"}</span></div>
    <hr style="margin:8px 0;border-top:1px solid #f0ede8;">
    <div style="font-size:10px;color:var(--text-muted);line-height:1.5;">${p.Type_Geo || "–"}</div>
    <div class="info-row" style="margin-top:6px;"><span class="info-key">დაწყება</span><span class="info-val">${p.Begin_Obs || "–"}</span></div>
    ${p.End_Obs ? `<div class="info-row"><span class="info-key">დასასრული</span><span class="info-val">${p.End_Obs}</span></div>` : ""}
  `);
}

function showInfoHydro(p) {
  var badge = p.Active
    ? `<span class="info-type-badge badge-village" style="background:#E3F0FC;color:#1565C0;border:1px solid #1565C055;">მოქმედი</span>`
    : `<span class="info-type-badge badge-city" style="background:#f3f4f6;color:#999;border:1px solid #ccc;">დახურული</span>`;
  showInfoCard(`
    <div class="info-name">${p.Name_Geo || p.Name_Eng || "–"}</div>
    ${badge}
    <div class="info-row"><span class="info-key">მდინარე</span><span class="info-val">${p.River || "–"}</span></div>
    <div class="info-row"><span class="info-key">მუნიციპალიტეტი</span><span class="info-val">${p.Municipality_Geo || "–"}</span></div>
    <hr style="margin:8px 0;border-top:1px solid #f0ede8;">
    <div class="info-row"><span class="info-key">გახსნა</span><span class="info-val">${p.Year_Open || "–"}</span></div>
    ${p.Year_Close ? `<div class="info-row"><span class="info-key">დახურვა</span><span class="info-val">${p.Year_Close}</span></div>` : ""}
    <div class="info-row"><span class="info-key">პერიოდი</span><span class="info-val" style="font-size:10px;">${p.Year_ || "–"}</span></div>
  `);
}

// type: "meteo" | "hydro" | "seismic"
function showBottomChartStations(type) {
  var data = { meteo: meteoData, hydro: hydroData, seismic: eqStationData }[type];
  var ctx = prepareBottomChart();

  var active = data.features.filter((f) => f.properties.Active);
  var inactive = data.features.filter((f) => !f.properties.Active);
  var actColor = { meteo: "#E8540A", hydro: "#1565C0", seismic: "#C62828" }[type];
  var title = {
    meteo: "მეტეოსადგურები",
    hydro: "ჰიდრ. სადგურები",
    seismic: "სეისმური სადგურები",
  }[type];

  bottomChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["მოქმედი", type === "seismic" ? "შეჩერებული" : "დახურული"],
      datasets: [
        {
          data: [active.length, inactive.length],
          backgroundColor: [actColor + "BB", "#BBBBBB"],
          borderColor: [actColor, "#999"],
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true,
          position: "right",
          labels: {
            font: { size: 12 },
            color: "#1A1A18",
            padding: 12,
          },
        },
        title: chartTitle(`${title} — სულ ${data.features.length}`, 12),
        tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.parsed}` } },
      },
    },
  });
}

// nature sublayer buttons
// ქვე-ფენა → MAP_INFO გასაღები (ღილაკი დამოუკიდებლად ეყრდნობა ამას)
var NATURE_SUB_INFO = {
  agrovlimat: "agrovlimat",
  meteo: "meteo",
  hydro: "hydro",
  landscape: "landscape",
  landscape_antrop: "landscape_antrop",
  hazard: "hazard",
  groundwater: "groundwater",
  earthquake: "earthquakes",
  madflow: "madflow",
  geology: "geology",
  forest: "forest",
  vegetation: "vegetation",
  avg_temp: "avg_temp",
  max_temp: "max_temp",
  precip: "precip",
  hot_days: "hot_days",
  trop_nights: "trop_nights",
  frost_days: "frost_days",
  heat_waves: "heat_waves",
  drought: "drought",
  hail_total: "hail",
  soils: "soils",
  soils_born: "soils_born",
};

// ===== Start-up (called from app.js) =====
function initNatureLandscapeHazards() {
  // Nature checkbox
  document.getElementById("chkNature").addEventListener("change", function (e) {
    if (e.target.checked) {
      document.getElementById("chkHistory").checked = false;
      document.getElementById("chkEconomy").checked = false;
      document.getElementById("chkEducation").checked = false;
      document.getElementById("chkTourism").checked = false;
      document.getElementById("historyView").style.display = "none";
      document.getElementById("economyView").style.display = "none";
      document.getElementById("educationView").style.display = "none";
      document.getElementById("tourismView").style.display = "none";
      removeAllHistoryLayers();
      removeAllEconomyLayers();
      removeAllEducationLayers();
      removeAllTourismLayers();
      document.getElementById("mainLayerView").style.display = "none";
      document.getElementById("sublayerView").style.display = "none";
      document.getElementById("natureView").style.display = "";
      showChartPanel();
      resetChartPanel();
      hideSettlementLegend();
      setInfoBtn(null);
      removeNeutralLayers();
      // პირველი ქვე-ფენა ავტომატურად
      removeAllNatureLayers();
      document
        .querySelectorAll("[data-naturesub]")
        .forEach((b) => b.classList.remove("active"));
      document
        .querySelector("[data-naturesub='geology']")
        .classList.add("active");
      loadGeology();
      setInfoBtn(NATURE_SUB_INFO.geology);
      document.getElementById("filterSection").style.display = "none";
      document.getElementById("infoCard").classList.add("hidden");
    } else {
      document.getElementById("natureView").style.display = "none";
      document.getElementById("mainLayerView").style.display = "";
      removeAllNatureLayers();
      resetPopLegend();
      loadNeutralLayers();
    }
  });


  document.getElementById("btnNatureBack").addEventListener("click", function () {
    document.getElementById("chkNature").checked = false;
    document.getElementById("natureView").style.display = "none";
    document.getElementById("mainLayerView").style.display = "";
    removeAllNatureLayers();
    hideChartPanel();
    document.getElementById("infoCard").classList.add("hidden");
    resetPopLegend();
    loadNeutralLayers();
  });


  document.querySelectorAll("[data-naturesub]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (this.classList.contains("active")) return; // იგივეზე ხელახლა დაწკაპება
      document
        .querySelectorAll("[data-naturesub]")
        .forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      var sub = this.dataset.naturesub;
      // წინა ფენები გამოვრთოთ
      removeAllNatureLayers();
      document.getElementById("infoCard").classList.add("hidden");
      resetChartPanel();
      resetPopLegend();
      if (sub === "agrovlimat") loadAgrovlimat();
      else if (sub === "meteo") loadMeteo();
      else if (sub === "hydro") loadHydro();
      else if (sub === "landscape") loadLandscape();
      else if (sub === "landscape_antrop") loadLandscapeAntrop();
      else if (sub === "hazard") loadHazard();
      else if (sub === "groundwater") loadGroundwater();
      else if (sub === "earthquake") loadEarthquake();
      else if (sub === "madflow") loadMadflow();
      else if (sub === "geology") loadGeology();
      else if (sub === "forest") loadForest();
      else if (sub === "vegetation") loadVegetation();
      else if (sub === "avg_temp") loadAvgTemp();
      else if (sub === "max_temp") loadMaxTemp();
      else if (sub === "precip") loadPrecip();
      else if (sub === "hot_days") loadHotDays();
      else if (sub === "trop_nights") loadTropNights();
      else if (sub === "frost_days") loadFrostDays();
      else if (sub === "heat_waves") loadHeatWaves();
      else if (sub === "drought") loadDrought();
      else if (sub === "hail_total") loadHailTotal();
      else if (sub === "soils") loadSoils();
      else if (sub === "soils_born") loadSoilsBorn();
      // ღილაკი ბოლოს ვდგამთ — ჩატვირთვის შტოზე დამოკიდებული აღარაა
      setInfoBtn(NATURE_SUB_INFO[sub] || null);
    });
  });
}
