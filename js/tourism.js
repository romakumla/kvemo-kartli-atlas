// ტურიზმი: საკურორტო-ტურისტული შეფასება, ტურიზმის სახეობები, მევენახეობა და მარნები, დაცული ტერიტორიები
// Part of the atlas script, split from the former js/main.js. Files are loaded in
// order by index.html; theme files only define things, their start-up code is
// in initTourism(), called from app.js once every file is loaded.


// ============================================================
// გარემოს საკურორტო-ტურისტული შეფასება (თვის მიხედვით)
// ============================================================
var tcData = null;

var tcMuniLayer = null;

var tcPointLayer = null;

var activeTcMonth = "July";

var TC_MONTHS = [
  ["January", "იანვარი"],
  ["February", "თებერვალი"],
  ["March", "მარტი"],
  ["April", "აპრილი"],
  ["May", "მაისი"],
  ["June", "ივნისი"],
  ["July", "ივლისი"],
  ["August", "აგვისტო"],
  ["September", "სექტემბერი"],
  ["October", "ოქტომბერი"],
  ["November", "ნოემბერი"],
  ["December", "დეკემბერი"],
];

// დასვენების კლიმატური ინდექსის (დკი) 5 კატეგორია, დაბლიდან მაღლისკენ
var TC_CATEGORIES = [
  { key: "სასიამოვნო", color: "#B9E5FB" },
  { key: "კარგი", color: "#FFF450" },
  { key: "ძალიან კარგი", color: "#FBB416" },
  { key: "შესანიშნავი", color: "#C759A1" },
  { key: "იდეალური", color: "#ED1651" },
];

function getTcColor(val) {
  for (var i = 0; i < TC_CATEGORIES.length; i++) {
    if (TC_CATEGORIES[i].key === val) return TC_CATEGORIES[i].color;
  }
  return "#e0e0e0";
}

function loadTourismClimate() {
  if (tcData) {
    buildTourismClimateLayers(tcData);
    loadNatureMuniCenters();
    return;
  }
  loadMuniData("data/muni/tourism_climate.json")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      tcData = d;
      buildTourismClimateLayers(d);
      loadNatureMuniCenters();
    });
}

function buildTourismClimateLayers(data) {
  if (tcMuniLayer) {
    map.removeLayer(tcMuniLayer);
    tcMuniLayer = null;
  }
  if (tcPointLayer) {
    map.removeLayer(tcPointLayer);
    tcPointLayer = null;
  }

  var munis = data.features.filter(function (f) {
    return f.properties.ftype === "municipality";
  });
  var points = data.features.filter(function (f) {
    return f.properties.ftype === "point";
  });

  tcMuniLayer = L.geoJSON(
    { type: "FeatureCollection", features: munis },
    {
      style: function (feature) {
        return {
          fillColor: getTcColor(feature.properties[activeTcMonth]),
          fillOpacity: 0.75,
          color: "#5a5a5a",
          weight: 1,
          opacity: 0.7,
        };
      },
      onEachFeature: function (feature, layer) {
        var p = feature.properties;
        layer.bindTooltip(p.Name_Geo + " — " + (p[activeTcMonth] || "მონაცემი არ არის"), {
          direction: "center",
          className: "village-label",
          sticky: true,
        });
        layer.on("click", function () {
          showInfoTc(p, false);
          showBottomChartTc(p);
        });
      },
    }
  ).addTo(map);

  tcPointLayer = L.geoJSON(
    { type: "FeatureCollection", features: points },
    {
      pointToLayer: function (feat, latlng) {
        var p = feat.properties;
        var marker = L.circleMarker(latlng, {
          radius: 8,
          fillColor: getTcColor(p[activeTcMonth]),
          fillOpacity: 1,
          color: "#232323",
          weight: 1.5,
        });
        marker.bindTooltip(p.Name_Geo, {
          permanent: true,
          direction: "top",
          className: "village-label",
          offset: [0, -8],
        });
        marker.on("click", function () {
          showInfoTc(p, true);
          showBottomChartTc(p);
        });
        return marker;
      },
    }
  ).addTo(map);

  tcMuniLayer.bringToBack();
  updateTcLegend();
}

