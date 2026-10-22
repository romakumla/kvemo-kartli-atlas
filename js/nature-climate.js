// ბუნება: ტემპერატურა, ნალექები, ცხელი დღეები, ტროპიკული ღამეები, ყინვიანი დღეები, სითბური ტალღები, გვალვა, ღვარცოფები
// Part of the atlas script, split from the former js/main.js. Files are loaded in
// order by index.html; theme files only define things, their start-up code is
// in initNatureClimate(), called from app.js once every file is loaded.


// ============================================================
// ჰაერის ტემპერატურა და ნალექები
// ============================================================
var avgTempLayer = null;

var maxTempLayer = null;

var precipLayer = null;

var avgTempData = null;

var maxTempData = null;

var precipData = null;

var AVG_TEMP_CLASSES = [
  { label: "1–2°C", color: "#5887BD" },
  { label: "2–4°C", color: "#A4CCE2" },
  { label: "4–6°C", color: "#CCE6F0" },
  { label: "6–8°C", color: "#FDD384" },
  { label: "8–10°C", color: "#FA9D59" },
  { label: "10–12°C", color: "#F67D4A" },
  { label: "12–14°C", color: "#DE3F2E" },
  { label: "14–15°C", color: "#B10B26" },
];

var MAX_TEMP_CLASSES = [
  { label: "6–8°C", color: "#FFD3A7" },
  { label: "8–10°C", color: "#FFB66C" },
  { label: "10–12°C", color: "#FB8D3A" },
  { label: "12–14°C", color: "#EB4225" },
  { label: "14–16°C", color: "#D41817" },
  { label: "16–18°C", color: "#B6000C" },
  { label: "18–20°C", color: "#8E0003" },
];

var PRECIP_CLASSES = [
  { label: "< 500 მმ", color: "#B5DCFA" },
  { label: "500–550 მმ", color: "#7ABFF7" },
  { label: "550–600 მმ", color: "#53ADF5" },
  { label: "600–650 მმ", color: "#3096ED" },
  { label: "650–700 მმ", color: "#1976D2" },
  { label: "> 700 მმ", color: "#1156B0" },
];

function _buildTempLayer(data, refObj, onClickFn) {
  if (refObj.layer) map.removeLayer(refObj.layer);
  var layer = L.geoJSON(data, {
    style: function (feat) {
      var c = feat.properties.Color;
      return {
        fillColor: c,
        fillOpacity: 0.78,
        // კონტური იმავე ფერის მუქ ტონში — ზონები მკაფიოდ გამოიყოფა
        color: darken(c),
        weight: 0.6,
        opacity: 0.8,
      };
    },
    onEachFeature: function (feature, lyr) {
      var p = feature.properties;
      var _zoneName = p.Label || p.Name_Geo || "";
      if (_zoneName)
        areaTooltip(lyr, _zoneName);
      lyr.on("mouseover", function () {
        lyr.setStyle({ weight: 1.4, fillOpacity: 0.95 });
      });
      lyr.on("mouseout", function () {
        lyr.setStyle({
          fillColor: p.Color,
          fillOpacity: 0.78,
          color: darken(p.Color),
          weight: 0.6,
          opacity: 0.8,
        });
      });
      lyr.on("click", function () {
        onClickFn(p, data);
      });
    },
  }).addTo(map);
  refObj.layer = layer;
}

var _avgTempRef = { layer: null };

var _maxTempRef = { layer: null };

var _precipRef = { layer: null };

function loadAvgTemp() {
  if (avgTempData) {
    _buildTempLayer(avgTempData, _avgTempRef, _showInfoAvgTemp);
    updateTempLegend("avg");
    setInfoBtn("avg_temp");
    loadNatureMuniCenters();
    return;
  }
  fetch(dataUrl("data/avg_temp.geojson"))
    .then((r) => r.json())
    .then(function (d) {
      avgTempData = d;
      _buildTempLayer(d, _avgTempRef, _showInfoAvgTemp);
      updateTempLegend("avg");
      setInfoBtn("avg_temp");
      loadNatureMuniCenters();
    });
}

function loadMaxTemp() {
  if (maxTempData) {
    _buildTempLayer(maxTempData, _maxTempRef, _showInfoMaxTemp);
    updateTempLegend("max");
    setInfoBtn("max_temp");
    loadNatureMuniCenters();
    return;
  }
  fetch(dataUrl("data/max_temp.geojson"))
    .then((r) => r.json())
    .then(function (d) {
      maxTempData = d;
      _buildTempLayer(d, _maxTempRef, _showInfoMaxTemp);
      updateTempLegend("max");
      setInfoBtn("max_temp");
      loadNatureMuniCenters();
    });
}

