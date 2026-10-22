// განათლება და კულტურა: სკოლები, სკოლამდელი აღზრდა, ოიკონიმია, ბიბლიოთეკები, მუზეუმები და თეატრები, სახელოვნებო დარგები
// Part of the atlas script, split from the former js/main.js. Files are loaded in
// order by index.html; theme files only define things, their start-up code is
// in initEducation(), called from app.js once every file is loaded.


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
  loadMuniData("data/muni/education.json")
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
  eduMuniLayer = clearLayer(eduMuniLayer);
  eduSchoolLayer = clearLayer(eduSchoolLayer);

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
      areaTooltip(layer, p.Name_Geo);
      layer.on("click", function () {
        showInfoEduMuni(p);
        showBottomChartEdu(data);
        highlightBottomBars(p.Name_Geo);
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
      pointTooltip(marker, p.Name_Geo, -sz / 2 - 2);
      marker.on("click", function () {
        showInfoEduSchool(p);
        showBottomChartEdu(data);
        highlightBottomBars(muniName(p.Municipal));
      });
      return marker;
    },
  }).addTo(map);

  updateEducationLegend();
  setInfoBtn("education");
}

function showInfoEduMuni(p) {
  showInfoCard('<div class="info-name" style="font-size:13px;font-weight:700;">' +
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
    "</div>");
}

function showInfoEduSchool(p) {
  var t =
    EDU_SCHOOL_TYPES.find(function (x) {
      return x.key === p.SchoolCat;
    }) || EDU_SCHOOL_TYPES[7];
  showInfoCard('<div class="info-name" style="font-size:13px;font-weight:700;">' +
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
    "</div>");
}

function showBottomChartEdu(data) {
  var ctx = prepareBottomChart();

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
            font: { size: 9 },
            boxWidth: 12,
            padding: 6,
          },
        },
        title: chartTitle("მოსწავლეები და მასწავლებლები მუნიციპალიტეტების მიხედვით"),
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
          ticks: { font: { size: 10, weight: "500" } },
          title: { display: true, text: "მოსწავლეები", font: { size: 8 } },
        },
        y1: {
          type: "linear",
          position: "right",
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          ticks: { font: { size: 10, weight: "500" } },
          title: { display: true, text: "მასწავლებლები", font: { size: 8 } },
        },
        x: {
          ticks: { font: { size: 11, weight: "500" }, maxRotation: 35 },
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
    '<div class="section-title">სკოლა და სწავლების ენა</div>';
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
    '<div class="section-note">მუნიციპალიტეტზე დაჭერით — სკოლების, მოსწავლეების და მასწავლებლების რაოდენობა</div>';
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
  loadNatureMuniCenters();
  if (kgData) {
    buildKgLayer(kgData);
    return;
  }
  loadMuniData("data/muni/kindergarten.json")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      kgData = d;
      buildKgLayer(d);
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
  kgLayer = clearLayer(kgLayer);
  kgMarkerLayer = clearLayer(kgMarkerLayer);

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
      areaTooltip(layer, p.Name_Geo);
      layer.on("click", function () {
        showInfoKg(p);
        showBottomChartKg(data);
        highlightBottomBars(p.Name_Geo);
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
    pointTooltip(m, p.Name_Geo, -size / 2 - 2);
    m.on("click", function () {
      showInfoKg(p);
      showBottomChartKg(data);
      highlightBottomBars(p.Name_Geo);
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
  showInfoCard('<div class="info-name" style="font-size:13px;font-weight:700;">' +
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
    "</div>");
}

function showBottomChartKg(data) {
  var ctx = prepareBottomChart();

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
            font: { size: 9 },
            boxWidth: 12,
            padding: 6,
          },
        },
        title: chartTitle("სკოლამდელი აღზრდა — აღსაზრდელები და აღმზრდელები (" + yr + ")"),
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
          ticks: { font: { size: 10, weight: "500" } },
          title: { display: true, text: "აღსაზრდელები", font: { size: 8 } },
        },
        y1: {
          type: "linear",
          position: "right",
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          ticks: { font: { size: 10, weight: "500" } },
          title: { display: true, text: "აღმზრდელები", font: { size: 8 } },
        },
        x: {
          ticks: { font: { size: 11, weight: "500" }, maxRotation: 35 },
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
    '<div class="section-title">საჯარო სკოლამდელი აღზრდა (' +
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
    '<div style="margin-top:12px;"><div class="section-title">სასწავლო წელი</div>';
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
  kgLayer = clearLayer(kgLayer);
  kgMarkerLayer = clearLayer(kgMarkerLayer);
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
  fetch(dataUrl("data/oikonymy.geojson"))
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
  clearLayer(oikLayer);
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
      pointTooltip(marker, p.Name_Geo, -r - 2);
      marker.on("click", function () {
        showInfoOik(p);
        showBottomChartOik(data);
        highlightBottomBars(muniName(p.Municipal));
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
  showInfoCard('<div class="info-name" style="font-size:13px;font-weight:700;">' +
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
    "</div>");
}

function showBottomChartOik(data) {
  var ctx = prepareBottomChart();

  // მუნიციპალიტეტების მიხედვით ქართული vs არაქართული
  var byMuni = {};
  data.features.forEach(function (f) {
    var m = muniName(f.properties.Municipal) || f.properties.Municipal || "";
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
            font: { size: 9 },
            boxWidth: 12,
            padding: 6,
          },
        },
        title: chartTitle("ქართული და არაქართული ოიკონიმები მუნიციპალიტეტების მიხედვით"),
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
          ticks: { font: { size: 10, weight: "500" } },
        },
        x: {
          stacked: true,
          ticks: { font: { size: 11, weight: "500" }, maxRotation: 35 },
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
    '<div class="section-title">ოიკონიმები (დასახლებათა სახელწოდებები)</div>';
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
    '<div class="section-note">სულ ' +
    total +
    " დასახლება. ქვემო ქართლის ოიკონიმების 60%-ზე მეტი ქართულია</div>";
  el.innerHTML = html;
}

function removeAllOikLayers() {
  oikLayer = clearLayer(oikLayer);
  libPolyLayer = clearLayer(libPolyLayer);
  if (libMarkLayer) {
    if (libMarkLayer.clearLayers) libMarkLayer.clearLayers();
    map.removeLayer(libMarkLayer);
    libMarkLayer = null;
  }
}

function removeAllEducationLayers() {
  eduMuniLayer = clearLayer(eduMuniLayer);
  eduSchoolLayer = clearLayer(eduSchoolLayer);
  kgLayer = clearLayer(kgLayer);
  kgMarkerLayer = clearLayer(kgMarkerLayer);
  oikLayer = clearLayer(oikLayer);
  libPolyLayer = clearLayer(libPolyLayer);
  if (libMarkLayer) {
    if (libMarkLayer.clearLayers) libMarkLayer.clearLayers();
    map.removeLayer(libMarkLayer);
    libMarkLayer = null;
  }
  tourismLayer = clearLayer(tourismLayer);
  artMuniLayer = clearLayer(artMuniLayer);
  artSettlementLayer = clearLayer(artSettlementLayer);
  artExpandedMarker = null;
  map.off("click", artMapClickCollapse);
}

function removeAllTourismLayers() {
  tcMuniLayer = clearLayer(tcMuniLayer);
  tcPointLayer = clearLayer(tcPointLayer);
  ttLayer = clearLayer(ttLayer);
  vitLayer = clearLayer(vitLayer);
  cellarLayer = clearLayer(cellarLayer);
  paLayer = clearLayer(paLayer);
  map.off("zoomend", updateTtLabels);
}

// ============================================================
// ბიბლიოთეკები
// ============================================================
var libData = null;

var libPolyLayer = null;

var libMarkLayer = null;

// წიგნების კლასები → ფერები
var LIB_BOOK_COLORS = {
  "200001-800000": "#DF6926",
  "100001-200000": "#FAAC67",
  "50001-100000": "#FDCB97",
  "< 50000": "#FFEBCC",
};

function getLibColor(booksStr) {
  if (!booksStr) return "#FFEBCC";
  var s = booksStr.replace(/\s/g, "");
  for (var k in LIB_BOOK_COLORS) {
    if (k.replace(/\s/g, "") === s) return LIB_BOOK_COLORS[k];
  }
  return "#FFEBCC";
}

function loadLibraries() {
  loadNatureMuniCenters();
  if (libData) {
    buildLibLayer(libData);
    return;
  }
  loadMuniData("data/muni/libraries.json")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      libData = d;
      buildLibLayer(d);
    });
}

// ბიბლიოთეკის სიმბოლო — წიგნების თარო (ზომა ბიბლიოთეკების რაოდენობის პროპორციულია)
function libraryShelfSVG(size) {
  var vb = 24;
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size +
    '" viewBox="0 0 ' + vb + ' ' + vb + '">' +
    '<rect x="0.8" y="0.8" width="22.4" height="22.4" rx="2.5" fill="#F3EEF8" stroke="#5A3E8A" stroke-width="1.6"/>' +
    // ზედა თარო — წიგნები
    '<rect x="4"   y="4.2" width="2.6" height="7.2" fill="#5A3E8A"/>' +
    '<rect x="7.2" y="5.4" width="2.6" height="6"   fill="#8B6BB1"/>' +
    '<rect x="10.4" y="4.2" width="2.6" height="7.2" fill="#5A3E8A"/>' +
    '<rect x="13.6" y="5.8" width="2.6" height="5.6" fill="#8B6BB1"/>' +
    '<path d="M17.2 11.4 V6.2 l2.8 -1 v5.2 z" fill="#5A3E8A"/>' +
    '<rect x="3.4" y="11.4" width="17.2" height="1.3" fill="#5A3E8A"/>' +
    // ქვედა თარო — წიგნები
    '<rect x="4"   y="13.6" width="2.6" height="5.6" fill="#8B6BB1"/>' +
    '<rect x="7.2" y="12.9" width="2.6" height="6.3" fill="#5A3E8A"/>' +
    '<rect x="10.4" y="14.2" width="2.6" height="5"   fill="#8B6BB1"/>' +
    '<rect x="13.6" y="12.9" width="2.6" height="6.3" fill="#5A3E8A"/>' +
    '<rect x="16.8" y="14.2" width="2.6" height="5"   fill="#8B6BB1"/>' +
    '<rect x="3.4" y="19.2" width="17.2" height="1.3" fill="#5A3E8A"/>' +
    "</svg>"
  );
}

function buildLibLayer(data) {
  libPolyLayer = clearLayer(libPolyLayer);
  if (libMarkLayer) {
    if (libMarkLayer.clearLayers) libMarkLayer.clearLayers();
    map.removeLayer(libMarkLayer);
    libMarkLayer = null;
  }

  // ---- Choropleth — წიგნების რაოდ. ----
  libPolyLayer = L.geoJSON(data, {
    style: function (f) {
      return {
        fillColor: getLibColor(f.properties.Books_in_L),
        fillOpacity: 0.75,
        color: "transparent",
        weight: 0,
        opacity: 0,
      };
    },
    onEachFeature: function (f, layer) {
      var p = f.properties;
      areaTooltip(layer, p.Name_Geo);
      layer.on("click", function () {
        showInfoLibrary(p);
        showBottomChartLibrary(data);
        highlightBottomBars(p.Name_Geo);
      });
    },
  }).addTo(map);

  // ---- Proportional squares — ბიბლ. რაოდ. ----
  libMarkLayer = L.layerGroup().addTo(map);

  data.features.forEach(function (f) {
    var p = f.properties;
    var cnt = parseFloat(p.Libreries) || 0;
    if (cnt <= 0) return;
    var coords = f.geometry.coordinates[0];
    var lats = coords.map(function (c) { return c[1]; });
    var lngs = coords.map(function (c) { return c[0]; });
    var lat = (Math.min.apply(null, lats) + Math.max.apply(null, lats)) / 2;
    var lng = (Math.min.apply(null, lngs) + Math.max.apply(null, lngs)) / 2;
    var size = Math.round(14 + cnt * 1.6);
    var svg = libraryShelfSVG(size);
    var icon = L.divIcon({ html: svg, iconSize: [size, size], iconAnchor: [size/2, size/2], className: "" });
    var marker = L.marker([lat, lng], { icon: icon });
    pointTooltip(marker, p.Name_Geo + ": " + cnt + " ბიბლ.");
    marker.on("click", function () {
      showInfoLibrary(p);
      showBottomChartLibrary(data);
      highlightBottomBars(p.Name_Geo);
    });
    libMarkLayer.addLayer(marker);
  });

  updateLibLegend();
  if (muniBorderOverlay) muniBorderOverlay.bringToFront();
}

function showInfoLibrary(p) {
  showInfoCard('<div class="info-name" style="font-size:13px;font-weight:700;">' +
    p.Name_Geo +
    "</div>" +
    '<span class="info-type-badge" style="background:#5A3E8A22;color:#5A3E8A;border:1px solid #5A3E8A;">ბიბლიოთეკები</span>' +
    '<div style="margin-top:8px;font-size:11px;color:#444;line-height:2;">' +
    "<b>ბიბლიოთეკები:</b> " +
    (p.Libreries || "—") +
    "<br>" +
    "<b>წიგნების რაოდ.:</b> " +
    (p.Books_in_L || "—") +
    "</div>");
}

function showBottomChartLibrary(data) {
  var ctx = prepareBottomChart();
  var feats = data.features.slice().sort(function (a, b) {
    return (
      (parseFloat(b.properties.Libreries) || 0) -
      (parseFloat(a.properties.Libreries) || 0)
    );
  });
  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: feats.map(function (f) {
        return f.properties.Name_Geo;
      }),
      datasets: [
        {
          label: "ბიბლიოთეკები",
          data: feats.map(function (f) {
            return parseFloat(f.properties.Libreries) || 0;
          }),
          backgroundColor: "#5A3E8ACC",
          borderColor: "#3A1E6A",
          borderWidth: 1.5,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: chartTitle("ბიბლიოთეკები მუნ. მიხედვით"),
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { font: { size: 10, weight: "500" } },
        },
        x: {
          ticks: { font: { size: 11, weight: "500" }, maxRotation: 35 },
          grid: { display: false },
        },
      },
    },
  });
}

function updateLibLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div class="section-title">წიგნების რაოდ. მუნ-ში</div>';
  var classes = [
    { label: "200 001 – 800 000", color: "#DF6926" },
    { label: "100 001 – 200 000", color: "#FAAC67" },
    { label: "50 001 – 100 000", color: "#FDCB97" },
    { label: "< 50 000", color: "#FFEBCC" },
  ];
  classes.forEach(function (c) {
    html +=
      '<div style="display:flex;align-items:center;margin-bottom:5px;">' +
      '<span style="display:inline-block;width:18px;height:13px;border-radius:2px;background:' +
      c.color +
      ';margin-right:7px;flex-shrink:0;border:1px solid rgba(0,0,0,.15);"></span>' +
      '<span style="font-size:10px;">' +
      c.label +
      "</span></div>";
  });
  html +=
    '<div style="margin-top:10px;padding-top:8px;border-top:1px solid #ddd;">' +
    '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:5px;">ბიბლიოთეკების რაოდ.</div>' +
    '<div style="display:flex;align-items:center;gap:6px;">' +
    libraryShelfSVG(20) +
    '<span style="font-size:10px;margin-left:6px;">სიმბოლოს ზომა — ბიბლიოთეკების რაოდენობა</span></div></div>' +
    '<div class="section-note">მუნ-ზე დაჭ. — სრული სტატ.</div>';
  el.innerHTML = html;
  setInfoBtn("libraries");
}

// ============================================================
// მუზეუმები და თეატრები
// ============================================================
var tourismData = null;

var tourismLayer = null;

