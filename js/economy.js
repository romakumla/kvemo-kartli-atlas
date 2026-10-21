// ეკონომიკა: ბოტანიკურ-აგრონომიული ზონები, ენერგეტიკა, კულტურულ მცენარეთა ზონები, მიწა, მზის ნათება, ბენეფიციარები, სპეციალიზაცია
// Part of the atlas script, split from the former js/main.js. Files are loaded in
// order by index.html; theme files only define things, their start-up code is
// in initEconomy(), called from app.js once every file is loaded.


// ============================================================
// ეკონომიკა — ბოტანიკურ-აგრონომიული ზონები
// ============================================================
var botanicaLayer = null;

var botanicaData = null;

var BOTANICA_TYPES = [
  { key: "ვენახ-ხილიანი", color: "#8DCB8B", label: "ვენახ-ხილიანი" },
  { key: "უვენახ-ხილო", color: "#FEE182", label: "უვენახ-ხილო" },
  { key: "ბრინჯ-ბამბა", color: "#6ECCDE", label: "ბრინჯ-ბამბა" },
  { key: "ბალახ-ყვავილოვანი", color: "#F0C1DA", label: "ბალახ-ყვავილოვანი" },
  { key: "ზამთრის საძოვრები", color: "#FCBA7D", label: "ზამთრის საძოვრები" },
];

function loadBotanica() {
  if (botanicaData) {
    buildBotanicaLayer(botanicaData);
    loadNatureMuniCenters();
    return;
  }
  fetch("data/botanica.geojson")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      botanicaData = d;
      buildBotanicaLayer(d);
      loadNatureMuniCenters();
    });
}

function buildBotanicaLayer(data) {
  if (botanicaLayer) map.removeLayer(botanicaLayer);
  botanicaLayer = L.geoJSON(data, {
    style: function (feat) {
      return {
        fillColor: feat.properties.Color,
        fillOpacity: 0.62,
        color: "#7a7a6a",
        weight: 0.8,
        opacity: 0.6,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      layer.bindTooltip(p.Type_Geo, {
        direction: "center",
        className: "village-label",
        sticky: true,
      });
      layer.on("click", function () {
        showInfoBotanica(p);
        showBottomChartBotanica(data);
      });
    },
  }).addTo(map);
  updateBotanicaLegend();
  setInfoBtn("botanica");
}

function showInfoBotanica(p) {
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;font-weight:700;">' +
    p.Type_Geo +
    "</div>" +
    '<span class="info-type-badge" style="background:' +
    p.Color +
    "66;color:#555;border:1px solid " +
    p.Color +
    ';">ბოტ.-აგრონ. ზონა</span>' +
    '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);line-height:1.7;">' +
    "<b>ფართობი:</b> " +
    p.Area_km2.toLocaleString() +
    " კმ²</div>";
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartBotanica(data) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

  // ფართობების ჯამი ტიპების მიხედვით
  var areas = {};
  BOTANICA_TYPES.forEach(function (t) {
    areas[t.key] = 0;
  });
  data.features.forEach(function (f) {
    var t = f.properties.Type_Geo;
    if (areas[t] !== undefined) areas[t] += f.properties.Area_km2;
  });

  var labels = BOTANICA_TYPES.map(function (t) {
    return t.label;
  });
  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "ფართობი (კმ²)",
          data: BOTANICA_TYPES.map(function (t) {
            return Math.round(areas[t.key]);
          }),
          backgroundColor: BOTANICA_TYPES.map(function (t) {
            return t.color + "CC";
          }),
          borderColor: BOTANICA_TYPES.map(function (t) {
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
          text: "ბოტანიკურ-აგრონომიული ზონები — ფართობი (კმ²)",
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
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
          ticks: { font: { family: "Fira Sans", size: 10, weight: "500" } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 11, weight: "500" }, maxRotation: 30 },
          grid: { display: false },
        },
      },
    },
  });
}

function updateBotanicaLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">ბოტანიკურ-აგრონომიული ზონები</div>';
  html += '<div class="ethnics-legend">';
  BOTANICA_TYPES.forEach(function (t) {
    html +=
      '<div class="legend-item" style="margin-bottom:4px;">' +
      '<span style="display:inline-block;width:14px;height:14px;background:' +
      t.color +
      ';border:1px solid #999;flex-shrink:0;margin-right:6px;vertical-align:middle;"></span>' +
      '<span style="font-size:10px;vertical-align:middle;">' +
      t.label +
      "</span></div>";
  });
  html += "</div>";
  el.innerHTML = html;
}

// ============================================================
// ეკონომიკა — ელექტროენერგეტიკა
// ============================================================
var energetikaLayer = null;

var energetikaData = null;

// სიმძლავრის მიხედვით რადიუსი (proportional — გაძლიერებული კონტრასტი)
function getPowerRadius(mw) {
  // sqrt-scale უფრო დიდი მამრავლით — მეტი სხვაობა დიდსა და პატარას შორის
  var r = 3.5 + Math.sqrt(mw) * 2.1;
  return Math.min(r, 40);
}

function loadEnergetika() {
  loadNatureMuniCenters();
  if (energetikaData) {
    buildEnergetikaLayer(energetikaData);
    return;
  }
  fetch("data/energetika.geojson")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      energetikaData = d;
      buildEnergetikaLayer(d);
    });
}

function buildEnergetikaLayer(data) {
  if (energetikaLayer) map.removeLayer(energetikaLayer);

  // დიდი → პატარა დალაგება, რომ პატარები ზემოდან იყოს
  var sorted = data.features.slice().sort(function (a, b) {
    return b.properties.Power - a.properties.Power;
  });

  energetikaLayer = L.geoJSON(
    { type: "FeatureCollection", features: sorted },
    {
      pointToLayer: function (feat, latlng) {
        var p = feat.properties;
        var r = getPowerRadius(p.Power);
        var marker;
        if (p.TKey === "thermal") {
          // თბოელექტროსადგური — იისფერი კვადრატი (იგივე ფართობის შკალა)
          var size = r * 1.8;
          var icon = L.divIcon({
            html:
              '<div style="width:' +
              size +
              "px;height:" +
              size +
              'px;background:#B57FC4;border:1.6px solid #7A4A8A;opacity:0.82;box-sizing:border-box;"></div>',
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
            className: "",
          });
          marker = L.marker(latlng, { icon: icon });
        } else {
          // ჰიდროელექტროსადგური — ცისფერი წრე
          marker = L.circleMarker(latlng, {
            radius: r,
            fillColor: "#5BA3D0",
            color: "#2B6A9A",
            weight: 1.3,
            fillOpacity: 0.72,
          });
        }
        marker.bindTooltip(p.Name_Geo + " (" + p.Power + " მვტ)", {
          direction: "top",
          className: "village-label",
          offset: [0, -getPowerRadius(p.Power) - 2],
        });
        marker.on("click", function () {
          showInfoEnergetika(p);
          showBottomChartEnergetika(data);
        });
        return marker;
      },
    },
  ).addTo(map);
  updateEnergetikaLegend();
  setInfoBtn("energetika");
}

function showInfoEnergetika(p) {
  var color = p.TKey === "thermal" ? "#B57FC4" : "#5BA3D0";
  var sym =
    p.TKey === "thermal"
      ? '<span style="display:inline-block;width:14px;height:14px;background:#B57FC4;border:1.5px solid #7A4A8A;"></span>'
      : '<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#5BA3D0;border:1.5px solid #2B6A9A;"></span>';
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;font-weight:700;">' +
    p.Name_Geo +
    "</div>" +
    '<div style="margin:6px 0;display:flex;align-items:center;gap:8px;">' +
    sym +
    '<span class="info-type-badge" style="background:' +
    color +
    "22;color:" +
    color +
    ";border:1px solid " +
    color +
    '66;">' +
    p.Type_Geo +
    "</span></div>" +
    '<div style="margin-top:6px;font-size:11px;color:var(--text-muted);line-height:1.7;">' +
    "<b>დადგმული სიმძლავრე:</b> " +
    p.Power +
    " მვტ</div>";
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartEnergetika(data) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

  // ჯამური სიმძლავრე ტიპების მიხედვით
  var hydroSum = 0,
    thermalSum = 0,
    hydroN = 0,
    thermalN = 0;
  data.features.forEach(function (f) {
    if (f.properties.TKey === "thermal") {
      thermalSum += f.properties.Power;
      thermalN++;
    } else {
      hydroSum += f.properties.Power;
      hydroN++;
    }
  });

  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: [
        "ჰიდროელექტრო (" + hydroN + ")",
        "თბოელექტრო (" + thermalN + ")",
      ],
      datasets: [
        {
          label: "სიმძლავრე (მვტ)",
          data: [Math.round(hydroSum), Math.round(thermalSum)],
          backgroundColor: ["#5BA3D0CC", "#B57FC4CC"],
          borderColor: ["#2B6A9A", "#7A4A8A"],
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
          text: "ელექტროსადგურების დადგმული სიმძლავრე (მვტ)",
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: {
            label: function (c) {
              return " " + c.parsed.y.toLocaleString() + " მვტ";
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { font: { family: "Fira Sans", size: 10, weight: "500" } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 11, weight: "500" } },
          grid: { display: false },
        },
      },
    },
  });
}