function showInfoTc(p, isPoint) {
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;font-weight:700;">' +
    p.Name_Geo +
    (isPoint ? "" : " (მუნიციპალიტეტი)") +
    "</div>" +
    '<div style="margin:6px 0;">' +
    '<span class="info-type-badge" style="background:' +
    getTcColor(p[activeTcMonth]) +
    "33;color:#232323;border:1px solid " +
    getTcColor(p[activeTcMonth]) +
    ';">' +
    TC_MONTHS.find(function (m) {
      return m[0] === activeTcMonth;
    })[1] +
    ": " +
    (p[activeTcMonth] || "მონაცემი არ არის") +
    "</span></div>" +
    '<div style="font-size:9px;color:var(--text-muted);margin-top:8px;">სტატისტიკის ველში ნახეთ წლის განმავლობაში ცვლილება</div>';
  document.getElementById("infoCard").classList.remove("hidden");
}

// მუნიციპალიტეტის/წერტილის 12-თვიანი დკი-სტატისტიკა — ქვედა chart პანელი
function showBottomChartTc(p) {
  var ctx = prepareBottomChart();

  function rank(val) {
    for (var i = 0; i < TC_CATEGORIES.length; i++) {
      if (TC_CATEGORIES[i].key === val) return i + 1;
    }
    return 0;
  }

  var values = TC_MONTHS.map(function (m) {
    return rank(p[m[0]]);
  });
  var colors = TC_MONTHS.map(function (m) {
    return getTcColor(p[m[0]]);
  });

  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: TC_MONTHS.map(function (m) {
        return m[1].slice(0, 3);
      }),
      datasets: [
        {
          label: "დკი კატეგორია",
          data: values,
          backgroundColor: colors,
          borderColor: "#232323",
          borderWidth: 1,
          borderRadius: 3,
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
          text: p.Name_Geo + " — დკი წლის განმავლობაში",
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: {
            label: function (ctx2) {
              var m = TC_MONTHS[ctx2.dataIndex];
              return p[m[0]] || "მონაცემი არ არის";
            },
          },
        },
      },
      scales: {
        y: {
          min: 0,
          max: 5,
          ticks: {
            stepSize: 1,
            font: { family: "Fira Sans", size: 10, weight: "500" },
            callback: function (value) {
              return value >= 1 && value <= 5
                ? TC_CATEGORIES[value - 1].key
                : "";
            },
          },
          grid: { display: false },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 11, weight: "500" } },
          grid: { display: false },
        },
      },
    },
  });
}

function updateTcLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">დასვენების კლიმატური ინდექსი (დკი)</div>';

  // ფერადი კატეგორიების ლეგენდა (მაღლიდან დაბლისკენ, ბეჭდური ატლასის მსგავსად)
  for (var i = TC_CATEGORIES.length - 1; i >= 0; i--) {
    html +=
      '<div style="display:flex;align-items:center;margin-bottom:5px;">' +
      '<span style="display:inline-block;width:16px;height:16px;background:' +
      TC_CATEGORIES[i].color +
      ';border:1px solid #999;flex-shrink:0;"></span>' +
      '<span style="font-size:10px;margin-left:7px;">' +
      TC_CATEGORIES[i].key +
      "</span></div>";
  }

  // თვის გადამრთველი
  html +=
    '<div style="margin-top:10px;"><div style="font-size:9px;font-weight:700;color:var(--text-muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;">თვე</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;">';
  TC_MONTHS.forEach(function (m) {
    var active = activeTcMonth === m[0] ? "active" : "";
    html +=
      '<button class="year-btn tc-month-btn ' +
      active +
      '" data-tcmonth="' +
      m[0] +
      '" style="padding:6px 2px;">' +
      m[1].slice(0, 3) +
      "</button>";
  });
  html += "</div></div>";

  html +=
    '<div style="margin-top:8px;font-size:9px;color:var(--text-muted);">წერტილი — 8 საკურორტო ლოკაცია; ფონი — მუნიციპალიტეტის საშუალო</div>';

  el.innerHTML = html;

  el.querySelectorAll(".tc-month-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      activeTcMonth = this.dataset.tcmonth;
      if (tcData) buildTourismClimateLayers(tcData);
    });
  });

  setInfoBtn("tourism_climate");
}

// ============================================================
// ტურიზმის სახეობები
// ============================================================
var ttData = null;

var ttLayer = null;

