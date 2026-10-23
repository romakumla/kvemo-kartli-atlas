// ძირითადი: რუკა, კონტროლები, საბაზისო რუკები, საზღვრები, საერთო დამხმარე ფუნქციები
// Part of the atlas script, split from the former js/main.js. Loaded first by
// index.html: creates the map and shared helpers. Code that reacts to clicks or
// loads data is in initCore(), called from app.js once every file is loaded.

// Focus outline fix — შავი ჩარჩოს მოშორება პოლიგონებზე click-ისას
(function () {
  var st = document.createElement("style");
  st.textContent =
    ".leaflet-container .leaflet-interactive:focus, .leaflet-container path:focus, .leaflet-container svg:focus { outline: none !important; }";
  document.head.appendChild(st);
})();

// ===== Chart.js: საერთო პარამეტრები =====
// ყველა დიაგრამა ერთი შრიფტით; ლეგენდა ნაგულისხმევად დამალულია —
// დიაგრამა, რომელსაც ლეგენდა სჭირდება, წერს legend: { display: true }.
Chart.defaults.font.family = "Fira Sans";
Chart.defaults.plugins.legend.display = false;

// ===== მონაცემების ვერსია =====
// მონაცემთა ფაილები (data/…) ბრაუზერის ქეშში რჩება და ახალი ვერსიის
// გამოქვეყნების შემდეგაც შეიძლება ძველი ჩაიტვირთოს. dataUrl() ყოველ
// მისამართს DATA_VERSION-ს უმატებს (?v=…), ამიტომ მისი შეცვლისას ბრაუზერი
// ფაილებს ხელახლა ჩამოტვირთავს. data/-ში ნებისმიერი ცვლილებისას ეს
// თარიღი განაახლეთ.
var DATA_VERSION = "20261022c";
function dataUrl(path) {
  return path + (path.indexOf("?") === -1 ? "?" : "&") + "v=" + DATA_VERSION;
}

// ===== Municipality-based layers =====
// Layers drawn on the 7 municipality polygons keep only their attributes in
// data/muni/<name>.json; the shared boundaries come from
// data/municipalities.geojson. A feature {"muni": i, "properties": {...}}
// gets the geometry of feature i of that file; other features (points) are
// used as they are. Returns a Response-like object, so call sites keep their
// usual .then((r) => r.json()) chain.
var _muniGeometryPromise = null;

function loadMuniData(url) {
  if (!_muniGeometryPromise) {
    _muniGeometryPromise = fetch(dataUrl("data/municipalities.geojson"))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        return d.features.map(function (f) { return f.geometry; });
      })
      .catch(function (e) {
        _muniGeometryPromise = null;
        throw e;
      });
  }
  return Promise.all([
    _muniGeometryPromise,
    fetch(dataUrl(url)).then(function (r) { return r.json(); }),
  ]).then(function (res) {
    var geoms = res[0];
    var data = res[1];
    data.features = data.features.map(function (f) {
      if (f.muni === undefined) return f;
      return { type: "Feature", properties: f.properties, geometry: geoms[f.muni] };
    });
    return { ok: true, status: 200, json: function () { return Promise.resolve(data); } };
  });
}

// ===== Map =====
// ===== მობილური ვერსია =====
// ამ სიგანემდე (ტელეფონი, ვერტიკალური პლანშეტი) ჩანს მობილური განლაგება — იხ. css/style.css
var MOBILE_MAX_WIDTH = 900;
function isMobileView() {
  return window.innerWidth <= MOBILE_MAX_WIDTH;
}

// მობილურზე zoom-ის ნაბიჯი 0.25 — რეგიონი ეკრანს უკეთ ავსებს (დიდ ეკრანზე უცვლელად 1)
var map = L.map("map", { zoomControl: false, zoomSnap: isMobileView() ? 0.25 : 1 }).setView([41.4937, 44.5242], 10);

// რეგიონის ჩვენება: დიდ ეკრანზე — ცენტრი, zoom 10 (როგორც აქამდე);
// პატარაზე — მთელი რეგიონი ეკრანზე ეტევა
function showWholeRegion() {
  if (!borderBounds) return;
  if (isMobileView()) map.fitBounds(borderBounds, { padding: [8, 8] });
  else map.setView(borderBounds.getCenter(), 10);
}

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
      showWholeRegion();
    };
    return c;
  },
});

map.addControl(new homeControl());

