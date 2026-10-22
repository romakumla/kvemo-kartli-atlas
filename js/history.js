// ისტორია: არქეოლოგია, ბრძოლები, გერმანელთა დასახლებები, თავდაცვითი ნაგებობები, ეპარქიები, ეკლესიები, პეტროგლიფები, მეგალითები
// Part of the atlas script, split from the former js/main.js. Files are loaded in
// order by index.html; theme files only define things, their start-up code is
// in initHistory(), called from app.js once every file is loaded.


// ===== Population checkbox — მთავარი toggle =====

// ============================================================
// ისტორია — არქეოლოგია
// ============================================================
var archLayer = null;

var archData = null;

var ARCH_TYPES = [
  { num: 1, color: "#5C3D1E", label: "პალეოლითი და მეზოლითი" },
  { num: 2, color: "#B87333", label: "ნეოლითი და ხალკოლითი" },
  { num: 3, color: "#C41E3A", label: "ადრე და შუა ბრინჯაო" },
  { num: 4, color: "#1E5799", label: "გვიანბრინჯაო - ადრე რკინა" },
  { num: 5, color: "#6A0DAD", label: "ანტიკური ხანა" },
  { num: 6, color: "#2D7A3D", label: "შუა საუკუნეები" },
];

function getArchColor(n) {
  var t = ARCH_TYPES.find(function (a) {
    return a.num === n;
  });
  return t ? t.color : "#888";
}

function loadArchaeology() {
  if (archData) {
    buildArchLayer(archData);
    loadNatureMuniCenters();
    return;
  }
  fetch("data/archeology.geojson")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      archData = d;
      buildArchLayer(d);
      loadNatureMuniCenters();
    });
}

function buildArchLayer(data) {
  if (archLayer) map.removeLayer(archLayer);
  archLayer = L.geoJSON(data, {
    pointToLayer: function (feat, latlng) {
      var p = feat.properties;
      var color = getArchColor(p.Type_Num);
      var marker = L.circleMarker(latlng, {
        radius: 7,
        fillColor: color,
        color: "#fff",
        weight: 1.5,
        fillOpacity: 0.88,
      });
      marker.bindTooltip(p.Name_Geo, {
        direction: "top",
        className: "village-label",
        offset: [0, -9],
      });
      marker.on("click", function () {
        showInfoArch(p);
        showBottomChartArch(data);
      });
      return marker;
    },
  }).addTo(map);
  updateArchLegend();
  setInfoBtn("archaeology");
}

function showInfoArch(p) {
  var color = getArchColor(p.Type_Num);
  var t = ARCH_TYPES.find(function (a) {
    return a.num === p.Type_Num;
  });
  var label = t ? t.label : "";
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name">' +
    p.Name_Geo +
    "</div>" +
    '<span class="info-type-badge" style="background:' +
    color +
    "22;color:" +
    color +
    ";border:1px solid " +
    color +
    '55;">' +
    label +
    "</span>" +
    '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);line-height:1.6;">' +
    (p.Type_Geo || "") +
    "</div>";
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartArch(data) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();
  var counts = {},
    colors = {};
  ARCH_TYPES.forEach(function (t) {
    counts[t.label] = 0;
    colors[t.label] = t.color;
  });
  data.features.forEach(function (f) {
    var t = ARCH_TYPES.find(function (a) {
      return a.num === f.properties.Type_Num;
    });
    if (t) counts[t.label]++;
  });
  var labels = ARCH_TYPES.map(function (t) {
    return t.label;
  });
  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "ძეგლები",
          data: labels.map(function (l) {
            return counts[l] || 0;
          }),
          backgroundColor: ARCH_TYPES.map(function (t) {
            return t.color + "CC";
          }),
          borderColor: ARCH_TYPES.map(function (t) {
            return t.color;
          }),
          borderWidth: 1.5,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "არქეოლოგიური ძეგლები პერიოდების მიხედვით",
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: {
            label: function (c) {
              return " " + c.parsed.y + " ძეგლი";
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, font: { family: "Fira Sans", size: 10, weight: "500" } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 11, weight: "500" }, maxRotation: 35 },
          grid: { display: false },
        },
      },
    },
  });
}

function updateArchLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">არქეოლოგიური ძეგლების წელთაღრიცხვა</div>';
  html += '<div class="ethnics-legend">';
  ARCH_TYPES.forEach(function (t) {
    html +=
      '<div class="eth-legend-item" style="margin-bottom:5px;">' +
      '<svg width="18" height="18" style="flex-shrink:0;margin-right:6px;">' +
      '<circle cx="9" cy="9" r="7" fill="' +
      t.color +
      '" stroke="#fff" stroke-width="1.5" opacity="0.88"/></svg>' +
      '<span style="font-size:10px;">' +
      t.label +
      "</span></div>";
  });
  html += "</div>";
  el.innerHTML = html;
}

// ============================================================
// ისტორია — ბრძოლები
// ============================================================
var battlesLayer = null;

var battlesData = null;

// SVG სიმბოლოები PDF-ის მიხედვით
var SVG_VICTORY =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9.81 9.11" width="24" height="24"><path fill="#E31E26" stroke="#010101" stroke-width="0.2" d="M0.93,0.35c0-0.05,0.04-0.09,0.09-0.09l0.74-0.03c0.07,0,0.16,0.03,0.2,0.07l5.84,5.78c0.13,0.13,0.13,0.36-0.02,0.5C7.65,6.72,7.41,6.95,7.27,7.1c-0.14,0.15-0.37,0.15-0.5,0.02L0.97,1.29C0.93,1.25,0.9,1.16,0.91,1.09L0.93,0.35z"/><rect fill="#E31E26" stroke="#010101" stroke-width="0.2" x="7.85" y="6.55" transform="matrix(0.7066 -0.7076 0.7076 0.7066 -2.9339 8.1272)" width="0.96" height="2.11"/><path fill="#E31E26" stroke="#010101" stroke-width="0.2" d="M8.87,0.35c0-0.05-0.04-0.09-0.09-0.09L8.04,0.23c-0.07,0-0.16,0.03-0.2,0.07L2,6.07C1.87,6.2,1.87,6.43,2.01,6.57C2.16,6.72,2.4,6.95,2.54,7.1c0.14,0.15,0.37,0.15,0.5,0.02l5.79-5.82C8.87,1.25,8.9,1.16,8.9,1.09L8.87,0.35z"/><rect fill="#E31E26" stroke="#010101" stroke-width="0.2" x="0.42" y="7.12" transform="matrix(0.7076 -0.7066 0.7066 0.7076 -4.9406 3.2625)" width="2.11" height="0.96"/></svg>';

var SVG_DEFEAT =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9.81 9.11" width="24" height="24"><path fill="#FCEE23" stroke="#010101" stroke-width="0.2" d="M0.93,0.3c0-0.05,0.04-0.09,0.09-0.09l0.74-0.03c0.07,0,0.16,0.03,0.2,0.07l5.84,5.78c0.13,0.13,0.13,0.36-0.02,0.5C7.65,6.67,7.41,6.91,7.27,7.05C7.12,7.2,6.89,7.2,6.77,7.07L0.97,1.24C0.93,1.2,0.9,1.11,0.91,1.04L0.93,0.3z"/><rect fill="#FCEE23" stroke="#010101" stroke-width="0.2" x="7.85" y="6.5" transform="matrix(0.7066 -0.7076 0.7076 0.7066 -2.9016 8.1138)" width="0.96" height="2.11"/><path fill="#FCEE23" stroke="#010101" stroke-width="0.2" d="M8.87,0.3c0-0.05-0.04-0.09-0.09-0.09L8.04,0.18c-0.07,0-0.16,0.03-0.2,0.07L2,6.02c-0.13,0.13-0.13,0.36,0.02,0.5c0.14,0.14,0.38,0.38,0.52,0.52C2.68,7.2,2.91,7.2,3.04,7.07l5.79-5.82C8.87,1.2,8.9,1.11,8.9,1.04L8.87,0.3z"/><rect fill="#FCEE23" stroke="#010101" stroke-width="0.2" x="0.42" y="7.07" transform="matrix(0.7076 -0.7066 0.7066 0.7076 -4.9084 3.249)" width="2.11" height="0.96"/></svg>';