var TT_TYPES = [
  { key: "Cultural_E", label: "კულტურულ-შემეცნებითი", color: "#F6851F", chartLabel: ["კულტურულ-", "შემეცნებითი"] },
  { key: "Gastronomi", label: "გასტრონომიული", color: "#A71E22", chartLabel: ["გასტრო-", "ნომიული"] },
  { key: "Ecological", label: "ეკოლოგიური", color: "#78BC43", chartLabel: ["ეკოლოგიური"] },
  { key: "Recreation", label: "გამაჯანსაღებელი", color: "#42C7F1", chartLabel: ["გამაჯან-", "საღებელი"] },
  { key: "Adventure", label: "სათავგადასავლო", color: "#DF358D", chartLabel: ["სათავგადა-", "სავლო"] },
  { key: "Ethnograph", label: "ეთნოგრაფიული", color: "#D9C826", chartLabel: ["ეთნო-", "გრაფიული"] },
  { key: "Scientific", label: "სამეცნიერო", color: "#084CA1", chartLabel: ["სამეცნიერო"] },
  { key: "Business", label: "საქმიანი", color: "#FFF200", chartLabel: ["საქმიანი"] },
];

function ttActiveTypes(p) {
  return TT_TYPES.filter(function (t) {
    var v = p[t.key];
    return v && v !== "არა";
  });
}

// წერტილის სიმბოლო — ფერადი წრეები აქტიური სახეობების მიხედვით
function buildTtClusterIcon(types) {
  var dot = 13;
  var gap = 2;
  var cols = types.length > 4 ? 3 : types.length > 1 ? 2 : 1;
  var rows = Math.ceil(types.length / cols);
  var boxW = cols * dot + (cols - 1) * gap;
  var boxH = rows * dot + (rows - 1) * gap;
  var html =
    '<div style="display:flex;flex-wrap:wrap;gap:' + gap + "px;width:" + boxW + 'px;">';
  types.forEach(function (t) {
    html +=
      '<div style="width:' + dot + "px;height:" + dot + "px;border-radius:50%;background:" +
      t.color +
      ';border:1.5px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,.45);"></div>';
  });
  html += "</div>";
  var icon = L.divIcon({
    html: html,
    iconSize: [boxW, boxH],
    iconAnchor: [boxW / 2, boxH / 2],
    className: "",
  });
  return { icon: icon, boxW: boxW, boxH: boxH };
}

// წარწერები ჩანს მხოლოდ საკმარის zoom-ზე, რომ ერთმანეთს არ გადაფარონ
var TT_LABEL_ZOOM = 11;

function updateTtLabels() {
  if (!ttLayer) return;
  var showLabels = map.getZoom() >= TT_LABEL_ZOOM;
  ttLayer.eachLayer(function (marker) {
    if (!marker._ttName) return;
    if (marker.getTooltip()) marker.unbindTooltip();
    marker.bindTooltip(marker._ttName, {
      permanent: showLabels,
      direction: "top",
      className: "village-label",
      offset: [0, -marker._ttBoxH / 2 - 2],
    });
  });
}

function loadTourismTypes() {
  if (ttData) {
    buildTourismTypesLayer(ttData);
    loadNatureMuniCenters();
    return;
  }
  fetch("data/tourism_types.geojson")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      ttData = d;
      buildTourismTypesLayer(d);
      loadNatureMuniCenters();
    });
}

function buildTourismTypesLayer(data) {
  if (ttLayer) {
    map.removeLayer(ttLayer);
    ttLayer = null;
  }

  ttLayer = L.geoJSON(data, {
    filter: function (feat) {
      return ttActiveTypes(feat.properties).length > 0;
    },
    pointToLayer: function (feat, latlng) {
      var p = feat.properties;
      var types = ttActiveTypes(p);
      var compact = buildTtClusterIcon(types);

      var marker = L.marker(latlng, { icon: compact.icon });
      marker._ttName = p.Name_Geo;
      marker._ttBoxH = compact.boxH;

      marker.on("click", function () {
        showInfoTt(p, types);
        showBottomChartTt(p, types, data);
      });
      return marker;
    },
  }).addTo(map);

  updateTtLabels();
  map.off("zoomend", updateTtLabels);
  map.on("zoomend", updateTtLabels);

  updateTtLegend();
}