// ===== მასშტაბის ზოლი და ჩრდილოეთის ისარი =====
// კარტოგრაფიული სისრულისთვის — ორივე ბეჭდურ ატლასშიც სავალდებულოა
L.control
  .scale({ position: "bottomright", metric: true, imperial: false, maxWidth: 120 })
  .addTo(map);

var northControl = L.Control.extend({
  options: { position: "bottomright" },
  onAdd: function () {
    var el = L.DomUtil.create("div", "north-arrow");
    el.innerHTML =
      '<svg viewBox="0 0 24 34" width="17" height="24" aria-label="ჩრდილოეთი">' +
      '<polygon points="12,2 18,20 12,16 6,20" fill="#4A4035"/>' +
      '<polygon points="12,2 12,16 6,20" fill="#8A8078"/>' +
      '<text x="12" y="32" text-anchor="middle" font-size="10" ' +
      'font-family="Fira Sans" font-weight="700" fill="#4A4035">ჩ</text>' +
      "</svg>";
    L.DomEvent.disableClickPropagation(el);
    return el;
  },
});

map.addControl(new northControl());

// ===== Basemaps =====
var basemaps = {
  // ღია — Esri Light Gray Canvas (API გასაღები არ სჭირდება)
  light: L.layerGroup([
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        maxNativeZoom: 16,
        attribution: "© Esri, © OpenStreetMap",
      },
    ),
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, maxNativeZoom: 16 },
    ),
  ]),
  osm: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap",
  }),
  satellite: L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19, attribution: "© Esri" },
  ),
  // მუქი — Esri Dark Gray Canvas (API გასაღები არ სჭირდება)
  dark: L.layerGroup([
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        maxNativeZoom: 16,
        attribution: "© Esri, © OpenStreetMap",
      },
    ),
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, maxNativeZoom: 16 },
    ),
  ]),
  // რელიეფი — დაჩრდილული რელიეფი წყლის ქსელითა და წარწერებით
  relief: L.layerGroup([
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, maxNativeZoom: 13, attribution: "© Esri" },
    ),
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, maxNativeZoom: 16, opacity: 0.9 },
    ),
  ]),
  // ტოპოგრაფიული — ჰორიზონტალებით
  topo: L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
    maxZoom: 17,
    subdomains: "abc",
    attribution: "© OpenTopoMap (CC-BY-SA) © OpenStreetMap",
  }),
};

var currentBasemap = basemaps.light;

currentBasemap.addTo(map);

// ===== ერთიანი საზღვრის სტილი =====
// რეგიონის საზღვარი — უფრო მკვეთრი
var BORDER_COLOR = "#8B7355";

var BORDER_WEIGHT = 2;

var BORDER_DASH = "4,3";

var BORDER_OPACITY = 0.9;

// მუნიციპალიტეტების საზღვრები — უფრო წვრილი და ბაცი
var MUNI_BORDER_COLOR = "#A89985";

var MUNI_BORDER_WEIGHT = 0.8;

var MUNI_BORDER_DASH = "3,3";

var MUNI_BORDER_OPACITY = 0.5;

// ===== მთავარი ფანჯრის სტატისტიკა — სრულად ავტომატური =====
// რუკები: ქვე-ფენის ღილაკების დათვლა.
// მონაცემთა ფენები: სკრიპტი კითხულობს საკუთარ კოდს (ქეშიდან, დამატებითი
// ჩამოტვირთვის გარეშე) და ითვლის რამდენ უნიკალურ data/*.geojson-ს იყენებს.
var ATLAS_DATA_LAYERS = 72; // fallback, თუ წაკითხვა ვერ მოხერხდა

// ===== Neutral base layers (municipalities + centroids) =====
var neutralBoundaryLayer = null;

var neutralLabelLayer = null;

// საწყისი (მთავარი) ხედის მუნიციპალიტეტების ფერები
var MUNI_COLORS = {
  წალკა: "#EEC3D2",
  თეთრიწყარო: "#C5E1E4",
  დმანისი: "#D0DD98",
  ბოლნისი: "#F9C5D5",
  მარნეული: "#F6D8A2",
  გარდაბანი: "#F4E9B9",
  რუსთავი: "#D3BED3",
};