function loadPrecip() {
  if (precipData) {
    _buildTempLayer(precipData, _precipRef, _showInfoPrecip);
    updateTempLegend("precip");
    setInfoBtn("precip");
    loadNatureMuniCenters();
    return;
  }
  fetch(dataUrl("data/precipitation.geojson"))
    .then((r) => r.json())
    .then(function (d) {
      precipData = d;
      _buildTempLayer(d, _precipRef, _showInfoPrecip);
      updateTempLegend("precip");
      setInfoBtn("precip");
      loadNatureMuniCenters();
    });
}

function _showInfoAvgTemp(p, data) {
  showInfoCard('<div class="info-name" style="font-size:13px;">საშ. ტემპერატურა</div>' +
    '<span class="info-type-badge badge-village" style="background:' +
    p.Color +
    "55;color:#333;border:1px solid " +
    p.Color +
    ';">' +
    p.Label +
    " °C</span>" +
    '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);">მრავალწლიური საშუალო  |  1990–2022</div>');
  showBottomChartTemp(data, "avg", p);
}

function _showInfoMaxTemp(p, data) {
  showInfoCard('<div class="info-name" style="font-size:13px;">მაქს. ტემპერატურა</div>' +
    '<span class="info-type-badge badge-village" style="background:' +
    p.Color +
    "55;color:#333;border:1px solid " +
    p.Color +
    ';">' +
    p.Label +
    " °C</span>" +
    '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);">მრავალწლიური მაქსიმუმი  |  1990–2022</div>');
  showBottomChartTemp(data, "max", p);
}

function _showInfoPrecip(p, data) {
  showInfoCard('<div class="info-name" style="font-size:13px;">ატმ. ნალექები</div>' +
    '<span class="info-type-badge badge-village" style="background:' +
    p.Color +
    "55;color:#333;border:1px solid " +
    p.Color +
    ';">' +
    p.Label +
    " მმ</span>" +
    '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);">მრავალწლიური ჯამი  |  1990–2022</div>');
  showBottomChartTemp(data, "precip", p);
}

function showBottomChartTemp(data, type, sel) {
  var ctx = prepareBottomChart();
  var titles = {
    avg: "საშ. ტემპერატურა — ფართობის განაწილება",
    max: "მაქს. ტემპერატურა — ფართობის განაწილება",
    precip: "ატმ. ნალექები — ფართობის განაწილება",
  };
  var units = { avg: "°C", max: "°C", precip: "მმ" };
  var areas = {},
    colors = {};
  data.features.forEach(function (f) {
    var k = f.properties.Label + " " + units[type];
    // ფართობი წინასწარაა გამოთვლილი მონაცემებში (UTM, ნახვრეტების გამოკლებით)
    areas[k] = (areas[k] || 0) + (f.properties.Area_km2 || 0);
    colors[k] = f.properties.Color;
  });
  var sorted = Object.keys(areas).sort(function (a, b) {
    return parseFloat(a) - parseFloat(b);
  });
  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted,
      datasets: [
        {
          label: "კმ²",
          data: sorted.map(function (k) {
            var v = areas[k];
            // ძალიან პატარა ფართობებიც უნდა ჩანდეს, არა 0
            if (v < 1) return Math.round(v * 100) / 100;
            if (v < 10) return Math.round(v * 10) / 10;
            return Math.round(v);
          }),
          minBarLength: 5,
          backgroundColor: sorted.map(function (k) {
            return colors[k] + "CC";
          }),
          borderColor: sorted.map(function (k) {
            return colors[k];
          }),
          borderWidth: 1.5,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      layout: { padding: { top: 16 } },
      maintainAspectRatio: false,
      plugins: {
        title: chartTitle(titles[type]),
        tooltip: {
          callbacks: {
            label: function (c) {
              return " " + Math.round(c.parsed.y).toLocaleString() + " კმ²";
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            font: { size: 10, weight: "500" },
            callback: function (v) {
              return v.toLocaleString() + " კმ²";
            },
          },
        },
        x: {
          ticks: { font: { size: 11, weight: "500" }, maxRotation: 35 },
          grid: { display: false },
        },
      },
    },
  });
  if (sel)
    highlightBottomBars(function (l, i) {
      return sorted[i] === sel.Label + " " + units[type];
    });
}

function updateTempLegend(type) {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var configs = {
    avg: { classes: AVG_TEMP_CLASSES, title: "საშ. ტემ. (1990–2022)" },
    max: { classes: MAX_TEMP_CLASSES, title: "მაქს. ტემ. (1990–2022)" },
    precip: { classes: PRECIP_CLASSES, title: "ნალექი (1990–2022)" },
  };
  var cfg = configs[type];
  var html =
    '<div class="section-title">' +
    cfg.title +
    "</div>";
  html += '<div class="ethnics-legend">';
  cfg.classes.forEach(function (c) {
    html +=
      '<div class="legend-item" style="margin-bottom:3px;">' +
      '<span style="display:inline-block;width:14px;height:14px;background:' +
      c.color +
      ';border:1px solid #ccc;flex-shrink:0;margin-right:5px;vertical-align:middle;"></span>' +
      '<span style="font-size:10px;vertical-align:middle;">' +
      c.label +
      "</span></div>";
  });
  html += "</div>";
  el.innerHTML = html;
}