// ჩალაგებული წრეების ლეგენდა პროპორციული სიმბოლოებისთვის
function nestedCircleLegend(values, radiusFn, fill, stroke) {
  var radii = values.map(radiusFn);
  var rMax = Math.max.apply(null, radii);
  var cx = rMax + 2;
  var baseY = rMax * 2 + 4;
  var w = Math.round(cx + rMax + 52);
  var h = Math.round(baseY + 6);

  var svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h +
    '" viewBox="0 0 ' + w + " " + h + '" style="overflow:visible;">';
  radii.forEach(function (r) {
    var cy = baseY - r;
    svg +=
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r +
      '" fill="' + fill + '" fill-opacity="0.22" stroke="' + stroke +
      '" stroke-width="1.1"/>';
  });
  radii.forEach(function (r, i) {
    var top = baseY - r * 2;
    svg +=
      '<line x1="' + cx + '" y1="' + top + '" x2="' + (cx + rMax + 8) +
      '" y2="' + top + '" stroke="' + stroke +
      '" stroke-width="0.8" stroke-dasharray="2,2" opacity="0.7"/>' +
      '<text x="' + (cx + rMax + 11) + '" y="' + (top + 3.5) +
      '" font-size="9" fill="#555" font-family="Fira Sans">' + values[i] + "</text>";
  });
  svg += "</svg>";
  return '<div style="padding:2px 0 4px 2px;">' + svg + "</div>";
}

function updateEnergetikaLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">ელექტროენერგეტიკა</div>';
  html += '<div class="ethnics-legend">';
  // ტიპები
  html +=
    '<div class="eth-legend-item" style="margin-bottom:6px;align-items:center;">' +
    '<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#5BA3D0;border:1.3px solid #2B6A9A;margin-right:6px;"></span>' +
    '<span style="font-size:10px;">ჰიდროელექტროსადგური</span></div>';
  html +=
    '<div class="eth-legend-item" style="margin-bottom:6px;align-items:center;">' +
    '<span style="display:inline-block;width:14px;height:14px;background:#B57FC4;border:1.3px solid #7A4A8A;margin-right:6px;"></span>' +
    '<span style="font-size:10px;">თბოელექტროსადგური</span></div>';
  html += "</div>";
  // სიმძლავრის შკალა
  html +=
    '<div style="margin-top:10px;font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">დადგმული სიმძლავრე (მვტ)</div>';
  // ჩალაგებული (nested) წრეები — კარტოგრაფიული სტანდარტი,
  // ვიწრო პანელშიც ეტევა და არაფერი იჭრება
  html += nestedCircleLegend([300, 100, 14, 1], getPowerRadius, "#5BA3D0", "#2B6A9A");
  el.innerHTML = html;
}

// ============================================================
// ეკონომიკა — კულტურულ მცენარეთა ზონები (ნ. კეცხოველი)
// ============================================================
var cropZonesLayer = null;

var cropZonesData = null;

var CROP_ZONES = [
  {
    key: "მევენახეობის (სუფრისა და შემაგრებული ღვინოები), მშრალი სუბტროპიკული მეხილეობის ზონა",
    color: "#F2ACC6",
    short: "მევენახეობა-მშრ. სუბტროპ. მეხილეობა",
  },
  {
    key: "მევენახეობის (სუფრისა და შამპანური ღვინოები), მებოსტნეობისა და კონტინენტური მეხილეობის ზონა",
    color: "#F9C7D5",
    short: "მევენახეობა-მებოსტნ.-კონტ. მეხილ.",
  },
  {
    key: "კონტინენტური მეხილეობისა და მემინდვრეობის ზონა",
    color: "#F4E9B7",
    short: "კონტ. მეხილეობა-მემინდვრეობა",
  },
  {
    key: "საშუალო მთის მეტყევეობის ზონა",
    color: "#9ACC67",
    short: "საშ. მთის მეტყევეობა",
  },
  {
    key: "მემინდვრეობისა და მსხვილფეხა მესაქონლეობის ზონა",
    color: "#DFC58C",
    short: "მემინდვრეობა-მესაქონლეობა",
  },
  { key: "სათიბ-საძოვრების ზონა", color: "#C3AC3B", short: "სათიბ-საძოვრები" },
];

function loadCropZones() {
  loadNatureMuniCenters();
  if (cropZonesData) {
    buildCropZonesLayer(cropZonesData);
    return;
  }
  fetch("data/crop_zones.geojson")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      cropZonesData = d;
      buildCropZonesLayer(d);
    });
}

function buildCropZonesLayer(data) {
  if (cropZonesLayer) map.removeLayer(cropZonesLayer);
  cropZonesLayer = L.geoJSON(data, {
    style: function (feat) {
      return {
        fillColor: feat.properties.Color,
        fillOpacity: 0.62,
        color: "#7a7a6a",
        weight: 0.8,
        opacity: 0.6,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      layer.bindTooltip(p.Type_Geo, {
        direction: "center",
        className: "village-label",
        sticky: true,
      });
      layer.on("click", function () {
        showInfoCropZone(p);
        showBottomChartCropZones(data);
      });
    },
  }).addTo(map);
  updateCropZonesLegend();
  setInfoBtn("crop_zones");
}

function showInfoCropZone(p) {
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:12px;font-weight:700;line-height:1.4;">' +
    p.Type_Geo +
    "</div>" +
    '<span class="info-type-badge" style="background:' +
    p.Color +
    "66;color:#555;border:1px solid " +
    p.Color +
    ';margin-top:6px;">კულტ. მცენ. ზონა</span>' +
    '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);line-height:1.7;">' +
    "<b>ფართობი:</b> " +
    p.Area_km2.toLocaleString() +
    " კმ²</div>";
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartCropZones(data) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

  var areas = {};
  CROP_ZONES.forEach(function (z) {
    areas[z.key] = 0;
  });
  data.features.forEach(function (f) {
    var t = f.properties.Type_Geo;
    if (areas[t] !== undefined) areas[t] += f.properties.Area_km2;
  });

  // დიდიდან პატარისკენ
  var sorted = CROP_ZONES.slice().sort(function (a, b) {
    return areas[b.key] - areas[a.key];
  });
  var labels = sorted.map(function (z) {
    return z.short;
  });

  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "ფართობი (კმ²)",
          data: sorted.map(function (z) {
            return Math.round(areas[z.key]);
          }),
          backgroundColor: sorted.map(function (z) {
            return z.color + "DD";
          }),
          borderColor: sorted.map(function (z) {
            return z.color;
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
          text: "კულტურულ მცენარეთა ზონები — ფართობი (კმ²)",
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
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
          ticks: { font: { family: "Fira Sans", size: 10, weight: "500" } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 11, weight: "500" }, maxRotation: 40 },
          grid: { display: false },
        },
      },
    },
  });
}

function updateCropZonesLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">კულტურულ მცენარეთა ზონები</div>';
  html += '<div class="ethnics-legend">';
  CROP_ZONES.forEach(function (z) {
    html +=
      '<div class="legend-item" style="margin-bottom:5px;align-items:flex-start;">' +
      '<span style="display:inline-block;width:14px;height:14px;background:' +
      z.color +
      ';border:1px solid #999;flex-shrink:0;margin-right:6px;margin-top:1px;"></span>' +
      '<span style="font-size:9.5px;line-height:1.35;">' +
      z.key +
      "</span></div>";
  });
  html += "</div>";
  el.innerHTML = html;
}