function loadNeutralLayers() {
  var generation = navGeneration; // ჩატვირთვისას თემა უკვე გახსნეს? — აღარ ვხატავთ
  // პოლიგონები — თითოეულ მუნიციპალიტეტს თავისი ფერი
  fetch(dataUrl("data/municipalities.geojson"))
    .then((r) => r.json())
    .then((data) => {
      if (generation !== navGeneration) return;
      neutralBoundaryLayer = L.geoJSON(data, {
        style: function (f) {
          var nm = (f.properties.Name_Geo || "").trim();
          return {
            fillColor: MUNI_COLORS[nm] || "#E8E4DC",
            fillOpacity: 0.75,
            color: MUNI_BORDER_COLOR,
            weight: MUNI_BORDER_WEIGHT,
            opacity: MUNI_BORDER_OPACITY,
            dashArray: MUNI_BORDER_DASH,
          };
        },
        onEachFeature: function (feature, layer) {
          var nm = (feature.properties.Name_Geo || "").trim();
          if (nm)
            areaTooltip(layer, nm);
        },
      }).addTo(map);
    });

  // ცენტრის წერტილები + წარწერები — იგივე სტილი, რაც სხვა რუკებზე
  fetch(dataUrl("data/municipalities_centroids.geojson"))
    .then((r) => r.json())
    .then((data) => {
      if (generation !== navGeneration) return;
      neutralLabelLayer = L.geoJSON(data, {
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
    });
}

function removeNeutralLayers() {
  neutralBoundaryLayer = clearLayer(neutralBoundaryLayer);
  neutralLabelLayer = clearLayer(neutralLabelLayer);
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

// ===== ნავიგაციის რიგითი ნომერი =====
// თემის გახსნა, ქვეფენის გადართვა და „უკან“ ზრდის ამ ნომერს (newNavigation()).
// ჩამოტვირთვა, რომელიც წინა ნომრისას დაიწყო, დასრულებისას ფენას აღარ ხატავს —
// ნელ ინტერნეტზე სწრაფი გადართვისას ძველი ფენა ახალ რუკაზე აღარ ჩნდება.
var navGeneration = 0;
function newNavigation() {
  navGeneration++;
}

// ===== მონაცემების ჩატვირთვა =====
// ფაილს ერთხელ ჩამოტვირთავს და ინახავს. თუ უკვე ჩატვირთულია, callback მაშინვე
// (სინქრონულად) სრულდება; თუ ჩამოტვირთვა ჯერ მიმდინარეობს, callback რიგში დგება
// და იგივე ფაილი მეორედ აღარ ითხოვება. შეცდომისას შემდეგი გამოძახება თავიდან სცდის.
// data/muni/*.json ფაილები loadMuniData()-ით იტვირთება (საზღვრებთან ერთად).
//   loadData(url, function (d) { forestData = d; buildForestLayer(d); });
// ნავიგაციის შემდეგ ძველი callback აღარ სრულდება (იხ. navGeneration);
// anyNavigation = true — სრულდება ყოველთვის (მაგ. ძიება, რომელიც რუკის ფენაზე არ არის დამოკიდებული).
var _dataStore = {};
function loadData(url, callback, anyNavigation) {
  var entry = _dataStore[url];
  if (entry && entry.loaded) {
    callback(entry.data);
    return;
  }
  if (!entry) {
    entry = _dataStore[url] = { loaded: false, data: null, callbacks: [] };
    // data/muni/*.json-ს საზღვრები data/municipalities.geojson-იდან ემატება
    (url.indexOf("data/muni/") === 0 ? loadMuniData(url) : fetch(dataUrl(url)))
      .then(function (r) {
        return r.json();
      })
      .then(
        function (d) {
          entry.loaded = true;
          entry.data = d;
          var cbs = entry.callbacks;
          entry.callbacks = [];
          cbs.forEach(function (c) {
            if (c.anyNavigation || c.generation === navGeneration) c.callback(d);
          });
        },
        function (err) {
          delete _dataStore[url];
          console.error("ვერ ჩაიტვირთა " + url, err);
        }
      );
  }
  entry.callbacks.push({
    callback: callback,
    generation: navGeneration,
    anyNavigation: !!anyNavigation,
  });
}

// რამდენიმე ფაილი ერთად: callback იღებს მასივს იმავე რიგით, როცა ყველა ჩაიტვირთება
//   loadDataAll([url1, url2], function (d) { aData = d[0]; bData = d[1]; });
// (კომენტარებში ფაილის სახელს ბრჭყალებში ნუ დაწერთ — ATLAS_DATA_LAYERS-ის მთვლელი მას ფენად ჩათვლის)
function loadDataAll(urls, callback) {
  var results = new Array(urls.length);
  var left = urls.length;
  urls.forEach(function (url, i) {
    loadData(url, function (d) {
      results[i] = d;
      if (--left === 0) callback(results);
    });
  });
}

// ===== ქვეფენების ღილაკები =====
// [data-<attr>] ღილაკები: უკვე არჩეულზე ხელახლა დაწკაპება არაფერს აკეთებს, არჩეული
// ღილაკი მოინიშნება და შემდეგ სრულდება onSelect (მასში this = დაწკაპებული ღილაკი).
function bindSublayerButtons(attr, onSelect) {
  var selector = "[data-" + attr + "]";
  document.querySelectorAll(selector).forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (this.classList.contains("active")) return; // იგივეზე ხელახლა დაწკაპება
      document.querySelectorAll(selector).forEach(function (b) {
        b.classList.remove("active");
      });
      this.classList.add("active");
      newNavigation();
      onSelect.call(this);
    });
  });
}