var SVG_RESTORED =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11.08 10.89" width="22" height="22"><path fill="#E31E26" d="M5.54,0.18c-2.9,0-5.26,2.36-5.26,5.26c0,2.9,2.36,5.26,5.26,5.26c2.9,0,5.26-2.36,5.26-5.26C10.8,2.54,8.44,0.18,5.54,0.18 M5.91,9.93V8.13H5.17v1.79C3.79,9.81,2.59,9.1,1.84,8.03L3.45,7.1L3.08,6.45L1.47,7.38C1.19,6.79,1.02,6.14,1.02,5.44c0-0.69,0.17-1.34,0.45-1.93l1.59,0.92l0.37-0.64l-1.6-0.92c0.75-1.07,1.96-1.79,3.33-1.91v1.83h0.74V0.96c1.37,0.11,2.57,0.82,3.32,1.89L7.6,3.79l0.37,0.64L9.6,3.5c0.29,0.59,0.46,1.25,0.46,1.95c0,0.68-0.16,1.33-0.44,1.91L8.01,6.42L7.64,7.06L9.26,8C8.51,9.09,7.3,9.81,5.91,9.93"/></svg>';

function loadBattles() {
  if (battlesData) {
    buildBattlesLayer(battlesData);
    loadNatureMuniCenters();
    return;
  }
  fetch("data/battles.geojson")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      battlesData = d;
      buildBattlesLayer(d);
      loadNatureMuniCenters();
    });
}

function buildBattlesLayer(data) {
  if (battlesLayer) map.removeLayer(battlesLayer);
  battlesLayer = L.geoJSON(data, {
    pointToLayer: function (feat, latlng) {
      var p = feat.properties;
      var svgHtml, w, h;
      if (p.Type_Geo === "გამარჯვება") {
        svgHtml = SVG_VICTORY;
        w = 24;
        h = 24;
      } else if (p.Type_Geo === "დამარცხება") {
        svgHtml = SVG_DEFEAT;
        w = 24;
        h = 24;
      } else {
        svgHtml = SVG_RESTORED;
        w = 22;
        h = 22;
      }

      var icon = L.divIcon({
        html: svgHtml,
        iconSize: [w, h],
        iconAnchor: [w / 2, h / 2],
        className: "",
      });
      var marker = L.marker(latlng, { icon: icon });
      var tooltip = p.Name_Geo + " " + p.Years;
      marker.bindTooltip(tooltip, {
        direction: "top",
        className: "village-label",
        offset: [0, -h / 2 - 2],
      });
      marker.on("click", function () {
        showInfoBattle(p);
        showBottomChartBattles(data);
      });
      return marker;
    },
  }).addTo(map);
  updateBattlesLegend();
  setInfoBtn("battles");
}

function showInfoBattle(p) {
  var colorMap = {
    გამარჯვება: "#E31E26",
    დამარცხება: "#A08000",
    "დაბრუნებული ქალაქ": "#E31E26",
  };
  var color = colorMap[p.Type_Geo] || "#666";
  var svgIcon =
    p.Type_Geo === "გამარჯვება"
      ? SVG_VICTORY
      : p.Type_Geo === "დამარცხება"
        ? SVG_DEFEAT
        : SVG_RESTORED;
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:14px;font-weight:700;">' +
    p.Name_Geo +
    " (" +
    p.Years +
    ")</div>" +
    '<div style="margin:6px 0;display:flex;align-items:center;gap:8px;">' +
    svgIcon +
    '<span class="info-type-badge" style="background:' +
    color +
    "22;color:" +
    color +
    ";border:1px solid " +
    color +
    '55;">' +
    p.Type_Geo +
    "</span></div>" +
    '<div style="margin-top:6px;font-size:10px;color:var(--text-muted);line-height:1.7;">' +
    "<b>მუნიციპალიტეტი:</b> " +
    (p.Municipali || "") +
    "</div>";
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartBattles(data) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

  var types = ["გამარჯვება", "დამარცხება", "დაბრუნებული ქალაქ"];
  var colors = {
    გამარჯვება: "#E31E26",
    დამარცხება: "#FCEE23",
    "დაბრუნებული ქალაქ": "#FF8C00",
  };
  var counts = { გამარჯვება: 0, დამარცხება: 0, "დაბრუნებული ქალაქ": 0 };
  data.features.forEach(function (f) {
    var t = f.properties.Type_Geo;
    if (t.indexOf("დაბრუნებული") > -1) counts["დაბრუნებული ქალაქ"]++;
    else if (counts[t] !== undefined) counts[t]++;
  });

  var labels = ["გამარჯვება", "დამარცხება", "დაბრუნებული\nქალაქი"];
  var vals = [
    counts["გამარჯვება"],
    counts["დამარცხება"],
    counts["დაბრუნებული ქალაქ"],
  ];
  var bColors = ["#E31E26CC", "#FCEE23CC", "#FF8C00CC"];
  var bBorder = ["#E31E26", "#FCEE23", "#FF8C00"];

  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "რაოდენობა",
          data: vals,
          backgroundColor: bColors,
          borderColor: bBorder,
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
        legend: { display: false },
        title: {
          display: true,
          text: "ბრძოლები ქვემო ქართლის ტერიტორიაზე (XI–XVII სს.)",
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: {
            label: function (c) {
              return " " + c.parsed.y;
            },
          },
        },
      },
      scales: {
        y: { beginAtZero: true, ticks: { font: { family: "Fira Sans", size: 10, weight: "500" }, stepSize: 1 } },
        x: {
          ticks: { font: { family: "Fira Sans", size: 11, weight: "500" } },
          grid: { display: false },
        },
      },
    },
  });
}

function updateBattlesLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">ბრძოლები ქვემო ქართლში, XI–XVII სს.</div>';
  html += '<div class="ethnics-legend">';
  html +=
    '<div class="eth-legend-item" style="margin-bottom:6px;">' +
    SVG_VICTORY +
    '<span style="font-size:10px;margin-left:6px;">ქართველების გამარჯვება</span></div>';
  html +=
    '<div class="eth-legend-item" style="margin-bottom:6px;">' +
    SVG_DEFEAT +
    '<span style="font-size:10px;margin-left:6px;">ქართველების დამარცხება</span></div>';
  html +=
    '<div class="eth-legend-item" style="margin-bottom:6px;">' +
    SVG_RESTORED +
    '<span style="font-size:10px;margin-left:6px;">დ. აღმაშენებლის მიერ დაბრუნებული ქალაქები</span></div>';
  html += "</div>";
  el.innerHTML = html;
}

// ============================================================
// ისტორია — გერმანული დასახლებები
// ============================================================
var germansPolyLayer = null;

var germansPointLayer = null;

var germansData = null;

var GERMAN_YEAR_TYPES = [
  { years: "1817-1819", color: "#DF1F50" },
  { years: "1848-1892", color: "#9273B3" },
  { years: "1908-1914", color: "#20AD4B" },
  { years: "1956", color: "#E1E429" },
];

var GERMAN_DEPORT_CLASSES = [
  { label: "1215", color: "#E8821A" },
  { label: "300-500", color: "#F2B266" },
  { label: "100-300", color: "#F9DCB8" },
];

