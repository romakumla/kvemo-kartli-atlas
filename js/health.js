// ჯანდაცვა და სოციალური მომსახურება: ინფრასტრუქტურა, სოციალური დახმარება, ზოონოზური დაავადებები
// Part of the atlas script, split from the former js/main.js. Files are loaded in
// order by index.html; theme files only define things, their start-up code is
// in initHealth(), called from app.js once every file is loaded.


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
  loadDataAll(
    ["data/muni/health_services.json", "data/health_clinics.geojson"],
    function (d) {
      healthServicesData = d[0];
      healthClinicsData = d[1];
      buildHealthLayers();
      loadNatureMuniCenters();
    },
  );
}

function buildHealthLayers() {
  healthPolyLayer = clearLayer(healthPolyLayer);
  healthClinicLayer = clearLayer(healthClinicLayer);
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
      areaTooltip(layer, p.Name_Geo);
      layer.on("click", function () {
        showInfoHealthPoly(p);
        showBottomChartHealth();
        highlightBottomBars(p.Name_Geo);
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
        pointTooltip(marker, p.Name_Geo, -sz / 2 - 2);
        marker.on("click", function () {
          showInfoHealthClinic(p);
          showBottomChartHealth();
          highlightBottomBars(muniName(p.Municipal_ || p.Municipal1));
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
  showInfoCard('<div class="info-name" style="font-size:13px;font-weight:700;">' +
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
      : ""));
}

function showInfoHealthClinic(p) {
  showInfoCard('<div class="info-name" style="font-size:13px;font-weight:700;">' +
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
    "</div>");
}

function showBottomChartHealth() {
  if (!healthServicesData) return;
  var ctx = prepareBottomChart();
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
            font: { size: 9 },
            boxWidth: 12,
            padding: 6,
          },
        },
        title: chartTitle("ჯანდაცვის პერსონალი და ამბ. ვიზიტები"),
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
          title: { display: true, text: "პერსონალი", font: { size: 8 } },
        },
        y1: {
          type: "linear",
          position: "right",
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          ticks: { font: { size: 10, weight: "500" } },
          title: { display: true, text: "ამბ. ვიზ.", font: { size: 8 } },
        },
        x: {
          ticks: { font: { size: 11, weight: "500" }, maxRotation: 35 },
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
    '<div class="section-title">' +
    HEALTH_METRIC_LABELS[metric] +
    "</div>";
  html += '<div class="panel-btn-col">';
  ["doctors", "nurses", "outpatient"].forEach(function (m) {
    html +=
      '<button class="year-btn' +
      (m === metric ? " active" : "") +
      "\" onclick=\"setHealthMetric('" +
      m +
      "')\">" +
      HEALTH_METRIC_LABELS[m] +
      "</button>";
  });
  html += "</div>";
  var prev = 0;
  stops.forEach(function (s) {
    var to = s[0] >= 9999 ? ">" + prev : prev + "–" + s[0];
    html +=
      '<div style="display:flex;align-items:center;margin-bottom:4px;">' +
      '<span class="legend-swatch" style="background:' +
      s[1] +
      ';margin-right:7px;border-color:rgba(0,0,0,.15);"></span>' +
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
    '<div class="section-note">ფართობზე დაჭ. — სრული სტატისტიკა</div>';
  el.innerHTML = html;
}

function setHealthMetric(metric) {
  activeHealthMetric = metric;
  buildHealthLayers();
}

function removeAllHealthLayers() {
  healthPolyLayer = clearLayer(healthPolyLayer);
  healthClinicLayer = clearLayer(healthClinicLayer);
}

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
  loadData("data/muni/social.json", function (d) {
    socialData = d;
    buildSocialLayer();
    loadNatureMuniCenters();
  });
}

function buildSocialLayer() {
  socialLayer = clearLayer(socialLayer);
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
      areaTooltip(layer, p.Name_Geo);
      layer.on("click", function () {
        showInfoSocial(p);
        showBottomChartSocial();
        highlightBottomBars(p.Name_Geo);
      });
    },
  }).addTo(map);
  updateSocialLegend();
  setInfoBtn("social");
  if (muniBorderOverlay) muniBorderOverlay.bringToFront();
}

