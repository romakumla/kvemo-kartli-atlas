// ბუნება: ტყეები, მცენარეული საფარი, ნიადაგები, სეტყვა, გეოლოგია და წიაღისეული
// Part of the atlas script, split from the former js/main.js. Files are loaded in
// order by index.html; theme files only define things, their start-up code is
// in initNatureVegetationSoilsGeology(), called from app.js once every file is loaded.


// ============================================================
// ტყეები და მცენარეული საფარი
// ============================================================
var forestLayer = null;

var vegetationLayer = null;

var forestData = null;

var vegetationData = null;

// ლეგენდის მონაცემები
var FOREST_LEGEND = [
  { color: "#1B5E20", label: "ნაძვი და სოჭი" },
  { color: "#2E7D32", label: "წიფელი" },
  { color: "#6D4C41", label: "წაბლი" },
  { color: "#8D6E63", label: "მუხა და სხვა ფოთლოვნები" },
  { color: "#C8894E", label: "რცხილა და ჯაგრცხილა" },
  { color: "#A5D6A7", label: "თხემლა" },
  { color: "#E0E0E0", label: "ნათელი ტყე / ჭალის ტყე" },
];

var VEG_LEGEND = [
  { color: "#F9A825", label: "ნათელი ტყე" },
  { color: "#66BB6A", label: "სანაპირო (ჭალის ტყე)" },
  { color: "#8D6E63", label: "მუხნარი და რცხილნარი" },
  { color: "#2E7D32", label: "აღმ. საქ. წიფლნარი" },
  { color: "#1B5E20", label: "მთის ფიჭვნარი" },
  { color: "#D4E157", label: "მაღალმთის ველი" },
  { color: "#AED581", label: "სუბალპ. მდელო ველის ელ." },
  { color: "#C5E1A5", label: "აღმ. საქ. სუბალპ. მდელო" },
  { color: "#E6EE9C", label: "ალპური მდელო" },
  { color: "#BCAAA4", label: "ჯაგეკლ. ველი ტყის ელ." },
  { color: "#FFF9C4", label: "უროიანი ველი" },
];

function loadForest() {
  loadData("data/forest.geojson", function (d) {
    forestData = d;
    buildForestLayer(d);
    loadNatureMuniCenters();
  });
}

function loadVegetation() {
  loadData("data/vegetation.geojson", function (d) {
    vegetationData = d;
    buildVegetationLayer(d);
    loadNatureMuniCenters();
  });
}

function buildForestLayer(data) {
  clearLayer(forestLayer);
  forestLayer = L.geoJSON(data, {
    style: function (feat) {
      return {
        fillColor: feat.properties.Color,
        fillOpacity: 0.75,
        color: "#555",
        weight: 0.4,
        opacity: 0.6,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      var _tip = p.Name_Geo || "";
      if (_tip)
        areaTooltip(layer, _tip);
      layer.on("mouseover", function () {
        layer.setStyle({ weight: 1.5, fillOpacity: 0.92 });
      });
      layer.on("mouseout", function () {
        forestLayer.resetStyle(layer);
      });
      layer.on("click", function () {
        showInfoCard('<div class="info-name" style="font-size:13px;">' +
          (p.Name_Geo || "") +
          "</div>" +
          '<span class="info-type-badge badge-village" style="background:' +
          p.Color +
          "55;color:#333;border:1px solid " +
          p.Color +
          ';">' +
          (p.Name_Eng || "") +
          "</span>" +
          '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);line-height:1.7;">' +
          "<b>ფართობი:</b> " +
          (p.Area_km2 || 0).toLocaleString() +
          " კმ²</div>");
        showBottomChartForest(data);
        highlightBottomBars(p.Name_Geo);
      });
    },
  }).addTo(map);
  updateForestLegend();
  setInfoBtn("forest");
}

function buildVegetationLayer(data) {
  clearLayer(vegetationLayer);
  vegetationLayer = L.geoJSON(data, {
    style: function (feat) {
      return {
        fillColor: feat.properties.Color,
        fillOpacity: 0.75,
        color: "#555",
        weight: 0.4,
        opacity: 0.6,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      var _tip = p.Name_Geo || "";
      if (_tip)
        areaTooltip(layer, _tip);
      layer.on("mouseover", function () {
        layer.setStyle({ weight: 1.5, fillOpacity: 0.92 });
      });
      layer.on("mouseout", function () {
        vegetationLayer.resetStyle(layer);
      });
      layer.on("click", function () {
        showInfoCard('<div class="info-name" style="font-size:13px;">' +
          (p.Name_Geo || "") +
          "</div>" +
          '<span class="info-type-badge badge-village" style="background:' +
          p.Color +
          "55;color:#333;border:1px solid " +
          p.Color +
          ';">' +
          (p.Name_Eng || "") +
          "</span>" +
          '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);line-height:1.7;">' +
          "<b>ფართობი:</b> " +
          (p.Area_km2 || 0).toLocaleString() +
          " კმ²</div>");
        showBottomChartVegetation(data);
        highlightBottomBars(p.Name_Geo);
      });
    },
  }).addTo(map);
  updateVegetationLegend();
  setInfoBtn("vegetation");
}

function _calcChartAreas(data, keyField) {
  var areas = {},
    colors = {};
  data.features.forEach(function (f) {
    var k = f.properties[keyField];
    areas[k] = (areas[k] || 0) + (f.properties.Area_km2 || 0);
    colors[k] = f.properties.Color;
  });
  return { areas: areas, colors: colors };
}

function showBottomChartForest(data) {
  var ctx = prepareBottomChart();
  var d = _calcChartAreas(data, "Name_Geo");
  var sorted = Object.keys(d.areas)
    .filter(function (k) {
      return k !== "-";
    })
    .sort(function (a, b) {
      return d.areas[b] - d.areas[a];
    });
  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted,
      datasets: [
        {
          label: "ფართობი",
          data: sorted.map(function (k) {
            var v = d.areas[k];
            if (v < 1) return Math.round(v * 100) / 100;
            if (v < 10) return Math.round(v * 10) / 10;
            return Math.round(v);
          }),
          backgroundColor: sorted.map(function (k) {
            return d.colors[k] + "CC";
          }),
          borderColor: sorted.map(function (k) {
            return d.colors[k];
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
        title: chartTitle("ტყეები — ფართობის განაწილება სახეობების მიხედვით (კმ²)"),
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
              return v + " კმ²";
            },
          },
        },
        x: {
          ticks: {
            font: { size: 11, weight: "500" },
            color: "#1A1A18",
            maxRotation: 35,
          },
          grid: { display: false },
        },
      },
    },
  });
}

function showBottomChartVegetation(data) {
  var ctx = prepareBottomChart();
  var d = _calcChartAreas(data, "Name_Geo");
  var sorted = Object.keys(d.areas).sort(function (a, b) {
    return d.areas[b] - d.areas[a];
  });
  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted,
      datasets: [
        {
          label: "ფართობი",
          data: sorted.map(function (k) {
            var v = d.areas[k];
            if (v < 1) return Math.round(v * 100) / 100;
            if (v < 10) return Math.round(v * 10) / 10;
            return Math.round(v);
          }),
          backgroundColor: sorted.map(function (k) {
            return d.colors[k] + "CC";
          }),
          borderColor: sorted.map(function (k) {
            return d.colors[k];
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
        title: chartTitle("მცენარეული საფარი — ფართობის განაწილება (კმ²)"),
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
              return v + " კმ²";
            },
          },
        },
        x: {
          ticks: {
            font: { size: 11, weight: "500" },
            color: "#1A1A18",
            maxRotation: 40,
          },
          grid: { display: false },
        },
      },
    },
  });
}

function updateForestLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div class="section-title">ძირითადი მერქნიანი სახეობები</div>';
  html += '<div class="ethnics-legend">';
  FOREST_LEGEND.forEach(function (c) {
    html +=
      '<div class="legend-item" style="margin-bottom:3px;">' +
      '<span style="display:inline-block;width:14px;height:14px;background:' +
      c.color +
      ';border:1px solid #aaa;flex-shrink:0;margin-right:5px;vertical-align:middle;"></span>' +
      '<span style="font-size:10px;vertical-align:middle;">' +
      c.label +
      "</span></div>";
  });
  html += "</div>";
  el.innerHTML = html;
}

function updateVegetationLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div class="section-title">მცენარეული საფარი</div>';
  html += '<div class="ethnics-legend">';
  VEG_LEGEND.forEach(function (c) {
    html +=
      '<div class="legend-item" style="margin-bottom:3px;">' +
      '<span style="display:inline-block;width:14px;height:14px;background:' +
      c.color +
      ';border:1px solid #aaa;flex-shrink:0;margin-right:5px;vertical-align:middle;"></span>' +
      '<span style="font-size:10px;vertical-align:middle;">' +
      c.label +
      "</span></div>";
  });
  html += "</div>";
  el.innerHTML = html;
}

// ============================================================
// ნიადაგები
// ============================================================

var soilsLayer = null;

var soilsBornLayer = null;

var soilsData = null;

var soilsBornData = null;

// ===== Info + Chart functions for Soils =====
function showInfoSoils(p) {
  showInfoCard(`
    <div class="info-name" style="font-size:13px;">${p.Name_Geo || ""}</div>
    <span class="info-type-badge badge-village" style="background:${p.Color}33;color:#555;border:1px solid ${p.Color}88;">${p.Name_Eng || ""}</span>
    <div style="margin-top:8px;font-size:10px;color:var(--text-muted);line-height:1.7;">
      <b>FAO:</b> ${p.Soil_Name || "-"}<br>
      <b>pH:</b> ${p.soil_pH || "-"} &nbsp;|&nbsp; <b>ტექსტურა:</b> ${p.Soil_textu || "-"}<br>
      <b>ფართობი:</b> ${p.Area_km2 ? p.Area_km2.toLocaleString() + " კმ²" : "-"}
    </div>`);
}

function showBottomChartSoils(data) {
  var ctx = prepareBottomChart();

  var areas = {},
    colors = {};
  data.features.forEach(function (f) {
    var k = f.properties.Name_Geo;
    areas[k] = (areas[k] || 0) + (f.properties.Area_km2 || 0);
    colors[k] = f.properties.Color;
  });
  var sorted = Object.keys(areas).sort(function (a, b) {
    return areas[b] - areas[a];
  });

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
          backgroundColor: sorted.map((k) => colors[k] + "CC"),
          borderColor: sorted.map((k) => colors[k]),
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
        title: chartTitle("ნიადაგის ტიპები — ფართობის განაწილება (კმ²)", 12),
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
            maxRotation: 35,
          },
          grid: { display: false },
        },
      },
    },
  });
}

// ===== Info + Chart functions for Soils Born =====
function showInfoSoilsBorn(p) {
  showInfoCard(`
    <div class="info-name" style="font-size:13px;">ტიპი ${p.Soil_Geo || ""}</div>
    <span class="info-type-badge badge-village" style="background:${p.Color}33;color:#555;border:1px solid ${p.Color}88;">${p.Name_Eng ? p.Name_Eng.split("(")[0].trim() : ""}</span>
    <div style="margin-top:8px;font-size:10px;color:var(--text-muted);line-height:1.6;">${p.Name_Geo || "-"}<br>
      <b>ფართობი:</b> ${p.Area_km2 ? p.Area_km2.toLocaleString() + " კმ²" : "-"}
    </div>`);
}