// რვაკუთხედის SVG (PDF-ის სიმბოლო)
function germanOctagonSVG(color, num) {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12.43 12.64" width="22" height="22">' +
    '<path fill="' +
    color +
    '" stroke="#6E6F72" stroke-width="0.25" d="M12.23,8.72c0,0.07-0.02,0.11-0.07,0.16c-1.13,1.13-2.26,2.26-3.39,3.39c-0.05,0.05-0.09,0.07-0.16,0.07c-0.8,0-1.6,0-2.41,0c-0.8,0-1.6,0-2.4,0c-0.05,0-0.11-0.02-0.14-0.06c-1.14-1.13-2.27-2.27-3.41-3.41C0.23,8.84,0.2,8.78,0.2,8.73c0-1.61,0-3.22,0-4.84c0-0.04,0.02-0.1,0.05-0.12c1.14-1.14,2.28-2.28,3.42-3.42C3.7,0.32,3.75,0.3,3.79,0.3c1.61,0,3.23,0,4.84,0c0.04,0,0.1,0.02,0.13,0.05c1.14,1.13,2.27,2.27,3.4,3.4c0.04,0.04,0.06,0.1,0.06,0.15C12.23,5.51,12.23,7.12,12.23,8.72"/>' +
    (num
      ? '<text x="6.2" y="8.6" text-anchor="middle" font-size="7" font-weight="bold" fill="' +
        (color === "#E1E429" ? "#333" : "#fff") +
        '" font-family="Arial">' +
        num +
        "</text>"
      : "") +
    "</svg>"
  );
}

function loadGermans() {
  if (germansData) {
    buildGermansLayers(germansData);
    loadNatureMuniCenters();
    return;
  }
  loadMuniData("data/muni/germans.json")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      germansData = d;
      buildGermansLayers(d);
      loadNatureMuniCenters();
    });
}

function buildGermansLayers(data) {
  if (germansPolyLayer) {
    map.removeLayer(germansPolyLayer);
    germansPolyLayer = null;
  }
  if (germansPointLayer) {
    map.removeLayer(germansPointLayer);
    germansPointLayer = null;
  }

  var polyFeats = {
    type: "FeatureCollection",
    features: data.features.filter(function (f) {
      return f.properties.ftype === "deported";
    }),
  };
  var pointFeats = {
    type: "FeatureCollection",
    features: data.features.filter(function (f) {
      return f.properties.ftype === "settlement";
    }),
  };

  // მუნიციპალიტეტების ფონი — 1941 წ. გადასახლებული ოჯახები
  germansPolyLayer = L.geoJSON(polyFeats, {
    style: function (feat) {
      return {
        fillColor: feat.properties.Color,
        fillOpacity: 0.6,
        color: "#999",
        weight: 0.8,
        opacity: 0.7,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      var _tip = p.Municipali || "";
      if (_tip)
        layer.bindTooltip(_tip, {
          direction: "center",
          className: "village-label",
          sticky: true,
        });
      layer.on("click", function () {
        showInfoGermanPoly(p);
        showBottomChartGermans(data);
      });
    },
  }).addTo(map);

  // დასახლების წერტილები — რვაკუთხედი წლების ფერით
  germansPointLayer = L.geoJSON(pointFeats, {
    pointToLayer: function (feat, latlng) {
      var p = feat.properties;
      var icon = L.divIcon({
        html: germanOctagonSVG(p.Color, p.Number),
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        className: "",
      });
      var marker = L.marker(latlng, { icon: icon });
      marker.bindTooltip(p.Old_Name_G + " (" + p.Name_Geo + ")", {
        direction: "top",
        className: "village-label",
        offset: [0, -13],
      });
      marker.on("click", function () {
        showInfoGermanPoint(p);
        showBottomChartGermans(data);
      });
      return marker;
    },
  }).addTo(map);

  updateGermansLegend();
  setInfoBtn("germans");
}

function showInfoGermanPoint(p) {
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;font-weight:700;">' +
    p.Old_Name_G +
    "</div>" +
    '<div style="font-size:11px;color:var(--text-muted);margin-bottom:5px;">' +
    p.Old_Name_E +
    "</div>" +
    '<span class="info-type-badge" style="background:' +
    p.Color +
    "33;color:#333;border:1px solid " +
    p.Color +
    ';">' +
    p.Years +
    "</span>" +
    '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);line-height:1.7;">' +
    "<b>ახალი სახელწოდება:</b> " +
    p.Name_Geo +
    "<br>" +
    "<b>მუნიციპალიტეტი:</b> " +
    (p.Municipali || "") +
    "</div>";
  document.getElementById("infoCard").classList.remove("hidden");
}

function showInfoGermanPoly(p) {
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;">' +
    p.Municipali +
    "</div>" +
    '<span class="info-type-badge" style="background:' +
    p.Color +
    "66;color:#555;border:1px solid " +
    p.Color +
    ';">1941 წ. გადასახლება</span>' +
    '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);line-height:1.7;">' +
    "<b>გადასახლებული ოჯახები:</b> " +
    (p.Deported === "0" ? "არ ყოფილა" : p.Deported) +
    "</div>";
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartGermans(data) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

  var counts = {};
  GERMAN_YEAR_TYPES.forEach(function (t) {
    counts[t.years] = 0;
  });
  data.features
    .filter(function (f) {
      return f.properties.ftype === "settlement";
    })
    .forEach(function (f) {
      counts[f.properties.Years] = (counts[f.properties.Years] || 0) + 1;
    });

  var labels = GERMAN_YEAR_TYPES.map(function (t) {
    return t.years;
  });
  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "დასახლებები",
          data: labels.map(function (l) {
            return counts[l] || 0;
          }),
          backgroundColor: GERMAN_YEAR_TYPES.map(function (t) {
            return t.color + "CC";
          }),
          borderColor: GERMAN_YEAR_TYPES.map(function (t) {
            return t.color;
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
        legend: { display: false },
        title: {
          display: true,
          text: "გერმანული დასახლებები შექმნის წლების მიხედვით",
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: {
            label: function (c) {
              return " " + c.parsed.y + " დასახლება";
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, font: { family: "Fira Sans", size: 10, weight: "500" } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 11, weight: "500" } },
          grid: { display: false },
        },
      },
    },
  });
}

function updateGermansLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">დასახლების შექმნის წლები</div>';
  html += '<div class="ethnics-legend">';
  GERMAN_YEAR_TYPES.forEach(function (t) {
    html +=
      '<div class="eth-legend-item" style="margin-bottom:5px;">' +
      germanOctagonSVG(t.color, null) +
      '<span style="font-size:10px;margin-left:6px;">' +
      t.years +
      "</span></div>";
  });
  html += "</div>";
  html +=
    '<div style="margin-top:10px;font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">1941 წ. გადასახლებული ოჯახები</div>';
  html += '<div class="ethnics-legend">';
  GERMAN_DEPORT_CLASSES.forEach(function (c) {
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
// ისტორია — თავდაცვითი ნაგებობები
// ============================================================
var fortsLayer = null;

var fortsData = null;

// SVG სიმბოლოები PDF-დან
var FORT_SVG = {
  megalith:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7.38 7.28" width="20" height="20"><path fill="#92854F" stroke="#8B3D1E" stroke-width="0.15" d="M7.03,1.7c0,0.36-0.92,0.46-1.81,0.41C4.95,2.09,4.71,2.08,4.48,2.04C4.31,2,4.14,1.93,3.86,1.93c-0.28,0-0.53,0.08-0.79,0.12c-0.41,0.07-0.81,0.1-1.16,0.09C1.01,2.1,0.35,1.75,0.35,1.41c0-0.3,0.56-0.62,1.26-0.86C2.2,0.36,2.84,0.2,3.68,0.2c0.97,0,2.04,0.29,2.66,0.62C6.89,1.12,7.03,1.44,7.03,1.7"/><path fill="#92854F" stroke="#8B3D1E" stroke-width="0.15" d="M3.53,6.94C3.51,6.95,3.51,6.95,3.5,6.95c-0.02,0-0.04,0.01-0.06,0.01C3.37,6.97,3.3,6.99,3.23,7c-0.17,0.03-0.33,0.05-0.5,0.07c-0.37,0.03-0.73,0-0.73,0C1.77,7.03,1.5,6.99,1.29,6.91C1.14,6.86,1.07,6.83,0.91,6.73C0.86,6.7,0.71,6.59,0.7,6.58C0.66,6.55,0.63,5.62,0.66,5.2C0.69,4.95,0.7,4.67,0.74,4.42C0.77,4.17,0.8,3.9,0.85,3.66c0.06-0.3,0.13-0.57,0.21-0.88c0.15,0,0.4,0.06,0.55,0.06c0.15,0,0.3,0,0.46-0.01c0.17-0.01,0.34-0.02,0.51,0C2.69,2.84,2.8,2.87,2.87,2.97C2.89,3,2.91,3.04,2.93,3.07c0.02,0.04,0.04,0.07,0.06,0.11C2.99,3.2,3,3.23,3.01,3.25C3.04,3.3,3.05,3.35,3.07,3.4C3.08,3.42,3.09,3.44,3.1,3.46C3.1,3.48,3.11,3.5,3.12,3.52c0.05,0.14,0.12,0.47,0.15,0.62C3.3,4.26,3.4,5.01,3.42,5.16c0.03,0.32,0.04,0.62,0.07,0.95C3.5,6.25,3.51,6.4,3.51,6.55c0.01,0.12,0.01,0.25,0.02,0.37C3.53,6.93,3.53,6.93,3.53,6.94"/><path fill="#92854F" stroke="#8B3D1E" stroke-width="0.15" d="M5.4,2.91c0.07,0,0.15,0,0.22,0c0.16,0,0.32-0.01,0.48-0.03c0.09-0.01,0.17-0.02,0.26-0.03c0.05,0.06,0.1,0.12,0.14,0.19c0.04,0.07,0.07,0.15,0.1,0.23c0.06,0.16,0.1,0.34,0.13,0.51C6.76,3.96,6.78,4.15,6.8,4.33C6.81,4.52,6.82,4.7,6.82,4.89c0,0.19-0.01,0.37-0.01,0.56C6.79,5.63,6.78,5.82,6.75,6C6.74,6.12,6.72,6.25,6.69,6.37c-0.02,0.1-0.05,0.21-0.09,0.3C6.57,6.74,6.53,6.8,6.47,6.84C6.34,6.92,6.19,6.9,6.05,6.86c-0.14-0.04-0.27-0.13-0.4-0.22C5.62,6.61,5.58,6.58,5.54,6.55C5.5,6.5,5.47,6.41,5.46,6.34C5.44,6.26,5.42,6.16,5.42,6.08C5.4,5.89,5.38,5.7,5.37,5.52C5.36,5.33,5.35,5.15,5.35,4.96c0-0.19,0-0.37,0-0.56c0-0.19,0.01-0.38,0.01-0.56c0-0.18,0.01-0.37,0.02-0.55C5.39,3.26,5.4,2.91,5.4,2.91"/></svg>',
  fortress:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 6.48 8.44" width="17" height="22"><polygon fill="#82311F" stroke="#8B3D1E" stroke-width="0.15" points="4.83,0.28 4.83,1.82 3.92,1.82 3.92,0.28 2.56,0.28 2.56,1.82 1.65,1.82 1.65,0.28 0.3,0.28 0.3,8.16 6.18,8.16 6.18,0.28"/></svg>',
  tower:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4.19 7.46" width="13" height="22"><polygon fill="#C8394F" stroke="#662A10" stroke-width="0.15" points="3.99,7.18 3.81,0.28 3.03,0.28 3.03,1.32 2.4,1.32 2.4,0.28 1.81,0.28 1.81,1.32 1.17,1.32 1.17,0.28 0.39,0.28 0.2,7.18"/></svg>',
  hillfort:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10.56 9.12" width="24" height="21"><path fill="#915D77" stroke="#8B3D1E" stroke-width="0.15" d="M0.23,6.79h4.06l0.42-0.8l1.16-0.43C6.04,5.65,6.22,5.74,6.4,5.83c0.15,0.08,0.56,0.28,0.67,0.38c0.12,0.11,0.19,0.56,0.25,0.58l3.05-0.04L9.89,5.84L8.83,5.79l-0.82-2.1L6.83,2.82L6.7,1.88L5.17,1.86L5.15,0.26H4.08c-0.01,0-0.01-0.02-0.02-0.02L4.02,0.27v0.87c0,0,0.02,0.02,0.01,0.03c-0.03,0.04-0.25,0-0.32,0c-0.05,0-0.1,0.02-0.15,0.02c-0.12,0-0.24,0-0.35,0L3.2,0.24H2.13V1.2c-0.27-0.04-0.54-0.02-0.81,0L1.3,0.24L0.23,0.22L0.2,0.25L0.23,6.79z M6.87,8.85c0.04-0.04,0.15-0.2,0.2-0.26c0.02-0.03,0.06-0.04,0.08-0.07c0.06-0.1,0.02-0.19-0.01-0.28C7.06,8.06,6.86,7.63,6.75,7.47c-0.02-0.04-0.06-0.07-0.1-0.09C6.51,7.29,5.97,7,5.83,6.96C5.8,6.95,5.78,6.94,5.76,6.94L5.07,7.18L4.13,8.66c-0.06,0.09,0,0.22,0.11,0.22c0.81-0.05,1.71,0.07,2.51,0C6.8,8.87,6.83,8.88,6.87,8.85"/><path fill="#F6F6CE" stroke="#8B3D1E" stroke-width="0.15" d="M2.42,2.84c0-0.29-0.27-0.72-0.59-0.72c-0.33,0-0.59,0.44-0.59,0.72v1.19h1.18V2.84z"/><path fill="#F6F6CE" stroke="#8B3D1E" stroke-width="0.15" d="M4.55,2.84c0-0.29-0.27-0.72-0.59-0.72c-0.33,0-0.59,0.44-0.59,0.72v1.19h1.18V2.84z"/></svg>',
  bridge:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9.55 4.89" width="24" height="12"><path fill="#907148" stroke="#8B3D1E" stroke-width="0.2" d="M9.3,3.07L8.78,2.18L7.61,2.87C7.44,2.67,7.25,2.5,7.04,2.34l0.72-1.23L6.87,0.59L6.13,1.85c-0.25-0.1-0.52-0.16-0.8-0.21V0.22H4.3v1.42c-0.31,0.04-0.61,0.1-0.89,0.2L2.68,0.59L1.8,1.11l0.71,1.2C2.28,2.47,2.09,2.65,1.91,2.85L0.77,2.18L0.25,3.07l1.11,0.66C1.29,3.91,1.23,4.1,1.19,4.31C1.17,4.46,1.26,4.6,1.41,4.63c0.15,0.03,0.29-0.07,0.32-0.22C1.98,3.1,3.25,2.15,4.76,2.15c1.51,0,2.81,0.99,3.03,2.3c0.02,0.13,0.14,0.23,0.27,0.23c0.02,0,0.03,0,0.05,0c0.15-0.03,0.25-0.17,0.23-0.32C8.3,4.14,8.24,3.94,8.15,3.74L9.3,3.07z"/></svg>',
};

var FORT_TYPES = [
  { key: "megalith", label: "მეგალითი (ციკლოპური ნაგებობა)", w: 20, h: 20 },
  { key: "fortress", label: "ციხე / ციხესიმაგრე", w: 17, h: 22 },
  { key: "tower", label: "კოშკი", w: 13, h: 22 },
  { key: "hillfort", label: "ნაქალაქარი", w: 24, h: 21 },
  { key: "bridge", label: "ხიდი", w: 24, h: 12 },
];

function loadForts() {
  if (fortsData) {
    buildFortsLayer(fortsData);
    loadNatureMuniCenters();
    return;
  }
  fetch("data/fortifications.geojson")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      fortsData = d;
      buildFortsLayer(d);
      loadNatureMuniCenters();
    });
}