// მუზეუმის ტიპები → სიმბოლოები (ბეჭდური ატლასის სტილში)
var TOURISM_TYPES = [
  {
    key: "historic_arch",
    color: "#E8621A",
    chartLabel: ["ისტორიულ-", "არქიტექტ."],
    match: "ისტორიულ-არქიტექტურული",
    label: "ისტორიულ-არქიტექტურული მუზეუმი",
    svg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17.26 16.75"><defs><style>.cls-1{fill:#fdcc97;}.cls-2,.cls-3{fill:none;stroke:#231f20;}.cls-2{stroke-width:0.5px;}.cls-3{stroke-linecap:round;stroke-linejoin:round;}</style></defs><rect class="cls-1" x="0.25" y="0.25" width="16.76" height="16.25"/><rect class="cls-2" x="0.25" y="0.25" width="16.76" height="16.25"/><path class="cls-3" d="M15.6,6.36A.87.87,0,0,0,15,6.13a1,1,0,0,0-1.07,1,1.37,1.37,0,0,0,1.4,1.27h0a1.74,1.74,0,0,0,1.82-1.64,2.23,2.23,0,0,0-2.33-2.1H5.67a2.23,2.23,0,0,0-2.33,2.1A1.74,1.74,0,0,0,5.16,8.37,1.37,1.37,0,0,0,6.56,7.1a1,1,0,0,0-1.07-1,.88.88,0,0,0-.62.26" transform="translate(-1.62 -1.85)"/><line class="cls-3" x1="6.26" y1="5.9" x2="11" y2="5.89"/><line class="cls-3" x1="5.92" y1="7.62" x2="5.92" y2="13.98"/><line class="cls-3" x1="8.51" y1="7.62" x2="8.51" y2="13.98"/><line class="cls-3" x1="11.1" y1="7.62" x2="11.1" y2="13.98"/></svg>',
  },
  {
    key: "historic_ethno",
    color: "#B5651D",
    chartLabel: ["ისტორიულ-", "ეთნოგრაფ."],
    match: "ისტორიულ-ეთნოგრაფიული",
    label: "ისტორიულ-ეთნოგრაფიული მუზეუმი",
    svg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16.93 16.67"><defs><style>.cls-1{fill:#fdcc97;}.cls-2,.cls-4{fill:none;stroke:#231f20;}.cls-2{stroke-width:0.5px;}.cls-3{fill:#231f20;}.cls-4{stroke-width:0.2px;}</style></defs><rect class="cls-1" x="0.25" y="0.25" width="16.43" height="16.17"/><rect class="cls-2" x="0.25" y="0.25" width="16.43" height="16.17"/><rect class="cls-3" x="2.09" y="6" width="2.05" height="6.72"/><rect class="cls-3" x="12.7" y="5.88" width="2.05" height="6.72"/><rect class="cls-3" x="1.2" y="13.32" width="14.51" height="1.1"/><polygon class="cls-3" points="8.47 1.45 15.97 5.38 0.96 5.38 8.47 1.45"/><path class="cls-3" d="M7.37,12a1.63,1.63,0,0,1,2.9-.92c-.42-2.25-3.8-1.1-2.9.92" transform="translate(-1.78 -1.89)"/><path class="cls-4" d="M7.37,12a1.63,1.63,0,0,1,2.9-.92C9.85,8.82,6.47,10,7.37,12Z" transform="translate(-1.78 -1.89)"/><path class="cls-3" d="M8.51,8.6a1.63,1.63,0,0,1,1.78,2.47c2-1.11-.15-4-1.78-2.47" transform="translate(-1.78 -1.89)"/><path class="cls-4" d="M8.51,8.6a1.63,1.63,0,0,1,1.78,2.47C12.29,10,10.14,7.11,8.51,8.6Z" transform="translate(-1.78 -1.89)"/><path class="cls-3" d="M12.12,8.65a1.63,1.63,0,0,1-1.83,2.43c1.64,1.59,3.73-1.3,1.83-2.43" transform="translate(-1.78 -1.89)"/><path class="cls-4" d="M12.12,8.65a1.63,1.63,0,0,1-1.83,2.43C11.93,12.67,14,9.78,12.12,8.65Z" transform="translate(-1.78 -1.89)"/><path class="cls-3" d="M13.19,12a1.63,1.63,0,0,1-2.91-.89c-.92,2.09,2.51,3.06,2.91.89" transform="translate(-1.78 -1.89)"/><path class="cls-4" d="M13.19,12a1.63,1.63,0,0,1-2.91-.89C9.36,13.17,12.79,14.14,13.19,12Z" transform="translate(-1.78 -1.89)"/><path class="cls-3" d="M10.26,14.12a1.63,1.63,0,0,1,0-3c-2.27-.29-2.21,3.28,0,3" transform="translate(-1.78 -1.89)"/><path class="cls-4" d="M10.26,14.12a1.63,1.63,0,0,1,0-3C8,10.79,8.07,14.36,10.26,14.12Z" transform="translate(-1.78 -1.89)"/></svg>',
  },
  {
    key: "local_lore",
    color: "#F0A04B",
    chartLabel: ["მხარეთმცო-", "დნეობის"],
    match: "მხარეთმცოდნეობის",
    label: "მხარეთმცოდნეობის მუზეუმი",
    svg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17.14 16.6"><defs><style>.cls-1{fill:#fdcc97;}.cls-2,.cls-3{fill:none;stroke:#231f20;stroke-width:0.5px;}.cls-3{stroke-miterlimit:10;}</style></defs><rect class="cls-1" x="0.25" y="0.25" width="16.64" height="16.1"/><rect class="cls-2" x="0.25" y="0.25" width="16.64" height="16.1"/><rect class="cls-2" x="2.15" y="6.16" width="2.08" height="6.69"/><rect class="cls-2" x="12.88" y="6.16" width="2.08" height="6.69"/><rect class="cls-2" x="1.24" y="13.67" width="14.68" height="1.1"/><polygon class="cls-2" points="8.6 1.41 16.2 5.33 1.01 5.33 8.6 1.41"/><polygon class="cls-3" points="5.86 12.31 5.86 6.89 6.89 6.89 8.57 9.85 10.3 6.89 11.28 6.89 11.28 12.31 10.22 12.31 10.22 9.26 8.68 12.06 8.53 12.06 6.91 9.26 6.91 12.31 5.86 12.31"/></svg>',
  },
  {
    key: "multi",
    color: "#8B4513",
    chartLabel: ["მრავალპრო-", "ფილური"],
    match: "მრავალპროფილური",
    label: "მრავალპროფილური მუზეუმი",
    svg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 19.52 19.52"><defs><style>.cls-1{fill:#fdcc97;}.cls-2{fill:none;stroke:#231f20;stroke-width:0.5px;}.cls-3{fill:#231f20;}</style></defs><path class="cls-1" d="M19.76,10.23A9.51,9.51,0,1,1,10.25.72a9.51,9.51,0,0,1,9.51,9.51" transform="translate(-0.49 -0.47)"/><path class="cls-2" d="M19.76,10.23A9.51,9.51,0,1,1,10.25.72,9.51,9.51,0,0,1,19.76,10.23Z" transform="translate(-0.49 -0.47)"/><polygon class="cls-3" points="7 12.73 7 7.06 8.06 7.06 9.79 10.16 11.57 7.06 12.57 7.06 12.57 12.73 11.49 12.73 11.49 9.54 9.9 12.47 9.74 12.47 8.08 9.54 8.08 12.73 7 12.73"/><rect class="cls-3" x="3.45" y="6.45" width="2.05" height="6.72"/><rect class="cls-3" x="14.07" y="6.45" width="2.05" height="6.72"/><rect class="cls-3" x="2.55" y="13.76" width="14.51" height="1.1"/><polygon class="cls-3" points="9.82 1.89 17.33 5.83 2.32 5.83 9.82 1.89"/></svg>',
  },
  {
    key: "exhibition",
    color: "#D9A441",
    chartLabel: ["საგამოფენო", "დარბაზი"],
    match: "საგამოფენო",
    label: "საგამოფენო დარბაზი",
    svg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17.14 16.6"><defs><style>.cls-1{fill:#fdcc97;}.cls-2,.cls-4{fill:none;stroke:#231f20;}.cls-2{stroke-width:0.5px;}.cls-3{fill:#231f20;}.cls-4{stroke-width:0.8px;}</style></defs><rect class="cls-1" x="0.25" y="0.25" width="16.64" height="16.1"/><rect class="cls-2" x="0.25" y="0.25" width="16.64" height="16.1"/><rect class="cls-1" x="3.38" y="4.66" width="10.38" height="9.6"/><rect class="cls-2" x="3.38" y="4.66" width="10.38" height="9.6"/><rect class="cls-3" x="5.6" y="8.78" width="0.96" height="3.07"/><rect class="cls-3" x="8.09" y="8.78" width="0.96" height="3.07"/><rect class="cls-3" x="10.53" y="8.78" width="0.96" height="3.07"/><polygon class="cls-3" points="8.57 6.15 12.41 8.13 4.72 8.13 8.57 6.15"/><line class="cls-2" x1="1.2" y1="1.99" x2="15.94" y2="1.99"/><line class="cls-2" x1="12.51" y1="2.04" x2="12.51" y2="4.63"/><line class="cls-2" x1="4.61" y1="2.04" x2="4.61" y2="4.63"/><line class="cls-4" x1="4.93" y1="12.72" x2="12.21" y2="12.72"/></svg>',
  },
  {
    key: "biography",
    color: "#C0553B",
    chartLabel: ["ბიოგრა-", "ფიული"],
    match: "ბიოგრაფიული",
    label: "ბიოგრაფიული მუზეუმი",
    svg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 13.02 16.75"><defs><style>.cls-1{fill:#fdcc97;}.cls-2{fill:none;stroke:#231f20;stroke-width:0.5px;}.cls-3{fill:#231f20;}</style></defs><rect class="cls-1" x="0.25" y="0.25" width="12.52" height="16.25"/><rect class="cls-2" x="0.25" y="0.25" width="12.52" height="16.25"/><path class="cls-3" d="M10.07,8a1.94,1.94,0,0,1-2-1.9,2,2,0,0,1,4,0,1.94,1.94,0,0,1-2,1.9" transform="translate(-3.74 -1.85)"/><path class="cls-3" d="M13.56,16.22V12a3,3,0,0,0-3-3H9.92a3,3,0,0,0-3,3v4.2Z" transform="translate(-3.74 -1.85)"/></svg>',
  },
  {
    key: "historic",
    color: "#7A4E2D",
    chartLabel: ["ისტორიული"],
    match: "ისტორიული",
    label: "ისტორიული მუზეუმი",
    svg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16.93 16.67"><defs><style>.cls-1{fill:#fdcc97;}.cls-2,.cls-3{fill:none;stroke:#231f20;}.cls-2{stroke-width:0.5px;}.cls-3{stroke-width:0.7px;}.cls-4{fill:#231f20;}</style></defs><rect class="cls-1" x="0.25" y="0.25" width="16.43" height="16.17"/><rect class="cls-2" x="0.25" y="0.25" width="16.43" height="16.17"/><polygon class="cls-3" points="5.64 12.29 5.64 6.62 6.7 6.62 8.43 9.72 10.21 6.62 11.21 6.62 11.21 12.29 10.13 12.29 10.13 9.1 8.54 12.03 8.38 12.03 6.72 9.1 6.72 12.29 5.64 12.29"/><rect class="cls-4" x="2.09" y="6" width="2.05" height="6.72"/><rect class="cls-4" x="12.71" y="6" width="2.05" height="6.72"/><rect class="cls-4" x="1.19" y="13.32" width="14.51" height="1.1"/><polygon class="cls-4" points="8.46 1.45 15.97 5.38 0.96 5.38 8.46 1.45"/></svg>',
  },
];

// თეატრის აღმნიშვნელი მცირე ბეჯი (თანდართული ობიექტი — ისტორიული მუზეუმი, საგამოფენო დარბაზი)
var TOURISM_THEATER_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17.35 16.34"><defs><style>.cls-1{fill:#fdcc97;}.cls-2{fill:none;stroke:#231f20;stroke-width:0.5px;}.cls-3{fill:#010101;}</style></defs><rect class="cls-1" x="0.25" y="0.25" width="16.85" height="15.85"/><rect class="cls-2" x="0.25" y="0.25" width="16.85" height="15.84"/><path class="cls-3" d="M10.25,16.91a4.86,4.86,0,0,1-2.53-.72,6.72,6.72,0,0,1-2-1.92,9.39,9.39,0,0,1-1.35-2.81A11.81,11.81,0,0,1,3.83,8a11.65,11.65,0,0,1,.81-4.32.23.23,0,0,1,.15-.14.2.2,0,0,1,.2,0A10.85,10.85,0,0,0,10.25,4.9a10.85,10.85,0,0,0,5.26-1.31.2.2,0,0,1,.2,0,.23.23,0,0,1,.15.14A11.65,11.65,0,0,1,16.67,8a11.81,11.81,0,0,1-.5,3.43,9.63,9.63,0,0,1-1.35,2.81,6.72,6.72,0,0,1-2,1.92,4.86,4.86,0,0,1-2.53.72M5,4.16A11.24,11.24,0,0,0,4.33,8c0,4.62,2.65,8.38,5.92,8.38S16.17,12.65,16.17,8a11.24,11.24,0,0,0-.67-3.87A10.44,10.44,0,0,1,13.21,5a12.06,12.06,0,0,1-3,.37,12.06,12.06,0,0,1-3-.37A10.44,10.44,0,0,1,5,4.16" transform="translate(-1.58 -2.06)"/><path class="cls-3" d="M9,8.85l-.1,0a2.9,2.9,0,0,0-1.54-.39,2.94,2.94,0,0,0-1.55.39.22.22,0,0,1-.18,0,.18.18,0,0,1-.1-.16.34.34,0,0,1,0-.1A1.47,1.47,0,0,1,6,7.46,2,2,0,0,1,7.33,7a2,2,0,0,1,1.28.44,1.43,1.43,0,0,1,.55,1.12v.1a.21.21,0,0,1-.11.16H9M7.33,8.06a3.61,3.61,0,0,1,1.43.28,1.41,1.41,0,0,0-1.43-1,1.43,1.43,0,0,0-1.44,1,3.62,3.62,0,0,1,1.44-.28" transform="translate(-1.58 -2.06)"/><path class="cls-3" d="M14.82,8.85a.17.17,0,0,1-.1,0,3,3,0,0,0-1.55-.38,3,3,0,0,0-1.54.38.19.19,0,0,1-.19,0,.19.19,0,0,1-.1-.15v-.1a1.43,1.43,0,0,1,.55-1.12A2,2,0,0,1,13.17,7a2,2,0,0,1,1.29.45A1.47,1.47,0,0,1,15,8.58a.34.34,0,0,1,0,.1.15.15,0,0,1-.1.15.12.12,0,0,1-.08,0M13.17,7.39a1.41,1.41,0,0,0-1.43,1,3.58,3.58,0,0,1,1.43-.28,3.62,3.62,0,0,1,1.44.28,1.43,1.43,0,0,0-1.44-1" transform="translate(-1.58 -2.06)"/><path class="cls-3" d="M10.25,14.93a2.82,2.82,0,0,1-2.14-1,3.58,3.58,0,0,1-.88-2.4c0-.07,0-.15,0-.22a.18.18,0,0,1,.11-.16.18.18,0,0,1,.2,0,4.13,4.13,0,0,0,2.7.93,4.15,4.15,0,0,0,2.7-.93.17.17,0,0,1,.19,0,.19.19,0,0,1,.12.16v.22a3.63,3.63,0,0,1-.87,2.4,2.82,2.82,0,0,1-2.14,1M7.61,11.7a2.84,2.84,0,0,0,2.64,2.86,2.84,2.84,0,0,0,2.64-2.86,4.67,4.67,0,0,1-2.64.78,4.67,4.67,0,0,1-2.64-.78" transform="translate(-1.58 -2.06)"/></svg>';