// ============================================================
// ეკონომიკა — სასოფლო-სამეურნეო მიწა (3 თემა, switcher-ით)
// ============================================================
var landLayer = null;

var landData = null;

var activeLandTheme = "ownership"; // ownership | status | usage

// თემების კონფიგურაცია
var LAND_THEMES = {
  ownership: {
    label: "საკუთრების ფორმა",
    field: "PrivateOwn",
    unit: "%",
    title: "სასოფლო-სამეურნეო მიწა კერძო საკუთრებაში (%)",
    // choropleth კერძო საკუთრების %-ის მიხედვით
    stops: [
      [30, "#FCE8C8"],
      [45, "#F5C97A"],
      [55, "#E89B43"],
      [60, "#D4731E"],
      [100, "#A8500A"],
    ],
  },
  status: {
    label: "მეურნეობების რაოდენობა",
    field: "Household",
    unit: "",
    title: "შინამეურნეობების რაოდენობა",
    stops: [
      [3000, "#E0ECF4"],
      [6000, "#A8C9E0"],
      [12000, "#6BA3CC"],
      [18000, "#3576B5"],
      [99999, "#1A4E8A"],
    ],
  },
  usage: {
    label: "სახნავი მიწა",
    field: "Arable",
    unit: " ჰა",
    title: "სახნავი მიწის ფართობი (ჰა)",
    stops: [
      [1000, "#E8F0DC"],
      [4000, "#C0D89A"],
      [8000, "#8FBB5C"],
      [12000, "#5C9434"],
      [99999, "#356B1A"],
    ],
  },
};

function getLandColor(val, stops) {
  for (var i = 0; i < stops.length; i++) {
    if (val <= stops[i][0]) return stops[i][1];
  }
  return stops[stops.length - 1][1];
}

function loadLand() {
  loadNatureMuniCenters();
  if (landData) {
    buildLandLayer(landData);
    return;
  }
  loadMuniData("data/muni/land.json")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      landData = d;
      buildLandLayer(d);
    });
}

function buildLandLayer(data) {
  if (landLayer) map.removeLayer(landLayer);
  var theme = LAND_THEMES[activeLandTheme];
  landLayer = L.geoJSON(data, {
    style: function (feat) {
      var val = feat.properties[theme.field];
      return {
        fillColor: getLandColor(val, theme.stops),
        fillOpacity: 0.72,
        color: "#fff",
        weight: 1.2,
        opacity: 0.9,
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
        showInfoLand(p);
        showBottomChartLand(data);
      });
    },
  }).addTo(map);
  if (muniBorderOverlay) muniBorderOverlay.bringToFront();
  updateLandLegend();
  setInfoBtn("land");
}

function showInfoLand(p) {
  var html =
    '<div class="info-name" style="font-size:13px;font-weight:700;">' +
    p.Name_Geo +
    " (მუნიციპალიტეტი)</div>";
  // საკუთრება
  html +=
    '<div style="margin-top:8px;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;">საკუთრების ფორმა</div>';
  html +=
    '<div style="font-size:10px;color:#444;line-height:1.7;">' +
    "<b>კერძო:</b> " +
    p.PrivateOwn +
    "%  |  <b>სახელმწიფო:</b> " +
    p.StateOwn +
    "%</div>";
  // მეურნეობები
  html +=
    '<div style="margin-top:6px;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;">მეურნეობები</div>';
  html +=
    '<div style="font-size:10px;color:#444;line-height:1.7;">' +
    "<b>შინამეურნ.:</b> " +
    p.Household.toLocaleString() +
    "  |  <b>იურიდ.:</b> " +
    p.LegalFarm +
    "</div>";
  // მიწათსარგებლობა
  html +=
    '<div style="margin-top:6px;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;">მიწათსარგებლობა (ჰა)</div>';
  html +=
    '<div style="font-size:10px;color:#444;line-height:1.7;">' +
    "<b>სახნავი:</b> " +
    p.Arable.toLocaleString() +
    "  |  <b>საძოვარი:</b> " +
    p.NaturalPa.toLocaleString() +
    "<br>" +
    "<b>მრავალწლ.:</b> " +
    p.Perennial.toLocaleString() +
    "  |  <b>სათბური:</b> " +
    p.Greenhouse +
    "</div>";
  document.getElementById("infoCardContent").innerHTML = html;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartLand(data) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

  var theme = LAND_THEMES[activeLandTheme];
  var feats = data.features.slice().sort(function (a, b) {
    return b.properties[theme.field] - a.properties[theme.field];
  });
  var labels = feats.map(function (f) {
    return f.properties.Name_Geo;
  });
  var vals = feats.map(function (f) {
    return f.properties[theme.field];
  });
  var colors = feats.map(function (f) {
    return getLandColor(f.properties[theme.field], theme.stops);
  });

  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: theme.label,
          data: vals,
          backgroundColor: colors.map(function (c) {
            return c + "DD";
          }),
          borderColor: colors,
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
          text: theme.title,
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: {
            label: function (c) {
              return " " + c.parsed.y.toLocaleString() + theme.unit;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { font: { family: "Fira Sans", size: 10, weight: "500" } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 11, weight: "500" }, maxRotation: 35 },
          grid: { display: false },
        },
      },
    },
  });
}

function updateLandLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var theme = LAND_THEMES[activeLandTheme];
  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">' +
    theme.title +
    "</div>";
  // choropleth scale
  html += '<div class="ethnics-legend">';
  var prev = 0;
  theme.stops.forEach(function (stop, i) {
    var rangeLabel;
    if (i === theme.stops.length - 1) rangeLabel = "> " + prev.toLocaleString();
    else rangeLabel = prev.toLocaleString() + "–" + stop[0].toLocaleString();
    html +=
      '<div class="eth-legend-item" style="margin-bottom:4px;">' +
      '<span class="eth-dot" style="background:' +
      stop[1] +
      ';border:1px solid rgba(0,0,0,0.15);border-radius:3px;"></span>' +
      '<span style="font-size:10px;">' +
      rangeLabel +
      theme.unit +
      "</span></div>";
    prev = stop[0];
  });
  html += "</div>";
  // theme switcher (year-btn style)
  html +=
    '<div style="margin-top:12px;"><div style="font-size:9px;font-weight:700;color:var(--text-muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;">თემა</div>';
  html += '<div style="display:flex;flex-direction:column;gap:5px;">';
  [
    ["ownership", "საკუთრების ფორმა"],
    ["status", "მეურნ. რაოდენობა"],
    ["usage", "სახნავი მიწა"],
  ].forEach(function (pair) {
    var active = activeLandTheme === pair[0] ? "active" : "";
    html +=
      '<button class="year-btn land-theme-btn ' +
      active +
      '" data-landtheme="' +
      pair[0] +
      '" style="text-align:left;">' +
      pair[1] +
      "</button>";
  });
  html += "</div></div>";
  el.innerHTML = html;

  // attach handlers
  el.querySelectorAll(".land-theme-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      activeLandTheme = this.dataset.landtheme;
      if (landData) buildLandLayer(landData);
      if (landData) showBottomChartLand(landData);
    });
  });
}

// ============================================================
// ეკონომიკა — მზის ნათება (პოლიგონი + სადგურები)
// ============================================================
var sunZoneLayer = null;

var sunStationLayer = null;

var sunData = null;

var SUN_ZONES = [
  { key: ">2500", color: "#F26437" },
  { key: "2400-2500", color: "#F89934" },
  { key: "2300-2400", color: "#FCBA78" },
  { key: "2200-2300", color: "#FADB30" },
  { key: "2100-2200", color: "#FEE588" },
  { key: "2000-2100", color: "#EEC98D" },
  { key: "<2000", color: "#EEC98D" },
];

var SUN_STATION_TYPES = [
  { key: "მონასტერი", color: "#2C3E50" },
  { key: "აგროსფერო", color: "#27AE60" },
  { key: "სკოლა", color: "#8E44AD" },
  { key: "ნაგავსაყრელი", color: "#7F8C8D" },
  { key: "ტექნოლოგიური სადგ", color: "#16A085" },
  { key: "კერძო სახლი", color: "#E67E22" },
  { key: "დაცული ტერიტორია", color: "#229954" },
];