function buildFortsLayer(data) {
  if (fortsLayer) map.removeLayer(fortsLayer);
  fortsLayer = L.geoJSON(data, {
    pointToLayer: function (feat, latlng) {
      var p = feat.properties;
      var t =
        FORT_TYPES.find(function (x) {
          return x.key === p.FType;
        }) || FORT_TYPES[1];
      var icon = L.divIcon({
        html: FORT_SVG[p.FType] || FORT_SVG.fortress,
        iconSize: [t.w, t.h],
        iconAnchor: [t.w / 2, t.h / 2],
        className: "",
      });
      var marker = L.marker(latlng, { icon: icon });
      marker.bindTooltip(p.Name_Geo, {
        direction: "top",
        className: "village-label",
        offset: [0, -t.h / 2 - 2],
      });
      marker.on("click", function () {
        showInfoFort(p);
        showBottomChartForts(data);
      });
      return marker;
    },
  }).addTo(map);
  updateFortsLegend();
  setInfoBtn("fortifications");
}

function showInfoFort(p) {
  var t = FORT_TYPES.find(function (x) {
    return x.key === p.FType;
  });
  var label = t ? t.label : p.Type_Geo;
  var extra = "";
  if (p.Dasaxleba) extra = "<b>ორი სახელი:</b> " + p.Dasaxleba + "<br>";
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;font-weight:700;">' +
    p.Name_Geo +
    "</div>" +
    '<div style="margin:6px 0;display:flex;align-items:center;gap:8px;">' +
    (FORT_SVG[p.FType] || "") +
    '<span class="info-type-badge" style="background:#82311F22;color:#82311F;border:1px solid #82311F55;">' +
    label +
    "</span></div>" +
    '<div style="margin-top:6px;font-size:10px;color:var(--text-muted);line-height:1.7;">' +
    extra +
    "<b>მუნიციპალიტეტი:</b> " +
    (p.Municipali || "") +
    "</div>";
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartForts(data) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

  var colors = {
    megalith: "#92854F",
    fortress: "#82311F",
    tower: "#C8394F",
    hillfort: "#915D77",
    bridge: "#907148",
  };
  var counts = {};
  FORT_TYPES.forEach(function (t) {
    counts[t.key] = 0;
  });
  data.features.forEach(function (f) {
    counts[f.properties.FType] = (counts[f.properties.FType] || 0) + 1;
  });

  var labels = FORT_TYPES.map(function (t) {
    return t.label;
  });
  var keys = FORT_TYPES.map(function (t) {
    return t.key;
  });
  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "ნაგებობები",
          data: keys.map(function (k) {
            return counts[k] || 0;
          }),
          backgroundColor: keys.map(function (k) {
            return colors[k] + "CC";
          }),
          borderColor: keys.map(function (k) {
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
        legend: { display: false },
        title: {
          display: true,
          text: "ისტორიული თავდაცვითი ნაგებობები ტიპების მიხედვით",
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: {
            label: function (c) {
              return " " + c.parsed.y + " ნაგებობა";
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 2, font: { family: "Fira Sans", size: 10, weight: "500" } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 11, weight: "500" }, maxRotation: 35 },
          grid: { display: false },
        },
      },
    },
  });
}

function updateFortsLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">ნაგებობები</div>';
  html += '<div class="ethnics-legend">';
  FORT_TYPES.forEach(function (t) {
    html +=
      '<div class="eth-legend-item" style="margin-bottom:6px;align-items:center;">' +
      '<span style="display:inline-flex;width:26px;justify-content:center;">' +
      FORT_SVG[t.key] +
      "</span>" +
      '<span style="font-size:10px;margin-left:5px;">' +
      t.label +
      "</span></div>";
  });
  html += "</div>";
  el.innerHTML = html;
}

// ============================================================
// ისტორია — ეპარქიები
// ============================================================
var eparchyPolyLayer = null;

var eparchyPointLayer = null;

var churchesLayer = null;

var eparchyData = null;

var churchesData = null;

var churchesVisible = false;

// PDF სიმბოლოები
var EP_SVG = {
  monastery_m:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12.84 12.08" width="26" height="26"><polygon fill="#010101" points="6.12,11.45 6.72,11.45 7.12,11.02 7.12,10.39 6.85,9.96 6.85,5 8.74,5 9.14,5.3 9.74,5.3 10.14,4.88 10.14,4.24 9.74,3.82 9.14,3.82 8.74,4.07 6.85,4.07 6.85,2.12 7.12,1.69 7.12,1.06 6.72,0.63 6.12,0.63 5.71,1.06 5.71,1.69 5.99,2.12 5.99,4.07 4.1,4.07 3.7,3.82 3.1,3.82 2.69,4.24 2.69,4.88 3.1,5.3 3.7,5.3 4.1,5 5.99,5 5.99,9.96 5.71,10.39 5.71,11.02"/></svg>',
  monastery_w:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12.84 12.08" width="26" height="26"><polygon fill="none" stroke="#010101" stroke-width="0.8" points="6.12,11.45 6.72,11.45 7.12,11.02 7.12,10.39 6.85,9.96 6.85,5 8.74,5 9.14,5.3 9.74,5.3 10.14,4.88 10.14,4.24 9.74,3.82 9.14,3.82 8.74,4.07 6.85,4.07 6.85,2.12 7.12,1.69 7.12,1.06 6.72,0.63 6.12,0.63 5.71,1.06 5.71,1.69 5.99,2.12 5.99,4.07 4.1,4.07 3.7,3.82 3.1,3.82 2.69,4.24 2.69,4.88 3.1,5.3 3.7,5.3 4.1,5 5.99,5 5.99,9.96 5.71,10.39 5.71,11.02"/></svg>',
  cathedral:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11.29 11.2" width="26" height="26"><polygon fill="#010101" points="11.01,8.52 10.8,8.18 10.64,7.94 10.11,7.33 9.61,6.91 9.46,6.75 9.08,6.5 8.3,6.06 7.23,5.65 5.57,5.6 5.68,7.22 6.18,8.47 6.33,8.76 6.63,9.21 7.28,9.99 7.45,10.16 8.18,10.76 8.59,10.98 2.44,10.98 2.81,10.76 3.26,10.44 3.5,10.23 4.04,9.66 4.54,8.97 4.9,8.3 5.06,7.94 5.3,7.22 5.43,5.6 3.74,5.65 3.02,6 2.44,6.33 1.53,6.93 1.21,7.24 0.92,7.57 0.52,8.1 0.28,8.47 0.28,2.41 0.64,2.98 1.04,3.47 1.38,3.8 2.43,4.58 2.9,4.87 3.74,5.26 5.43,5.36 5.3,3.74 4.82,2.73 4.32,1.91 4.2,1.74 3.63,1.09 3.1,0.64 2.44,0.23 8.47,0.23 7.9,0.6 7.65,0.8 6.85,1.6 6.66,1.87 6.38,2.33 6.1,2.7 5.69,3.74 5.57,5.36 7.23,5.25 8.51,4.82 9.16,4.42 10.3,3.5 10.8,2.78 11.01,2.44"/></svg>',
  residence:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12.84 12.08" width="26" height="26"><polygon fill="#7B1F1F" points="6.13,0.28 6.13,2.88 3.23,2.88 3.23,3.68 6.13,3.68 6.13,6.08 6.9,6.08 6.9,3.68 9.61,3.68 9.61,2.88 6.9,2.88 6.9,0.28"/><circle cx="6.47" cy="8.88" r="2.92" fill="none" stroke="#010101" stroke-width="0.4"/></svg>',
};