function getTourismType(museumsGe) {
  var s = museumsGe || "";
  for (var i = 0; i < TOURISM_TYPES.length; i++) {
    if (s.indexOf(TOURISM_TYPES[i].match) !== -1) return TOURISM_TYPES[i];
  }
  return TOURISM_TYPES[TOURISM_TYPES.length - 1];
}

function loadTourism() {
  if (tourismData) {
    buildTourismLayer(tourismData);
    loadNatureMuniCenters();
    return;
  }
  fetch(dataUrl("data/museums_theaters.geojson"))
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      tourismData = d;
      buildTourismLayer(d);
      loadNatureMuniCenters();
    });
}

function buildTourismLayer(data) {
  tourismLayer = clearLayer(tourismLayer);

  tourismLayer = L.geoJSON(data, {
    pointToLayer: function (feat, latlng) {
      var p = feat.properties;
      var t = getTourismType(p.Museums_Ge);
      var hasTheater = p.Theaters_G === "დიახ";
      var size = 30; // მუზეუმის სიმბოლოს ზომა
      var gap = 3;
      var totalW = hasTheater ? size * 2 + gap : size;

      var html =
        '<div style="position:relative;width:' + totalW + "px;height:" + size + 'px;">' +
        '<div style="position:absolute;left:0;top:0;width:' + size + "px;height:" + size + 'px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35));">' +
        t.svg +
        "</div>";
      if (hasTheater) {
        html +=
          '<div style="position:absolute;left:' + (size + gap) + "px;top:0;width:" + size + "px;height:" + size + 'px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35));">' +
          TOURISM_THEATER_SVG +
          "</div>";
      }
      html += "</div>";

      // anchor მუზეუმის სიმბოლოს ცენტრში (რეალური კოორდინატი)
      var icon = L.divIcon({
        html: html,
        iconSize: [totalW, size],
        iconAnchor: [size / 2, size / 2],
        className: "",
      });
      var marker = L.marker(latlng, { icon: icon });
      pointTooltip(marker, p.Name_Geo, -size / 2 - 2);
      marker.on("click", function () {
        showInfoTourism(p, t, hasTheater);
        showBottomChartMuseum(p, t);
      });
      return marker;
    },
  }).addTo(map);

  updateTourismLegend();
}

function showInfoTourism(p, t, hasTheater) {
  showInfoCard('<div class="info-name" style="font-size:13px;font-weight:700;">' +
    p.Museums_Ge +
    "</div>" +
    '<div style="margin:6px 0;display:flex;align-items:center;gap:8px;">' +
    '<span style="display:inline-block;width:26px;height:26px;">' + t.svg + "</span>" +
    '<span class="info-type-badge" style="background:#DF692622;color:#DF6926;border:1px solid #DF6926;">' +
    t.label +
    "</span></div>" +
    (hasTheater
      ? '<div style="margin:4px 0;"><span class="info-type-badge" style="background:#23232322;color:#232323;border:1px solid #232323;">თეატრი ფუნქციონირებს</span></div>'
      : "") +
    '<div style="margin-top:6px;font-size:11px;color:#444;line-height:1.9;">' +
    "<b>დასახლება:</b> " +
    p.Name_Geo +
    "<br>" +
    "<b>მუნიციპალიტეტი:</b> " +
    p.Municipal_ +
    "</div>");
}

function updateTourismLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div class="section-title">მუზეუმები</div>';
  TOURISM_TYPES.forEach(function (t) {
    html +=
      '<div style="display:flex;align-items:center;margin-bottom:6px;">' +
      '<span style="display:inline-flex;width:22px;height:22px;justify-content:center;flex-shrink:0;">' +
      t.svg +
      "</span>" +
      '<span style="font-size:10px;margin-left:6px;">' +
      t.label +
      "</span></div>";
  });
  html +=
    '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #ddd;">' +
    '<div style="display:flex;align-items:center;gap:6px;">' +
    '<span style="display:inline-flex;width:13px;height:13px;">' + TOURISM_THEATER_SVG + "</span>" +
    '<span style="font-size:10px;">თეატრი (თანდართული ბეჯი)</span></div></div>' +
    '<div class="section-note">სიმბოლოზე დაჭერით — დეტალები</div>';
  el.innerHTML = html;
  setInfoBtn("museums_theaters");
}

// ============================================================
// სახელოვნებო დარგების მიმართულებები
// ============================================================
var artData = null;

var artMuniLayer = null;

var artSettlementLayer = null;

var artExpandedMarker = null;

