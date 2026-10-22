// მოსახლეობა: დასახლებები, ეროვნება, აღმსარებლობა, სიმჭიდროვე, შობადობა/მოკვდავობა, ქორწინება, დევნილები, აღწერის ფანჯარა
// Part of the atlas script, split from the former js/main.js. Files are loaded in
// order by index.html; theme files only define things, their start-up code is
// in initPopulation(), called from app.js once every file is loaded.


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
  Georgian: "#F3819B",
  Azerbaijani: "#7BA03F",
  Armenian: "#F8971D",
  Others: "#90909E",
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
        color: MUNI_BORDER_COLOR,
        weight: MUNI_BORDER_WEIGHT,
        opacity: MUNI_BORDER_OPACITY,
        dashArray: MUNI_BORDER_DASH,
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
  Orthodox: "#7BADDD",
  Muslim: "#81C450",
  Armenian_A: "#F8995A",
  Other_Reli: "#C7C8CA",
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
        color: MUNI_BORDER_COLOR,
        weight: MUNI_BORDER_WEIGHT,
        opacity: MUNI_BORDER_OPACITY,
        dashArray: MUNI_BORDER_DASH,
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
  loadMuniData("data/muni/ethnics.json")
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
  loadMuniData("data/muni/religion.json")
    .then((r) => r.json())
    .then((data) => {
      religionData = data;
      buildReligionLayer(data);
      if (cb) cb();
    });
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
    loadMuniData("data/muni/idp_municipalities.json")
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
          ticks: { font: { family: "Fira Sans", size: 10, weight: "500" } },
          title: { display: true, text: "პირები", font: { size: 8 } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 11, weight: "500" }, maxRotation: 35 },
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
    '<div class="panel-btn-col">';
  ["natural", "armed"].forEach(function (m) {
    html +=
      '<button class="year-btn' +
      (m === metric ? " active" : "") +
      "\" onclick=\"setIDPMetric('" +
      m +
      "')\">" +
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
  if (sub === "population") {
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
  // მუნიც. ცენტრები ქოროპლეტურ რუკებზე (პუნსონებიან/დიაგრამიანზე — არა)
  var _muniSubs = ["density", "birth_rate", "death_rate", "religion", "ethnics"];
  if (_muniSubs.indexOf(sub) !== -1) loadNatureMuniCenters();
  else hideMuniCenters();
  setInfoBtn(_popInfoMap[sub] || null);
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
      return `<div class="eth-bar-row"><span class="eth-bar-label" style="width:104px;" title="${REL_LABELS[key]}">${REL_LABELS[key]}</span>
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
  loadMuniData("data/muni/density.json")
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
          ticks: { font: { family: "Fira Sans", size: 10, weight: "500" }, color: "#6B6862" },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 11, weight: "500" }, color: "#1A1A18" },
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
  hideMuniCenters();
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

// ქორწინების ტექსტი გენდერის მიხედვით იცვლება
var MARITAL_TEXTS = {
  men: "მოსახლეობის 2014 წლის აღწერის მიხედვით, ქორწინებაში მყოფი მამაკაცების რაოდენობა რეგიონში, 15 წლისა და უფროს ასაკში, ყოველ ათას მამაკაცზე, 686-ს შეადგენდა, რაც 27 ერთეულით აღემატებოდა 2002 წლის აღწერის მონაცემებს. ქვრივი მამაკაცების რაოდენობა არ შეცვლილა და 27-ის ტოლი იყო. 4 ერთეულით გაიზარდა განქორწინებულ/განშორებული მამაკაცების რაოდენობა, რომელმაც 19 მამაკაცი შეადგინა. 2014 წელს რეგიონში 28 ერთეულით მეტი მამაკაცი იმყოფებოდა ქორწინებაში, ვიდრე საქართველოში. ქვემო ქართლში ასევე შედარებით დაბალი იყო ქვრივი და განშორებულ/განქორწინებული მამაკაცების რაოდენობაც.",
  women: "2002-2014 წლების აღწერათა შორის პერიოდში, ქვემო ქართლში, 15 წლისა და უფროსი ასაკის ქორწინებაში მყოფი ქალების რაოდენობა, ყოველ ათას ქალზე, 610-დან 640-მდე გაიზარდა. ასევე გაიზარდა ქვრივებისა და განქორწინებულ/განშორებულთა რაოდენობაც. 2014 წლის მოსახლეობის აღწერის თანახმად, რეგიონში 54 ერთეულით მეტი ქალი იმყოფებოდა ქორწინებაში, ვიდრე საქართველოში. საშუალო რესპუბლიკურ მაჩვენებელთან შედარებით, მნიშვნელოვნად დაბალი იყო ქვრივი ქალების რაოდენობა, ხოლო განქორწინებულ/განშორებულთა მაჩვენებელი მცირედ (ერთი ერთეულით) ჩამორჩებოდა საქართველოში არსებულ დონეს.",
};

function syncMaritalInfoText() {
  if (typeof MAP_INFO === "undefined" || !MAP_INFO.marital) return;
  MAP_INFO.marital.text = MARITAL_TEXTS[maritalGender] || MARITAL_TEXTS.men;
  MAP_INFO.marital.title =
    "ქორწინებითი მდგომარეობა — " +
    (maritalGender === "women" ? "ქალები" : "მამაკაცები");
  // თუ ინფო-ფანჯარა ღიაა, მაშინვე განვაახლოთ
  if (typeof mapInfoVisible !== "undefined" && mapInfoVisible) {
    showMapInfo("marital");
  }
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
  // gender toggle — ერთ ფუნქციაში, რომ opacity/display ყოველთვის დაემთხვეს
  setMaritalGenderVisible();
  syncMaritalInfoText();
  updateMaritalLegend();
}

function setMaritalGenderVisible() {
  var showMen = maritalGender === "men";
  var showWomen = maritalGender === "women";
  function apply(layer, show) {
    if (!layer) return;
    layer.eachLayer(function (l) {
      if (l.setOpacity) l.setOpacity(show ? 1 : 0); // opacity აუცილებლად უნდა დაბრუნდეს
      var el = l.getElement();
      if (el) el.style.display = show ? "" : "none";
    });
  }
  apply(maritalMenLayer, showMen);
  apply(maritalWomenLayer, showWomen);
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
      syncMaritalInfoText();
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
      layout: { padding: { top: 18 } },
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
            font: { family: "Fira Sans", size: 10, weight: "500" },
            color: "#6B6862",
            callback: function (v) {
              return v + " ‰";
            },
          },
        },
        x: {
          ticks: {
            font: { family: "Fira Sans", size: 11, weight: "500" },
            color: "#1A1A18",
            maxRotation: 0,
          },
          grid: { display: false },
        },
      },
      // რიცხვები ბარების თავზე
    },
  });
}

// ===== Death Rate & Birth Rate helpers =====
var DEATH_COLORS = {
  "<9": "#FDECE7",
  "9-10": "#FBD3C4",
  "10.1-11": "#F7B39B",
  "11.1-12": "#EE8F73",
  "12.1-13": "#DB6B52",
  ">13.1": "#C24C3C",
};

var BIRTH_COLORS = {
  "<9.9": "#E4F3DE",
  "10-11.4": "#C6E5BC",
  "11.5-12.9": "#A2D496",
  "13.1-14.4": "#7BBF6E",
  ">14.5": "#57A44E",
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
  loadMuniData("data/muni/death_rate.json")
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
  loadMuniData("data/muni/birth_rate.json")
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
          ticks: { font: { family: "Fira Sans", size: 10, weight: "500" }, color: "#6B6862" },
        },
        x: {
          ticks: {
            font: { family: "Fira Sans", size: 11, weight: "500" },
            color: "#1A1A18",
          },
          grid: { display: false },
        },
      },
    },
  });
}

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
            font: { family: "Fira Sans", size: 10, weight: "500" },
            color: "#6B6862",
            callback: (v) => v.toLocaleString(),
          },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 11, weight: "500" }, color: "#1A1A18" },
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
      label:
        CENSUS_MUNI_NAMES[selectedProps.Municipal1] ||
        selectedProps.Municipal_ ||
        "მუნიციპ.",
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
            font: { family: "Fira Sans", size: 10, weight: "500" },
            color: "#6B6862",
            callback: (v) => v.toLocaleString(),
          },
        },
        x: {
          ticks: {
            font: { family: "Fira Sans", size: 11, weight: "500" },
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
  function rowHtml(name, p, cls) {
    return `<div class="census-table-row${cls ? " " + cls : ""}"><span>${name}</span><span>${fmt(p.Pop_1989)}</span><span>${fmt(p.Pop_2002)}</span><span>${fmt(p.Pop_2014)}</span>${chgCell(p.Pop_1989, p.Pop_2014)}</div>`;
  }

  // „რეგიონი სულ“: დასახლებების ნაცვლად 7 მუნიციპალიტეტი (დასახლებების ჯამი) + სულ
  if (censusScope === "all") {
    var byMuni = {};
    data.rows.forEach(function (p) {
      var name = CENSUS_MUNI_NAMES[p.Municipal1] || p.Municipal_ || "–";
      var m = byMuni[name] || (byMuni[name] = { Pop_1989: 0, Pop_2002: 0, Pop_2014: 0 });
      m.Pop_1989 += p.Pop_1989 || 0;
      m.Pop_2002 += p.Pop_2002 || 0;
      m.Pop_2014 += p.Pop_2014 || 0;
    });
    var munis = Object.keys(byMuni).sort(function (a, b) {
      return byMuni[b].Pop_2014 - byMuni[a].Pop_2014;
    });
    document.getElementById("censusTable").innerHTML =
      `<div class="census-table-row census-table-head"><span>მუნიციპალიტეტი</span><span>1989</span><span>2002</span><span>2014</span><span>ცვლ.</span></div>` +
      munis.map((n) => rowHtml(n, byMuni[n])).join("") +
      rowHtml(
        "სულ",
        { Pop_1989: data.pop89, Pop_2002: data.pop02, Pop_2014: data.pop14 },
        "census-table-total",
      );
    return;
  }

  var rows = data.rows
    .filter((p) => p.Pop_2014 || p.Pop_1989)
    .sort((a, b) => (b.Pop_2014 || 0) - (a.Pop_2014 || 0))
    .slice(0, 8);
  document.getElementById("censusTable").innerHTML =
    `<div class="census-table-row census-table-head"><span>დასახლება</span><span>1989</span><span>2002</span><span>2014</span><span>ცვლ.</span></div>` +
    rows.map((p) => rowHtml(p.Name_Geo || p.Name_Eng || "–", p)).join("");
}

// settlements.geojson-ის Municipal1 → მუნიციპალიტეტის ქართული სახელი
var CENSUS_MUNI_NAMES = {
  "Bolnisi Municipality": "ბოლნისი",
  "Marneuli Municipality": "მარნეული",
  "Dmanisi Municipality": "დმანისი",
  "Rustavi Municipality": "რუსთავი",
  "Tsalka Municipality": "წალკა",
  "Tetritskaro Municipality": "თეთრიწყარო",
  "Gardabani Municipality": "გარდაბანი",
};

function closeCensus() {
  document.getElementById("censusOverlay").classList.remove("active");
  document.getElementById("censusModal").classList.remove("active");
}

// ============================================================
// შედარება — census modal-ში ინტეგრირებული
// ============================================================
var _cmpMetric = "population";

var _cmpChart = null;

var _COMPARE_DENSITY = null,
  _COMPARE_BIRTH = null,
  _COMPARE_DEATH = null;

var _POP_DATA = {
  ბოლნისი: { p1989: 75800, p2002: 73000, p2014: 66200 },
  მარნეული: { p1989: 102000, p2002: 101000, p2014: 108700 },
  დმანისი: { p1989: 30600, p2002: 18600, p2014: 13900 },
  რუსთავი: { p1989: 159000, p2002: 116400, p2014: 122500 },
  წალკა: { p1989: 32600, p2002: 15800, p2014: 15100 },
  თეთრიწყარო: { p1989: 24900, p2002: 17600, p2014: 16500 },
  გარდაბანი: { p1989: 87900, p2002: 96200, p2014: 115600 },
};

var MUNI_NAMES = [
  "ბოლნისი",
  "მარნეული",
  "დმანისი",
  "რუსთავი",
  "წალკა",
  "თეთრიწყარო",
  "გარდაბანი",
];

function _midVal(s) {
  if (!s) return 0;
  s = String(s).replace(/>|</g, "").trim();
  var d = s.indexOf("-");
  if (d > 0) {
    var a = parseFloat(s) || 0,
      b = parseFloat(s.slice(d + 1)) || a;
    return (a + b) / 2;
  }
  return parseFloat(s) || 0;
}

function loadCmpData(cb) {
  var done = 0,
    need =
      (!_COMPARE_DENSITY ? 1 : 0) +
      (!_COMPARE_BIRTH ? 1 : 0) +
      (!_COMPARE_DEATH ? 1 : 0);
  if (need === 0) {
    cb();
    return;
  }
  function tick() {
    if (++done >= need) cb();
  }
  if (!_COMPARE_DENSITY) {
    loadMuniData("data/muni/density.json")
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        _COMPARE_DENSITY = {};
        d.features.forEach(function (f) {
          var p = f.properties;
          _COMPARE_DENSITY[p.Name_Geo] = {
            d1989: p.De_1989,
            d2002: p.De_2002,
            d2014: p.De_2014,
            d2024: p.De_2024,
          };
        });
        tick();
      });
  }
  if (!_COMPARE_BIRTH) {
    loadMuniData("data/muni/birth_rate.json")
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        _COMPARE_BIRTH = {};
        d.features.forEach(function (f) {
          var p = f.properties;
          _COMPARE_BIRTH[p.Name_Geo] = {
            b2012: p.Birth_2012,
            b2022: p.Birth_2022,
          };
        });
        tick();
      });
  }
  if (!_COMPARE_DEATH) {
    loadMuniData("data/muni/death_rate.json")
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        _COMPARE_DEATH = {};
        d.features.forEach(function (f) {
          var p = f.properties;
          _COMPARE_DEATH[p.Name_Geo] = {
            d2012: p.Death_2012,
            d2022: p.Death_2022,
          };
        });
        tick();
      });
  }
}

function initCmpSelectors() {
  ["cmpA", "cmpB"].forEach(function (id, idx) {
    var sel = document.getElementById(id);
    if (!sel) return;
    if (sel.options.length > 1) return;
    MUNI_NAMES.forEach(function (name) {
      var opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
    sel.value = idx === 0 ? "ბოლნისი" : "მარნეული";
  });
}

function renderCmpChart() {
  var nameA = document.getElementById("cmpA").value;
  var nameB = document.getElementById("cmpB").value;
  if (!nameA || !nameB) return;
  loadCmpData(function () {
    _doCmpChart(nameA, nameB);
  });
}

function _doCmpChart(nameA, nameB) {
  var m = _cmpMetric,
    labels,
    dataA,
    dataB,
    ylabel;
  if (m === "population") {
    labels = ["1989", "2002", "2014"];
    ylabel = "მოსახლ. (კაცი)";
    var pA = _POP_DATA[nameA] || {},
      pB = _POP_DATA[nameB] || {};
    dataA = [pA.p1989 || 0, pA.p2002 || 0, pA.p2014 || 0];
    dataB = [pB.p1989 || 0, pB.p2002 || 0, pB.p2014 || 0];
  } else if (m === "density") {
    labels = ["1989", "2002", "2014", "2024"];
    ylabel = "სიმჭ. (კაცი/კმ²)";
    var dA = (_COMPARE_DENSITY && _COMPARE_DENSITY[nameA]) || {};
    var dB = (_COMPARE_DENSITY && _COMPARE_DENSITY[nameB]) || {};
    dataA = [dA.d1989 || 0, dA.d2002 || 0, dA.d2014 || 0, dA.d2024 || 0];
    dataB = [dB.d1989 || 0, dB.d2002 || 0, dB.d2014 || 0, dB.d2024 || 0];
  } else if (m === "birth") {
    labels = ["2012", "2022"];
    ylabel = "შობ. კოეფ. (‰)";
    var bA = (_COMPARE_BIRTH && _COMPARE_BIRTH[nameA]) || {};
    var bB = (_COMPARE_BIRTH && _COMPARE_BIRTH[nameB]) || {};
    dataA = [_midVal(bA.b2012), _midVal(bA.b2022)];
    dataB = [_midVal(bB.b2012), _midVal(bB.b2022)];
  } else {
    labels = ["2012", "2022"];
    ylabel = "სიკვდ. კოეფ. (‰)";
    var deA = (_COMPARE_DEATH && _COMPARE_DEATH[nameA]) || {};
    var deB = (_COMPARE_DEATH && _COMPARE_DEATH[nameB]) || {};
    dataA = [_midVal(deA.d2012), _midVal(deA.d2022)];
    dataB = [_midVal(deB.d2012), _midVal(deB.d2022)];
  }
  var ctx = document.getElementById("cmpCanvas").getContext("2d");
  if (_cmpChart) _cmpChart.destroy();
  _cmpChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: nameA,
          data: dataA,
          backgroundColor: "#3E8BBE99",
          borderColor: "#1A5F8A",
          borderWidth: 1.5,
          borderRadius: 4,
        },
        {
          label: nameB,
          data: dataB,
          backgroundColor: "#E8621A99",
          borderColor: "#A83D08",
          borderWidth: 1.5,
          borderRadius: 4,
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
          labels: { font: { family: "Fira Sans", size: 10 }, boxWidth: 12 },
        },
        title: {
          display: true,
          text: nameA + " vs " + nameB,
          font: { family: "Fira Sans", size: 12, weight: "600" },
          color: "#1A1A18",
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { font: { family: "Fira Sans", size: 10, weight: "500" } },
          title: { display: true, text: ylabel, font: { size: 9 } },
        },
        x: {
          ticks: { font: { family: "Fira Sans", size: 11, weight: "500" }, maxRotation: 0 },
          grid: { display: false },
        },
      },
    },
  });
}

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

// ===== Start-up (called from app.js) =====
function initPopulation() {
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


  document.getElementById("infoClose").addEventListener("click", function () {
    document.getElementById("infoCard").classList.add("hidden");
  });


  document.getElementById("btnCensus").addEventListener("click", function () {
    document.getElementById("censusOverlay").classList.add("active");
    document.getElementById("censusModal").classList.add("active");
    renderCensusModal();
  });

  document.getElementById("censusClose").addEventListener("click", closeCensus);

  document.getElementById("censusOverlay").addEventListener("click", closeCensus);


  // Wire compare panel inside census modal
  document.querySelectorAll(".scope-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".scope-btn").forEach(function (b) {
        b.classList.remove("active");
      });
      this.classList.add("active");
      censusScope = this.dataset.scope;
      var isCompare = censusScope === "compare";
      document.getElementById("censusChartWrap").style.display = isCompare
        ? "none"
        : "block";
      document.getElementById("censusTable").style.display = isCompare
        ? "none"
        : "block";
      document.getElementById("censusComparePanel").style.display = isCompare
        ? "block"
        : "none";
      if (isCompare) {
        initCmpSelectors();
        renderCmpChart();
      } else {
        renderCensusModal();
      }
    });
  });


  document.querySelectorAll(".cmp-metric-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".cmp-metric-btn").forEach(function (b) {
        b.classList.remove("active");
      });
      this.classList.add("active");
      _cmpMetric = this.dataset.metric;
      renderCmpChart();
    });
  });


  document.getElementById("cmpA").addEventListener("change", renderCmpChart);

  document.getElementById("cmpB").addEventListener("change", renderCmpChart);
}