function showBottomChartSoilsBorn(data) {
  var ctx = prepareBottomChart();

  var areas = {},
    colors = {},
    labels = {};
  data.features.forEach(function (f) {
    var k = f.properties.Soil_Geo;
    areas[k] = (areas[k] || 0) + (f.properties.Area_km2 || 0);
    colors[k] = f.properties.Color;
    labels[k] = "ტიპი " + k;
  });
  var sorted = Object.keys(areas).sort(function (a, b) {
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
          backgroundColor: sorted.map((k) => colors[k] + "CC"),
          borderColor: sorted.map((k) => colors[k]),
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
        title: chartTitle("ნიადაგ-წარმ. ქანები — ფართობის განაწილება (კმ²)", 12),
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

// ===== Info + Chart functions for Geology =====
function showInfoGeology(p) {
  showInfoCard(`
    <div class="info-name" style="font-size:15px;font-weight:700;">${p.Index || ""}</div>
    <span class="info-type-badge badge-village" style="background:${p.Color}33;color:#555;border:1px solid ${p.Color}88;">გეოლ. ასაკი</span>
    <div style="margin-top:8px;font-size:10px;color:var(--text-muted);line-height:1.6;">
      ${p.Name_Geo || "-"}<br>
      <i>${p.Name_Eng || ""}</i><br>
      <b>ფართობი:</b> ${p.Area_km2 ? p.Area_km2.toLocaleString() + " კმ²" : "-"}
    </div>`);
}

function showBottomChartGeology(data) {
  var ctx = prepareBottomChart();

  var areas = {},
    colors = {};
  data.features.forEach(function (f) {
    var k = f.properties.Index;
    areas[k] = (areas[k] || 0) + (f.properties.Area_km2 || 0);
    colors[k] = f.properties.Color;
  });
  var sorted = Object.keys(areas).sort(function (a, b) {
    return areas[b] - areas[a];
  });

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
          backgroundColor: sorted.map((k) => colors[k] + "CC"),
          borderColor: sorted.map((k) => colors[k]),
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
        title: chartTitle("გეოლოგიური ფენები — ფართობის განაწილება (კმ²)", 12),
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

// ============================================================
// სეტყვა
// ============================================================
var hailTotalLayer = null;

var hail100Layer = null;

var hailTotalData = null;

var hail100Data = null;

var hailActiveType = "total"; // 'total' | '100'

// სეტყვა — ერთი ფერი თითო ფენაზე; სიდიდეს მხოლოდ წრის ზომა გამოხატავს
var HAIL_TOTAL_COLOR = "#4FA3D9"; // ღია ლურჯი — სულ

var HAIL_100_COLOR = "#01579B"; // მუქი ლურჯი — 100 წელიწადში (სეტყვა = ყინული)

var HAIL_TOTAL_CLASSES = [
  { cls: "≤ 1", r: 7, color: HAIL_TOTAL_COLOR },
  { cls: "1–2", r: 10, color: HAIL_TOTAL_COLOR },
  { cls: "2–3", r: 13, color: HAIL_TOTAL_COLOR },
  { cls: "3–4", r: 16, color: HAIL_TOTAL_COLOR },
  { cls: "4–5", r: 19, color: HAIL_TOTAL_COLOR },
  { cls: "5–7", r: 22, color: HAIL_TOTAL_COLOR },
  { cls: "> 7", r: 26, color: HAIL_TOTAL_COLOR },
];

var HAIL_100_CLASSES = [
  { cls: "≤ 1", r: 7, color: HAIL_100_COLOR },
  { cls: "1–2", r: 10, color: HAIL_100_COLOR },
  { cls: "2–3", r: 13, color: HAIL_100_COLOR },
  { cls: "3–4", r: 16, color: HAIL_100_COLOR },
  { cls: "> 4", r: 20, color: HAIL_100_COLOR },
];

// კლასის განსაზღვრა
function _hailClassTotal(v) {
  var c = HAIL_TOTAL_CLASSES;
  if (v <= 1) return c[0];
  if (v <= 2) return c[1];
  if (v <= 3) return c[2];
  if (v <= 4) return c[3];
  if (v <= 5) return c[4];
  if (v <= 7) return c[5];
  return c[6];
}

function _hailClass100(v) {
  var c = HAIL_100_CLASSES;
  if (v <= 1) return c[0];
  if (v <= 2) return c[1];
  if (v <= 3) return c[2];
  if (v <= 4) return c[3];
  return c[4];
}

function loadHailTotal() {
  hailActiveType = "total";
  _loadHailBoth(function () {
    _drawHailLayer("total");
    loadNatureMuniCenters();
  });
}

function loadHail100() {
  hailActiveType = "100";
  _loadHailBoth(function () {
    _drawHailLayer("100");
    loadNatureMuniCenters();
  });
}

function _loadHailBoth(cb) {
  loadDataAll(["data/hail_total.geojson", "data/hail_100.geojson"], function (d) {
    hailTotalData = d[0];
    hail100Data = d[1];
    cb();
  });
}

function _drawHailLayer(type) {
  // ორივე ფენა გამოვრთოთ
  hailTotalLayer = clearLayer(hailTotalLayer);
  hail100Layer = clearLayer(hail100Layer);

  var data = type === "total" ? hailTotalData : hail100Data;
  var valKey = type === "total" ? "Total_km2" : "P100_km2";
  var getFn = type === "total" ? _hailClassTotal : _hailClass100;

  var layer = L.geoJSON(data, {
    pointToLayer: function (feat, latlng) {
      var p = feat.properties;
      var val = p[valKey];
      var cls = getFn(val);
      var marker = L.circleMarker(latlng, {
        radius: cls.r,
        fillColor: cls.color,
        color: "#fff",
        weight: 1.5,
        fillOpacity: 0.88,
      });
      pointTooltip(marker, p.Name_Geo + "<br><b>" + val + " კმ²</b>", -cls.r);
      marker.on("click", function () {
        showInfoHail(p, type);
        showBottomChartHail(data, type);
        highlightBottomBars(p.Name_Geo);
      });
      return marker;
    },
  }).addTo(map);

  if (type === "total") hailTotalLayer = layer;
  else hail100Layer = layer;
  updateHailLegend(type);
  setInfoBtn("hail");
}

// ლეგენდის toggle handler
function _switchHailType(type) {
  if (type === hailActiveType) return;
  hailActiveType = type;
  _drawHailLayer(type);
}

function showInfoHail(p, type) {
  var val = type === "total" ? p.Total_km2 : p.P100_km2;
  var label = type === "total" ? "საერთო დაზ. ფართობი" : "100%-ით დაზ. ფართობი";
  var cls = (type === "total" ? _hailClassTotal : _hailClass100)(val);
  showInfoCard(`
    <div class="info-name" style="font-size:13px;">${p.Name_Geo || ""}</div>
    <span class="info-type-badge badge-village" style="background:${cls.color}33;color:${cls.color};border:1px solid ${cls.color}88;">${cls.cls} კმ²</span>
    <div style="margin-top:8px;font-size:10px;color:var(--text-muted);line-height:1.7;">
      <b>${label}:</b> ${val} კმ²<br>
      <b>საერთო:</b> ${p.Total_km2} კმ² &nbsp;|&nbsp; <b>100%:</b> ${p.P100_km2} კმ²
    </div>`);
}

function showBottomChartHail(data, type) {
  var ctx = prepareBottomChart();

  var valKey = type === "total" ? "Total_km2" : "P100_km2";
  var getFn = type === "total" ? _hailClassTotal : _hailClass100;
  var titleTxt =
    type === "total"
      ? "საერთო დაზიანებული ფართობი ერთ სეტყვიანობაზე (კმ²)"
      : "100%-ით დაზ. ფართობი ერთ სეტყვიანობაზე (კმ²)";

  var feats = data.features.slice().sort(function (a, b) {
    return b.properties[valKey] - a.properties[valKey];
  });

  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: feats.map((f) => f.properties.Name_Geo),
      datasets: [
        {
          label: "ფართობი (კმ²)",
          data: feats.map((f) => f.properties[valKey]),
          backgroundColor: feats.map(
            (f) => getFn(f.properties[valKey]).color + "CC",
          ),
          borderColor: feats.map((f) => getFn(f.properties[valKey]).color),
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
        title: chartTitle(titleTxt),
        tooltip: { callbacks: { label: (c) => ` ${c.parsed.y} კმ²` } },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: {
            font: { size: 10, weight: "500" },
            color: "#6B6862",
            callback: (v) => v + " კმ²",
          },
        },
        x: {
          ticks: {
            font: { size: 11, weight: "500" },
            color: "#1A1A18",
            maxRotation: 40,
          },
          grid: { display: false },
        },
      },
    },
  });
}

function updateHailLegend(type) {
  setInfoBtn("hail");
  var el = document.getElementById("legendContent");
  if (!el) return;
  var classes = type === "total" ? HAIL_TOTAL_CLASSES : HAIL_100_CLASSES;
  var titleTxt =
    type === "total"
      ? "საერთო დაზ. ფართობი (კმ²)"
      : "100%-ით დაზ. ფართობი (კმ²)";

  // toggle — year-btn სტილი (ზუსტად მოქალაქეობის ფენასავით)
  var html = `<div class="ethnics-legend">
    ${classes
      .map(function (c) {
        var d = c.r * 2;
        return (
          '<div class="eth-legend-item"><svg width="' +
          (d + 4) +
          '" height="' +
          (d + 4) +
          '" style="flex-shrink:0;margin-right:6px;"><circle cx="' +
          (d / 2 + 2) +
          '" cy="' +
          (d / 2 + 2) +
          '" r="' +
          c.r +
          '" fill="' +
          c.color +
          '" stroke="#fff" stroke-width="1.5" fill-opacity="0.88"/></svg><span>' +
          c.cls +
          " კმ²</span></div>"
        );
      })
      .join("")}
  </div>
  <div style="margin-top:10px;">
    <div class="section-title">სეტყვა</div>
    <div style="display:flex;gap:6px;">
      <button class="year-btn ${type === "total" ? "active" : ""}" data-hailtype="total" title="საერთო დაზიანებული ფართობი ერთი სეტყვიანობის შემთხვევაზე">საერთო</button>
      <button class="year-btn ${type === "100" ? "active" : ""}" data-hailtype="100" title="100%-ით დაზიანებული ფართობი ერთი სეტყვიანობის შემთხვევაზე">100%</button>
    </div>
  </div>`;

  el.innerHTML = html;

  // event listeners
  el.querySelectorAll("[data-hailtype]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      _switchHailType(this.dataset.hailtype);
    });
  });
}

function loadSoils() {
  loadData("data/soils.geojson", function (d) {
    soilsData = d;
    buildSoilsLayer(d);
    loadNatureMuniCenters();
  });
}

function loadSoilsBorn() {
  loadData("data/soils_born.geojson", function (d) {
    soilsBornData = d;
    buildSoilsBornLayer(d);
    loadNatureMuniCenters();
  });
}