// ===== ფენის მოხსნა =====
// თუ ფენა რუკაზეა, მოხსნის; ყოველთვის აბრუნებს null-ს, ამიტომ გამოყენება:
//   someLayer = clearLayer(someLayer);
function clearLayer(layer) {
  if (layer) map.removeLayer(layer);
  return null;
}

// ===== საერთო ელემენტები: info card, tooltip, დიაგრამის სათაური =====
// info card-ის შევსება და გამოჩენა
function showInfoCard(html) {
  var content = document.getElementById("infoCardContent");
  content.innerHTML = html;
  document.getElementById("infoCard").classList.remove("hidden");
}

// პოლიგონის tooltip: ცენტრში, მაუსს მიჰყვება
function areaTooltip(layer, text) {
  return layer.bindTooltip(text, {
    direction: "center",
    className: "village-label",
    sticky: true,
  });
}

// წერტილის tooltip: ნიშნის ზემოთ; dy — ვერტიკალური წანაცვლება (მაგ. -12)
function pointTooltip(marker, text, dy) {
  var opts = { direction: "top", className: "village-label" };
  if (dy !== undefined) opts.offset = [0, dy];
  return marker.bindTooltip(text, opts);
}

// ქვედა დიაგრამის სათაური, ერთიანი სტილით (size — შრიფტის ზომა, ნაგულისხმევად 11)
function chartTitle(text, size) {
  return {
    display: true,
    text: text,
    font: { size: size || 11, weight: "600" },
    color: "#1A1A18",
    padding: { bottom: 6 },
  };
}

// ===== ქვედა დიაგრამა: მომზადება =====
// ყოველი ქვედა დიაგრამა ასე იწყება: ტილო ჩანს, „ცარიელის“ წარწერა იმალება,
// წინა დიაგრამა იშლება. აბრუნებს ახალი დიაგრამის ხატვის კონტექსტს (ctx).
function prepareBottomChart() {
  // მობილურზე დიაგრამა ქვემოდან ამოსრიალდება (body.mob-chart, css/style.css)
  if (isMobileView()) document.body.classList.add("mob-chart");
  var canvas = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display = "none";
  canvas.classList.remove("hidden");
  if (bottomChart) bottomChart.destroy();
  return canvas.getContext("2d");
}

// ===== ქვედა დიაგრამა: დაწკაპებული ობიექტის გამოყოფა =====
// ქვედა დიაგრამები ყველა სვეტით სრული ფერით იხატება. რუკაზე ობიექტის
// დაწკაპებისას highlightBottomBars() სრულ ფერს მხოლოდ ამ ობიექტის სვეტ(ებ)ს
// უტოვებს, დანარჩენს აბაცებს, ასე რომ რუკა და დიაგრამა ერთსა და იმავეზე
// მიუთითებს. ბაცი სვეტის სიძლიერე ყველა დიაგრამაზე ერთია (BAR_FADE_ALPHA).
//   match — სვეტის წარწერა, წარწერების მასივი, ან ფუნქცია (label, index) → true/false
// თუ არცერთი სვეტი არ დაემთხვა, დიაგრამა უცვლელი რჩება (ყველა სვეტი სრული ფერით).
var BAR_FADE_ALPHA = 0.25;