var ART_CATEGORIES = [
  {
    key: "Music",
    color: "#70594C",
    chartLabel: ["სამუსიკო"],
    label: "სამუსიკო (ვოკალური, ინსტრუმენტული, საესტრადო)",
    svg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9.98 13.96"><defs><style>.cls-1{fill:#70594c;}.cls-2{fill:none;stroke:#231f20;stroke-width:0.15px;}</style></defs><path class="cls-1" d="M5.61.49a.37.37,0,0,0,.07.74A.37.37,0,1,0,5.61.49m-.55.9A.37.37,0,0,0,4.51.9c-.35.36.23.87.55.49m1.22,0A.37.37,0,1,0,6.83.9a.37.37,0,0,0-.55.49M8.51,2.71a1,1,0,0,0,.61.38,1.13,1.13,0,0,0,1-1.95c-.76-.66-1.65-.1-2,.7-.64,1.53.41,2.9.88,4.28.65,1.91.56,4.48-1.81,5A7.2,7.2,0,0,1,3.56,11C1.88,10.22,1.8,8.12,2.21,6.59S3.81,3.64,3.29,2A1.41,1.41,0,0,0,1.71.89,1.13,1.13,0,0,0,1.52,3a1.15,1.15,0,0,0,1.33-.29A6.16,6.16,0,0,1,1.81,5a5.91,5.91,0,0,0-.63,5.46c.94,2,2.93,2.37,5,2.28,1.67-.07,3.13-.56,3.93-2.13a5.62,5.62,0,0,0-.34-5.22A9.13,9.13,0,0,1,8.49,2.79s0-.08,0-.08M3.86,1.18A.37.37,0,1,0,4,1.89a.37.37,0,0,0-.17-.71m3.56,0a.36.36,0,1,0,.21.69.36.36,0,0,0-.21-.69m-1.65.11a.34.34,0,0,1-.2,0v1h.2Zm-.9.3a.5.5,0,0,1-.21,0v.68h.21Zm1.8,0a.67.67,0,0,1-.2,0v.68h.2ZM4,2a.37.37,0,0,1-.21,0v.3H4ZM7.58,2a.37.37,0,0,1-.21,0v.3h.21Zm.31.39H3.45a2.46,2.46,0,0,1,0,.54H7.84ZM4,3H3.83s0,0,0,0c0,.29,0,.72,0,1V9.88c0,.31,0,.65,0,1,0,0,0,.11,0,.12L4,11Zm.85,0H4.66v8.14a.38.38,0,0,0,.21,0Zm.9,0h-.2v8.2h.2Zm.9,0h-.2v8.17l.21,0Zm.91,0H7.37v8L7.58,11Zm1,9.66h0a6.81,6.81,0,0,1-3.4.54l-.55,0a5.26,5.26,0,0,1-1.78-.5.77.77,0,0,0,.14,1,4.57,4.57,0,0,0,2.46.61,5.94,5.94,0,0,0,2.88-.54.85.85,0,0,0,.37-.94.89.89,0,0,0-.08-.17" transform="translate(-0.68 -0.42)"/><path class="cls-2" d="M5.61.49a.37.37,0,0,0,.07.74A.37.37,0,1,0,5.61.49Zm-.55.9A.37.37,0,0,0,4.51.9C4.16,1.26,4.74,1.77,5.06,1.39Zm1.22,0A.37.37,0,1,0,6.83.9.37.37,0,0,0,6.28,1.39ZM8.51,2.71a1,1,0,0,0,.61.38,1.13,1.13,0,0,0,1-1.95c-.76-.66-1.65-.1-2,.7-.64,1.53.41,2.9.88,4.28.65,1.91.56,4.48-1.81,5A7.2,7.2,0,0,1,3.56,11C1.88,10.22,1.8,8.12,2.21,6.59S3.81,3.64,3.29,2A1.41,1.41,0,0,0,1.71.89,1.13,1.13,0,0,0,1.52,3a1.15,1.15,0,0,0,1.33-.29A6.16,6.16,0,0,1,1.81,5a5.91,5.91,0,0,0-.63,5.46c.94,2,2.93,2.37,5,2.28,1.67-.07,3.13-.56,3.93-2.13a5.62,5.62,0,0,0-.34-5.22A9.13,9.13,0,0,1,8.49,2.79S8.48,2.71,8.51,2.71ZM3.86,1.18A.37.37,0,1,0,4,1.89.37.37,0,0,0,3.86,1.18Zm3.56,0a.36.36,0,1,0,.21.69A.36.36,0,0,0,7.42,1.18Zm-1.65.11a.34.34,0,0,1-.2,0v1h.2Zm-.9.3a.5.5,0,0,1-.21,0v.68h.21Zm1.8,0a.67.67,0,0,1-.2,0v.68h.2ZM4,2a.37.37,0,0,1-.21,0v.3H4ZM7.58,2a.37.37,0,0,1-.21,0v.3h.21Zm.31.39H3.45a2.46,2.46,0,0,1,0,.54H7.84ZM4,3H3.83s0,0,0,0c0,.29,0,.72,0,1V9.88c0,.31,0,.65,0,1,0,0,0,.11,0,.12L4,11Zm.85,0H4.66v8.14a.38.38,0,0,0,.21,0Zm.9,0h-.2v8.2h.2Zm.9,0h-.2v8.17l.21,0Zm.91,0H7.37v8L7.58,11Zm1,9.66h0a6.81,6.81,0,0,1-3.4.54l-.55,0a5.26,5.26,0,0,1-1.78-.5.77.77,0,0,0,.14,1,4.57,4.57,0,0,0,2.46.61,5.94,5.94,0,0,0,2.88-.54.85.85,0,0,0,.37-.94A.89.89,0,0,0,8.57,12.65Z" transform="translate(-0.68 -0.42)"/></svg>',
  },
  {
    key: "Choreograp",
    color: "#C1662F",
    chartLabel: ["ქორეო-", "გრაფია"],
    label: "ქორეოგრაფია",
    svg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 13.13 14.7"><defs><style>.cls-1{fill:#89471f;}.cls-2{fill:none;stroke:#231f20;stroke-width:0.15px;}</style></defs><path class="cls-1" d="M4.36.92a1.24,1.24,0,0,0,.28,2.47A1.24,1.24,0,1,0,4.36.92m5.87.67a1.11,1.11,0,1,0,.2,2.22,1.11,1.11,0,0,0-.2-2.22M11.29,11a3.78,3.78,0,0,0,1.24-.32c.12-.06.34-.14.27-.3-.64-.84-1.31-1.66-1.94-2.5-.11-.13-.22-.28-.32-.41s-.19-.28-.11-.59.17-.49.25-.73c.19-.53.58-1.1.16-1.64S10,4.28,9.55,4.13a1.38,1.38,0,0,1-.93-1.44c0-.33.25-.6-.12-.88s-.67,0-.94.27A8.3,8.3,0,0,1,6.23,3.4c-.34.21-.71.37-1.06.57.2.27.31.62.49.9,0,0,.08.15.15.14l1.33-.84c.23-.18.41-.5.62-.68,0,0,0,0,0,0A2.18,2.18,0,0,0,8.9,4.83S8.74,5,8.71,5a1.36,1.36,0,0,0-.36.61.87.87,0,1,1,0,1.74c-.47,1.08-1,2.14-1.42,3.23,0,.25.18.26.37.29a17.73,17.73,0,0,0,2.05.18c.2,0,.4,0,.59,0l.64,1,2.46,2.44a.5.5,0,0,0,.83-.45c0-.19-.28-.43-.41-.58a23.53,23.53,0,0,1-2.13-2.35s-.07-.08-.05-.1m1.6-6.25a0,0,0,0,0,0-.06c-.43-.42-.3-.47-.43-1A1,1,0,0,0,11.67,3c-.06.4-.35.64-.23,1.08a1.25,1.25,0,0,0,1.45.73m-8.61.62c.43.33.77.81,1.18,1.15a.93.93,0,0,0,.6.23c.77.1,1.55.13,2.32.25A.53.53,0,0,0,8.42,6c-.62-.11-1.32-.12-2-.2a.77.77,0,0,1-.26-.07c-.57-.48-1-1.13-1.6-1.61A.81.81,0,0,0,4,3.85,1,1,0,0,0,2.89,5c0,.87.23,1.78.28,2.65l.12,1.76c0,.35-.09.69-.15,1a4.29,4.29,0,0,1-.34,1.4c-.55.85-1.25,1.64-1.81,2.48a.65.65,0,0,0,1.09.7l2.16-2.78c.24-.64.32-1.36.52-2,0,0,0,0,0,0l1,1.72c0,.82,0,1.64,0,2.46,0,.13,0,.25,0,.39a.67.67,0,0,0,1.34.1c.08-.79-.08-1.69,0-2.49,0-.15,0-1-.08-1.1a.4.4,0,0,1-.42-.47c0-.06.07-.1,0-.16L5.56,8.54V7.12a1.49,1.49,0,0,1-.64-.55,11.82,11.82,0,0,1-.64-1.16m4.64,6-1.11-.08a4,4,0,0,0-.08,1.46c.12.77.38,1.56.5,2.34a.49.49,0,0,0,1-.15c-.13-.94-.36-1.88-.43-2.83Z" transform="translate(-0.83 -0.84)"/><path class="cls-2" d="M4.36.92a1.24,1.24,0,0,0,.28,2.47A1.24,1.24,0,1,0,4.36.92Zm5.87.67a1.11,1.11,0,1,0,.2,2.22A1.11,1.11,0,0,0,10.23,1.59ZM11.29,11a3.78,3.78,0,0,0,1.24-.32c.12-.06.34-.14.27-.3-.64-.84-1.31-1.66-1.94-2.5-.11-.13-.22-.28-.32-.41s-.19-.28-.11-.59.17-.49.25-.73c.19-.53.58-1.1.16-1.64S10,4.28,9.55,4.13a1.38,1.38,0,0,1-.93-1.44c0-.33.25-.6-.12-.88s-.67,0-.94.27A8.3,8.3,0,0,1,6.23,3.4c-.34.21-.71.37-1.06.57.2.27.31.62.49.9,0,0,.08.15.15.14l1.33-.84c.23-.18.41-.5.62-.68,0,0,0,0,0,0A2.18,2.18,0,0,0,8.9,4.83S8.74,5,8.71,5a1.36,1.36,0,0,0-.36.61.87.87,0,1,1,0,1.74c-.47,1.08-1,2.14-1.42,3.23,0,.25.18.26.37.29a17.73,17.73,0,0,0,2.05.18c.2,0,.4,0,.59,0l.64,1,2.46,2.44a.5.5,0,0,0,.83-.45c0-.19-.28-.43-.41-.58a23.53,23.53,0,0,1-2.13-2.35S11.27,11.06,11.29,11Zm1.6-6.25a0,0,0,0,0,0-.06c-.43-.42-.3-.47-.43-1A1,1,0,0,0,11.67,3c-.06.4-.35.64-.23,1.08A1.25,1.25,0,0,0,12.89,4.79Zm-8.61.62c.43.33.77.81,1.18,1.15a.93.93,0,0,0,.6.23c.77.1,1.55.13,2.32.25A.53.53,0,0,0,8.42,6c-.62-.11-1.32-.12-2-.2a.77.77,0,0,1-.26-.07c-.57-.48-1-1.13-1.6-1.61A.81.81,0,0,0,4,3.85,1,1,0,0,0,2.89,5c0,.87.23,1.78.28,2.65l.12,1.76c0,.35-.09.69-.15,1a4.29,4.29,0,0,1-.34,1.4c-.55.85-1.25,1.64-1.81,2.48a.65.65,0,0,0,1.09.7l2.16-2.78c.24-.64.32-1.36.52-2,0,0,0,0,0,0l1,1.72c0,.82,0,1.64,0,2.46,0,.13,0,.25,0,.39a.67.67,0,0,0,1.34.1c.08-.79-.08-1.69,0-2.49,0-.15,0-1-.08-1.1a.4.4,0,0,1-.42-.47c0-.06.07-.1,0-.16L5.56,8.54V7.12a1.49,1.49,0,0,1-.64-.55A11.82,11.82,0,0,1,4.28,5.41Zm4.64,6-1.11-.08a4,4,0,0,0-.08,1.46c.12.77.38,1.56.5,2.34a.49.49,0,0,0,1-.15c-.13-.94-.36-1.88-.43-2.83Z" transform="translate(-0.83 -0.84)"/><path class="cls-1" d="M4.28,5.41a11.82,11.82,0,0,0,.64,1.16,1.49,1.49,0,0,0,.64.55V8.54L6.7,10.62c0,.06,0,.1,0,.16a.4.4,0,0,0,.42.47c.1.05.07.95.08,1.1-.1.8.06,1.7,0,2.49a.67.67,0,0,1-1.34-.1c0-.14,0-.26,0-.39,0-.82,0-1.64,0-2.46l-1-1.72s0,0,0,0c-.2.65-.28,1.37-.52,2L2.08,15A.65.65,0,0,1,1,14.3c.56-.84,1.26-1.63,1.81-2.48a4.29,4.29,0,0,0,.34-1.4c.06-.34.11-.68.15-1L3.17,7.63c0-.87-.24-1.78-.28-2.65A1,1,0,0,1,4,3.85a.81.81,0,0,1,.63.25c.56.48,1,1.13,1.6,1.61a.77.77,0,0,0,.26.07c.64.08,1.34.09,2,.2A.53.53,0,0,1,8.38,7c-.77-.12-1.55-.15-2.32-.25a.93.93,0,0,1-.6-.23c-.41-.34-.75-.82-1.18-1.15" transform="translate(-0.83 -0.84)"/><path class="cls-2" d="M4.28,5.41a11.82,11.82,0,0,0,.64,1.16,1.49,1.49,0,0,0,.64.55V8.54L6.7,10.62c0,.06,0,.1,0,.16a.4.4,0,0,0,.42.47c.1.05.07.95.08,1.1-.1.8.06,1.7,0,2.49a.67.67,0,0,1-1.34-.1c0-.14,0-.26,0-.39,0-.82,0-1.64,0-2.46l-1-1.72s0,0,0,0c-.2.65-.28,1.37-.52,2L2.08,15A.65.65,0,0,1,1,14.3c.56-.84,1.26-1.63,1.81-2.48a4.29,4.29,0,0,0,.34-1.4c.06-.34.11-.68.15-1L3.17,7.63c0-.87-.24-1.78-.28-2.65A1,1,0,0,1,4,3.85a.81.81,0,0,1,.63.25c.56.48,1,1.13,1.6,1.61a.77.77,0,0,0,.26.07c.64.08,1.34.09,2,.2A.53.53,0,0,1,8.38,7c-.77-.12-1.55-.15-2.32-.25a.93.93,0,0,1-.6-.23C5.05,6.22,4.71,5.74,4.28,5.41Z" transform="translate(-0.83 -0.84)"/><path class="cls-1" d="M11.29,11s0,.08.05.1a23.53,23.53,0,0,0,2.13,2.35c.13.15.38.39.41.58a.5.5,0,0,1-.83.45l-2.46-2.44-.64-1c-.19,0-.39,0-.6,0a17.75,17.75,0,0,1-2-.18c-.19,0-.37,0-.37-.29.42-1.09.95-2.15,1.42-3.23a.87.87,0,1,0,0-1.74A1.36,1.36,0,0,1,8.71,5s.22-.16.19-.2A2.18,2.18,0,0,1,7.81,3.47s0,0,0,0c-.21.18-.39.5-.62.68L5.81,5c-.07,0-.11-.09-.15-.14-.18-.28-.29-.63-.49-.9.35-.2.72-.36,1.06-.57A8.3,8.3,0,0,0,7.56,2.08c.26-.27.56-.57.94-.27s.15.55.12.88a1.38,1.38,0,0,0,.93,1.44c.47.15.95,0,1.29.42s0,1.11-.16,1.64c-.08.24-.18.49-.25.73s-.06.33.11.59.21.28.32.41c.63.84,1.3,1.66,1.94,2.5.07.16-.15.24-.27.3a3.78,3.78,0,0,1-1.24.32" transform="translate(-0.83 -0.84)"/><path class="cls-2" d="M11.29,11s0,.08.05.1a23.53,23.53,0,0,0,2.13,2.35c.13.15.38.39.41.58a.5.5,0,0,1-.83.45l-2.46-2.44-.64-1c-.19,0-.39,0-.6,0a17.75,17.75,0,0,1-2-.18c-.19,0-.37,0-.37-.29.42-1.09.95-2.15,1.42-3.23a.87.87,0,1,0,0-1.74A1.36,1.36,0,0,1,8.71,5s.22-.16.19-.2A2.18,2.18,0,0,1,7.81,3.47s0,0,0,0c-.21.18-.39.5-.62.68L5.81,5c-.07,0-.11-.09-.15-.14-.18-.28-.29-.63-.49-.9.35-.2.72-.36,1.06-.57A8.3,8.3,0,0,0,7.56,2.08c.26-.27.56-.57.94-.27s.15.55.12.88a1.38,1.38,0,0,0,.93,1.44c.47.15.95,0,1.29.42s0,1.11-.16,1.64c-.08.24-.18.49-.25.73s-.06.33.11.59.21.28.32.41c.63.84,1.3,1.66,1.94,2.5.07.16-.15.24-.27.3A3.78,3.78,0,0,1,11.29,11Z" transform="translate(-0.83 -0.84)"/><path class="cls-1" d="M4.36.92a1.24,1.24,0,1,1,.28,2.47A1.24,1.24,0,0,1,4.36.92" transform="translate(-0.83 -0.84)"/><path class="cls-2" d="M4.36.92a1.24,1.24,0,1,1,.28,2.47A1.24,1.24,0,0,1,4.36.92Z" transform="translate(-0.83 -0.84)"/><path class="cls-1" d="M8.92,11.39l-.16.74c.07.95.3,1.89.43,2.83a.49.49,0,0,1-1,.15c-.12-.78-.38-1.57-.5-2.34a4,4,0,0,1,.08-1.46Z" transform="translate(-0.83 -0.84)"/><path class="cls-2" d="M8.92,11.39l-.16.74c.07.95.3,1.89.43,2.83a.49.49,0,0,1-1,.15c-.12-.78-.38-1.57-.5-2.34a4,4,0,0,1,.08-1.46Z" transform="translate(-0.83 -0.84)"/><path class="cls-1" d="M10.23,1.59a1.12,1.12,0,0,1,.2,2.22,1.12,1.12,0,1,1-.2-2.22" transform="translate(-0.83 -0.84)"/><path class="cls-2" d="M10.23,1.59a1.12,1.12,0,0,1,.2,2.22A1.12,1.12,0,1,1,10.23,1.59Z" transform="translate(-0.83 -0.84)"/><path class="cls-1" d="M12.89,4.79a1.25,1.25,0,0,1-1.45-.73c-.12-.44.17-.68.23-1.08a1,1,0,0,1,.76.75c.13.53,0,.58.43,1a0,0,0,0,1,0,.06" transform="translate(-0.83 -0.84)"/><path class="cls-2" d="M12.89,4.79a1.25,1.25,0,0,1-1.45-.73c-.12-.44.17-.68.23-1.08a1,1,0,0,1,.76.75c.13.53,0,.58.43,1A0,0,0,0,1,12.89,4.79Z" transform="translate(-0.83 -0.84)"/></svg>',
  },
  {
    key: "Theatrical",
    color: "#43B3E2",
    chartLabel: ["თეატრა-", "ლური დასი"],
    label: "თეატრალური დასი (თოჯინების თეატრი, სამოყვარულო დასი)",
    svg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11.14 12.81"><defs><style>.cls-1{fill:#a2def9;}.cls-2{fill:none;stroke:#231f20;stroke-width:0.15px;}.cls-3{fill:#43b3e2;}.cls-4{fill:#31bced;}.cls-5{fill:#0274ab;}</style></defs><path class="cls-1" d="M7.4,14.52C4.35,14.52,1.9,9.29,1.9,5a3.12,3.12,0,0,1,1-2.66c1-.78,2.51-.36,3.59,0a4.26,4.26,0,0,0,.91.21,4.54,4.54,0,0,0,.91-.21c1.07-.31,2.55-.73,3.59,0a3.15,3.15,0,0,1,1,2.66c0,4.33-2.45,9.56-5.49,9.56" transform="translate(-1.83 -1.78)"/><path class="cls-2" d="M7.4,14.52C4.35,14.52,1.9,9.29,1.9,5a3.12,3.12,0,0,1,1-2.66c1-.78,2.51-.36,3.59,0a4.26,4.26,0,0,0,.91.21,4.54,4.54,0,0,0,.91-.21c1.07-.31,2.55-.73,3.59,0a3.15,3.15,0,0,1,1,2.66C12.89,9.29,10.44,14.52,7.4,14.52Z" transform="translate(-1.83 -1.78)"/><path class="cls-3" d="M6,7.06a.57.57,0,0,1-.4-.16A.46.46,0,0,0,5,6.9a.57.57,0,0,1-.81,0,.56.56,0,0,1,0-.8,1.61,1.61,0,0,1,2.28,0,.57.57,0,0,1,0,.8A.54.54,0,0,1,6,7.06" transform="translate(-1.83 -1.78)"/><path class="cls-4" d="M11.9,2.3c-1-.78-2.52-.36-3.59,0a4.54,4.54,0,0,1-.91.21V14.52c3,0,5.49-5.23,5.49-9.56a3.12,3.12,0,0,0-1-2.66" transform="translate(-1.83 -1.78)"/><path class="cls-2" d="M11.9,2.3c-1-.78-2.52-.36-3.59,0a4.54,4.54,0,0,1-.91.21V14.52c3,0,5.49-5.23,5.49-9.56A3.12,3.12,0,0,0,11.9,2.3Z" transform="translate(-1.83 -1.78)"/><path class="cls-5" d="M9.91,7.06A.57.57,0,0,1,9.5,6.9a.46.46,0,0,0-.67,0,.56.56,0,0,1-.8,0,.55.55,0,0,1,0-.8,1.61,1.61,0,0,1,2.28,0,.57.57,0,0,1,0,.8.54.54,0,0,1-.4.17" transform="translate(-1.83 -1.78)"/><path class="cls-3" d="M7.4,11.76a2.56,2.56,0,0,1-2.5-2A.57.57,0,1,1,6,9.5a1.41,1.41,0,0,0,2.75,0,.57.57,0,0,1,1.12.22,2.56,2.56,0,0,1-2.49,2" transform="translate(-1.83 -1.78)"/><path class="cls-5" d="M9.44,9.05a.57.57,0,0,0-.67.45A1.4,1.4,0,0,1,7.4,10.62v1.14a2.56,2.56,0,0,0,2.49-2,.58.58,0,0,0-.45-.67" transform="translate(-1.83 -1.78)"/></svg>',
  },
  {
    key: "Fine_Arts",
    color: "#E2AA60",
    chartLabel: ["სახვითი", "ხელოვნება"],
    label: "სახვითი ხელოვნება (ფერწერა, ხეზე და ქვაზე კვეთა, გრაფიკა, ძერწვა)",
    svg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12.85 13.66"><defs><style>.cls-1{fill:#fff;}.cls-2,.cls-4,.cls-6{fill:none;stroke:#231f20;}.cls-2{stroke-miterlimit:10;}.cls-3{fill:#e2aa60;}.cls-4{stroke-linejoin:round;}.cls-4,.cls-6{stroke-width:0.2px;}.cls-5{fill:#975fa0;}.cls-7{fill:#60bcea;}.cls-8{fill:#66bc46;}.cls-9{fill:#fdee3e;}.cls-10{fill:#ed2024;}.cls-11{fill:#ca8d51;}.cls-12{fill:#2d160d;}</style></defs><path class="cls-1" d="M4.93,6.39c1-.1,1.15.91.36,1.37C4.91,8,4.25,8,4,7.59s.41-1.14.92-1.2" transform="translate(-0.97 -1.36)"/><path class="cls-2" d="M4.93,6.39c1-.1,1.15.91.36,1.37C4.91,8,4.25,8,4,7.59S4.42,6.45,4.93,6.39Z" transform="translate(-0.97 -1.36)"/><path class="cls-1" d="M10,11.52a.63.63,0,1,1,.14,1.26A.63.63,0,0,1,10,11.52" transform="translate(-0.97 -1.36)"/><path class="cls-2" d="M10,11.52a.63.63,0,1,1,.14,1.26A.63.63,0,0,1,10,11.52Z" transform="translate(-0.97 -1.36)"/><path class="cls-1" d="M8,12.22a.63.63,0,0,1,.14,1.26A.63.63,0,0,1,8,12.22" transform="translate(-0.97 -1.36)"/><path class="cls-2" d="M8,12.22a.63.63,0,0,1,.14,1.26A.63.63,0,0,1,8,12.22Z" transform="translate(-0.97 -1.36)"/><path class="cls-1" d="M4.22,11.54a.47.47,0,1,1,.09.94.47.47,0,0,1-.09-.94" transform="translate(-0.97 -1.36)"/><path class="cls-2" d="M4.22,11.54a.47.47,0,1,1,.09.94A.47.47,0,0,1,4.22,11.54Z" transform="translate(-0.97 -1.36)"/><path class="cls-3" d="M2,13a4.36,4.36,0,0,0,2.7,1.45c3.83.28,6.74-2.92,7.14-3.47a2.63,2.63,0,0,0,.55-1.92A9.54,9.54,0,0,0,12,7.76a1.51,1.51,0,0,1,.12-1.36A3.33,3.33,0,0,1,12.48,6,3.21,3.21,0,0,0,13,2.55c-.6-1-2.08-1.11-3.11-1.09A9.46,9.46,0,0,0,3.8,4.21C-.7,8.86,1.63,12.58,2,13" transform="translate(-0.97 -1.36)"/><path class="cls-4" d="M2,13a4.36,4.36,0,0,0,2.7,1.45c3.83.28,6.74-2.92,7.14-3.47a2.63,2.63,0,0,0,.55-1.92A9.54,9.54,0,0,0,12,7.76a1.51,1.51,0,0,1,.12-1.36A3.33,3.33,0,0,1,12.48,6,3.21,3.21,0,0,0,13,2.55c-.6-1-2.08-1.11-3.11-1.09A9.46,9.46,0,0,0,3.8,4.21C-.7,8.86,1.63,12.58,2,13Z" transform="translate(-0.97 -1.36)"/><path class="cls-5" d="M8.51,4.22A1.08,1.08,0,0,0,10,2.67,1.08,1.08,0,1,0,8.51,4.22" transform="translate(-0.97 -1.36)"/><path class="cls-6" d="M8.51,4.22A1.08,1.08,0,0,0,10,2.67,1.08,1.08,0,1,0,8.51,4.22Z" transform="translate(-0.97 -1.36)"/><path class="cls-7" d="M5.56,5.87a1.08,1.08,0,0,0,1.5-1.55,1.08,1.08,0,1,0-1.5,1.55" transform="translate(-0.97 -1.36)"/><path class="cls-6" d="M5.56,5.87a1.08,1.08,0,0,0,1.5-1.55A1.08,1.08,0,1,0,5.56,5.87Z" transform="translate(-0.97 -1.36)"/><path class="cls-8" d="M3.14,8.39a1.08,1.08,0,0,0,1.5-1.56,1.08,1.08,0,1,0-1.5,1.56" transform="translate(-0.97 -1.36)"/><path class="cls-6" d="M3.14,8.39a1.08,1.08,0,0,0,1.5-1.56A1.08,1.08,0,1,0,3.14,8.39Z" transform="translate(-0.97 -1.36)"/><path class="cls-9" d="M2.7,11.63a1.08,1.08,0,0,0,1.51-1.55A1.08,1.08,0,1,0,2.7,11.63" transform="translate(-0.97 -1.36)"/><path class="cls-6" d="M2.7,11.63a1.08,1.08,0,0,0,1.51-1.55A1.08,1.08,0,1,0,2.7,11.63Z" transform="translate(-0.97 -1.36)"/><path class="cls-10" d="M6.09,13.13A1.08,1.08,0,0,0,7.6,11.58a1.08,1.08,0,1,0-1.51,1.55" transform="translate(-0.97 -1.36)"/><path class="cls-6" d="M6.09,13.13A1.08,1.08,0,0,0,7.6,11.58,1.08,1.08,0,1,0,6.09,13.13Z" transform="translate(-0.97 -1.36)"/><path class="cls-1" d="M10.87,7.44c-.34-.51-1.24-.5-2,0s-1.1,1.35-.75,1.86,1.24.5,2,0,1.1-1.35.75-1.86" transform="translate(-0.97 -1.36)"/><path class="cls-6" d="M10.87,7.44c-.34-.51-1.24-.5-2,0s-1.1,1.35-.75,1.86,1.24.5,2,0S11.22,8,10.87,7.44Z" transform="translate(-0.97 -1.36)"/><path class="cls-11" d="M13.71,14.89c-.14.07-.34,0-.48-.08a10.49,10.49,0,0,1-2.43-1.64L7.34,9.76a.27.27,0,0,0,.22-.24c1.14.88,2.31,1.65,3.44,2.54a22.09,22.09,0,0,1,1.82,1.67c.22.24.47.49.67.74a1.38,1.38,0,0,1,.23.36Z" transform="translate(-0.97 -1.36)"/><path class="cls-4" d="M13.71,14.89c-.14.07-.34,0-.48-.08a10.49,10.49,0,0,1-2.43-1.64L7.34,9.76a.27.27,0,0,0,.22-.24c1.14.88,2.31,1.65,3.44,2.54a22.09,22.09,0,0,1,1.82,1.67c.22.24.47.49.67.74a1.38,1.38,0,0,1,.23.36Z" transform="translate(-0.97 -1.36)"/><path class="cls-1" d="M9,11.39l0,0L7.34,9.75a.26.26,0,0,0,.22-.23c.58.45,1.18.87,1.77,1.29l0,0" transform="translate(-0.97 -1.36)"/><path class="cls-4" d="M9,11.39l0,0L7.34,9.75a.26.26,0,0,0,.22-.23c.58.45,1.18.87,1.77,1.29l0,0" transform="translate(-0.97 -1.36)"/><path class="cls-12" d="M6.22,8.14c.08.08.13.18.21.26a2.68,2.68,0,0,0,.63.49c.37.21.66.61.57.8s-.57.1-.94-.2a1.15,1.15,0,0,1-.47-1.35" transform="translate(-0.97 -1.36)"/></svg>',
  },
  {
    key: "Applied_Ar",
    color: "#85451D",
    chartLabel: ["გამოყენე-", "ბითი ხელ."],
    label: "გამოყენებითი ხელოვნება (თექა, ხალიჩების და გობელინების ქსოვა)",
    svg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12.06 12.17"><defs><style>.cls-1,.cls-3{fill:none;}.cls-1{stroke:#85451d;stroke-width:0.25px;}.cls-2{fill:#85451d;}.cls-3{stroke:#231f20;stroke-width:0.1px;}</style></defs><rect class="cls-1" x="0.13" y="0.13" width="11.81" height="11.91"/><rect class="cls-2" x="2.63" y="2.65" width="6.8" height="6.86"/><rect class="cls-3" x="2.63" y="2.65" width="6.8" height="6.86"/><line class="cls-1" x1="0.13" y1="0.2" x2="2.33" y2="2.28"/><line class="cls-1" x1="11.77" y1="0.2" x2="9.58" y2="2.28"/><line class="cls-1" x1="6.05" x2="6.05" y2="2.28"/><line class="cls-1" x1="6.05" y1="9.89" x2="6.05" y2="12.17"/><line class="cls-1" x1="0.07" y1="5.9" x2="2.23" y2="5.9"/><line class="cls-1" x1="9.84" y1="5.9" x2="12.01" y2="5.9"/><line class="cls-1" x1="0.13" y1="11.92" x2="2.33" y2="9.84"/><line class="cls-1" x1="11.77" y1="11.92" x2="9.58" y2="9.84"/></svg>',
  },
  {
    key: "Oral_Folkl",
    color: "#87D6F8",
    chartLabel: ["ზეპირსიტყ-", "ვიერება"],
    label: "ზეპირსიტყვიერება (მხატვრული კითხვა, ქართული ენის შემსწავლელი კლუბი)",
    svg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 13.81 14.71"><defs><style>.cls-1{fill:#87d6f8;}.cls-2,.cls-4,.cls-6{fill:none;stroke:#231f20;}.cls-2{stroke-miterlimit:10;stroke-width:0.15px;}.cls-3{fill:#85451d;}.cls-4{stroke-width:0.1px;}.cls-5{fill:#e2aa60;}.cls-6{stroke-linejoin:round;stroke-width:0.2px;}.cls-7{fill:#231f20;}</style></defs><polygon class="cls-1" points="0.08 0.09 0.08 14.52 2.6 11.63 13.74 11.63 13.74 0.09 0.08 0.09"/><polygon class="cls-2" points="13.74 0.07 13.74 11.62 2.6 11.62 0.07 14.51 0.07 0.07 13.74 0.07"/><path class="cls-3" d="M10.77,1.84a1.29,1.29,0,0,0-.25,0h.07L10.32,2a.85.85,0,0,0-.3.6v.84h.75a.76.76,0,0,0,.69-.81.76.76,0,0,0-.69-.81" transform="translate(-0.49 -0.89)"/><path class="cls-4" d="M10.77,1.84a1.29,1.29,0,0,0-.25,0h.07L10.32,2a.85.85,0,0,0-.3.6v.84h.75a.76.76,0,0,0,.69-.81A.76.76,0,0,0,10.77,1.84Z" transform="translate(-0.49 -0.89)"/><path class="cls-5" d="M10.59,1.88,10.32,2a.85.85,0,0,0-.3.6V11a.76.76,0,0,1-1.31.49c-.2-.26-.12-.45-.19-.74s-.33-.52-.55-.52H4.18V2.54c0-.27.34-.66.56-.66Z" transform="translate(-0.49 -0.89)"/><path class="cls-6" d="M10.59,1.88,10.32,2a.85.85,0,0,0-.3.6V11a.76.76,0,0,1-1.31.49c-.2-.26-.12-.45-.19-.74s-.33-.52-.55-.52H4.18V2.54c0-.27.34-.66.56-.66Z" transform="translate(-0.49 -0.89)"/><path class="cls-7" d="M7.08,4c-.4,0-.4.28,0,.3.6,0,1.34,0,2,0,.4,0,.42-.26,0-.3Z" transform="translate(-0.49 -0.89)"/><path class="cls-7" d="M5.15,4c-.41,0-.43.28,0,.3a5.11,5.11,0,0,0,.79,0c.29,0,.23-.26-.09-.28h-.7" transform="translate(-0.49 -0.89)"/><path class="cls-7" d="M5.15,5.52c-.43,0-.41.3,0,.31H9c.41,0,.46-.26.06-.31Z" transform="translate(-0.49 -0.89)"/><path class="cls-7" d="M8.39,7c-.41,0-.42.28,0,.3a7.06,7.06,0,0,0,.8,0c.28-.06.22-.26-.09-.29H8.39" transform="translate(-0.49 -0.89)"/><path class="cls-7" d="M5.13,7.05c-.4,0-.39.28,0,.3.6,0,1.34,0,2,0,.4,0,.42-.26,0-.3Z" transform="translate(-0.49 -0.89)"/><path class="cls-7" d="M5.15,8.56c-.43,0-.41.29,0,.3H9c.41,0,.46-.26.06-.3Z" transform="translate(-0.49 -0.89)"/><path class="cls-3" d="M9.22,11.87H4a.82.82,0,0,1,0-1.62H7.87a.76.76,0,0,1,.69.81c0,.44.1.61.66.81" transform="translate(-0.49 -0.89)"/><path class="cls-4" d="M9.22,11.87H4a.82.82,0,0,1,0-1.62H7.87a.76.76,0,0,1,.69.81C8.56,11.5,8.66,11.67,9.22,11.87Z" transform="translate(-0.49 -0.89)"/><path class="cls-7" d="M12.54,1.7v.09a1,1,0,0,0-.28.21.38.38,0,0,0-.08.24s0,.09,0,.11a.05.05,0,0,0,.05,0l.07,0,.09,0a.26.26,0,0,1,.16.07.26.26,0,0,1,.07.17.23.23,0,0,1-.09.18.27.27,0,0,1-.2.07.35.35,0,0,1-.26-.12A.45.45,0,0,1,12,2.39.7.7,0,0,1,12.11,2a.83.83,0,0,1,.43-.28m1.05,0v.08a1,1,0,0,0-.3.23.48.48,0,0,0-.07.24.12.12,0,0,0,0,.09.05.05,0,0,0,.05,0l.07,0,.1,0a.21.21,0,0,1,.15.07.2.2,0,0,1,.07.16.29.29,0,0,1-.08.19.31.31,0,0,1-.21.07.34.34,0,0,1-.26-.12A.43.43,0,0,1,13,2.4.64.64,0,0,1,13.17,2a.77.77,0,0,1,.42-.27" transform="translate(-0.49 -0.89)"/><path class="cls-7" d="M1.21,11.94v-.09a1,1,0,0,0,.29-.23.48.48,0,0,0,.07-.24.2.2,0,0,0,0-.09l-.06,0-.07,0H1.33a.22.22,0,0,1-.23-.22.26.26,0,0,1,.09-.19.28.28,0,0,1,.2-.08.35.35,0,0,1,.26.13.44.44,0,0,1,.12.32.68.68,0,0,1-.15.42.74.74,0,0,1-.41.27m1,0v-.09a1.05,1.05,0,0,0,.27-.21.4.4,0,0,0,.09-.24.14.14,0,0,0,0-.11.05.05,0,0,0,0,0l-.08,0H2.38a.25.25,0,0,1-.16-.06.25.25,0,0,1-.06-.17.22.22,0,0,1,.08-.18.28.28,0,0,1,.2-.08.39.39,0,0,1,.27.13.45.45,0,0,1,.11.32.64.64,0,0,1-.14.41.85.85,0,0,1-.42.28" transform="translate(-0.49 -0.89)"/></svg>',
  },
];