function buildSoilsLayer(data) {
  clearLayer(soilsLayer);
  soilsLayer = L.geoJSON(data, {
    style: function (feat) {
      return {
        fillColor: feat.properties.Color,
        fillOpacity: 0.72,
        color: "#888",
        weight: 0.5,
        opacity: 0.8,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      layer.on("mouseover", function () {
        layer.setStyle({ weight: 2, fillOpacity: 0.9 });
      });
      layer.on("mouseout", function () {
        soilsLayer.resetStyle(layer);
      });
      var _tip = p.Name_Geo || "";
      if (_tip)
        areaTooltip(layer, _tip);
      layer.on("click", function () {
        showInfoSoils(p);
        showBottomChartSoils(data);
        highlightBottomBars(p.Name_Geo);
      });
    },
  }).addTo(map);
  updateSoilsLegend();
  setInfoBtn("soils");
}

function buildSoilsBornLayer(data) {
  clearLayer(soilsBornLayer);
  soilsBornLayer = L.geoJSON(data, {
    style: function (feat) {
      return {
        fillColor: feat.properties.Color,
        fillOpacity: 0.72,
        color: "#888",
        weight: 0.5,
        opacity: 0.8,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      layer.on("mouseover", function () {
        layer.setStyle({ weight: 2, fillOpacity: 0.9 });
      });
      layer.on("mouseout", function () {
        soilsBornLayer.resetStyle(layer);
      });
      var _tip = p.Soil_Geo || "";
      if (_tip)
        areaTooltip(layer, _tip);
      layer.on("click", function () {
        showInfoSoilsBorn(p);
        showBottomChartSoilsBorn(data);
        highlightBottomBars("ტიპი " + p.Soil_Geo);
      });
    },
  }).addTo(map);
  updateSoilsBornLegend();
  setInfoBtn("soils_born");
}

// ===== ნიადაგების ლეგენდები =====
var SOIL_LEGEND = [
  ["#AC8979", "შავმიწა"],
  ["#CDCD64", "შავი კარბონატული"],
  ["#8EAF78", "რუხი ყავისფერი მუქი"],
  ["#A7722A", "ყავისფერი"],
  ["#E48332", "ყომრალი არამაძღარი"],
  ["#D88D49", "ყავისფერი კარბონატული"],
  ["#B5D69E", "კორდიან კარბონატული"],
  ["#D8D89E", "მთა-მდელოს"],
  ["#A0D4A8", "მთა-მდელოს პრიმიტიული"],
  ["#E48F24", "ყავისფერი გამოტუტული"],
  ["#FFF3CA", "ძლიერ ჩამორეცხილი ნიადაგები და ქანების გაშიშვლებები"],
  ["#4ABA7F", "მდელოს ყავისფერი"],
  ["#F287B7", "ბიცობი"],
  ["#CECCCA", "ანდოსოლები"],
  ["#F9F9D8", "მთა-მდელოს შავმიწისებრი"],
  ["#AA3D2B", "მდელოს შავი"],
  ["#D7B09E", "მლაშობი"],
  ["#B0D236", "ალუვიური კარბონატული"],
  ["#C4BF89", "შავმიწა გამოტუტული"],
  ["#F3EF91", "ყომრალ შავი"],
  ["#9ACC67", "მდელოს რუხი-ყავისფერი"],
];

var BORN_LEGEND = [
  ["3", "#DE9797", "ვულკანოგენები (ანდეზიტები, ანდეზიტ-ბაზალტები) და დანალექი ქანები (ქვიშაქვები, თიხა-ფიქლები და ს"],
  ["4", "#E2B588", "ლიოსები, ლიოსისებრი თიხნარები, თიხა-ფიქლები და სხვა"],
  ["6", "#E0EFD8", "ალევროლითური, კოლუვიური ნალექები (ვიშაქვები, ქვარგვალები, თიხები)"],
  ["2", "#ECCE96", "კარბონატული ქანები (კირქვები, მერგელები) ვულკანოგენებით"],
  ["1", "#F1BCCB", "მჟავე ქანები-გრანიტები, გრანოდიორიტები, ვულკანოგენები კვარციტები და სხვა"],
  ["5", "#A3BA97", "ახალგაზრდა ლავები (ანდეზიტები, ბაზალტები, დოლერიტები)"],
];

function updateSoilsLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div class="section-title">ნიადაგის ტიპები</div>';
  html += '<div class="ethnics-legend">';
  SOIL_LEGEND.forEach(function (item) {
    html +=
      '<div class="legend-item" style="margin-bottom:3px;">' +
      '<span style="display:inline-block;width:14px;height:14px;background:' +
      item[0] +
      ';border:1px solid #aaa;flex-shrink:0;margin-right:5px;vertical-align:middle;"></span>' +
      '<span style="font-size:10px;vertical-align:middle;">' +
      item[1] +
      "</span></div>";
  });
  html += "</div>";
  el.innerHTML = html;
}

function updateSoilsBornLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div class="section-title">ნიადაგ-წარმომქმნელი ქანები</div>';
  html += '<div class="ethnics-legend">';
  BORN_LEGEND.forEach(function (item) {
    html +=
      '<div class="legend-item" style="margin-bottom:3px;">' +
      '<span style="display:inline-block;width:14px;height:14px;background:' +
      item[1] +
      ';border:1px solid #aaa;flex-shrink:0;margin-right:5px;vertical-align:middle;"></span>' +
      '<span style="font-size:10px;vertical-align:middle;"><b>' +
      item[0] +
      "</b> — " +
      item[2] +
      "</span></div>";
  });
  html += "</div>";
  el.innerHTML = html;
}

// ============================================================
// გეოლოგია და სასარგებლო წიაღისეული
// ============================================================