function showInfoTt(p, types) {
  var rows = types
    .map(function (t) {
      return (
        '<div style="display:flex;align-items:center;gap:7px;margin-bottom:5px;">' +
        '<span style="width:12px;height:12px;border-radius:50%;background:' +
        t.color +
        ';border:1px solid #999;flex-shrink:0;"></span>' +
        '<span style="font-size:10px;line-height:1.4;">' +
        t.label +
        "</span></div>"
      );
    })
    .join("");
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;font-weight:700;">' +
    p.Name_Geo +
    "</div>" +
    '<span class="info-type-badge" style="background:#F6851F22;color:#B85C10;border:1px solid #F6851F;">' +
    p.Municipal_ +
    "</span>" +
    '<div style="margin-top:8px;font-size:9px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;">ტურიზმის სახეობები</div>' +
    rows;
  document.getElementById("infoCard").classList.remove("hidden");
}

// ტურიზმის სახეობების სტატისტიკა — ქვედა chart პანელი
// დასახლებების რაოდენობა ტურიზმის სახეობების მიხედვით (რეგიონი);
// დაწკაპებული დასახლების სახეობები სრული ფერით, დანარჩენი — ბაცად
function showBottomChartTt(p, types, data) {
  var ctx = prepareBottomChart();

  var counts = TT_TYPES.map(function (t) {
    return data.features.filter(function (f) {
      var v = f.properties[t.key];
      return v && v !== "არა";
    }).length;
  });

  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: TT_TYPES.map(function (t) {
        return t.chartLabel;
      }),
      datasets: [
        {
          label: "დასახლებები",
          data: counts,
          backgroundColor: TT_TYPES.map(function (t) {
            return t.color;
          }),
          borderWidth: 0,
          borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 18 } },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text:
            "დასახლებები ტურიზმის სახეობების მიხედვით — " +
            p.Name_Geo +
            ": " +
            types
              .map(function (t) {
                return t.label;
              })
              .join(", "),
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: {
            title: function (c) {
              return TT_TYPES[c[0].dataIndex].label;
            },
            label: function (c) {
              return " " + c.parsed.y + " დასახლება";
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0, font: { family: "Fira Sans", size: 10, weight: "500" } },
        },
        x: {
          ticks: {
            font: { family: "Fira Sans", size: 11, weight: "500" },
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

  var keys = types.map(function (t) {
    return t.key;
  });
  highlightBottomBars(function (l, i) {
    return keys.indexOf(TT_TYPES[i].key) !== -1;
  });
}

function updateTtLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">ტურიზმის სახეობები</div>';
  TT_TYPES.forEach(function (t) {
    html +=
      '<div style="display:flex;align-items:center;margin-bottom:6px;">' +
      '<span style="width:14px;height:14px;border-radius:50%;background:' +
      t.color +
      ';border:1px solid #999;flex-shrink:0;"></span>' +
      '<span style="font-size:10px;margin-left:7px;">' +
      t.label +
      "</span></div>";
  });
  html +=
    '<div style="margin-top:8px;font-size:9px;color:var(--text-muted);line-height:1.5;">დესტინაციაზე დაჭერით — სტატისტიკა ქვედა ველში. წარწერები ჩანს zoom ≥ 11-ზე.</div>';
  el.innerHTML = html;
  setInfoBtn("tourism_types");
}

// ============================================================
// მევენახეობის ზონები და ღვინის მარნები
// ============================================================
var vitData = null, cellarData = null;

var vitLayer = null, cellarLayer = null;

var VIT_ZONES = [
  { key: "მევენახეობის ზონა", color: "#A0CF6B",
    chartLabel: ["მევენახეობის", "ზონა"] },
  { key: "სამრეწველო მევენახეობის ზონა", color: "#48A851",
    chartLabel: ["სამრეწველო", "მევენახეობის ზონა"] },
  { key: "ბოლნისის მიკროზონა", color: "#FBB887",
    chartLabel: ["ბოლნისის", "მიკროზონა"] },
  { key: "ასურეთული შალას მიკროზონა", color: "#C59DB6",
    chartLabel: ["ასურეთული შალას", "მიკროზონა"] },
];

var CELLAR_COLOR = "#C02026";

function loadViticulture() {
  function ready() {
    buildViticultureLayers();
    loadNatureMuniCenters();
  }
  if (vitData && cellarData) return ready();
  Promise.all([
    vitData
      ? Promise.resolve(vitData)
      : fetch("data/viticulture_zones.geojson").then((r) => r.json()),
    cellarData
      ? Promise.resolve(cellarData)
      : fetch("data/wine_cellars.geojson").then((r) => r.json()),
  ]).then(function (res) {
    vitData = res[0];
    cellarData = res[1];
    ready();
  });
}

// მარნების სიმბოლო — რამდენი მარანიც არის, იმდენი კვადრატი
function cellarSquaresIcon(n) {
  var sq = 14, gap = 3;
  var cols = n > 4 ? 3 : n > 1 ? 2 : 1;
  var rows = Math.ceil(n / cols);
  var w = cols * sq + (cols - 1) * gap;
  var h = rows * sq + (rows - 1) * gap;
  var html =
    '<div style="display:flex;flex-wrap:wrap;gap:' + gap + "px;width:" + w + 'px;">';
  for (var i = 0; i < n; i++) {
    html +=
      '<div style="width:' + sq + "px;height:" + sq + "px;background:" +
      CELLAR_COLOR +
      ';border:1px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,.4);"></div>';
  }
  html += "</div>";
  return {
    icon: L.divIcon({
      html: html,
      iconSize: [w, h],
      iconAnchor: [w / 2, h / 2],
      className: "",
    }),
    h: h,
  };
}

function buildViticultureLayers() {
  if (vitLayer) { map.removeLayer(vitLayer); vitLayer = null; }
  if (cellarLayer) { map.removeLayer(cellarLayer); cellarLayer = null; }

  vitLayer = L.geoJSON(vitData, {
    style: function (f) {
      var p = f.properties;
      if (p.isBg) {
        // მევენახეობის ზონა არაა — მხოლოდ ბაცი ფონი
        return {
          fillColor: p.Color,
          fillOpacity: 0.45,
          color: MUNI_BORDER_COLOR,
          weight: 0.4,
          opacity: 0.35,
          interactive: false,
        };
      }
      return {
        fillColor: p.Color,
        fillOpacity: 0.72,
        color: darken(p.Color),
        weight: 0.6,
        opacity: 0.8,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      if (p.isBg) return; // ფონი არ რეაგირებს
      layer.bindTooltip(p.Zone, {
        direction: "center",
        className: "village-label",
        sticky: true,
      });
      layer.on("click", function () {
        showInfoVitZone(p);
        showBottomChartVitZones(p);
      });
    },
  }).addTo(map);

  cellarLayer = L.geoJSON(cellarData, {
    filter: function (f) {
      return f.properties.Cellars > 0;
    },
    pointToLayer: function (feat, latlng) {
      var p = feat.properties;
      var ic = cellarSquaresIcon(p.Cellars);
      var marker = L.marker(latlng, { icon: ic.icon });
      marker.bindTooltip(p.Name_Geo, {
        direction: "top",
        className: "village-label",
        offset: [0, -ic.h / 2 - 2],
      });
      marker.on("click", function () {
        showInfoCellar(p);
        showBottomChartCellars(p);
      });
      return marker;
    },
  }).addTo(map);

  updateViticultureLegend();
}

function showInfoVitZone(p) {
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name">' + p.Zone + "</div>" +
    '<span class="info-type-badge" style="background:' + p.Color +
    "44;color:#333;border:1px solid " + darken(p.Color) + ';">' +
    p.Area_km2 + " კმ²</span>";
  document.getElementById("infoCard").classList.remove("hidden");
}

function showInfoCellar(p) {
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name">' + p.Name_Geo + "</div>" +
    '<span class="info-type-badge" style="background:' + CELLAR_COLOR +
    '22;color:' + CELLAR_COLOR + ';border:1px solid ' + CELLAR_COLOR + ';">' +
    p.Cellars + " მარანი</span>" +
    '<div style="margin-top:6px;font-size:11px;color:#444;">' +
    "<b>მუნიციპალიტეტი:</b> " + p.Municipal_ + "</div>";
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartCellars(sel) {
  var ctx = prepareBottomChart();

  var pts = cellarData.features
    .map(function (f) { return f.properties; })
    .filter(function (p) { return p.Cellars > 0; })
    .sort(function (a, b) { return b.Cellars - a.Cellars; });

  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: pts.map(function (p) { return p.Name_Geo; }),
      datasets: [{
        data: pts.map(function (p) { return p.Cellars; }),
        backgroundColor: CELLAR_COLOR,
        borderWidth: 0,
        borderRadius: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "ღვინის მარნები — სულ " +
            pts.reduce(function (a, p) { return a + p.Cellars; }, 0),
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: {
            label: function (c) { return c.parsed.y + " მარანი"; },
          },
        },
      },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0, font: { family: "Fira Sans", size: 10, weight: "500" } }, grid: { color: "#eee" } },
        x: { ticks: { font: { family: "Fira Sans", size: 11, weight: "500" }, autoSkip: false, maxRotation: 45, minRotation: 45 }, grid: { display: false } },
      },
    },
  });
  if (sel)
    highlightBottomBars(function (l, i) {
      return pts[i].Name_Geo === sel.Name_Geo && pts[i].Cellars === sel.Cellars;
    });
}