var SUN_PANEL_SVG = {
  "0-100": {
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7 12.65" width="14.4" height="26"><path fill="#F89521" d="M2.55,0.37L2.29,1.55L1.07,1.31l0.37,1.13L0.22,2.81L1.2,3.58l-0.88,0.9l1.23,0.22l-0.3,1.17l1.21-0.4 l0.37,1.14l0.66-0.78c0,0-0.13-0.25-0.33-0.44C2.67,4.95,1.99,4.48,2.04,3.74C2.09,3.1,2.59,2.49,3.2,2.29l0.04-0.01 c0.6-0.16,1.31,0.04,1.71,0.5c0.48,0.57,0.22,1.35,0.09,1.99C4.97,5.05,5.02,5.33,5.02,5.33l1,0.24L5.64,4.43l0.52,0.14l-0.24-1.3 l0.86-0.91l-1.25-0.2l0.33-1.2l-1.2,0.43L4.28,0.26L3.45,1.17L2.55,0.37z"/> <rect x="2.57" y="3.29" fill="#127DC2" width="2.27" height="4.5"/> <rect x="2.57" y="3.29" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="4.5"/> <rect x="2.57" y="7.89" fill="#127DC2" width="2.27" height="4.5"/> <rect x="2.57" y="7.89" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="4.5"/></svg>',
    w: 14.4,
    h: 26,
  },
  "101-500": {
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8.69 16.06" width="17.3" height="32"><path fill="#F89521" d="M3.16,0.51L2.83,1.98l-1.51-0.3l0.47,1.42L0.25,3.55l1.22,0.96l-1.1,1.13L1.9,5.92L1.53,7.38l1.51-0.5 l0.47,1.42l0.83-0.98c0,0-0.16-0.31-0.42-0.55c-0.6-0.55-1.46-1.14-1.39-2.07c0.06-0.8,0.68-1.56,1.44-1.81l0.04-0.01 c0.74-0.2,1.63,0.05,2.13,0.63c0.61,0.71,0.27,1.69,0.11,2.49C6.19,6.36,6.25,6.7,6.25,6.7L7.5,7L7.03,5.58l0.64,0.17l-0.3-1.62 l1.07-1.13L6.88,2.74l0.41-1.5l-1.5,0.54L5.32,0.36L4.28,1.5L3.16,0.51z"/> <rect x="5.57" y="3.98" fill="#127DC2" width="2.27" height="5.81"/> <rect x="5.57" y="3.98" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="5.81"/> <rect x="5.57" y="9.9" fill="#127DC2" width="2.27" height="5.81"/> <rect x="5.57" y="9.9" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="5.81"/> <rect x="3.07" y="3.98" fill="#127DC2" width="2.27" height="5.81"/> <rect x="3.07" y="3.98" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="5.81"/> <rect x="3.07" y="9.9" fill="#127DC2" width="2.27" height="5.81"/> <rect x="3.07" y="9.9" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="5.81"/></svg>',
    w: 17.3,
    h: 32,
  },
  "501-1000": {
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11.09 19.41" width="22.9" height="40"><path fill="#F89521" d="M3.83,0.32L3.42,2.16L1.52,1.78L2.1,3.55L0.19,4.13l1.52,1.2L0.34,6.74l1.92,0.35L1.79,8.92L3.68,8.3 l0.58,1.78L5.3,8.85c0,0-0.2-0.39-0.52-0.68C4.02,7.48,2.95,6.74,3.04,5.57c0.07-1,0.85-1.95,1.8-2.26L4.9,3.3 c0.93-0.25,2.04,0.06,2.66,0.79C8.32,4.97,7.9,6.2,7.7,7.2C7.61,7.63,7.69,8.06,7.69,8.06l1.56,0.37L8.66,6.66l0.8,0.21L9.09,4.84 l1.34-1.42L8.48,3.11l0.51-1.87L7.11,1.91L6.53,0.14l-1.3,1.43L3.83,0.32z"/> <rect x="8.63" y="4.71" fill="#127DC2" width="2.27" height="7.21"/> <rect x="8.63" y="4.71" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="7.21"/> <rect x="8.63" y="12.06" fill="#127DC2" width="2.27" height="7.21"/> <rect x="8.63" y="12.06" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="7.21"/> <rect x="6.13" y="4.71" fill="#127DC2" width="2.27" height="7.21"/> <rect x="6.13" y="4.71" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="7.21"/> <rect x="6.13" y="12.06" fill="#127DC2" width="2.27" height="7.21"/> <rect x="6.13" y="12.06" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="7.21"/> <rect x="3.64" y="4.71" fill="#127DC2" width="2.27" height="7.21"/> <rect x="3.64" y="4.71" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="7.21"/> <rect x="3.64" y="12.06" fill="#127DC2" width="2.27" height="7.21"/> <rect x="3.64" y="12.06" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="7.21"/></svg>',
    w: 22.9,
    h: 40,
  },
  "1001-2000": {
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14.6 24.3" width="30.0" height="50"><path fill="#F89521" d="M4.83,0.45L4.32,2.74L1.95,2.27l0.73,2.21L0.29,5.2l1.91,1.5L0.47,8.47l2.4,0.43l-0.59,2.28l2.36-0.78 l0.73,2.22l1.3-1.53c0,0-0.25-0.49-0.65-0.86C5.07,9.39,3.74,8.47,3.84,7.01C3.93,5.76,4.9,4.58,6.1,4.19l0.07-0.02 C7.33,3.86,8.72,4.25,9.5,5.15c0.95,1.11,0.42,2.65,0.17,3.89c-0.11,0.54-0.02,1.08-0.02,1.08l1.95,0.46l-0.73-2.22l1.01,0.27 L11.41,6.1l1.67-1.77l-2.43-0.4l0.64-2.34L8.94,2.43L8.21,0.21L6.58,2L4.83,0.45z"/> <rect x="12.04" y="5.95" fill="#127DC2" width="2.27" height="8.98"/> <rect x="12.04" y="5.95" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="8.98"/> <rect x="12.04" y="15.1" fill="#127DC2" width="2.27" height="8.98"/> <rect x="12.04" y="15.11" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="8.98"/> <rect x="9.54" y="5.95" fill="#127DC2" width="2.27" height="8.98"/> <rect x="9.54" y="5.95" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="8.98"/> <rect x="9.54" y="15.1" fill="#127DC2" width="2.27" height="8.98"/> <rect x="9.54" y="15.11" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="8.98"/> <rect x="7.04" y="5.95" fill="#127DC2" width="2.27" height="8.98"/> <rect x="7.04" y="5.95" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="8.98"/> <rect x="7.04" y="15.1" fill="#127DC2" width="2.27" height="8.98"/> <rect x="7.04" y="15.11" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="8.98"/> <rect x="4.55" y="5.95" fill="#127DC2" width="2.27" height="8.98"/> <rect x="4.55" y="5.95" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="8.98"/> <rect x="4.55" y="15.1" fill="#127DC2" width="2.27" height="8.98"/> <rect x="4.55" y="15.11" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="8.98"/></svg>',
    w: 30.0,
    h: 50,
  },
  "2001-3000": {
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18.69 30.24" width="37.1" height="60"><path fill="#F89521" d="M6.05,0.51L5.41,3.38L2.45,2.79l0.91,2.76l-2.98,0.9l2.38,1.88L0.6,10.55l3,0.54l-0.73,2.85l2.95-0.97 l0.91,2.77l1.62-1.91c0,0-0.31-0.61-0.82-1.07c-1.18-1.07-2.85-2.23-2.72-4.05c0.11-1.56,1.33-3.04,2.82-3.53l0.09-0.02 c1.45-0.39,3.19,0.09,4.16,1.23c1.18,1.38,0.53,3.31,0.22,4.87c-0.13,0.67-0.02,1.35-0.02,1.35l2.44,0.58l-0.91-2.78l1.26,0.34 l-0.59-3.17l2.09-2.21l-3.04-0.5l0.8-2.93l-2.94,1.05l-0.91-2.76L8.24,2.45L6.05,0.51z"/> <rect x="13.55" y="7.53" fill="#127DC2" width="2.27" height="11.14"/> <rect x="13.55" y="7.53" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="11.13"/> <rect x="13.55" y="18.88" fill="#127DC2" width="2.27" height="11.14"/> <rect x="13.55" y="18.88" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="11.13"/> <rect x="11.05" y="7.53" fill="#127DC2" width="2.27" height="11.14"/> <rect x="11.05" y="7.53" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="11.13"/> <rect x="11.05" y="18.88" fill="#127DC2" width="2.27" height="11.14"/> <rect x="11.05" y="18.88" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="11.13"/> <rect x="16.04" y="7.53" fill="#127DC2" width="2.27" height="11.14"/> <rect x="16.04" y="7.53" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="11.13"/> <rect x="16.04" y="18.88" fill="#127DC2" width="2.27" height="11.14"/> <rect x="16.04" y="18.88" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="11.13"/> <rect x="8.55" y="7.53" fill="#127DC2" width="2.27" height="11.14"/> <rect x="8.55" y="7.53" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="11.13"/> <rect x="8.55" y="18.88" fill="#127DC2" width="2.27" height="11.14"/> <rect x="8.55" y="18.88" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="11.13"/> <rect x="6.05" y="7.53" fill="#127DC2" width="2.27" height="11.14"/> <rect x="6.05" y="7.53" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="11.13"/> <rect x="6.05" y="18.88" fill="#127DC2" width="2.27" height="11.14"/> <rect x="6.05" y="18.88" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="11.13"/></svg>',
    w: 37.1,
    h: 60,
  },
  "3001-10000": {
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21.56 38.1" width="40.7" height="72"><path fill="#F89521" d="M7.41,0.6L6.6,4.19L2.9,3.46l1.14,3.46L0.31,8.04l2.98,2.35l-2.69,2.76l3.75,0.68l-0.91,3.57l3.69-1.21 l1.14,3.47l2.03-2.39c0,0-0.39-0.76-1.02-1.34c-1.47-1.34-3.56-2.79-3.39-5.06C6,8.91,7.52,7.06,9.39,6.45L9.5,6.42 c1.82-0.48,3.99,0.12,5.2,1.54c1.48,1.73,0.66,4.13,0.27,6.09c-0.17,0.84-0.03,1.68-0.03,1.68l3.05,0.72l-1.14-3.47l1.57,0.42 l-0.74-3.96l2.61-2.77l-3.8-0.62l1-3.66L13.82,3.7l-1.14-3.46l-2.54,2.78L7.41,0.6z"/> <rect x="16.48" y="9.27" fill="#127DC2" width="2.27" height="14.16"/> <rect x="16.48" y="9.27" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="14.16"/> <rect x="16.48" y="23.7" fill="#127DC2" width="2.27" height="14.16"/> <rect x="16.48" y="23.7" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="14.16"/> <rect x="13.98" y="9.27" fill="#127DC2" width="2.27" height="14.16"/> <rect x="13.98" y="9.27" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="14.16"/> <rect x="13.98" y="23.7" fill="#127DC2" width="2.27" height="14.16"/> <rect x="13.98" y="23.7" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="14.16"/> <rect x="18.98" y="9.27" fill="#127DC2" width="2.27" height="14.16"/> <rect x="18.98" y="9.27" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="14.16"/> <rect x="18.98" y="23.7" fill="#127DC2" width="2.27" height="14.16"/> <rect x="18.98" y="23.7" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="14.16"/> <rect x="11.49" y="9.27" fill="#127DC2" width="2.27" height="14.16"/> <rect x="11.49" y="9.27" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="14.16"/> <rect x="11.49" y="23.7" fill="#127DC2" width="2.27" height="14.16"/> <rect x="11.49" y="23.7" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="14.16"/> <rect x="8.99" y="9.27" fill="#127DC2" width="2.27" height="14.16"/> <rect x="8.99" y="9.27" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="14.16"/> <rect x="8.99" y="23.7" fill="#127DC2" width="2.27" height="14.16"/> <rect x="8.99" y="23.7" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="14.16"/> <rect x="6.49" y="9.27" fill="#127DC2" width="2.27" height="14.16"/> <rect x="6.49" y="9.27" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="14.16"/> <rect x="6.49" y="23.7" fill="#127DC2" width="2.27" height="14.16"/> <rect x="6.49" y="23.7" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="14.16"/></svg>',
    w: 40.7,
    h: 72,
  },
  20000: {
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 27.47 54.64" width="47.8" height="95"><path fill="#F89521" d="M9.92,0.9L8.85,5.63L3.97,4.66l1.5,4.56l-4.93,1.48l3.93,3.1l-3.56,3.64l4.94,0.89l-1.21,4.71l4.87-1.6 l1.51,4.58l2.67-3.15c0,0-0.51-1-1.35-1.77c-1.94-1.77-4.7-3.68-4.48-6.68c0.19-2.57,2.19-5.02,4.65-5.83l0.15-0.04 c2.4-0.64,5.26,0.15,6.87,2.03c1.96,2.28,0.87,5.46,0.36,8.03c-0.22,1.11-0.04,2.22-0.04,2.22l4.02,0.95l-1.51-4.58l2.07,0.55 l-0.97-5.23l3.45-3.65L21.9,8.08l1.32-4.83l-4.84,1.73l-1.5-4.56l-3.36,3.67L9.92,0.9z"/> <rect x="21.41" y="12.26" fill="#127DC2" width="2.27" height="20.78"/> <rect x="21.41" y="12.26" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="20.78"/> <rect x="21.41" y="33.44" fill="#127DC2" width="2.27" height="20.78"/> <rect x="21.41" y="33.44" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="20.78"/> <rect x="18.91" y="12.26" fill="#127DC2" width="2.27" height="20.78"/> <rect x="18.91" y="12.26" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="20.78"/> <rect x="18.91" y="33.44" fill="#127DC2" width="2.27" height="20.78"/> <rect x="18.91" y="33.44" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="20.78"/> <rect x="23.91" y="12.26" fill="#127DC2" width="2.27" height="20.78"/> <rect x="23.91" y="12.26" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="20.78"/> <rect x="23.91" y="33.44" fill="#127DC2" width="2.27" height="20.78"/> <rect x="23.91" y="33.44" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="20.78"/> <rect x="16.42" y="12.26" fill="#127DC2" width="2.27" height="20.78"/> <rect x="16.42" y="12.26" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="20.78"/> <rect x="16.42" y="33.44" fill="#127DC2" width="2.27" height="20.78"/> <rect x="16.42" y="33.44" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="20.78"/> <rect x="13.92" y="12.26" fill="#127DC2" width="2.27" height="20.78"/> <rect x="13.92" y="12.26" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="20.78"/> <rect x="13.92" y="33.44" fill="#127DC2" width="2.27" height="20.78"/> <rect x="13.92" y="33.44" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="20.78"/> <rect x="11.42" y="12.26" fill="#127DC2" width="2.27" height="20.78"/> <rect x="11.42" y="12.26" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="20.78"/> <rect x="11.42" y="33.44" fill="#127DC2" width="2.27" height="20.78"/> <rect x="11.42" y="33.44" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="20.78"/> <rect x="8.89" y="12.26" fill="#127DC2" width="2.27" height="20.78"/> <rect x="8.89" y="12.26" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="20.78"/> <rect x="8.89" y="33.44" fill="#127DC2" width="2.27" height="20.78"/> <rect x="8.89" y="33.44" fill="none" stroke="#fff" stroke-width="0.18" width="2.27" height="20.78"/></svg>',
    w: 47.8,
    h: 95,
  },
};