var EP_TYPES = [
  { key: "cathedral", label: "საეპისკოპოსო საკათედრო ტაძარი" },
  { key: "residence", label: "საეპისკოპოსო რეზიდენცია" },
  { key: "monastery_m", label: "მამათა მონასტერი" },
  { key: "monastery_w", label: "დედათა მონასტერი" },
];

function loadEparchies() {
  if (eparchyData) {
    buildEparchyLayers(eparchyData);
    loadNatureMuniCenters();
    return;
  }
  fetch("data/eparchies.geojson")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      eparchyData = d;
      buildEparchyLayers(d);
      loadNatureMuniCenters();
    });
}

function buildEparchyLayers(data) {
  if (eparchyPolyLayer) {
    map.removeLayer(eparchyPolyLayer);
    eparchyPolyLayer = null;
  }
  if (eparchyPointLayer) {
    map.removeLayer(eparchyPointLayer);
    eparchyPointLayer = null;
  }

  var polys = {
    type: "FeatureCollection",
    features: data.features.filter(function (f) {
      return f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon";
    }),
  };
  var points = {
    type: "FeatureCollection",
    features: data.features.filter(function (f) {
      return f.geometry.type === "Point";
    }),
  };

  eparchyPolyLayer = L.geoJSON(polys, {
    style: function (feat) {
      return {
        fillColor: feat.properties.Color,
        fillOpacity: 0.5,
        color: "#8B6B4A",
        weight: 1.4,
        opacity: 0.85,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      layer.bindTooltip(p.Name_Geo, {
        direction: "center",
        className: "village-label",
        sticky: true,
      });
      layer.on("click", function () {
        showInfoEparchy(p);
        showBottomChartEparchies(eparchyData);
      });
    },
  }).addTo(map);

  // ერთ კოორდინატზე მჯდომი სიმბოლოები გვერდიგვერდ დავალაგოთ
  var _epAt = {};
  points.features.forEach(function (f) {
    var c = f.geometry.coordinates;
    var key = c[0].toFixed(5) + "," + c[1].toFixed(5);
    (_epAt[key] = _epAt[key] || []).push(f);
  });

  eparchyPointLayer = L.geoJSON(points, {
    pointToLayer: function (feat, latlng) {
      var p = feat.properties;
      var SZ = 26;
      var c = feat.geometry.coordinates;
      var grp = _epAt[c[0].toFixed(5) + "," + c[1].toFixed(5)] || [feat];
      var idx = grp.indexOf(feat);
      // ჰორიზონტალური წანაცვლება — ცენტრის მიმართ სიმეტრიულად
      var dx = grp.length > 1 ? (idx - (grp.length - 1) / 2) * (SZ - 4) : 0;
      var icon = L.divIcon({
        html: EP_SVG[p.TKey] || EP_SVG.monastery_m,
        iconSize: [SZ, SZ],
        iconAnchor: [SZ / 2 - dx, SZ / 2],
        className: "",
      });
      var marker = L.marker(latlng, { icon: icon });
      marker.bindTooltip(p.Name_Geo, {
        direction: "top",
        className: "village-label",
        offset: [dx, -SZ / 2 - 2],
      });
      marker.on("click", function () {
        showInfoEparchyPoint(p);
        showBottomChartEparchies(eparchyData);
      });
      return marker;
    },
  }).addTo(map);

  if (churchesVisible) loadChurches();
  updateEparchiesLegend();
  setInfoBtn("eparchies");
}

function showInfoEparchy(p) {
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;font-weight:700;">' +
    p.Name_Geo +
    "</div>" +
    '<span class="info-type-badge" style="background:' +
    p.Color +
    "88;color:#555;border:1px solid " +
    p.Color +
    ';">ეპარქია</span>' +
    '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);line-height:1.7;">' +
    "<b>ფართობი:</b> " +
    (p.Area || "").replace("sq km", "კმ²") +
    "</div>";
  document.getElementById("infoCard").classList.remove("hidden");
}

function showInfoEparchyPoint(p) {
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:12px;font-weight:700;line-height:1.4;">' +
    p.Name_Geo +
    "</div>" +
    '<div style="margin:6px 0;display:flex;align-items:center;gap:8px;">' +
    (EP_SVG[p.TKey] || "") +
    '<span class="info-type-badge" style="background:#7B1F1F18;color:#7B1F1F;border:1px solid #7B1F1F44;">' +
    p.Type_Geo +
    "</span></div>" +
    '<div style="margin-top:6px;font-size:10px;color:var(--text-muted);line-height:1.7;">' +
    "<b>ეპარქია:</b> " +
    (p.Eparqia || "") +
    "</div>";
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartEparchies(data) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

  // ეპარქიების მიხედვით ობიექტების რაოდენობა
  var byEparchy = {};
  data.features
    .filter(function (f) {
      return f.geometry.type === "Point";
    })
    .forEach(function (f) {
      var e = f.properties.Eparqia || "";
      var short = e.replace(" ეპარქია", "");
      byEparchy[short] = (byEparchy[short] || 0) + 1;
    });

  var labels = Object.keys(byEparchy);
  // გრძელი ორმაგი სახელები ორ სტრიქონად ("მანგლისისა და" / "თეთრიწყაროს")
  var labelLines = labels.map(function (t) {
    var k = t.indexOf("ისა და ");
    return k === -1 ? [t] : [t.slice(0, k + 6), t.slice(k + 7)];
  });
  var polyColors = {};
  data.features
    .filter(function (f) {
      return f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon";
    })
    .forEach(function (f) {
      var short = f.properties.Name_Geo.replace(" ეპარქია", "");
      polyColors[short] = f.properties.Color;
    });

  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labelLines,
      datasets: [
        {
          label: "ობიექტები",
          data: labels.map(function (l) {
            return byEparchy[l];
          }),
          backgroundColor: labels.map(function (l) {
            return (polyColors[l] || "#999") + "DD";
          }),
          borderColor: labels.map(function (l) {
            return polyColors[l] || "#777";
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
        legend: { display: false },
        title: {
          display: true,
          text: "მონასტრები და ტაძრები ეპარქიების მიხედვით",
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: {
            label: function (c) {
              return " " + c.parsed.y + " ობიექტი";
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 2, font: { family: "Fira Sans", size: 10, weight: "500" } },
        },
        x: {
          ticks: {
            font: { family: "Fira Sans", size: 11, weight: "500" },
            color: "#1A1A18",
            autoSkip: false,
            maxRotation: 0,
            minRotation: 0,
            padding: 4,
          },
          grid: { display: false },
        },
      },
    },
  });
}

// ===== ეკლესიების toggleable ფენა =====
function loadChurches() {
  if (churchesData) {
    buildChurchesLayer(churchesData);
    return;
  }
  fetch("data/churches.geojson")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      churchesData = d;
      if (!churchesVisible) return; // ჩატვირთვისას უკვე გამორთეს
      buildChurchesLayer(d);
      // ღილაკზე ეკლესიების რაოდენობა — პანელი ჯერ კიდევ ეპარქიებზეა?
      if (document.getElementById("btnToggleChurches")) updateEparchiesLegend();
    });
}

function buildChurchesLayer(data) {
  if (churchesLayer) {
    map.removeLayer(churchesLayer);
    churchesLayer = null;
  }
  churchesLayer = L.geoJSON(data, {
    pointToLayer: function (feat, latlng) {
      var p = feat.properties;
      var marker = L.circleMarker(latlng, {
        radius: 5.5,
        fillColor: "#8B5A2B",
        color: "#fff",
        weight: 1.2,
        fillOpacity: 0.85,
      });
      marker.bindTooltip(p.Name + " (" + p.Type + ")", {
        direction: "top",
        className: "village-label",
        offset: [0, -7],
      });
      return marker;
    },
  }).addTo(map);
}