function showInfoSocial(p) {
  showInfoCard('<div class="info-name" style="font-size:13px;font-weight:700;">' +
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
    "</div>");
}

function showBottomChartSocial() {
  if (!socialData) return;
  var ctx = prepareBottomChart();
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
            font: { size: 9 },
            boxWidth: 12,
            padding: 6,
          },
        },
        title: chartTitle("სოციალური დახმარება მუნიციპალიტეტების მიხედვით"),
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
          title: { display: true, text: "ოჯახები", font: { size: 8 } },
        },
        y1: {
          type: "linear",
          position: "right",
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          ticks: { font: { size: 10, weight: "500" } },
          title: { display: true, text: "პირები", font: { size: 8 } },
        },
        x: {
          ticks: { font: { size: 11, weight: "500" }, maxRotation: 35 },
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
    '<div class="section-title">' +
    SOCIAL_METRIC_LABELS[metric] +
    "</div>";
  html += '<div class="panel-btn-col">';
  ["registered", "receiving", "pension", "social_pac"].forEach(function (m) {
    html +=
      '<button class="year-btn' +
      (m === metric ? " active" : "") +
      "\" onclick=\"setSocialMetric('" +
      m +
      "')\">" +
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
      '<div style="display:flex;align-items:center;margin-bottom:4px;"><span class="legend-swatch" style="background:' +
      s[1] +
      ';margin-right:7px;border-color:rgba(0,0,0,.15);"></span><span style="font-size:10px;">' +
      to +
      "</span></div>";
    prev = s[0];
  });
  html +=
    '<div class="section-note">მუნ. ფართობზე დაჭ. — სრული სტატ.</div>';
  el.innerHTML = html;
}

function setSocialMetric(metric) {
  activeSocialMetric = metric;
  buildSocialLayer();
}

