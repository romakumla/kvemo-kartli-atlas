// Focus outline fix — შავი ჩარჩოს მოშორება პოლიგონებზე click-ისას
(function () {
  var st = document.createElement("style");
  st.textContent =
    ".leaflet-container .leaflet-interactive:focus, .leaflet-container path:focus, .leaflet-container svg:focus { outline: none !important; }";
  document.head.appendChild(st);
})();

// ===== Map =====
var map = L.map("map", { zoomControl: false }).setView([41.4937, 44.5242], 10);
L.control.zoom({ position: "topright" }).addTo(map);

var borderBounds = null;

var homeControl = L.Control.extend({
  options: { position: "topright" },
  onAdd: function () {
    var c = L.DomUtil.create(
      "div",
      "leaflet-bar leaflet-control leaflet-control-custom",
    );
    c.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="#1f1f1f"><path d="M200-200v-240h80v160h160v80H200Zm480-320v-160H520v-80h240v240h-80Z"/></svg>`;
    c.title = "Zoom to full extent";
    c.style.cssText =
      "background:white;width:30px;height:30px;display:flex;justify-content:center;align-items:center;cursor:pointer;";
    c.onclick = function () {
      if (borderBounds) map.setView(borderBounds.getCenter(), 10);
    };
    return c;
  },
});
map.addControl(new homeControl());

// ===== Basemaps =====
var basemaps = {
  light: L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    { maxZoom: 19, attribution: "© OpenStreetMap © CARTO" },
  ),
  osm: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap",
  }),
  satellite: L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19, attribution: "© Esri" },
  ),
  dark: L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    { maxZoom: 19, attribution: "© OpenStreetMap © CARTO" },
  ),
};
var currentBasemap = basemaps.light;
currentBasemap.addTo(map);

// ===== Georgia border (always visible) =====
fetch("data/georgia_border.geojson")
  .then((r) => r.json())
  .then((data) => {
    var bl = L.geoJSON(data, {
      style: {
        color: "#8B0000",
        weight: 2,
        fill: false,
        dashArray: "4,2",
        opacity: 0.7,
      },
    }).addTo(map);
    borderBounds = bl.getBounds();
    map.invalidateSize();
    map.setView(borderBounds.getCenter(), 10);
  });

// ===== Neutral base layers (municipalities + centroids) =====
var neutralBoundaryLayer = null;
var neutralLabelLayer = null;

function loadNeutralLayers() {
  // პოლიგონალური საზღვრები
  fetch("data/municipalities.geojson")
    .then((r) => r.json())
    .then((data) => {
      neutralBoundaryLayer = L.geoJSON(data, {
        style: {
          fillColor: "#E8E4DC",
          fillOpacity: 0.35,
          color: "#9B8E7A",
          weight: 1.5,
          dashArray: "3,3",
        },
      }).addTo(map);
    });

  // ცენტრის წერტილები + წარწერები
  fetch("data/municipalities_centroids.geojson")
    .then((r) => r.json())
    .then((data) => {
      neutralLabelLayer = L.geoJSON(data, {
        pointToLayer: function (feature, latlng) {
          var name = feature.properties.Name_Geo || "";
          var marker = L.circleMarker(latlng, {
            radius: 5,
            fillColor: "#7A6E60",
            color: "#4A4035",
            weight: 1.5,
            fillOpacity: 0.9,
          });
          marker.bindTooltip(name, {
            permanent: true,
            direction: "top",
            className: "muni-label",
            offset: [0, -8],
          });
          return marker;
        },
      }).addTo(map);
    });
}

function removeNeutralLayers() {
  if (neutralBoundaryLayer) {
    map.removeLayer(neutralBoundaryLayer);
    neutralBoundaryLayer = null;
  }
  if (neutralLabelLayer) {
    map.removeLayer(neutralLabelLayer);
    neutralLabelLayer = null;
  }
}

// ===== State =====
var allFeatures = [];
var currentLayer = null;
var ethnicsLayer = null;
var religionLayer = null;
var activeType = "all";
var activeMuni = "all";
var selectedProps = null;
var censusScope = "selected";
var censusChart = null;
var bottomChart = null;
var activeSublayer = null;
var popLayerActive = false;

// ===== Population helpers =====
function getColor(type) {
  if (type === "ქალაქი") return { fill: "#C8102E", stroke: "#8B0000" };
  if (type === "დაბა") return { fill: "#E8821A", stroke: "#A05010" };
  return { fill: "#4A90D9", stroke: "#1A5090" };
}
function getRadius(pop, type) {
  if (!pop || pop <= 0) {
    if (type === "ქალაქი") return 14;
    if (type === "დაბა") return 7;
    return 4;
  }
  return Math.max(4, Math.min(22, 4 + 18 * Math.sqrt(pop / 159016)));
}

// ===== Build population points layer =====
function buildPopLayer(features) {
  if (currentLayer) map.removeLayer(currentLayer);
  currentLayer = L.geoJSON(
    { type: "FeatureCollection", features: features },
    {
      pointToLayer: function (feature, latlng) {
        var p = feature.properties;
        var type = p.Type_Geo || "სოფელი";
        var c = getColor(type);
        var r = getRadius(p.Pop_2014, type);
        var name = p.Name_Geo || p.Name_Eng || "";
        var marker = L.circleMarker(latlng, {
          radius: r,
          fillColor: c.fill,
          color: c.stroke,
          weight: 1.5,
          fillOpacity: 0.75,
        });
        if (map.getZoom() >= 12)
          marker.bindTooltip(name, {
            permanent: true,
            direction: "top",
            className: "village-label",
            offset: [0, -r - 2],
          });
        marker.on("mouseover", function () {
          this.setStyle({ fillOpacity: 1, weight: 2.5 });
          if (!this.getTooltip())
            this.bindTooltip(name, {
              direction: "top",
              className: "village-label",
              offset: [0, -r - 2],
            }).openTooltip();
        });
        marker.on("mouseout", function () {
          this.setStyle({ fillOpacity: 0.75, weight: 1.5 });
          if (map.getZoom() < 12) this.unbindTooltip();
        });
        marker.on("click", function () {
          selectedProps = p;
          showInfoPop(p);
          showBottomChart(p);
          enableCensusBtn();
        });
        return marker;
      },
    },
  ).addTo(map);
}

// ===== Ethnics helpers =====
var ETH_COLORS = {
  Georgian: "#2E7D32",
  Azerbaijani: "#1565C0",
  Armenian: "#6A1B9A",
  Others: "#795548",
};
var ETH_LABELS = {
  Georgian: "ქართველი",
  Azerbaijani: "აზერბაიჯანელი",
  Armenian: "სომეხი",
  Others: "სხვა",
};

function getDominant(p) {
  return ["Georgian", "Azerbaijani", "Armenian", "Others"].reduce(
    function (a, b) {
      return (p[a] || 0) > (p[b] || 0) ? a : b;
    },
  );
}
function ethFill(p) {
  var dom = getDominant(p);
  return { base: ETH_COLORS[dom], alpha: 0.25 + ((p[dom] || 0) / 100) * 0.6 };
}

function buildEthnicsLayer(data) {
  if (ethnicsLayer) map.removeLayer(ethnicsLayer);
  ethnicsLayer = L.geoJSON(data, {
    style: function (f) {
      var x = ethFill(f.properties);
      return {
        fillColor: x.base,
        fillOpacity: x.alpha,
        color: x.base,
        weight: 2,
        opacity: 0.8,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      var _tip = p.Name_Geo || "";
      if (_tip)
        layer.bindTooltip(_tip, {
          direction: "center",
          className: "village-label",
          sticky: true,
        });
      layer.on("click", function () {
        showInfoEth(p);
        showBottomChartEth(p);
      });
      layer.on("mouseover", function () {
        layer.setStyle({
          weight: 3,
          fillOpacity: Math.min(1, ethFill(p).alpha + 0.15),
        });
      });
      layer.on("mouseout", function () {
        ethnicsLayer.resetStyle(layer);
      });
    },
  }).addTo(map);
  updateLegend("ethnics");
}

// ===== Religion helpers =====
var REL_COLORS = {
  Orthodox: "#1565C0",
  Muslim: "#2E7D32",
  Armenian_A: "#6A1B9A",
  Other_Reli: "#795548",
};
var REL_LABELS = {
  Orthodox: "მართლმადიდებელი",
  Muslim: "მუსლიმი",
  Armenian_A: "სომხ. სამოციქ.",
  Other_Reli: "სხვა",
};

function getDominantRel(p) {
  return ["Orthodox", "Muslim", "Armenian_A", "Other_Reli"].reduce(
    function (a, b) {
      return (p[a] || 0) > (p[b] || 0) ? a : b;
    },
  );
}
function relFill(p) {
  var dom = getDominantRel(p);
  return { base: REL_COLORS[dom], alpha: 0.25 + ((p[dom] || 0) / 100) * 0.6 };
}

function buildReligionLayer(data) {
  if (religionLayer) map.removeLayer(religionLayer);
  religionLayer = L.geoJSON(data, {
    style: function (f) {
      var x = relFill(f.properties);
      return {
        fillColor: x.base,
        fillOpacity: x.alpha,
        color: x.base,
        weight: 2,
        opacity: 0.8,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      var _tip = p.Name_Geo || "";
      if (_tip)
        layer.bindTooltip(_tip, {
          direction: "center",
          className: "village-label",
          sticky: true,
        });
      layer.on("click", function () {
        showInfoRel(p);
        showBottomChartRel(p);
      });
      layer.on("mouseover", function () {
        layer.setStyle({
          weight: 3,
          fillOpacity: Math.min(1, relFill(p).alpha + 0.15),
        });
      });
      layer.on("mouseout", function () {
        religionLayer.resetStyle(layer);
      });
    },
  }).addTo(map);
  updateLegend("religion");
}

// ===== Load data =====
var allSettlements = null;
var ethnicsData = null;
var religionData = null;

function loadSettlements(cb) {
  if (allSettlements) {
    allFeatures = allSettlements;
    if (cb) cb();
    return;
  }
  fetch("data/settlements.geojson")
    .then((r) => r.json())
    .then((data) => {
      allSettlements = data.features;
      allFeatures = data.features;
      if (cb) cb();
    });
}
function loadEthnics(cb) {
  if (ethnicsData) {
    buildEthnicsLayer(ethnicsData);
    if (cb) cb();
    return;
  }
  fetch("data/ethnics.geojson")
    .then((r) => r.json())
    .then((data) => {
      ethnicsData = data;
      buildEthnicsLayer(data);
      if (cb) cb();
    });
}
function loadReligion(cb) {
  if (religionData) {
    buildReligionLayer(religionData);
    if (cb) cb();
    return;
  }
  fetch("data/religion.geojson")
    .then((r) => r.json())
    .then((data) => {
      religionData = data;
      buildReligionLayer(data);
      if (cb) cb();
    });
}

// ===== Remove all thematic layers =====

// ===== Settlement Legend visibility =====
function showSettlementLegend() {
  var el = document.getElementById("settlementLegend");
  if (el) el.style.display = "";
}
function hideSettlementLegend() {
  var el = document.getElementById("settlementLegend");
  if (el) el.style.display = "none";
}
// ===== Chart Panel visibility helpers =====
function showChartPanel() {
  document.getElementById("chartPanel").style.display = "flex";
  var ib = document.getElementById("infoBar");
  if (ib) ib.style.display = "none";
}
function hideChartPanel() {
  document.getElementById("chartPanel").style.display = "none";
  if (bottomChart) {
    bottomChart.destroy();
    bottomChart = null;
  }
  document.getElementById("chartEmpty").style.display = "flex";
  document.getElementById("chartCanvas").classList.add("hidden");
  var ib = document.getElementById("infoBar");
  if (ib) ib.style.display = "flex";
}
function resetChartPanel() {
  document.getElementById("chartEmpty").style.display = "flex";
  document.getElementById("chartCanvas").classList.add("hidden");
  if (bottomChart) {
    bottomChart.destroy();
    bottomChart = null;
  }
}

function removeAllThematic() {
  if (currentLayer) {
    map.removeLayer(currentLayer);
    currentLayer = null;
  }
  if (ethnicsLayer) {
    map.removeLayer(ethnicsLayer);
    ethnicsLayer = null;
  }
  if (religionLayer) {
    map.removeLayer(religionLayer);
    religionLayer = null;
  }
  if (deathLayerRef.layer) {
    map.removeLayer(deathLayerRef.layer);
    deathLayerRef.layer = null;
  }
  if (birthLayerRef.layer) {
    map.removeLayer(birthLayerRef.layer);
    birthLayerRef.layer = null;
  }
  if (densityLayerRef.layer) {
    map.removeLayer(densityLayerRef.layer);
    densityLayerRef.layer = null;
  }
  if (maritalMenLayer) {
    map.removeLayer(maritalMenLayer);
    maritalMenLayer = null;
  }
  if (maritalWomenLayer) {
    map.removeLayer(maritalWomenLayer);
    maritalWomenLayer = null;
  }
  if (idpPolyLayer) {
    map.removeLayer(idpPolyLayer);
    idpPolyLayer = null;
  }
  if (idpPointLayer) {
    map.removeLayer(idpPointLayer);
    idpPointLayer = null;
  }
  document.getElementById("infoCard").classList.add("hidden");
  document.getElementById("chartEmpty").style.display = "flex";
  document.getElementById("chartCanvas").classList.add("hidden");
}

// ============================================================
// იძულებით გადაადგილებული პირები
// ============================================================
var idpPolyData = null;
var idpPointData = null;
var idpPolyLayer = null;
var idpPointLayer = null;
var activeIdpMetric = "natural";

// სტოპები რეალური მონაცემების მიხ.: natural 35–1265, armed 225–2070
var IDP_STOPS = {
  natural: [
    [100, "#FDE0C8"],
    [300, "#F9A86E"],
    [600, "#E8621A"],
    [900, "#A83D08"],
    [9999, "#6B2000"],
  ],
  armed: [
    [300, "#EAE0F8"],
    [600, "#C5B3E6"],
    [900, "#8A63C8"],
    [1400, "#5C3699"],
    [9999, "#320D6D"],
  ],
};
var IDP_LABELS = {
  natural: "სტიქიის გამო გადაადგ.",
  armed: "შეიარ. კონფლიქტის გამო",
};

function idpParseCount(raw) {
  if (
    raw === null ||
    raw === undefined ||
    raw === "" ||
    raw === "0" ||
    raw === 0
  )
    return 0;
  var s = String(raw).trim();
  var dash = s.indexOf("-");
  if (dash > 0) {
    var a = parseFloat(s.slice(0, dash)) || 0,
      b = parseFloat(s.slice(dash + 1)) || a;
    return Math.round((a + b) / 2);
  }
  return Math.round(parseFloat(s) || 0);
}

function getIdpColor(val, metric) {
  if (!val || val <= 0) return null;
  var stops = IDP_STOPS[metric];
  for (var i = 0; i < stops.length; i++) {
    if (val <= stops[i][0]) return stops[i][1];
  }
  return stops[stops.length - 1][1];
}

function loadIDP() {
  var loaded = 0,
    total = (!idpPolyData ? 1 : 0) + (!idpPointData ? 1 : 0);
  function onDone() {
    loaded++;
    if (loaded >= total) buildIDPLayers();
  }
  if (!idpPolyData) {
    fetch("data/idp_municipalities.geojson")
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        idpPolyData = d;
        onDone();
      });
  }
  if (!idpPointData) {
    fetch("data/idp_settlements.geojson")
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        idpPointData = d;
        onDone();
      });
  }
  if (idpPolyData && idpPointData) buildIDPLayers();
}

function buildIDPLayers() {
  if (idpPolyLayer) {
    map.removeLayer(idpPolyLayer);
    idpPolyLayer = null;
  }
  if (idpPointLayer) {
    map.removeLayer(idpPointLayer);
    idpPointLayer = null;
  }
  var metric = activeIdpMetric;
  var col = metric === "natural" ? "Natural_Di" : "Armed_Conf";
  var color = metric === "natural" ? "#E8621A" : "#8A63C8";

  // Choropleth
  idpPolyLayer = L.geoJSON(idpPolyData, {
    style: function (f) {
      var val = Math.round(f.properties[col] || 0);
      var fill = getIdpColor(val, metric);
      return {
        fillColor: fill || "#f0ebe3",
        fillOpacity: fill ? 0.82 : 0.15,
        color: "#5A4530",
        weight: 1.4,
        opacity: 0.9,
      };
    },
    onEachFeature: function (f, layer) {
      var p = f.properties;
      var val = Math.round(p[col] || 0);
      layer.bindTooltip(p.Name_Geo + ": " + val, {
        direction: "center",
        className: "village-label",
        sticky: true,
      });
      layer.on("click", function () {
        showInfoIDPMuni(p);
        showBottomChartIDP();
      });
    },
  }).addTo(map);

  // Points
  idpPointLayer = L.geoJSON(idpPointData, {
    pointToLayer: function (feat, latlng) {
      var p = feat.properties;
      var raw = metric === "natural" ? p.Natural_Di : p.Armed_Conf;
      var cnt = idpParseCount(raw);
      if (cnt === 0) return null;
      var r = Math.min(28, Math.max(12, 12 + cnt * 0.08));
      var fs = Math.max(8, Math.round(r * 0.36));
      var svg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="' +
        r +
        '" height="' +
        r +
        '">' +
        '<circle cx="12" cy="12" r="10" fill="' +
        color +
        '" fill-opacity="0.85" stroke="#fff" stroke-width="2"/>' +
        '<text x="12" y="16" text-anchor="middle" font-size="' +
        fs +
        '" fill="#fff" font-weight="bold">' +
        cnt +
        "</text>" +
        "</svg>";
      var icon = L.divIcon({
        html: svg,
        iconSize: [r, r],
        iconAnchor: [r / 2, r / 2],
        className: "",
      });
      var marker = L.marker(latlng, { icon: icon });
      marker.bindTooltip(p.Name_Geo + " — " + raw, {
        direction: "top",
        className: "village-label",
        offset: [0, -r / 2 - 2],
      });
      marker.on("click", function () {
        showInfoIDPPoint(p);
      });
      return marker;
    },
  }).addTo(map);

  updateIDPLegend();
  if (muniBorderOverlay) muniBorderOverlay.bringToFront();
}

function showInfoIDPMuni(p) {
  var nat = Math.round(p.Natural_Di || 0),
    arm = Math.round(p.Armed_Conf || 0);
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;font-weight:700;">' +
    p.Name_Geo +
    "</div>" +
    '<span class="info-type-badge" style="background:#E8621A22;color:#A83D08;border:1px solid #E8621A;">იძ. გადაადგ. პირები</span>' +
    '<div style="margin-top:8px;font-size:11px;color:#444;line-height:2;">' +
    '<b>სტიქიის გამო:</b> <span style="font-weight:700;color:#E8621A;">' +
    nat.toLocaleString() +
    "</span><br>" +
    '<b>შეიარ. კონფლ.:</b> <span style="font-weight:700;color:#8A63C8;">' +
    arm.toLocaleString() +
    "</span><br>" +
    '<b>სულ:</b> <span style="font-weight:700;">' +
    (nat + arm).toLocaleString() +
    "</span>" +
    "</div>";
  document.getElementById("infoCard").classList.remove("hidden");
}

function showInfoIDPPoint(p) {
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;font-weight:700;">' +
    p.Name_Geo +
    "</div>" +
    '<span class="info-type-badge" style="background:#E8621A22;color:#A83D08;border:1px solid #E8621A;">' +
    (p.Type_Geo || "") +
    " — " +
    (p.Municipal_ || "") +
    "</span>" +
    '<div style="margin-top:8px;font-size:11px;color:#444;line-height:2;">' +
    '<b>სტიქიის გამო:</b> <span style="font-weight:700;color:#E8621A;">' +
    (p.Natural_Di || "0") +
    "</span><br>" +
    '<b>შეიარ. კონფლ.:</b> <span style="font-weight:700;color:#8A63C8;">' +
    (p.Armed_Conf || "0") +
    "</span><br>" +
    (p.High_Mount === "კი" ? "<b>მაღალმთიანი:</b> კი" : "") +
    "</div>";
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartIDP() {
  if (!idpPolyData) return;
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();
  var feats = idpPolyData.features.slice().sort(function (a, b) {
    return (
      (b.properties.Natural_Di || 0) +
      (b.properties.Armed_Conf || 0) -
      ((a.properties.Natural_Di || 0) + (a.properties.Armed_Conf || 0))
    );
  });
  var labels = feats.map(function (f) {
    return f.properties.Name_Geo;
  });
  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "სტიქიის გამო",
          data: feats.map(function (f) {
            return Math.round(f.properties.Natural_Di || 0);
          }),
          backgroundColor: "#E8621ACC",
          borderColor: "#A83D08",
          borderWidth: 1.5,
          borderRadius: 4,
          yAxisID: "y",
        },
        {
          label: "შეიარ. კონფლ.",
          data: feats.map(function (f) {
            return Math.round(f.properties.Armed_Conf || 0);
          }),
          backgroundColor: "#8A63C8CC",
          borderColor: "#5C3699",
          borderWidth: 1.5,
          borderRadius: 4,
          yAxisID: "y",
        },
      ],
    },
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
          text: "იძ. გადაადგ. პირები მუნ. მიხ.",
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: {
            label: function (c) {
              return " " + c.dataset.label + ": " + c.parsed.y.toLocaleString();
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { font: { family: "Fira Sans", size: 9 } },
          title: { display: true, text: "პირები", font: { size: 8 } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 9 }, maxRotation: 35 },
          grid: { display: false },
        },
      },
    },
  });
}

function updateIDPLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var metric = activeIdpMetric,
    stops = IDP_STOPS[metric];
  var color = metric === "natural" ? "#E8621A" : "#8A63C8";
  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:7px;text-transform:uppercase;letter-spacing:.06em;">' +
    IDP_LABELS[metric] +
    "</div>";
  html +=
    '<div style="display:flex;gap:4px;margin-bottom:9px;flex-wrap:wrap;">';
  ["natural", "armed"].forEach(function (m) {
    var c = m === "natural" ? "#E8621A" : "#8A63C8";
    var a =
      m === metric
        ? "background:" + c + ";color:#fff;"
        : "background:#e4e0da;color:#555;";
    html +=
      "<button onclick=\"setIDPMetric('" +
      m +
      '\')" style="' +
      a +
      'border:none;border-radius:10px;padding:3px 8px;font-size:9px;cursor:pointer;font-family:Fira Sans,sans-serif;line-height:1.4;">' +
      IDP_LABELS[m] +
      "</button>";
  });
  html += "</div>";
  var prev = 0;
  stops.forEach(function (s) {
    var to =
      s[0] >= 9999
        ? ">" + prev.toLocaleString()
        : prev.toLocaleString() + "–" + s[0].toLocaleString();
    html +=
      '<div style="display:flex;align-items:center;margin-bottom:4px;">' +
      '<span style="display:inline-block;width:18px;height:13px;border-radius:2px;background:' +
      s[1] +
      ';margin-right:7px;flex-shrink:0;border:1px solid rgba(0,0,0,.15);"></span>' +
      '<span style="font-size:10px;">' +
      to +
      "</span></div>";
    prev = s[0];
  });
  html +=
    '<div style="margin-top:8px;font-size:9px;color:var(--text-muted);">წერტ. = დასახ. · ზომა ~ რაოდ. · მუნ-ზე დაჭ. — ბარ ჩარტი</div>';
  el.innerHTML = html;
}

function setIDPMetric(metric) {
  activeIdpMetric = metric;
  buildIDPLayers();
}

// ===== Switch sublayer =====
function switchSublayer(sub) {
  resetChartPanel();
  var _popInfoMap = {
    population: "population",
    ethnics: "ethnics",
    religion: "religion",
    marital: "marital",
    death_rate: "death_rate",
    birth_rate: "birth_rate",
    density: "density",
    idp: "idp",
  };
  setInfoBtn(_popInfoMap[sub] || null);
  if (
    sub === "population" ||
    sub === "ethnics" ||
    sub === "density" ||
    sub === "death_rate" ||
    sub === "birth_rate" ||
    sub === "marital" ||
    sub === "religion" ||
    sub === "idp"
  ) {
    showSettlementLegend();
  } else {
    hideSettlementLegend();
  }
  activeSublayer = sub;
  removeAllThematic();

  var filterSec = document.getElementById("filterSection");

  if (sub === "population") {
    document.getElementById("filterSection").style.display = "";
    loadSettlements(function () {
      applyFilters();
    });
    resetPopLegend();
  } else if (sub === "ethnics") {
    document.getElementById("filterSection").style.display = "none";
    loadEthnics();
  } else if (sub === "religion") {
    document.getElementById("filterSection").style.display = "none";
    loadReligion();
  } else if (sub === "death_rate") {
    document.getElementById("filterSection").style.display = "none";
    loadDeathRate();
  } else if (sub === "birth_rate") {
    document.getElementById("filterSection").style.display = "none";
    loadBirthRate();
  } else if (sub === "density") {
    document.getElementById("filterSection").style.display = "none";
    loadDensity();
  } else if (sub === "marital") {
    document.getElementById("filterSection").style.display = "none";
    loadMarital();
  } else if (sub === "idp") {
    document.getElementById("filterSection").style.display = "none";
    loadIDP();
  }
  // შედარება მხოლოდ მოსახლ. ქვეფენებზე
  var _cb = document.getElementById("btnCompare");
  if (_cb)
    _cb.style.display = _popInfoMap && _popInfoMap[sub] ? "flex" : "none";
}

// ===== Filters (population) =====
function applyFilters() {
  var filtered = allFeatures.filter(function (f) {
    var p = f.properties;
    return (
      (activeType === "all" || p.Type_Geo === activeType) &&
      (activeMuni === "all" || p.Municipal_ === activeMuni)
    );
  });
  buildPopLayer(filtered);
  document.getElementById("statVisible").textContent = filtered.length;
  document.getElementById("statTotal").textContent = allFeatures.length;
}

// ===== Zoom labels =====
map.on("zoomend", function () {
  if (!currentLayer) return;
  currentLayer.eachLayer(function (layer) {
    var p = layer.feature.properties;
    var name = p.Name_Geo || p.Name_Eng || "";
    var r = getRadius(p.Pop_2014, p.Type_Geo);
    if (map.getZoom() >= 12)
      layer.bindTooltip(name, {
        permanent: true,
        direction: "top",
        className: "village-label",
        offset: [0, -r - 2],
      });
    else layer.unbindTooltip();
  });
});

// ===== Legend =====
function updateLegend(type) {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var colors = type === "ethnics" ? ETH_COLORS : REL_COLORS;
  var labels = type === "ethnics" ? ETH_LABELS : REL_LABELS;
  el.innerHTML =
    '<div class="ethnics-legend">' +
    Object.entries(labels)
      .map(function ([k, v]) {
        return `<div class="eth-legend-item"><span class="eth-dot" style="background:${colors[k]};border-radius:3px;"></span><span>${v} (დომინ.)</span></div>`;
      })
      .join("") +
    "</div>";
}

function resetPopLegend() {
  var el = document.getElementById("legendContent");
  if (el) el.innerHTML = "";
}

// ===== Info cards =====
function showInfoPop(p) {
  var typeGeo = p.Type_Geo || "სოფელი";
  var bc =
    typeGeo === "ქალაქი"
      ? "badge-city"
      : typeGeo === "დაბა"
        ? "badge-town"
        : "badge-village";
  function fmt(n) {
    return n != null ? parseInt(n).toLocaleString("ka-GE") : "–";
  }
  document.getElementById("infoCardContent").innerHTML = `
    <div class="info-name">${p.Name_Geo || p.Name_Eng || "უცნობი"}</div>
    <span class="info-type-badge ${bc}">${typeGeo}</span>
    <div class="info-row"><span class="info-key">ინგლ. სახელი</span><span class="info-val">${p.Name_Eng || "–"}</span></div>
    <div class="info-row"><span class="info-key">მუნიციპ.</span><span class="info-val">${p.Municipal_ || "–"}</span></div>
    <div class="info-row"><span class="info-key">ოიკონიმია</span><span class="info-val">${p.Oikonymy || "–"}</span></div>
    <div class="info-row"><span class="info-key">მთიანი</span><span class="info-val">${p.High_Mount || "–"}</span></div>
    <hr style="margin:8px 0;border-top:1px solid #f0ede8;">
    <div class="info-row"><span class="info-key">1989</span><span class="info-val">${fmt(p.Pop_1989)}</span></div>
    <div class="info-row"><span class="info-key">2002</span><span class="info-val">${fmt(p.Pop_2002)}</span></div>
    <div class="info-row"><span class="info-key">2014</span><span class="info-val pop-num">${fmt(p.Pop_2014)}</span></div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showInfoEth(p) {
  var dom = getDominant(p);
  var bars = ["Georgian", "Azerbaijani", "Armenian", "Others"]
    .map(function (key) {
      var pct = p[key] || 0;
      return `<div class="eth-bar-row"><span class="eth-bar-label">${ETH_LABELS[key]}</span>
      <div class="eth-bar-track"><div class="eth-bar-fill" style="width:${pct}%;background:${ETH_COLORS[key]};"></div></div>
      <span class="eth-bar-pct">${pct}%</span></div>`;
    })
    .join("");
  document.getElementById("infoCardContent").innerHTML = `
    <div class="info-name">${p.Name_Geo || p.Name_Eng || "–"}</div>
    <div style="margin-top:8px;font-size:10px;color:var(--text-muted);margin-bottom:4px;">ეროვნული შემადგენლობა (2014)</div>
    <div class="eth-bar-wrap">${bars}</div>
    <div class="info-row" style="margin-top:8px;"><span class="info-key">დომინანტი</span><span class="info-val" style="color:${ETH_COLORS[dom]}">${ETH_LABELS[dom]}</span></div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showInfoRel(p) {
  var dom = getDominantRel(p);
  var bars = ["Orthodox", "Muslim", "Armenian_A", "Other_Reli"]
    .map(function (key) {
      var pct = p[key] || 0;
      return `<div class="eth-bar-row"><span class="eth-bar-label" style="width:64px;">${REL_LABELS[key]}</span>
      <div class="eth-bar-track"><div class="eth-bar-fill" style="width:${pct}%;background:${REL_COLORS[key]};"></div></div>
      <span class="eth-bar-pct">${pct}%</span></div>`;
    })
    .join("");
  document.getElementById("infoCardContent").innerHTML = `
    <div class="info-name">${p.Name_Geo || p.Name_Eng || "–"}</div>
    <div style="margin-top:8px;font-size:10px;color:var(--text-muted);margin-bottom:4px;">აღმსარებლობა (2014)</div>
    <div class="eth-bar-wrap">${bars}</div>
    <div class="info-row" style="margin-top:8px;"><span class="info-key">დომინანტი</span><span class="info-val" style="color:${REL_COLORS[dom]}">${REL_LABELS[dom]}</span></div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

// ===== Density helpers =====
// ლოგარითმული სკალა — რუსთავის გამო (1796 vs დანარჩენი <130)
var DENSITY_BREAKS = [
  { max: 25, color: "#BDD7E7", label: "< 25" },
  { max: 50, color: "#BDD7E7", label: "25–50" },
  { max: 100, color: "#6BAED6", label: "51–100" },
  { max: 200, color: "#2171B5", label: "101–200" },
  { max: 99999, color: "#08306B", label: "> 200" },
];

function getDensityColor(val) {
  if (val == null) return "#CCCCCC";
  for (var i = 0; i < DENSITY_BREAKS.length; i++) {
    if (val <= DENSITY_BREAKS[i].max) return DENSITY_BREAKS[i].color;
  }
  return DENSITY_BREAKS[DENSITY_BREAKS.length - 1].color;
}

var activeDensityYear = "2024";
var densityLayerRef = { layer: null };
var densityData = null;

function buildDensityLayer(data) {
  if (densityLayerRef.layer) map.removeLayer(densityLayerRef.layer);
  var field = "De_" + activeDensityYear;
  densityLayerRef.layer = L.geoJSON(data, {
    style: function (feat) {
      var val = feat.properties[field];
      return {
        fillColor: getDensityColor(val),
        fillOpacity: 0.78,
        color: "#4A6FA5",
        weight: 1.5,
        opacity: 0.9,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      var _tip = p.Name_Geo || "";
      if (_tip)
        layer.bindTooltip(_tip, {
          direction: "center",
          className: "village-label",
          sticky: true,
        });
      layer.on("click", function () {
        showInfoDensity(p);
        showBottomChartDensity(p);
      });
      layer.on("mouseover", function () {
        layer.setStyle({ weight: 3, fillOpacity: 0.95 });
      });
      layer.on("mouseout", function () {
        densityLayerRef.layer.resetStyle(layer);
      });
    },
  }).addTo(map);
  updateDensityLegend();
}

function loadDensity() {
  if (densityData) {
    buildDensityLayer(densityData);
    return;
  }
  fetch("data/density.geojson")
    .then((r) => r.json())
    .then((data) => {
      densityData = data;
      buildDensityLayer(data);
    });
}

function updateDensityLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var years = ["1989", "2002", "2014", "2024"];
  var html = `<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">სიმჭიდროვე (კაცი/კმ²)</div>`;
  html += '<div class="ethnics-legend">';
  DENSITY_BREAKS.forEach(function (b) {
    html += `<div class="eth-legend-item">
      <span class="eth-dot" style="background:${b.color};border:1px solid rgba(0,0,0,0.15);border-radius:3px;"></span>
      <span>${b.label}</span>
    </div>`;
  });
  html += `</div><div style="margin-top:10px;">
    <div style="font-size:9px;font-weight:700;color:var(--text-muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;">წელი</div>
    <div style="display:flex;gap:4px;flex-wrap:wrap;">
      ${years.map((y) => `<button class="year-btn ${activeDensityYear === y ? "active" : ""}" data-dyear="${y}">${y}</button>`).join("")}
    </div></div>`;
  el.innerHTML = html;
  el.querySelectorAll("[data-dyear]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      activeDensityYear = this.dataset.dyear;
      if (activeSublayer === "density") buildDensityLayer(densityData);
    });
  });
}

function showInfoDensity(p) {
  function row(year, field) {
    var val = p[field];
    return `<div class="info-row">
      <span class="info-key">${year}</span>
      <span class="info-val" style="display:flex;align-items:center;gap:6px;">
        <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${getDensityColor(val)};border:1px solid rgba(0,0,0,.15);flex-shrink:0;"></span>
        ${val != null ? val + " კაცი/კმ²" : "–"}
      </span>
    </div>`;
  }
  document.getElementById("infoCardContent").innerHTML = `
    <div class="info-name">${p.Name_Geo || p.Name_Eng || "–"}</div>
    <div style="margin-top:6px;font-size:10px;color:var(--text-muted);margin-bottom:8px;">მოსახლეობის სიმჭიდროვე</div>
    ${row("1989", "De_1989")}${row("2002", "De_2002")}${row("2014", "De_2014")}${row("2024", "De_2024")}`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartDensity(p) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();
  var vals = [p.De_1989, p.De_2002, p.De_2014, p.De_2024];
  bottomChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: ["1989", "2002", "2014", "2024"],
      datasets: [
        {
          label: "კაცი/კმ²",
          data: vals,
          borderColor: "#2171B5",
          backgroundColor: "rgba(33,113,181,0.1)",
          borderWidth: 2.5,
          pointRadius: 5,
          pointBackgroundColor: "#2171B5",
          fill: true,
          tension: 0.3,
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
          text: `${p.Name_Geo || ""} — მოსახლეობის სიმჭიდროვე (კაცი/კმ²)`,
          font: { family: "Fira Sans", size: 12, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: { callbacks: { label: (c) => ` ${c.parsed.y} კაცი/კმ²` } },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: { font: { family: "Fira Sans", size: 10 }, color: "#6B6862" },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 11 }, color: "#1A1A18" },
          grid: { display: false },
        },
      },
    },
  });
}