// ზონების ფართობები — ქვედა სტატისტიკის ველი

function showBottomChartVitZones(sel) {
  var ctx = prepareBottomChart();

  // ერთი ტიპის პოლიგონები ერთად შევკრიბოთ
  var sums = {};
  VIT_ZONES.forEach(function (z) {
    sums[z.key] = 0;
  });
  vitData.features.forEach(function (f) {
    var p = f.properties;
    if (!p.isBg && sums.hasOwnProperty(p.Zone))
      sums[p.Zone] += p.Area_km2 || 0;
  });

  var total = VIT_ZONES.reduce(function (a, z) {
    return a + sums[z.key];
  }, 0);

  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: VIT_ZONES.map(function (z) {
        return z.chartLabel || z.key;
      }),
      datasets: [
        {
          data: VIT_ZONES.map(function (z) {
            return Math.round(sums[z.key] * 10) / 10;
          }),
          backgroundColor: VIT_ZONES.map(function (z) {
            return z.color;
          }),
          borderWidth: 0,
          borderRadius: 3,
          minBarLength: 6, // პატარა ზონაც ხილული რჩება
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 18 } },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text:
            "მევენახეობის ზონები — ფართობი (კმ²), სულ " +
            Math.round(total) +
            " კმ²",
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: {
            title: function (c) {
              return VIT_ZONES[c[0].dataIndex].key;
            },
            label: function (c) {
              var v = c.parsed.y;
              return v + " კმ² (" + Math.round((v / total) * 100) + "%)";
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { font: { family: "Fira Sans", size: 10, weight: "500" } },
          grid: { color: "#eee" },
          title: {
            display: true,
            text: "კმ²",
            font: { family: "Fira Sans", size: 9 },
            color: "#777",
          },
        },
        x: {
          ticks: {
            font: { family: "Fira Sans", size: 11, weight: "500" },
            autoSkip: false,
            maxRotation: 0,
            minRotation: 0,
          },
          grid: { display: false },
        },
      },
    },
  });
  if (sel)
    highlightBottomBars(function (l, i) {
      return VIT_ZONES[i].key === sel.Zone;
    });
}

function updateViticultureLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">მევენახეობის ზონები</div>';
  VIT_ZONES.forEach(function (z) {
    html +=
      '<div style="display:flex;align-items:center;margin-bottom:6px;">' +
      '<span style="width:15px;height:15px;background:' + z.color +
      ';border:1px solid ' + darken(z.color) + ';flex-shrink:0;"></span>' +
      '<span style="font-size:10px;margin-left:7px;line-height:1.3;">' + z.key + "</span></div>";
  });
  html +=
    '<div style="margin-top:9px;padding-top:8px;border-top:1px solid #ddd;">' +
    '<div style="display:flex;align-items:center;">' +
    '<span style="width:14px;height:14px;background:' + CELLAR_COLOR +
    ';border:1px solid #fff;box-shadow:0 0 0 1px #999;flex-shrink:0;"></span>' +
    '<span style="font-size:10px;margin-left:7px;">1 კვადრატი — 1 მარანი</span></div></div>' +
    '<div style="margin-top:8px;font-size:9px;color:var(--text-muted);">მარანზე დაჭერით — სტატისტიკა ქვედა ველში</div>';
  el.innerHTML = html;
  setInfoBtn("viticulture");
}

// ============================================================
// დაცული ტერიტორიები
// ============================================================
var paData = null, paLayer = null;