function toggleChurches() {
  churchesVisible = !churchesVisible;
  var btn = document.getElementById("btnToggleChurches");
  if (churchesVisible) {
    loadChurches();
    if (btn) btn.classList.add("active");
  } else {
    if (churchesLayer) {
      map.removeLayer(churchesLayer);
      churchesLayer = null;
    }
    if (btn) btn.classList.remove("active");
  }
  updateEparchiesLegend();
  setInfoBtn("eparchies");
}

function updateEparchiesLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">ეპარქიები</div>';
  html += '<div class="ethnics-legend">';
  EP_TYPES.forEach(function (t) {
    html +=
      '<div class="eth-legend-item" style="margin-bottom:6px;align-items:center;">' +
      '<span style="display:inline-flex;width:28px;justify-content:center;">' +
      EP_SVG[t.key] +
      "</span>" +
      '<span style="font-size:10px;margin-left:5px;">' +
      t.label +
      "</span></div>";
  });
  html += "</div>";
  // ეკლესიების toggle ღილაკი
  html +=
    '<div style="margin-top:10px;padding-top:8px;border-top:1px solid #e5e0d8;">' +
    '<div class="panel-btn-col">' +
    '<button id="btnToggleChurches" onclick="toggleChurches()" class="year-btn' +
    (churchesVisible ? " active" : "") +
    '" style="display:flex;align-items:center;gap:6px;">' +
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg>' +
    (churchesVisible
      ? "ეკლესიები ჩართულია (" +
        (churchesData ? churchesData.features.length : "...") +
        ")"
      : "ეკლესიების ჩვენება") +
    "</button></div></div>";
  el.innerHTML = html;
}

// ============================================================
// ისტორია — პეტროგლიფები
// ============================================================
var petroLayer = null;

var petroData = null;

// PDF სიმბოლო — ვარდისფერი ხუთკუთხედი
var SVG_PETRO =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14.08 13.42" width="20" height="19"><polygon fill="#BD1B88" stroke="#010101" stroke-width="0.25" points="0.36,5.2 2.91,13.07 11.17,13.07 13.72,5.2 7.03,0.34"/></svg>';

function loadPetroglyphs() {
  if (petroData) {
    buildPetroLayer(petroData);
    loadNatureMuniCenters();
    return;
  }
  fetch("data/petroglyphs.geojson")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      petroData = d;
      buildPetroLayer(d);
      loadNatureMuniCenters();
    });
}

function buildPetroLayer(data) {
  if (petroLayer) map.removeLayer(petroLayer);
  petroLayer = L.geoJSON(data, {
    pointToLayer: function (feat, latlng) {
      var p = feat.properties;
      var icon = L.divIcon({
        html: SVG_PETRO,
        iconSize: [20, 19],
        iconAnchor: [10, 9.5],
        className: "",
      });
      var marker = L.marker(latlng, { icon: icon });
      marker.bindTooltip(p.Name_Geo, {
        direction: "top",
        className: "village-label",
        offset: [0, -12],
      });
      marker.on("click", function () {
        showInfoPetro(p);
        showBottomChartPetro(data);
      });
      return marker;
    },
  }).addTo(map);
  updatePetroLegend();
  setInfoBtn("petroglyphs");
}

function showInfoPetro(p) {
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;font-weight:700;">' +
    p.Name_Geo +
    "</div>" +
    '<div style="margin:6px 0;display:flex;align-items:center;gap:8px;">' +
    SVG_PETRO +
    '<span class="info-type-badge" style="background:#BD1B8818;color:#BD1B88;border:1px solid #BD1B8844;">პეტროგლიფი</span></div>' +
    '<div style="margin-top:6px;font-size:10px;color:var(--text-muted);line-height:1.7;">' +
    "<b>ადგილმდებარეობა:</b> " +
    (p.Place_Geo || "") +
    "</div>";
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartPetro(data) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

  // ადგილმდებარეობის ტიპების მიხედვით
  var groups = {
    "ეკლესის ფასადზე": 0,
    მენჰირზე: 0,
    "კედლებზე / ყორღანებში": 0,
    "საფლავის ქვებზე": 0,
    სხვა: 0,
  };
  data.features.forEach(function (f) {
    var pl = f.properties.Place_Geo || "";
    if (pl.indexOf("ფასადზე") > -1 && pl.indexOf("საფლავის") === -1)
      groups["ეკლესის ფასადზე"]++;
    else if (pl.indexOf("საფლავის") > -1) groups["საფლავის ქვებზე"]++;
    else if (pl.indexOf("მენჰირ") > -1) groups["მენჰირზე"]++;
    else if (pl.indexOf("კედლებზე") > -1 || pl.indexOf("ყორღან") > -1)
      groups["კედლებზე / ყორღანებში"]++;
    else groups["სხვა"]++;
  });

  var labels = Object.keys(groups).filter(function (k) {
    return groups[k] > 0;
  });
  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "პეტროგლიფები",
          data: labels.map(function (l) {
            return groups[l];
          }),
          backgroundColor: "#BD1B88CC",
          borderColor: "#BD1B88",
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
        legend: { display: false },
        title: {
          display: true,
          text: "პეტროგლიფები ადგილმდებარეობის მიხედვით",
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: {
            label: function (c) {
              return " " + c.parsed.y;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, font: { family: "Fira Sans", size: 10, weight: "500" } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 11, weight: "500" }, maxRotation: 30 },
          grid: { display: false },
        },
      },
    },
  });
}

function updatePetroLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">პეტროგლიფები</div>';
  html += '<div class="ethnics-legend">';
  html +=
    '<div class="eth-legend-item" style="margin-bottom:6px;align-items:center;">' +
    '<span style="display:inline-flex;width:24px;justify-content:center;">' +
    SVG_PETRO +
    "</span>" +
    '<span style="font-size:10px;margin-left:5px;">პეტროგლიფების აღმოჩენის ადგილი</span></div>';
  html += "</div>";
  el.innerHTML = html;
}

// ============================================================
// ისტორია — მეგალითები
// ============================================================
var megaLayer = null;

var megaData = null;

// PDF სიმბოლოები — კვადრატები
var SVG_MEGA_GREEN =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 6.83 6.58" width="15" height="15"><rect x="0.35" y="0.22" width="6.14" height="6.14" fill="#2D8143" stroke="#010101" stroke-width="0.25"/></svg>';

var SVG_MEGA_ORANGE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 6.83 6.58" width="15" height="15"><rect x="0.35" y="0.22" width="6.14" height="6.14" fill="#E45225" stroke="#010101" stroke-width="0.25"/></svg>';

function loadMegaliths() {
  if (megaData) {
    buildMegaLayer(megaData);
    loadNatureMuniCenters();
    return;
  }
  fetch("data/megaliths.geojson")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      megaData = d;
      buildMegaLayer(d);
      loadNatureMuniCenters();
    });
}

function buildMegaLayer(data) {
  if (megaLayer) map.removeLayer(megaLayer);
  megaLayer = L.geoJSON(data, {
    pointToLayer: function (feat, latlng) {
      var p = feat.properties;
      var svg = p.TKey === "national" ? SVG_MEGA_ORANGE : SVG_MEGA_GREEN;
      var icon = L.divIcon({
        html: svg,
        iconSize: [15, 15],
        iconAnchor: [7.5, 7.5],
        className: "",
      });
      var marker = L.marker(latlng, { icon: icon });
      marker.bindTooltip(p.Name_Geo, {
        direction: "top",
        className: "village-label",
        offset: [0, -9],
      });
      marker.on("click", function () {
        showInfoMega(p);
        showBottomChartMega(data);
      });
      return marker;
    },
  }).addTo(map);
  updateMegaLegend();
  setInfoBtn("megaliths");
}