// სიმძლავრის კლასები → რადიუსი (PDF-ის proportional)
var SUN_POWER_RADIUS = {
  "0-100": 3.5,
  "101-500": 5,
  "501-1000": 7,
  "1001-2000": 9,
  "2001-3000": 11,
  "3001-10000": 14,
  20000: 18,
};

function loadSun() {
  loadNatureMuniCenters();
  if (sunData) {
    buildSunLayers(sunData);
    return;
  }
  fetch("data/sun.geojson")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      sunData = d;
      buildSunLayers(d);
    });
}

function buildSunLayers(data) {
  if (sunZoneLayer) {
    map.removeLayer(sunZoneLayer);
    sunZoneLayer = null;
  }
  if (sunStationLayer) {
    map.removeLayer(sunStationLayer);
    sunStationLayer = null;
  }

  var zones = {
    type: "FeatureCollection",
    features: data.features.filter(function (f) {
      return f.properties.ftype === "zone";
    }),
  };
  var stations = {
    type: "FeatureCollection",
    features: data.features.filter(function (f) {
      return f.properties.ftype === "station";
    }),
  };

  // მზის ნათების ზონები — choropleth
  sunZoneLayer = L.geoJSON(zones, {
    style: function (feat) {
      return {
        fillColor: feat.properties.Color,
        fillOpacity: 0.7,
        color: "#D49A6A",
        weight: 0.6,
        opacity: 0.5,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      layer.bindTooltip(p.Name_Geo + " საათი", {
        direction: "center",
        className: "village-label",
        sticky: true,
      });
      layer.on("click", function () {
        showInfoSunZone(p);
        showBottomChartSun(data);
      });
    },
  }).addTo(map);

  // მზის სადგურები — PDF-ის მზე+პანელის სიმბოლო (ზომა=სიმძლავრე)
  // დიდი → პატარა, რომ პატარები ზემოდან დარჩეს
  var sortedSt = stations.features.slice().sort(function (a, b) {
    return (
      (SUN_PANEL_SVG[b.properties.Power]
        ? SUN_PANEL_SVG[b.properties.Power].h
        : 0) -
      (SUN_PANEL_SVG[a.properties.Power]
        ? SUN_PANEL_SVG[a.properties.Power].h
        : 0)
    );
  });
  sunStationLayer = L.geoJSON(
    { type: "FeatureCollection", features: sortedSt },
    {
      pointToLayer: function (feat, latlng) {
        var p = feat.properties;
        var sym = SUN_PANEL_SVG[p.Power] || SUN_PANEL_SVG["0-100"];
        var dotR = 7; // ტიპის ფერადი წრე
        var totalH = sym.h + dotR * 2 + 2;
        var totalW = Math.max(sym.w, dotR * 2);
        // პანელის ხატულა ზემოთ + ფერადი წრე (ტიპი) ქვემოთ
        var html =
          '<div style="position:relative;width:' +
          totalW +
          "px;height:" +
          totalH +
          'px;">' +
          '<div style="position:absolute;top:0;left:50%;transform:translateX(-50%);">' +
          sym.svg +
          "</div>" +
          '<div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:' +
          dotR * 2 +
          "px;height:" +
          dotR * 2 +
          "px;border-radius:50%;background:" +
          p.Color +
          ";border:1.6px solid #fff;box-shadow:0 0 0 1px " +
          p.Color +
          ';"></div>' +
          "</div>";
        var icon = L.divIcon({
          html: html,
          iconSize: [totalW, totalH],
          iconAnchor: [totalW / 2, totalH - dotR], // ფერად წრეზე "დგას"
          className: "",
        });
        var marker = L.marker(latlng, { icon: icon });
        marker.bindTooltip(
          p.Name_Geo + " — " + p.Type_Geo + " (" + p.Power + " ვტ)",
          {
            direction: "top",
            className: "village-label",
            offset: [0, -totalH + dotR],
          },
        );
        marker.on("click", function () {
          showInfoSunStation(p);
          showBottomChartSun(data);
        });
        return marker;
      },
    },
  ).addTo(map);

  updateSunLegend();
  setInfoBtn("sun");
}

function showInfoSunZone(p) {
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;font-weight:700;">მზის ნათება: ' +
    p.Name_Geo +
    " საათი/წელ</div>" +
    '<span class="info-type-badge" style="background:' +
    p.Color +
    "88;color:#7a3a18;border:1px solid " +
    p.Color +
    ';">მზის ნათების ზონა</span>' +
    '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);line-height:1.6;">მზის ნათების წლიური ხანგრძლივობა საათებში</div>';
  document.getElementById("infoCard").classList.remove("hidden");
}

function showInfoSunStation(p) {
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;font-weight:700;">' +
    p.Name_Geo +
    "</div>" +
    '<div style="margin:6px 0;display:flex;align-items:center;gap:8px;">' +
    '<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:' +
    p.Color +
    ";border:1.3px solid #fff;box-shadow:0 0 0 1px " +
    p.Color +
    ';"></span>' +
    '<span class="info-type-badge" style="background:' +
    p.Color +
    "22;color:" +
    p.Color +
    ";border:1px solid " +
    p.Color +
    '66;">' +
    p.Type_Geo +
    "</span></div>" +
    '<div style="margin-top:6px;font-size:10px;color:var(--text-muted);line-height:1.7;">' +
    "<b>სიმძლავრე:</b> " +
    p.Power +
    " ვტ<br>" +
    "<b>მუნიციპალიტეტი:</b> " +
    (p.Municipal || "") +
    "</div>";
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartSun(data) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

  // სადგურები ტიპების მიხედვით
  var counts = {};
  SUN_STATION_TYPES.forEach(function (t) {
    counts[t.key] = 0;
  });
  data.features
    .filter(function (f) {
      return f.properties.ftype === "station";
    })
    .forEach(function (f) {
      var t = f.properties.Type_Geo;
      if (counts[t] !== undefined) counts[t]++;
    });

  var present = SUN_STATION_TYPES.filter(function (t) {
    return counts[t.key] > 0;
  });
  var labels = present.map(function (t) {
    return t.key;
  });

  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "სადგურები",
          data: present.map(function (t) {
            return counts[t.key];
          }),
          backgroundColor: present.map(function (t) {
            return t.color + "CC";
          }),
          borderColor: present.map(function (t) {
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
          text: "მზის ელექტროსადგურები ტიპების მიხედვით",
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: {
            label: function (c) {
              return " " + c.parsed.y + " სადგური";
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

function updateSunLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  // ნათების ზონები
  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">მზის ნათების წლიური ხანგრძლივობა (საათი)</div>';
  html += '<div class="ethnics-legend">';
  SUN_ZONES.forEach(function (z) {
    html +=
      '<div class="eth-legend-item" style="margin-bottom:3px;">' +
      '<span class="eth-dot" style="background:' +
      z.color +
      ';border:1px solid rgba(0,0,0,0.15);border-radius:3px;"></span>' +
      '<span style="font-size:10px;">' +
      z.key +
      "</span></div>";
  });
  html += "</div>";
  // სადგურების ტიპები
  html +=
    '<div style="margin-top:10px;font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">მომსახურების ობიექტები (ფერადი წრე)</div>';
  html += '<div class="ethnics-legend">';
  SUN_STATION_TYPES.forEach(function (t) {
    html +=
      '<div class="eth-legend-item" style="margin-bottom:3px;align-items:center;">' +
      '<span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:' +
      t.color +
      ";border:1px solid #fff;box-shadow:0 0 0 1px " +
      t.color +
      ';flex-shrink:0;margin-right:6px;"></span>' +
      '<span style="font-size:10px;">' +
      t.key +
      "</span></div>";
  });
  html += "</div>";
  // სიმძლავრის შკალა — ნამდვილი სიმბოლოებით
  html +=
    '<div style="margin-top:10px;font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">მზის ელექტროსადგურის სიმძლავრე (ვტ)</div>';
  html +=
    '<div style="display:flex;align-items:flex-end;gap:7px;flex-wrap:wrap;padding-left:4px;">';
  ["0-100", "101-500", "501-1000", "1001-2000", "20000"].forEach(
    function (key) {
      var sym = SUN_PANEL_SVG[key];
      html +=
        '<div style="display:flex;flex-direction:column;align-items:center;gap:3px;">' +
        '<span style="display:inline-flex;align-items:flex-end;height:' +
        sym.h +
        'px;">' +
        sym.svg +
        "</span>" +
        '<span style="font-size:8px;color:#555;">' +
        key +
        "</span></div>";
    },
  );
  html += "</div>";
  el.innerHTML = html;
}

// ============================================================
// ეკონომიკა — სოფლის მეურნეობის პროექტების ბენეფიციარები
// ============================================================
var agriLayer = null;

var agriMarkerLayer = null;

var agriData = null;

var AGRI_PROGRAMS = [
  { key: "AgroInsure", color: "#E8821A", label: "აგროდაზღვევა" },
  { key: "AgroCredit", color: "#9273B3", label: "შეღავათიანი აგროკრედიტი" },
  { key: "PlantFuture", color: "#C8394F", label: "დანერგე მომავალი" },
];

function loadAgri() {
  loadNatureMuniCenters();
  if (agriData) {
    buildAgriLayer(agriData);
    return;
  }
  loadMuniData("data/muni/agri_beneficiaries.json")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      agriData = d;
      buildAgriLayer(d);
    });
}

// აგრობენეფიციართა წრიული (donut) დიაგრამა
function makeAgriPieSVG(p, size) {
  var total = AGRI_PROGRAMS.reduce(function (s, pr) {
    return s + p[pr.key];
  }, 0);
  var cx = size / 2,
    cy = size / 2,
    r = size / 2 - 2;
  if (total === 0) {
    return (
      '<svg width="' +
      size +
      '" height="' +
      size +
      '" viewBox="0 0 ' +
      size +
      " " +
      size +
      '" xmlns="http://www.w3.org/2000/svg"><circle cx="' +
      cx +
      '" cy="' +
      cy +
      '" r="' +
      r +
      '" fill="#eee" stroke="#ccc" stroke-width="1"/></svg>'
    );
  }
  var startAngle = -Math.PI / 2;
  var paths = "";
  AGRI_PROGRAMS.forEach(function (pr) {
    var val = p[pr.key];
    if (val === 0) return;
    var angle = (val / total) * 2 * Math.PI;
    var endAngle = startAngle + angle;
    var x1 = cx + r * Math.cos(startAngle),
      y1 = cy + r * Math.sin(startAngle);
    var x2 = cx + r * Math.cos(endAngle),
      y2 = cy + r * Math.sin(endAngle);
    var largeArc = angle > Math.PI ? 1 : 0;
    // სრული წრის შემთხვევა
    if (val === total) {
      paths +=
        '<circle cx="' +
        cx +
        '" cy="' +
        cy +
        '" r="' +
        r +
        '" fill="' +
        pr.color +
        '" stroke="white" stroke-width="0.8"/>';
    } else {
      paths +=
        '<path d="M' +
        cx +
        "," +
        cy +
        " L" +
        x1 +
        "," +
        y1 +
        " A" +
        r +
        "," +
        r +
        " 0 " +
        largeArc +
        " 1 " +
        x2 +
        "," +
        y2 +
        ' Z" fill="' +
        pr.color +
        '" stroke="white" stroke-width="0.8"/>';
    }
    startAngle = endAngle;
  });
  return (
    '<svg width="' +
    size +
    '" height="' +
    size +
    '" viewBox="0 0 ' +
    size +
    " " +
    size +
    '" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="' +
    cx +
    '" cy="' +
    cy +
    '" r="' +
    r +
    '" fill="white" stroke="#ccc" stroke-width="1"/>' +
    paths +
    '<circle cx="' +
    cx +
    '" cy="' +
    cy +
    '" r="' +
    r * 0.42 +
    '" fill="white"/>' +
    "</svg>"
  );
}

function buildAgriLayer(data) {
  if (agriLayer) {
    map.removeLayer(agriLayer);
    agriLayer = null;
  }
  if (agriMarkerLayer) {
    map.removeLayer(agriMarkerLayer);
    agriMarkerLayer = null;
  }

  // მუნიციპალიტეტების მსუბუქი ფონი
  agriLayer = L.geoJSON(data, {
    style: function () {
      return {
        fillColor: "#F5F0E6",
        fillOpacity: 0.35,
        color: "#C4A878",
        weight: 1,
        opacity: 0.6,
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
        showInfoAgri(p);
        showBottomChartAgri(data);
      });
    },
  }).addTo(map);

  // total მნიშვნელობა მასშტაბისთვის (წრის ზომა)
  var maxTotal = 0;
  data.features.forEach(function (f) {
    var t = AGRI_PROGRAMS.reduce(function (s, pr) {
      return s + f.properties[pr.key];
    }, 0);
    if (t > maxTotal) maxTotal = t;
  });

  // თითო მუნიციპალიტეტზე — წრიული (donut) დიაგრამა
  var markers = [];
  data.features.forEach(function (f) {
    var p = f.properties;
    var total = AGRI_PROGRAMS.reduce(function (s, pr) {
      return s + p[pr.key];
    }, 0);
    // წრის ზომა total-ის პროპორციული (sqrt-scale), 44–86px
    var size = total > 0 ? 44 + Math.sqrt(total / maxTotal) * 42 : 44;
    var svg = makeAgriPieSVG(p, size);
    var html =
      '<div style="position:relative;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.25));">' +
      svg +
      '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:10px;font-weight:700;color:#222;font-family:Fira Sans,sans-serif;white-space:nowrap;text-align:center;pointer-events:none;">' +
      total +
      "</div>" +
      "</div>";
    var icon = L.divIcon({
      html: html,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      className: "",
    });
    var m = L.marker([p.cy, p.cx], { icon: icon });
    m.bindTooltip(p.Name_Geo, {
      direction: "top",
      className: "village-label",
      offset: [0, -size / 2 - 2],
    });
    m.on("click", function () {
      showInfoAgri(p);
      showBottomChartAgri(data);
    });
    markers.push(m);
  });
  agriMarkerLayer = L.layerGroup(markers).addTo(map);

  updateAgriLegend();
  setInfoBtn("agri");
}

function showInfoAgri(p) {
  var total = p.AgroInsure + p.AgroCredit + p.PlantFuture;
  var html =
    '<div class="info-name" style="font-size:13px;font-weight:700;">' +
    p.Name_Geo +
    " (მუნიციპალიტეტი)</div>";
  html +=
    '<div style="margin-top:6px;font-size:10px;color:var(--text-muted);">სოფ. მეურნ. პროექტების ბენეფიციარები (2019–2024)</div>';
  html +=
    '<div style="margin-top:8px;font-size:11px;color:#444;line-height:1.9;">';
  AGRI_PROGRAMS.forEach(function (pr) {
    html +=
      '<div style="display:flex;align-items:center;gap:7px;">' +
      '<span style="display:inline-block;width:12px;height:12px;background:' +
      pr.color +
      ';border-radius:2px;flex-shrink:0;"></span>' +
      "<b>" +
      pr.label +
      ":</b> " +
      p[pr.key] +
      "</div>";
  });
  html += "</div>";
  html +=
    '<div style="margin-top:6px;padding-top:5px;border-top:1px solid #e5e0d8;font-size:11px;"><b>სულ:</b> ' +
    total +
    "</div>";
  document.getElementById("infoCardContent").innerHTML = html;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartAgri(data) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

  var labels = data.features.map(function (f) {
    return f.properties.Name_Geo;
  });
  var datasets = AGRI_PROGRAMS.map(function (pr) {
    return {
      label: pr.label,
      data: data.features.map(function (f) {
        return f.properties[pr.key];
      }),
      backgroundColor: pr.color + "CC",
      borderColor: pr.color,
      borderWidth: 1.5,
      borderRadius: 3,
    };
  });

  bottomChart = new Chart(ctx, {
    type: "bar",
    data: { labels: labels, datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: {
            font: { family: "Fira Sans", size: 9 },
            boxWidth: 12,
            padding: 6,
          },
        },
        title: {
          display: true,
          text: "სოფლის მეურნეობის პროექტების ბენეფიციარები (2019–2024)",
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: {
            label: function (c) {
              return " " + c.dataset.label + ": " + c.parsed.y;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { font: { family: "Fira Sans", size: 10, weight: "500" } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 11, weight: "500" }, maxRotation: 35 },
          grid: { display: false },
        },
      },
    },
  });
}

function updateAgriLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">სოფ. მეურნ. პროექტების ბენეფიციარები (2019–2024)</div>';
  html += '<div class="ethnics-legend">';
  AGRI_PROGRAMS.forEach(function (pr) {
    html +=
      '<div class="eth-legend-item" style="margin-bottom:6px;align-items:center;">' +
      '<span style="display:inline-block;width:14px;height:14px;background:' +
      pr.color +
      ';border-radius:2px;flex-shrink:0;margin-right:6px;"></span>' +
      '<span style="font-size:10px;">' +
      pr.label +
      "</span></div>";
  });
  html += "</div>";
  html +=
    '<div style="margin-top:8px;font-size:9px;color:var(--text-muted);line-height:1.5;">წრის ზომა — ბენეფიციართა ჯამის პროპორციული. ცენტრში — სულ რაოდენობა</div>';
  el.innerHTML = html;
}