// ===== Marital Status — Pie Charts on Map =====
var MARITAL_COLORS = {
  Married: "#2166AC",
  NMarried: "#74ADD1",
  Widow: "#F46D43",
  Divorced: "#D73027",
  NoData: "#CCCCCC",
};
var MARITAL_LABELS = {
  Married: "ქორწინებაში",
  NMarried: "არასდ. ყოფილა",
  Widow: "ქვრივი",
  Divorced: "განქ./განშ.",
  NoData: "არ არის მითით.",
};

var maritalYear = "2014";
var maritalGender = "men";
var maritalMenLayer = null;
var maritalWomenLayer = null;
var maritalMenData = null;
var maritalWomenData = null;

// SVG pie chart
function makePieSVG(values, size) {
  var keys = ["Married", "NMarried", "Widow", "Divorced", "NoData"];
  var total = keys.reduce(function (s, k) {
    return s + (values[k] || 0);
  }, 0);
  if (total === 0) return "";
  var cx = size / 2,
    cy = size / 2,
    r = size / 2 - 2;
  var startAngle = -Math.PI / 2;
  var paths = "";
  keys.forEach(function (key) {
    var val = values[key] || 0;
    if (val === 0) return;
    var angle = (val / total) * 2 * Math.PI;
    var endAngle = startAngle + angle;
    var x1 = cx + r * Math.cos(startAngle),
      y1 = cy + r * Math.sin(startAngle);
    var x2 = cx + r * Math.cos(endAngle),
      y2 = cy + r * Math.sin(endAngle);
    var largeArc = angle > Math.PI ? 1 : 0;
    paths += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z" fill="${MARITAL_COLORS[key]}" stroke="white" stroke-width="0.8"/>`;
    startAngle = endAngle;
  });
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="white" stroke="#ccc" stroke-width="1"/>
    ${paths}
    <circle cx="${cx}" cy="${cy}" r="${r * 0.38}" fill="white"/>
  </svg>`;
}

function buildMaritalLayer(data, gender) {
  var yr = maritalYear;
  var layer = L.geoJSON(data, {
    pointToLayer: function (feature, latlng) {
      var p = feature.properties;
      var vals = {
        Married: p["Married_" + yr],
        NMarried: p["NMarried_" + yr],
        Widow: p["Widow_" + yr],
        Divorced: p["Divorced_" + yr],
        NoData: p["NoData_" + yr],
      };
      var size = 90;
      var svg = makePieSVG(vals, size);
      var icon = L.divIcon({
        html: `<div style="position:relative;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2));">
          ${svg}
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:11px;font-weight:700;color:#222;font-family:'Fira Sans',sans-serif;white-space:nowrap;text-align:center;line-height:1.2;pointer-events:none;">${p.Name_Geo}</div>
        </div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        className: "",
      });
      var marker = L.marker(latlng, { icon: icon });
      marker.on("click", function () {
        showInfoMarital(p, gender);
        showBottomChartMarital(p, gender);
      });
      return marker;
    },
  }).addTo(map);
  return layer;
}

function loadMarital() {
  if (maritalMenData && maritalWomenData) {
    renderMaritalLayers();
    return;
  }
  var pending = 2;
  function done() {
    if (--pending === 0) renderMaritalLayers();
  }
  if (!maritalMenData) {
    fetch("data/marital_men.geojson")
      .then((r) => r.json())
      .then((data) => {
        maritalMenData = data;
        done();
      });
  } else done();
  if (!maritalWomenData) {
    fetch("data/marital_women.geojson")
      .then((r) => r.json())
      .then((data) => {
        maritalWomenData = data;
        done();
      });
  } else done();
}

function renderMaritalLayers() {
  if (maritalMenLayer) {
    map.removeLayer(maritalMenLayer);
    maritalMenLayer = null;
  }
  if (maritalWomenLayer) {
    map.removeLayer(maritalWomenLayer);
    maritalWomenLayer = null;
  }
  maritalMenLayer = buildMaritalLayer(maritalMenData, "men");
  maritalWomenLayer = buildMaritalLayer(maritalWomenData, "women");
  // gender toggle — ვმალავთ არაქტიურს
  if (maritalGender === "men") {
    maritalWomenLayer.eachLayer(function (l) {
      l.setOpacity(0);
      if (l.setIcon) l.getElement() && (l.getElement().style.display = "none");
    });
  } else {
    maritalMenLayer.eachLayer(function (l) {
      l.getElement() && (l.getElement().style.display = "none");
    });
  }
  updateMaritalLegend();
}

function setMaritalGenderVisible() {
  var showMen = maritalGender === "men";
  var showWomen = maritalGender === "women";
  if (maritalMenLayer)
    maritalMenLayer.eachLayer(function (l) {
      var el = l.getElement();
      if (el) el.style.display = showMen ? "" : "none";
    });
  if (maritalWomenLayer)
    maritalWomenLayer.eachLayer(function (l) {
      var el = l.getElement();
      if (el) el.style.display = showWomen ? "" : "none";
    });
}

function updateMaritalLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html = `<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">ქორწინებითი მდგომარეობა</div>`;
  html += '<div class="ethnics-legend">';
  Object.entries(MARITAL_LABELS).forEach(function ([k, v]) {
    html += `<div class="eth-legend-item"><span class="eth-dot" style="background:${MARITAL_COLORS[k]};border-radius:50%;"></span><span>${v}</span></div>`;
  });
  html += `</div>
  <div style="margin-top:10px;">
    <div style="font-size:9px;font-weight:700;color:var(--text-muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;">სქესი</div>
    <div style="display:flex;gap:6px;margin-bottom:8px;">
      <button class="year-btn ${maritalGender === "men" ? "active" : ""}" data-mgender="men">მამაკაცი</button>
      <button class="year-btn ${maritalGender === "women" ? "active" : ""}" data-mgender="women">ქალი</button>
    </div>
    <div style="font-size:9px;font-weight:700;color:var(--text-muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;">წელი</div>
    <div style="display:flex;gap:6px;">
      <button class="year-btn ${maritalYear === "2002" ? "active" : ""}" data-myear="2002">2002</button>
      <button class="year-btn ${maritalYear === "2014" ? "active" : ""}" data-myear="2014">2014</button>
    </div>
  </div>`;
  el.innerHTML = html;
  el.querySelectorAll("[data-mgender]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      maritalGender = this.dataset.mgender;
      setMaritalGenderVisible();
      updateMaritalLegend();
    });
  });
  el.querySelectorAll("[data-myear]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      maritalYear = this.dataset.myear;
      renderMaritalLayers();
    });
  });
}

function showInfoMarital(p, gender) {
  var yr = maritalYear;
  var gLabel = gender === "men" ? "მამაკაცი" : "ქალი";
  function row(key) {
    var val = p[key + "_" + yr] || 0;
    return `<div class="info-row"><span class="info-key" style="display:flex;align-items:center;gap:5px;">
      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${MARITAL_COLORS[key]};flex-shrink:0;"></span>${MARITAL_LABELS[key]}</span>
      <span class="info-val">${val} ‰</span></div>`;
  }
  document.getElementById("infoCardContent").innerHTML = `
    <div class="info-name">${p.Name_Geo || "–"}</div>
    <span class="info-type-badge badge-village">${gLabel} · ${yr}</span>
    <div style="margin-top:8px;">
    ${row("Married")}${row("NMarried")}${row("Widow")}${row("Divorced")}${row("NoData")}
    </div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartMarital(p, gender) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

  var yr = maritalYear;
  var gLabel = gender === "men" ? "მამაკაცი" : "ქალი";
  var keys = ["Married", "NMarried", "Widow", "Divorced", "NoData"];
  var labels = keys.map((k) => MARITAL_LABELS[k]);
  var values = keys.map((k) => p[k + "_" + yr] || 0);
  var colors = keys.map((k) => MARITAL_COLORS[k]);

  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "‰",
          data: values,
          backgroundColor: colors.map((c) => c + "CC"),
          borderColor: colors,
          borderWidth: 2,
          borderRadius: 5,
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
          text: `${p.Name_Geo} — ქორწინებითი მდგომარეობა · ${gLabel} · ${yr} (‰)`,
          font: { family: "Fira Sans", size: 12, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: {
            label: function (c) {
              return ` ${c.parsed.y} ‰  (ყოველ 1000-ზე)`;
            },
          },
        },
        datalabels: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 800,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: {
            font: { family: "Fira Sans", size: 10 },
            color: "#6B6862",
            callback: function (v) {
              return v + " ‰";
            },
          },
        },
        x: {
          ticks: {
            font: { family: "Fira Sans", size: 10 },
            color: "#1A1A18",
            maxRotation: 0,
          },
          grid: { display: false },
        },
      },
      // რიცხვები ბარების თავზე
      animation: {
        onComplete: function () {
          var chart = this;
          var ctx2 = chart.ctx;
          ctx2.font = "bold 10px 'Fira Sans', sans-serif";
          ctx2.fillStyle = "#333";
          ctx2.textAlign = "center";
          ctx2.textBaseline = "bottom";
          chart.data.datasets.forEach(function (dataset, i) {
            var meta = chart.getDatasetMeta(i);
            meta.data.forEach(function (bar, index) {
              var val = dataset.data[index];
              if (val > 0) {
                ctx2.fillText(val + " ‰", bar.x, bar.y - 3);
              }
            });
          });
        },
      },
    },
  });
}

// ===== Death Rate & Birth Rate helpers =====
var DEATH_COLORS = {
  "<9": "#FFF5F0",
  "9-10": "#FCBBA1",
  "10.1-11": "#FC8D59",
  "11.1-12": "#D7301F",
  "12.1-13": "#990000",
  ">13.1": "#4D0000",
};
var BIRTH_COLORS = {
  "<9.9": "#C7E9C0",
  "10-11.4": "#A1D99B",
  "11.5-12.9": "#74C476",
  "13.1-14.4": "#238B45",
  ">14.5": "#00441B",
};

function getRateColor(val, colorMap) {
  return colorMap[val] || "#CCCCCC";
}

var activeRateYear = "2012";
var deathLayerRef = { layer: null, type: "death" };
var birthLayerRef = { layer: null, type: "birth" };
var deathData = null;
var birthData = null;

function buildRateLayer(data, f12, f22, colorMap, ref) {
  if (ref.layer) map.removeLayer(ref.layer);
  var field = activeRateYear === "2012" ? f12 : f22;
  ref.layer = L.geoJSON(data, {
    style: function (feat) {
      var val = feat.properties[field] || "";
      return {
        fillColor: getRateColor(val, colorMap),
        fillOpacity: 0.75,
        color: "#555",
        weight: 1.5,
        opacity: 0.8,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      var _tip = p.Name_Geo || "";
      if (_tip)
        layer.bindTooltip(_tip, {
          direction: "center",
          className: "village-label",
          sticky: true,
        });
      layer.on("click", function () {
        showInfoRate(p, f12, f22, colorMap, ref.type);
        showBottomChartRate(p, f12, f22, ref.type);
      });
      layer.on("mouseover", function () {
        layer.setStyle({ weight: 3, fillOpacity: 0.9 });
      });
      layer.on("mouseout", function () {
        ref.layer.resetStyle(layer);
      });
    },
  }).addTo(map);
}

function loadDeathRate() {
  if (deathData) {
    buildRateLayer(
      deathData,
      "Death_2012",
      "Death_2022",
      DEATH_COLORS,
      deathLayerRef,
    );
    updateRateLegend("death");
    return;
  }
  fetch("data/death_rate.geojson")
    .then((r) => r.json())
    .then((data) => {
      deathData = data;
      buildRateLayer(
        data,
        "Death_2012",
        "Death_2022",
        DEATH_COLORS,
        deathLayerRef,
      );
      updateRateLegend("death");
    });
}

function loadBirthRate() {
  if (birthData) {
    buildRateLayer(
      birthData,
      "Birth_2012",
      "Birth_2022",
      BIRTH_COLORS,
      birthLayerRef,
    );
    updateRateLegend("birth");
    return;
  }
  fetch("data/birth_rate.geojson")
    .then((r) => r.json())
    .then((data) => {
      birthData = data;
      buildRateLayer(
        data,
        "Birth_2012",
        "Birth_2022",
        BIRTH_COLORS,
        birthLayerRef,
      );
      updateRateLegend("birth");
    });
}

function updateRateLegend(type) {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var colorMap = type === "death" ? DEATH_COLORS : BIRTH_COLORS;
  var title = type === "death" ? "მოკვდავობა (‰)" : "შობადობა (‰)";
  var html = `<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">${title}</div>`;
  html += '<div class="ethnics-legend">';
  Object.entries(colorMap).forEach(function ([range, color]) {
    html += `<div class="eth-legend-item"><span class="eth-dot" style="background:${color};border:1px solid rgba(0,0,0,0.15);border-radius:3px;"></span><span>${range}</span></div>`;
  });
  html += `</div><div style="margin-top:10px;">
    <div style="font-size:9px;font-weight:700;color:var(--text-muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;">წელი</div>
    <div style="display:flex;gap:6px;">
      <button class="year-btn ${activeRateYear === "2012" ? "active" : ""}" data-year="2012">2012</button>
      <button class="year-btn ${activeRateYear === "2022" ? "active" : ""}" data-year="2022">2022</button>
    </div></div>`;
  el.innerHTML = html;
  el.querySelectorAll(".year-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      activeRateYear = this.dataset.year;
      if (activeSublayer === "death_rate") loadDeathRate();
      if (activeSublayer === "birth_rate") loadBirthRate();
    });
  });
}

function showInfoRate(p, f12, f22, colorMap, type) {
  var label = type === "death" ? "მოკვდავობა" : "შობადობა";
  var v12 = p[f12] || "–",
    v22 = p[f22] || "–";
  document.getElementById("infoCardContent").innerHTML = `
    <div class="info-name">${p.Name_Geo || p.Name_Eng || "–"}</div>
    <div style="margin-top:6px;font-size:10px;color:var(--text-muted);margin-bottom:8px;">${label}ის ზოგ. კოეფიციენტი (‰)</div>
    <div class="info-row"><span class="info-key">2012</span>
      <span class="info-val" style="display:flex;align-items:center;gap:6px;">
        <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${getRateColor(v12, colorMap)};border:1px solid rgba(0,0,0,.15);flex-shrink:0;"></span>${v12}
      </span></div>
    <div class="info-row"><span class="info-key">2022</span>
      <span class="info-val" style="display:flex;align-items:center;gap:6px;">
        <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${getRateColor(v22, colorMap)};border:1px solid rgba(0,0,0,.15);flex-shrink:0;"></span>${v22}
      </span></div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartRate(p, f12, f22, type) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();
  var label = type === "death" ? "მოკვდავობა" : "შობადობა";
  var bgCols =
    type === "death"
      ? ["rgba(203,27,27,0.2)", "rgba(153,0,13,0.2)"]
      : ["rgba(65,171,93,0.2)", "rgba(0,109,44,0.2)"];
  var bdCols =
    type === "death" ? ["#CB1B1B", "#99000D"] : ["#41AB5D", "#006D2C"];
  function mid(s) {
    if (!s || s === "–") return null;
    if (s.startsWith(">")) return parseFloat(s.slice(1)) + 0.5;
    if (s.startsWith("<")) return parseFloat(s.slice(1)) - 0.5;
    var pts = s.split("-");
    if (pts.length === 2) return (parseFloat(pts[0]) + parseFloat(pts[1])) / 2;
    return null;
  }
  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["2012", "2022"],
      datasets: [
        {
          label: label,
          data: [mid(p[f12]), mid(p[f22])],
          backgroundColor: bgCols,
          borderColor: bdCols,
          borderWidth: 2,
          borderRadius: 6,
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
          text: `${p.Name_Geo || ""} — ${label}ის კოეფ. (‰)`,
          font: { family: "Fira Sans", size: 12, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: {
            label: (c) =>
              ` ${c.parsed.y} ‰  (${c.dataIndex === 0 ? p[f12] : p[f22]})`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: false,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: { font: { family: "Fira Sans", size: 10 }, color: "#6B6862" },
        },
        x: {
          ticks: {
            font: { family: "Fira Sans", size: 12, weight: "600" },
            color: "#1A1A18",
          },
          grid: { display: false },
        },
      },
    },
  });
}

document.getElementById("infoClose").addEventListener("click", function () {
  document.getElementById("infoCard").classList.add("hidden");
});

// ===== Bottom charts =====
function showBottomChart(p) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();
  var name = p.Name_Geo || p.Name_Eng || "ობიექტი";
  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["1989", "2002", "2014"],
      datasets: [
        {
          label: name,
          data: [p.Pop_1989 || 0, p.Pop_2002 || 0, p.Pop_2014 || 0],
          backgroundColor: [
            "rgba(200,16,46,0.15)",
            "rgba(74,144,217,0.15)",
            "rgba(232,130,26,0.15)",
          ],
          borderColor: ["#C8102E", "#4A90D9", "#E8821A"],
          borderWidth: 2,
          borderRadius: 6,
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
          text: `${name}  —  ${p.Type_Geo || ""}  |  ${p.Municipal_ || ""}`,
          font: { family: "Fira Sans", size: 12, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: { label: (c) => " " + c.parsed.y.toLocaleString("ka-GE") },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: {
            font: { family: "Fira Sans", size: 10 },
            color: "#6B6862",
            callback: (v) => v.toLocaleString(),
          },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 11 }, color: "#1A1A18" },
          grid: { display: false },
        },
      },
    },
  });
}

function showBottomChartEth(p) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();
  var keys = ["Georgian", "Azerbaijani", "Armenian", "Others"];
  bottomChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: keys.map((k) => ETH_LABELS[k]),
      datasets: [
        {
          data: keys.map((k) => p[k] || 0),
          backgroundColor: keys.map((k) => ETH_COLORS[k] + "bb"),
          borderColor: keys.map((k) => ETH_COLORS[k]),
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: {
            font: { family: "Fira Sans", size: 11 },
            color: "#1A1A18",
            padding: 10,
          },
        },
        title: {
          display: true,
          text: `${p.Name_Geo || ""} — ეროვნული შემადგენლობა 2014`,
          font: { family: "Fira Sans", size: 12, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.parsed}%` } },
      },
    },
  });
}