// მუნიციპალიტეტის სახელი მონაცემებში სხვადასხვა ფორმითაა: „ბოლნისი“,
// შეკვეცილი „ბოლნისის მუნიციპა“, „ქალაქ რუსთავის მუნ“, „Bolnisi Municipality“.
// muniName() ყველას ერთ ფორმამდე დაიყვანს: „ბოლნისი“. უცნობზე — "".
var MUNI_FORMS = [
  ["ბოლნისი", "ბოლნისის", "Bolnisi"],
  ["მარნეული", "მარნეულის", "Marneuli"],
  ["დმანისი", "დმანისის", "Dmanisi"],
  ["რუსთავი", "რუსთავის", "Rustavi"],
  ["წალკა", "წალკის", "Tsalka", "walka"],
  ["თეთრიწყარო", "თეთრიწყაროს", "Tetritskaro", "tetriwkaro", "Tetri-tskaro"],
  ["გარდაბანი", "გარდაბნის", "Gardabani"],
];
function muniName(raw) {
  var s = String(raw || "").trim().replace(/^(ქალაქ|q\.)\s+/, "").toLowerCase();
  for (var i = 0; i < MUNI_FORMS.length; i++) {
    var f = MUNI_FORMS[i];
    for (var k = 0; k < f.length; k++) {
      var form = f[k].toLowerCase();
      if (s === form || (k > 0 && s.indexOf(form + " ") === 0)) return f[0];
    }
  }
  return "";
}

function fadeColor(c) {
  if (typeof c !== "string") return c;
  var s = c.trim();
  var r, g, b, a = 1, m;
  if (s.charAt(0) === "#") {
    var h = s.slice(1);
    if (h.length === 3 || h.length === 4)
      h = h.split("").map(function (x) { return x + x; }).join("");
    if (h.length !== 6 && h.length !== 8) return c;
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
    if (h.length === 8) a = parseInt(h.slice(6, 8), 16) / 255;
  } else if ((m = s.match(/^rgba?\(([^)]+)\)$/i))) {
    var p = m[1].split(",").map(function (x) { return parseFloat(x); });
    r = p[0]; g = p[1]; b = p[2];
    if (p.length > 3) a = p[3];
  } else {
    return c;
  }
  return "rgba(" + r + "," + g + "," + b + "," + +(a * BAR_FADE_ALPHA).toFixed(3) + ")";
}

// onlyDataset (არასავალდებულო): მონიშნოს მხოლოდ ამ dataset-ის სვეტი (დაჯგუფებულ
// დიაგრამაზე — მაგ. მხოლოდ ლითონური საბადოები არჩეულ მუნიციპალიტეტში)
function highlightBottomBars(match, onlyDataset) {
  var ch = bottomChart;
  if (!ch || !ch.data || !ch.data.labels) return false;
  // ინგლისურ რეჟიმში წარწერები ნათარგმნია; შედარება — ქართულ ორიგინალთან (js/i18n.js)
  var labels = (ch.data.labels.$orig || ch.data.labels).map(function (l) {
    return Array.isArray(l) ? l.join(" ") : String(l);
  });
  var test =
    typeof match === "function"
      ? match
      : Array.isArray(match)
        ? function (l) { return match.indexOf(l) !== -1; }
        : function (l) { return l === String(match); };
  var on = labels.map(function (l, i) { return !!test(l, i); });
  if (on.indexOf(true) === -1) return false;
  var first = on.indexOf(true);
  ch.data.datasets.forEach(function (ds, di) {
    var dsOn = onlyDataset === undefined || di === onlyDataset;
    var legend = {};
    ["backgroundColor", "borderColor"].forEach(function (prop) {
      var v = ds[prop];
      if (v === undefined) return;
      var base = labels.map(function (_, i) { return Array.isArray(v) ? v[i] : v; });
      legend[prop] = base[first];
      ds[prop] = base.map(function (c, i) { return on[i] && dsOn ? c : fadeColor(c); });
    });
    ds._legendColor = legend;
  });
  // სვეტის წარწერაც: არჩეული — მუქი, დანარჩენი — ბაცი
  var o = ch.config.options;
  if (["pie", "doughnut", "polarArea", "radar"].indexOf(ch.config.type) === -1) {
    // ლეგენდის ფერი არ ბაცდება (Chart.js მას პირველი სვეტიდან იღებს)
    o.plugins = o.plugins || {};
    o.plugins.legend = o.plugins.legend || {};
    o.plugins.legend.labels = o.plugins.legend.labels || {};
    o.plugins.legend.labels.generateLabels = function (chart) {
      var items = Chart.defaults.plugins.legend.labels.generateLabels(chart);
      items.forEach(function (it) {
        var lc = (chart.data.datasets[it.datasetIndex] || {})._legendColor;
        if (lc && lc.backgroundColor) it.fillStyle = lc.backgroundColor;
        if (lc && lc.borderColor) it.strokeStyle = lc.borderColor;
      });
      return items;
    };
    var axis = o.indexAxis === "y" ? "y" : "x";
    o.scales = o.scales || {};
    o.scales[axis] = o.scales[axis] || {};
    o.scales[axis].ticks = o.scales[axis].ticks || {};
    o.scales[axis].ticks.color = function (c) {
      return on[c.index] ? "#1A1A18" : "#999";
    };
  }
  ch.update();
  return true;
}