// ============================================================
// ცხელი დღეები, ტროპიკული ღამეები, ყინვიანი დღეები
// ============================================================
var hotDaysLayer = null;

var tropNightsLayer = null;

var frostDaysLayer = null;

var hotDaysData = null;

var tropNightsData = null;

var frostDaysData = null;

// ლეგენდის კლასები PDF-ის მიხედვით
var HOT_DAYS_CLASSES = [
  { label: "0–10", color: "#FFF9C4" },
  { label: "10–20", color: "#FFE082" },
  { label: "20–30", color: "#FFB300" },
  { label: "30–40", color: "#FB8C00" },
  { label: "40–50", color: "#E53935" },
  { label: "50–60", color: "#C62828" },
  { label: "60–70", color: "#9B1B1B" },
  { label: "70–78", color: "#7B1F1F" },
];

var TROP_NIGHTS_CLASSES = [
  { label: "0–10", color: "#FCE4EC" },
  { label: "10–20", color: "#F48FB1" },
  { label: "20–30", color: "#CE93D8" },
  { label: "30–40", color: "#AB47BC" },
  { label: "40–48", color: "#4A148C" },
];

var FROST_DAYS_CLASSES = [
  { label: "60–80", color: "#E8F5E9" },
  { label: "80–100", color: "#B3E5FC" },
  { label: "100–120", color: "#90CAF9" },
  { label: "120–140", color: "#5C6BC0" },
  { label: "140–160", color: "#3949AB" },
  { label: "160–180", color: "#283593" },
  { label: "180–200", color: "#1A237E" },
  { label: "200–240", color: "#0D1642" },
];