var GEO_SVG_SYMBOLS = {
  andeziti: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg"
	 viewBox="0 0 11.04 13.6">
<g>
	<rect x="1.02" y="2.3" style="fill:#FAA646;" width="9" height="9"/>
	<rect x="1.02" y="2.3" style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" width="9" height="9"/>
	<polygon style="fill:#FFFFFF;" points="6.73,7.52 7.47,9.81 5.52,8.39 3.57,9.81 4.31,7.51 2.36,6.09 4.77,6.09 5.52,3.79 6.27,6.09 
		8.69,6.09 	"/>
	<polygon style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" points="6.73,7.52 7.47,9.81 5.52,8.39 3.57,9.81 4.31,7.51 2.36,6.09 4.77,6.09 5.52,3.79 6.27,6.09 
		8.69,6.09 	"/>
</g>
</svg>`,
  aqati: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg"
	 viewBox="0 0 11.04 13.6">
<g>
	<rect x="1.02" y="2.3" style="fill:#FFFFFF;" width="9" height="9"/>
	<rect x="1.02" y="2.3" style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" width="9" height="9"/>
	<polygon style="fill:#5DBB59;" points="9.46,5.78 7.95,10.73 3.09,10.73 1.58,5.78 5.52,2.73 	"/>
	<polygon style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" points="9.46,5.78 7.95,10.73 3.09,10.73 1.58,5.78 5.52,2.73 	"/>
</g>
</svg>`,
  bariti: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg"
	 viewBox="0 0 11.04 13.6">
<g>
	<rect x="1.02" y="2.3" style="fill:#FFFFFF;stroke:#000000;stroke-width:0.2;stroke-miterlimit:10;" width="9" height="9"/>
	<polygon style="fill:#5DBB59;" points="9.96,11.3 1.08,11.3 5.58,2.41 	"/>
	<polygon style="fill:none;stroke:#000000;stroke-width:0.2;stroke-miterlimit:10;" points="9.96,11.3 1.08,11.3 5.58,2.53 	"/>
</g>
</svg>`,
  bazalti: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg"
	 viewBox="0 0 11.04 13.6">
<g>
	<rect x="1.02" y="2.3" style="fill:#FAA646;" width="9" height="9"/>
	<rect x="1.02" y="2.3" style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" width="9" height="9"/>
	<polygon style="fill:#FFFFFF;" points="10.02,10.84 10.02,2.76 5.92,6.79 	"/>
	<polygon style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" points="10.02,10.84 10.02,2.76 5.92,6.79 	"/>
	<polygon style="fill:#FFFFFF;" points="1.02,10.84 5.12,6.79 1.02,2.76 	"/>
	<polygon style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" points="1.02,10.84 5.12,6.79 1.02,2.76 	"/>
</g>
</svg>`,
  diabazi: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg"
	 viewBox="0 0 11.04 13.6">
<g>
	<rect x="1.01" y="2.29" style="fill:#FAA646;" width="9.01" height="9.02"/>
	<rect x="1.01" y="2.29" style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" width="9.01" height="9.02"/>
	<line style="fill:none;stroke:#000000;stroke-width:0.589;stroke-miterlimit:10;" x1="1.01" y1="6.8" x2="10.03" y2="6.8"/>
</g>
</svg>`,
  faifuris_qva: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg"
	 viewBox="0 0 11.04 13.6">
<g>
	<rect x="1.02" y="2.31" style="fill:#FFFFFF;stroke:#000000;stroke-width:0.2;stroke-miterlimit:10;" width="9" height="9"/>
	<polygon style="fill:#5DBB59;" points="5.58,10.96 1.08,2.3 9.96,2.3 	"/>
	<polygon style="fill:none;stroke:#000000;stroke-width:0.2;stroke-miterlimit:10;" points="5.58,10.96 1.08,2.3 9.96,2.3 	"/>
</g>
</svg>`,
  gabro: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg"
	 viewBox="0 0 11.04 13.6">
<g>
	<rect x="1.02" y="2.3" style="fill:#FFFFFF;" width="9" height="9"/>
	<rect x="1.02" y="2.3" style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" width="9" height="9"/>
	<rect x="5.64" y="6.92" style="fill:#FAA646;" width="4.38" height="4.38"/>
	<rect x="5.64" y="6.92" style="fill:none;stroke:#000000;stroke-width:0.25;stroke-miterlimit:10;" width="4.38" height="4.38"/>
	<rect x="1.02" y="2.3" style="fill:#FAA646;" width="4.38" height="4.38"/>
	<rect x="1.02" y="2.3" style="fill:none;stroke:#000000;stroke-width:0.25;stroke-miterlimit:10;" width="4.38" height="4.38"/>
</g>
</svg>`,
  gaji: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg"
	 viewBox="0 0 11.04 13.6">
<g>
	<rect x="1.02" y="2.3" style="fill:#B73092;" width="9" height="9"/>
	<rect x="1.02" y="2.3" style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" width="9" height="9"/>
	<polygon style="fill:#FFFFFF;" points="1.48,11.3 9.56,11.3 5.53,7.2 	"/>
	<polygon style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" points="1.48,11.3 9.56,11.3 5.53,7.2 	"/>
	<polygon style="fill:#FFFFFF;" points="1.48,2.3 5.53,6.4 9.56,2.3 	"/>
	<polygon style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" points="1.48,2.3 5.53,6.4 9.56,2.3 	"/>
</g>
</svg>`,
  gamarmariloebuli_kirqva: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg"
	 viewBox="0 0 11.04 13.6">
<g>
	<rect x="1.04" y="2.3" style="fill:#FAA646;" width="8.96" height="9"/>
	<rect x="1.04" y="2.3" style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" width="8.97" height="9"/>
	<rect x="1.02" y="5.42" style="fill:#FFFFFF;" width="9" height="2.75"/>
	<rect x="1.04" y="5.42" style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" width="8.96" height="2.75"/>
</g>
</svg>`,
  graniti: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg"
	 viewBox="0 0 11.04 13.6">
<g>
	<rect x="1.02" y="2.3" style="fill:#FAA646;" width="9" height="9"/>
	<rect x="1.02" y="2.3" style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" width="9" height="9"/>
</g>
</svg>`,
  kirqva: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg"
	 viewBox="0 0 11.04 13.6">
<g>
	<rect x="1.02" y="2.3" style="fill:#FFFFFF;" width="9" height="9"/>
	<rect x="1.02" y="2.3" style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" width="9" height="9"/>
	<polygon style="fill:#B73292;" points="6.65,6.78 9.84,9.98 8.69,11.14 5.49,7.94 2.33,11.1 1.2,9.96 4.35,6.81 1.22,3.67 2.37,2.51 
		5.51,5.64 8.69,2.46 9.83,3.6 	"/>
	<polygon style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" points="6.65,6.78 9.84,9.98 8.69,11.14 5.49,7.94 2.33,11.1 1.2,9.96 4.35,6.81 1.22,3.67 2.37,2.51 
		5.51,5.64 8.69,2.46 9.83,3.6 	"/>
</g>
</svg>`,
  litografiuli_qva: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg"
	 viewBox="0 0 11.04 13.6">
<g>
	<rect x="1.02" y="2.3" style="fill:#5DBB59;" width="9" height="9"/>
	<rect x="1.02" y="2.3" style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" width="9" height="9"/>
	<polygon style="fill:#FFFFFF;" points="1.02,2.76 1.02,10.84 5.12,6.81 	"/>
	<polygon style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" points="1.02,2.76 1.02,10.84 5.12,6.81 	"/>
	<polygon style="fill:#FFFFFF;" points="10.02,2.76 5.92,6.81 10.02,10.84 	"/>
	<polygon style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" points="10.02,2.76 5.92,6.81 10.02,10.84 	"/>
</g>
</svg>`,
  navtobi: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg"
	 viewBox="0 0 7.87 13.6">
<g>
	<polygon style="stroke:#010101;stroke-width:0.5;stroke-miterlimit:10;" points="7.05,12.85 0.8,12.85 3.92,1.45 	"/>
	<polygon style="fill:#FFFFFF;" points="3.92,12.85 3.92,1.45 7.05,12.85 	"/>
</g>
</svg>`,
  oqro: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg"
	 viewBox="0 0 11.04 13.6">
<g>
	<path d="M10.81,6.8c0,0.74-0.14,1.43-0.41,2.07c-0.28,0.64-0.66,1.2-1.14,1.68c-0.48,0.48-1.05,0.86-1.69,1.14
		c-0.65,0.28-1.33,0.41-2.06,0.41c-0.74,0-1.43-0.14-2.07-0.41c-0.64-0.28-1.2-0.66-1.68-1.14c-0.48-0.48-0.85-1.05-1.13-1.68
		C0.36,8.23,0.22,7.54,0.22,6.8c0-0.73,0.14-1.41,0.41-2.06C0.91,4.1,1.28,3.53,1.76,3.05C2.24,2.56,2.8,2.19,3.44,1.91
		C4.08,1.63,4.77,1.5,5.51,1.5c0.73,0,1.41,0.14,2.06,0.41c0.64,0.28,1.21,0.66,1.69,1.14c0.48,0.48,0.86,1.05,1.14,1.69
		C10.67,5.39,10.81,6.07,10.81,6.8"/>
	<path style="fill:#EF3634;" d="M7.45,2.12c0.16,0,0.3,0.05,0.42,0.16c0.11,0.1,0.17,0.23,0.17,0.39v8.27c0,0.15-0.06,0.28-0.17,0.39
		c-0.12,0.1-0.25,0.16-0.42,0.16H3.59c-0.16,0-0.3-0.05-0.42-0.15c-0.12-0.1-0.18-0.23-0.18-0.39V2.66c0-0.16,0.06-0.29,0.18-0.39
		c0.12-0.1,0.26-0.15,0.42-0.15H7.45z"/>
</g>
</svg>`,
  qvisha_xreshi: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg"
	 viewBox="0 0 11.04 13.6">
<g>
	<rect x="1.02" y="2.3" style="fill:#B73292;" width="9" height="9"/>
	<rect x="1.02" y="2.3" style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" width="9" height="9"/>
	<g>
		<circle style="fill:#FFFFFF;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" cx="5.52" cy="4.13" r="1.13"/>
		<circle style="fill:#FFFFFF;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" cx="5.52" cy="9.42" r="1.13"/>
		<circle style="fill:#FFFFFF;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" cx="8.09" cy="6.8" r="1.13"/>
		<circle style="fill:#FFFFFF;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" cx="2.83" cy="6.8" r="1.13"/>
	</g>
</g>
</svg>`,
  qvishaqva: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg"
	 viewBox="0 0 11.04 13.6">
<g>
	<rect x="1.02" y="2.3" style="fill:#B73092;" width="9" height="9"/>
	<rect x="1.02" y="2.3" style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" width="9" height="9"/>
	<rect x="1.01" y="4.73" style="fill:#FFFFFF;" width="9.03" height="4.13"/>
	<rect x="1.02" y="4.73" style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" width="9" height="4.13"/>
</g>
</svg>`,
  rkina: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg"
	 viewBox="0 0 11.04 13.6">
<g>
	<path d="M10.66,6.8c0,0.72-0.13,1.39-0.4,2.01c-0.27,0.62-0.64,1.17-1.11,1.64c-0.47,0.47-1.02,0.84-1.64,1.11
		c-0.62,0.27-1.29,0.4-2,0.4c-0.72,0-1.38-0.13-2-0.4c-0.62-0.27-1.16-0.64-1.63-1.11c-0.47-0.47-0.83-1.01-1.1-1.64
		c-0.27-0.62-0.4-1.29-0.4-2.01c0-0.71,0.13-1.37,0.4-2c0.27-0.63,0.63-1.17,1.1-1.64c0.46-0.47,1.01-0.84,1.63-1.1
		c0.62-0.27,1.29-0.4,2-0.4c0.71,0,1.37,0.13,2,0.4c0.63,0.27,1.17,0.64,1.64,1.1c0.47,0.47,0.84,1.02,1.11,1.64
		C10.53,5.43,10.66,6.09,10.66,6.8"/>
	<polygon style="fill:#EF3634;" points="1.33,9.51 5.6,1.71 9.71,9.51 	"/>
</g>
</svg>`,
  saagure_tixa: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg"
	 viewBox="0 0 11.04 13.6">
<g>
	<rect x="1.02" y="2.3" style="fill:#B73092;" width="9" height="9"/>
	<rect x="1.02" y="2.3" style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" width="9" height="9"/>
</g>
</svg>`,
  sacemente_masala: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg"
	 viewBox="0 0 11.04 13.6">
<g>
	<rect x="1.02" y="2.3" style="fill:#B73092;" width="9" height="9"/>
	<rect x="1.02" y="2.3" style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" width="9" height="9"/>
	<rect x="1.01" y="4.73" style="fill:#FFFFFF;" width="9.03" height="4.13"/>
	<rect x="1.02" y="4.73" style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" width="9" height="4.13"/>
</g>
</svg>`,
  spilendzi: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg"
	 viewBox="0 0 11.04 13.6">
<g>
	<path d="M5.52,12.09c-0.74,0-1.43-0.14-2.07-0.41c-0.64-0.28-1.2-0.66-1.68-1.14C1.29,10.06,0.91,9.5,0.63,8.85
		C0.35,8.21,0.22,7.52,0.22,6.79c0-0.74,0.14-1.43,0.41-2.07c0.28-0.64,0.66-1.2,1.14-1.68C2.25,2.57,2.81,2.2,3.45,1.92
		c0.64-0.27,1.33-0.41,2.07-0.41c0.73,0,1.41,0.14,2.06,0.41C8.23,2.2,8.79,2.57,9.27,3.05c0.48,0.48,0.86,1.04,1.14,1.68
		c0.28,0.64,0.41,1.33,0.41,2.07c0,0.73-0.14,1.41-0.41,2.06c-0.28,0.64-0.66,1.21-1.14,1.69c-0.48,0.48-1.05,0.86-1.69,1.14
		C6.94,11.96,6.25,12.09,5.52,12.09"/>
	<path style="fill:#EF3634;" d="M10.2,8.74c0,0.16-0.05,0.3-0.16,0.42c-0.1,0.11-0.23,0.17-0.39,0.17H1.39C1.23,9.32,1.1,9.27,1,9.15
		C0.9,9.04,0.84,8.9,0.84,8.74V4.88c0-0.16,0.05-0.3,0.15-0.42c0.1-0.12,0.23-0.18,0.39-0.18h8.27c0.16,0,0.29,0.06,0.39,0.18
		c0.1,0.12,0.15,0.26,0.15,0.42V8.74z"/>
</g>
</svg>`,
  torfi: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg"
	 viewBox="0 0 11.04 13.6">
<g>
	<path d="M10.79,9.35c0,0.13-0.07,0.23-0.2,0.31c-0.13,0.07-0.27,0.11-0.41,0.11h-9.3c-0.14,0-0.28-0.04-0.41-0.11
		c-0.13-0.08-0.2-0.18-0.2-0.31V6.7c0-0.27,0.2-0.41,0.6-0.41h9.3c0.4,0,0.6,0.14,0.6,0.41V9.35z"/>
	<path d="M7.63,6.53c0,0.07-0.02,0.13-0.07,0.19c-0.05,0.05-0.1,0.08-0.17,0.08H3.68c-0.07,0-0.13-0.03-0.17-0.08
		C3.46,6.66,3.43,6.6,3.43,6.53V4.8c0-0.07,0.02-0.14,0.07-0.19c0.04-0.05,0.1-0.08,0.18-0.08h3.71c0.07,0,0.13,0.03,0.18,0.08
		C7.6,4.66,7.63,4.72,7.63,4.8V6.53z"/>
</g>
</svg>`,
  tufi: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg"
	 viewBox="0 0 11.04 13.6">
<g>
	<rect x="0.95" y="2.37" transform="matrix(0.7071 -0.7071 0.7071 0.7071 -3.2601 5.8677)" style="fill:#FAA646;" width="9" height="9"/>
	<rect x="0.95" y="2.37" transform="matrix(0.7071 -0.7071 0.7071 0.7071 -3.2601 5.8677)" style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" width="9" height="9"/>
	<rect x="4.93" y="0.64" transform="matrix(0.7071 -0.7071 0.7071 0.7071 -1.5312 6.5836)" style="fill:#FFFFFF;" width="4.5" height="9"/>
	<rect x="4.93" y="0.64" transform="matrix(0.7071 -0.7071 0.7071 0.7071 -1.5312 6.5836)" style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" width="4.5" height="9"/>
</g>
</svg>`,
  vercxli: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg"
	 viewBox="0 0 11.04 13.6">
<g>
	<path style="fill:#EA2E33;" d="M8.7,3.62C9.14,4.05,9.47,4.55,9.69,5.1c0.22,0.55,0.33,1.12,0.33,1.7c0,0.58-0.11,1.14-0.33,1.7
		C9.47,9.05,9.14,9.54,8.7,9.98c-0.44,0.44-0.93,0.77-1.49,0.99c-0.55,0.22-1.12,0.33-1.7,0.33c-0.57,0-1.14-0.11-1.69-0.33
		c-0.56-0.22-1.05-0.55-1.49-0.98C1.9,9.55,1.57,9.05,1.35,8.5C1.13,7.94,1.02,7.38,1.02,6.8c0-0.58,0.11-1.14,0.33-1.7
		C1.58,4.55,1.9,4.06,2.34,3.62c0.44-0.44,0.93-0.76,1.49-0.98C4.38,2.41,4.95,2.3,5.52,2.3c0.58,0,1.14,0.11,1.7,0.33
		S8.27,3.18,8.7,3.62"/>
	<path style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" d="M8.7,3.62C9.14,4.05,9.47,4.55,9.69,5.1c0.22,0.55,0.33,1.12,0.33,1.7c0,0.58-0.11,1.14-0.33,1.7
		C9.47,9.05,9.14,9.54,8.7,9.98c-0.44,0.44-0.93,0.77-1.49,0.99c-0.55,0.22-1.12,0.33-1.7,0.33c-0.57,0-1.14-0.11-1.69-0.33
		c-0.56-0.22-1.05-0.55-1.49-0.98C1.9,9.55,1.57,9.05,1.35,8.5C1.13,7.94,1.02,7.38,1.02,6.8c0-0.58,0.11-1.14,0.33-1.7
		C1.58,4.55,1.9,4.06,2.34,3.62c0.44-0.44,0.93-0.76,1.49-0.98C4.38,2.41,4.95,2.3,5.52,2.3c0.58,0,1.14,0.11,1.7,0.33
		S8.27,3.18,8.7,3.62z"/>
	<line style="fill:none;stroke:#000000;stroke-width:0.731;stroke-linecap:round;stroke-miterlimit:10;" x1="2.63" y1="3.88" x2="8.45" y2="9.7"/>
	<line style="fill:none;stroke:#000000;stroke-width:0.731;stroke-linecap:round;stroke-miterlimit:10;" x1="1.31" y1="6.42" x2="5.89" y2="11"/>
	<line style="fill:none;stroke:#000000;stroke-width:0.731;stroke-linecap:round;stroke-miterlimit:10;" x1="5.18" y1="2.56" x2="9.76" y2="7.14"/>
</g>
</svg>`,
  vulkanuri_ferfli: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg"
	 viewBox="0 0 11.04 13.6">
<g>
	<rect x="1.02" y="2.3" transform="matrix(0.7071 -0.7071 0.7071 0.7071 -3.1911 5.8961)" style="fill:#5DBB59;" width="9" height="9"/>
	<rect x="1.02" y="2.3" transform="matrix(0.7071 -0.7071 0.7071 0.7071 -3.1911 5.8961)" style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" width="9" height="9"/>
</g>
</svg>`,
  zeoliti: `<svg version="1.1" xmlns="http://www.w3.org/2000/svg"
	 viewBox="0 0 11.04 13.6">
<g>
	<rect x="1.02" y="2.3" transform="matrix(0.7072 -0.707 0.707 0.7072 -3.191 5.8954)" style="fill:#5DBB59;" width="9" height="9"/>
	<rect x="1.02" y="2.3" transform="matrix(0.7072 -0.707 0.707 0.7072 -3.191 5.8954)" style="fill:none;stroke:#000000;stroke-width:0.3;stroke-miterlimit:10;" width="9" height="9"/>
	<rect x="5.01" y="0.99" style="fill:#FFFFFF;" width="1.02" height="11.61"/>
	<rect x="5.01" y="0.99" style="fill:none;stroke:#000000;stroke-width:0.2;stroke-miterlimit:10;" width="1.02" height="11.61"/>
</g>
</svg>`,
};