var activeSublayer = null;

var popLayerActive = false;

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
// ქვედა პანელის გადართვისას რუკის კონტეინერი იცვლება —
// Leaflet-ს ეს უნდა შევატყობინოთ, თორემ ფილები ძველ ზომაზე რჩება
// და რუკის ქვედა ნაწილი პანელის ქვეშ ექცევა
function refreshMapSize() {
  if (typeof map === "undefined" || !map.invalidateSize) return;
  requestAnimationFrame(function () {
    map.invalidateSize({ animate: false });
  });
  setTimeout(function () {
    map.invalidateSize({ animate: false });
  }, 220);
}

function showChartPanel() {
  document.getElementById("chartPanel").style.display = "flex";
  document.body.classList.add("chart-open");
  var ib = document.getElementById("infoBar");
  if (ib) ib.style.display = "none";
  refreshMapSize();
}

function hideChartPanel() {
  document.body.classList.remove("mob-chart");
  document.getElementById("chartPanel").style.display = "none";
  document.body.classList.remove("chart-open");
  refreshMapSize();
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
  document.body.classList.remove("mob-chart");
  document.getElementById("chartEmpty").style.display = "flex";
  document.getElementById("chartCanvas").classList.add("hidden");
  if (bottomChart) {
    bottomChart.destroy();
    bottomChart = null;
  }
}

function removeAllThematic() {
  currentLayer = clearLayer(currentLayer);
  ethnicsLayer = clearLayer(ethnicsLayer);
  religionLayer = clearLayer(religionLayer);
  deathLayerRef.layer = clearLayer(deathLayerRef.layer);
  birthLayerRef.layer = clearLayer(birthLayerRef.layer);
  densityLayerRef.layer = clearLayer(densityLayerRef.layer);
  maritalMenLayer = clearLayer(maritalMenLayer);
  maritalWomenLayer = clearLayer(maritalWomenLayer);
  idpPolyLayer = clearLayer(idpPolyLayer);
  idpPointLayer = clearLayer(idpPointLayer);
  document.getElementById("infoCard").classList.add("hidden");
  document.getElementById("chartEmpty").style.display = "flex";
  document.getElementById("chartCanvas").classList.add("hidden");
}