// ============================================================
// ეკონომიკა — სოფლის მეურნეობის წარმოების სპეციალიზაცია
// ============================================================
var agriSpecLayer = null;

var agriSpecData = null;

var AGRI_SPEC_TYPES = [
  {
    key: "grain",
    color: "#F8EE53",
    label:
      "სასაქონლო მემარცვლეობა, მებოსტნეობა, მევენახეობა, მეხილეობა, მეფრინველეობა, მეცხვარეობა",
  },
  {
    key: "dairy",
    color: "#F384A0",
    label: "სასაქონლო სარძევე-სახორცე მესაქონლეობა",
  },
  {
    key: "horti",
    color: "#95CC77",
    label: "მებოსტნეობა, სახორცე-სარძევე მესაქონლეობა",
  },
  {
    key: "potato",
    color: "#F5B46F",
    label: "სასაქონლო მეკარტოფილეობა და სახორცე-სარძევე მესაქონლეობა",
  },
];

function loadAgriSpec() {
  loadNatureMuniCenters();
  if (agriSpecData) {
    buildAgriSpecLayer(agriSpecData);
    return;
  }
  fetch("data/agri_spec.geojson")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      agriSpecData = d;
      buildAgriSpecLayer(d);
    });
}

function buildAgriSpecLayer(data) {
  if (agriSpecLayer) map.removeLayer(agriSpecLayer);
  agriSpecLayer = L.geoJSON(data, {
    style: function (feat) {
      return {
        fillColor: feat.properties.Color,
        fillOpacity: 0.65,
        color: "#7a7a6a",
        weight: 0.8,
        opacity: 0.6,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      layer.bindTooltip(p.Type_Geo, {
        direction: "center",
        className: "village-label",
        sticky: true,
      });
      layer.on("click", function () {
        showInfoAgriSpec(p);
        showBottomChartAgriSpec(data);
      });
    },
  }).addTo(map);
  updateAgriSpecLegend();
  setInfoBtn("agri_spec");
}

function showInfoAgriSpec(p) {
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:12px;font-weight:700;line-height:1.4;">' +
    p.Type_Geo +
    "</div>" +
    '<span class="info-type-badge" style="background:' +
    p.Color +
    "66;color:#555;border:1px solid " +
    p.Color +
    ';margin-top:6px;">სპეციალიზაცია</span>' +
    '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);line-height:1.7;">' +
    "<b>ფართობი:</b> " +
    p.Area_km2.toLocaleString() +
    " კმ²</div>";
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartAgriSpec(data) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

  var areas = {};
  AGRI_SPEC_TYPES.forEach(function (t) {
    areas[t.key] = 0;
  });
  data.features.forEach(function (f) {
    areas[f.properties.TKey] =
      (areas[f.properties.TKey] || 0) + f.properties.Area_km2;
  });

  var sorted = AGRI_SPEC_TYPES.slice().sort(function (a, b) {
    return areas[b.key] - areas[a.key];
  });
  // მოკლე ლეიბლები
  var shortLabels = {
    grain: "მემარცვლეობა\nკომპლექსი",
    dairy: "სარძევე-სახორცე",
    horti: "მებოსტნ.-მესაქონ.",
    potato: "მეკარტოფ.-მესაქონ.",
  };
  var labels = sorted.map(function (t) {
    return shortLabels[t.key];
  });

  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "ფართობი (კმ²)",
          data: sorted.map(function (t) {
            return Math.round(areas[t.key]);
          }),
          backgroundColor: sorted.map(function (t) {
            return t.color + "DD";
          }),
          borderColor: sorted.map(function (t) {
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
          text: "სოფ. მეურნ. სპეციალიზაცია — ფართობი (კმ²)",
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
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
          ticks: { font: { family: "Fira Sans", size: 10, weight: "500" } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 11, weight: "500" }, maxRotation: 25 },
          grid: { display: false },
        },
      },
    },
  });
}

function updateAgriSpecLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">სოფლის მეურნეობის სპეციალიზაცია</div>';
  html += '<div class="ethnics-legend">';
  AGRI_SPEC_TYPES.forEach(function (t) {
    html +=
      '<div class="legend-item" style="margin-bottom:6px;align-items:flex-start;">' +
      '<span style="display:inline-block;width:14px;height:14px;background:' +
      t.color +
      ';border:1px solid #999;flex-shrink:0;margin-right:6px;margin-top:1px;"></span>' +
      '<span style="font-size:9.5px;line-height:1.35;">' +
      t.label +
      "</span></div>";
  });
  html += "</div>";
  el.innerHTML = html;
}

function removeAllEconomyLayers() {
  if (botanicaLayer) {
    map.removeLayer(botanicaLayer);
    botanicaLayer = null;
  }
  if (energetikaLayer) {
    map.removeLayer(energetikaLayer);
    energetikaLayer = null;
  }
  if (cropZonesLayer) {
    map.removeLayer(cropZonesLayer);
    cropZonesLayer = null;
  }
  if (landLayer) {
    map.removeLayer(landLayer);
    landLayer = null;
  }
  if (sunZoneLayer) {
    map.removeLayer(sunZoneLayer);
    sunZoneLayer = null;
  }
  if (sunStationLayer) {
    map.removeLayer(sunStationLayer);
    sunStationLayer = null;
  }
  if (agriLayer) {
    map.removeLayer(agriLayer);
    agriLayer = null;
  }
  if (agriMarkerLayer) {
    map.removeLayer(agriMarkerLayer);
    agriMarkerLayer = null;
  }
  if (agriSpecLayer) {
    map.removeLayer(agriSpecLayer);
    agriSpecLayer = null;
  }
}