var geologyLayer = null;

var foultsLayer = null;

var metalOreLayer = null;

var nonmetalOreLayer = null;

var oilGasLayer = null;

var geologyData = null;

var foultsData = null;

// წიაღისეულის საბადოები მუნიციპალიტეტების მიხედვით (ლითონური / არალითონური / ნავთობი და გაზი)
function showBottomChartMinerals() {
  var ctx = prepareBottomChart();
  var groups = [
    { data: metalOreData, label: "ლითონური", color: "#B5651D" },
    { data: nonmetalOreData, label: "არალითონური", color: "#7A8B99" },
    { data: oilGasData, label: "ნავთობი და გაზი", color: "#2C2C2C" },
  ];
  var counts = {};
  groups.forEach(function (g, gi) {
    ((g.data && g.data.features) || []).forEach(function (f) {
      var m = muniName(f.properties.raioni) || f.properties.raioni || "–";
      counts[m] = counts[m] || [0, 0, 0];
      counts[m][gi]++;
    });
  });
  var munis = Object.keys(counts).sort(function (a, b) {
    var sa = counts[a][0] + counts[a][1] + counts[a][2];
    var sb = counts[b][0] + counts[b][1] + counts[b][2];
    return sb - sa;
  });
  var total = munis.reduce(function (t, m) {
    return t + counts[m][0] + counts[m][1] + counts[m][2];
  }, 0);

  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: munis,
      datasets: groups.map(function (g, gi) {
        return {
          label: g.label,
          // 0 → null: ცარიელი ადგილი არ ტოვდება და სვეტები წარწერის ქვეშ ცენტრდება
          data: munis.map(function (m) {
            return counts[m][gi] || null;
          }),
          backgroundColor: g.color + "CC",
          borderColor: g.color,
          borderWidth: 1,
          borderRadius: 3,
          minBarLength: 4, // მცირე რიცხვიც (მაგ. 2 საბადო) რომ გამოჩნდეს
          maxBarThickness: 36, // ერთი სვეტიც ისეთივე სიგანის იყოს, როგორც სხვები
          categoryPercentage: 0.45, // ერთი მუნიციპალიტეტის სვეტები ერთმანეთთან ახლოს
          barPercentage: 0.9,
        };
      }),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      skipNull: true,
      plugins: {
        legend: { display: true,
          position: "top",
          labels: { font: { size: 10 }, boxWidth: 10 },
        },
        title: {
          display: true,
          text: "წიაღისეულის საბადოები მუნიციპალიტეტების მიხედვით — სულ " + total,
          font: { size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 4 },
        },
      },
      scales: {
        x: {
          ticks: { font: { size: 11, weight: "500" } },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: { precision: 0, font: { size: 10 } },
        },
      },
    },
  });
}