var PA_FILL = "#A9D7AE";

var PA_STROKE = "#3E6E55";

function loadProtectedAreas() {
  if (paData) {
    buildProtectedAreasLayer();
    loadNatureMuniCenters();
    return;
  }
  fetch("data/protected_areas.geojson")
    .then((r) => r.json())
    .then(function (d) {
      paData = d;
      buildProtectedAreasLayer();
      loadNatureMuniCenters();
    });
}

function buildProtectedAreasLayer() {
  if (paLayer) { map.removeLayer(paLayer); paLayer = null; }

  paLayer = L.geoJSON(paData, {
    style: function () {
      return {
        fillColor: PA_FILL,
        fillOpacity: 0.55, // ფონური რუკა გამოსჭვივის
        color: PA_STROKE,
        weight: 1.6,
        opacity: 0.95,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      if (p.isLabel) {
        layer.bindTooltip(p.Name_Geo, {
          permanent: true,
          direction: "center",
          className: "pa-label",
        });
      }
      layer.on("mouseover", function () {
        layer.setStyle({ fillOpacity: 0.75, weight: 2.4 });
      });
      layer.on("mouseout", function () {
        layer.setStyle({ fillOpacity: 0.55, weight: 1.6 });
      });
      layer.on("click", function () {
        showInfoProtectedArea(p);
        showBottomChartProtectedAreas(p);
      });
    },
  }).addTo(map);

  updateProtectedAreasLegend();
}

function showInfoProtectedArea(p) {
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name">' + p.Name_Geo + "</div>" +
    '<span class="info-type-badge" style="background:' + PA_FILL +
    '66;color:' + PA_STROKE + ';border:1px solid ' + PA_STROKE + ';">' +
    p.Category + "</span>" +
    '<div style="margin-top:8px;font-size:11px;color:#444;line-height:1.9;">' +
    "<b>ფართობი რეგიონში:</b> " + p.Area_km2 + " კმ²" +
    (p.Total_ha ? "<br><b>საერთო ფართობი:</b> " + p.Total_ha.toLocaleString() + " ჰა" : "") +
    (p.Name_Eng ? '<br><span style="color:#888;font-size:10px;">' + p.Name_Eng + "</span>" : "") +
    "</div>";
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartProtectedAreas(sel) {
  var ctx = prepareBottomChart();

  // ერთი დაცული ტერიტორიის ნაწილები ერთად შევკრიბოთ
  var sums = {};
  paData.features.forEach(function (f) {
    var p = f.properties;
    sums[p.Name_Geo] = (sums[p.Name_Geo] || 0) + (p.Area_km2 || 0);
  });
  var names = Object.keys(sums).sort(function (a, b) {
    return sums[b] - sums[a];
  });
  var total = names.reduce(function (a, n) { return a + sums[n]; }, 0);

  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: names.map(function (n) {
        return n.replace(" ბუნების ძეგლი", "").split(" ");
      }),
      datasets: [{
        data: names.map(function (n) { return Math.round(sums[n] * 100) / 100; }),
        backgroundColor: PA_STROKE,
        borderWidth: 0,
        borderRadius: 3,
        minBarLength: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 18 } },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "დაცული ტერიტორიები — ფართობი (კმ²), სულ " + Math.round(total) + " კმ²",
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: {
            title: function (c) { return names[c[0].dataIndex]; },
            label: function (c) {
              return c.parsed.y + " კმ² (" + Math.round((c.parsed.y / total) * 100) + "%)";
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { font: { family: "Fira Sans", size: 10, weight: "500" } },
          grid: { color: "#eee" },
          title: { display: true, text: "კმ²", font: { family: "Fira Sans", size: 9 }, color: "#777" },
        },
        x: {
          ticks: {
            font: { family: "Fira Sans", size: 11, weight: "500" },
            autoSkip: false, maxRotation: 0, minRotation: 0,
          },
          grid: { display: false },
        },
      },
    },
  });
  if (sel)
    highlightBottomBars(function (l, i) {
      return names[i] === sel.Name_Geo;
    });
}

function updateProtectedAreasLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var cats = ["ეროვნული პარკი", "ნაკრძალი", "აღკვეთილი", "ბუნების ძეგლი"];
  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">დაცული ტერიტორიები</div>' +
    '<div style="display:flex;align-items:center;margin-bottom:8px;">' +
    '<span style="width:16px;height:16px;background:' + PA_FILL +
    ';border:1.6px solid ' + PA_STROKE + ';flex-shrink:0;"></span>' +
    '<span style="font-size:10px;margin-left:7px;">დაცული ტერიტორია</span></div>' +
    '<div style="font-size:9px;font-weight:700;color:var(--text-muted);margin:8px 0 5px;text-transform:uppercase;letter-spacing:.06em;">კატეგორიები</div>';
  cats.forEach(function (c) {
    html += '<div style="font-size:10px;margin-bottom:3px;color:#444;">• ' + c + "</div>";
  });
  html +=
    '<div style="margin-top:8px;font-size:9px;color:var(--text-muted);">ტერიტორიაზე დაჭერით — ფართობები ქვედა ველში</div>';
  el.innerHTML = html;
  setInfoBtn("protected_areas");
}

// ===== Start-up (called from app.js) =====
function initTourism() {
  // ===== ტურიზმი checkbox (ამჟამად disabled — მალე გააქტიურდება) =====
  document
    .getElementById("chkTourism")
    .addEventListener("change", function (e) {
      if (e.target.checked) {
        document.getElementById("mainLayerView").style.display = "none";
        document.getElementById("sublayerView").style.display = "none";
        document.getElementById("natureView").style.display = "none";
        document.getElementById("historyView").style.display = "none";
        document.getElementById("economyView").style.display = "none";
        document.getElementById("educationView").style.display = "none";
        document.getElementById("healthView").style.display = "none";
        document.getElementById("tourismView").style.display = "";
        removeAllHistoryLayers();
        removeAllEconomyLayers();
        removeAllEducationLayers();
        removeAllHealthLayers();
        showChartPanel();
        resetChartPanel();
        hideSettlementLegend();
        setInfoBtn(null);
        document.getElementById("filterSection").style.display = "none";
        document.getElementById("infoCard").classList.add("hidden");
        document.getElementById("chkPopulation").checked = false;
        document.getElementById("chkNature").checked = false;
        document.getElementById("chkHistory").checked = false;
        document.getElementById("chkEconomy").checked = false;
        document.getElementById("chkEducation").checked = false;
        document.getElementById("chkHealth").checked = false;
        removeAllThematic();
        removeAllNatureLayers();
        removeNeutralLayers();
        document.querySelectorAll("[data-toursub]").forEach(function (b) {
          b.classList.remove("active");
        });
        document.querySelector("[data-toursub='tourism_climate']").classList.add("active");
        loadTourismClimate();
      } else {
        document.getElementById("tourismView").style.display = "none";
        document.getElementById("mainLayerView").style.display = "";
        removeAllTourismLayers();
        resetPopLegend();
        loadNeutralLayers();
      }
    });


  document
    .getElementById("btnTourismBack")
    .addEventListener("click", function () {
      document.getElementById("chkTourism").checked = false;
      document.getElementById("tourismView").style.display = "none";
      document.getElementById("mainLayerView").style.display = "";
      removeAllTourismLayers();
      hideChartPanel();
      document.getElementById("infoCard").classList.add("hidden");
      resetPopLegend();
      loadNeutralLayers();
    });


  document.querySelectorAll("[data-toursub]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (this.classList.contains("active")) return; // იგივეზე ხელახლა დაწკაპება
      document.querySelectorAll("[data-toursub]").forEach(function (b) {
        b.classList.remove("active");
      });
      this.classList.add("active");
      removeAllTourismLayers();
      resetChartPanel();
      document.getElementById("infoCard").classList.add("hidden");
      if (this.dataset.toursub === "tourism_climate") loadTourismClimate();
      else if (this.dataset.toursub === "tourism_types") loadTourismTypes();
      else if (this.dataset.toursub === "viticulture") loadViticulture();
      else if (this.dataset.toursub === "protected_areas") loadProtectedAreas();
      setInfoBtn(TOUR_SUB_INFO[this.dataset.toursub] || null);
    });
  });
}