function showBottomChartRel(p) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();
  var keys = ["Orthodox", "Muslim", "Armenian_A", "Other_Reli"];
  bottomChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: keys.map((k) => REL_LABELS[k]),
      datasets: [
        {
          data: keys.map((k) => p[k] || 0),
          backgroundColor: keys.map((k) => REL_COLORS[k] + "bb"),
          borderColor: keys.map((k) => REL_COLORS[k]),
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: {
            font: { family: "Fira Sans", size: 11 },
            color: "#1A1A18",
            padding: 10,
          },
        },
        title: {
          display: true,
          text: `${p.Name_Geo || ""} — აღმსარებლობა 2014`,
          font: { family: "Fira Sans", size: 12, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.parsed}%` } },
      },
    },
  });
}

// ===== Census Modal =====
function enableCensusBtn() {
  var btn = document.getElementById("btnCensus");
  btn.disabled = false;
  btn.style.opacity = "1";
  btn.style.cursor = "pointer";
  btn.title = "";
}

function sumPop(features, field) {
  return features.reduce(function (s, f) {
    return s + (f.properties[field] || 0);
  }, 0);
}

function getCensusData() {
  if (!selectedProps) return null;
  if (censusScope === "selected")
    return {
      label: selectedProps.Name_Geo || selectedProps.Name_Eng,
      pop89: selectedProps.Pop_1989 || 0,
      pop02: selectedProps.Pop_2002 || 0,
      pop14: selectedProps.Pop_2014 || 0,
      rows: [selectedProps],
    };
  if (censusScope === "muni") {
    var muni = selectedProps.Municipal_;
    var mf = allFeatures.filter((f) => f.properties.Municipal_ === muni);
    return {
      label: selectedProps.Municipal_ || "მუნიციპ.",
      pop89: sumPop(mf, "Pop_1989"),
      pop02: sumPop(mf, "Pop_2002"),
      pop14: sumPop(mf, "Pop_2014"),
      rows: mf.map((f) => f.properties),
    };
  }
  return {
    label: "ქვემო ქართლი",
    pop89: sumPop(allFeatures, "Pop_1989"),
    pop02: sumPop(allFeatures, "Pop_2002"),
    pop14: sumPop(allFeatures, "Pop_2014"),
    rows: allFeatures.map((f) => f.properties),
  };
}

function renderCensusModal() {
  var data = getCensusData();
  if (!data) return;
  document.getElementById("censusSubtitle").textContent =
    data.label + " — 1989 · 2002 · 2014";
  var ctx = document.getElementById("censusCanvas").getContext("2d");
  if (censusChart) censusChart.destroy();
  var chg =
    data.pop89 > 0
      ? (((data.pop14 - data.pop89) / data.pop89) * 100).toFixed(1)
      : "–";
  censusChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["1989", "2002", "2014"],
      datasets: [
        {
          label: "მოსახლეობა",
          data: [data.pop89, data.pop02, data.pop14],
          backgroundColor: [
            "rgba(200,16,46,0.18)",
            "rgba(74,144,217,0.18)",
            "rgba(232,130,26,0.18)",
          ],
          borderColor: ["#C8102E", "#4A90D9", "#E8821A"],
          borderWidth: 2.5,
          borderRadius: 8,
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
          text: `${data.label}  |  1989→2014: ${chg}%`,
          font: { family: "Fira Sans", size: 12, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 8 },
        },
        tooltip: {
          callbacks: {
            label: (c) => " " + c.parsed.y.toLocaleString("ka-GE") + " კაცი",
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: {
            font: { family: "Fira Sans", size: 10 },
            color: "#6B6862",
            callback: (v) => v.toLocaleString(),
          },
        },
        x: {
          ticks: {
            font: { family: "Fira Sans", size: 12, weight: "600" },
            color: "#1A1A18",
          },
          grid: { display: false },
        },
      },
    },
  });
  function fmt(n) {
    return n ? parseInt(n).toLocaleString("ka-GE") : "–";
  }
  function chgCell(a, b) {
    if (!a || !b) return "<span>–</span>";
    var p = (((b - a) / a) * 100).toFixed(1);
    return `<span class="${p >= 0 ? "change-pos" : "change-neg"}">${p >= 0 ? "+" : ""}${p}%</span>`;
  }
  var rows = data.rows
    .filter((p) => p.Pop_2014 || p.Pop_1989)
    .sort((a, b) => (b.Pop_2014 || 0) - (a.Pop_2014 || 0))
    .slice(0, 8);
  document.getElementById("censusTable").innerHTML =
    `<div class="census-table-row census-table-head"><span>დასახლება</span><span>1989</span><span>2002</span><span>2014</span><span>ცვლ.</span></div>` +
    rows
      .map(
        (p) =>
          `<div class="census-table-row"><span>${p.Name_Geo || p.Name_Eng || "–"}</span><span>${fmt(p.Pop_1989)}</span><span>${fmt(p.Pop_2002)}</span><span>${fmt(p.Pop_2014)}</span>${chgCell(p.Pop_1989, p.Pop_2014)}</div>`,
      )
      .join("");
}

document.getElementById("btnCensus").addEventListener("click", function () {
  document.getElementById("censusOverlay").classList.add("active");
  document.getElementById("censusModal").classList.add("active");
  renderCensusModal();
});
function closeCensus() {
  document.getElementById("censusOverlay").classList.remove("active");
  document.getElementById("censusModal").classList.remove("active");
}
document.getElementById("censusClose").addEventListener("click", closeCensus);
document.getElementById("censusOverlay").addEventListener("click", closeCensus);



// ============================================================
// შედარება — census modal-ში ინტეგრირებული
// ============================================================
var _cmpMetric = "population";
var _cmpChart  = null;

var _COMPARE_DENSITY = null, _COMPARE_BIRTH = null, _COMPARE_DEATH = null;
var _POP_DATA = {
  "ბოლნისი":   {p1989:75800, p2002:73000, p2014:66200},
  "მარნეული":  {p1989:102000,p2002:101000,p2014:108700},
  "დმანისი":   {p1989:30600, p2002:18600, p2014:13900},
  "რუსთავი":   {p1989:159000,p2002:116400,p2014:122500},
  "წალკა":     {p1989:32600, p2002:15800, p2014:15100},
  "თეთრიწყარო":{p1989:24900, p2002:17600, p2014:16500},
  "გარდაბანი": {p1989:87900, p2002:96200, p2014:115600}
};
var MUNI_NAMES = ["ბოლნისი","მარნეული","დმანისი","რუსთავი","წალკა","თეთრიწყარო","გარდაბანი"];

function _midVal(s){
  if(!s) return 0;
  s=String(s).replace(/>|</g,"").trim();
  var d=s.indexOf("-");
  if(d>0){var a=parseFloat(s)||0,b=parseFloat(s.slice(d+1))||a;return(a+b)/2;}
  return parseFloat(s)||0;
}

function loadCmpData(cb){
  var done=0, need=(!_COMPARE_DENSITY?1:0)+(!_COMPARE_BIRTH?1:0)+(!_COMPARE_DEATH?1:0);
  if(need===0){cb();return;}
  function tick(){if(++done>=need)cb();}
  if(!_COMPARE_DENSITY){
    fetch("data/density.geojson").then(function(r){return r.json();}).then(function(d){
      _COMPARE_DENSITY={};
      d.features.forEach(function(f){var p=f.properties;_COMPARE_DENSITY[p.Name_Geo]={d1989:p.De_1989,d2002:p.De_2002,d2014:p.De_2014,d2024:p.De_2024};});
      tick();
    });
  }
  if(!_COMPARE_BIRTH){
    fetch("data/birth_rate.geojson").then(function(r){return r.json();}).then(function(d){
      _COMPARE_BIRTH={};
      d.features.forEach(function(f){var p=f.properties;_COMPARE_BIRTH[p.Name_Geo]={b2012:p.Birth_2012,b2022:p.Birth_2022};});
      tick();
    });
  }
  if(!_COMPARE_DEATH){
    fetch("data/death_rate.geojson").then(function(r){return r.json();}).then(function(d){
      _COMPARE_DEATH={};
      d.features.forEach(function(f){var p=f.properties;_COMPARE_DEATH[p.Name_Geo]={d2012:p.Death_2012,d2022:p.Death_2022};});
      tick();
    });
  }
}

function initCmpSelectors(){
  ["cmpA","cmpB"].forEach(function(id,idx){
    var sel=document.getElementById(id);
    if(!sel||sel.options.length>1) return;
    MUNI_NAMES.forEach(function(name){
      var opt=document.createElement("option");
      opt.value=name; opt.textContent=name; sel.appendChild(opt);
    });
    sel.value=idx===0?"ბოლნისი":"მარნეული";
  });
}

function renderCmpChart(){
  var nameA=document.getElementById("cmpA").value;
  var nameB=document.getElementById("cmpB").value;
  if(!nameA||!nameB) return;
  loadCmpData(function(){_doCmpChart(nameA,nameB);});
}

function _doCmpChart(nameA,nameB){
  var m=_cmpMetric, labels, dataA, dataB, ylabel;
  if(m==="population"){
    labels=["1989","2002","2014"]; ylabel="მოსახლ. (კაცი)";
    var pA=_POP_DATA[nameA]||{},pB=_POP_DATA[nameB]||{};
    dataA=[pA.p1989||0,pA.p2002||0,pA.p2014||0];
    dataB=[pB.p1989||0,pB.p2002||0,pB.p2014||0];
  } else if(m==="density"){
    labels=["1989","2002","2014","2024"]; ylabel="სიმჭ. (კაცი/კმ²)";
    var dA=(_COMPARE_DENSITY&&_COMPARE_DENSITY[nameA])||{};
    var dB=(_COMPARE_DENSITY&&_COMPARE_DENSITY[nameB])||{};
    dataA=[dA.d1989||0,dA.d2002||0,dA.d2014||0,dA.d2024||0];
    dataB=[dB.d1989||0,dB.d2002||0,dB.d2014||0,dB.d2024||0];
  } else if(m==="birth"){
    labels=["2012","2022"]; ylabel="შობ. კოეფ. (‰)";
    var bA=(_COMPARE_BIRTH&&_COMPARE_BIRTH[nameA])||{};
    var bB=(_COMPARE_BIRTH&&_COMPARE_BIRTH[nameB])||{};
    dataA=[_midVal(bA.b2012),_midVal(bA.b2022)];
    dataB=[_midVal(bB.b2012),_midVal(bB.b2022)];
  } else {
    labels=["2012","2022"]; ylabel="სიკვდ. კოეფ. (‰)";
    var deA=(_COMPARE_DEATH&&_COMPARE_DEATH[nameA])||{};
    var deB=(_COMPARE_DEATH&&_COMPARE_DEATH[nameB])||{};
    dataA=[_midVal(deA.d2012),_midVal(deA.d2022)];
    dataB=[_midVal(deB.d2012),_midVal(deB.d2022)];
  }
  var ctx=document.getElementById("cmpCanvas").getContext("2d");
  if(_cmpChart)_cmpChart.destroy();
  _cmpChart=new Chart(ctx,{type:"bar",
    data:{labels:labels,datasets:[
      {label:nameA,data:dataA,backgroundColor:"#3E8BBE99",borderColor:"#1A5F8A",borderWidth:1.5,borderRadius:4},
      {label:nameB,data:dataB,backgroundColor:"#E8621A99",borderColor:"#A83D08",borderWidth:1.5,borderRadius:4}
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:true,position:"top",labels:{font:{family:"Fira Sans",size:10},boxWidth:12}},
        title:{display:true,text:nameA+" vs "+nameB,font:{family:"Fira Sans",size:12,weight:"600"},color:"#1A1A18"}},
      scales:{y:{beginAtZero:true,ticks:{font:{family:"Fira Sans",size:9}},title:{display:true,text:ylabel,font:{size:9}}},
              x:{ticks:{font:{family:"Fira Sans",size:10},maxRotation:0},grid:{display:false}}}}});
}

// Wire compare panel inside census modal
document.querySelectorAll(".scope-btn").forEach(function(btn){
  btn.addEventListener("click",function(){
    document.querySelectorAll(".scope-btn").forEach(function(b){b.classList.remove("active");});
    this.classList.add("active");
    censusScope=this.dataset.scope;
    var isCompare=censusScope==="compare";
    document.getElementById("censusChartWrap").style.display=isCompare?"none":"block";
    document.getElementById("censusTable").style.display=isCompare?"none":"block";
    document.getElementById("censusComparePanel").style.display=isCompare?"block":"none";
    if(isCompare){initCmpSelectors();renderCmpChart();}
    else{renderCensusModal();}
  });
});

document.querySelectorAll(".cmp-metric-btn").forEach(function(btn){
  btn.addEventListener("click",function(){
    document.querySelectorAll(".cmp-metric-btn").forEach(function(b){b.classList.remove("active");});
    this.classList.add("active");
    _cmpMetric=this.dataset.metric;
    renderCmpChart();
  });
});

document.getElementById("cmpA").addEventListener("change",renderCmpChart);
document.getElementById("cmpB").addEventListener("change",renderCmpChart);
// ===== Agrovlimat layer =====
var agrovlimatLayer = null;
var agrovlimatData = null;
var natureMuniLayer = null; // მუნიც. ცენტრები ბუნების რუკებზე

var AGRO_ZONE_ORDER = [
  "dry_subtropical",
  "trans_subtropical",
  "warm_temperate",
  "mod_warm_temperate",
  "trans_cold_temperate",
  "mod_cold",
  "cold",
];

var AGRO_LABELS = {
  cold: "ცივი",
  mod_cold: "ზომიერად ცივი",
  trans_cold_temperate: "ზომიერადან ცივზე გარდამავალი",
  mod_warm_temperate: "ზომიერად თბილი",
  warm_temperate: "თბილი",
  trans_subtropical: "სუბტრ.→ზომიერ. გარდამავალი",
  dry_subtropical: "მშრალი სუბტროპიკული",
};

// მუნიციპალური ცენტრები ბუნების ფენებზე

// ============================================================
// მუნიციპალიტეტის საზღვრები — ყოველთვის ზემოთ (overlay)
// ============================================================
var muniBorderOverlay = null;

function addMuniBorderOverlay() {
  if (muniBorderOverlay) {
    muniBorderOverlay.bringToFront();
    return;
  }
  fetch("data/municipalities.geojson")
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      muniBorderOverlay = L.geoJSON(data, {
        interactive: false,
        style: {
          fill: false,
          color: "#9B8E7A",
          weight: 2,
          opacity: 0.9,
          dashArray: "4,3",
        },
      }).addTo(map);
      muniBorderOverlay.bringToFront();
    });
}

function removeMuniBorderOverlay() {
  if (muniBorderOverlay) {
    map.removeLayer(muniBorderOverlay);
    muniBorderOverlay = null;
  }
}

function loadNatureMuniCenters() {
  if (natureMuniLayer) return;
  fetch("data/municipalities_centroids.geojson")
    .then((r) => r.json())
    .then((data) => {
      natureMuniLayer = L.geoJSON(data, {
        pointToLayer: function (feature, latlng) {
          var name = feature.properties.Name_Geo || "";
          var marker = L.circleMarker(latlng, {
            radius: 5,
            fillColor: "#4A4035",
            color: "#fff",
            weight: 1.5,
            fillOpacity: 0.9,
          });
          marker.bindTooltip(name, {
            permanent: true,
            direction: "top",
            className: "muni-label",
            offset: [0, -8],
          });
          return marker;
        },
      }).addTo(map);
      addMuniBorderOverlay();
    });
}

function removeNatureMuniCenters() {
  if (natureMuniLayer) {
    map.removeLayer(natureMuniLayer);
    natureMuniLayer = null;
  }
  removeMuniBorderOverlay();
}

function buildAgrovlimatLayer(data) {
  if (agrovlimatLayer) map.removeLayer(agrovlimatLayer);
  agrovlimatLayer = L.geoJSON(data, {
    style: function (feat) {
      return {
        fillColor: feat.properties.ZoneColor,
        fillOpacity: 0.75,
        color: "#888",
        weight: 0.5,
        opacity: 0.8,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      var _tip = p.ZoneLabel || "";
      if (_tip)
        layer.bindTooltip(_tip, {
          direction: "center",
          className: "village-label",
          sticky: true,
        });
      layer.on("click", function () {
        showInfoAgro(p);
        showBottomChartAgro(p, data);
      });
      layer.on("mouseover", function () {
        layer.setStyle({ weight: 2, fillOpacity: 0.92 });
      });
      layer.on("mouseout", function () {
        agrovlimatLayer.resetStyle(layer);
      });
    },
  }).addTo(map);
  updateAgroLegend(data);
  setInfoBtn("agrovlimat");
}

function loadAgrovlimat() {
  if (agrovlimatData) {
    buildAgrovlimatLayer(agrovlimatData);
    loadNatureMuniCenters();
    return;
  }
  fetch("data/agrovlimat.geojson")
    .then((r) => r.json())
    .then((data) => {
      agrovlimatData = data;
      buildAgrovlimatLayer(data);
      loadNatureMuniCenters();
    });
}

// ============================================================
// რუკის ინფო სისტემა
// ============================================================
var MAP_INFO = {
  // მოსახლეობა
  population: {
    title: "მოსახლეობა",
    text: "",
    author: "გიორგი მელაძე",
    cartographer: "გვანცა წირღვავა",
    source: "საქსტატი, საქართველოს მოსახლეობის აღწერა, 1989, 2014",
    year: "2014",
  },
  ethnics: {
    title: "ეროვნება",
    text: "",
    author: "გიორგი მელაძე",
    cartographer: "გვანცა წირღვავა",
    source: "საქსტატი, საქართველოს მოსახლეობის აღწერა, 1989, 2014",
    year: "2014",
  },
  religion: {
    title: "აღმსარებლობა",
    text: "",
    author: "გიორგი მელაძე",
    cartographer: "გვანცა წირღვავა",
    source: "საქსტატი, საქართველოს მოსახლეობის აღწერა, 1989, 2014",
    year: "2014",
  },
  marital: {
    title: "ქორწინებითი მდგომარეობა",
    text: "მოსახლეობის 2014 წლის აღწერის მიხედვით, ქორწინებაში მყოფი მამაკაცების რაოდენობა 15 წლისა და უფროს ასაკში ყოველ ათას მამაკაცზე 686-ს შეადგენდა. ქვემო ქართლში ქორწინებაში მყოფი ქალების რაოდენობა 2002–2014 წლებში 610-დან 640-მდე გაიზარდა.",
    author: "გიორგი მელაძე",
    cartographer: "გვანცა წირღვავა",
    source: "საქსტატი, საქართველოს მოსახლეობის აღწერა, 1989, 2014",
    year: "2014",
  },
  death_rate: {
    title: "მოკვდავობა",
    text: "",
    author: "გიორგი მელაძე",
    cartographer: "გვანცა წირღვავა",
    source: "საქსტატი",
    year: "2014",
  },
  birth_rate: {
    title: "შობადობა",
    text: "",
    author: "გიორგი მელაძე",
    cartographer: "გვანცა წირღვავა",
    source: "საქსტატი",
    year: "2014",
  },
  density: {
    title: "სიმჭიდროვე",
    text: "",
    author: "გიორგი მელაძე",
    cartographer: "გვანცა წირღვავა",
    source: "საქსტატი",
    year: "2014",
  },
  idp: {
    title: "იძულებით გადაადგილებული პირები",
    text: "1980-იან წლებში სვანეთსა და მთიან აჭარაში ბუნებრივი კატასტროფების შედეგად უსახლკაროდ დარჩენილი ოჯახები ქვემო ქართლში ჩაასახლეს. 1991–1993 და 2008 წლების კონფლიქტები დევნილთა ახალი ნაკადები წარმოშვა.",
    source: "ადგილობრივი მუნიციპალიტეტებიდან გამოთხოვილი ინფორმაცია",
  },
  // ეკონომიკა
  botanica: {
    title: "ბოტანიკურ-აგრონომიული ზონები",
    text: 'ივანე ჯავახიშვილის „საქართველოს ბოტანიკურ-აგრონომიული არეების რუკა" (1930) წარმოაჩენს სამეურნეო კულტურას, რომელსაც ქართველი ერი უძველესი დროიდან ქმნიდა. რუკა ეფუძნება ვახუშტი ბაგრატიონის „აღწერა სამეფოსა საქართველოსა"-ს და სხვა ძველ წყაროებს. დაცულია ხელნაწერთა ეროვნულ ცენტრში.',
    source:
      "ივ. ჯავახიშვილი, საქართველოს ბოტანიკურ-აგრონომიული არეების რუკა, 1:2 100 000, 1930",
    year: "1930",
  },
  crop_zones: {
    title: "კულტურულ მცენარეთა ზონები",
    text: 'ნ. კეცხოველის „კულტურულ მცენარეთა ზონები საქართველოში" (1957) — საქართველოს ბოტანიკური სკოლის ერთ-ერთი ძირეული შრომა. ეხება საქართველოს მცენარეულ საფარს, გეობოტანიკურ დარაიონებასა და მცენარეთა დაცვის პრობლემებს.',
    author: "დალი ნიკოლაიშვილი",
    cartographer: "ანი შეროზია",
    source:
      "საქართველოს გეოგრაფიული ატლასი, 1964; ნ. კეცხოველი, საქართველოს სსრ აგრობოტანიკური რუკა, 1:600 000, 1957",
    year: "1957",
  },
  energetika: {
    title: "ელექტროენერგეტიკა",
    text: "",
    cartographer: "ნატო სოლოღაშვილი",
    source: "საქართველოს სახელმწიფო ელექტროსისტემა",
  },
  land: {
    title: "მიწის საკუთრება",
    text: "",
    source:
      "რეგიონული სტატისტიკა, საქსტატი; ი. ჩხაიძე და სხვ. სახელმწიფო ქონება (კვლევა), 2021",
    year: "2021",
  },
  sun: {
    title: "მზის ნათება",
    text: "ქვემო ქართლის ვაკეზე მზის ნათების წლიური ხანგრძლივობა 2500 საათს აჭარბებს — ყველაზე მაღალი საქართველოში. გარდაბნის მეტეოროლოგიური სადგურის მონაცემებით, ივლისში მზის ნათება 300 საათს აჭარბებს.",
    cartographer: "გვანცა წირღვავა",
    source: "საქართველოს ეროვნული ატლასი, 2012; მზის სახლი, ბიზნეს-პარტნიორი",
    year: "2012",
  },
  agri: {
    title: "სოფლის მეურნეობის ბენეფიციარები",
    text: "",
    author: "გიორგი ხომერიკი",
    cartographer: "სალომე ნიკოლეიშვილი",
    source: "რეგიონული სტატისტიკა, საქსტატი; სოფლის განვითარების სააგენტო",
  },
  agri_spec: {
    title: "სოფლის მეურნეობის სპეციალიზაცია",
    text: "ქვემო ქართლის ვაკესა და მთისწინეთში წამყვანი დარგია მემცენარეობა (ბოსტნეული, ბაღჩეული, მარცვლეული). მთის არეალებში ძირითადია სახორცე-სარძევე მიმართულების მეცხოველეობა. სოფლის მეურნეობა რეგიონის მშპ-ის 14.4%-ს შეადგენს.",
    cartographer: "სალომე ნიკოლეიშვილი",
    source: "საქსტატი, რეგიონული სტატისტიკა",
  },
  // ბუნება — კლიმატი
  agrovlimat: {
    title: "აგროკლიმატური დარაიონება",
    text: "სასოფლო-სამეურნეო კულტურების პროდუქტიულობას განსაზღვრავს აგროკლიმატური რესურსები — მზის რადიაცია, ჰაერისა და ნიადაგის ტემპერატურები, ატმოსფერული ნალექები, ქარები, წაყინვები.",
    author: "გივი გაგუა",
    source:
      "საქართველოს ეროვნული ატლასი, 2012; საქართველოს გეოგრაფიული ატლასი, 2018",
    year: "2018",
  },
  geology: {
    title: "გეოლოგიის რუკა",
    text: "",
    author: "რომან კუმლაძე",
    source:
      "გარემოს ეროვნული სააგენტო, 2016–2017; წიაღის ეროვნული სააგენტო, 2024",
    year: "2024",
  },
  landscape: {
    title: "ლანდშაფტები",
    text: "ქვემო ქართლის ბუნებრივი ლანდშაფტები ვაკეების ველის მცენარეულობიდან მაღალი მთის სუბალპურ და ალპურ მდელოებამდე ვრცელდება.",
    author: "დალი ნიკოლაიშვილი",
    cartographer: "ანი შეროზია",
    source: "საქართველოს გეოგრაფიული ატლასი, 2018",
    year: "2018",
  },
  hazard: {
    title: "მეწყერი, კლდეზვავი, ღვარცოფი",
    text: "საშიშროების კატეგორიების მიხედვით: მაღალი რისკი — 17, საშუალო — 80, დაბალი — 266 დასახლებული პუნქტი.",
    author: "გიორგი გაფრინდაშვილი, რომან კუმლაძე",
    source: "გარემოს ეროვნული სააგენტო, გეოლ. ბიულეტენი, 2025",
    year: "2025",
  },
  groundwater: {
    title: "მიწისქვეშა მტკნარი წყლები",
    text: 'ბუნებრივი რესურსი 26.65 მ³/წმ — საქართველოს მთლიანი რესურსის 5%. ცნობილია „დაშბაშის" (4000 ლ/წმ) და „ოზნის" (4977 ლ/წმ) წყაროები.',
    author: "ნანა ქიტიაშვილი",
    cartographer: "რომან კუმლაძე",
    source: "გარემოს ეროვნული სააგენტო",
    year: "2025",
  },
  earthquakes: {
    title: "მიწისძვრები",
    text: "სეისმური აქტიურობა გამოწვეულია არაბეთის ფილის ჩრდილოეთით მოძრაობით. დმანისში 3-4 მაგნ. მიწისძვრები პოსტვულკანურ აქტივობებად მიიჩნევა.",
    author: "ნატო სოლოღაშვილი",
    cartographer: "ნატო სოლოღაშვილი, ნიკოლოზ სუქნიძე",
    source: "კავკასიის მიწისძვრების კატალოგი, 2022",
    year: "2022",
  },
  forest: {
    title: "ტყეები",
    text: "წამყვანია ფოთლოვნეები: წიფელი, რცხილა, ჯაგრცხილა, მუხა. ალგეთისა და ხრამის აუზებში არიდული მეჩხერი ტყის ნაშთებია.",
    author: "ლერი ჭოჭუა",
    cartographer: "ანი შეროზია",
    source: "საქართველოს ეროვნული ატლასი, 2012",
    year: "2012",
  },
  vegetation: {
    title: "მცენარეული საფარი",
    text: "ვაკის სასოფლო-სამეურნეო ლანდშაფტებიდან მაღალი მთის სუბალპურ და ალპურ მდელოებამდე.",
    author: "ლერი ჭოჭუა",
    cartographer: "ანი შეროზია",
    source: "საქართველოს ეროვნული ატლასი, 2012",
    year: "2012",
  },
  soils: {
    title: "ნიადაგის ტიპები",
    text: "ნიადაგი ყალიბდება ლითოსფეროს ზედა ფენაში ქანების გამოფიტვის შედეგად.",
    cartographer: "თამარ ჭიჭინაძე",
    source: "საქართველოს ნიადაგების რუკა, 1:500 000, 2019",
    year: "2019",
  },
  soils_born: {
    title: "ნიადაგწარმომქმნელი ქანები",
    text: "pH გავლენას ახდენს მცენარეთა განვითარებაზე. ბუნებრივ პირობებში pH მერყეობს 3–3.5-დან 9–10-მდე.",
    cartographer: "თამარ ჭიჭინაძე",
    source: "საქართველოს ნიადაგების რუკა, 1:500 000, 2019",
    year: "2019",
  },
  avg_temp: {
    title: "საშუალო ტემპერატურა",
    text: "",
    author: "ნანა ბოლაშვილი",
    cartographer: "ნიკოლოზ სუქნიძე",
    source: "E-OBS data access months (copernicus.eu)",
    year: "2023",
  },
  max_temp: {
    title: "მაქსიმალური ტემპერატურა",
    text: "",
    author: "ნანა ბოლაშვილი",
    cartographer: "ნიკოლოზ სუქნიძე",
    source: "E-OBS data access months (copernicus.eu)",
    year: "2023",
  },
  precip: {
    title: "ნალექები",
    text: "",
    author: "ნანა ბოლაშვილი",
    cartographer: "ნიკოლოზ სუქნიძე",
    source: "E-OBS data access months (copernicus.eu)",
    year: "2023",
  },
  hot_days: {
    title: "ცხელი დღეები",
    text: "",
    author: "ნანა ბოლაშვილი",
    cartographer: "ნიკოლოზ სუქნიძე",
    source: "E-OBS data access months (copernicus.eu)",
    year: "2023",
  },
  trop_nights: {
    title: "ტროპიკული ღამეები",
    text: "",
    author: "ნანა ბოლაშვილი",
    cartographer: "ნიკოლოზ სუქნიძე",
    source: "E-OBS data access months (copernicus.eu)",
    year: "2023",
  },
  frost_days: {
    title: "ყინვიანი დღეები",
    text: "",
    author: "ნანა ბოლაშვილი",
    cartographer: "ნიკოლოზ სუქნიძე",
    source: "E-OBS data access months (copernicus.eu)",
    year: "2023",
  },
  heat_waves: {
    title: "სითბური ტალღები",
    text: "",
    author: "ნანა ბოლაშვილი",
    cartographer: "ნიკოლოზ სუქნიძე",
    source: "E-OBS data access months (copernicus.eu)",
    year: "2023",
  },
  drought: {
    title: "გვალვის ინდექსი",
    text: "",
    author: "ნანა ბოლაშვილი",
    cartographer: "ნიკოლოზ სუქნიძე",
    source: "E-OBS data access months (copernicus.eu)",
    year: "2023",
  },
  // ისტორია
  archaeology: {
    title: "არქეოლოგია",
    text: "არქეოლოგიური კვლევები კაცობრიობის ისტორიის შესწავლისთვის უდიდეს მნიშვნელობას ატარებს. ნივთიერი ძეგლების მოსაპოვებლად ტარდება გათხრები, განისაზღვრება მოპოვებული ნივთიერი ძეგლების ასაკი. არქეოლოგიურ ძეგლებს განეკუთვნება ყველაფერი, რასაც ადამიანის არსებობის კვალი ეტყობა.",
    author: "ქეთევან დიღმელაშვილი",
    cartographer: "გვანცა წირღვავა",
    source:
      "დ. ნარიმანიშვილი. სამხრეთ საქართველოს ყორღანები, 2024; ვ. ჯაფარიძე, 1982; გ. ჩიქოვანი და სხვ., 2015; ქართლის ცხოვრების ტოპოარქეოლოგიური ლექსიკონი, 2013",
    year: "2024",
  },
  battles: {
    title: "ბრძოლები",
    text: "",
    author: "მანანა ქურთუბაძე",
    cartographer: "მანანა ქურთუბაძე",
    source: "ქსე, ტ. 2, 3, 4, 6, 7, 8, 9, 10, 11",
  },
  germans: {
    title: "გერმანული დასახლებები",
    text: 'საქართველოში გერმანელების ჩამოსახლებიდან 200 წელი 2017 წელს აღინიშნა. გერმანელებმა უდიდესი წვლილი შეიტანეს მეცნიერების, ტექნიკისა და კულტურის განვითარებაში. 23 გერმანული დასახლების იდენტიფიცირება მოახდინა „სამხრეთ კავკასიაში გერმანული კულტურული მემკვიდრეობის დაცვის კავშირმა".',
    author: "გულიკო ლიპარტელიანი",
    cartographer: "მანანა ქურთუბაძე",
    source:
      "ნ. თათარაშვილი. გერმანული დასახლებები და არქიტექტურული მემკვიდრეობა საქართველოში, 2018",
    year: "2018",
  },
  fortifications: {
    title: "თავდაცვითი ნაგებობები",
    text: "ქვემო ქართლი თავდაცვითი ნაგებობების სიმრავლით გამოირჩევა. შემორჩენილია: მეგალითური ციხე, ციხექალაქი, ციხესიმაგრე, კოშკი, გამოქვაბული. ციხესიმაგრეები ერთიანი საფორტიფიკაციო ქსელის პრინციპით იგებოდა.",
    author: "დიმიტრი ნარიმანიშვილი",
    source:
      "პ. ზაქარაია, 2002; ხ. იოსელიანი, 2010; დ. ბერძენიშვილი, 2014; დ. ნარიმანიშვილი, 2019; კულტურული მემკვიდრეობის პორტალი",
    year: "2019",
  },
  eparchies: {
    title: "ეპარქიები",
    text: "ქვემო ქართლში საქართველოს მართლმადიდებელი ეკლესიის 7 ეპარქიაა. ეპარქიების საზღვრები ძირითადად ემთხვევა ადმინისტრაციულ-ტერიტორიული ერთეულების საზღვრებს.",
    author: "თამარ ცხაკაია, თამარ ჭიჭინაძე",
    cartographer: "თამარ ჭიჭინაძე",
    source: "საქართველოს ეკლესიის კალენდარი, 2024",
    year: "2024",
  },
  petroglyphs: {
    title: "პეტროგლიფები",
    text: "პეტროგლიფი — გამოქვაბულების კედლებზე, კლდეებზე შესრულებული უძველესი გამოსახულებებია. მიეკუთვნება სხვადასხვა ეპოქას — პალეოლითიდან შუა საუკუნეებამდე. ქვემო ქართლში ნაპოვნ პეტროგლიფებზე გამოსახულია: ცხენი, ირემი, ჯიხვი, აქლემი, ლომი და სხვ.",
    author: "დავით გოგუაძე",
    source:
      "საქართველოს პეტროგლიფების დიდი კატალოგი, 2013; დ. ნარიმანიშვილი, 2019; გ. სოფაძე, დ. გოგუაძე, 2022; ქსე, ტ. 5, 1980",
    year: "2022",
  },
  megaliths: {
    title: "მეგალითები",
    text: "მეგალითი — უზარმაზარი დაუმუშავებელი ქვის მონუმენტი, ძირითადად ენეოლითისა და ბრინჯაოს ხანით თარიღდება (ძვ.წ. III–II ათასწლ.). ქვემო ქართლში 62 მეგალითური ნაგებობიდან 27 წალკის მუნ-შია.",
    author: "დავით გოგუაძე, გია სოფაძე",
    source:
      "დ. ნარიმანიშვილი, 2019; კულტ. მემკვიდრეობის პორტალი; გ. სოფაძე, დ. გოგუაძე, 2022",
    year: "2022",
  },
  hail: {
    title: "სეტყვა",
    text: "სეტყვა ძირითადად მოდის წლის თბილ პერიოდში და დიდ ზიანს აყენებს სოფლის მეურნეობას. ტერიტორიული განაწილება დამოკიდებულია ოროგრაფიულ პირობებზე.",
    author: "ავთანდილ ამირანაშვილი",
    cartographer: "სოფიო ხორბალაძე",
    source:
      "Varazanashvili et al. 2023. The First Natural Hazard Event Database for the Republic of Georgia",
    year: "2023",
  },
  education: {
    title: "ზოგადი განათლება",
    text: "",
    author: "გულიკო ლიპარტელიანი",
    cartographer: "ანი შეროზია",
    source:
      "მუნ. რესურსცენტრები, 2023–2024; განათლების, მეცნ. და ახ. სამინისტრო",
    year: "2024",
  },
  kindergarten: {
    title: "სკოლამდელი აღზრდა",
    text: "2017/18: 104 დაწ., 14 058 აღს., 869 აღმზრ. 2022/23: 122 დაწ., 14 399 აღს., 1 241 აღმზრ.",
    author: "ნატო სოლოღაშვილი",
    source: "საქსტატი; საქ. პრეზ. №5366 ბრძ., 2016",
    year: "2023",
  },
  oikonymy: {
    title: "ოიკონიმია",
    text: "",
    author: "დალი ნიკოლაიშვილი",
    cartographer: "ანი შეროზია",
    source: "კ. ხარაძე, 1972, 2019; დ. ბერძენიშვილი, 2014",
    year: "2019",
  },
  health_infra: {
    title: "ჯანდაცვის ინფრასტრუქტურა",
    text: "რეგიონის ჯანდაცვა მუნ. ცენტრებში მრავალპროფ. კლინიკებს და სოფ. ამბულ. მოიცავს. მოქმედებს ჯანმრთ. ეროვ. სააგ-ს ქვემო ქართ. სამსახური.",
    author: "სოფიო ხორბალაძე",
    source: "მუნ. ჯანდაცვის სამსახურები",
  },
  social: {
    title: "სოციალური დახმარება",
    text: "2023: დარეგ. — 39 906, მიმღ. — 19 397 (49%). პენსია 2020: 83 814 (19%). სოც. პაკ. 2023: 15 697 (4%).",
    author: "ნატო სოლოღაშვილი",
    source: "საქსტატი",
    year: "2023",
  },
  zoo_anthrax: {
    title: "ჯილეხი",
    text: "ჯილეხი ზოონოზური მწვავე ინფ. დაავადებაა (Bacillus anthracis). სპორები წლობით ძლებს ნიადაგში. ყველაზე მაღალი გავრცელება ქვემო ქართლსა და კახეთშია.",
    author: "თამარ ჭიჭინაძე",
    source: "დაავ. კონტ. ეროვ. ცენტრი; საქ. ნიადაგ. რუკა, 2019",
    year: "2019",
  },
  zoo_other: {
    title: "ბრუცელოზი, ტულარემია, ენცეფალიტი, ლეპტოსპიროზი",
    text: "ბრუცელოზი — ინფ. ცხოვ. კონტ.; ტულარემია — ტკიპ./ბუზ. ნაკბ.; ენცეფ. — ტკიპა/კოღო; ლეპტოსპ. — მღრღნ.; ყირიმ-კონგო — Hyalomma ტკიპ.",
    author: "თამარ ჭიჭინაძე",
    source: "დაავ. კონტ. ცენტრი, 1950–2019; ზოონ. ინფ. ატლასი სამხ. კავკ.",
  },
};

var mapInfoVisible = false;
var mapInfoEl = null;

function showMapInfo(key) {
  var info = MAP_INFO[key];
  if (!info) return;
  if (!mapInfoEl) {
    mapInfoEl = document.createElement("div");
    mapInfoEl.id = "mapInfoPopup";
    document.body.appendChild(mapInfoEl);
  }
  var rows = "";
  if (info.author)
    rows +=
      '<div class="map-info-row"><span class="map-info-label">ავტორი:</span><span>' +
      info.author +
      "</span></div>";
  if (info.cartographer)
    rows +=
      '<div class="map-info-row"><span class="map-info-label">კარტოგ.:</span><span>' +
      info.cartographer +
      "</span></div>";
  if (info.source)
    rows +=
      '<div class="map-info-row"><span class="map-info-label">წყარო:</span><span>' +
      info.source +
      "</span></div>";
  if (info.year)
    rows +=
      '<div class="map-info-row"><span class="map-info-label">წელი:</span><span>' +
      info.year +
      "</span></div>";
  mapInfoEl.innerHTML =
    '<div class="map-info-header"><span class="map-info-title">' +
    info.title +
    "</span>" +
    '<button class="map-info-close" onclick="hideMapInfo()">&#x2715;</button></div>' +
    '<div class="map-info-body">' +
    (info.text ? '<p class="map-info-text">' + info.text + "</p>" : "") +
    (rows ? '<div class="map-info-meta">' + rows + "</div>" : "") +
    "</div>";
  mapInfoEl.classList.remove("hidden");
  mapInfoEl.classList.add("visible");
  mapInfoVisible = true;
}
function hideMapInfo() {
  if (mapInfoEl) {
    mapInfoEl.classList.remove("visible");
    mapInfoEl.classList.add("hidden");
  }
  mapInfoVisible = false;
}
function setInfoBtn(key) {
  hideMapInfo();
  var btn = document.getElementById("mapInfoBtn");
  if (!btn) return;
  if (key && MAP_INFO[key]) {
    btn.style.display = "flex";
    btn.onclick = function () {
      if (mapInfoVisible) {
        hideMapInfo();
      } else {
        showMapInfo(key);
      }
    };
  } else {
    btn.style.display = "none";
  }
}

function updateAgroLegend(data) {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var seen = {};
  data.features.forEach(function (f) {
    var p = f.properties;
    if (!seen[p.ZoneKey]) seen[p.ZoneKey] = p.ZoneColor;
  });
  var html = `<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">აგროკლიმატური რაიონები</div><div class="ethnics-legend">`;
  AGRO_ZONE_ORDER.forEach(function (key) {
    if (!seen[key]) return;
    html += `<div class="eth-legend-item"><span class="eth-dot" style="background:${seen[key]};border:1px solid rgba(0,0,0,0.2);border-radius:3px;"></span><span style="font-size:10px;">${AGRO_LABELS[key]}</span></div>`;
  });
  html += "</div>";
  el.innerHTML = html;
}

function showInfoAgro(p) {
  document.getElementById("infoCardContent").innerHTML = `
    <div class="info-name" style="font-size:13px;">${p.ZoneLabel}</div>
    <span class="info-type-badge badge-village" style="background:${p.ZoneColor}22;color:${p.ZoneColor};border:1px solid ${p.ZoneColor}55;">${p.Zone_Geo}</span>
    <div style="margin-top:10px;font-size:10px;color:var(--text-muted);line-height:1.6;">${p.Name_Geo}</div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartAgro(p, data) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

  // ჯამური ფართობი ზონების მიხედვით
  var areas = {},
    colors = {},
    labels = {};
  data.features.forEach(function (f) {
    var k = f.properties.ZoneKey;
    areas[k] = (areas[k] || 0) + (f.properties.Area_km2 || 0);
    colors[k] = f.properties.ZoneColor;
    labels[k] = f.properties.ZoneLabel || AGRO_LABELS[k];
  });

  // ფართობის მიხედვით დავალაგოთ კლებადობით
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
          data: sorted.map((k) => Math.round(areas[k])),
          backgroundColor: sorted.map((k) => colors[k] + "CC"),
          borderColor: sorted.map((k) => colors[k]),
          borderWidth: 2,
          borderRadius: 5,
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
          text: `აგროკლიმ. ზონები — ${p.ZoneLabel} (ფართობი კმ²)`,
          font: { family: "Fira Sans", size: 12, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: { label: (c) => ` ${c.parsed.y.toLocaleString()} კმ²` },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: {
            font: { family: "Fira Sans", size: 10 },
            color: "#6B6862",
            callback: function (v) {
              return v.toLocaleString() + " კმ²";
            },
          },
        },
        x: {
          ticks: {
            font: { family: "Fira Sans", size: 9 },
            color: "#1A1A18",
            maxRotation: 20,
          },
          grid: { display: false },
        },
      },
      animation: {
        onComplete: function () {
          var chart = this;
          var ctx2 = chart.ctx;
          ctx2.font = "bold 9px 'Fira Sans',sans-serif";
          ctx2.fillStyle = "#444";
          ctx2.textAlign = "center";
          ctx2.textBaseline = "bottom";
          chart.data.datasets.forEach(function (ds, i) {
            chart.getDatasetMeta(i).data.forEach(function (bar, idx) {
              var val = ds.data[idx];
              if (val > 0)
                ctx2.fillText(val.toLocaleString() + " კმ²", bar.x, bar.y - 3);
            });
          });
        },
      },
    },
  });
}

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
  if (layerRef.layer) map.removeLayer(layerRef.layer);
  var noBorder = layerRef.noBorder || false;
  layerRef.layer = L.geoJSON(data, {
    style: function (feat) {
      return {
        fillColor: feat.properties.LandColor,
        fillOpacity: 0.72,
        color: noBorder ? feat.properties.LandColor : "#888",
        weight: noBorder ? 0.5 : 0.5,
        opacity: noBorder ? 0 : 0.7,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      var _tip = p.LandLabel || "";
      if (_tip)
        layer.bindTooltip(_tip, {
          direction: "center",
          className: "village-label",
          sticky: true,
        });
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
  if (landscapeData) {
    buildLandscapeLayer(landscapeData, landscapeLayerRef);
    loadNatureMuniCenters();
    return;
  }
  fetch("data/landscape.geojson")
    .then((r) => r.json())
    .then((data) => {
      landscapeData = data;
      buildLandscapeLayer(data, landscapeLayerRef);
      loadNatureMuniCenters();
    });
}

function loadLandscapeAntrop() {
  if (landscapeAntropData) {
    buildLandscapeLayer(landscapeAntropData, landscapeAntropLayerRef);
    loadNatureMuniCenters();
    return;
  }
  fetch("data/landscape_antrop.geojson")
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

  var html = `<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">ლანდშაფტის ტიპი</div><div class="ethnics-legend">`;
  order.forEach(function (label) {
    if (!seen[label]) return;
    html += `<div class="eth-legend-item"><span class="eth-dot" style="background:${seen[label]};border:1px solid rgba(0,0,0,0.15);border-radius:3px;"></span><span style="font-size:10px;">${label}</span></div>`;
  });
  html += "</div>";
  el.innerHTML = html;
}

function showInfoLandscape(p) {
  document.getElementById("infoCardContent").innerHTML = `
    <div class="info-name" style="font-size:13px;">${p.LandLabel}</div>
    <span class="info-type-badge badge-village" style="background:${p.LandColor}33;color:#333;border:1px solid ${p.LandColor}88;">${p.Area_km2} კმ²</span>
    <div style="margin-top:10px;font-size:10px;color:var(--text-muted);line-height:1.6;">${p.Name_Geo || p.Name_Eng || "–"}</div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartLandscape(p, data, order) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

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
          data: sorted.map((k) => Math.round(areas[k])),
          backgroundColor: sorted.map((k) => colors[k] + "CC"),
          borderColor: sorted.map((k) => colors[k]),
          borderWidth: 2,
          borderRadius: 5,
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
          text: `${p.LandLabel} — ლანდშაფტები ფართობის მიხედვით (კმ²)`,
          font: { family: "Fira Sans", size: 12, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: { label: (c) => ` ${c.parsed.y.toLocaleString()} კმ²` },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: {
            font: { family: "Fira Sans", size: 10 },
            color: "#6B6862",
            callback: (v) => v.toLocaleString() + " კმ²",
          },
        },
        x: {
          ticks: {
            font: { family: "Fira Sans", size: 9 },
            color: "#1A1A18",
            maxRotation: 25,
          },
          grid: { display: false },
        },
      },
      animation: {
        onComplete: function () {
          var chart = this;
          var ctx2 = chart.ctx;
          ctx2.font = "bold 9px 'Fira Sans',sans-serif";
          ctx2.fillStyle = "#444";
          ctx2.textAlign = "center";
          ctx2.textBaseline = "bottom";
          chart.data.datasets.forEach(function (ds, i) {
            chart.getDatasetMeta(i).data.forEach(function (bar, idx) {
              var val = ds.data[idx];
              if (val > 0)
                ctx2.fillText(val.toLocaleString() + " კმ²", bar.x, bar.y - 3);
            });
          });
        },
      },
    },
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
    fetch("data/landslide_zoning.geojson")
      .then((r) => r.json())
      .then((d) => {
        hazardZoningData = d;
        tryRender();
      });
  else tryRender();
  if (!hazardLandslideData)
    fetch("data/landslide.geojson")
      .then((r) => r.json())
      .then((d) => {
        hazardLandslideData = d;
        tryRender();
      });
  else tryRender();
  if (!hazardRockfallData)
    fetch("data/rockfall.geojson")
      .then((r) => r.json())
      .then((d) => {
        hazardRockfallData = d;
        tryRender();
      });
  else tryRender();
}

function renderHazardLayers() {
  // ზონირება — polygon ფენა
  if (hazardZoningLayer) map.removeLayer(hazardZoningLayer);
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
        layer.bindTooltip(_tip, {
          direction: "center",
          className: "village-label",
          sticky: true,
        });
      layer.on("click", function () {
        showInfoHazardZone(p);
        showBottomChartHazard();
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
  if (hazardLandslideLayer) map.removeLayer(hazardLandslideLayer);
  hazardLandslideLayer = L.geoJSON(hazardLandslideData, {
    pointToLayer: function (feature, latlng) {
      var marker = L.circleMarker(latlng, {
        radius: 5,
        fillColor: "#C0392B",
        color: "#7B241C",
        weight: 1.2,
        fillOpacity: 0.85,
      });
      marker.bindTooltip(feature.properties.Name_Geo || "მეწყერი", {
        direction: "top",
        className: "village-label",
        offset: [0, -6],
      });
      marker.on("click", function () {
        showInfoHazardPoint(feature.properties, "landslide");
        showBottomChartHazard();
      });
      return marker;
    },
  }).addTo(map);

  // კლდეზვავი — ნარინჯი სამკუთხა სიმბოლო
  if (hazardRockfallLayer) map.removeLayer(hazardRockfallLayer);
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
      marker.bindTooltip(feature.properties.Name_Geo || "კლდეზვავი", {
        direction: "top",
        className: "village-label",
        offset: [0, -14],
      });
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
  var html = `<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">მეწყ./კლდეზვ. ზონები</div>
  <div class="ethnics-legend">`;
  HAZARD_ZONING_ORDER.forEach(function (label) {
    html += `<div class="eth-legend-item"><span class="eth-dot" style="background:${zoneColors[label]};border:1px solid rgba(0,0,0,0.15);border-radius:3px;"></span><span style="font-size:10px;">${label}</span></div>`;
  });
  html += `</div><div style="margin-top:10px;font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">სახეობა</div>
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
  document.getElementById("infoCardContent").innerHTML = `
    <div class="info-name">${p.Name_Geo || "–"}</div>
    <span class="info-type-badge badge-village" style="background:${p.ZoneColor}55;color:#444;border:1px solid ${p.ZoneColor};">${p.Name_Eng || ""}</span>
    <div class="info-row" style="margin-top:8px;"><span class="info-key">ფართობი</span><span class="info-val">${p.Area_km2} კმ²</span></div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showInfoHazardPoint(p, type) {
  var color = type === "landslide" ? "#C0392B" : "#E67E22";
  var label = type === "landslide" ? "მეწყერი" : "კლდეზვავი/დაქვათაცვენა";
  document.getElementById("infoCardContent").innerHTML = `
    <div class="info-name">${p.Name_Geo || p.Name_Eng || "–"}</div>
    <span class="info-type-badge" style="background:${color}22;color:${color};border:1px solid ${color}55;">${label}</span>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartHazard() {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

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
          data: sorted.map((k) => Math.round(areas[k])),
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
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "მეწყ./კლდეზვ. ზონირება — ფართობი (კმ²)",
          font: { family: "Fira Sans", size: 12, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: { label: (c) => ` ${c.parsed.y.toLocaleString()} კმ²` },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: {
            font: { family: "Fira Sans", size: 10 },
            color: "#6B6862",
            callback: (v) => v.toLocaleString() + " კმ²",
          },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 10 }, color: "#1A1A18" },
          grid: { display: false },
        },
      },
      animation: {
        onComplete: function () {
          var chart = this;
          var ctx2 = chart.ctx;
          ctx2.font = "bold 9px 'Fira Sans',sans-serif";
          ctx2.fillStyle = "#444";
          ctx2.textAlign = "center";
          ctx2.textBaseline = "bottom";
          chart.data.datasets.forEach(function (ds, i) {
            chart.getDatasetMeta(i).data.forEach(function (bar, idx) {
              var val = ds.data[idx];
              if (val > 0)
                ctx2.fillText(val.toLocaleString() + " კმ²", bar.x, bar.y - 3);
            });
          });
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
    fetch("data/hydrogeology_zoning.geojson")
      .then((r) => r.json())
      .then((d) => {
        groundwaterZoningData = d;
        tryRender();
      });
  else tryRender();
  if (!groundwaterPointData)
    fetch("data/groundwater.geojson")
      .then((r) => r.json())
      .then((d) => {
        groundwaterPointData = d;
        tryRender();
      });
  else tryRender();
}

function renderGroundwaterLayers() {
  // ზონირება — polygon
  if (groundwaterZoningLayer) map.removeLayer(groundwaterZoningLayer);
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
        layer.bindTooltip(_tip, {
          direction: "center",
          className: "village-label",
          sticky: true,
        });
      layer.on("click", function () {
        showInfoGWZone(p);
        showBottomChartGW();
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
  if (groundwaterPointLayer) map.removeLayer(groundwaterPointLayer);
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
      marker.bindTooltip(`${p.Number} ${p.Name_Geo}`, {
        direction: "top",
        className: "village-label",
        offset: [0, -iconH],
      });
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
  var html = `<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">ჰიდროგეოლ. დარაიონება</div><div class="ethnics-legend">`;
  var seen = {};
  groundwaterZoningData.features.forEach(function (f) {
    var p = f.properties;
    if (!seen[p.Code]) {
      seen[p.Code] = 1;
      html += `<div class="eth-legend-item"><span class="eth-dot" style="background:${p.ZoneColor};border:1px solid #5599AA88;border-radius:3px;"></span><span style="font-size:9px;">${p.ShortLabel}</span></div>`;
    }
  });
  html += `</div><div style="margin-top:10px;font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">წყალპუნქტები</div>
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
  document.getElementById("infoCardContent").innerHTML = `
    <div class="info-name" style="font-size:12px;">${p.ShortLabel}</div>
    <span class="info-type-badge badge-village" style="background:${p.ZoneColor};color:#333;border:1px solid #5599AA55;">${p.Code}</span>
    <div class="info-row" style="margin-top:8px;"><span class="info-key">ფართობი</span><span class="info-val">${p.Area_km2} კმ²</span></div>
    <div style="margin-top:8px;font-size:9px;color:var(--text-muted);line-height:1.5;">${p.Name_Geo}</div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showInfoGWPoint(p) {
  var isBH = p.Type_Geo === "ჭაბურღილი";
  var color = isBH ? "#1565C0" : "#0288D1";
  document.getElementById("infoCardContent").innerHTML = `
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
    <div class="info-row"><span class="info-key">Na+K</span><span class="info-val">${p.Na_K || 0}%</span></div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartGW() {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

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
          data: sorted.map((k) => Math.round(areas[k])),
          backgroundColor: sorted.map((k) => colors[k]),
          borderColor: sorted.map((k) => "#5599AA"),
          borderWidth: 1,
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
          text: "ჰიდროგეოლ. ზონირება — ფართობი (კმ²)",
          font: { family: "Fira Sans", size: 12, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: { label: (c) => ` ${c.parsed.y.toLocaleString()} კმ²` },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: {
            font: { family: "Fira Sans", size: 10 },
            color: "#6B6862",
            callback: (v) => v.toLocaleString() + " კმ²",
          },
        },
        x: {
          ticks: {
            font: { family: "Fira Sans", size: 8 },
            color: "#1A1A18",
            maxRotation: 25,
          },
          grid: { display: false },
        },
      },
      animation: {
        onComplete: function () {
          var chart = this;
          var ctx2 = chart.ctx;
          ctx2.font = "bold 9px 'Fira Sans',sans-serif";
          ctx2.fillStyle = "#444";
          ctx2.textAlign = "center";
          ctx2.textBaseline = "bottom";
          chart.data.datasets.forEach(function (ds, i) {
            chart.getDatasetMeta(i).data.forEach(function (bar, idx) {
              var val = ds.data[idx];
              if (val > 0)
                ctx2.fillText(val.toLocaleString() + " კმ²", bar.x, bar.y - 3);
            });
          });
        },
      },
    },
  });
}

function showBottomChartGWPoint(p) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

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
        legend: {
          position: "right",
          labels: {
            font: { family: "Fira Sans", size: 10 },
            color: "#1A1A18",
            padding: 8,
          },
        },
        title: {
          display: true,
          text: `${p.Number} ${p.Name_Geo} — ქიმიური შემადგენლობა (%) | M=${p.Mineral_M} გ/ლ`,
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
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
    fetch("data/earthquakes_new.geojson")
      .then((r) => r.json())
      .then((d) => {
        eqNewData = d;
        tryRender();
      });
  else tryRender();
  if (!eqOldData)
    fetch("data/earthquakes_old.geojson")
      .then((r) => r.json())
      .then((d) => {
        eqOldData = d;
        tryRender();
      });
  else tryRender();
  if (!eqStationData)
    fetch("data/seismic_stations.geojson")
      .then((r) => r.json())
      .then((d) => {
        eqStationData = d;
        tryRender();
      });
  else tryRender();
}

function renderEarthquakeLayers() {
  if (eqNewLayer) map.removeLayer(eqNewLayer);
  if (eqOldLayer) map.removeLayer(eqOldLayer);
  if (eqStationLayer) map.removeLayer(eqStationLayer);

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
      marker.bindTooltip(`Mw ${p.Mw} | ${p.Year}`, {
        direction: "top",
        className: "village-label",
      });
      marker.on("click", function () {
        showInfoEQ(p, "instrumental");
        showBottomChartEQ();
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
      marker.bindTooltip(`Mw ${p.Mw} | ${p.Year} (ისტ.)`, {
        direction: "top",
        className: "village-label",
        offset: [0, -size / 2],
      });
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
      marker.bindTooltip(p.Name_Geo, {
        direction: "top",
        className: "village-label",
        offset: [0, -18],
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
  var html = `<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">მაგნიტუდა (Mw)</div>
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
  <div style="margin-top:10px;font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">სეისმ. სადგურები</div>
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
  document.getElementById("infoCardContent").innerHTML = `
    <div class="info-name">Mw ${p.Mw}</div>
    <span class="info-type-badge badge-city" style="background:${p.Color}33;color:${darken(p.Color)};border:1px solid ${p.Color}88;">${p.MagClass}</span>
    <div class="info-row"><span class="info-key">წელი</span><span class="info-val">${p.Year}</span></div>
    <div class="info-row"><span class="info-key">პერიოდი</span><span class="info-val" style="font-size:10px;">${periodLabel}</span></div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartEQ() {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

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
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: `მიწისძვრები მაგნიტუდის მიხედვით — სულ ${eqNewData.features.length + eqOldData.features.length}`,
          font: { family: "Fira Sans", size: 12, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: { callbacks: { label: (c) => ` ${c.parsed.y} მიწისძვრა` } },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: { font: { family: "Fira Sans", size: 10 }, color: "#6B6862" },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 11 }, color: "#1A1A18" },
          grid: { display: false },
        },
      },
      animation: {
        onComplete: function () {
          var chart = this;
          var ctx2 = chart.ctx;
          ctx2.font = "bold 10px 'Fira Sans',sans-serif";
          ctx2.fillStyle = "#444";
          ctx2.textAlign = "center";
          ctx2.textBaseline = "bottom";
          chart.data.datasets.forEach(function (ds, i) {
            chart.getDatasetMeta(i).data.forEach(function (bar, idx) {
              var val = ds.data[idx];
              if (val > 0) ctx2.fillText(val, bar.x, bar.y - 3);
            });
          });
        },
      },
    },
  });
}

// Nature checkbox
document.getElementById("chkNature").addEventListener("change", function (e) {
  if (e.target.checked) {
    document.getElementById("chkHistory").checked = false;
    document.getElementById("chkEconomy").checked = false;
    document.getElementById("chkEducation").checked = false;
    document.getElementById("historyView").style.display = "none";
    document.getElementById("economyView").style.display = "none";
    document.getElementById("educationView").style.display = "none";
    removeAllHistoryLayers();
    removeAllEconomyLayers();
    removeAllEducationLayers();
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
      .querySelector("[data-naturesub='agrovlimat']")
      .classList.add("active");
    loadAgrovlimat();
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
  document.getElementById("chartEmpty").style.display = "flex";
  document.getElementById("chartCanvas").classList.add("hidden");
  document.getElementById("infoCard").classList.add("hidden");
  resetPopLegend();
  loadNeutralLayers();
});

// ===== Meteo & Hydro Stations =====
var meteoLayer = null;
var hydroLayer = null;
var meteoData = null;
var hydroData = null;

function removeAllNatureLayers() {
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
  if (forestLayer) {
    map.removeLayer(forestLayer);
    forestLayer = null;
  }
  if (vegetationLayer) {
    map.removeLayer(vegetationLayer);
    vegetationLayer = null;
  }
  if (_avgTempRef.layer) {
    map.removeLayer(_avgTempRef.layer);
    _avgTempRef.layer = null;
  }
  if (_maxTempRef.layer) {
    map.removeLayer(_maxTempRef.layer);
    _maxTempRef.layer = null;
  }
  if (_precipRef.layer) {
    map.removeLayer(_precipRef.layer);
    _precipRef.layer = null;
  }
  if (_hotRef.layer) {
    map.removeLayer(_hotRef.layer);
    _hotRef.layer = null;
  }
  if (_tropRef.layer) {
    map.removeLayer(_tropRef.layer);
    _tropRef.layer = null;
  }
  if (_frostRef.layer) {
    map.removeLayer(_frostRef.layer);
    _frostRef.layer = null;
  }
  if (heatWavesLayer) {
    map.removeLayer(heatWavesLayer);
    heatWavesLayer = null;
  }
  if (droughtLayer) {
    map.removeLayer(droughtLayer);
    droughtLayer = null;
  }
  if (hailTotalLayer) {
    map.removeLayer(hailTotalLayer);
    hailTotalLayer = null;
  }
  if (hail100Layer) {
    map.removeLayer(hail100Layer);
    hail100Layer = null;
  }
  if (soilsLayer) {
    map.removeLayer(soilsLayer);
    soilsLayer = null;
  }
  if (soilsBornLayer) {
    map.removeLayer(soilsBornLayer);
    soilsBornLayer = null;
  }
  if (geologyLayer) {
    map.removeLayer(geologyLayer);
    geologyLayer = null;
  }
  if (foultsLayer) {
    map.removeLayer(foultsLayer);
    foultsLayer = null;
  }
  if (metalOreLayer) {
    map.removeLayer(metalOreLayer);
    metalOreLayer = null;
  }
  if (nonmetalOreLayer) {
    map.removeLayer(nonmetalOreLayer);
    nonmetalOreLayer = null;
  }
  if (oilGasLayer) {
    map.removeLayer(oilGasLayer);
    oilGasLayer = null;
  }
  if (agrovlimatLayer) {
    map.removeLayer(agrovlimatLayer);
    agrovlimatLayer = null;
  }
  if (meteoLayer) {
    map.removeLayer(meteoLayer);
    meteoLayer = null;
  }
  if (hydroLayer) {
    map.removeLayer(hydroLayer);
    hydroLayer = null;
  }
  if (landscapeLayerRef.layer) {
    map.removeLayer(landscapeLayerRef.layer);
    landscapeLayerRef.layer = null;
  }
  if (landscapeAntropLayerRef.layer) {
    map.removeLayer(landscapeAntropLayerRef.layer);
    landscapeAntropLayerRef.layer = null;
  }
  if (hazardZoningLayer) {
    map.removeLayer(hazardZoningLayer);
    hazardZoningLayer = null;
  }
  if (hazardLandslideLayer) {
    map.removeLayer(hazardLandslideLayer);
    hazardLandslideLayer = null;
  }
  if (hazardRockfallLayer) {
    map.removeLayer(hazardRockfallLayer);
    hazardRockfallLayer = null;
  }
  if (groundwaterZoningLayer) {
    map.removeLayer(groundwaterZoningLayer);
    groundwaterZoningLayer = null;
  }
  if (groundwaterPointLayer) {
    map.removeLayer(groundwaterPointLayer);
    groundwaterPointLayer = null;
  }
  if (eqNewLayer) {
    map.removeLayer(eqNewLayer);
    eqNewLayer = null;
  }
  if (eqOldLayer) {
    map.removeLayer(eqOldLayer);
    eqOldLayer = null;
  }
  if (eqStationLayer) {
    map.removeLayer(eqStationLayer);
    eqStationLayer = null;
  }
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
  if (meteoLayer) map.removeLayer(meteoLayer);
  meteoLayer = L.geoJSON(data, {
    pointToLayer: function (feature, latlng) {
      var p = feature.properties;
      var marker = L.marker(latlng, { icon: meteoIcon(p.Active) });
      marker.on("click", function () {
        showInfoMeteo(p);
        showBottomChartStations("meteo");
      });
      marker.bindTooltip(p.Name_Geo || "", {
        direction: "top",
        className: "village-label",
        offset: [0, -8],
      });
      return marker;
    },
  }).addTo(map);
  updateStationLegend("meteo", data);
}

function buildHydroLayer(data) {
  if (hydroLayer) map.removeLayer(hydroLayer);
  hydroLayer = L.geoJSON(data, {
    pointToLayer: function (feature, latlng) {
      var p = feature.properties;
      var marker = L.marker(latlng, { icon: hydroIcon(p.Active) });
      marker.on("click", function () {
        showInfoHydro(p);
        showBottomChartStations("hydro");
      });
      marker.bindTooltip(p.Name_Geo || "", {
        direction: "top",
        className: "village-label",
        offset: [0, -12],
      });
      return marker;
    },
  }).addTo(map);
  updateStationLegend("hydro", data);
}

function loadMeteo() {
  if (meteoData) {
    buildMeteoLayer(meteoData);
    loadNatureMuniCenters();
    return;
  }
  fetch("data/meteo_stations.geojson")
    .then((r) => r.json())
    .then((data) => {
      meteoData = data;
      buildMeteoLayer(data);
      loadNatureMuniCenters();
    });
}

function loadHydro() {
  if (hydroData) {
    buildHydroLayer(hydroData);
    loadNatureMuniCenters();
    return;
  }
  fetch("data/hydro_stations.geojson")
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
  var html = `<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">${title}</div>
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

function showInfoMeteo(p) {
  var badge = p.Active
    ? `<span class="info-type-badge badge-village" style="background:#FEE8DC;color:#E8540A;border:1px solid #E8540A55;">მოქმედი</span>`
    : `<span class="info-type-badge badge-city" style="background:#f3f4f6;color:#999;border:1px solid #ccc;">დახურული</span>`;
  document.getElementById("infoCardContent").innerHTML = `
    <div class="info-name">${p.Name_Geo || p.Name_Eng || "–"}</div>
    ${badge}
    <div class="info-row"><span class="info-key">სადგ. ID</span><span class="info-val">${p.Station_ID || "–"}</span></div>
    <div class="info-row"><span class="info-key">ტიპი</span><span class="info-val">${p.Station_Ty || "–"}</span></div>
    <div class="info-row"><span class="info-key">სიმაღლე</span><span class="info-val">${p.Elevation != null ? p.Elevation + " მ" : "–"}</span></div>
    <div class="info-row"><span class="info-key">რაიონი</span><span class="info-val">${p.District || "–"}</span></div>
    <hr style="margin:8px 0;border-top:1px solid #f0ede8;">
    <div style="font-size:10px;color:var(--text-muted);line-height:1.5;">${p.Type_Geo || "–"}</div>
    <div class="info-row" style="margin-top:6px;"><span class="info-key">დაწყება</span><span class="info-val">${p.Begin_Obs || "–"}</span></div>
    ${p.End_Obs ? `<div class="info-row"><span class="info-key">დასასრული</span><span class="info-val">${p.End_Obs}</span></div>` : ""}
  `;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showInfoHydro(p) {
  var badge = p.Active
    ? `<span class="info-type-badge badge-village" style="background:#E3F0FC;color:#1565C0;border:1px solid #1565C055;">მოქმედი</span>`
    : `<span class="info-type-badge badge-city" style="background:#f3f4f6;color:#999;border:1px solid #ccc;">დახურული</span>`;
  document.getElementById("infoCardContent").innerHTML = `
    <div class="info-name">${p.Name_Geo || p.Name_Eng || "–"}</div>
    ${badge}
    <div class="info-row"><span class="info-key">მდინარე</span><span class="info-val">${p.River || "–"}</span></div>
    <div class="info-row"><span class="info-key">River (Eng)</span><span class="info-val">${p.River_Eng || "–"}</span></div>
    <hr style="margin:8px 0;border-top:1px solid #f0ede8;">
    <div class="info-row"><span class="info-key">გახსნა</span><span class="info-val">${p.Year_Open || "–"}</span></div>
    ${p.Year_Close ? `<div class="info-row"><span class="info-key">დახურვა</span><span class="info-val">${p.Year_Close}</span></div>` : ""}
    <div class="info-row"><span class="info-key">პერიოდი</span><span class="info-val" style="font-size:10px;">${p.Year_ || "–"}</span></div>
  `;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartStations(type) {
  var data = type === "meteo" ? meteoData : hydroData;
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

  var active = data.features.filter((f) => f.properties.Active);
  var inactive = data.features.filter((f) => !f.properties.Active);
  var actColor = type === "meteo" ? "#E8540A" : "#1565C0";
  var title = type === "meteo" ? "მეტეოსადგურები" : "ჰიდრ. სადგურები";

  bottomChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["მოქმედი", "დახურული"],
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
        legend: {
          position: "right",
          labels: {
            font: { family: "Fira Sans", size: 12 },
            color: "#1A1A18",
            padding: 12,
          },
        },
        title: {
          display: true,
          text: `${title} — სულ ${data.features.length}`,
          font: { family: "Fira Sans", size: 12, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.parsed}` } },
      },
    },
  });
}

// nature sublayer buttons
document.querySelectorAll("[data-naturesub]").forEach(function (btn) {
  btn.addEventListener("click", function () {
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
  });
});

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
      return {
        fillColor: feat.properties.Color,
        fillOpacity: 0.78,
        color: feat.properties.Color,
        weight: 0.2,
        opacity: 0.4,
      };
    },
    onEachFeature: function (feature, lyr) {
      var p = feature.properties;
      var _zoneName = p.Label || p.Name_Geo || "";
      if (_zoneName)
        lyr.bindTooltip(_zoneName, {
          direction: "center",
          className: "village-label",
          sticky: true,
        });
      lyr.on("mouseover", function () {
        lyr.setStyle({ weight: 1.2, fillOpacity: 0.95 });
      });
      lyr.on("mouseout", function () {
        lyr.setStyle({
          fillColor: p.Color,
          fillOpacity: 0.78,
          color: p.Color,
          weight: 0.2,
          opacity: 0.4,
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
  fetch("data/avg_temp.geojson")
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
  fetch("data/max_temp.geojson")
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
  fetch("data/precipitation.geojson")
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
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;">საშ. ტემპერატურა</div>' +
    '<span class="info-type-badge badge-village" style="background:' +
    p.Color +
    "55;color:#333;border:1px solid " +
    p.Color +
    ';">' +
    p.Label +
    " °C</span>" +
    '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);">მრავალწლიური საშუალო  |  1990–2022</div>';
  document.getElementById("infoCard").classList.remove("hidden");
  showBottomChartTemp(data, "avg");
}
function _showInfoMaxTemp(p, data) {
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;">მაქს. ტემპერატურა</div>' +
    '<span class="info-type-badge badge-village" style="background:' +
    p.Color +
    "55;color:#333;border:1px solid " +
    p.Color +
    ';">' +
    p.Label +
    " °C</span>" +
    '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);">მრავალწლიური მაქსიმუმი  |  1990–2022</div>';
  document.getElementById("infoCard").classList.remove("hidden");
  showBottomChartTemp(data, "max");
}
function _showInfoPrecip(p, data) {
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;">ატმ. ნალექები</div>' +
    '<span class="info-type-badge badge-village" style="background:' +
    p.Color +
    "55;color:#333;border:1px solid " +
    p.Color +
    ';">' +
    p.Label +
    " მმ</span>" +
    '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);">მრავალწლიური ჯამი  |  1990–2022</div>';
  document.getElementById("infoCard").classList.remove("hidden");
  showBottomChartTemp(data, "precip");
}

function showBottomChartTemp(data, type) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();
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
    var ring = f.geometry.coordinates[0];
    var a = 0;
    for (var i = 0; i < ring.length; i++) {
      var j = (i + 1) % ring.length;
      a +=
        ring[i][0] * 83000 * (ring[j][1] * 111000) -
        ring[j][0] * 83000 * (ring[i][1] * 111000);
    }
    areas[k] = (areas[k] || 0) + Math.abs(a) / 2 / 1e6;
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
            return Math.round(areas[k]);
          }),
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
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: titles[type],
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
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
            font: { family: "Fira Sans", size: 10 },
            callback: function (v) {
              return v.toLocaleString() + " კმ²";
            },
          },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 9 }, maxRotation: 35 },
          grid: { display: false },
        },
      },
    },
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
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">' +
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
      return {
        fillColor: feat.properties.Color,
        fillOpacity: 0.75,
        color: feat.properties.Color,
        weight: 0.2,
        opacity: 0.4,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      var _zoneName = p.Label || p.Name_Geo || "";
      if (_zoneName)
        layer.bindTooltip(_zoneName, {
          direction: "center",
          className: "village-label",
          sticky: true,
        });
      layer.on("mouseover", function () {
        layer.setStyle({ weight: 1.2, fillOpacity: 0.9 });
      });
      layer.on("mouseout", function () {
        layer.setStyle({
          fillColor: p.Color,
          fillOpacity: 0.75,
          color: p.Color,
          weight: 0.2,
          opacity: 0.4,
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
  fetch("data/hot_days.geojson")
    .then((r) => r.json())
    .then(function (d) {
      hotDaysData = d;
      _buildClimateLayer(d, _hotRef, _showInfoHotDays);
      updateClimateLegend("hot");
      loadNatureMuniCenters();
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
  fetch("data/tropical_nights.geojson")
    .then((r) => r.json())
    .then(function (d) {
      tropNightsData = d;
      _buildClimateLayer(d, _tropRef, _showInfoTropNights);
      updateClimateLegend("trop");
      loadNatureMuniCenters();
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
  fetch("data/frost_days.geojson")
    .then((r) => r.json())
    .then(function (d) {
      frostDaysData = d;
      _buildClimateLayer(d, _frostRef, _showInfoFrostDays);
      updateClimateLegend("frost");
      loadNatureMuniCenters();
    });
}

function _showInfoHotDays(p, data) {
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;">ცხელი დღეები</div>' +
    '<span class="info-type-badge badge-village" style="background:' +
    p.Color +
    "55;color:#333;border:1px solid " +
    p.Color +
    ';">' +
    p.Label +
    " დღე</span>" +
    '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);">დღის t° > 30°C  |  1990–2022</div>';
  document.getElementById("infoCard").classList.remove("hidden");
  showBottomChartClimate(data, "hot");
}

function _showInfoTropNights(p, data) {
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;">ტროპიკული ღამეები</div>' +
    '<span class="info-type-badge badge-village" style="background:' +
    p.Color +
    "55;color:#333;border:1px solid " +
    p.Color +
    ';">' +
    p.Label +
    " ღამე</span>" +
    '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);">ღამის t° > 20°C  |  1990–2022</div>';
  document.getElementById("infoCard").classList.remove("hidden");
  showBottomChartClimate(data, "trop");
}

function _showInfoFrostDays(p, data) {
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;">ყინვიანი დღეები</div>' +
    '<span class="info-type-badge badge-village" style="background:' +
    p.Color +
    "55;color:#333;border:1px solid " +
    p.Color +
    ';">' +
    p.Label +
    " დღე</span>" +
    '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);">t° < 0°C  |  1990–2022</div>';
  document.getElementById("infoCard").classList.remove("hidden");
  showBottomChartClimate(data, "frost");
}

function showBottomChartClimate(data, type) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();
  var titles = {
    hot: "ცხელი დღეების განაწილება (კმ²)",
    trop: "ტროპ. ღამეების განაწილება (კმ²)",
    frost: "ყინვიანი დღეების განაწილება (კმ²)",
  };
  var areas = {},
    colors = {};
  data.features.forEach(function (f) {
    var k = f.properties.Label;
    var ring = f.geometry.coordinates[0];
    var a = 0;
    for (var i = 0; i < ring.length; i++) {
      var j = (i + 1) % ring.length;
      a +=
        ring[i][0] * 83000 * (ring[j][1] * 111000) -
        ring[j][0] * 83000 * (ring[i][1] * 111000);
    }
    areas[k] = (areas[k] || 0) + Math.abs(a) / 2 / 1e6;
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
            return Math.round(areas[k]);
          }),
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
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: titles[type],
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
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
            font: { family: "Fira Sans", size: 10 },
            callback: function (v) {
              return v + " კმ²";
            },
          },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 9 }, maxRotation: 35 },
          grid: { display: false },
        },
      },
    },
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
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">' +
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
  fetch("data/heat_waves.geojson")
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
  fetch("data/drought_index.geojson")
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
      return {
        fillColor: feat.properties.Color,
        fillOpacity: 0.75,
        color: feat.properties.Color,
        weight: 0.3,
        opacity: 0.5,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      var _tip = p.Label || "";
      if (_tip)
        layer.bindTooltip(_tip, {
          direction: "center",
          className: "village-label",
          sticky: true,
        });
      layer.on("mouseover", function () {
        layer.setStyle({ weight: 1.5, fillOpacity: 0.9 });
      });
      layer.on("mouseout", function () {
        heatWavesLayer.resetStyle(layer);
      });
      layer.on("click", function () {
        document.getElementById("infoCardContent").innerHTML =
          '<div class="info-name" style="font-size:13px;">სითბური ტალღების ტენდენცია</div>' +
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
          "<b>პერიოდი:</b> 1990–2022</div>";
        document.getElementById("infoCard").classList.remove("hidden");
        showBottomChartHeatWaves(data);
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
      return {
        fillColor: feat.properties.Color,
        fillOpacity: 0.75,
        color: feat.properties.Color,
        weight: 0.3,
        opacity: 0.5,
      };
    },
    onEachFeature: function (feature, layer) {
      var p = feature.properties;
      var _tip = p.Category ? p.Category + " (" + p.Label + ")" : p.Label || "";
      if (_tip)
        layer.bindTooltip(_tip, {
          direction: "center",
          className: "village-label",
          sticky: true,
        });
      layer.on("mouseover", function () {
        layer.setStyle({ weight: 1.5, fillOpacity: 0.9 });
      });
      layer.on("mouseout", function () {
        droughtLayer.resetStyle(layer);
      });
      layer.on("click", function () {
        document.getElementById("infoCardContent").innerHTML =
          '<div class="info-name" style="font-size:13px;">გვალვის ინდექსი</div>' +
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
          "<b>პერიოდი:</b> 1990–2022</div>";
        document.getElementById("infoCard").classList.remove("hidden");
        showBottomChartDrought(data);
      });
    },
  }).addTo(map);
  updateDroughtLegend();
  setInfoBtn("drought");
}

function showBottomChartHeatWaves(data) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();
  var areas = {},
    colors = {};
  data.features.forEach(function (f) {
    var k = f.properties.Label;
    if (!areas[k]) areas[k] = 0;
    var ring = f.geometry.coordinates[0];
    var a = 0;
    for (var i = 0; i < ring.length; i++) {
      var j = (i + 1) % ring.length;
      a +=
        ring[i][0] * 83000 * (ring[j][1] * 111000) -
        ring[j][0] * 83000 * (ring[i][1] * 111000);
    }
    areas[k] += Math.abs(a) / 2 / 1e6;
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
            return Math.round(areas[k]);
          }),
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
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "სითბური ტალღების ტენდენცია — ფართობი (კმ²)",
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
          ticks: {
            callback: function (v) {
              return v + " კმ²";
            },
          },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 9 }, maxRotation: 35 },
          grid: { display: false },
        },
      },
    },
  });
}

function showBottomChartDrought(data) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();
  var areas = {},
    colors = {};
  data.features.forEach(function (f) {
    var k = f.properties.Category;
    if (!areas[k]) areas[k] = 0;
    var ring = f.geometry.coordinates[0];
    var a = 0;
    for (var i = 0; i < ring.length; i++) {
      var j = (i + 1) % ring.length;
      a +=
        ring[i][0] * 83000 * (ring[j][1] * 111000) -
        ring[j][0] * 83000 * (ring[i][1] * 111000);
    }
    areas[k] += Math.abs(a) / 2 / 1e6;
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
            return Math.round(areas[k]);
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
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "გვალვის ინდექსი — კატეგორიების ფართობი (კმ²)",
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
          ticks: {
            callback: function (v) {
              return v + " კმ²";
            },
          },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 10 }, color: "#1A1A18" },
          grid: { display: false },
        },
      },
    },
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
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">სიხშირის ტენდენცია (1990–2022)</div><div class="ethnics-legend">';
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
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">გვალვის კატეგორია (1990–2022)</div><div class="ethnics-legend">';
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
  if (madflowData) {
    renderMadflowLayers(madflowData);
    return;
  }
  fetch("data/madflow.geojson")
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
        layer.bindTooltip(_tip, {
          direction: "center",
          className: "village-label",
          sticky: true,
        });
      layer.on("click", function () {
        showInfoMadflowZone(p);
        showBottomChartMadflow(data);
      });
    },
  }).addTo(map);

  // MadFlow points — ლურჯი ნაკადის სიმბოლო
  madflowPointLayer = L.geoJSON(madflowFeats, {
    pointToLayer: function (feature, latlng) {
      var svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">' +
        '<path fill="#1565C0" stroke="#0D47A1" stroke-width="1" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>' +
        "</svg>";
      var icon = L.divIcon({
        html: svg,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        className: "",
      });
      var marker = L.marker(latlng, { icon: icon });
      marker.bindTooltip(feature.properties.Name_Geo || "ღვარცოფი", {
        direction: "top",
        className: "village-label",
        offset: [0, -10],
      });
      marker.on("click", function () {
        showInfoMadflowPoint(feature.properties, "madflow");
        showBottomChartMadflow(data);
      });
      return marker;
    },
  }).addTo(map);

  // Erosion points — ნარინჯი ტალღის სიმბოლო
  madflowErosionLayer = L.geoJSON(erosionFeats, {
    pointToLayer: function (feature, latlng) {
      var svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14">' +
        '<rect x="1" y="1" width="12" height="12" rx="2" fill="#E65100" stroke="#BF360C" stroke-width="1"/>' +
        '<line x1="3" y1="7" x2="11" y2="7" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>' +
        '<line x1="7" y1="3" x2="7" y2="11" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>' +
        "</svg>";
      var icon = L.divIcon({
        html: svg,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        className: "",
      });
      var marker = L.marker(latlng, { icon: icon });
      marker.bindTooltip(feature.properties.Name_Geo || "ეროზია", {
        direction: "top",
        className: "village-label",
        offset: [0, -10],
      });
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
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name">' +
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
    " კმ²</span></div>";
  document.getElementById("infoCard").classList.remove("hidden");
}

function showInfoMadflowPoint(p, type) {
  var color = type === "madflow" ? "#1565C0" : "#E65100";
  var label = type === "madflow" ? "ღვარცოფი" : "მდინარის ნაპირგარეცხვა";
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name">' +
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
    "</span>";
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartMadflow(data) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

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
            return Math.round(areas[k]);
          }),
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
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "ღვარცოფის საფრთხის ზონირება — ფართობი (კმ²)",
          font: { family: "Fira Sans", size: 12, weight: "600" },
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
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: {
            font: { family: "Fira Sans", size: 10 },
            color: "#6B6862",
            callback: function (v) {
              return v.toLocaleString() + " კმ²";
            },
          },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 10 }, color: "#1A1A18" },
          grid: { display: false },
        },
      },
      animation: {
        onComplete: function () {
          var chart = this;
          var ctx2 = chart.ctx;
          ctx2.font = "bold 9px 'Fira Sans',sans-serif";
          ctx2.fillStyle = "#444";
          ctx2.textAlign = "center";
          ctx2.textBaseline = "bottom";
          chart.data.datasets.forEach(function (ds, i) {
            chart.getDatasetMeta(i).data.forEach(function (bar, idx) {
              var val = ds.data[idx];
              if (val > 0)
                ctx2.fillText(val.toLocaleString() + " კმ²", bar.x, bar.y - 3);
            });
          });
        },
      },
    },
  });
}

function updateMadflowLegend(data) {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">ღვარცოფის საფრთხის ზონები</div>';
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
    '<div style="margin-top:10px;font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">სახეობა</div>';
  html +=
    '<div class="ethnics-legend">' +
    '<div class="eth-legend-item">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" style="flex-shrink:0;"><path fill="#1565C0" stroke="#0D47A1" stroke-width="1" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>' +
    '<span style="font-size:10px;">ღვარცოფი (' +
    madflowCount +
    ")</span></div>" +
    '<div class="eth-legend-item">' +
    '<svg width="14" height="14" viewBox="0 0 14 14" style="flex-shrink:0;"><rect x="1" y="1" width="12" height="12" rx="2" fill="#E65100" stroke="#BF360C" stroke-width="1"/><line x1="3" y1="7" x2="11" y2="7" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><line x1="7" y1="3" x2="7" y2="11" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>' +
    '<span style="font-size:10px;">ნაპირგარეცხვა (' +
    erosionCount +
    ")</span></div>" +
    "</div>";
  el.innerHTML = html;
}

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
  if (forestData) {
    buildForestLayer(forestData);
    loadNatureMuniCenters();
    return;
  }
  fetch("data/forest.geojson")
    .then((r) => r.json())
    .then((d) => {
      forestData = d;
      buildForestLayer(d);
      loadNatureMuniCenters();
    });
}

function loadVegetation() {
  if (vegetationData) {
    buildVegetationLayer(vegetationData);
    loadNatureMuniCenters();
    return;
  }
  fetch("data/vegetation.geojson")
    .then((r) => r.json())
    .then((d) => {
      vegetationData = d;
      buildVegetationLayer(d);
      loadNatureMuniCenters();
    });
}

function buildForestLayer(data) {
  if (forestLayer) map.removeLayer(forestLayer);
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
        layer.bindTooltip(_tip, {
          direction: "center",
          className: "village-label",
          sticky: true,
        });
      layer.on("mouseover", function () {
        layer.setStyle({ weight: 1.5, fillOpacity: 0.92 });
      });
      layer.on("mouseout", function () {
        forestLayer.resetStyle(layer);
      });
      layer.on("click", function () {
        document.getElementById("infoCardContent").innerHTML =
          '<div class="info-name" style="font-size:13px;">' +
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
          " კმ²</div>";
        document.getElementById("infoCard").classList.remove("hidden");
        showBottomChartForest(data);
      });
    },
  }).addTo(map);
  updateForestLegend();
  setInfoBtn("forest");
}

function buildVegetationLayer(data) {
  if (vegetationLayer) map.removeLayer(vegetationLayer);
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
        layer.bindTooltip(_tip, {
          direction: "center",
          className: "village-label",
          sticky: true,
        });
      layer.on("mouseover", function () {
        layer.setStyle({ weight: 1.5, fillOpacity: 0.92 });
      });
      layer.on("mouseout", function () {
        vegetationLayer.resetStyle(layer);
      });
      layer.on("click", function () {
        document.getElementById("infoCardContent").innerHTML =
          '<div class="info-name" style="font-size:13px;">' +
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
          " კმ²</div>";
        document.getElementById("infoCard").classList.remove("hidden");
        showBottomChartVegetation(data);
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
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();
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
            return Math.round(d.areas[k]);
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
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "ტყეები — ფართობის განაწილება სახეობების მიხედვით (კმ²)",
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
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: {
            font: { family: "Fira Sans", size: 10 },
            color: "#6B6862",
            callback: function (v) {
              return v + " კმ²";
            },
          },
        },
        x: {
          ticks: {
            font: { family: "Fira Sans", size: 9 },
            color: "#1A1A18",
            maxRotation: 35,
          },
          grid: { display: false },
        },
      },
      animation: {
        onComplete: function () {
          var chart = this;
          var ctx2 = chart.ctx;
          ctx2.font = "bold 9px 'Fira Sans',sans-serif";
          ctx2.fillStyle = "#444";
          ctx2.textAlign = "center";
          ctx2.textBaseline = "bottom";
          chart.data.datasets.forEach(function (ds, i) {
            chart.getDatasetMeta(i).data.forEach(function (bar, idx) {
              var val = ds.data[idx];
              if (val > 0)
                ctx2.fillText(val.toLocaleString() + " კმ²", bar.x, bar.y - 2);
            });
          });
        },
      },
    },
  });
}

function showBottomChartVegetation(data) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();
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
            return Math.round(d.areas[k]);
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
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "მცენარეული საფარი — ფართობის განაწილება (კმ²)",
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
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: {
            font: { family: "Fira Sans", size: 10 },
            color: "#6B6862",
            callback: function (v) {
              return v + " კმ²";
            },
          },
        },
        x: {
          ticks: {
            font: { family: "Fira Sans", size: 8 },
            color: "#1A1A18",
            maxRotation: 40,
          },
          grid: { display: false },
        },
      },
      animation: {
        onComplete: function () {
          var chart = this;
          var ctx2 = chart.ctx;
          ctx2.font = "bold 8px 'Fira Sans',sans-serif";
          ctx2.fillStyle = "#444";
          ctx2.textAlign = "center";
          ctx2.textBaseline = "bottom";
          chart.data.datasets.forEach(function (ds, i) {
            chart.getDatasetMeta(i).data.forEach(function (bar, idx) {
              var val = ds.data[idx];
              if (val > 0)
                ctx2.fillText(val.toLocaleString() + " კმ²", bar.x, bar.y - 2);
            });
          });
        },
      },
    },
  });
}

function updateForestLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">ძირითადი მერქნიანი სახეობები</div>';
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
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">მცენარეული საფარი</div>';
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
  document.getElementById("infoCardContent").innerHTML = `
    <div class="info-name" style="font-size:13px;">${p.Name_Geo || ""}</div>
    <span class="info-type-badge badge-village" style="background:${p.Color}33;color:#555;border:1px solid ${p.Color}88;">${p.Name_Eng || ""}</span>
    <div style="margin-top:8px;font-size:10px;color:var(--text-muted);line-height:1.7;">
      <b>FAO:</b> ${p.Soil_Name || "-"}<br>
      <b>pH:</b> ${p.soil_pH || "-"} &nbsp;|&nbsp; <b>ტექსტურა:</b> ${p.Soil_textu || "-"}<br>
      <b>ფართობი:</b> ${p.Area_km2 ? p.Area_km2.toLocaleString() + " კმ²" : "-"}
    </div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartSoils(data) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

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
          data: sorted.map((k) => Math.round(areas[k])),
          backgroundColor: sorted.map((k) => colors[k] + "CC"),
          borderColor: sorted.map((k) => colors[k]),
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
          text: "ნიადაგის ტიპები — ფართობის განაწილება (კმ²)",
          font: { family: "Fira Sans", size: 12, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: { label: (c) => ` ${c.parsed.y.toLocaleString()} კმ²` },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: {
            font: { family: "Fira Sans", size: 10 },
            color: "#6B6862",
            callback: (v) => v.toLocaleString() + " კმ²",
          },
        },
        x: {
          ticks: {
            font: { family: "Fira Sans", size: 9 },
            color: "#1A1A18",
            maxRotation: 35,
          },
          grid: { display: false },
        },
      },
      animation: {
        onComplete: function () {
          var chart = this;
          var ctx2 = chart.ctx;
          ctx2.font = "bold 9px 'Fira Sans',sans-serif";
          ctx2.fillStyle = "#444";
          ctx2.textAlign = "center";
          ctx2.textBaseline = "bottom";
          chart.data.datasets.forEach(function (ds, i) {
            chart.getDatasetMeta(i).data.forEach(function (bar, idx) {
              var val = ds.data[idx];
              if (val > 0)
                ctx2.fillText(val.toLocaleString() + " კმ²", bar.x, bar.y - 3);
            });
          });
        },
      },
    },
  });
}

// ===== Info + Chart functions for Soils Born =====
function showInfoSoilsBorn(p) {
  document.getElementById("infoCardContent").innerHTML = `
    <div class="info-name" style="font-size:13px;">ტიპი ${p.Soil_Geo || ""}</div>
    <span class="info-type-badge badge-village" style="background:${p.Color}33;color:#555;border:1px solid ${p.Color}88;">${p.Name_Eng ? p.Name_Eng.split("(")[0].trim() : ""}</span>
    <div style="margin-top:8px;font-size:10px;color:var(--text-muted);line-height:1.6;">${p.Name_Geo || "-"}<br>
      <b>ფართობი:</b> ${p.Area_km2 ? p.Area_km2.toLocaleString() + " კმ²" : "-"}
    </div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartSoilsBorn(data) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

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
          data: sorted.map((k) => Math.round(areas[k])),
          backgroundColor: sorted.map((k) => colors[k] + "CC"),
          borderColor: sorted.map((k) => colors[k]),
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
          text: "ნიადაგ-წარმ. ქანები — ფართობის განაწილება (კმ²)",
          font: { family: "Fira Sans", size: 12, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: { label: (c) => ` ${c.parsed.y.toLocaleString()} კმ²` },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: {
            font: { family: "Fira Sans", size: 10 },
            color: "#6B6862",
            callback: (v) => v.toLocaleString() + " კმ²",
          },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 10 }, color: "#1A1A18" },
          grid: { display: false },
        },
      },
      animation: {
        onComplete: function () {
          var chart = this;
          var ctx2 = chart.ctx;
          ctx2.font = "bold 9px 'Fira Sans',sans-serif";
          ctx2.fillStyle = "#444";
          ctx2.textAlign = "center";
          ctx2.textBaseline = "bottom";
          chart.data.datasets.forEach(function (ds, i) {
            chart.getDatasetMeta(i).data.forEach(function (bar, idx) {
              var val = ds.data[idx];
              if (val > 0)
                ctx2.fillText(val.toLocaleString() + " კმ²", bar.x, bar.y - 3);
            });
          });
        },
      },
    },
  });
}

// ===== Info + Chart functions for Geology =====
function showInfoGeology(p) {
  document.getElementById("infoCardContent").innerHTML = `
    <div class="info-name" style="font-size:15px;font-weight:700;">${p.Index || ""}</div>
    <span class="info-type-badge badge-village" style="background:${p.Color}33;color:#555;border:1px solid ${p.Color}88;">გეოლ. ასაკი</span>
    <div style="margin-top:8px;font-size:10px;color:var(--text-muted);line-height:1.6;">
      ${p.Name_Geo || "-"}<br>
      <i>${p.Name_Eng || ""}</i><br>
      <b>ფართობი:</b> ${p.Area_km2 ? p.Area_km2.toLocaleString() + " კმ²" : "-"}
    </div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartGeology(data) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

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
          data: sorted.map((k) => Math.round(areas[k])),
          backgroundColor: sorted.map((k) => colors[k] + "CC"),
          borderColor: sorted.map((k) => colors[k]),
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
          text: "გეოლოგიური ფენები — ფართობის განაწილება (კმ²)",
          font: { family: "Fira Sans", size: 12, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: { label: (c) => ` ${c.parsed.y.toLocaleString()} კმ²` },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: {
            font: { family: "Fira Sans", size: 10 },
            color: "#6B6862",
            callback: (v) => v.toLocaleString() + " კმ²",
          },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 10 }, color: "#1A1A18" },
          grid: { display: false },
        },
      },
      animation: {
        onComplete: function () {
          var chart = this;
          var ctx2 = chart.ctx;
          ctx2.font = "bold 9px 'Fira Sans',sans-serif";
          ctx2.fillStyle = "#444";
          ctx2.textAlign = "center";
          ctx2.textBaseline = "bottom";
          chart.data.datasets.forEach(function (ds, i) {
            chart.getDatasetMeta(i).data.forEach(function (bar, idx) {
              var val = ds.data[idx];
              if (val > 0)
                ctx2.fillText(val.toLocaleString() + " კმ²", bar.x, bar.y - 3);
            });
          });
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

var HAIL_TOTAL_CLASSES = [
  { cls: "≤ 1", r: 7, color: "#4FC3F7" },
  { cls: "1–2", r: 10, color: "#0288D1" },
  { cls: "2–3", r: 13, color: "#01579B" },
  { cls: "3–4", r: 16, color: "#1A237E" },
  { cls: "4–5", r: 19, color: "#311B92" },
  { cls: "5–7", r: 22, color: "#4A148C" },
  { cls: "> 7", r: 26, color: "#880E4F" },
];
var HAIL_100_CLASSES = [
  { cls: "≤ 1", r: 7, color: "#EF9A9A" },
  { cls: "1–2", r: 10, color: "#E53935" },
  { cls: "2–3", r: 13, color: "#B71C1C" },
  { cls: "3–4", r: 16, color: "#7B1FA2" },
  { cls: "> 4", r: 20, color: "#4A148C" },
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
  var loaded = 0;
  var needed = (!hailTotalData ? 1 : 0) + (!hail100Data ? 1 : 0);
  if (needed === 0) {
    cb();
    return;
  }
  function tryDraw() {
    if (++loaded === needed) cb();
  }
  if (!hailTotalData)
    fetch("data/hail_total.geojson")
      .then((r) => r.json())
      .then((d) => {
        hailTotalData = d;
        tryDraw();
      });
  if (!hail100Data)
    fetch("data/hail_100.geojson")
      .then((r) => r.json())
      .then((d) => {
        hail100Data = d;
        tryDraw();
      });
}

function _drawHailLayer(type) {
  // ორივე ფენა გამოვრთოთ
  if (hailTotalLayer) {
    map.removeLayer(hailTotalLayer);
    hailTotalLayer = null;
  }
  if (hail100Layer) {
    map.removeLayer(hail100Layer);
    hail100Layer = null;
  }

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
      marker.bindTooltip(p.Name_Geo + "<br><b>" + val + " კმ²</b>", {
        direction: "top",
        className: "village-label",
        offset: [0, -cls.r],
      });
      marker.on("click", function () {
        showInfoHail(p, type);
        showBottomChartHail(data, type);
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
  document.getElementById("infoCardContent").innerHTML = `
    <div class="info-name" style="font-size:13px;">${p.Name_Geo || ""}</div>
    <span class="info-type-badge badge-village" style="background:${cls.color}33;color:${cls.color};border:1px solid ${cls.color}88;">${cls.cls} კმ²</span>
    <div style="margin-top:8px;font-size:10px;color:var(--text-muted);line-height:1.7;">
      <b>${label}:</b> ${val} კმ²<br>
      <b>საერთო:</b> ${p.Total_km2} კმ² &nbsp;|&nbsp; <b>100%:</b> ${p.P100_km2} კმ²
    </div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartHail(data, type) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

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
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: titleTxt,
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: { callbacks: { label: (c) => ` ${c.parsed.y} კმ²` } },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: {
            font: { family: "Fira Sans", size: 10 },
            color: "#6B6862",
            callback: (v) => v + " კმ²",
          },
        },
        x: {
          ticks: {
            font: { family: "Fira Sans", size: 8 },
            color: "#1A1A18",
            maxRotation: 40,
          },
          grid: { display: false },
        },
      },
      animation: {
        onComplete: function () {
          var chart = this;
          var ctx2 = chart.ctx;
          ctx2.font = "bold 8px 'Fira Sans',sans-serif";
          ctx2.fillStyle = "#444";
          ctx2.textAlign = "center";
          ctx2.textBaseline = "bottom";
          chart.data.datasets.forEach(function (ds, i) {
            chart.getDatasetMeta(i).data.forEach(function (bar, idx) {
              var val = ds.data[idx];
              if (val > 0) ctx2.fillText(val + " კმ²", bar.x, bar.y - 2);
            });
          });
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
    <div style="font-size:9px;font-weight:700;color:var(--text-muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;">სეტყვა</div>
    <div style="display:flex;gap:6px;">
      <button class="year-btn ${type === "total" ? "active" : ""}" data-hailtype="total">საერთო</button>
      <button class="year-btn ${type === "100" ? "active" : ""}" data-hailtype="100">100%</button>
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
  if (soilsData) {
    buildSoilsLayer(soilsData);
    loadNatureMuniCenters();
    return;
  }
  fetch("data/soils.geojson")
    .then((r) => r.json())
    .then((d) => {
      soilsData = d;
      buildSoilsLayer(d);
      loadNatureMuniCenters();
    });
}

function loadSoilsBorn() {
  if (soilsBornData) {
    buildSoilsBornLayer(soilsBornData);
    loadNatureMuniCenters();
    return;
  }
  fetch("data/soils_born.geojson")
    .then((r) => r.json())
    .then((d) => {
      soilsBornData = d;
      buildSoilsBornLayer(d);
      loadNatureMuniCenters();
    });
}

function buildSoilsLayer(data) {
  if (soilsLayer) map.removeLayer(soilsLayer);
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
        layer.bindTooltip(_tip, {
          direction: "center",
          className: "village-label",
          sticky: true,
        });
      layer.on("click", function () {
        showInfoSoils(p);
        showBottomChartSoils(data);
      });
    },
  }).addTo(map);
  updateSoilsLegend();
  setInfoBtn("soils");
}

function buildSoilsBornLayer(data) {
  if (soilsBornLayer) map.removeLayer(soilsBornLayer);
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
        layer.bindTooltip(_tip, {
          direction: "center",
          className: "village-label",
          sticky: true,
        });
      layer.on("click", function () {
        showInfoSoilsBorn(p);
        showBottomChartSoilsBorn(data);
      });
    },
  }).addTo(map);
  updateSoilsBornLegend();
  setInfoBtn("soils_born");
}

function updateSoilsLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">ნიადაგის ტიპები</div>';
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
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">ნიადაგ-წარმომქმნელი ქანები</div>';
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
  var loaded = 0;
  function tryRender() {
    if (++loaded === 5) renderGeologyLayers();
  }
  if (!geologyData)
    fetch("data/geology.geojson")
      .then((r) => r.json())
      .then((d) => {
        geologyData = d;
        tryRender();
      });
  else tryRender();
  if (!foultsData)
    fetch("data/foults.geojson")
      .then((r) => r.json())
      .then((d) => {
        foultsData = d;
        tryRender();
      });
  else tryRender();
  if (!metalOreData)
    fetch("data/metal_ore.geojson")
      .then((r) => r.json())
      .then((d) => {
        metalOreData = d;
        tryRender();
      });
  else tryRender();
  if (!nonmetalOreData)
    fetch("data/nonmetal_ore.geojson")
      .then((r) => r.json())
      .then((d) => {
        nonmetalOreData = d;
        tryRender();
      });
  else tryRender();
  if (!oilGasData)
    fetch("data/oil_gas.geojson")
      .then((r) => r.json())
      .then((d) => {
        oilGasData = d;
        tryRender();
      });
  else tryRender();
}

function renderGeologyLayers() {
  // ---- 1. გეოლოგიური პოლიგონები ----
  if (geologyLayer) map.removeLayer(geologyLayer);
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
        layer.bindTooltip(_tip, {
          direction: "center",
          className: "village-label",
          sticky: true,
        });
      layer.on("click", function () {
        showInfoGeology(p);
        showBottomChartGeology(geologyData);
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
  if (foultsLayer) map.removeLayer(foultsLayer);
  foultsLayer = L.geoJSON(foultsData, {
    style: function () {
      return { color: "#CC0000", weight: 2, opacity: 0.8, dashArray: "6,3" };
    },
  }).addTo(map);

  // ---- 3. ლითონური წიაღისეული ----
  if (metalOreLayer) map.removeLayer(metalOreLayer);
  metalOreLayer = L.geoJSON(metalOreData, {
    pointToLayer: function (feat, latlng) {
      var p = feat.properties;
      var marker = L.marker(latlng, {
        icon: geoMineralIcon(p.symbol),
        zIndexOffset: 500,
      });
      marker.bindTooltip(p.Name_Geo + " (" + p.Type_Geo + ")", {
        direction: "top",
        className: "village-label",
        offset: [0, -27],
      });
      marker.on("click", function () {
        document.getElementById("infoCard").classList.remove("hidden");
        document.getElementById("infoCard").innerHTML =
          '<div class="info-title">' +
          (p.Name_Geo || "") +
          "</div>" +
          '<div class="info-row"><span class="info-label">სახეობა:</span><span class="info-value">' +
          (p.Type_Geo || "-") +
          "</span></div>" +
          '<div class="info-row"><span class="info-label">რაიონი:</span><span class="info-value">' +
          (p.raioni || "-") +
          "</span></div>" +
          '<div class="info-row"><span class="info-label">Type:</span><span class="info-value">' +
          (p.Type_Eng || "-") +
          "</span></div>";
      });
      return marker;
    },
  }).addTo(map);

  // ---- 4. არალითონური წიაღისეული ----
  if (nonmetalOreLayer) map.removeLayer(nonmetalOreLayer);
  nonmetalOreLayer = L.geoJSON(nonmetalOreData, {
    pointToLayer: function (feat, latlng) {
      var p = feat.properties;
      var marker = L.marker(latlng, {
        icon: geoMineralIcon(p.symbol),
        zIndexOffset: 400,
      });
      marker.bindTooltip(p.Name_Geo + " (" + p.Type_Geo + ")", {
        direction: "top",
        className: "village-label",
        offset: [0, -27],
      });
      marker.on("click", function () {
        document.getElementById("infoCard").classList.remove("hidden");
        document.getElementById("infoCard").innerHTML =
          '<div class="info-title">' +
          (p.Name_Geo || "") +
          "</div>" +
          '<div class="info-row"><span class="info-label">სახეობა:</span><span class="info-value">' +
          (p.Type_Geo || "-") +
          "</span></div>" +
          '<div class="info-row"><span class="info-label">გამოყენება:</span><span class="info-value">' +
          (p.Use_Geo || "-") +
          "</span></div>" +
          '<div class="info-row"><span class="info-label">რაიონი:</span><span class="info-value">' +
          (p.raioni || "-") +
          "</span></div>";
      });
      return marker;
    },
  }).addTo(map);

  // ---- 5. ნავთობი და გაზი ----
  if (oilGasLayer) map.removeLayer(oilGasLayer);
  oilGasLayer = L.geoJSON(oilGasData, {
    pointToLayer: function (feat, latlng) {
      var p = feat.properties;
      var marker = L.marker(latlng, {
        icon: geoMineralIcon("navtobi"),
        zIndexOffset: 600,
      });
      marker.bindTooltip(p.Name_Geo, {
        direction: "top",
        className: "village-label",
        offset: [0, -27],
      });
      marker.on("click", function () {
        document.getElementById("infoCard").classList.remove("hidden");
        document.getElementById("infoCard").innerHTML =
          '<div class="info-title">' +
          (p.Name_Geo || "") +
          "</div>" +
          '<div class="info-row"><span class="info-label">სახეობა:</span><span class="info-value">' +
          (p.Type_Geo || "-") +
          "</span></div>" +
          '<div class="info-row"><span class="info-label">რაიონი:</span><span class="info-value">' +
          (p.raioni || "-") +
          "</span></div>";
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
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">ამგები ქანების ასაკი</div>';
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
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin:8px 0 4px;text-transform:uppercase;letter-spacing:.06em;">ლითონური წიაღისეული</div>';
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
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin:8px 0 4px;text-transform:uppercase;letter-spacing:.06em;">არალითონური</div>';
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
          ticks: { stepSize: 1, font: { family: "Fira Sans", size: 10 } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 8 }, maxRotation: 35 },
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
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
        x: {
          ticks: { font: { family: "Fira Sans", size: 10 } },
          grid: { display: false },
        },
      },
      animation: {
        onComplete: function () {
          var chart = this;
          var ctx2 = chart.ctx;
          ctx2.font = "bold 12px 'Fira Sans'";
          ctx2.fillStyle = "#333";
          ctx2.textAlign = "center";
          ctx2.textBaseline = "bottom";
          chart.data.datasets.forEach(function (ds, i) {
            chart.getDatasetMeta(i).data.forEach(function (bar, idx) {
              if (ds.data[idx] > 0)
                ctx2.fillText(ds.data[idx], bar.x, bar.y - 3);
            });
          });
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
  fetch("data/germans.geojson")
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
          ticks: { stepSize: 1, font: { family: "Fira Sans", size: 10 } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 10 } },
          grid: { display: false },
        },
      },
      animation: {
        onComplete: function () {
          var chart = this;
          var ctx2 = chart.ctx;
          ctx2.font = "bold 11px 'Fira Sans'";
          ctx2.fillStyle = "#333";
          ctx2.textAlign = "center";
          ctx2.textBaseline = "bottom";
          chart.data.datasets.forEach(function (ds, i) {
            chart.getDatasetMeta(i).data.forEach(function (bar, idx) {
              if (ds.data[idx] > 0)
                ctx2.fillText(ds.data[idx], bar.x, bar.y - 3);
            });
          });
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
          ticks: { stepSize: 2, font: { family: "Fira Sans", size: 10 } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 8 }, maxRotation: 35 },
          grid: { display: false },
        },
      },
      animation: {
        onComplete: function () {
          var chart = this;
          var ctx2 = chart.ctx;
          ctx2.font = "bold 11px 'Fira Sans'";
          ctx2.fillStyle = "#333";
          ctx2.textAlign = "center";
          ctx2.textBaseline = "bottom";
          chart.data.datasets.forEach(function (ds, i) {
            chart.getDatasetMeta(i).data.forEach(function (bar, idx) {
              if (ds.data[idx] > 0)
                ctx2.fillText(ds.data[idx], bar.x, bar.y - 3);
            });
          });
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
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12.84 12.08" width="18" height="18"><polygon fill="#010101" points="6.12,11.45 6.72,11.45 7.12,11.02 7.12,10.39 6.85,9.96 6.85,5 8.74,5 9.14,5.3 9.74,5.3 10.14,4.88 10.14,4.24 9.74,3.82 9.14,3.82 8.74,4.07 6.85,4.07 6.85,2.12 7.12,1.69 7.12,1.06 6.72,0.63 6.12,0.63 5.71,1.06 5.71,1.69 5.99,2.12 5.99,4.07 4.1,4.07 3.7,3.82 3.1,3.82 2.69,4.24 2.69,4.88 3.1,5.3 3.7,5.3 4.1,5 5.99,5 5.99,9.96 5.71,10.39 5.71,11.02"/></svg>',
  monastery_w:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12.84 12.08" width="18" height="18"><polygon fill="none" stroke="#010101" stroke-width="0.8" points="6.12,11.45 6.72,11.45 7.12,11.02 7.12,10.39 6.85,9.96 6.85,5 8.74,5 9.14,5.3 9.74,5.3 10.14,4.88 10.14,4.24 9.74,3.82 9.14,3.82 8.74,4.07 6.85,4.07 6.85,2.12 7.12,1.69 7.12,1.06 6.72,0.63 6.12,0.63 5.71,1.06 5.71,1.69 5.99,2.12 5.99,4.07 4.1,4.07 3.7,3.82 3.1,3.82 2.69,4.24 2.69,4.88 3.1,5.3 3.7,5.3 4.1,5 5.99,5 5.99,9.96 5.71,10.39 5.71,11.02"/></svg>',
  cathedral:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11.29 11.2" width="19" height="19"><polygon fill="#010101" points="11.01,8.52 10.8,8.18 10.64,7.94 10.11,7.33 9.61,6.91 9.46,6.75 9.08,6.5 8.3,6.06 7.23,5.65 5.57,5.6 5.68,7.22 6.18,8.47 6.33,8.76 6.63,9.21 7.28,9.99 7.45,10.16 8.18,10.76 8.59,10.98 2.44,10.98 2.81,10.76 3.26,10.44 3.5,10.23 4.04,9.66 4.54,8.97 4.9,8.3 5.06,7.94 5.3,7.22 5.43,5.6 3.74,5.65 3.02,6 2.44,6.33 1.53,6.93 1.21,7.24 0.92,7.57 0.52,8.1 0.28,8.47 0.28,2.41 0.64,2.98 1.04,3.47 1.38,3.8 2.43,4.58 2.9,4.87 3.74,5.26 5.43,5.36 5.3,3.74 4.82,2.73 4.32,1.91 4.2,1.74 3.63,1.09 3.1,0.64 2.44,0.23 8.47,0.23 7.9,0.6 7.65,0.8 6.85,1.6 6.66,1.87 6.38,2.33 6.1,2.7 5.69,3.74 5.57,5.36 7.23,5.25 8.51,4.82 9.16,4.42 10.3,3.5 10.8,2.78 11.01,2.44"/></svg>',
  residence:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12.84 12.08" width="18" height="18"><polygon fill="#7B1F1F" points="6.13,0.28 6.13,2.88 3.23,2.88 3.23,3.68 6.13,3.68 6.13,6.08 6.9,6.08 6.9,3.68 9.61,3.68 9.61,2.88 6.9,2.88 6.9,0.28"/><circle cx="6.47" cy="8.88" r="2.92" fill="none" stroke="#010101" stroke-width="0.4"/></svg>',
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
      return f.geometry.type === "Polygon";
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

  eparchyPointLayer = L.geoJSON(points, {
    pointToLayer: function (feat, latlng) {
      var p = feat.properties;
      var icon = L.divIcon({
        html: EP_SVG[p.TKey] || EP_SVG.monastery_m,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        className: "",
      });
      var marker = L.marker(latlng, { icon: icon });
      marker.bindTooltip(p.Name_Geo, {
        direction: "top",
        className: "village-label",
        offset: [0, -11],
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
      var short = e.replace(" ეპარქია", "").replace("ისა და", " /");
      byEparchy[short] = (byEparchy[short] || 0) + 1;
    });

  var labels = Object.keys(byEparchy);
  var polyColors = {};
  data.features
    .filter(function (f) {
      return f.geometry.type === "Polygon";
    })
    .forEach(function (f) {
      var short = f.properties.Name_Geo.replace(" ეპარქია", "").replace(
        "ისა და",
        " /",
      );
      polyColors[short] = f.properties.Color;
    });

  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
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
          ticks: { stepSize: 2, font: { family: "Fira Sans", size: 10 } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 8 }, maxRotation: 40 },
          grid: { display: false },
        },
      },
      animation: {
        onComplete: function () {
          var chart = this;
          var ctx2 = chart.ctx;
          ctx2.font = "bold 10px 'Fira Sans'";
          ctx2.fillStyle = "#333";
          ctx2.textAlign = "center";
          ctx2.textBaseline = "bottom";
          chart.data.datasets.forEach(function (ds, i) {
            chart.getDatasetMeta(i).data.forEach(function (bar, idx) {
              if (ds.data[idx] > 0)
                ctx2.fillText(ds.data[idx], bar.x, bar.y - 3);
            });
          });
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
      buildChurchesLayer(d);
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
      '<span style="display:inline-flex;width:22px;justify-content:center;">' +
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
    '<button id="btnToggleChurches" onclick="toggleChurches()" class="' +
    (churchesVisible ? "active" : "") +
    '" ' +
    "style=\"display:flex;align-items:center;gap:6px;width:100%;padding:6px 8px;font-size:10px;font-family:'Fira Sans',sans-serif;" +
    "border:1.5px solid #8B5A2B;border-radius:6px;cursor:pointer;transition:all .15s;" +
    (churchesVisible
      ? "background:#8B5A2B;color:#fff;"
      : "background:transparent;color:#8B5A2B;") +
    '">' +
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg>' +
    (churchesVisible
      ? "ეკლესიები ჩართულია (" +
        (churchesData ? churchesData.features.length : "...") +
        ")"
      : "ეკლესიების ჩვენება") +
    "</button></div>";
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
          ticks: { stepSize: 1, font: { family: "Fira Sans", size: 10 } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 9 }, maxRotation: 30 },
          grid: { display: false },
        },
      },
      animation: {
        onComplete: function () {
          var chart = this;
          var ctx2 = chart.ctx;
          ctx2.font = "bold 11px 'Fira Sans'";
          ctx2.fillStyle = "#333";
          ctx2.textAlign = "center";
          ctx2.textBaseline = "bottom";
          chart.data.datasets.forEach(function (ds, i) {
            chart.getDatasetMeta(i).data.forEach(function (bar, idx) {
              if (ds.data[idx] > 0)
                ctx2.fillText(ds.data[idx], bar.x, bar.y - 3);
            });
          });
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
          ticks: { stepSize: 10, font: { family: "Fira Sans", size: 10 } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 10 } },
          grid: { display: false },
        },
      },
      animation: {
        onComplete: function () {
          var chart = this;
          var ctx2 = chart.ctx;
          ctx2.font = "bold 12px 'Fira Sans'";
          ctx2.fillStyle = "#333";
          ctx2.textAlign = "center";
          ctx2.textBaseline = "bottom";
          chart.data.datasets.forEach(function (ds, i) {
            chart.getDatasetMeta(i).data.forEach(function (bar, idx) {
              if (ds.data[idx] > 0)
                ctx2.fillText(ds.data[idx], bar.x, bar.y - 3);
            });
          });
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
    document.getElementById("economyView").style.display = "none";
    document.getElementById("educationView").style.display = "none";
    removeAllThematic();
    removeAllNatureLayers();
    removeAllEconomyLayers();
    removeAllEducationLayers();
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
    resetChartPanel();
    document.getElementById("infoCard").classList.add("hidden");
    resetPopLegend();
    loadNeutralLayers();
  });

document.querySelectorAll("[data-histsub]").forEach(function (btn) {
  btn.addEventListener("click", function () {
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
  });
});

// ============================================================
// ეკონომიკა — ბოტანიკურ-აგრონომიული ზონები
// ============================================================
var botanicaLayer = null;
var botanicaData = null;

var BOTANICA_TYPES = [
  { key: "ვენახ-ხილიანი", color: "#C44E6B", label: "ვენახ-ხილიანი" },
  { key: "უვენახ-ხილო", color: "#E8D49A", label: "უვენახ-ხილო" },
  { key: "ბრინჯ-ბამბა", color: "#6BB6C4", label: "ბრინჯ-ბამბა" },
  { key: "ბალახ-ყვავილოვანი", color: "#9ACD6E", label: "ბალახ-ყვავილოვანი" },
  { key: "ზამთრის საძოვრები", color: "#D4A574", label: "ზამთრის საძოვრები" },
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
          ticks: { font: { family: "Fira Sans", size: 10 } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 8 }, maxRotation: 30 },
          grid: { display: false },
        },
      },
      animation: {
        onComplete: function () {
          var chart = this;
          var ctx2 = chart.ctx;
          ctx2.font = "bold 10px 'Fira Sans'";
          ctx2.fillStyle = "#333";
          ctx2.textAlign = "center";
          ctx2.textBaseline = "bottom";
          chart.data.datasets.forEach(function (ds, i) {
            chart.getDatasetMeta(i).data.forEach(function (bar, idx) {
              if (ds.data[idx] > 0)
                ctx2.fillText(ds.data[idx].toLocaleString(), bar.x, bar.y - 3);
            });
          });
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
  if (energetikaData) {
    buildEnergetikaLayer(energetikaData);
    loadNatureMuniCenters();
    return;
  }
  fetch("data/energetika.geojson")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      energetikaData = d;
      buildEnergetikaLayer(d);
      loadNatureMuniCenters();
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
          ticks: { font: { family: "Fira Sans", size: 10 } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 10 } },
          grid: { display: false },
        },
      },
      animation: {
        onComplete: function () {
          var chart = this;
          var ctx2 = chart.ctx;
          ctx2.font = "bold 12px 'Fira Sans'";
          ctx2.fillStyle = "#333";
          ctx2.textAlign = "center";
          ctx2.textBaseline = "bottom";
          chart.data.datasets.forEach(function (ds, i) {
            chart.getDatasetMeta(i).data.forEach(function (bar, idx) {
              if (ds.data[idx] > 0)
                ctx2.fillText(ds.data[idx].toLocaleString(), bar.x, bar.y - 3);
            });
          });
        },
      },
    },
  });
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
  html +=
    '<div style="display:flex;align-items:flex-end;gap:10px;padding-left:4px;">';
  [
    ["300", getPowerRadius(300)],
    ["100", getPowerRadius(100)],
    ["14", getPowerRadius(14)],
    ["1", getPowerRadius(1)],
  ].forEach(function (pair) {
    var d = pair[1] * 2;
    html +=
      '<div style="display:flex;flex-direction:column;align-items:center;gap:3px;">' +
      '<span style="display:inline-block;width:' +
      d +
      "px;height:" +
      d +
      'px;border-radius:50%;background:#5BA3D0;border:1.2px solid #2B6A9A;opacity:0.72;"></span>' +
      '<span style="font-size:9px;color:#555;">' +
      pair[0] +
      "</span></div>";
  });
  html += "</div>";
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
    color: "#E89AAC",
    short: "მევენახეობა-მშრ. სუბტროპ. მეხილეობა",
  },
  {
    key: "მევენახეობის (სუფრისა და შამპანური ღვინოები), მებოსტნეობისა და კონტინენტური მეხილეობის ზონა",
    color: "#E8C4A0",
    short: "მევენახეობა-მებოსტნ.-კონტ. მეხილ.",
  },
  {
    key: "კონტინენტური მეხილეობისა და მემინდვრეობის ზონა",
    color: "#C9A0D4",
    short: "კონტ. მეხილეობა-მემინდვრეობა",
  },
  {
    key: "საშუალო მთის მეტყევეობის ზონა",
    color: "#A8C97A",
    short: "საშ. მთის მეტყევეობა",
  },
  {
    key: "მემინდვრეობისა და მსხვილფეხა მესაქონლეობის ზონა",
    color: "#E8D878",
    short: "მემინდვრეობა-მესაქონლეობა",
  },
  { key: "სათიბ-საძოვრების ზონა", color: "#B0D4C0", short: "სათიბ-საძოვრები" },
];

function loadCropZones() {
  if (cropZonesData) {
    buildCropZonesLayer(cropZonesData);
    loadNatureMuniCenters();
    return;
  }
  fetch("data/crop_zones.geojson")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      cropZonesData = d;
      buildCropZonesLayer(d);
      loadNatureMuniCenters();
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
          ticks: { font: { family: "Fira Sans", size: 10 } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 7 }, maxRotation: 40 },
          grid: { display: false },
        },
      },
      animation: {
        onComplete: function () {
          var chart = this;
          var ctx2 = chart.ctx;
          ctx2.font = "bold 9px 'Fira Sans'";
          ctx2.fillStyle = "#333";
          ctx2.textAlign = "center";
          ctx2.textBaseline = "bottom";
          chart.data.datasets.forEach(function (ds, i) {
            chart.getDatasetMeta(i).data.forEach(function (bar, idx) {
              if (ds.data[idx] > 0)
                ctx2.fillText(ds.data[idx].toLocaleString(), bar.x, bar.y - 3);
            });
          });
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
  if (landData) {
    buildLandLayer(landData);
    loadNatureMuniCenters();
    return;
  }
  fetch("data/land.geojson")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      landData = d;
      buildLandLayer(d);
      loadNatureMuniCenters();
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
          ticks: { font: { family: "Fira Sans", size: 10 } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 9 }, maxRotation: 35 },
          grid: { display: false },
        },
      },
      animation: {
        onComplete: function () {
          var chart = this;
          var ctx2 = chart.ctx;
          ctx2.font = "bold 9px 'Fira Sans'";
          ctx2.fillStyle = "#333";
          ctx2.textAlign = "center";
          ctx2.textBaseline = "bottom";
          chart.data.datasets.forEach(function (ds, i) {
            chart.getDatasetMeta(i).data.forEach(function (bar, idx) {
              if (ds.data[idx] > 0)
                ctx2.fillText(ds.data[idx].toLocaleString(), bar.x, bar.y - 3);
            });
          });
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
  if (sunData) {
    buildSunLayers(sunData);
    loadNatureMuniCenters();
    return;
  }
  fetch("data/sun.geojson")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      sunData = d;
      buildSunLayers(d);
      loadNatureMuniCenters();
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
          ticks: { stepSize: 1, font: { family: "Fira Sans", size: 10 } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 8 }, maxRotation: 35 },
          grid: { display: false },
        },
      },
      animation: {
        onComplete: function () {
          var chart = this;
          var ctx2 = chart.ctx;
          ctx2.font = "bold 11px 'Fira Sans'";
          ctx2.fillStyle = "#333";
          ctx2.textAlign = "center";
          ctx2.textBaseline = "bottom";
          chart.data.datasets.forEach(function (ds, i) {
            chart.getDatasetMeta(i).data.forEach(function (bar, idx) {
              if (ds.data[idx] > 0)
                ctx2.fillText(ds.data[idx], bar.x, bar.y - 3);
            });
          });
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
  if (agriData) {
    buildAgriLayer(agriData);
    loadNatureMuniCenters();
    return;
  }
  fetch("data/agri_beneficiaries.geojson")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      agriData = d;
      buildAgriLayer(d);
      loadNatureMuniCenters();
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
          ticks: { font: { family: "Fira Sans", size: 10 } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 9 }, maxRotation: 35 },
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
    color: "#E8B85C",
    label:
      "სასაქონლო მემარცვლეობა, მებოსტნეობა, მევენახეობა, მეხილეობა, მეფრინველეობა, მეცხვარეობა",
  },
  {
    key: "dairy",
    color: "#6BAEC4",
    label: "სასაქონლო სარძევე-სახორცე მესაქონლეობა",
  },
  {
    key: "horti",
    color: "#7EB05C",
    label: "მებოსტნეობა, სახორცე-სარძევე მესაქონლეობა",
  },
  {
    key: "potato",
    color: "#C97FB0",
    label: "სასაქონლო მეკარტოფილეობა და სახორცე-სარძევე მესაქონლეობა",
  },
];

function loadAgriSpec() {
  if (agriSpecData) {
    buildAgriSpecLayer(agriSpecData);
    loadNatureMuniCenters();
    return;
  }
  fetch("data/agri_spec.geojson")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      agriSpecData = d;
      buildAgriSpecLayer(d);
      loadNatureMuniCenters();
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
          ticks: { font: { family: "Fira Sans", size: 10 } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 8 }, maxRotation: 25 },
          grid: { display: false },
        },
      },
      animation: {
        onComplete: function () {
          var chart = this;
          var ctx2 = chart.ctx;
          ctx2.font = "bold 9px 'Fira Sans'";
          ctx2.fillStyle = "#333";
          ctx2.textAlign = "center";
          ctx2.textBaseline = "bottom";
          chart.data.datasets.forEach(function (ds, i) {
            chart.getDatasetMeta(i).data.forEach(function (bar, idx) {
              if (ds.data[idx] > 0)
                ctx2.fillText(ds.data[idx].toLocaleString(), bar.x, bar.y - 3);
            });
          });
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
    document.getElementById("educationView").style.display = "none";
    removeAllThematic();
    removeAllNatureLayers();
    removeAllHistoryLayers();
    removeAllEducationLayers();
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
    resetChartPanel();
    document.getElementById("infoCard").classList.add("hidden");
    resetPopLegend();
    loadNeutralLayers();
  });

document.querySelectorAll("[data-econsub]").forEach(function (btn) {
  btn.addEventListener("click", function () {
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
  });
});

// ============================================================
// განათლება — ზოგადი განათლება (სკოლები + სტატისტიკა)
// ============================================================
var eduMuniLayer = null;
var eduSchoolLayer = null;
var eduData = null;

// სკოლის ტიპები ენის მიხედვით (PDF-ის სიმბოლოები)
var EDU_SCHOOL_TYPES = [
  { key: "ka", color: "#127DC2", shape: "square", label: "საჯარო ქართული" },
  {
    key: "az",
    color: "#3CA749",
    shape: "square",
    label: "საჯარო აზერბაიჯანული",
  },
  { key: "hy", color: "#E8821A", shape: "square", label: "საჯარო სომხური" },
  { key: "ru", color: "#C8394F", shape: "square", label: "საჯარო რუსული" },
  {
    key: "mixed",
    color: "#9273B3",
    shape: "square",
    label: "საჯარო შერეული (ორ/მეტენოვანი)",
  },
  {
    key: "professional",
    color: "#034EA2",
    shape: "hexagon",
    label: "პროფესიული სასწავლებელი",
  },
  {
    key: "no_pupils",
    color: "#B0B0B0",
    shape: "square",
    label: "სკოლა მოსწავლის გარეშე",
  },
  { key: "none", color: "#999999", shape: "dot", label: "სკოლის გარეშე" },
];

function eduSchoolSVG(cat) {
  var t =
    EDU_SCHOOL_TYPES.find(function (x) {
      return x.key === cat;
    }) || EDU_SCHOOL_TYPES[7];
  if (t.shape === "dot") {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2.85 2.84" width="7" height="7"><circle cx="1.42" cy="1.42" r="1.33" fill="' +
      t.color +
      '"/></svg>'
    );
  }
  if (t.shape === "hexagon") {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 6.42 5.53" width="14" height="12"><polygon points="4.7,0.18 1.72,0.18 0.22,2.77 1.72,5.35 4.7,5.35 6.19,2.77" fill="' +
      t.color +
      '" stroke="#000" stroke-width="0.2"/></svg>'
    );
  }
  // square
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4.9 4.84" width="12" height="12"><rect x="0.24" y="0.21" width="4.43" height="4.43" fill="' +
    t.color +
    '" stroke="#221F1F" stroke-width="0.2"/></svg>'
  );
}

function loadEducation() {
  if (eduData) {
    buildEducationLayers(eduData);
    loadNatureMuniCenters();
    return;
  }
  fetch("data/education.geojson")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      eduData = d;
      buildEducationLayers(d);
      loadNatureMuniCenters();
    });
}

function buildEducationLayers(data) {
  if (eduMuniLayer) {
    map.removeLayer(eduMuniLayer);
    eduMuniLayer = null;
  }
  if (eduSchoolLayer) {
    map.removeLayer(eduSchoolLayer);
    eduSchoolLayer = null;
  }

  var munis = {
    type: "FeatureCollection",
    features: data.features.filter(function (f) {
      return f.properties.ftype === "municipality";
    }),
  };
  var schools = {
    type: "FeatureCollection",
    features: data.features.filter(function (f) {
      return f.properties.ftype === "settlement";
    }),
  };

  // მუნიციპალიტეტების მსუბუქი ფონი
  eduMuniLayer = L.geoJSON(munis, {
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
        showInfoEduMuni(p);
        showBottomChartEdu(data);
      });
    },
  }).addTo(map);

  // დასახლებები — სკოლის ტიპის სიმბოლოები
  eduSchoolLayer = L.geoJSON(schools, {
    pointToLayer: function (feat, latlng) {
      var p = feat.properties;
      var svg = eduSchoolSVG(p.SchoolCat);
      var sz =
        p.SchoolCat === "none" ? 7 : p.SchoolCat === "professional" ? 14 : 12;
      var icon = L.divIcon({
        html: svg,
        iconSize: [sz, sz],
        iconAnchor: [sz / 2, sz / 2],
        className: "",
      });
      var marker = L.marker(latlng, { icon: icon });
      marker.bindTooltip(p.Name_Geo + " — " + p.Schools, {
        direction: "top",
        className: "village-label",
        offset: [0, -sz / 2 - 2],
      });
      marker.on("click", function () {
        showInfoEduSchool(p);
      });
      return marker;
    },
  }).addTo(map);

  updateEducationLegend();
  setInfoBtn("education");
}

function showInfoEduMuni(p) {
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;font-weight:700;">' +
    p.Name_Geo +
    " (მუნიციპალიტეტი)</div>" +
    '<span class="info-type-badge" style="background:#7EB05C33;color:#4a7030;border:1px solid #7EB05C;">ზოგადი განათლება 2023/2024</span>' +
    '<div style="margin-top:8px;font-size:11px;color:#444;line-height:1.9;">' +
    "<b>სკოლები:</b> " +
    p.Schools +
    "<br>" +
    "<b>მოსწავლეები:</b> " +
    p.Pupils.toLocaleString() +
    "<br>" +
    "<b>მასწავლებლები:</b> " +
    p.Educators.toLocaleString() +
    "</div>";
  document.getElementById("infoCard").classList.remove("hidden");
}

function showInfoEduSchool(p) {
  var t =
    EDU_SCHOOL_TYPES.find(function (x) {
      return x.key === p.SchoolCat;
    }) || EDU_SCHOOL_TYPES[7];
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;font-weight:700;">' +
    p.Name_Geo +
    "</div>" +
    '<div style="margin:6px 0;display:flex;align-items:center;gap:8px;">' +
    eduSchoolSVG(p.SchoolCat) +
    '<span class="info-type-badge" style="background:' +
    t.color +
    "22;color:" +
    t.color +
    ";border:1px solid " +
    t.color +
    '66;">' +
    p.Schools +
    "</span></div>" +
    '<div style="margin-top:6px;font-size:10px;color:var(--text-muted);line-height:1.7;">' +
    "<b>დასახლების ტიპი:</b> " +
    (p.SettType || "") +
    "<br>" +
    "<b>მუნიციპალიტეტი:</b> " +
    (p.Municipal || "") +
    "</div>";
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartEdu(data) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

  var munis = data.features.filter(function (f) {
    return f.properties.ftype === "municipality";
  });
  munis.sort(function (a, b) {
    return b.properties.Pupils - a.properties.Pupils;
  });
  var labels = munis.map(function (f) {
    return f.properties.Name_Geo;
  });

  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "მოსწავლეები",
          data: munis.map(function (f) {
            return f.properties.Pupils;
          }),
          backgroundColor: "#5BA3D0CC",
          borderColor: "#2B6A9A",
          borderWidth: 1.5,
          borderRadius: 4,
          yAxisID: "y",
        },
        {
          label: "მასწავლებლები",
          data: munis.map(function (f) {
            return f.properties.Educators;
          }),
          backgroundColor: "#E8821ACC",
          borderColor: "#B8650A",
          borderWidth: 1.5,
          borderRadius: 4,
          yAxisID: "y1",
        },
      ],
    },
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
          text: "მოსწავლეები და მასწავლებლები მუნიციპალიტეტების მიხედვით",
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: {
            label: function (c) {
              return " " + c.dataset.label + ": " + c.parsed.y.toLocaleString();
            },
          },
        },
      },
      scales: {
        y: {
          type: "linear",
          position: "left",
          beginAtZero: true,
          ticks: { font: { family: "Fira Sans", size: 9 } },
          title: { display: true, text: "მოსწავლეები", font: { size: 8 } },
        },
        y1: {
          type: "linear",
          position: "right",
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          ticks: { font: { family: "Fira Sans", size: 9 } },
          title: { display: true, text: "მასწავლებლები", font: { size: 8 } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 9 }, maxRotation: 35 },
          grid: { display: false },
        },
      },
    },
  });
}

function updateEducationLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">სკოლა და სწავლების ენა</div>';
  html += '<div class="ethnics-legend">';
  EDU_SCHOOL_TYPES.forEach(function (t) {
    html +=
      '<div class="eth-legend-item" style="margin-bottom:5px;align-items:center;">' +
      '<span style="display:inline-flex;width:16px;justify-content:center;flex-shrink:0;">' +
      eduSchoolSVG(t.key) +
      "</span>" +
      '<span style="font-size:10px;margin-left:5px;">' +
      t.label +
      "</span></div>";
  });
  html += "</div>";
  html +=
    '<div style="margin-top:8px;font-size:9px;color:var(--text-muted);line-height:1.5;">მუნიციპალიტეტზე დაჭერით — სკოლების, მოსწავლეების და მასწავლებლების რაოდენობა</div>';
  el.innerHTML = html;
}

// ============================================================
// განათლება — სკოლამდელი აღზრდა (2018/2023 year switcher)
// ============================================================
var kgLayer = null;
var kgMarkerLayer = null;
var kgData = null;
var activeKgYear = "2023"; // '2018' | '2023'

// დაწესებულების რაოდენობის choropleth
var KG_STOPS = [
  [10, "#FCE8C8"],
  [20, "#F5C97A"],
  [30, "#E89B43"],
  [40, "#D4731E"],
  [999, "#A8500A"],
];

function getKgColor(n) {
  for (var i = 0; i < KG_STOPS.length; i++) {
    if (n <= KG_STOPS[i][0]) return KG_STOPS[i][1];
  }
  return KG_STOPS[KG_STOPS.length - 1][1];
}

function loadKindergarten() {
  if (kgData) {
    buildKgLayer(kgData);
    loadNatureMuniCenters();
    return;
  }
  fetch("data/kindergarten.geojson")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      kgData = d;
      buildKgLayer(d);
      loadNatureMuniCenters();
    });
}

// სკოლამდელის წრიული (donut) დიაგრამა — აღსაზრდელები vs აღმზრდელები
function makeKgPieSVG(pupil, edu, size) {
  var total = pupil + edu;
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
  var segs = [
    { val: pupil, color: "#3CA749" },
    { val: edu, color: "#C8394F" },
  ];
  var startAngle = -Math.PI / 2;
  var paths = "";
  segs.forEach(function (s) {
    if (s.val === 0) return;
    var angle = (s.val / total) * 2 * Math.PI;
    var endAngle = startAngle + angle;
    var x1 = cx + r * Math.cos(startAngle),
      y1 = cy + r * Math.sin(startAngle);
    var x2 = cx + r * Math.cos(endAngle),
      y2 = cy + r * Math.sin(endAngle);
    var largeArc = angle > Math.PI ? 1 : 0;
    if (s.val === total) {
      paths +=
        '<circle cx="' +
        cx +
        '" cy="' +
        cy +
        '" r="' +
        r +
        '" fill="' +
        s.color +
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
        s.color +
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
    r * 0.45 +
    '" fill="white"/>' +
    "</svg>"
  );
}

function buildKgLayer(data) {
  if (kgLayer) {
    map.removeLayer(kgLayer);
    kgLayer = null;
  }
  if (kgMarkerLayer) {
    map.removeLayer(kgMarkerLayer);
    kgMarkerLayer = null;
  }

  var yr = activeKgYear;
  // choropleth — დაწესებულების რაოდენობა
  kgLayer = L.geoJSON(data, {
    style: function (feat) {
      var n = feat.properties["KG_" + yr];
      return {
        fillColor: getKgColor(n),
        fillOpacity: 0.6,
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
        showInfoKg(p);
        showBottomChartKg(data);
      });
    },
  }).addTo(map);

  // მარკერები — წრიული (donut) დიაგრამა: აღსაზრდელები + აღმზრდელები
  var maxTotal = 0;
  data.features.forEach(function (f) {
    var t = f.properties["Pupil_" + yr] + f.properties["Edu_" + yr];
    if (t > maxTotal) maxTotal = t;
  });

  var markers = [];
  data.features.forEach(function (f) {
    var p = f.properties;
    var pupil = p["Pupil_" + yr],
      edu = p["Edu_" + yr];
    var total = pupil + edu;
    // წრის ზომა total-ის პროპორციული (sqrt-scale)
    var size = total > 0 ? 40 + Math.sqrt(total / maxTotal) * 46 : 40;
    var svg = makeKgPieSVG(pupil, edu, size);
    var html =
      '<div style="position:relative;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.25));">' +
      svg +
      '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:10px;font-weight:700;color:#222;font-family:Fira Sans,sans-serif;white-space:nowrap;text-align:center;pointer-events:none;">' +
      total.toLocaleString() +
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
      showInfoKg(p);
      showBottomChartKg(data);
    });
    markers.push(m);
  });
  kgMarkerLayer = L.layerGroup(markers).addTo(map);

  // საზღვრები ზემოთ (choropleth-ის რებილდის შემდეგაც)
  if (muniBorderOverlay) muniBorderOverlay.bringToFront();

  updateKgLegend();
  setInfoBtn("kindergarten");
}

function showInfoKg(p) {
  var yr = activeKgYear;
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;font-weight:700;">' +
    p.Name_Geo +
    " (მუნიციპალიტეტი)</div>" +
    '<span class="info-type-badge" style="background:#3CA74933;color:#2a6a30;border:1px solid #3CA749;">საჯარო სკოლამდელი აღზრდა ' +
    yr +
    "</span>" +
    '<div style="margin-top:8px;font-size:11px;color:#444;line-height:1.9;">' +
    "<b>დაწესებულებები:</b> " +
    p["KG_" + yr] +
    "<br>" +
    '<span style="color:#3CA749;">●</span> <b>აღსაზრდელები:</b> ' +
    p["Pupil_" + yr].toLocaleString() +
    "<br>" +
    '<span style="color:#C8394F;">●</span> <b>აღმზრდელები:</b> ' +
    p["Edu_" + yr].toLocaleString() +
    "</div>";
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartKg(data) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

  var yr = activeKgYear;
  var feats = data.features.slice().sort(function (a, b) {
    return b.properties["Pupil_" + yr] - a.properties["Pupil_" + yr];
  });
  var labels = feats.map(function (f) {
    return f.properties.Name_Geo;
  });

  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "აღსაზრდელები",
          data: feats.map(function (f) {
            return f.properties["Pupil_" + yr];
          }),
          backgroundColor: "#3CA749CC",
          borderColor: "#2a6a30",
          borderWidth: 1.5,
          borderRadius: 4,
          yAxisID: "y",
        },
        {
          label: "აღმზრდელები",
          data: feats.map(function (f) {
            return f.properties["Edu_" + yr];
          }),
          backgroundColor: "#C8394FCC",
          borderColor: "#8a2030",
          borderWidth: 1.5,
          borderRadius: 4,
          yAxisID: "y1",
        },
      ],
    },
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
          text: "სკოლამდელი აღზრდა — აღსაზრდელები და აღმზრდელები (" + yr + ")",
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: {
            label: function (c) {
              return " " + c.dataset.label + ": " + c.parsed.y.toLocaleString();
            },
          },
        },
      },
      scales: {
        y: {
          type: "linear",
          position: "left",
          beginAtZero: true,
          ticks: { font: { family: "Fira Sans", size: 9 } },
          title: { display: true, text: "აღსაზრდელები", font: { size: 8 } },
        },
        y1: {
          type: "linear",
          position: "right",
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          ticks: { font: { family: "Fira Sans", size: 9 } },
          title: { display: true, text: "აღმზრდელები", font: { size: 8 } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 9 }, maxRotation: 35 },
          grid: { display: false },
        },
      },
    },
  });
}

function updateKgLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">საჯარო სკოლამდელი აღზრდა (' +
    activeKgYear +
    ")</div>";
  // choropleth scale
  html +=
    '<div style="font-size:9px;font-weight:600;color:#666;margin-bottom:4px;">დაწესებულების რაოდენობა</div>';
  html += '<div class="ethnics-legend">';
  var prev = 0;
  KG_STOPS.forEach(function (stop, i) {
    var lbl =
      i === KG_STOPS.length - 1
        ? "> " + prev
        : i === 0
          ? "< " + stop[0]
          : prev + "–" + stop[0];
    html +=
      '<div class="eth-legend-item" style="margin-bottom:3px;">' +
      '<span class="eth-dot" style="background:' +
      stop[1] +
      ';border:1px solid rgba(0,0,0,0.15);border-radius:3px;"></span>' +
      '<span style="font-size:10px;">' +
      lbl +
      "</span></div>";
    prev = stop[0];
  });
  html += "</div>";
  // marker legend
  html +=
    '<div style="margin-top:8px;font-size:9px;font-weight:600;color:#666;margin-bottom:4px;">სვეტები</div>';
  html += '<div class="ethnics-legend">';
  html +=
    '<div class="eth-legend-item" style="margin-bottom:3px;"><span style="display:inline-block;width:11px;height:11px;background:#3CA749;flex-shrink:0;margin-right:6px;"></span><span style="font-size:10px;">აღსაზრდელები</span></div>';
  html +=
    '<div class="eth-legend-item" style="margin-bottom:3px;"><span style="display:inline-block;width:11px;height:11px;background:#C8394F;flex-shrink:0;margin-right:6px;"></span><span style="font-size:10px;">აღმზრდელები</span></div>';
  html += "</div>";
  // year switcher
  html +=
    '<div style="margin-top:12px;"><div style="font-size:9px;font-weight:700;color:var(--text-muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;">სასწავლო წელი</div>';
  html += '<div style="display:flex;gap:6px;">';
  [
    ["2018", "2017/2018"],
    ["2023", "2022/2023"],
  ].forEach(function (pair) {
    var active = activeKgYear === pair[0] ? "active" : "";
    html +=
      '<button class="year-btn kg-year-btn ' +
      active +
      '" data-kgyear="' +
      pair[0] +
      '">' +
      pair[1] +
      "</button>";
  });
  html += "</div></div>";
  el.innerHTML = html;

  el.querySelectorAll(".kg-year-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      activeKgYear = this.dataset.kgyear;
      if (kgData) {
        buildKgLayer(kgData);
        showBottomChartKg(kgData);
      }
    });
  });
}

function removeAllKgLayers() {
  if (kgLayer) {
    map.removeLayer(kgLayer);
    kgLayer = null;
  }
  if (kgMarkerLayer) {
    map.removeLayer(kgMarkerLayer);
    kgMarkerLayer = null;
  }
}

// ============================================================
// განათლება და კულტურა — ოიკონიმია (დასახლებათა სახელწოდებები)
// ============================================================
var oikLayer = null;
var oikData = null;

var OIK_COLORS = {
  ქართული: "#3CA749", // მწვანე
  არაქართული: "#C8394F", // წითელი
};

function loadOikonymy() {
  if (oikData) {
    buildOikLayer(oikData);
    loadNatureMuniCenters();
    return;
  }
  fetch("data/oikonymy.geojson")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      oikData = d;
      buildOikLayer(d);
      loadNatureMuniCenters();
    });
}

function buildOikLayer(data) {
  if (oikLayer) map.removeLayer(oikLayer);
  oikLayer = L.geoJSON(data, {
    pointToLayer: function (feat, latlng) {
      var p = feat.properties;
      var color = OIK_COLORS[p.Oikonymy] || "#888";
      var r = p.SettType === "ქალაქი" ? 7 : p.SettType === "დაბა" ? 6 : 5;
      var marker = L.circleMarker(latlng, {
        radius: r,
        fillColor: color,
        color: "#fff",
        weight: 1.2,
        fillOpacity: 0.9,
      });
      marker.bindTooltip(p.Name_Geo, {
        direction: "top",
        className: "village-label",
        offset: [0, -r - 2],
      });
      marker.on("click", function () {
        showInfoOik(p);
        showBottomChartOik(data);
      });
      return marker;
    },
  }).addTo(map);
  if (muniBorderOverlay) muniBorderOverlay.bringToFront();
  updateOikLegend();
  setInfoBtn("oikonymy");
}

function showInfoOik(p) {
  var color = OIK_COLORS[p.Oikonymy] || "#888";
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;font-weight:700;">' +
    p.Name_Geo +
    "</div>" +
    '<div style="margin:6px 0;display:flex;align-items:center;gap:8px;">' +
    '<span style="display:inline-block;width:13px;height:13px;border-radius:50%;background:' +
    color +
    ";border:1.3px solid #fff;box-shadow:0 0 0 1px " +
    color +
    ';"></span>' +
    '<span class="info-type-badge" style="background:' +
    color +
    "22;color:" +
    color +
    ";border:1px solid " +
    color +
    '66;">' +
    p.Oikonymy +
    " ოიკონიმი</span></div>" +
    '<div style="margin-top:6px;font-size:10px;color:var(--text-muted);line-height:1.7;">' +
    "<b>დასახლების ტიპი:</b> " +
    (p.SettType || "") +
    "<br>" +
    "<b>მუნიციპალიტეტი:</b> " +
    (p.Municipal || "") +
    "</div>";
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartOik(data) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();

  // მუნიციპალიტეტების მიხედვით ქართული vs არაქართული
  var byMuni = {};
  data.features.forEach(function (f) {
    var m = (f.properties.Municipal || "")
      .replace(" მუნიციპალი", "")
      .replace(" მუნიციპა", "")
      .replace(" მუნიც", "")
      .replace("ქალაქ ", "");
    if (!byMuni[m]) byMuni[m] = { ka: 0, other: 0 };
    if (f.properties.OikKa) byMuni[m].ka++;
    else byMuni[m].other++;
  });

  var labels = Object.keys(byMuni).filter(function (m) {
    return byMuni[m].ka + byMuni[m].other > 1;
  });
  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "ქართული",
          data: labels.map(function (m) {
            return byMuni[m].ka;
          }),
          backgroundColor: "#3CA749CC",
          borderColor: "#2a6a30",
          borderWidth: 1.5,
          borderRadius: 3,
          stack: "s",
        },
        {
          label: "არაქართული",
          data: labels.map(function (m) {
            return byMuni[m].other;
          }),
          backgroundColor: "#C8394FCC",
          borderColor: "#8a2030",
          borderWidth: 1.5,
          borderRadius: 3,
          stack: "s",
        },
      ],
    },
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
          text: "ქართული და არაქართული ოიკონიმები მუნიციპალიტეტების მიხედვით",
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
          stacked: true,
          beginAtZero: true,
          ticks: { font: { family: "Fira Sans", size: 9 } },
        },
        x: {
          stacked: true,
          ticks: { font: { family: "Fira Sans", size: 9 }, maxRotation: 35 },
          grid: { display: false },
        },
      },
    },
  });
}

function updateOikLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var total = oikData ? oikData.features.length : 0;
  var ka = oikData
    ? oikData.features.filter(function (f) {
        return f.properties.OikKa;
      }).length
    : 0;
  var pctKa = total ? Math.round((ka / total) * 100) : 0;
  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">ოიკონიმები (დასახლებათა სახელწოდებები)</div>';
  html += '<div class="ethnics-legend">';
  html +=
    '<div class="eth-legend-item" style="margin-bottom:5px;align-items:center;">' +
    '<span style="display:inline-block;width:13px;height:13px;border-radius:50%;background:#3CA749;border:1.2px solid #fff;box-shadow:0 0 0 1px #3CA749;flex-shrink:0;margin-right:7px;"></span>' +
    '<span style="font-size:10px;">ქართული (' +
    pctKa +
    "%)</span></div>";
  html +=
    '<div class="eth-legend-item" style="margin-bottom:5px;align-items:center;">' +
    '<span style="display:inline-block;width:13px;height:13px;border-radius:50%;background:#C8394F;border:1.2px solid #fff;box-shadow:0 0 0 1px #C8394F;flex-shrink:0;margin-right:7px;"></span>' +
    '<span style="font-size:10px;">არაქართული (' +
    (100 - pctKa) +
    "%)</span></div>";
  html += "</div>";
  html +=
    '<div style="margin-top:8px;font-size:9px;color:var(--text-muted);line-height:1.5;">სულ ' +
    total +
    " დასახლება. ქვემო ქართლის ოიკონიმების 60%-ზე მეტი ქართულია</div>";
  el.innerHTML = html;
}

function removeAllOikLayers() {
  if (oikLayer) {
    map.removeLayer(oikLayer);
    oikLayer = null;
  }
}

function removeAllEducationLayers() {
  if (eduMuniLayer) {
    map.removeLayer(eduMuniLayer);
    eduMuniLayer = null;
  }
  if (eduSchoolLayer) {
    map.removeLayer(eduSchoolLayer);
    eduSchoolLayer = null;
  }
  if (kgLayer) {
    map.removeLayer(kgLayer);
    kgLayer = null;
  }
  if (kgMarkerLayer) {
    map.removeLayer(kgMarkerLayer);
    kgMarkerLayer = null;
  }
  if (oikLayer) {
    map.removeLayer(oikLayer);
    oikLayer = null;
  }
}

// ===== განათლება checkbox =====
document
  .getElementById("chkEducation")
  .addEventListener("change", function (e) {
    if (e.target.checked) {
      document.getElementById("chkHealth").checked = false;
      document.getElementById("healthView").style.display = "none";
      removeAllHealthLayers();
      document.getElementById("mainLayerView").style.display = "none";
      document.getElementById("sublayerView").style.display = "none";
      document.getElementById("natureView").style.display = "none";
      document.getElementById("historyView").style.display = "none";
      document.getElementById("economyView").style.display = "none";
      document.getElementById("educationView").style.display = "";
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
      removeAllThematic();
      removeAllNatureLayers();
      removeAllHistoryLayers();
      removeAllEconomyLayers();
      removeNeutralLayers();
      document.querySelectorAll("[data-edusub]").forEach(function (b) {
        b.classList.remove("active");
      });
      document.querySelector("[data-edusub='schools']").classList.add("active");
      loadEducation();
    } else {
      document.getElementById("educationView").style.display = "none";
      document.getElementById("mainLayerView").style.display = "";
      removeAllEducationLayers();
      resetPopLegend();
      loadNeutralLayers();
    }
  });

document
  .getElementById("btnEducationBack")
  .addEventListener("click", function () {
    document.getElementById("chkEducation").checked = false;
    document.getElementById("educationView").style.display = "none";
    document.getElementById("mainLayerView").style.display = "";
    removeAllEducationLayers();
    resetChartPanel();
    document.getElementById("infoCard").classList.add("hidden");
    resetPopLegend();
    loadNeutralLayers();
  });

document.querySelectorAll("[data-edusub]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    document.querySelectorAll("[data-edusub]").forEach(function (b) {
      b.classList.remove("active");
    });
    this.classList.add("active");
    removeAllEducationLayers();
    document.getElementById("infoCard").classList.add("hidden");
    resetChartPanel();
    resetPopLegend();
    if (this.dataset.edusub === "schools") loadEducation();
    else if (this.dataset.edusub === "kindergarten") loadKindergarten();
    else if (this.dataset.edusub === "oikonymy") loadOikonymy();
  });
});

// ============================================================
// ჯანდაცვა და სოციალური მომსახურება
// ============================================================

// ============================================================
// ჯანდაცვა — ცვლადები
// ============================================================
var healthServicesData = null; // polygons (Medical_Services)
var healthClinicsData = null; // points (Outpatient_Clinics)
var healthPolyLayer = null;
var healthClinicLayer = null;
var activeHealthMetric = "doctors"; // 'doctors' | 'nurses' | 'outpatient'

// choropleth სტოპები — გამუქებული ფერები
var HEALTH_STOPS = {
  doctors: [
    [50, "#D4E8F5"],
    [150, "#8FC4E3"],
    [300, "#3E8BBE"],
    [500, "#1A5F8A"],
    [9999, "#0A3355"],
  ],
  nurses: [
    [50, "#D5EDD5"],
    [150, "#8FCC8F"],
    [300, "#3D9E3D"],
    [500, "#1F6B1F"],
    [9999, "#0D420D"],
  ],
  outpatient: [
    [10, "#FDE8D0"],
    [30, "#F9B97A"],
    [60, "#F07C2B"],
    [100, "#C45010"],
    [9999, "#8B2E00"],
  ],
};

var HEALTH_METRIC_LABELS = {
  doctors: "ექიმები (სტაციონარი)",
  nurses: "საექთმო (სტაციონარი)",
  outpatient: "ამბულატ. ვიზიტები",
};

var HEALTH_SERVICE_COLS = [
  { key: "Planned_an", label: "დაგეგმილი ამბ. მომსახ." },
  { key: "Planned__1", label: "დაგეგმილი სტაც. მომსახ." },
  { key: "Childbirth", label: "მეანობა / მშობიარობა" },
  { key: "Gynecologi", label: "გინეკოლოგია" },
  { key: "Oncologica", label: "ონკოლოგია" },
  { key: "Infectious", label: "ინფექციური დაავადებები" },
  { key: "Chemothera", label: "ქიმიოთერაპია" },
  { key: "Dialysis", label: "დიალიზი" },
  { key: "Ophthalmol", label: "ოფთალმოლოგია" },
  { key: "Immunizati", label: "იმუნიზაცია" },
  { key: "Emergency_", label: "სასწრაფო დახმარება" },
];

function getHealthColor(val, metric) {
  var stops = HEALTH_STOPS[metric];
  for (var i = 0; i < stops.length; i++) {
    if (val <= stops[i][0]) return stops[i][1];
  }
  return stops[stops.length - 1][1];
}

function loadHealth() {
  var loaded = 0;
  var total = (!healthServicesData ? 1 : 0) + (!healthClinicsData ? 1 : 0);
  function onLoaded() {
    loaded++;
    if (loaded >= total) {
      buildHealthLayers();
      loadNatureMuniCenters();
    }
  }
  if (!healthServicesData) {
    fetch("data/health_services.geojson")
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        healthServicesData = d;
        onLoaded();
      });
  }
  if (!healthClinicsData) {
    fetch("data/health_clinics.geojson")
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        healthClinicsData = d;
        onLoaded();
      });
  }
  if (healthServicesData && healthClinicsData) {
    buildHealthLayers();
    loadNatureMuniCenters();
  }
}

function buildHealthLayers() {
  if (healthPolyLayer) {
    map.removeLayer(healthPolyLayer);
    healthPolyLayer = null;
  }
  if (healthClinicLayer) {
    map.removeLayer(healthClinicLayer);
    healthClinicLayer = null;
  }
  if (!healthServicesData) return;
  var metric = activeHealthMetric;

  healthPolyLayer = L.geoJSON(healthServicesData, {
    style: function (feature) {
      var p = feature.properties;
      var val =
        metric === "doctors"
          ? p.Doctors || 0
          : metric === "nurses"
            ? p.Nurses || 0
            : p.Outpatient || 0;
      return {
        fillColor: getHealthColor(val, metric),
        fillOpacity: 0.8,
        color: "#5A4530",
        weight: 1.4,
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
        showInfoHealthPoly(p);
        showBottomChartHealth();
      });
    },
  }).addTo(map);

  if (healthClinicsData) {
    healthClinicLayer = L.geoJSON(healthClinicsData, {
      pointToLayer: function (feat, latlng) {
        var p = feat.properties;
        var sz = p.Type_Geo !== "სოფელი" ? 20 : 16;
        var svg =
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="' +
          sz +
          '" height="' +
          sz +
          '">' +
          '<circle cx="12" cy="12" r="10" fill="#C84B31" stroke="#fff" stroke-width="2"/>' +
          '<text x="12" y="16" text-anchor="middle" font-size="13" fill="#fff" font-weight="bold">+</text></svg>';
        var icon = L.divIcon({
          html: svg,
          iconSize: [sz, sz],
          iconAnchor: [sz / 2, sz / 2],
          className: "",
        });
        var marker = L.marker(latlng, { icon: icon });
        marker.bindTooltip(p.Name_Geo, {
          direction: "top",
          className: "village-label",
          offset: [0, -sz / 2 - 2],
        });
        marker.on("click", function () {
          showInfoHealthClinic(p);
        });
        return marker;
      },
    }).addTo(map);
  }

  updateHealthLegend();
  setInfoBtn("health_infra");
  if (muniBorderOverlay) muniBorderOverlay.bringToFront();
}

function showInfoHealthPoly(p) {
  var services = HEALTH_SERVICE_COLS.filter(function (s) {
    return p[s.key] === "კი";
  });
  var svcHtml = services
    .map(function (s) {
      return (
        '<span style="display:inline-block;background:#2B6A9A22;color:#2B6A9A;border:1px solid #2B6A9A66;' +
        'border-radius:8px;padding:1px 7px;font-size:9px;margin:2px 2px 0 0;">' +
        s.label +
        "</span>"
      );
    })
    .join("");
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;font-weight:700;">' +
    p.Name_Geo +
    "</div>" +
    '<span class="info-type-badge" style="background:#C84B3122;color:#C84B31;border:1px solid #C84B31;">საავადმყოფო / ჯანდაცვა</span>' +
    '<div style="margin-top:8px;font-size:11px;color:#444;line-height:2;">' +
    "<b>ექიმები (სტაც.):</b> " +
    (p.Doctors || "—") +
    "<br>" +
    "<b>საექთმო (სტაც.):</b> " +
    (p.Nurses || "—") +
    "<br>" +
    "<b>ამბ. ვიზიტები:</b> " +
    (p.Outpatient || "—") +
    "<br>" +
    "<b>ექიმები (ამბ.):</b> " +
    (p.Doctors_Ou || "—") +
    "<br>" +
    "<b>საექთმო (ამბ.):</b> " +
    (p.Nurses_Out || "—") +
    "</div>" +
    (svcHtml
      ? '<div style="margin-top:6px;font-size:9px;color:var(--text-muted);font-weight:700;margin-bottom:3px;">მომსახურების სახეები:</div>' +
        svcHtml
      : "");
  document.getElementById("infoCard").classList.remove("hidden");
}

function showInfoHealthClinic(p) {
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;font-weight:700;">' +
    p.Name_Geo +
    "</div>" +
    '<span class="info-type-badge" style="background:#C84B3122;color:#C84B31;border:1px solid #C84B31;">ამბულატ. კლინიკა</span>' +
    '<div style="margin-top:8px;font-size:11px;color:#444;line-height:1.9;">' +
    "<b>ტიპი:</b> " +
    (p.Type_Geo || "—") +
    "<br>" +
    "<b>მუნიციპ.:</b> " +
    (p.Municipal_ || "—") +
    "<br>" +
    "<b>ამბ. მომსახ.:</b> " +
    (p.Outpatient || "—") +
    "</div>";
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartHealth() {
  if (!healthServicesData) return;
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();
  var feats = healthServicesData.features.slice().sort(function (a, b) {
    return (b.properties.Doctors || 0) - (a.properties.Doctors || 0);
  });
  var labels = feats.map(function (f) {
    return f.properties.Name_Geo;
  });
  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "ექიმები (სტაც.)",
          data: feats.map(function (f) {
            return f.properties.Doctors || 0;
          }),
          backgroundColor: "#3E8BBECC",
          borderColor: "#1A5F8A",
          borderWidth: 1.5,
          borderRadius: 4,
          yAxisID: "y",
        },
        {
          label: "საექთმო (სტაც.)",
          data: feats.map(function (f) {
            return f.properties.Nurses || 0;
          }),
          backgroundColor: "#3D9E3DCC",
          borderColor: "#1F6B1F",
          borderWidth: 1.5,
          borderRadius: 4,
          yAxisID: "y",
        },
        {
          label: "ამბ. ვიზიტები",
          data: feats.map(function (f) {
            return f.properties.Outpatient || 0;
          }),
          backgroundColor: "#F07C2BCC",
          borderColor: "#C45010",
          borderWidth: 1.5,
          borderRadius: 4,
          yAxisID: "y1",
        },
      ],
    },
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
          text: "ჯანდაცვის პერსონალი და ამბ. ვიზიტები",
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: {
            label: function (c) {
              return " " + c.dataset.label + ": " + c.parsed.y.toLocaleString();
            },
          },
        },
      },
      scales: {
        y: {
          type: "linear",
          position: "left",
          beginAtZero: true,
          ticks: { font: { family: "Fira Sans", size: 9 } },
          title: { display: true, text: "პერსონალი", font: { size: 8 } },
        },
        y1: {
          type: "linear",
          position: "right",
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          ticks: { font: { family: "Fira Sans", size: 9 } },
          title: { display: true, text: "ამბ. ვიზ.", font: { size: 8 } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 9 }, maxRotation: 35 },
          grid: { display: false },
        },
      },
    },
  });
}

function updateHealthLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var metric = activeHealthMetric;
  var stops = HEALTH_STOPS[metric];
  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:7px;text-transform:uppercase;letter-spacing:.06em;">' +
    HEALTH_METRIC_LABELS[metric] +
    "</div>";
  html +=
    '<div style="display:flex;gap:3px;margin-bottom:9px;flex-wrap:wrap;">';
  ["doctors", "nurses", "outpatient"].forEach(function (m) {
    var a =
      m === metric
        ? "background:#1A5F8A;color:#fff;"
        : "background:#e4e0da;color:#555;";
    html +=
      "<button onclick=\"setHealthMetric('" +
      m +
      '\')" style="' +
      a +
      'border:none;border-radius:10px;padding:3px 8px;font-size:9px;cursor:pointer;font-family:Fira Sans,sans-serif;line-height:1.4;">' +
      HEALTH_METRIC_LABELS[m] +
      "</button>";
  });
  html += "</div>";
  var prev = 0;
  stops.forEach(function (s) {
    var to = s[0] >= 9999 ? ">" + prev : prev + "–" + s[0];
    html +=
      '<div style="display:flex;align-items:center;margin-bottom:4px;">' +
      '<span style="display:inline-block;width:18px;height:13px;border-radius:2px;background:' +
      s[1] +
      ';margin-right:7px;flex-shrink:0;border:1px solid rgba(0,0,0,.15);"></span>' +
      '<span style="font-size:10px;">' +
      to +
      "</span></div>";
    prev = s[0];
  });
  html +=
    '<div style="margin-top:10px;padding-top:8px;border-top:1px solid #ddd;">' +
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:5px;">ამბულატ. კლინიკები</div>' +
    '<div style="display:flex;align-items:center;gap:6px;">' +
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12"><circle cx="12" cy="12" r="10" fill="#C84B31" stroke="#fff" stroke-width="2"/><text x="12" y="16" text-anchor="middle" font-size="13" fill="#fff" font-weight="bold">+</text></svg>' +
    '<span style="font-size:10px;">დასახლება ამბ. კლინიკით</span></div></div>' +
    '<div style="margin-top:8px;font-size:9px;color:var(--text-muted);line-height:1.5;">ფართობზე დაჭ. — სრული სტატისტიკა</div>';
  el.innerHTML = html;
}

function setHealthMetric(metric) {
  activeHealthMetric = metric;
  buildHealthLayers();
}

function removeAllHealthLayers() {
  if (healthPolyLayer) {
    map.removeLayer(healthPolyLayer);
    healthPolyLayer = null;
  }
  if (healthClinicLayer) {
    map.removeLayer(healthClinicLayer);
    healthClinicLayer = null;
  }
}

// ===== ჯანდაცვა checkbox =====
document.getElementById("chkHealth").addEventListener("change", function (e) {
  if (e.target.checked) {
    document.getElementById("mainLayerView").style.display = "none";
    document.getElementById("sublayerView").style.display = "none";
    document.getElementById("natureView").style.display = "none";
    document.getElementById("historyView").style.display = "none";
    document.getElementById("economyView").style.display = "none";
    document.getElementById("educationView").style.display = "none";
    document.getElementById("healthView").style.display = "";
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
    removeAllThematic();
    removeAllNatureLayers();
    removeAllHistoryLayers();
    removeAllEconomyLayers();
    removeAllEducationLayers();
    removeAllHealthLayers();
    removeNeutralLayers();
    // პირველი sublayer ავტომატურად ჩაიტვირთება, როცა რუკა დაემატება
    var firstBtn = document.querySelector("[data-healthsub]");
    if (firstBtn) {
      document.querySelectorAll("[data-healthsub]").forEach(function (b) {
        b.classList.remove("active");
      });
      firstBtn.classList.add("active");
      firstBtn.click();
    } else {
      loadHealth();
    }
  } else {
    document.getElementById("healthView").style.display = "none";
    document.getElementById("mainLayerView").style.display = "";
    removeAllHealthLayers();
    resetPopLegend();
    loadNeutralLayers();
  }
});

// ===== ჯანდაცვა sublayer ღილაკები =====
document.querySelectorAll("[data-healthsub]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    document.querySelectorAll("[data-healthsub]").forEach(function (b) {
      b.classList.remove("active");
    });
    this.classList.add("active");
    document.getElementById("infoCard").classList.add("hidden");
    resetChartPanel();
    removeAllHealthLayers();
    removeAllSocialLayers();
    removeAllZooLayers();
    if (this.dataset.healthsub === "social") {
      loadSocial();
    } else if (this.dataset.healthsub === "zoo") {
      var _zk =
        activeZooKey === "anthrax_animals" || activeZooKey === "anthrax_humans"
          ? "zoo_anthrax"
          : "zoo_other";
      setInfoBtn(_zk);
      loadZoo(activeZooKey);
    } else {
      loadHealth();
    }
  });
});

document.getElementById("btnHealthBack").addEventListener("click", function () {
  document.getElementById("chkHealth").checked = false;
  document.getElementById("healthView").style.display = "none";
  document.getElementById("mainLayerView").style.display = "";
  removeAllHealthLayers();
  removeAllSocialLayers();
  removeAllZooLayers();
  document.getElementById("chartEmpty").style.display = "flex";
  document.getElementById("chartCanvas").classList.add("hidden");
  document.getElementById("infoCard").classList.add("hidden");
  resetPopLegend();
  loadNeutralLayers();
});

// ============================================================
// სოციალური დახმარება
// ============================================================
var socialData = null;
var socialLayer = null;
var activeSocialMetric = "registered";

var SOCIAL_STOPS = {
  registered: [
    [3000, "#FEE8D6"],
    [5000, "#FDBA8C"],
    [7000, "#F07C2B"],
    [9000, "#C45010"],
    [99999, "#7A2E00"],
  ],
  receiving: [
    [1500, "#EDE8F5"],
    [2500, "#C5B3E6"],
    [4000, "#8A63C8"],
    [5500, "#5C3699"],
    [99999, "#320D6D"],
  ],
  pension: [
    [5000, "#E8F4E8"],
    [10000, "#9ED09E"],
    [15000, "#4EA44E"],
    [20000, "#246E24"],
    [99999, "#0D420D"],
  ],
  social_pac: [
    [1000, "#FFF3D6"],
    [2000, "#FFD97A"],
    [3500, "#E8A800"],
    [5000, "#B07A00"],
    [99999, "#6B4800"],
  ],
};
var SOCIAL_METRIC_LABELS = {
  registered: "დარეგისტრ. ოჯახები",
  receiving: "მიმღები ოჯახები",
  pension: "პენსიის მიმღებნი",
  social_pac: "სოც. პაკეტის მიმღებნი",
};
function getSocialColor(val, metric) {
  var s = SOCIAL_STOPS[metric];
  for (var i = 0; i < s.length; i++) {
    if (val <= s[i][0]) return s[i][1];
  }
  return s[s.length - 1][1];
}
function loadSocial() {
  if (socialData) {
    buildSocialLayer();
    loadNatureMuniCenters();
    return;
  }
  fetch("data/social.geojson")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      socialData = d;
      buildSocialLayer();
      loadNatureMuniCenters();
    });
}
function buildSocialLayer() {
  if (socialLayer) {
    map.removeLayer(socialLayer);
    socialLayer = null;
  }
  if (!socialData) return;
  var metric = activeSocialMetric;
  socialLayer = L.geoJSON(socialData, {
    style: function (f) {
      var p = f.properties;
      var val =
        metric === "registered"
          ? p.Registered || 0
          : metric === "receiving"
            ? p.Receiving_ || 0
            : metric === "pension"
              ? p.Pension || 0
              : p.Social_Pac || 0;
      return {
        fillColor: getSocialColor(val, metric),
        fillOpacity: 0.82,
        color: "#5A4530",
        weight: 1.4,
        opacity: 0.9,
      };
    },
    onEachFeature: function (f, layer) {
      var p = f.properties;
      layer.bindTooltip(p.Name_Geo, {
        direction: "center",
        className: "village-label",
        sticky: true,
      });
      layer.on("click", function () {
        showInfoSocial(p);
        showBottomChartSocial();
      });
    },
  }).addTo(map);
  updateSocialLegend();
  setInfoBtn("social");
  if (muniBorderOverlay) muniBorderOverlay.bringToFront();
}
function showInfoSocial(p) {
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;font-weight:700;">' +
    p.Name_Geo +
    "</div>" +
    '<span class="info-type-badge" style="background:#8A63C822;color:#5C3699;border:1px solid #8A63C8;">სოციალური დახმარება</span>' +
    '<div style="margin-top:8px;font-size:11px;color:#444;line-height:2;">' +
    "<b>დარეგისტრ. ოჯახები:</b> " +
    (p.Registered || 0).toLocaleString() +
    "<br>" +
    "<b>მიმღები ოჯახები:</b> " +
    (p.Receiving_ || 0).toLocaleString() +
    "<br>" +
    "<b>პენსიის მიმღებნი:</b> " +
    (p.Pension || 0).toLocaleString() +
    "<br>" +
    "<b>სოც. პაკეტი:</b> " +
    (p.Social_Pac || 0).toLocaleString() +
    "</div>";
  document.getElementById("infoCard").classList.remove("hidden");
}
function showBottomChartSocial() {
  if (!socialData) return;
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();
  var feats = socialData.features.slice().sort(function (a, b) {
    return (b.properties.Registered || 0) - (a.properties.Registered || 0);
  });
  var labels = feats.map(function (f) {
    return f.properties.Name_Geo;
  });
  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "დარეგისტრ. ოჯახები",
          data: feats.map(function (f) {
            return f.properties.Registered || 0;
          }),
          backgroundColor: "#F07C2BCC",
          borderColor: "#C45010",
          borderWidth: 1.5,
          borderRadius: 4,
          yAxisID: "y",
        },
        {
          label: "მიმღები ოჯახები",
          data: feats.map(function (f) {
            return f.properties.Receiving_ || 0;
          }),
          backgroundColor: "#8A63C8CC",
          borderColor: "#5C3699",
          borderWidth: 1.5,
          borderRadius: 4,
          yAxisID: "y",
        },
        {
          label: "პენსიის მიმღებნი",
          data: feats.map(function (f) {
            return f.properties.Pension || 0;
          }),
          backgroundColor: "#4EA44ECC",
          borderColor: "#246E24",
          borderWidth: 1.5,
          borderRadius: 4,
          yAxisID: "y1",
        },
        {
          label: "სოც. პაკეტი",
          data: feats.map(function (f) {
            return f.properties.Social_Pac || 0;
          }),
          backgroundColor: "#E8A800CC",
          borderColor: "#B07A00",
          borderWidth: 1.5,
          borderRadius: 4,
          yAxisID: "y1",
        },
      ],
    },
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
          text: "სოციალური დახმარება მუნიციპალიტეტების მიხედვით",
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: {
            label: function (c) {
              return " " + c.dataset.label + ": " + c.parsed.y.toLocaleString();
            },
          },
        },
      },
      scales: {
        y: {
          type: "linear",
          position: "left",
          beginAtZero: true,
          ticks: { font: { family: "Fira Sans", size: 9 } },
          title: { display: true, text: "ოჯახები", font: { size: 8 } },
        },
        y1: {
          type: "linear",
          position: "right",
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          ticks: { font: { family: "Fira Sans", size: 9 } },
          title: { display: true, text: "პირები", font: { size: 8 } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 9 }, maxRotation: 35 },
          grid: { display: false },
        },
      },
    },
  });
}
function updateSocialLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var metric = activeSocialMetric,
    stops = SOCIAL_STOPS[metric];
  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:7px;text-transform:uppercase;letter-spacing:.06em;">' +
    SOCIAL_METRIC_LABELS[metric] +
    "</div>";
  html +=
    '<div style="display:flex;gap:3px;margin-bottom:9px;flex-wrap:wrap;">';
  ["registered", "receiving", "pension", "social_pac"].forEach(function (m) {
    var a =
      m === metric
        ? "background:#5C3699;color:#fff;"
        : "background:#e4e0da;color:#555;";
    html +=
      "<button onclick=\"setSocialMetric('" +
      m +
      '\')" style="' +
      a +
      'border:none;border-radius:10px;padding:3px 7px;font-size:9px;cursor:pointer;font-family:Fira Sans,sans-serif;line-height:1.4;">' +
      SOCIAL_METRIC_LABELS[m] +
      "</button>";
  });
  html += "</div>";
  var prev = 0;
  stops.forEach(function (s) {
    var to =
      s[0] >= 99999
        ? ">" + prev.toLocaleString()
        : prev.toLocaleString() + "–" + s[0].toLocaleString();
    html +=
      '<div style="display:flex;align-items:center;margin-bottom:4px;"><span style="display:inline-block;width:18px;height:13px;border-radius:2px;background:' +
      s[1] +
      ';margin-right:7px;flex-shrink:0;border:1px solid rgba(0,0,0,.15);"></span><span style="font-size:10px;">' +
      to +
      "</span></div>";
    prev = s[0];
  });
  html +=
    '<div style="margin-top:8px;font-size:9px;color:var(--text-muted);line-height:1.5;">მუნ. ფართობზე დაჭ. — სრული სტატ.</div>';
  el.innerHTML = html;
}
function setSocialMetric(metric) {
  activeSocialMetric = metric;
  buildSocialLayer();
}
function removeAllSocialLayers() {
  if (socialLayer) {
    map.removeLayer(socialLayer);
    socialLayer = null;
  }
}

// ============================================================
// ზოონოზოური დაავადებები
// ============================================================
var ZOO_LAYERS = [
  {
    key: "anthrax_all",
    file: "zoo_anthrax_all.geojson",
    label: "ჯილეხი (ყველა)",
    color: "#8B0000",
    countCol: null,
  },
  {
    key: "anthrax_animals",
    file: "zoo_anthrax_animals.geojson",
    label: "ჯილეხი — ცხოველები",
    color: "#CC2200",
    countCol: "Anthrax_An",
  },
  {
    key: "anthrax_humans",
    file: "zoo_anthrax_humans.geojson",
    label: "ჯილეხი — ადამიანები",
    color: "#FF6600",
    countCol: "Anthrax_Hu",
  },
  {
    key: "brucela_animals",
    file: "zoo_brucela_animals.geojson",
    label: "ბრუცელოზი — ცხოველები",
    color: "#005B8E",
    countCol: "Brucela_An",
  },
  {
    key: "brucela_humans",
    file: "zoo_brucela_humans.geojson",
    label: "ბრუცელოზი — ადამიანები",
    color: "#0099CC",
    countCol: "Brucela_Hu",
  },
  {
    key: "enceph_animals",
    file: "zoo_enceph_animals.geojson",
    label: "ენცეფალიტი — ცხოველები",
    color: "#5C3699",
    countCol: "Encepaliti",
  },
  {
    key: "enceph_humans",
    file: "zoo_enceph_humans.geojson",
    label: "ენცეფალიტი — ადამიანები",
    color: "#9B59B6",
    countCol: "Encepaliti",
  },
  {
    key: "leptospirosis",
    file: "zoo_leptospirosis.geojson",
    label: "ლეპტოსპიროზი",
    color: "#1A6B3C",
    countCol: "Leptospiro",
  },
  {
    key: "tularemia_animals",
    file: "zoo_tularemia_animals.geojson",
    label: "ტულარემია — ცხოველები",
    color: "#8B6914",
    countCol: "Tularemia_",
  },
  {
    key: "tularemia_humans",
    file: "zoo_tularemia_humans.geojson",
    label: "ტულარემია — ადამიანები",
    color: "#D4A017",
    countCol: "Tularemia_",
  },
];

var zooCache = {}; // key -> geojson data
var zooLeafLayers = {}; // key -> L.geoJSON layer
var activeZooKey = "anthrax_all";

function getZooCfg(key) {
  return ZOO_LAYERS.find(function (z) {
    return z.key === key;
  });
}

function loadZoo(key) {
  activeZooKey = key;
  if (zooCache[key]) {
    buildZooLayer(key, zooCache[key]);
    return;
  }
  var cfg = getZooCfg(key);
  fetch("data/" + cfg.file)
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      zooCache[key] = d;
      buildZooLayer(key, d);
    });
}

// range string "2-3" → საშ. მნიშვნელობა
function zooParseCount(raw) {
  if (
    raw === null ||
    raw === undefined ||
    raw === "" ||
    raw === "0" ||
    raw === 0
  )
    return 1;
  var s = String(raw).trim();
  var dash = s.indexOf("-");
  if (dash > 0) {
    var a = parseFloat(s.slice(0, dash)) || 0;
    var b = parseFloat(s.slice(dash + 1)) || a;
    return Math.round((a + b) / 2) || 1;
  }
  return parseFloat(s) || 1;
}

// მუნიც. სახელების ნორმ.
var ZOO_MUNI_MAP = {
  "გარდაბნის მუნიციპ": "გარდაბანი",
  "მარნეულის მუნიციპ": "მარნეული",
  "ბოლნისის მუნიციპა": "ბოლნისი",
  "დმანისის მუნიციპა": "დმანისი",
  "წალკის მუნიციპალი": "წალკა",
  "თეთრიწყაროს მუნიც": "თეთრიწყარო",
  "ქალაქ რუსთავის მუნ": "რუსთავი",
  "Gardabani Municipality": "გარდაბანი",
  "Marneuli Municipality": "მარნეული",
  "Bolnisi Municipality": "ბოლნისი",
  "Dmanisi Municipality": "დმანისი",
  "Tsalka Municipality": "წალკა",
  "Tetritskaro Municipality": "თეთრიწყარო",
  "Rustavi Municipality": "რუსთავი",
};
function zooNormMuni(raw) {
  if (!raw) return null;
  if (ZOO_MUNI_MAP[raw]) return ZOO_MUNI_MAP[raw];
  for (var k in ZOO_MUNI_MAP) {
    if (raw.indexOf(k) === 0) return ZOO_MUNI_MAP[k];
  }
  return raw;
}

var zooMuniLayer = null;

function buildZooLayer(key, data) {
  Object.keys(zooLeafLayers).forEach(function (k) {
    if (zooLeafLayers[k]) {
      map.removeLayer(zooLeafLayers[k]);
      delete zooLeafLayers[k];
    }
  });
  if (zooMuniLayer) {
    map.removeLayer(zooMuniLayer);
    zooMuniLayer = null;
  }
  var cfg = getZooCfg(key);

  // ---- 1. მუნიციპ. შეჯამება ----
  var MUNIS = [
    "გარდაბანი",
    "მარნეული",
    "ბოლნისი",
    "დმანისი",
    "წალკა",
    "თეთრიწყარო",
    "რუსთავი",
  ];
  var muniTotals = {};
  MUNIS.forEach(function (m) {
    muniTotals[m] = 0;
  });
  data.features.forEach(function (feat) {
    var p = feat.properties;
    var muni = zooNormMuni(p.Municipal_ || p.Municipal1 || "");
    var cnt = zooParseCount(cfg.countCol ? p[cfg.countCol] : 1);
    if (muni && muniTotals[muni] !== undefined) muniTotals[muni] += cnt;
  });
  var vals = MUNIS.map(function (m) {
    return muniTotals[m];
  }).filter(function (v) {
    return v > 0;
  });
  var maxV = vals.length ? Math.max.apply(null, vals) : 1;

  // ---- 2. Choropleth ----
  fetch("data/municipalities.geojson")
    .then(function (r) {
      return r.json();
    })
    .then(function (muniData) {
      zooMuniLayer = L.geoJSON(muniData, {
        style: function (feature) {
          var val = muniTotals[feature.properties.Name_Geo] || 0;
          var t = val / maxV;
          return {
            fillColor: cfg.color,
            fillOpacity: val > 0 ? 0.15 + t * 0.65 : 0,
            color: "#5A4530",
            weight: 1.2,
            opacity: 0.8,
          };
        },
        onEachFeature: function (feature, layer) {
          var name = feature.properties.Name_Geo;
          var total = muniTotals[name] || 0;
          layer.bindTooltip(name + ": " + total, {
            direction: "center",
            className: "village-label",
            sticky: true,
          });
          layer.on("click", function () {
            showInfoZooMuni(name, total, cfg, muniTotals);
            showBottomChartZoo(muniTotals, cfg);
          });
        },
      }).addTo(map);

      // ---- 3. წერტილები ----
      zooLeafLayers[key] = L.geoJSON(data, {
        pointToLayer: function (feat, latlng) {
          var p = feat.properties;
          var cnt = zooParseCount(cfg.countCol ? p[cfg.countCol] : 1);
          var r = Math.min(32, Math.max(16, 16 + cnt * 1.2));
          var fs = Math.max(9, Math.round(r * 0.38));
          var svg =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="' +
            r +
            '" height="' +
            r +
            '">' +
            '<circle cx="12" cy="12" r="10" fill="' +
            cfg.color +
            '" fill-opacity="0.85" stroke="#fff" stroke-width="2"/>' +
            (cnt > 1
              ? '<text x="12" y="16" text-anchor="middle" font-size="' +
                fs +
                '" fill="#fff" font-weight="bold">' +
                cnt +
                "</text>"
              : "") +
            "</svg>";
          var icon = L.divIcon({
            html: svg,
            iconSize: [r, r],
            iconAnchor: [r / 2, r / 2],
            className: "",
          });
          var marker = L.marker(latlng, { icon: icon });
          var name = p.Name_Geo || p.Municipal1 || p.Municipal_ || "";
          var muni = p.Municipal_ || p.Municipal1 || "";
          marker.bindTooltip(
            name + (muni && muni !== name ? " (" + muni + ")" : ""),
            {
              direction: "top",
              className: "village-label",
              offset: [0, -r / 2 - 2],
            },
          );
          marker.on("click", function () {
            showInfoZoo(p, cfg);
          });
          return marker;
        },
      }).addTo(map);

      updateZooLegend();
      if (muniBorderOverlay) muniBorderOverlay.bringToFront();
    });
}

function showInfoZooMuni(name, total, cfg, muniTotals) {
  var sorted = Object.entries(muniTotals).sort(function (a, b) {
    return b[1] - a[1];
  });
  var rank =
    sorted.findIndex(function (e) {
      return e[0] === name;
    }) + 1;
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;font-weight:700;">' +
    name +
    " (მუნიციპ.)</div>" +
    '<span class="info-type-badge" style="background:' +
    cfg.color +
    "22;color:" +
    cfg.color +
    ";border:1px solid " +
    cfg.color +
    '66;">' +
    cfg.label +
    "</span>" +
    '<div style="margin-top:8px;font-size:11px;color:#444;line-height:2;">' +
    '<b>შემთხვ. სულ:</b> <span style="font-size:15px;font-weight:700;color:' +
    cfg.color +
    ';"> ' +
    total +
    "</span><br>" +
    "<b>რანგი:</b> " +
    rank +
    "/" +
    sorted.length +
    "</div>" +
    '<div style="margin-top:6px;font-size:9px;color:var(--text-muted);">დეტ. — წერტილზე დაჭ.</div>';
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartZoo(muniTotals, cfg) {
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  var ctx = canvas.getContext("2d");
  if (bottomChart) bottomChart.destroy();
  var entries = Object.entries(muniTotals).sort(function (a, b) {
    return b[1] - a[1];
  });
  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: entries.map(function (e) {
        return e[0];
      }),
      datasets: [
        {
          label: cfg.label,
          data: entries.map(function (e) {
            return e[1];
          }),
          backgroundColor: cfg.color + "CC",
          borderColor: cfg.color,
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
          text: cfg.label + " — მუნ. მიხ.",
          font: { family: "Fira Sans", size: 11, weight: "600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: {
            label: function (c) {
              return " შემთხვ.: " + c.parsed.y;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { font: { family: "Fira Sans", size: 9 } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 9 }, maxRotation: 35 },
          grid: { display: false },
        },
      },
    },
  });
}

function showInfoZoo(p, cfg) {
  var name = p.Name_Geo || p.Municipal1 || p.Municipal_ || "—";
  var muni = p.Municipal_ || p.Municipal1 || "—";
  var cnt = cfg.countCol ? p[cfg.countCol] || "—" : "—";
  var range = p.Brucela__1 || p.Tularemia1 || p.Leptospi_1 || "";
  document.getElementById("infoCardContent").innerHTML =
    '<div class="info-name" style="font-size:13px;font-weight:700;">' +
    name +
    "</div>" +
    '<span class="info-type-badge" style="background:' +
    cfg.color +
    "22;color:" +
    cfg.color +
    ";border:1px solid " +
    cfg.color +
    '66;">' +
    cfg.label +
    "</span>" +
    '<div style="margin-top:8px;font-size:11px;color:#444;line-height:2;">' +
    "<b>მუნიციპ.:</b> " +
    muni +
    "<br>" +
    (p.Type_Geo ? "<b>ტიპი:</b> " + p.Type_Geo + "<br>" : "") +
    (cfg.countCol
      ? "<b>შემთხვევები:</b> " +
        cnt +
        (range
          ? ' <span style="color:#888;font-size:10px;">(' + range + ")</span>"
          : "") +
        "<br>"
      : "") +
    "<b>რეგიონი:</b> " +
    (p.Region_Geo || "ქვემო ქართლი") +
    "</div>";
  document.getElementById("infoCard").classList.remove("hidden");
}

function updateZooLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var cfg = getZooCfg(activeZooKey);

  // group buttons by disease
  var groups = [
    {
      label: "ჯილეხი",
      keys: ["anthrax_all", "anthrax_animals", "anthrax_humans"],
    },
    { label: "ბრუცელოზი", keys: ["brucela_animals", "brucela_humans"] },
    { label: "ენცეფალიტი", keys: ["enceph_animals", "enceph_humans"] },
    { label: "ლეპტოსპიროზი", keys: ["leptospirosis"] },
    { label: "ტულარემია", keys: ["tularemia_animals", "tularemia_humans"] },
  ];

  var html =
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">ზოონოზური დაავადებები</div>';
  groups.forEach(function (g) {
    html +=
      '<div style="font-size:9px;color:var(--text-muted);margin:6px 0 3px;font-weight:700;">' +
      g.label +
      "</div>";
    html +=
      '<div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:2px;">';
    g.keys.forEach(function (k) {
      var z = getZooCfg(k);
      var active = k === activeZooKey;
      var bg = active ? z.color : "#e4e0da";
      var col = active ? "#fff" : "#555";
      var shortLabel = z.label.replace(/^[^—]+—\s*/, "");
      if (z.key === "anthrax_all") shortLabel = "ყველა";
      if (z.key === "leptospirosis") shortLabel = "ადამ./ცხ.";
      html +=
        "<button onclick=\"switchZooLayer('" +
        k +
        '\')" style="background:' +
        bg +
        ";color:" +
        col +
        ';border:none;border-radius:10px;padding:3px 7px;font-size:9px;cursor:pointer;font-family:Fira Sans,sans-serif;line-height:1.4;">' +
        shortLabel +
        "</button>";
    });
    html += "</div>";
  });

  // symbol legend
  html +=
    '<div style="margin-top:10px;padding-top:8px;border-top:1px solid #ddd;">';
  html +=
    '<div style="font-size:9px;color:var(--text-muted);margin-bottom:5px;font-weight:700;">სიმბოლო</div>';
  html +=
    '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">' +
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12"><circle cx="12" cy="12" r="10" fill="' +
    cfg.color +
    '" fill-opacity="0.75" stroke="#fff" stroke-width="1.5"/></svg>' +
    '<span style="font-size:10px;">შემთხვევის ადგილი</span></div>';
  html +=
    '<div style="font-size:9px;color:var(--text-muted);line-height:1.4;margin-top:4px;">წრის ზომა ~ შემთხვევათა რაოდ. · დაჭ. — დეტალები</div>';
  html += "</div>";
  el.innerHTML = html;
}

function switchZooLayer(key) {
  activeZooKey = key;
  var _zk =
    key === "anthrax_animals" || key === "anthrax_humans"
      ? "zoo_anthrax"
      : "zoo_other";
  setInfoBtn(_zk);
  loadZoo(key);
}

function removeAllZooLayers() {
  Object.keys(zooLeafLayers).forEach(function (k) {
    if (zooLeafLayers[k]) {
      map.removeLayer(zooLeafLayers[k]);
      delete zooLeafLayers[k];
    }
  });
  if (zooMuniLayer) {
    map.removeLayer(zooMuniLayer);
    zooMuniLayer = null;
  }
}

function showMainView() {
  document.getElementById("mainLayerView").style.display = "";
  document.getElementById("sublayerView").style.display = "none";
  document.getElementById("natureView").style.display = "none";
  document.getElementById("historyView").style.display = "none";
  document.getElementById("economyView").style.display = "none";
  document.getElementById("educationView").style.display = "none";
  document.getElementById("healthView").style.display = "none";
  document.getElementById("filterSection").style.display = "none";
  document.getElementById("chkPopulation").checked = false;
  document.getElementById("chkNature").checked = false;
  document.getElementById("chkHistory").checked = false;
  document.getElementById("chkEconomy").checked = false;
  document.getElementById("chkEducation").checked = false;
  document.getElementById("chkHealth").checked = false;
  removeAllThematic();
  removeAllNatureLayers();
  removeAllHistoryLayers();
  removeAllEconomyLayers();
  removeAllEducationLayers();
  removeAllHealthLayers();
  removeAllSocialLayers();
  removeAllZooLayers();
  resetPopLegend();
  loadNeutralLayers();
  hideChartPanel();
  showSettlementLegend();
  setInfoBtn(null);
}

function showSublayerView() {
  document.getElementById("mainLayerView").style.display = "none";
  document.getElementById("sublayerView").style.display = "";
  // ნეიტრალური ფენები ვმალავთ
  removeNeutralLayers();
  // პირველი ქვე-ფენა ავტომატურად
  activeSublayer = "population";
  document
    .querySelectorAll(".sublayer-btn")
    .forEach((b) => b.classList.remove("active"));
  document
    .querySelector(".sublayer-btn[data-sublayer='population']")
    .classList.add("active");
  showChartPanel();
  resetChartPanel();
  switchSublayer("population");
}

document
  .getElementById("chkPopulation")
  .addEventListener("change", function (e) {
    if (e.target.checked) {
      showSublayerView();
    } else {
      showMainView();
    }
  });

// უკან ღილაკი
document.getElementById("btnBack").addEventListener("click", function () {
  showMainView();
});

// ===== Sublayer buttons =====
document.querySelectorAll(".sublayer-btn").forEach(function (btn) {
  btn.addEventListener("click", function () {
    document
      .querySelectorAll(".sublayer-btn")
      .forEach((b) => b.classList.remove("active"));
    this.classList.add("active");
    switchSublayer(this.dataset.sublayer);
  });
});

// ===== Type pills =====
document.querySelectorAll(".pill").forEach(function (btn) {
  btn.addEventListener("click", function () {
    document
      .querySelectorAll(".pill")
      .forEach((p) => p.classList.remove("active"));
    this.classList.add("active");
    activeType = this.dataset.type;
    if (activeSublayer === "population") applyFilters();
  });
});

// ===== Municipality select =====
document.getElementById("muniSelect").addEventListener("change", function () {
  activeMuni = this.value;
  if (activeSublayer === "population") applyFilters();
});

// ===== Basemap switcher =====
document.querySelectorAll(".basemap-item").forEach(function (item) {
  item.addEventListener("click", function () {
    var key = this.dataset.basemap;
    map.removeLayer(currentBasemap);
    currentBasemap = basemaps[key];
    currentBasemap.addTo(map);
    if (currentLayer) currentLayer.bringToFront();
    if (ethnicsLayer) ethnicsLayer.bringToFront();
    if (religionLayer) religionLayer.bringToFront();
    if (neutralBoundaryLayer) neutralBoundaryLayer.bringToFront();
    if (neutralLabelLayer) neutralLabelLayer.bringToFront();
    document
      .querySelectorAll(".basemap-item")
      .forEach((el) => el.classList.remove("active"));
    this.classList.add("active");
  });
});

// ===== Init =====
document.getElementById("mainLayerView").style.display = "";
document.getElementById("sublayerView").style.display = "none";
document.getElementById("natureView").style.display = "none";
document.getElementById("filterSection").style.display = "none";
document.getElementById("btnCensus").disabled = true;
document.getElementById("btnCensus").style.opacity = "0.45";
document.getElementById("btnCensus").style.cursor = "not-allowed";
document.getElementById("btnCensus").title = "ჯერ რუკაზე პუნქტი აირჩიეთ";
document.getElementById("historyView").style.display = "none";
document.getElementById("economyView").style.display = "none";
document.getElementById("educationView").style.display = "none";
document.getElementById("healthView").style.display = "none";
loadNeutralLayers();

// ===== Initialization =====
(function () {
  // ლეგენდა დამალული გვერდის ჩატვირთვისას
  hideSettlementLegend();
})();

// ============================================================
// 1. კოორდინატების ჩვენება
// ============================================================
map.on("mousemove", function (e) {
  var el = document.getElementById("mapCoordsText");
  if (!el) return;
  var lat = e.latlng.lat.toFixed(5);
  var lng = e.latlng.lng.toFixed(5);
  el.textContent = lat + ",  " + lng;
});
map.on("mouseout", function () {
  var el = document.getElementById("mapCoordsText");
  if (el) el.textContent = "—";
});

// ============================================================
// 2. ძიება
// ============================================================
var _searchData = null;
var _searchMarker = null;

function loadSearchData(cb) {
  if (_searchData) {
    cb(_searchData);
    return;
  }
  fetch("data/settlements.geojson")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      _searchData = d.features;
      cb(_searchData);
    });
}

(function () {
  var input = document.getElementById("mapSearchInput");
  var results = document.getElementById("mapSearchResults");
  var clearBtn = document.getElementById("mapSearchClear");
  if (!input) return;

  input.addEventListener("input", function () {
    var q = input.value.trim();
    clearBtn.style.display = q ? "block" : "none";
    if (q.length < 2) {
      results.style.display = "none";
      return;
    }
    loadSearchData(function (features) {
      var ql = q.toLowerCase();
      var matches = features
        .filter(function (f) {
          var p = f.properties;
          return (
            (p.Name_Geo && p.Name_Geo.toLowerCase().indexOf(ql) !== -1) ||
            (p.Name_Eng && p.Name_Eng.toLowerCase().indexOf(ql) !== -1)
          );
        })
        .slice(0, 8);
      if (!matches.length) {
        results.style.display = "none";
        return;
      }
      results.innerHTML = matches
        .map(function (f) {
          var p = f.properties;
          return (
            '<div class="search-result-item" data-lat="' +
            f.geometry.coordinates[1] +
            '" data-lng="' +
            f.geometry.coordinates[0] +
            '" data-name="' +
            p.Name_Geo +
            '">' +
            '<div><div class="search-result-name">' +
            p.Name_Geo +
            "</div>" +
            '<div class="search-result-sub">' +
            (p.Type_Geo || "") +
            " · " +
            (p.Municipal_ || "") +
            "</div></div>" +
            "</div>"
          );
        })
        .join("");
      results.style.display = "block";
      results.querySelectorAll(".search-result-item").forEach(function (el) {
        el.addEventListener("click", function () {
          var lat = parseFloat(el.dataset.lat);
          var lng = parseFloat(el.dataset.lng);
          var name = el.dataset.name;
          map.setView([lat, lng], 14, { animate: true });
          if (_searchMarker) map.removeLayer(_searchMarker);
          _searchMarker = L.circleMarker([lat, lng], {
            radius: 8,
            color: "#C8102E",
            fillColor: "#C8102E",
            fillOpacity: 0.8,
            weight: 2,
          })
            .addTo(map)
            .bindPopup("<b>" + name + "</b>")
            .openPopup();
          input.value = name;
          clearBtn.style.display = "block";
          results.style.display = "none";
        });
      });
    });
  });

  clearBtn.addEventListener("click", function () {
    input.value = "";
    clearBtn.style.display = "none";
    results.style.display = "none";
    if (_searchMarker) {
      map.removeLayer(_searchMarker);
      _searchMarker = null;
    }
  });

  document.addEventListener("click", function (e) {
    if (!document.getElementById("mapSearch").contains(e.target))
      results.style.display = "none";
  });
})();

// ============================================================
// 3. ბეჭდვა
// ============================================================
document.getElementById("btnPrint").addEventListener("click", function () {
  window.print();
});

// ============================================================
// 4. შედარება
// ============================================================
var _compareChart = null;
var MUNI_NAMES = [
  "ბოლნისი",
  "მარნეული",
  "დმანისი",
  "რუსთავი",
  "წალკა",
  "თეთრიწყარო",
  "გარდაბანი",
];

// Populate selects
["compareA", "compareB"].forEach(function (id, idx) {
  var sel = document.getElementById(id);
  MUNI_NAMES.forEach(function (name) {
    var opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  });
  sel.value = idx === 0 ? "ბოლნისი" : "მარნეული";
});

// Dataset sources — pull from existing data objects

// ============================================================
// 📱 Mobile panel toggles
// ============================================================
function initMobilePanels() {
  var leftBtn    = document.getElementById('mobLeftBtn');
  var rightBtn   = document.getElementById('mobRightBtn');
  var backdrop   = document.getElementById('mobBackdrop');
  var leftPanel  = document.getElementById('layerPanel');
  var rightPanel = document.getElementById('basemapPanel');

  if (!leftBtn || !rightBtn) return;

  function closeAll() {
    leftPanel.classList.remove('mob-open');
    rightPanel.classList.remove('mob-open');
    backdrop.classList.remove('visible');
  }

  leftBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    var isOpen = leftPanel.classList.contains('mob-open');
    closeAll();
    if (!isOpen) {
      leftPanel.classList.add('mob-open');
      backdrop.classList.add('visible');
    }
  });

  rightBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    var isOpen = rightPanel.classList.contains('mob-open');
    closeAll();
    if (!isOpen) {
      rightPanel.classList.add('mob-open');
      backdrop.classList.add('visible');
    }
  });

  backdrop.addEventListener('click', closeAll);

  document.querySelectorAll('.layer-item input[type="checkbox"]').forEach(function(cb) {
    cb.addEventListener('change', function() {
      if (window.innerWidth <= 768) setTimeout(closeAll, 300);
    });
  });
}

// Run after DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMobilePanels);
} else {
  initMobilePanels();
}