function artActiveCategories(p) {
  return ART_CATEGORIES.filter(function (c) {
    var v = p[c.key];
    return v && v !== "არა";
  });
}

// კომპაქტური (ჩვეულებრივი) და გაშლილი (დაწკაპებისას) კლასტერის აწყობა
function buildArtClusterIcon(cats, expanded) {
  var cell = expanded ? 24 : 22;
  var gap = expanded ? 4 : 2;
  var cols = cats.length > 4 ? 3 : cats.length > 1 ? 2 : 1;

  if (!expanded) {
    var rows = Math.ceil(cats.length / cols);
    var boxW = cols * cell + (cols - 1) * gap;
    var boxH = rows * cell + (rows - 1) * gap;
    var html =
      '<div style="display:flex;flex-wrap:wrap;gap:' + gap + "px;width:" + boxW + 'px;">';
    cats.forEach(function (c) {
      html +=
        '<div style="width:' + cell + "px;height:" + cell + 'px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5));">' +
        c.svg +
        "</div>";
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

  // გაშლილი — ვერტიკალური სია, თითოეული სიმბოლო + სახელი, თეთრ ბარათზე
  var rowH = 28;
  var boxW = 190;
  var boxH = cats.length * rowH + 10;
  var html =
    '<div style="width:' + boxW + "px;padding:5px 8px;background:#fff;border:1px solid #C4A878;" +
    'border-radius:6px;box-shadow:0 3px 10px rgba(0,0,0,.35);">';
  cats.forEach(function (c) {
    html +=
      '<div style="display:flex;align-items:center;gap:7px;padding:3px 0;">' +
      '<span style="display:inline-flex;width:' + cell + "px;height:" + cell + 'px;flex-shrink:0;">' +
      c.svg +
      "</span>" +
      '<span style="font-size:10px;line-height:1.3;color:#1A1A18;">' +
      c.label.split(" (")[0] +
      "</span></div>";
  });
  html += "</div>";
  var icon2 = L.divIcon({
    html: html,
    iconSize: [boxW, boxH],
    iconAnchor: [boxW / 2, boxH + 12],
    className: "",
  });
  return { icon: icon2, boxW: boxW, boxH: boxH };
}

// ღია სიმბოლოთა კლასტერის დახურვა (გარდა გადაცემული marker-ისა, თუ მითითებულია)
function collapseArtExpanded(exceptMarker) {
  if (artExpandedMarker && artExpandedMarker !== exceptMarker) {
    artExpandedMarker.setIcon(artExpandedMarker._artCompact.icon);
    artExpandedMarker.setZIndexOffset(0);
    artExpandedMarker._artIsExpanded = false;
    artExpandedMarker = null;
  }
}

function loadArtDisciplines() {
  if (artData) {
    buildArtDisciplinesLayers(artData);
    return;
  }
  loadMuniData("data/muni/art_disciplines.json")
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      artData = d;
      buildArtDisciplinesLayers(d);
    });
}

function buildArtDisciplinesLayers(data) {
  artMuniLayer = clearLayer(artMuniLayer);
  artSettlementLayer = clearLayer(artSettlementLayer);

  var munis = {
    type: "FeatureCollection",
    features: data.features.filter(function (f) {
      return f.properties.ftype === "municipality";
    }),
  };
  var settlements = {
    type: "FeatureCollection",
    features: data.features.filter(function (f) {
      return f.properties.ftype === "settlement";
    }),
  };

  // მუნიციპალიტეტების მსუბუქი ფონი
  artMuniLayer = L.geoJSON(munis, {
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
      areaTooltip(layer, p.Name_Geo);
      layer.on("click", function () {
        showInfoArtMuni(p);
        showBottomChartArt(p, artActiveCategories(p));
      });
    },
  }).addTo(map);

  // დასახლებები — მიმართულებების სიმბოლოთა კლასტერი
  artSettlementLayer = L.geoJSON(settlements, {
    filter: function (feat) {
      return artActiveCategories(feat.properties).length > 0;
    },
    pointToLayer: function (feat, latlng) {
      var p = feat.properties;
      var cats = artActiveCategories(p);
      var compactIcon = buildArtClusterIcon(cats, false);

      var marker = L.marker(latlng, { icon: compactIcon.icon });
      // hover — მხოლოდ დასახლების სახელი; დეტალები სტატისტიკის ველშია
      pointTooltip(marker, p.Name_Geo, -compactIcon.boxH / 2 - 2);

      marker.on("click", function () {
        showInfoArtSettlement(p, cats);
        showBottomChartArt(p, cats);
      });
      return marker;
    },
  }).addTo(map);

  updateArtLegend();
}