// ===== Start-up (called from app.js) =====
function initCore() {
  (function updateAtlasStats() {
    var m = document.getElementById("statMaps");
    if (m) {
      var maps = document.querySelectorAll(
        "[data-sublayer],[data-naturesub],[data-histsub],[data-econsub]," +
          "[data-edusub],[data-toursub],[data-healthsub]"
      ).length;
      if (maps > 0) m.textContent = maps;
    }

    var l = document.getElementById("statLayers");
    if (!l) return;
    l.textContent = ATLAS_DATA_LAYERS;

    // ატლასის სკრიპტი რამდენიმე ფაილადაა (js/*.js) — ვკითხულობთ ყველას
    var srcs = Array.prototype.map
      .call(document.querySelectorAll("script[src]"), function (t) {
        return t.src;
      })
      .filter(function (s) {
        return /\/js\/[^\/]+\.js(\?|$)/.test(s);
      });
    if (!srcs.length) return;

    Promise.all(
      srcs.map(function (s) {
        return fetch(s).then(function (r) {
          return r.ok ? r.text() : "";
        });
      })
    )
      .then(function (texts) {
        var txt = texts.join("\n");
        if (!txt) return;
        var hits = txt.match(/['"]data\/(?:muni\/)?[A-Za-z0-9_.\-]+\.(?:geojson|json)['"]/g);
        if (!hits) return;
        var uniq = {};
        hits.forEach(function (h) {
          uniq[h.slice(1, -1)] = 1;
        });
        var n = Object.keys(uniq).length;
        if (n > 0) l.textContent = n;
      })
      .catch(function () {
        /* ხელმისაწვდომი არაა — fallback რჩება */
      });
  })();



  // ===== გვერდითი პანელების სიგანის რეგულირება =====
  // კიდეზე გადასაწევი სახელური; არჩევანი ინახება ბრაუზერში.
  (function initPanelResizers() {
    var MIN = 150,
      MAX = 420;

    function apply(varName, px) {
      var root = document.documentElement;
      root.style.setProperty(varName, px + "px");
      // ტექსტიც იზრდება სიგანესთან ერთად (170px → 10px … 420px → 14px)
      var wide = Math.max(
        parseInt(getComputedStyle(root).getPropertyValue("--side-w-left")) || 170,
        parseInt(getComputedStyle(root).getPropertyValue("--side-w-right")) || 170
      );
      var f = Math.max(10, Math.min(14, 10 + (wide - 170) / 62));
      root.style.setProperty("--panel-font", f.toFixed(1) + "px");
      root.style.setProperty("--panel-label-font", (f + 1).toFixed(1) + "px");
    }

    function restore(key, varName) {
      var v = parseInt(localStorage.getItem(key) || "", 10);
      if (v && v >= MIN && v <= MAX) apply(varName, v);
    }
    try {
      restore("atlasPanelLeft", "--side-w-left");
      restore("atlasPanelRight", "--side-w-right");
    } catch (e) {}

    function setup(panelId, side, varName, storeKey) {
      var panel = document.getElementById(panelId);
      if (!panel) return;
      var h = document.createElement("div");
      h.className = "panel-resizer " + side + "-resizer";
      h.title = "გადაათრიეთ სიგანის შესაცვლელად (ორმაგი დაწკაპება — საწყისი)";
      // სახელური პანელის *გვერდით* ჩნდება, არა შიგნით —
      // თორემ სქროლვად შიგთავსს ემატებოდა და ჰორიზონტალურ სქროლს იწვევდა
      var parent = panel.parentNode;
      if (!parent || !parent.insertBefore) return;
      if (side === "left") parent.insertBefore(h, panel.nextSibling);
      else parent.insertBefore(h, panel);

      var startX = 0,
        startW = 0,
        dragging = false;

      function onMove(e) {
        if (!dragging) return;
        var dx = e.clientX - startX;
        var w = side === "left" ? startW + dx : startW - dx;
        w = Math.max(MIN, Math.min(MAX, Math.round(w)));
        apply(varName, w);
        if (typeof map !== "undefined" && map.invalidateSize) map.invalidateSize();
      }
      function onUp() {
        if (!dragging) return;
        dragging = false;
        h.classList.remove("dragging");
        document.body.classList.remove("resizing-panel");
        try {
          localStorage.setItem(storeKey, parseInt(panel.offsetWidth, 10));
        } catch (e) {}
        if (typeof map !== "undefined" && map.invalidateSize) map.invalidateSize();
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      }

      h.addEventListener("mousedown", function (e) {
        e.preventDefault();
        dragging = true;
        startX = e.clientX;
        startW = panel.offsetWidth;
        h.classList.add("dragging");
        document.body.classList.add("resizing-panel");
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });

      // ორმაგი დაწკაპებით — საწყისი სიგანე
      h.addEventListener("dblclick", function () {
        apply(varName, 170);
        try {
          localStorage.setItem(storeKey, 170);
        } catch (e) {}
        if (typeof map !== "undefined" && map.invalidateSize) map.invalidateSize();
      });
    }

    setup("layerPanel", "left", "--side-w-left", "atlasPanelLeft");
    setup("basemapPanel", "right", "--side-w-right", "atlasPanelRight");
  })();


  // ===== Georgia border (always visible) =====
  loadMuniData("data/muni/georgia_border.json")
    .then((r) => r.json())
    .then((data) => {
      var bl = L.geoJSON(data, {
        style: {
          color: BORDER_COLOR,
          weight: BORDER_WEIGHT,
          fill: false,
          dashArray: BORDER_DASH,
          opacity: BORDER_OPACITY,
        },
      }).addTo(map);
      borderBounds = bl.getBounds();
      map.invalidateSize();
      showWholeRegion();
    });
}