function showInfoMega(p) {
  var svg = p.TKey === "national" ? SVG_MEGA_ORANGE : SVG_MEGA_GREEN;
  var color = p.TKey === "national" ? "#E45225" : "#2D8143";
  var extra =
    p.Dasaxleba && p.Dasaxleba !== p.Name_Geo
      ? "<b>დასახლება:</b> " + p.Dasaxleba + "<br>"
      : "";
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;font-weight:700;">' +
    p.Name_Geo +
    "</div>" +
    '<div style="margin:6px 0;display:flex;align-items:center;gap:8px;">' +
    svg +
    '<span class="info-type-badge" style="background:' +
    color +
    "18;color:" +
    color +
    ";border:1px solid " +
    color +
    '44;font-size:9px;">' +
    p.Type_Geo +
    "</span></div>" +
    (extra
      ? '<div style="margin-top:6px;font-size:10px;color:var(--text-muted);line-height:1.7;">' +
        extra +
        "</div>"
      : "");
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartMega(data) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

  var counts = { megalith: 0, national: 0 };
  data.features.forEach(function (f) {
    counts[f.properties.TKey]++;
  });

  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["მეგალითური ნაგებობა", "ეროვნული მნიშვნ. ძეგლი"],
      datasets: [
        {
          label: "რაოდენობა",
          data: [counts.megalith, counts.national],
          backgroundColor: ["#2D8143CC", "#E45225CC"],
          borderColor: ["#2D8143", "#E45225"],
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
        legend: { display: false },
        title: {
          display: true,
          text: "მეგალითური ნაგებობები ქვემო ქართლში",
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: {
            label: function (c) {
              return " " + c.parsed.y;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 10, font: { family: "Fira Sans", size: 10, weight: "500" } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 11, weight: "500" } },
          grid: { display: false },
        },
      },
    },
  });
}

function updateMegaLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">მეგალითები</div>';
  html += '<div class="ethnics-legend">';
  html +=
    '<div class="eth-legend-item" style="margin-bottom:6px;align-items:center;">' +
    '<span style="display:inline-flex;width:20px;justify-content:center;">' +
    SVG_MEGA_GREEN +
    "</span>" +
    '<span style="font-size:10px;margin-left:5px;">მეგალითური ნაგებობა</span></div>';
  html +=
    '<div class="eth-legend-item" style="margin-bottom:6px;align-items:center;">' +
    '<span style="display:inline-flex;width:20px;justify-content:center;">' +
    SVG_MEGA_ORANGE +
    "</span>" +
    '<span style="font-size:10px;margin-left:5px;">ეროვნული მნიშვნელობის კულტურის უძრავი ძეგლი</span></div>';
  html += "</div>";
  el.innerHTML = html;
}

function removeAllHistoryLayers() {
  if (archLayer) {
    map.removeLayer(archLayer);
    archLayer = null;
  }
  if (battlesLayer) {
    map.removeLayer(battlesLayer);
    battlesLayer = null;
  }
  if (germansPolyLayer) {
    map.removeLayer(germansPolyLayer);
    germansPolyLayer = null;
  }
  if (germansPointLayer) {
    map.removeLayer(germansPointLayer);
    germansPointLayer = null;
  }
  if (fortsLayer) {
    map.removeLayer(fortsLayer);
    fortsLayer = null;
  }
  if (eparchyPolyLayer) {
    map.removeLayer(eparchyPolyLayer);
    eparchyPolyLayer = null;
  }
  if (eparchyPointLayer) {
    map.removeLayer(eparchyPointLayer);
    eparchyPointLayer = null;
  }
  if (churchesLayer) {
    map.removeLayer(churchesLayer);
    churchesLayer = null;
  }
  if (petroLayer) {
    map.removeLayer(petroLayer);
    petroLayer = null;
  }
  if (megaLayer) {
    map.removeLayer(megaLayer);
    megaLayer = null;
  }
  churchesVisible = false;
}

// ქვე-ფენა → MAP_INFO გასაღები (ღილაკი ჩატვირთვის შტოზე დამოკიდებული აღარაა)
var HIST_SUB_INFO = {
  archaeology: "archaeology", battles: "battles", germans: "germans",
  forts: "fortifications", eparchies: "eparchies",
  petroglyphs: "petroglyphs", megaliths: "megaliths",
};

var ECON_SUB_INFO = {
  botanica: "botanica", energetika: "energetika", crop_zones: "crop_zones",
  land: "land", sun: "sun", agri: "agri", agrispec: "agri_spec",
};

var EDU_SUB_INFO = {
  schools: "education", kindergarten: "kindergarten", oikonymy: "oikonymy",
  libraries: "libraries", tourism: "museums_theaters",
  art_disciplines: "art_disciplines",
};

var TOUR_SUB_INFO = {
  tourism_climate: "tourism_climate", tourism_types: "tourism_types",
  viticulture: "viticulture",
  protected_areas: "protected_areas",
};

var HEALTH_SUB_INFO = { health: "health_infra", social: "social" };

// ===== Start-up (called from app.js) =====
function initHistory() {
  // ===== ისტორია checkbox =====
  document.getElementById("chkHistory").addEventListener("change", function (e) {
    if (e.target.checked) {
      document.getElementById("mainLayerView").style.display = "none";
      document.getElementById("sublayerView").style.display = "none";
      document.getElementById("natureView").style.display = "none";
      document.getElementById("historyView").style.display = "";
      showChartPanel();
      resetChartPanel();
      hideSettlementLegend();
      setInfoBtn(null);
      document.getElementById("filterSection").style.display = "none";
      document.getElementById("infoCard").classList.add("hidden");
      document.getElementById("chkPopulation").checked = false;
      document.getElementById("chkNature").checked = false;
      document.getElementById("chkEconomy").checked = false;
      document.getElementById("chkEducation").checked = false;
      document.getElementById("chkTourism").checked = false;
      document.getElementById("economyView").style.display = "none";
      document.getElementById("educationView").style.display = "none";
      document.getElementById("tourismView").style.display = "none";
      removeAllThematic();
      removeAllNatureLayers();
      removeAllEconomyLayers();
      removeAllEducationLayers();
      removeAllTourismLayers();
      removeNeutralLayers();
      document.querySelectorAll("[data-histsub]").forEach(function (b) {
        b.classList.remove("active");
      });
      document
        .querySelector("[data-histsub='archaeology']")
        .classList.add("active");
      loadArchaeology();
    } else {
      document.getElementById("historyView").style.display = "none";
      document.getElementById("mainLayerView").style.display = "";
      removeAllHistoryLayers();
      resetPopLegend();
      loadNeutralLayers();
    }
  });


  document
    .getElementById("btnHistoryBack")
    .addEventListener("click", function () {
      document.getElementById("chkHistory").checked = false;
      document.getElementById("historyView").style.display = "none";
      document.getElementById("mainLayerView").style.display = "";
      removeAllHistoryLayers();
      hideChartPanel();
      document.getElementById("infoCard").classList.add("hidden");
      resetPopLegend();
      loadNeutralLayers();
    });


  document.querySelectorAll("[data-histsub]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (this.classList.contains("active")) return; // იგივეზე ხელახლა დაწკაპება
      document.querySelectorAll("[data-histsub]").forEach(function (b) {
        b.classList.remove("active");
      });
      this.classList.add("active");
      removeAllHistoryLayers();
      document.getElementById("infoCard").classList.add("hidden");
      resetChartPanel();
      resetPopLegend();
      var sub = this.dataset.histsub;
      if (sub === "archaeology") loadArchaeology();
      else if (sub === "battles") loadBattles();
      else if (sub === "germans") loadGermans();
      else if (sub === "forts") loadForts();
      else if (sub === "eparchies") loadEparchies();
      else if (sub === "petroglyphs") loadPetroglyphs();
      else if (sub === "megaliths") loadMegaliths();
      setInfoBtn(HIST_SUB_INFO[sub] || null);
    });
  });
}