function artMapClickCollapse() {
  collapseArtExpanded(null);
}

// ერთიანი "აქვს / არ აქვს" დიაგრამა სტატისტიკის ველისთვის
// (ტურიზმის სახეობების იმავე პრინციპით)
// კატეგორიების დიაგრამა რეალური რაოდენობებით (რეგიონი); activeKeys-ის
// კატეგორიები სრული ფერით, დანარჩენი — ბაცად (highlightBottomBars)
function drawCategoryCountChart(title, cats, counts, unit, activeKeys) {
  var ctx = prepareBottomChart();

  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: cats.map(function (c) {
        return c.chartLabel || [c.label];
      }),
      datasets: [
        {
          data: counts,
          backgroundColor: cats.map(function (c) {
            return c.color;
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
        title: chartTitle(title),
        tooltip: {
          callbacks: {
            title: function (c) {
              return cats[c[0].dataIndex].label;
            },
            label: function (c) {
              return " " + c.parsed.y + " " + unit;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0, font: { size: 10, weight: "500" } },
        },
        x: {
          ticks: {
            font: { size: 11, weight: "500" },
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

  highlightBottomBars(function (l, i) {
    return activeKeys.indexOf(cats[i].key) !== -1;
  });
}

// დასახლებები სახელოვნებო დარგების მიხედვით (რეგიონი); დაწკაპებულის დარგები გამოყოფილია
function showBottomChartArt(p, cats) {
  var settlements = artData.features.filter(function (f) {
    return f.properties.ftype === "settlement";
  });
  var counts = ART_CATEGORIES.map(function (c) {
    return settlements.filter(function (f) {
      var v = f.properties[c.key];
      return v && v !== "არა";
    }).length;
  });
  drawCategoryCountChart(
    "დასახლებები სახელოვნებო დარგების მიხედვით — " + p.Name_Geo,
    ART_CATEGORIES,
    counts,
    "დასახლება",
    cats.map(function (c) {
      return c.key;
    })
  );
}

// მუზეუმები სახეობების მიხედვით (რეგიონი); დაწკაპებული მუზეუმის სახეობა გამოყოფილია
function showBottomChartMuseum(p, t) {
  var counts = TOURISM_TYPES.map(function (tt) {
    return tourismData.features.filter(function (f) {
      return getTourismType(f.properties.Museums_Ge).key === tt.key;
    }).length;
  });
  drawCategoryCountChart(
    "მუზეუმები სახეობების მიხედვით — " + p.Name_Geo + ": " + t.label,
    TOURISM_TYPES,
    counts,
    "მუზეუმი",
    [t.key]
  );
}

function showInfoArtMuni(p) {
  var cats = artActiveCategories(p);
  var rows = cats
    .map(function (c) {
      return (
        '<div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:5px;">' +
        '<span style="display:inline-block;width:20px;height:20px;flex-shrink:0;">' +
        c.svg +
        "</span>" +
        '<span style="font-size:10px;line-height:1.4;">' +
        p[c.key] +
        "</span></div>"
      );
    })
    .join("");
  showInfoCard('<div class="info-name" style="font-size:13px;font-weight:700;">' +
    p.Name_Geo +
    " (მუნიციპალიტეტი)</div>" +
    '<div style="margin-top:8px;">' +
    (rows || '<span style="font-size:10px;color:var(--text-muted);">მონაცემი არ არის</span>') +
    "</div>");
}

function showInfoArtSettlement(p, cats) {
  var rows = cats
    .map(function (c) {
      return (
        '<div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:5px;">' +
        '<span style="display:inline-block;width:20px;height:20px;flex-shrink:0;">' +
        c.svg +
        "</span>" +
        '<span style="font-size:10px;line-height:1.4;"><b>' +
        c.label.split(" (")[0] +
        ":</b> " +
        p[c.key] +
        "</span></div>"
      );
    })
    .join("");
  showInfoCard('<div class="info-name" style="font-size:13px;font-weight:700;">' +
    p.Name_Geo +
    "</div>" +
    '<span class="info-type-badge" style="background:#89471f22;color:#89471f;border:1px solid #89471f;">' +
    p.Municipal_ +
    "</span>" +
    '<div style="margin-top:8px;">' +
    rows +
    "</div>");
}

function updateArtLegend() {
  var el = document.getElementById("legendContent");
  if (!el) return;
  var html =
    '<div class="section-title">სახელოვნებო დარგები</div>';
  ART_CATEGORIES.forEach(function (c) {
    html +=
      '<div style="display:flex;align-items:flex-start;margin-bottom:7px;">' +
      '<span style="display:inline-flex;width:22px;height:22px;justify-content:center;flex-shrink:0;">' +
      c.svg +
      "</span>" +
      '<span style="font-size:10px;margin-left:6px;line-height:1.35;">' +
      c.label +
      "</span></div>";
  });
  html +=
    '<div class="section-note">დასახლებაზე დაჭერით — მიმართულებების დეტალები. მუნიციპალიტეტზე დაჭერით — მთლიანი სურათი.</div>';
  el.innerHTML = html;
  setInfoBtn("art_disciplines");
}

// ===== Start-up (called from app.js) =====
function initEducation() {
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
        document.getElementById("tourismView").style.display = "none";
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
        document.getElementById("chkTourism").checked = false;
        removeAllThematic();
        removeAllNatureLayers();
        removeAllHistoryLayers();
        removeAllEconomyLayers();
        removeAllTourismLayers();
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
      hideChartPanel();
      document.getElementById("infoCard").classList.add("hidden");
      resetPopLegend();
      loadNeutralLayers();
    });


  document.querySelectorAll("[data-edusub]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (this.classList.contains("active")) return; // იგივეზე ხელახლა დაწკაპება
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
      else if (this.dataset.edusub === "libraries") loadLibraries();
      else if (this.dataset.edusub === "tourism") loadTourism();
      else if (this.dataset.edusub === "art_disciplines") loadArtDisciplines();
      setInfoBtn(EDU_SUB_INFO[this.dataset.edusub] || null);
    });
  });
}