var metalOreData = null;

var nonmetalOreData = null;

var oilGasData = null;

function geoMineralIcon(symbolKey) {
  var svg = GEO_SVG_SYMBOLS[symbolKey] || GEO_SVG_SYMBOLS["kirqva"];
  // inject width/height directly into SVG tag since classes are already scoped
  var sized = svg.replace("<svg ", '<svg width="22" height="27" ');
  if (symbolKey === "navtobi") {
    sized = svg.replace("<svg ", '<svg width="16" height="27" ');
  }
  return L.divIcon({
    html: sized,
    iconSize: [22, 27],
    iconAnchor: [11, 14],
    className: "",
  });
}

function loadGeology() {
  loadDataAll(
    [
      "data/geology.geojson",
      "data/foults.geojson",
      "data/metal_ore.geojson",
      "data/nonmetal_ore.geojson",
      "data/oil_gas.geojson",
    ],
    function (d) {
      geologyData = d[0];
      foultsData = d[1];
      metalOreData = d[2];
      nonmetalOreData = d[3];
      oilGasData = d[4];
      renderGeologyLayers();
    },
  );
}

function renderGeologyLayers() {
  // ---- 1. გეოლოგიური პოლიგონები ----
  clearLayer(geologyLayer);
  geologyLayer = L.geoJSON(geologyData, {
    style: function (feat) {
      return {
        fillColor: feat.properties.Color,
        fillOpacity: 0.65,
        color: "#888",
        weight: 0.6,
        opacity: 0.8,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;

      var _tip = p.Index || "";
      if (_tip)
        areaTooltip(layer, _tip);
      layer.on("click", function () {
        showInfoGeology(p);
        showBottomChartGeology(geologyData);
        highlightBottomBars(p.Index);
      });
      layer.on("mouseover", function () {
        layer.setStyle({ weight: 1.5, fillOpacity: 0.85 });
      });
      layer.on("mouseout", function () {
        geologyLayer.resetStyle(layer);
      });
    },
  }).addTo(map);

  // ---- 2. რღვევები (Foults) ----
  clearLayer(foultsLayer);
  foultsLayer = L.geoJSON(foultsData, {
    style: function () {
      return { color: "#CC0000", weight: 2, opacity: 0.8, dashArray: "6,3" };
    },
  }).addTo(map);

  // ---- 3. ლითონური წიაღისეული ----
  clearLayer(metalOreLayer);
  metalOreLayer = L.geoJSON(metalOreData, {
    pointToLayer: function (feat, latlng) {
      var p = feat.properties;
      var marker = L.marker(latlng, {
        icon: geoMineralIcon(p.symbol),
        zIndexOffset: 500,
      });
      pointTooltip(marker, p.Name_Geo + " (" + p.Type_Geo + ")", -27);
      marker.on("click", function () {
        showInfoCard('<div class="info-title">' +
          (p.Name_Geo || "") +
          "</div>" +
          '<div class="info-row"><span class="info-label">სახეობა:</span><span class="info-value">' +
          (p.Type_Geo || "-") +
          "</span></div>" +
          '<div class="info-row"><span class="info-label">მუნიციპალიტეტი:</span><span class="info-value">' +
          (p.raioni || "-") +
          "</span></div>");
        showBottomChartMinerals();
        highlightBottomBars(muniName(p.raioni), 0);
      });
      return marker;
    },
  }).addTo(map);

  // ---- 4. არალითონური წიაღისეული ----
  clearLayer(nonmetalOreLayer);
  nonmetalOreLayer = L.geoJSON(nonmetalOreData, {
    pointToLayer: function (feat, latlng) {
      var p = feat.properties;
      var marker = L.marker(latlng, {
        icon: geoMineralIcon(p.symbol),
        zIndexOffset: 400,
      });
      pointTooltip(marker, p.Name_Geo + " (" + p.Type_Geo + ")", -27);
      marker.on("click", function () {
        showInfoCard('<div class="info-title">' +
          (p.Name_Geo || "") +
          "</div>" +
          '<div class="info-row"><span class="info-label">სახეობა:</span><span class="info-value">' +
          (p.Type_Geo || "-") +
          "</span></div>" +
          '<div class="info-row"><span class="info-label">გამოყენება:</span><span class="info-value">' +
          (p.Use_Geo || "-") +
          "</span></div>" +
          '<div class="info-row"><span class="info-label">მუნიციპალიტეტი:</span><span class="info-value">' +
          (p.raioni || "-") +
          "</span></div>");
        showBottomChartMinerals();
        highlightBottomBars(muniName(p.raioni), 1);
      });
      return marker;
    },
  }).addTo(map);

  // ---- 5. ნავთობი და გაზი ----
  clearLayer(oilGasLayer);
  oilGasLayer = L.geoJSON(oilGasData, {
    pointToLayer: function (feat, latlng) {
      var p = feat.properties;
      var marker = L.marker(latlng, {
        icon: geoMineralIcon("navtobi"),
        zIndexOffset: 600,
      });
      pointTooltip(marker, p.Name_Geo, -27);
      marker.on("click", function () {
        showInfoCard('<div class="info-title">' +
          (p.Name_Geo || "") +
          "</div>" +
          '<div class="info-row"><span class="info-label">სახეობა:</span><span class="info-value">' +
          (p.Type_Geo || "-") +
          "</span></div>" +
          '<div class="info-row"><span class="info-label">მუნიციპალიტეტი:</span><span class="info-value">' +
          (p.raioni || "-") +
          "</span></div>");
        showBottomChartMinerals();
        highlightBottomBars(muniName(p.raioni), 2);
      });
      return marker;
    },
  }).addTo(map);

  updateGeologyLegend();
  loadNatureMuniCenters();
  setInfoBtn("geology");
}

function updateGeologyLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;

  // Geology polygon colors
  var geoIndexes = {};
  if (geologyData)
    geologyData.features.forEach(function (f) {
      var p = f.properties;
      geoIndexes[p.Index] = {
        color: p.Color,
        name: p.Name_Eng ? p.Name_Eng.split(",")[0] : p.Index,
      };
    });

  // Mineral symbols used
  var metalSyms = {};
  var nonMetSyms = {};
  if (metalOreData)
    metalOreData.features.forEach(function (f) {
      metalSyms[f.properties.symbol] = f.properties.Type_Geo;
    });
  if (nonmetalOreData)
    nonmetalOreData.features.forEach(function (f) {
      nonMetSyms[f.properties.symbol] = f.properties.Type_Geo;
    });

  var geoNamesMap = {
    andeziti: "ანდეზიტი",
    aqati: "აქატი",
    bariti: "ბარიტი",
    bazalti: "ბაზალტი",
    diabazi: "დიაბაზი",
    faifuris_qva: "ფაიფურის ქვა",
    gabro: "გაბრო",
    gaji: "გაჯი",
    gamarmariloebuli_kirqva: "გამარმ. კირქვა",
    graniti: "გრანიტი",
    kirqva: "კირქვა",
    litografiuli_qva: "ლითოგრ. ქვა",
    navtobi: "ნავთობი და გაზი",
    oqro: "ოქრო",
    qvisha_xreshi: "ქვიშა-ხრეში",
    qvishaqva: "ქვიშაქვა",
    rkina: "რკინა",
    saagure_tixa: "სააგ. თიხა",
    sacemente_masala: "საცემ. მასალა",
    spilendzi: "სპილენძი",
    torfi: "ტორფი",
    tufi: "ტუფი",
    vercxli: "ვერცხლი",
    vulkanuri_ferfli: "ვულკ. ფერფლი",
    zeoliti: "ცეოლითი",
  };

  var html =
    '<div class="section-title">ამგები ქანების ასაკი</div>';
  html += '<div class="ethnics-legend">';
  Object.keys(geoIndexes)
    .sort()
    .forEach(function (idx) {
      var info = geoIndexes[idx];
      html +=
        '<div class="legend-item" style="margin-bottom:3px;">' +
        '<span style="display:inline-block;width:14px;height:14px;background:' +
        info.color +
        ';border:1px solid #aaa;flex-shrink:0;margin-right:5px;vertical-align:middle;"></span>' +
        '<span style="font-size:10px;vertical-align:middle;"><b>' +
        idx +
        "</b></span>" +
        "</div>";
    });
  html += "</div>";

  html +=
    '<div class="section-title" style="margin-top:8px;">ლითონური წიაღისეული</div>';
  html += '<div class="ethnics-legend">';
  Object.keys(metalSyms)
    .sort()
    .forEach(function (sym) {
      var svgSmall = (GEO_SVG_SYMBOLS[sym] || "").replace(
        "<svg ",
        '<svg width="14" height="17" ',
      );
      html +=
        '<div class="legend-item" style="margin-bottom:3px;align-items:center;">' +
        '<span style="display:inline-block;width:14px;height:17px;margin-right:5px;vertical-align:middle;flex-shrink:0;">' +
        svgSmall +
        "</span>" +
        '<span style="font-size:10px;vertical-align:middle;">' +
        (geoNamesMap[sym] || sym) +
        "</span></div>";
    });
  html += "</div>";

  html +=
    '<div class="section-title" style="margin-top:8px;">არალითონური</div>';
  html += '<div class="ethnics-legend">';
  Object.keys(nonMetSyms)
    .sort()
    .forEach(function (sym) {
      var svgSmall = (GEO_SVG_SYMBOLS[sym] || "").replace(
        "<svg ",
        '<svg width="14" height="17" ',
      );
      html +=
        '<div class="legend-item" style="margin-bottom:3px;align-items:center;">' +
        '<span style="display:inline-block;width:14px;height:17px;margin-right:5px;vertical-align:middle;flex-shrink:0;">' +
        svgSmall +
        "</span>" +
        '<span style="font-size:10px;vertical-align:middle;">' +
        (geoNamesMap[sym] || sym) +
        "</span></div>";
    });
  // navtobi
  var navSvg = (GEO_SVG_SYMBOLS["navtobi"] || "").replace(
    "<svg ",
    '<svg width="11" height="17" ',
  );
  html +=
    '<div class="legend-item" style="margin-bottom:3px;align-items:center;">' +
    '<span style="display:inline-block;width:14px;height:17px;margin-right:5px;vertical-align:middle;flex-shrink:0;">' +
    navSvg +
    "</span>" +
    '<span style="font-size:10px;vertical-align:middle;">ნავთობი და გაზი</span></div>';
  html += "</div>";

  // Foult line
  html +=
    '<div class="legend-item" style="margin-top:6px;align-items:center;">' +
    '<span style="display:inline-block;width:24px;height:3px;background:#CC0000;margin-right:5px;border-top:2px dashed #CC0000;"></span>' +
    '<span style="font-size:10px;">რღვევა</span></div>';

  el.innerHTML = html;
}