function removeAllSocialLayers() {
  socialLayer = clearLayer(socialLayer);
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


var zooLeafLayers = {}; // key -> L.geoJSON layer

var activeZooKey = "anthrax_all";

function getZooCfg(key) {
  return ZOO_LAYERS.find(function (z) {
    return z.key === key;
  });
}

// ფენის ყოველი არჩევა ახალ ნომერს იღებს (zooBuildId). მონაცემები ფონურად
// იტვირთება, ამიტომ თუ ჩატვირთვამდე სხვა დაავადება აირჩიეს ან პანელი დატოვეს,
// ძველი მოთხოვნის პასუხი რუკაზე აღარ დაემატება — ფენები ერთმანეთში არ აირევა.
var zooBuildId = 0;
var zooMuniGeoms = null; // municipalities.geojson — ერთხელ იტვირთება

function loadZoo(key) {
  activeZooKey = key;
  var id = ++zooBuildId;
  loadData("data/" + getZooCfg(key).file, function (d) {
    if (id === zooBuildId) buildZooLayer(key, d, id);
  });
}

function removeZooMapLayers() {
  Object.keys(zooLeafLayers).forEach(function (k) {
    if (zooLeafLayers[k]) {
      map.removeLayer(zooLeafLayers[k]);
      delete zooLeafLayers[k];
    }
  });
  zooMuniLayer = clearLayer(zooMuniLayer);
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

function buildZooLayer(key, data, id) {
  if (id === undefined) id = ++zooBuildId;
  removeZooMapLayers();
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
  (zooMuniGeoms
    ? Promise.resolve(zooMuniGeoms)
    : fetch(dataUrl("data/municipalities.geojson")).then(function (r) {
        return r.json();
      })
  )
    .then(function (muniData) {
      zooMuniGeoms = muniData;
      if (id !== zooBuildId) return; // სხვა ფენა უკვე აირჩიეს
      removeZooMapLayers();
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
          areaTooltip(layer, name + ": " + total);
          layer.on("click", function () {
            showInfoZooMuni(name, total, cfg, muniTotals);
            showBottomChartZoo(muniTotals, cfg);
            highlightBottomBars(name);
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
          var muni = zooNormMuni(p.Municipal_ || p.Municipal1 || "") || "";
          var name = p.Name_Geo || (p.Near_Geo ? p.Near_Geo + " · მახლობლად" : "") || muni;
          pointTooltip(marker, name + (muni && muni !== name ? " (" + muni + ")" : ""), -r / 2 - 2);
          marker.on("click", function () {
            showInfoZoo(p, cfg);
            showBottomChartZoo(muniTotals, cfg);
            highlightBottomBars(zooNormMuni(p.Municipal_ || p.Municipal1 || ""));
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
  showInfoCard('<div class="info-name" style="font-size:13px;font-weight:700;">' +
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
    '<div style="margin-top:6px;font-size:9px;color:var(--text-muted);">დეტ. — წერტილზე დაჭ.</div>');
}

function showBottomChartZoo(muniTotals, cfg) {
  var ctx = prepareBottomChart();
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
        title: chartTitle(cfg.label + " — მუნ. მიხ."),
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

// დასახლებული პუნქტი: Name_Geo — თუ წერტილი თვითონ დასახლებაა; Near_Geo/Near_m —
// უახლოესი დასახლება და მანძილი იმ ფენებისთვის, სადაც სახელი მონაცემებში არ არის
// (ჯილეხი — ყველა, ენცეფალიტი; გამოთვლილია data/settlements.geojson-იდან)
function zooPlaceRow(p) {
  if (p.Name_Geo) {
    return "<b>დასახლებული პუნქტი:</b> " + p.Name_Geo + (p.Type_Geo ? " (" + p.Type_Geo + ")" : "") + "<br>";
  }
  if (p.Near_Geo) {
    var d = p.Near_m < 1000 ? p.Near_m + " მ" : (p.Near_m / 1000).toFixed(1) + " კმ";
    return "<b>უახლოესი დასახლება:</b> " + p.Near_Geo +
      (p.Near_Type ? " (" + p.Near_Type + ")" : "") + "<br>" +
      "<b>მანძილი:</b> ~" + d + "<br>";
  }
  return "";
}

function showInfoZoo(p, cfg) {
  var muni = zooNormMuni(p.Municipal_ || p.Municipal1 || "") || "—";
  var name = p.Name_Geo || (p.Near_Geo ? p.Near_Geo + " · მახლობლად" : "") || muni;
  var cnt = cfg.countCol ? p[cfg.countCol] || "—" : "—";
  var range = p.Brucela__1 || p.Tularemia1 || p.Leptospi_1 || "";
  showInfoCard('<div class="info-name" style="font-size:13px;font-weight:700;">' +
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
    zooPlaceRow(p) +
    "<b>მუნიციპ.:</b> " +
    muni +
    "<br>" +
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
    "</div>");
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
    '<div class="section-title">ზოონოზური დაავადებები</div>';
  groups.forEach(function (g) {
    html +=
      '<div style="font-size:9px;color:var(--text-muted);margin:6px 0 3px;font-weight:700;">' +
      g.label +
      "</div>";
    // სამი ვარიანტი (ჯილეხი): „ყველა“ ცალკე ხაზზე, ქვემოთ ცხოველები | ადამიანები
    html +=
      '<div class="panel-btn-row' +
      (g.keys.length > 2 ? " first-full" : "") +
      '" style="margin-bottom:2px;">';
    g.keys.forEach(function (k) {
      var z = getZooCfg(k);
      var active = k === activeZooKey;
      var shortLabel = z.label.replace(/^[^—]+—\s*/, "");
      if (z.key === "anthrax_all") shortLabel = "ყველა";
      if (z.key === "leptospirosis") shortLabel = "ადამ./ცხ.";
      html +=
        '<button class="year-btn' +
        (active ? " active" : "") +
        "\" onclick=\"switchZooLayer('" +
        k +
        "')\">" +
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
  zooBuildId++; // ჩატვირთვის პროცესში მყოფი ფენა აღარ დაემატება
  removeZooMapLayers();
}

// ===== Start-up (called from app.js) =====
function initHealth() {
  // ქვეფენების ღილაკები (თემის გახსნა/„უკან“ — app.js, THEMES)
  bindSublayerButtons("healthsub", function () {
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
      loadZoo(activeZooKey);
      setInfoBtn(_zk);
    } else {
      loadHealth();
      setInfoBtn(HEALTH_SUB_INFO.health);
    }
    if (this.dataset.healthsub === "social") {
      setInfoBtn(HEALTH_SUB_INFO.social);
    }
  });


}