// ===== Start-up (called from app.js) =====
function initEconomy() {
  // ===== ეკონომიკა checkbox =====
  document.getElementById("chkEconomy").addEventListener("change", function (e) {
    if (e.target.checked) {
      document.getElementById("mainLayerView").style.display = "none";
      document.getElementById("sublayerView").style.display = "none";
      document.getElementById("natureView").style.display = "none";
      document.getElementById("historyView").style.display = "none";
      document.getElementById("economyView").style.display = "";
      showChartPanel();
      resetChartPanel();
      hideSettlementLegend();
      setInfoBtn(null);
      document.getElementById("filterSection").style.display = "none";
      document.getElementById("infoCard").classList.add("hidden");
      document.getElementById("chkPopulation").checked = false;
      document.getElementById("chkNature").checked = false;
      document.getElementById("chkHistory").checked = false;
      document.getElementById("chkEducation").checked = false;
      document.getElementById("chkTourism").checked = false;
      document.getElementById("educationView").style.display = "none";
      document.getElementById("tourismView").style.display = "none";
      removeAllThematic();
      removeAllNatureLayers();
      removeAllHistoryLayers();
      removeAllEducationLayers();
      removeAllTourismLayers();
      removeNeutralLayers();
      document.querySelectorAll("[data-econsub]").forEach(function (b) {
        b.classList.remove("active");
      });
      document.querySelector("[data-econsub='botanica']").classList.add("active");
      loadBotanica();
    } else {
      document.getElementById("economyView").style.display = "none";
      document.getElementById("mainLayerView").style.display = "";
      removeAllEconomyLayers();
      resetPopLegend();
      loadNeutralLayers();
    }
  });


  document
    .getElementById("btnEconomyBack")
    .addEventListener("click", function () {
      document.getElementById("chkEconomy").checked = false;
      document.getElementById("economyView").style.display = "none";
      document.getElementById("mainLayerView").style.display = "";
      removeAllEconomyLayers();
      hideChartPanel();
      document.getElementById("infoCard").classList.add("hidden");
      resetPopLegend();
      loadNeutralLayers();
    });


  document.querySelectorAll("[data-econsub]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (this.classList.contains("active")) return; // იგივეზე ხელახლა დაწკაპება
      document.querySelectorAll("[data-econsub]").forEach(function (b) {
        b.classList.remove("active");
      });
      this.classList.add("active");
      removeAllEconomyLayers();
      document.getElementById("infoCard").classList.add("hidden");
      resetChartPanel();
      resetPopLegend();
      var sub = this.dataset.econsub;
      if (sub === "botanica") loadBotanica();
      else if (sub === "energetika") loadEnergetika();
      else if (sub === "crop_zones") loadCropZones();
      else if (sub === "land") loadLand();
      else if (sub === "sun") loadSun();
      else if (sub === "agri") loadAgri();
      else if (sub === "agrispec") loadAgriSpec();
      setInfoBtn(ECON_SUB_INFO[sub] || null);
    });
  });
}