function _buildClimateLayer(data, layerRef, onClickFn) {
  if (layerRef.layer) map.removeLayer(layerRef.layer);
  var layer = L.geoJSON(data, {
    style: function (feat) {
      var c = feat.properties.Color;
      return {
        fillColor: c,
        fillOpacity: 0.75,
        color: darken(c),
        weight: 0.6,
        opacity: 0.8,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      var _zoneName = p.Label || p.Name_Geo || "";
      if (_zoneName)
        areaTooltip(layer, _zoneName);
      layer.on("mouseover", function () {
        layer.setStyle({ weight: 1.4, fillOpacity: 0.9 });
      });
      layer.on("mouseout", function () {
        layer.setStyle({
          fillColor: p.Color,
          fillOpacity: 0.75,
          color: darken(p.Color),
          weight: 0.6,
          opacity: 0.8,
        });
      });
      layer.on("click", function () {
        onClickFn(p, data);
      });
    },
  }).addTo(map);
  layerRef.layer = layer;
}

var _hotRef = { layer: null };

var _tropRef = { layer: null };

var _frostRef = { layer: null };

function loadHotDays() {
  if (hotDaysData) {
    _buildClimateLayer(hotDaysData, _hotRef, _showInfoHotDays);
    updateClimateLegend("hot");
    loadNatureMuniCenters();
    setInfoBtn("hot_days");
    return;
  }
  fetch(dataUrl("data/hot_days.geojson"))
    .then((r) => r.json())
    .then(function (d) {
      hotDaysData = d;
      _buildClimateLayer(d, _hotRef, _showInfoHotDays);
      updateClimateLegend("hot");
      loadNatureMuniCenters();
      setInfoBtn("hot_days");
    });
}

function loadTropNights() {
  if (tropNightsData) {
    _buildClimateLayer(tropNightsData, _tropRef, _showInfoTropNights);
    updateClimateLegend("trop");
    loadNatureMuniCenters();
    setInfoBtn("trop_nights");
    return;
  }
  fetch(dataUrl("data/tropical_nights.geojson"))
    .then((r) => r.json())
    .then(function (d) {
      tropNightsData = d;
      _buildClimateLayer(d, _tropRef, _showInfoTropNights);
      updateClimateLegend("trop");
      loadNatureMuniCenters();
      setInfoBtn("trop_nights");
    });
}

function loadFrostDays() {
  if (frostDaysData) {
    _buildClimateLayer(frostDaysData, _frostRef, _showInfoFrostDays);
    updateClimateLegend("frost");
    loadNatureMuniCenters();
    setInfoBtn("frost_days");
    return;
  }
  fetch(dataUrl("data/frost_days.geojson"))
    .then((r) => r.json())
    .then(function (d) {
      frostDaysData = d;
      _buildClimateLayer(d, _frostRef, _showInfoFrostDays);
      updateClimateLegend("frost");
      loadNatureMuniCenters();
      setInfoBtn("frost_days");
    });
}

function _showInfoHotDays(p, data) {
  showInfoCard('<div class="info-name" style="font-size:13px;">ცხელი დღეები</div>' +
    '<span class="info-type-badge badge-village" style="background:' +
    p.Color +
    "55;color:#333;border:1px solid " +
    p.Color +
    ';">' +
    p.Label +
    " დღე</span>" +
    '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);">დღის t° > 30°C  |  1990–2022</div>');
  showBottomChartClimate(data, "hot", p);
}

function _showInfoTropNights(p, data) {
  showInfoCard('<div class="info-name" style="font-size:13px;">ტროპიკული ღამეები</div>' +
    '<span class="info-type-badge badge-village" style="background:' +
    p.Color +
    "55;color:#333;border:1px solid " +
    p.Color +
    ';">' +
    p.Label +
    " ღამე</span>" +
    '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);">ღამის t° > 20°C  |  1990–2022</div>');
  showBottomChartClimate(data, "trop", p);
}

function _showInfoFrostDays(p, data) {
  showInfoCard('<div class="info-name" style="font-size:13px;">ყინვიანი დღეები</div>' +
    '<span class="info-type-badge badge-village" style="background:' +
    p.Color +
    "55;color:#333;border:1px solid " +
    p.Color +
    ';">' +
    p.Label +
    " დღე</span>" +
    '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);">t° < 0°C  |  1990–2022</div>');
  showBottomChartClimate(data, "frost", p);
}

function showBottomChartClimate(data, type, sel) {
  var ctx = prepareBottomChart();
  var titles = {
    hot: "ცხელი დღეების განაწილება (კმ²)",
    trop: "ტროპ. ღამეების განაწილება (კმ²)",
    frost: "ყინვიანი დღეების განაწილება (კმ²)",
  };
  var areas = {},
    colors = {};
  data.features.forEach(function (f) {
    var k = f.properties.Label;
    // ფართობი წინასწარაა გამოთვლილი მონაცემებში (UTM, ნახვრეტების გამოკლებით)
    areas[k] = (areas[k] || 0) + (f.properties.Area_km2 || 0);
    colors[k] = f.properties.Color;
  });
  var sorted = Object.keys(areas).sort(function (a, b) {
    return parseFloat(a) - parseFloat(b);
  });
  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted,
      datasets: [
        {
          label: "კმ²",
          data: sorted.map(function (k) {
            var v = areas[k];
            // ძალიან პატარა ფართობებიც უნდა ჩანდეს, არა 0
            if (v < 1) return Math.round(v * 100) / 100;
            if (v < 10) return Math.round(v * 10) / 10;
            return Math.round(v);
          }),
          minBarLength: 5,
          backgroundColor: sorted.map(function (k) {
            return colors[k] + "CC";
          }),
          borderColor: sorted.map(function (k) {
            return colors[k];
          }),
          borderWidth: 1.5,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      layout: { padding: { top: 16 } },
      maintainAspectRatio: false,
      plugins: {
        title: chartTitle(titles[type]),
        tooltip: {
          callbacks: {
            label: function (c) {
              return " " + Math.round(c.parsed.y).toLocaleString() + " კმ²";
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            font: { size: 10, weight: "500" },
            callback: function (v) {
              return v + " კმ²";
            },
          },
        },
        x: {
          ticks: { font: { size: 11, weight: "500" }, maxRotation: 35 },
          grid: { display: false },
        },
      },
    },
  });
  if (sel)
    highlightBottomBars(function (l, i) {
      return sorted[i] === sel.Label;
    });
}

function updateClimateLegend(type) {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var configs = {
    hot: {
      classes: HOT_DAYS_CLASSES,
      title: "ცხელი დღეები (1990–2022)",
      unit: "დღე",
    },
    trop: {
      classes: TROP_NIGHTS_CLASSES,
      title: "ტროპიკული ღამეები (1990–2022)",
      unit: "ღამე",
    },
    frost: {
      classes: FROST_DAYS_CLASSES,
      title: "ყინვიანი დღეები (1990–2022)",
      unit: "დღე",
    },
  };
  var cfg = configs[type];
  var html =
    '<div class="section-title">' +
    cfg.title +
    "</div>";
  html += '<div class="ethnics-legend">';
  cfg.classes.forEach(function (c) {
    html +=
      '<div class="legend-item" style="margin-bottom:3px;">' +
      '<span style="display:inline-block;width:14px;height:14px;background:' +
      c.color +
      ';border:1px solid #ccc;flex-shrink:0;margin-right:5px;vertical-align:middle;"></span>' +
      '<span style="font-size:10px;vertical-align:middle;">' +
      c.label +
      " " +
      cfg.unit +
      "</span></div>";
  });
  html += "</div>";
  el.innerHTML = html;
}

// ============================================================
// სითბური ტალღები და გვალვის ინდექსი
// ============================================================
var heatWavesLayer = null;

var droughtLayer = null;

var heatWavesData = null;

var droughtData = null;

function loadHeatWaves() {
  if (heatWavesData) {
    buildHeatWavesLayer(heatWavesData);
    loadNatureMuniCenters();
    return;
  }
  fetch(dataUrl("data/heat_waves.geojson"))
    .then((r) => r.json())
    .then((d) => {
      heatWavesData = d;
      buildHeatWavesLayer(d);
      loadNatureMuniCenters();
    });
}

function loadDrought() {
  if (droughtData) {
    buildDroughtLayer(droughtData);
    loadNatureMuniCenters();
    return;
  }
  fetch(dataUrl("data/drought_index.geojson"))
    .then((r) => r.json())
    .then((d) => {
      droughtData = d;
      buildDroughtLayer(d);
      loadNatureMuniCenters();
    });
}

function buildHeatWavesLayer(data) {
  if (heatWavesLayer) map.removeLayer(heatWavesLayer);
  heatWavesLayer = L.geoJSON(data, {
    style: function (feat) {
      var c = feat.properties.Color;
      return {
        fillColor: c,
        fillOpacity: 0.75,
        color: darken(c),
        weight: 0.6,
        opacity: 0.8,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      var _tip = p.Label || "";
      if (_tip)
        areaTooltip(layer, _tip);
      layer.on("mouseover", function () {
        layer.setStyle({ weight: 1.5, fillOpacity: 0.9 });
      });
      layer.on("mouseout", function () {
        heatWavesLayer.resetStyle(layer);
      });
      layer.on("click", function () {
        showInfoCard('<div class="info-name" style="font-size:13px;">სითბური ტალღების ტენდენცია</div>' +
          '<span class="info-type-badge badge-village" style="background:' +
          p.Color +
          "55;color:#333;border:1px solid " +
          p.Color +
          ';">სიხშირე: ' +
          p.Label +
          "</span>" +
          '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);line-height:1.7;">' +
          "<b>დიაპაზონი:</b> " +
          p.ContourMin +
          " – " +
          p.ContourMax +
          "<br>" +
          "<b>პერიოდი:</b> 1990–2022</div>");
        showBottomChartHeatWaves(data, p);
      });
    },
  }).addTo(map);
  updateHeatWavesLegend();
  setInfoBtn("heat_waves");
}

function buildDroughtLayer(data) {
  if (droughtLayer) map.removeLayer(droughtLayer);
  droughtLayer = L.geoJSON(data, {
    style: function (feat) {
      var c = feat.properties.Color;
      return {
        fillColor: c,
        fillOpacity: 0.75,
        color: darken(c),
        weight: 0.6,
        opacity: 0.8,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      var _tip = p.Category ? p.Category + " (" + p.Label + ")" : p.Label || "";
      if (_tip)
        areaTooltip(layer, _tip);
      layer.on("mouseover", function () {
        layer.setStyle({ weight: 1.5, fillOpacity: 0.9 });
      });
      layer.on("mouseout", function () {
        droughtLayer.resetStyle(layer);
      });
      layer.on("click", function () {
        showInfoCard('<div class="info-name" style="font-size:13px;">გვალვის ინდექსი</div>' +
          '<span class="info-type-badge badge-village" style="background:' +
          p.Color +
          "55;color:#333;border:1px solid " +
          p.Color +
          ';">' +
          p.Category +
          "</span>" +
          '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);line-height:1.7;">' +
          "<b>ინდექსი:</b> " +
          p.Label +
          "<br>" +
          "<b>პერიოდი:</b> 1990–2022</div>");
        showBottomChartDrought(data, p);
      });
    },
  }).addTo(map);
  updateDroughtLegend();
  setInfoBtn("drought");
}

function showBottomChartHeatWaves(data, sel) {
  var ctx = prepareBottomChart();
  var areas = {},
    colors = {};
  data.features.forEach(function (f) {
    var k = f.properties.Label;
    if (!areas[k]) areas[k] = 0;
    // ფართობი წინასწარაა გამოთვლილი მონაცემებში
    areas[k] += f.properties.Area_km2 || 0;
    colors[k] = f.properties.Color;
  });
  var sorted = Object.keys(areas).sort(function (a, b) {
    return parseFloat(a) - parseFloat(b);
  });
  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted,
      datasets: [
        {
          label: "ფართობი",
          data: sorted.map(function (k) {
            var v = areas[k];
            // ძალიან პატარა ფართობებიც უნდა ჩანდეს, არა 0
            if (v < 1) return Math.round(v * 100) / 100;
            if (v < 10) return Math.round(v * 10) / 10;
            return Math.round(v);
          }),
          minBarLength: 5,
          backgroundColor: sorted.map(function (k) {
            return colors[k] + "CC";
          }),
          borderColor: sorted.map(function (k) {
            return colors[k];
          }),
          borderWidth: 1.5,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      layout: { padding: { top: 16 } },
      maintainAspectRatio: false,
      plugins: {
        title: chartTitle("სითბური ტალღების ტენდენცია — ფართობი (კმ²)"),
        tooltip: {
          callbacks: {
            label: function (c) {
              return " " + c.parsed.y.toLocaleString() + " კმ²";
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { font: { size: 10, weight: "500" },
            callback: function (v) {
              return v + " კმ²";
            },
          },
        },
        x: {
          ticks: { font: { size: 11, weight: "500" }, maxRotation: 35 },
          grid: { display: false },
        },
      },
    },
  });
  if (sel)
    highlightBottomBars(function (l, i) {
      return sorted[i] === sel.Label;
    });
}

function showBottomChartDrought(data, sel) {
  var ctx = prepareBottomChart();
  var areas = {},
    colors = {};
  data.features.forEach(function (f) {
    var k = f.properties.Category;
    if (!areas[k]) areas[k] = 0;
    // ფართობი წინასწარაა გამოთვლილი მონაცემებში
    areas[k] += f.properties.Area_km2 || 0;
    colors[k] = f.properties.Color;
  });
  var order = [
    "გვალვა არ არის",
    "საშუალო",
    "ზომიერი",
    "მკაცრი",
    "ექსტრემალური",
  ];
  var labels = order.filter(function (k) {
    return areas[k];
  });
  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "ფართობი",
          data: labels.map(function (k) {
            var v = areas[k];
            if (v < 1) return Math.round(v * 100) / 100;
            if (v < 10) return Math.round(v * 10) / 10;
            return Math.round(v);
          }),
          backgroundColor: labels.map(function (k) {
            return colors[k] + "CC";
          }),
          borderColor: labels.map(function (k) {
            return colors[k];
          }),
          borderWidth: 1.5,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      layout: { padding: { top: 16 } },
      maintainAspectRatio: false,
      plugins: {
        title: chartTitle("გვალვის ინდექსი — კატეგორიების ფართობი (კმ²)"),
        tooltip: {
          callbacks: {
            label: function (c) {
              return " " + c.parsed.y.toLocaleString() + " კმ²";
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { font: { size: 10, weight: "500" },
            callback: function (v) {
              return v + " კმ²";
            },
          },
        },
        x: {
          ticks: { font: { size: 11, weight: "500" }, color: "#1A1A18" },
          grid: { display: false },
        },
      },
    },
  });
  if (sel)
    highlightBottomBars(function (l, i) {
      return labels[i] === sel.Category;
    });
}

function updateHeatWavesLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var classes = [
    { label: "0.05–0.06", color: "#FFF9C4" },
    { label: "0.06–0.07", color: "#FFF176" },
    { label: "0.07–0.08", color: "#FFEE58" },
    { label: "0.08–0.09", color: "#FDD835" },
    { label: "0.09–0.10", color: "#F9A825" },
    { label: "0.10–0.11", color: "#FB8C00" },
    { label: "0.11–0.12", color: "#E64A19" },
    { label: "0.12–0.13", color: "#C62828" },
    { label: "0.13–0.14", color: "#B71C1C" },
    { label: "0.14–0.15", color: "#7B1F1F" },
  ];
  var html =
    '<div class="section-title">სიხშირის ტენდენცია (1990–2022)</div><div class="ethnics-legend">';
  classes.forEach(function (c) {
    html +=
      '<div class="legend-item" style="margin-bottom:3px;">' +
      '<span style="display:inline-block;width:14px;height:14px;background:' +
      c.color +
      ';border:1px solid #ccc;flex-shrink:0;margin-right:5px;vertical-align:middle;"></span>' +
      '<span style="font-size:10px;vertical-align:middle;">' +
      c.label +
      "</span></div>";
  });
  html += "</div>";
  el.innerHTML = html;
}

function updateDroughtLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var classes = [
    { label: "ექსტრემალური  (< -1.5)", color: "#7B1F1F" },
    { label: "მკაცრი (-1.5 – -1.0)", color: "#E53935" },
    { label: "ზომიერი (-1.0 – -0.5)", color: "#FFA726" },
    { label: "საშუალო (-0.5 – 0.0)", color: "#FFFDE7" },
  ];
  var html =
    '<div class="section-title">გვალვის კატეგორია (1990–2022)</div><div class="ethnics-legend">';
  classes.forEach(function (c) {
    html +=
      '<div class="legend-item" style="margin-bottom:4px;">' +
      '<span style="display:inline-block;width:14px;height:14px;background:' +
      c.color +
      ';border:1px solid #ccc;flex-shrink:0;margin-right:5px;vertical-align:middle;"></span>' +
      '<span style="font-size:10px;vertical-align:middle;">' +
      c.label +
      "</span></div>";
  });
  html += "</div>";
  el.innerHTML = html;
}

// ============================================================
// ღვარცოფები
// ============================================================
var madflowZoningLayer = null;

var madflowPointLayer = null;

var madflowErosionLayer = null;

var madflowData = null;

var MADFLOW_ZONING_ORDER = ["დაბალი", "საშუალო", "მაღალი"];

var MADFLOW_ZONE_COLORS = {
  დაბალი: "#C8DBD7",
  საშუალო: "#A6C8C3",
  მაღალი: "#82ADA9",
};

function loadMadflow() {
  setInfoBtn("madflow");
  if (madflowData) {
    renderMadflowLayers(madflowData);
    return;
  }
  fetch(dataUrl("data/madflow.geojson"))
    .then((r) => r.json())
    .then(function (d) {
      madflowData = d;
      renderMadflowLayers(d);
    });
}

function renderMadflowLayers(data) {
  // ---- ზონირება (Polygons) ----
  if (madflowZoningLayer) {
    map.removeLayer(madflowZoningLayer);
    madflowZoningLayer = null;
  }
  if (madflowPointLayer) {
    map.removeLayer(madflowPointLayer);
    madflowPointLayer = null;
  }
  if (madflowErosionLayer) {
    map.removeLayer(madflowErosionLayer);
    madflowErosionLayer = null;
  }

  var zoningFeats = {
    type: "FeatureCollection",
    features: data.features.filter(function (f) {
      return f.properties.type === "zoning";
    }),
  };
  var madflowFeats = {
    type: "FeatureCollection",
    features: data.features.filter(function (f) {
      return f.properties.type === "madflow";
    }),
  };
  var erosionFeats = {
    type: "FeatureCollection",
    features: data.features.filter(function (f) {
      return f.properties.type === "erosion";
    }),
  };

  // Zoning polygons
  madflowZoningLayer = L.geoJSON(zoningFeats, {
    style: function (feat) {
      var c = MADFLOW_ZONE_COLORS[feat.properties.Name_Geo] || "#BDBDBD";
      return {
        fillColor: c,
        fillOpacity: 0.65,
        color: "#999",
        weight: 0.4,
        opacity: 0.5,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      layer.on("mouseover", function () {
        layer.setStyle({ weight: 1.5, fillOpacity: 0.9 });
      });
      layer.on("mouseout", function () {
        madflowZoningLayer.resetStyle(layer);
      });
      var _tip = p.Name_Geo || "";
      if (_tip)
        areaTooltip(layer, _tip);
      layer.on("click", function () {
        showInfoMadflowZone(p);
        showBottomChartMadflow(data, p);
      });
    },
  }).addTo(map);

  // MadFlow points — ყვითელი სიმბოლო
  madflowPointLayer = L.geoJSON(madflowFeats, {
    pointToLayer: function (feature, latlng) {
      var svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">' +
        '<path fill="#FFD54F" stroke="#F57F17" stroke-width="1" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>' +
        "</svg>";
      var icon = L.divIcon({
        html: svg,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        className: "",
      });
      var marker = L.marker(latlng, { icon: icon });
      pointTooltip(marker, feature.properties.Name_Geo || "ღვარცოფი", -10);
      marker.on("click", function () {
        showInfoMadflowPoint(feature.properties, "madflow");
        showBottomChartMadflow(data);
      });
      return marker;
    },
  }).addTo(map);

  // Erosion points — ლურჯი, ირიბი ხაზით
  madflowErosionLayer = L.geoJSON(erosionFeats, {
    pointToLayer: function (feature, latlng) {
      var svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14">' +
        '<rect x="1" y="1" width="12" height="12" rx="2" fill="#1565C0" stroke="#0D47A1" stroke-width="1"/>' +
        '<line x1="3.6" y1="10.4" x2="10.4" y2="3.6" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>' +
        "</svg>";
      var icon = L.divIcon({
        html: svg,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        className: "",
      });
      var marker = L.marker(latlng, { icon: icon });
      pointTooltip(marker, feature.properties.Name_Geo || "ეროზია", -10);
      marker.on("click", function () {
        showInfoMadflowPoint(feature.properties, "erosion");
        showBottomChartMadflow(data);
      });
      return marker;
    },
  }).addTo(map);

  updateMadflowLegend(data);
  loadNatureMuniCenters();
}

function showInfoMadflowZone(p) {
  var color = MADFLOW_ZONE_COLORS[p.Name_Geo] || "#BDBDBD";
  showInfoCard('<div class="info-name">' +
    (p.Name_Geo || "") +
    "</div>" +
    '<span class="info-type-badge badge-village" style="background:' +
    color +
    "55;color:#444;border:1px solid " +
    color +
    ';">' +
    (p.Name_Eng || "") +
    "</span>" +
    '<div class="info-row" style="margin-top:8px;"><span class="info-key">ფართობი</span><span class="info-val">' +
    (p.Area_km2 || 0).toLocaleString() +
    " კმ²</span></div>");
}

function showInfoMadflowPoint(p, type) {
  // ღვარცოფი — ყვითელი (მუქი ტონი წაკითხვადობისთვის), ნაპირგარეცხვა — ლურჯი
  var color = type === "madflow" ? "#F57F17" : "#1565C0";
  var label = type === "madflow" ? "ღვარცოფი" : "მდინარის ნაპირგარეცხვა";
  showInfoCard('<div class="info-name">' +
    (p.Name_Geo || p.Name_Eng || "–") +
    "</div>" +
    '<span class="info-type-badge" style="background:' +
    color +
    "22;color:" +
    color +
    ";border:1px solid " +
    color +
    '55;">' +
    label +
    "</span>");
}

function showBottomChartMadflow(data, sel) {
  var ctx = prepareBottomChart();

  var areas = {},
    colors = {};
  data.features
    .filter(function (f) {
      return f.properties.type === "zoning";
    })
    .forEach(function (f) {
      var k = f.properties.Name_Geo;
      areas[k] = (areas[k] || 0) + (f.properties.Area_km2 || 0);
      colors[k] = MADFLOW_ZONE_COLORS[k] || "#BDBDBD";
    });
  var sorted = MADFLOW_ZONING_ORDER.filter(function (k) {
    return areas[k];
  });

  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted,
      datasets: [
        {
          label: "ფართობი (კმ²)",
          data: sorted.map(function (k) {
            var v = areas[k];
            // ძალიან პატარა ფართობებიც უნდა ჩანდეს, არა 0
            if (v < 1) return Math.round(v * 100) / 100;
            if (v < 10) return Math.round(v * 10) / 10;
            return Math.round(v);
          }),
          minBarLength: 5,
          backgroundColor: sorted.map(function (k) {
            return colors[k] + "CC";
          }),
          borderColor: sorted.map(function (k) {
            return colors[k];
          }),
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
        title: chartTitle("ღვარცოფის საფრთხის ზონირება — ფართობი (კმ²)", 12),
        tooltip: {
          callbacks: {
            label: function (c) {
              return " " + c.parsed.y.toLocaleString() + " კმ²";
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: {
            font: { size: 10, weight: "500" },
            color: "#6B6862",
            callback: function (v) {
              return v.toLocaleString() + " კმ²";
            },
          },
        },
        x: {
          ticks: { font: { size: 11, weight: "500" }, color: "#1A1A18" },
          grid: { display: false },
        },
      },
    },
  });
  if (sel)
    highlightBottomBars(function (l, i) {
      return sorted[i] === sel.Name_Geo;
    });
}

function updateMadflowLegend(data) {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div class="section-title">ღვარცოფის საფრთხის ზონები</div>';
  html += '<div class="ethnics-legend">';
  MADFLOW_ZONING_ORDER.forEach(function (label) {
    var c = MADFLOW_ZONE_COLORS[label] || "#BDBDBD";
    html +=
      '<div class="eth-legend-item">' +
      '<span class="eth-dot" style="background:' +
      c +
      ';border:1px solid rgba(0,0,0,0.15);border-radius:3px;"></span>' +
      '<span style="font-size:10px;">' +
      label +
      "</span></div>";
  });
  html += "</div>";

  var madflowCount = data
    ? data.features.filter(function (f) {
        return f.properties.type === "madflow";
      }).length
    : "";
  var erosionCount = data
    ? data.features.filter(function (f) {
        return f.properties.type === "erosion";
      }).length
    : "";

  html +=
    '<div class="section-title" style="margin-top:10px;">სახეობა</div>';
  html +=
    '<div class="ethnics-legend">' +
    '<div class="eth-legend-item">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" style="flex-shrink:0;"><path fill="#FFD54F" stroke="#F57F17" stroke-width="1" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>' +
    '<span style="font-size:10px;">ღვარცოფი (' +
    madflowCount +
    ")</span></div>" +
    '<div class="eth-legend-item">' +
    '<svg width="14" height="14" viewBox="0 0 14 14" style="flex-shrink:0;"><rect x="1" y="1" width="12" height="12" rx="2" fill="#1565C0" stroke="#0D47A1" stroke-width="1"/><line x1="3.6" y1="10.4" x2="10.4" y2="3.6" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>' +
    '<span style="font-size:10px;">ნაპირგარეცხვა (' +
    erosionCount +
    ")</span></div>" +
    "</div>";
  el.innerHTML = html;
}
