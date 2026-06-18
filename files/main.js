// ===== Map =====
var map = L.map("map", { zoomControl: false }).setView([41.4937, 44.5242], 10);
L.control.zoom({ position: "topright" }).addTo(map);

var borderBounds = null;

var homeControl = L.Control.extend({
  options: { position: "topright" },
  onAdd: function () {
    var c = L.DomUtil.create("div", "leaflet-bar leaflet-control leaflet-control-custom");
    c.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="#1f1f1f"><path d="M200-200v-240h80v160h160v80H200Zm480-320v-160H520v-80h240v240h-80Z"/></svg>`;
    c.title = "Zoom to full extent";
    c.style.cssText = "background:white;width:30px;height:30px;display:flex;justify-content:center;align-items:center;cursor:pointer;";
    c.onclick = function () { if (borderBounds) map.setView(borderBounds.getCenter(), 10); };
    return c;
  },
});
map.addControl(new homeControl());

// ===== Basemaps =====
var basemaps = {
  light:     L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",   { maxZoom:19, attribution:"© OpenStreetMap © CARTO" }),
  osm:       L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",               { maxZoom:19, attribution:"© OpenStreetMap" }),
  satellite: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom:19, attribution:"© Esri" }),
  dark:      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",    { maxZoom:19, attribution:"© OpenStreetMap © CARTO" }),
};
var currentBasemap = basemaps.light;
currentBasemap.addTo(map);

// ===== Georgia border (always visible) =====
fetch("data/georgia_border.geojson")
  .then(r => r.json())
  .then(data => {
    var bl = L.geoJSON(data, { style:{ color:"#8B0000", weight:2, fill:false, dashArray:"4,2", opacity:0.7 } }).addTo(map);
    borderBounds = bl.getBounds();
    map.invalidateSize();
    map.setView(borderBounds.getCenter(), 10);
  });

// ===== Neutral base layers (municipalities + centroids) =====
var neutralBoundaryLayer = null;
var neutralLabelLayer    = null;

function loadNeutralLayers() {
  // პოლიგონალური საზღვრები
  fetch("data/municipalities.geojson")
    .then(r => r.json())
    .then(data => {
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
    .then(r => r.json())
    .then(data => {
      neutralLabelLayer = L.geoJSON(data, {
        pointToLayer: function(feature, latlng) {
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
  if (neutralBoundaryLayer) { map.removeLayer(neutralBoundaryLayer); neutralBoundaryLayer = null; }
  if (neutralLabelLayer)    { map.removeLayer(neutralLabelLayer);    neutralLabelLayer    = null; }
}

// ===== State =====
var allFeatures    = [];
var currentLayer   = null;
var ethnicsLayer   = null;
var religionLayer  = null;
var activeType     = "all";
var activeMuni     = "all";
var selectedProps  = null;
var censusScope    = "selected";
var censusChart    = null;
var bottomChart    = null;
var activeSublayer = null;
var popLayerActive = false;

// ===== Population helpers =====
function getColor(type) {
  if (type === "ქალაქი") return { fill:"#C8102E", stroke:"#8B0000" };
  if (type === "დაბა")   return { fill:"#E8821A", stroke:"#A05010" };
  return                         { fill:"#4A90D9", stroke:"#1A5090" };
}
function getRadius(pop, type) {
  if (!pop||pop<=0) { if(type==="ქალაქი")return 14; if(type==="დაბა")return 7; return 4; }
  return Math.max(4, Math.min(22, 4+18*Math.sqrt(pop/159016)));
}

// ===== Build population points layer =====
function buildPopLayer(features) {
  if (currentLayer) map.removeLayer(currentLayer);
  currentLayer = L.geoJSON({ type:"FeatureCollection", features:features }, {
    pointToLayer: function(feature, latlng) {
      var p    = feature.properties;
      var type = p.Type_Geo || "სოფელი";
      var c    = getColor(type);
      var r    = getRadius(p.Pop_2014, type);
      var name = p.Name_Geo || p.Name_Eng || "";
      var marker = L.circleMarker(latlng, { radius:r, fillColor:c.fill, color:c.stroke, weight:1.5, fillOpacity:0.75 });
      if (map.getZoom()>=12)
        marker.bindTooltip(name,{permanent:true,direction:"top",className:"village-label",offset:[0,-r-2]});
      marker.on("mouseover", function() {
        this.setStyle({fillOpacity:1,weight:2.5});
        if (!this.getTooltip()) this.bindTooltip(name,{direction:"top",className:"village-label",offset:[0,-r-2]}).openTooltip();
      });
      marker.on("mouseout", function() {
        this.setStyle({fillOpacity:0.75,weight:1.5});
        if (map.getZoom()<12) this.unbindTooltip();
      });
      marker.on("click", function() {
        selectedProps = p;
        showInfoPop(p);
        showBottomChart(p);
        enableCensusBtn();
      });
      return marker;
    },
  }).addTo(map);
}

// ===== Ethnics helpers =====
var ETH_COLORS = { Georgian:"#2E7D32", Azerbaijani:"#1565C0", Armenian:"#6A1B9A", Others:"#795548" };
var ETH_LABELS = { Georgian:"ქართველი", Azerbaijani:"აზერბაიჯანელი", Armenian:"სომეხი", Others:"სხვა" };

function getDominant(p) {
  return ["Georgian","Azerbaijani","Armenian","Others"].reduce(function(a,b){ return (p[a]||0)>(p[b]||0)?a:b; });
}
function ethFill(p) {
  var dom=getDominant(p); return { base:ETH_COLORS[dom], alpha:0.25+(p[dom]||0)/100*0.6 };
}

function buildEthnicsLayer(data) {
  if (ethnicsLayer) map.removeLayer(ethnicsLayer);
  ethnicsLayer = L.geoJSON(data, {
    style: function(f) { var x=ethFill(f.properties); return {fillColor:x.base,fillOpacity:x.alpha,color:x.base,weight:2,opacity:0.8}; },
    onEachFeature: function(feature,layer) {
      var p=feature.properties;
      layer.on("click",    function() { showInfoEth(p); showBottomChartEth(p); });
      layer.on("mouseover",function() { layer.setStyle({weight:3,fillOpacity:Math.min(1,ethFill(p).alpha+0.15)}); });
      layer.on("mouseout", function() { ethnicsLayer.resetStyle(layer); });
    },
  }).addTo(map);
  updateLegend("ethnics");
}

// ===== Religion helpers =====
var REL_COLORS = { Orthodox:"#1565C0", Muslim:"#2E7D32", Armenian_A:"#6A1B9A", Other_Reli:"#795548" };
var REL_LABELS = { Orthodox:"მართლმადიდებელი", Muslim:"მუსლიმი", Armenian_A:"სომხ. სამოციქ.", Other_Reli:"სხვა" };

function getDominantRel(p) {
  return ["Orthodox","Muslim","Armenian_A","Other_Reli"].reduce(function(a,b){ return (p[a]||0)>(p[b]||0)?a:b; });
}
function relFill(p) {
  var dom=getDominantRel(p); return { base:REL_COLORS[dom], alpha:0.25+(p[dom]||0)/100*0.6 };
}

function buildReligionLayer(data) {
  if (religionLayer) map.removeLayer(religionLayer);
  religionLayer = L.geoJSON(data, {
    style: function(f) { var x=relFill(f.properties); return {fillColor:x.base,fillOpacity:x.alpha,color:x.base,weight:2,opacity:0.8}; },
    onEachFeature: function(feature,layer) {
      var p=feature.properties;
      layer.on("click",    function() { showInfoRel(p); showBottomChartRel(p); });
      layer.on("mouseover",function() { layer.setStyle({weight:3,fillOpacity:Math.min(1,relFill(p).alpha+0.15)}); });
      layer.on("mouseout", function() { religionLayer.resetStyle(layer); });
    },
  }).addTo(map);
  updateLegend("religion");
}

// ===== Load data =====
var allSettlements = null;
var ethnicsData    = null;
var religionData   = null;

function loadSettlements(cb) {
  if (allSettlements) { allFeatures=allSettlements; if(cb)cb(); return; }
  fetch("data/settlements.geojson").then(r=>r.json()).then(data=>{
    allSettlements=data.features; allFeatures=data.features; if(cb)cb();
  });
}
function loadEthnics(cb) {
  if (ethnicsData) { buildEthnicsLayer(ethnicsData); if(cb)cb(); return; }
  fetch("data/ethnics.geojson").then(r=>r.json()).then(data=>{ ethnicsData=data; buildEthnicsLayer(data); if(cb)cb(); });
}
function loadReligion(cb) {
  if (religionData) { buildReligionLayer(religionData); if(cb)cb(); return; }
  fetch("data/religion.geojson").then(r=>r.json()).then(data=>{ religionData=data; buildReligionLayer(data); if(cb)cb(); });
}

// ===== Remove all thematic layers =====
function removeAllThematic() {
  if (currentLayer)           { map.removeLayer(currentLayer);           currentLayer=null; }
  if (ethnicsLayer)           { map.removeLayer(ethnicsLayer);           ethnicsLayer=null; }
  if (religionLayer)          { map.removeLayer(religionLayer);          religionLayer=null; }
  if (deathLayerRef.layer)    { map.removeLayer(deathLayerRef.layer);    deathLayerRef.layer=null; }
  if (birthLayerRef.layer)    { map.removeLayer(birthLayerRef.layer);    birthLayerRef.layer=null; }
  if (densityLayerRef.layer)  { map.removeLayer(densityLayerRef.layer);  densityLayerRef.layer=null; }
  if (maritalMenLayer)        { map.removeLayer(maritalMenLayer);        maritalMenLayer=null; }
  if (maritalWomenLayer)      { map.removeLayer(maritalWomenLayer);      maritalWomenLayer=null; }
  document.getElementById("infoCard").classList.add("hidden");
  document.getElementById("chartEmpty").style.display="flex";
  document.getElementById("chartCanvas").classList.add("hidden");
}

// ===== Switch sublayer =====
function switchSublayer(sub) {
  activeSublayer = sub;
  removeAllThematic();

  var filterSec = document.getElementById("filterSection");

  if (sub === "population") {
    document.getElementById("filterSection").style.display = "";
    loadSettlements(function() { applyFilters(); });
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
  }
}

// ===== Filters (population) =====
function applyFilters() {
  var filtered = allFeatures.filter(function(f) {
    var p=f.properties;
    return (activeType==="all"||p.Type_Geo===activeType)&&(activeMuni==="all"||p.Municipal_===activeMuni);
  });
  buildPopLayer(filtered);
  document.getElementById("statVisible").textContent = filtered.length;
  document.getElementById("statTotal").textContent   = allFeatures.length;
}

// ===== Zoom labels =====
map.on("zoomend", function() {
  if (!currentLayer) return;
  currentLayer.eachLayer(function(layer) {
    var p=layer.feature.properties;
    var name=p.Name_Geo||p.Name_Eng||"";
    var r=getRadius(p.Pop_2014,p.Type_Geo);
    if (map.getZoom()>=12) layer.bindTooltip(name,{permanent:true,direction:"top",className:"village-label",offset:[0,-r-2]});
    else layer.unbindTooltip();
  });
});

// ===== Legend =====
function updateLegend(type) {
  var el=document.getElementById("legendContent"); if(!el) return;
  var colors = type==="ethnics" ? ETH_COLORS : REL_COLORS;
  var labels = type==="ethnics" ? ETH_LABELS : REL_LABELS;
  el.innerHTML='<div class="ethnics-legend">'+
    Object.entries(labels).map(function([k,v]){
      return `<div class="eth-legend-item"><span class="eth-dot" style="background:${colors[k]};border-radius:3px;"></span><span>${v} (დომინ.)</span></div>`;
    }).join("")+'</div>';
}

function resetPopLegend() {
  var el=document.getElementById("legendContent"); if(!el) return;
  el.innerHTML=`
    <div class="legend-item"><span class="legend-dot" style="background:#C8102E;border:2px solid #8B0000;"></span><span>ქალაქი</span></div>
    <div class="legend-item"><span class="legend-dot" style="background:#E8821A;border:2px solid #A05010;"></span><span>დაბა</span></div>
    <div class="legend-item"><span class="legend-dot" style="background:#4A90D9;border:2px solid #1A5090;"></span><span>სოფელი</span></div>`;
}

// ===== Info cards =====
function showInfoPop(p) {
  var typeGeo=p.Type_Geo||"სოფელი";
  var bc=typeGeo==="ქალაქი"?"badge-city":typeGeo==="დაბა"?"badge-town":"badge-village";
  function fmt(n){ return n!=null?parseInt(n).toLocaleString("ka-GE"):"–"; }
  document.getElementById("infoCardContent").innerHTML=`
    <div class="info-name">${p.Name_Geo||p.Name_Eng||"უცნობი"}</div>
    <span class="info-type-badge ${bc}">${typeGeo}</span>
    <div class="info-row"><span class="info-key">ინგლ. სახელი</span><span class="info-val">${p.Name_Eng||"–"}</span></div>
    <div class="info-row"><span class="info-key">მუნიციპ.</span><span class="info-val">${p.Municipal_||"–"}</span></div>
    <div class="info-row"><span class="info-key">ოიკონიმია</span><span class="info-val">${p.Oikonymy||"–"}</span></div>
    <div class="info-row"><span class="info-key">მთიანი</span><span class="info-val">${p.High_Mount||"–"}</span></div>
    <hr style="margin:8px 0;border-top:1px solid #f0ede8;">
    <div class="info-row"><span class="info-key">1989</span><span class="info-val">${fmt(p.Pop_1989)}</span></div>
    <div class="info-row"><span class="info-key">2002</span><span class="info-val">${fmt(p.Pop_2002)}</span></div>
    <div class="info-row"><span class="info-key">2014</span><span class="info-val pop-num">${fmt(p.Pop_2014)}</span></div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showInfoEth(p) {
  var dom=getDominant(p);
  var bars=["Georgian","Azerbaijani","Armenian","Others"].map(function(key){
    var pct=p[key]||0;
    return `<div class="eth-bar-row"><span class="eth-bar-label">${ETH_LABELS[key]}</span>
      <div class="eth-bar-track"><div class="eth-bar-fill" style="width:${pct}%;background:${ETH_COLORS[key]};"></div></div>
      <span class="eth-bar-pct">${pct}%</span></div>`;
  }).join("");
  document.getElementById("infoCardContent").innerHTML=`
    <div class="info-name">${p.Name_Geo||p.Name_Eng||"–"}</div>
    <div style="margin-top:8px;font-size:10px;color:var(--text-muted);margin-bottom:4px;">ეროვნული შემადგენლობა (2014)</div>
    <div class="eth-bar-wrap">${bars}</div>
    <div class="info-row" style="margin-top:8px;"><span class="info-key">დომინანტი</span><span class="info-val" style="color:${ETH_COLORS[dom]}">${ETH_LABELS[dom]}</span></div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showInfoRel(p) {
  var dom=getDominantRel(p);
  var bars=["Orthodox","Muslim","Armenian_A","Other_Reli"].map(function(key){
    var pct=p[key]||0;
    return `<div class="eth-bar-row"><span class="eth-bar-label" style="width:64px;">${REL_LABELS[key]}</span>
      <div class="eth-bar-track"><div class="eth-bar-fill" style="width:${pct}%;background:${REL_COLORS[key]};"></div></div>
      <span class="eth-bar-pct">${pct}%</span></div>`;
  }).join("");
  document.getElementById("infoCardContent").innerHTML=`
    <div class="info-name">${p.Name_Geo||p.Name_Eng||"–"}</div>
    <div style="margin-top:8px;font-size:10px;color:var(--text-muted);margin-bottom:4px;">აღმსარებლობა (2014)</div>
    <div class="eth-bar-wrap">${bars}</div>
    <div class="info-row" style="margin-top:8px;"><span class="info-key">დომინანტი</span><span class="info-val" style="color:${REL_COLORS[dom]}">${REL_LABELS[dom]}</span></div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

// ===== Density helpers =====
// ლოგარითმული სკალა — რუსთავის გამო (1796 vs დანარჩენი <130)
var DENSITY_BREAKS = [
  { max: 25,   color: "#BDD7E7", label: "< 25" },
  { max: 50,   color: "#BDD7E7", label: "25–50" },
  { max: 100,  color: "#6BAED6", label: "51–100" },
  { max: 200,  color: "#2171B5", label: "101–200" },
  { max: 99999,color: "#08306B", label: "> 200" },
];

function getDensityColor(val) {
  if (val == null) return "#CCCCCC";
  for (var i = 0; i < DENSITY_BREAKS.length; i++) {
    if (val <= DENSITY_BREAKS[i].max) return DENSITY_BREAKS[i].color;
  }
  return DENSITY_BREAKS[DENSITY_BREAKS.length-1].color;
}

var activeDensityYear = "2024";
var densityLayerRef   = { layer: null };
var densityData       = null;

function buildDensityLayer(data) {
  if (densityLayerRef.layer) map.removeLayer(densityLayerRef.layer);
  var field = "De_" + activeDensityYear;
  densityLayerRef.layer = L.geoJSON(data, {
    style: function(feat) {
      var val = feat.properties[field];
      return { fillColor: getDensityColor(val), fillOpacity: 0.78, color: "#4A6FA5", weight: 1.5, opacity: 0.9 };
    },
    onEachFeature: function(feature, layer) {
      var p = feature.properties;
      layer.on("click",    function() { showInfoDensity(p); showBottomChartDensity(p); });
      layer.on("mouseover",function() { layer.setStyle({ weight:3, fillOpacity:0.95 }); });
      layer.on("mouseout", function() { densityLayerRef.layer.resetStyle(layer); });
    },
  }).addTo(map);
  updateDensityLegend();
}

function loadDensity() {
  if (densityData) { buildDensityLayer(densityData); return; }
  fetch("data/density.geojson").then(r=>r.json()).then(data=>{
    densityData = data; buildDensityLayer(data);
  });
}

function updateDensityLegend() {
  var el = document.getElementById("legendContent"); if (!el) return;
  var years = ["1989","2002","2014","2024"];
  var html = `<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">სიმჭიდროვე (კაცი/კმ²)</div>`;
  html += '<div class="ethnics-legend">';
  DENSITY_BREAKS.forEach(function(b) {
    html += `<div class="eth-legend-item">
      <span class="eth-dot" style="background:${b.color};border:1px solid rgba(0,0,0,0.15);border-radius:3px;"></span>
      <span>${b.label}</span>
    </div>`;
  });
  html += `</div><div style="margin-top:10px;">
    <div style="font-size:9px;font-weight:700;color:var(--text-muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;">წელი</div>
    <div style="display:flex;gap:4px;flex-wrap:wrap;">
      ${years.map(y=>`<button class="year-btn ${activeDensityYear===y?'active':''}" data-dyear="${y}">${y}</button>`).join("")}
    </div></div>`;
  el.innerHTML = html;
  el.querySelectorAll("[data-dyear]").forEach(function(btn) {
    btn.addEventListener("click", function() {
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
    ${row("1989","De_1989")}${row("2002","De_2002")}${row("2014","De_2014")}${row("2024","De_2024")}`;
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
      labels: ["1989","2002","2014","2024"],
      datasets: [{ label:"კაცი/კმ²", data: vals,
        borderColor: "#2171B5", backgroundColor: "rgba(33,113,181,0.1)",
        borderWidth: 2.5, pointRadius: 5, pointBackgroundColor: "#2171B5",
        fill: true, tension: 0.3 }],
    },
    options: { responsive:true, maintainAspectRatio:false,
      plugins: {
        legend: { display:false },
        title: { display:true, text:`${p.Name_Geo||""} — მოსახლეობის სიმჭიდროვე (კაცი/კმ²)`, font:{family:"Fira Sans",size:12,weight:"600"}, color:"#1A1A18", padding:{bottom:6} },
        tooltip: { callbacks: { label: c => ` ${c.parsed.y} კაცი/კმ²` } }
      },
      scales: {
        y: { beginAtZero:true, grid:{color:"rgba(0,0,0,0.05)"}, ticks:{font:{family:"Fira Sans",size:10},color:"#6B6862"} },
        x: { ticks:{font:{family:"Fira Sans",size:11},color:"#1A1A18"}, grid:{display:false} },
      },
    },
  });
}

// ===== Marital Status — Pie Charts on Map =====
var MARITAL_COLORS = {
  Married:  "#2166AC",
  NMarried: "#74ADD1",
  Widow:    "#F46D43",
  Divorced: "#D73027",
  NoData:   "#CCCCCC",
};
var MARITAL_LABELS = {
  Married:  "ქორწინებაში",
  NMarried: "არასდ. ყოფილა",
  Widow:    "ქვრივი",
  Divorced: "განქ./განშ.",
  NoData:   "არ არის მითით.",
};

var maritalYear   = "2014";
var maritalGender = "men";
var maritalMenLayer   = null;
var maritalWomenLayer = null;
var maritalMenData    = null;
var maritalWomenData  = null;

// SVG pie chart
function makePieSVG(values, size) {
  var keys   = ["Married","NMarried","Widow","Divorced","NoData"];
  var total  = keys.reduce(function(s,k){ return s+(values[k]||0); }, 0);
  if (total === 0) return "";
  var cx=size/2, cy=size/2, r=size/2-2;
  var startAngle = -Math.PI/2;
  var paths = "";
  keys.forEach(function(key) {
    var val = values[key]||0;
    if (val === 0) return;
    var angle = (val/total)*2*Math.PI;
    var endAngle = startAngle+angle;
    var x1=cx+r*Math.cos(startAngle), y1=cy+r*Math.sin(startAngle);
    var x2=cx+r*Math.cos(endAngle),   y2=cy+r*Math.sin(endAngle);
    var largeArc = angle>Math.PI?1:0;
    paths += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z" fill="${MARITAL_COLORS[key]}" stroke="white" stroke-width="0.8"/>`;
    startAngle = endAngle;
  });
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="white" stroke="#ccc" stroke-width="1"/>
    ${paths}
    <circle cx="${cx}" cy="${cy}" r="${r*0.38}" fill="white"/>
  </svg>`;
}

function buildMaritalLayer(data, gender) {
  var yr = maritalYear;
  var layer = L.geoJSON(data, {
    pointToLayer: function(feature, latlng) {
      var p = feature.properties;
      var vals = {
        Married:  p["Married_"+yr],
        NMarried: p["NMarried_"+yr],
        Widow:    p["Widow_"+yr],
        Divorced: p["Divorced_"+yr],
        NoData:   p["NoData_"+yr],
      };
      var size = 90;
      var svg = makePieSVG(vals, size);
      var icon = L.divIcon({
        html: `<div style="position:relative;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2));">
          ${svg}
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:11px;font-weight:700;color:#222;font-family:'Fira Sans',sans-serif;white-space:nowrap;text-align:center;line-height:1.2;pointer-events:none;">${p.Name_Geo}</div>
        </div>`,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2],
        className: "",
      });
      var marker = L.marker(latlng, { icon: icon });
      marker.on("click", function() {
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
    renderMaritalLayers(); return;
  }
  var pending = 2;
  function done() { if(--pending===0) renderMaritalLayers(); }
  if (!maritalMenData) {
    fetch("data/marital_men.geojson").then(r=>r.json()).then(data=>{ maritalMenData=data; done(); });
  } else done();
  if (!maritalWomenData) {
    fetch("data/marital_women.geojson").then(r=>r.json()).then(data=>{ maritalWomenData=data; done(); });
  } else done();
}

function renderMaritalLayers() {
  if (maritalMenLayer)   { map.removeLayer(maritalMenLayer);   maritalMenLayer=null; }
  if (maritalWomenLayer) { map.removeLayer(maritalWomenLayer); maritalWomenLayer=null; }
  maritalMenLayer   = buildMaritalLayer(maritalMenData,   "men");
  maritalWomenLayer = buildMaritalLayer(maritalWomenData, "women");
  // gender toggle — ვმალავთ არაქტიურს
  if (maritalGender === "men") {
    maritalWomenLayer.eachLayer(function(l){ l.setOpacity(0); if(l.setIcon) l.getElement() && (l.getElement().style.display="none"); });
  } else {
    maritalMenLayer.eachLayer(function(l){ l.getElement() && (l.getElement().style.display="none"); });
  }
  updateMaritalLegend();
}

function setMaritalGenderVisible() {
  var showMen   = maritalGender === "men";
  var showWomen = maritalGender === "women";
  if (maritalMenLayer) maritalMenLayer.eachLayer(function(l){
    var el=l.getElement(); if(el) el.style.display=showMen?"":"none";
  });
  if (maritalWomenLayer) maritalWomenLayer.eachLayer(function(l){
    var el=l.getElement(); if(el) el.style.display=showWomen?"":"none";
  });
}

function updateMaritalLegend() {
  var el=document.getElementById("legendContent"); if(!el) return;
  var html=`<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">ქორწინებითი მდგომარეობა</div>`;
  html+='<div class="ethnics-legend">';
  Object.entries(MARITAL_LABELS).forEach(function([k,v]){
    html+=`<div class="eth-legend-item"><span class="eth-dot" style="background:${MARITAL_COLORS[k]};border-radius:50%;"></span><span>${v}</span></div>`;
  });
  html+=`</div>
  <div style="margin-top:10px;">
    <div style="font-size:9px;font-weight:700;color:var(--text-muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;">სქესი</div>
    <div style="display:flex;gap:6px;margin-bottom:8px;">
      <button class="year-btn ${maritalGender==='men'?'active':''}" data-mgender="men">მამაკაცი</button>
      <button class="year-btn ${maritalGender==='women'?'active':''}" data-mgender="women">ქალი</button>
    </div>
    <div style="font-size:9px;font-weight:700;color:var(--text-muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;">წელი</div>
    <div style="display:flex;gap:6px;">
      <button class="year-btn ${maritalYear==='2002'?'active':''}" data-myear="2002">2002</button>
      <button class="year-btn ${maritalYear==='2014'?'active':''}" data-myear="2014">2014</button>
    </div>
  </div>`;
  el.innerHTML=html;
  el.querySelectorAll("[data-mgender]").forEach(function(btn){
    btn.addEventListener("click",function(){
      maritalGender=this.dataset.mgender;
      setMaritalGenderVisible();
      updateMaritalLegend();
    });
  });
  el.querySelectorAll("[data-myear]").forEach(function(btn){
    btn.addEventListener("click",function(){
      maritalYear=this.dataset.myear;
      renderMaritalLayers();
    });
  });
}

function showInfoMarital(p, gender) {
  var yr=maritalYear;
  var gLabel=gender==="men"?"მამაკაცი":"ქალი";
  function row(key) {
    var val=p[key+"_"+yr]||0;
    return `<div class="info-row"><span class="info-key" style="display:flex;align-items:center;gap:5px;">
      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${MARITAL_COLORS[key]};flex-shrink:0;"></span>${MARITAL_LABELS[key]}</span>
      <span class="info-val">${val} ‰</span></div>`;
  }
  document.getElementById("infoCardContent").innerHTML=`
    <div class="info-name">${p.Name_Geo||"–"}</div>
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

  var yr     = maritalYear;
  var gLabel = gender === "men" ? "მამაკაცი" : "ქალი";
  var keys   = ["Married","NMarried","Widow","Divorced","NoData"];
  var labels = keys.map(k => MARITAL_LABELS[k]);
  var values = keys.map(k => p[k+"_"+yr] || 0);
  var colors = keys.map(k => MARITAL_COLORS[k]);

  bottomChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "‰",
        data: values,
        backgroundColor: colors.map(c => c + "CC"),
        borderColor: colors,
        borderWidth: 2,
        borderRadius: 5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: `${p.Name_Geo} — ქორწინებითი მდგომარეობა · ${gLabel} · ${yr} (‰)`,
          font: { family:"Fira Sans", size:12, weight:"600" },
          color: "#1A1A18",
          padding: { bottom: 6 },
        },
        tooltip: {
          callbacks: {
            label: function(c) { return ` ${c.parsed.y} ‰  (ყოველ 1000-ზე)`; }
          }
        },
        datalabels: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 800,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: { font:{family:"Fira Sans",size:10}, color:"#6B6862",
            callback: function(v) { return v + " ‰"; } },
        },
        x: {
          ticks: { font:{family:"Fira Sans",size:10}, color:"#1A1A18", maxRotation:0 },
          grid: { display: false },
        },
      },
      // რიცხვები ბარების თავზე
      animation: {
        onComplete: function() {
          var chart = this;
          var ctx2  = chart.ctx;
          ctx2.font = "bold 10px 'Fira Sans', sans-serif";
          ctx2.fillStyle = "#333";
          ctx2.textAlign = "center";
          ctx2.textBaseline = "bottom";
          chart.data.datasets.forEach(function(dataset, i) {
            var meta = chart.getDatasetMeta(i);
            meta.data.forEach(function(bar, index) {
              var val = dataset.data[index];
              if (val > 0) {
                ctx2.fillText(val + " ‰", bar.x, bar.y - 3);
              }
            });
          });
        }
      },
    },
  });
}

// ===== Death Rate & Birth Rate helpers =====
var DEATH_COLORS = {
  "<9":      "#FFF5F0",
  "9-10":    "#FCBBA1",
  "10.1-11": "#FC8D59",
  "11.1-12": "#D7301F",
  "12.1-13": "#990000",
  ">13.1":   "#4D0000",
};
var BIRTH_COLORS = {
  "<9.9":      "#C7E9C0",
  "10-11.4":   "#A1D99B",
  "11.5-12.9": "#74C476",
  "13.1-14.4": "#238B45",
  ">14.5":     "#00441B",
};

function getRateColor(val, colorMap) { return colorMap[val] || "#CCCCCC"; }

var activeRateYear = "2012";
var deathLayerRef  = { layer: null, type: "death" };
var birthLayerRef  = { layer: null, type: "birth" };
var deathData = null;
var birthData = null;

function buildRateLayer(data, f12, f22, colorMap, ref) {
  if (ref.layer) map.removeLayer(ref.layer);
  var field = activeRateYear === "2012" ? f12 : f22;
  ref.layer = L.geoJSON(data, {
    style: function(feat) {
      var val = feat.properties[field] || "";
      return { fillColor:getRateColor(val,colorMap), fillOpacity:0.75, color:"#555", weight:1.5, opacity:0.8 };
    },
    onEachFeature: function(feature, layer) {
      var p = feature.properties;
      layer.on("click", function() { showInfoRate(p,f12,f22,colorMap,ref.type); showBottomChartRate(p,f12,f22,ref.type); });
      layer.on("mouseover", function() { layer.setStyle({weight:3,fillOpacity:0.9}); });
      layer.on("mouseout",  function() { ref.layer.resetStyle(layer); });
    },
  }).addTo(map);
}

function loadDeathRate() {
  if (deathData) { buildRateLayer(deathData,"Death_2012","Death_2022",DEATH_COLORS,deathLayerRef); updateRateLegend("death"); return; }
  fetch("data/death_rate.geojson").then(r=>r.json()).then(data=>{
    deathData=data; buildRateLayer(data,"Death_2012","Death_2022",DEATH_COLORS,deathLayerRef); updateRateLegend("death");
  });
}

function loadBirthRate() {
  if (birthData) { buildRateLayer(birthData,"Birth_2012","Birth_2022",BIRTH_COLORS,birthLayerRef); updateRateLegend("birth"); return; }
  fetch("data/birth_rate.geojson").then(r=>r.json()).then(data=>{
    birthData=data; buildRateLayer(data,"Birth_2012","Birth_2022",BIRTH_COLORS,birthLayerRef); updateRateLegend("birth");
  });
}

function updateRateLegend(type) {
  var el = document.getElementById("legendContent"); if (!el) return;
  var colorMap = type==="death" ? DEATH_COLORS : BIRTH_COLORS;
  var title    = type==="death" ? "მოკვდავობა (‰)" : "შობადობა (‰)";
  var html = `<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">${title}</div>`;
  html += '<div class="ethnics-legend">';
  Object.entries(colorMap).forEach(function([range,color]) {
    html += `<div class="eth-legend-item"><span class="eth-dot" style="background:${color};border:1px solid rgba(0,0,0,0.15);border-radius:3px;"></span><span>${range}</span></div>`;
  });
  html += `</div><div style="margin-top:10px;">
    <div style="font-size:9px;font-weight:700;color:var(--text-muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;">წელი</div>
    <div style="display:flex;gap:6px;">
      <button class="year-btn ${activeRateYear==='2012'?'active':''}" data-year="2012">2012</button>
      <button class="year-btn ${activeRateYear==='2022'?'active':''}" data-year="2022">2022</button>
    </div></div>`;
  el.innerHTML = html;
  el.querySelectorAll(".year-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      activeRateYear = this.dataset.year;
      if (activeSublayer==="death_rate") loadDeathRate();
      if (activeSublayer==="birth_rate") loadBirthRate();
    });
  });
}

function showInfoRate(p, f12, f22, colorMap, type) {
  var label = type==="death" ? "მოკვდავობა" : "შობადობა";
  var v12=p[f12]||"–", v22=p[f22]||"–";
  document.getElementById("infoCardContent").innerHTML = `
    <div class="info-name">${p.Name_Geo||p.Name_Eng||"–"}</div>
    <div style="margin-top:6px;font-size:10px;color:var(--text-muted);margin-bottom:8px;">${label}ის ზოგ. კოეფიციენტი (‰)</div>
    <div class="info-row"><span class="info-key">2012</span>
      <span class="info-val" style="display:flex;align-items:center;gap:6px;">
        <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${getRateColor(v12,colorMap)};border:1px solid rgba(0,0,0,.15);flex-shrink:0;"></span>${v12}
      </span></div>
    <div class="info-row"><span class="info-key">2022</span>
      <span class="info-val" style="display:flex;align-items:center;gap:6px;">
        <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${getRateColor(v22,colorMap)};border:1px solid rgba(0,0,0,.15);flex-shrink:0;"></span>${v22}
      </span></div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartRate(p, f12, f22, type) {
  var canvas=document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display="none";
  canvas.classList.remove("hidden");
  var ctx=canvas.getContext("2d");
  if(bottomChart)bottomChart.destroy();
  var label  = type==="death" ? "მოკვდავობა" : "შობადობა";
  var bgCols = type==="death" ? ["rgba(203,27,27,0.2)","rgba(153,0,13,0.2)"] : ["rgba(65,171,93,0.2)","rgba(0,109,44,0.2)"];
  var bdCols = type==="death" ? ["#CB1B1B","#99000D"] : ["#41AB5D","#006D2C"];
  function mid(s) {
    if (!s||s==="–") return null;
    if (s.startsWith(">")) return parseFloat(s.slice(1))+0.5;
    if (s.startsWith("<")) return parseFloat(s.slice(1))-0.5;
    var pts=s.split("-"); if(pts.length===2) return (parseFloat(pts[0])+parseFloat(pts[1]))/2;
    return null;
  }
  bottomChart=new Chart(ctx,{type:"bar",
    data:{labels:["2012","2022"],datasets:[{label:label,data:[mid(p[f12]),mid(p[f22])],
      backgroundColor:bgCols,borderColor:bdCols,borderWidth:2,borderRadius:6}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},
        title:{display:true,text:`${p.Name_Geo||""} — ${label}ის კოეფ. (‰)`,font:{family:"Fira Sans",size:12,weight:"600"},color:"#1A1A18",padding:{bottom:6}},
        tooltip:{callbacks:{label:c=>` ${c.parsed.y} ‰  (${c.dataIndex===0?p[f12]:p[f22]})`}}},
      scales:{y:{beginAtZero:false,grid:{color:"rgba(0,0,0,0.05)"},ticks:{font:{family:"Fira Sans",size:10},color:"#6B6862"}},
        x:{ticks:{font:{family:"Fira Sans",size:12,weight:"600"},color:"#1A1A18"},grid:{display:false}}},
    },
  });
}

document.getElementById("infoClose").addEventListener("click", function() {
  document.getElementById("infoCard").classList.add("hidden");
});

// ===== Bottom charts =====
function showBottomChart(p) {
  var canvas=document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display="none";
  canvas.classList.remove("hidden");
  var ctx=canvas.getContext("2d");
  if(bottomChart)bottomChart.destroy();
  var name=p.Name_Geo||p.Name_Eng||"ობიექტი";
  bottomChart=new Chart(ctx,{
    type:"bar",
    data:{labels:["1989","2002","2014"],datasets:[{label:name,data:[p.Pop_1989||0,p.Pop_2002||0,p.Pop_2014||0],
      backgroundColor:["rgba(200,16,46,0.15)","rgba(74,144,217,0.15)","rgba(232,130,26,0.15)"],
      borderColor:["#C8102E","#4A90D9","#E8821A"],borderWidth:2,borderRadius:6}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},
        title:{display:true,text:`${name}  —  ${p.Type_Geo||""}  |  ${p.Municipal_||""}`,font:{family:"Fira Sans",size:12,weight:"600"},color:"#1A1A18",padding:{bottom:6}},
        tooltip:{callbacks:{label:c=>" "+c.parsed.y.toLocaleString("ka-GE")}}},
      scales:{y:{beginAtZero:true,grid:{color:"rgba(0,0,0,0.05)"},ticks:{font:{family:"Fira Sans",size:10},color:"#6B6862",callback:v=>v.toLocaleString()}},
        x:{ticks:{font:{family:"Fira Sans",size:11},color:"#1A1A18"},grid:{display:false}}},
    },
  });
}

function showBottomChartEth(p) {
  var canvas=document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display="none";
  canvas.classList.remove("hidden");
  var ctx=canvas.getContext("2d");
  if(bottomChart)bottomChart.destroy();
  var keys=["Georgian","Azerbaijani","Armenian","Others"];
  bottomChart=new Chart(ctx,{type:"doughnut",
    data:{labels:keys.map(k=>ETH_LABELS[k]),datasets:[{data:keys.map(k=>p[k]||0),
      backgroundColor:keys.map(k=>ETH_COLORS[k]+"bb"),borderColor:keys.map(k=>ETH_COLORS[k]),borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:"right",labels:{font:{family:"Fira Sans",size:11},color:"#1A1A18",padding:10}},
        title:{display:true,text:`${p.Name_Geo||""} — ეროვნული შემადგენლობა 2014`,font:{family:"Fira Sans",size:12,weight:"600"},color:"#1A1A18",padding:{bottom:6}},
        tooltip:{callbacks:{label:c=>` ${c.label}: ${c.parsed}%`}}}},
  });
}

function showBottomChartRel(p) {
  var canvas=document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display="none";
  canvas.classList.remove("hidden");
  var ctx=canvas.getContext("2d");
  if(bottomChart)bottomChart.destroy();
  var keys=["Orthodox","Muslim","Armenian_A","Other_Reli"];
  bottomChart=new Chart(ctx,{type:"doughnut",
    data:{labels:keys.map(k=>REL_LABELS[k]),datasets:[{data:keys.map(k=>p[k]||0),
      backgroundColor:keys.map(k=>REL_COLORS[k]+"bb"),borderColor:keys.map(k=>REL_COLORS[k]),borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:"right",labels:{font:{family:"Fira Sans",size:11},color:"#1A1A18",padding:10}},
        title:{display:true,text:`${p.Name_Geo||""} — აღმსარებლობა 2014`,font:{family:"Fira Sans",size:12,weight:"600"},color:"#1A1A18",padding:{bottom:6}},
        tooltip:{callbacks:{label:c=>` ${c.label}: ${c.parsed}%`}}}},
  });
}

// ===== Census Modal =====
function enableCensusBtn() {
  var btn=document.getElementById("btnCensus");
  btn.disabled=false; btn.style.opacity="1"; btn.style.cursor="pointer"; btn.title="";
}

function sumPop(features,field){ return features.reduce(function(s,f){return s+(f.properties[field]||0);},0); }

function getCensusData() {
  if(!selectedProps)return null;
  if(censusScope==="selected") return {label:selectedProps.Name_Geo||selectedProps.Name_Eng,pop89:selectedProps.Pop_1989||0,pop02:selectedProps.Pop_2002||0,pop14:selectedProps.Pop_2014||0,rows:[selectedProps]};
  if(censusScope==="muni") {
    var muni=selectedProps.Municipal_;
    var mf=allFeatures.filter(f=>f.properties.Municipal_===muni);
    return {label:selectedProps.Municipal_||"მუნიციპ.",pop89:sumPop(mf,"Pop_1989"),pop02:sumPop(mf,"Pop_2002"),pop14:sumPop(mf,"Pop_2014"),rows:mf.map(f=>f.properties)};
  }
  return {label:"ქვემო ქართლი",pop89:sumPop(allFeatures,"Pop_1989"),pop02:sumPop(allFeatures,"Pop_2002"),pop14:sumPop(allFeatures,"Pop_2014"),rows:allFeatures.map(f=>f.properties)};
}

function renderCensusModal() {
  var data=getCensusData(); if(!data)return;
  document.getElementById("censusSubtitle").textContent=data.label+" — 1989 · 2002 · 2014";
  var ctx=document.getElementById("censusCanvas").getContext("2d");
  if(censusChart)censusChart.destroy();
  var chg=data.pop89>0?((data.pop14-data.pop89)/data.pop89*100).toFixed(1):"–";
  censusChart=new Chart(ctx,{type:"bar",
    data:{labels:["1989","2002","2014"],datasets:[{label:"მოსახლეობა",data:[data.pop89,data.pop02,data.pop14],
      backgroundColor:["rgba(200,16,46,0.18)","rgba(74,144,217,0.18)","rgba(232,130,26,0.18)"],
      borderColor:["#C8102E","#4A90D9","#E8821A"],borderWidth:2.5,borderRadius:8}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},
        title:{display:true,text:`${data.label}  |  1989→2014: ${chg}%`,font:{family:"Fira Sans",size:12,weight:"600"},color:"#1A1A18",padding:{bottom:8}},
        tooltip:{callbacks:{label:c=>" "+c.parsed.y.toLocaleString("ka-GE")+" კაცი"}}},
      scales:{y:{beginAtZero:true,grid:{color:"rgba(0,0,0,0.05)"},ticks:{font:{family:"Fira Sans",size:10},color:"#6B6862",callback:v=>v.toLocaleString()}},
        x:{ticks:{font:{family:"Fira Sans",size:12,weight:"600"},color:"#1A1A18"},grid:{display:false}}},
    },
  });
  function fmt(n){return n?parseInt(n).toLocaleString("ka-GE"):"–";}
  function chgCell(a,b){if(!a||!b)return"<span>–</span>";var p=((b-a)/a*100).toFixed(1);return`<span class="${p>=0?"change-pos":"change-neg"}">${p>=0?"+":""}${p}%</span>`;}
  var rows=data.rows.filter(p=>p.Pop_2014||p.Pop_1989).sort((a,b)=>(b.Pop_2014||0)-(a.Pop_2014||0)).slice(0,8);
  document.getElementById("censusTable").innerHTML=
    `<div class="census-table-row census-table-head"><span>დასახლება</span><span>1989</span><span>2002</span><span>2014</span><span>ცვლ.</span></div>`+
    rows.map(p=>`<div class="census-table-row"><span>${p.Name_Geo||p.Name_Eng||"–"}</span><span>${fmt(p.Pop_1989)}</span><span>${fmt(p.Pop_2002)}</span><span>${fmt(p.Pop_2014)}</span>${chgCell(p.Pop_1989,p.Pop_2014)}</div>`).join("");
}

document.getElementById("btnCensus").addEventListener("click", function() {
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
document.querySelectorAll(".scope-btn").forEach(function(btn) {
  btn.addEventListener("click", function() {
    document.querySelectorAll(".scope-btn").forEach(b=>b.classList.remove("active"));
    this.classList.add("active"); censusScope=this.dataset.scope; renderCensusModal();
  });
});

// ===== Agrovlimat layer =====
var agrovlimatLayer   = null;
var agrovlimatData    = null;
var natureMuniLayer   = null;  // მუნიც. ცენტრები ბუნების რუკებზე

var AGRO_ZONE_ORDER = ['dry_subtropical','trans_subtropical','warm_temperate','mod_warm_temperate','trans_cold_temperate','mod_cold','cold'];

var AGRO_LABELS = {
  'cold':                'ცივი',
  'mod_cold':            'ზომიერად ცივი',
  'trans_cold_temperate':'ზომიერადან ცივზე გარდამავალი',
  'mod_warm_temperate':  'ზომიერად თბილი',
  'warm_temperate':      'თბილი',
  'trans_subtropical':   'სუბტრ.→ზომიერ. გარდამავალი',
  'dry_subtropical':     'მშრალი სუბტროპიკული',
};

// მუნიციპალური ცენტრები ბუნების ფენებზე
function loadNatureMuniCenters() {
  if (natureMuniLayer) return;
  fetch("data/municipalities_centroids.geojson")
    .then(r=>r.json())
    .then(data=>{
      natureMuniLayer = L.geoJSON(data, {
        pointToLayer: function(feature, latlng) {
          var name = feature.properties.Name_Geo || "";
          var marker = L.circleMarker(latlng, {
            radius: 5, fillColor: "#4A4035", color: "#fff",
            weight: 1.5, fillOpacity: 0.9,
          });
          marker.bindTooltip(name, {
            permanent: true, direction: "top",
            className: "muni-label", offset: [0, -8],
          });
          return marker;
        },
      }).addTo(map);
    });
}

function removeNatureMuniCenters() {
  if (natureMuniLayer) { map.removeLayer(natureMuniLayer); natureMuniLayer = null; }
}

function buildAgrovlimatLayer(data) {
  if (agrovlimatLayer) map.removeLayer(agrovlimatLayer);
  agrovlimatLayer = L.geoJSON(data, {
    style: function(feat) {
      return { fillColor:feat.properties.ZoneColor, fillOpacity:0.75, color:"#888", weight:0.5, opacity:0.8 };
    },
    onEachFeature: function(feature, layer) {
      var p=feature.properties;
      layer.on("click",    function() { showInfoAgro(p); showBottomChartAgro(p, data); });
      layer.on("mouseover",function() { layer.setStyle({weight:2,fillOpacity:0.92}); });
      layer.on("mouseout", function() { agrovlimatLayer.resetStyle(layer); });
    },
  }).addTo(map);
  updateAgroLegend(data);
}

function loadAgrovlimat() {
  if (agrovlimatData) { buildAgrovlimatLayer(agrovlimatData); loadNatureMuniCenters(); return; }
  fetch("data/agrovlimat.geojson").then(r=>r.json()).then(data=>{
    agrovlimatData=data; buildAgrovlimatLayer(data); loadNatureMuniCenters();
  });
}

function updateAgroLegend(data) {
  var el=document.getElementById("legendContent"); if(!el) return;
  var seen={};
  data.features.forEach(function(f){ var p=f.properties; if(!seen[p.ZoneKey]) seen[p.ZoneKey]=p.ZoneColor; });
  var html=`<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">აგროკლიმატური რაიონები</div><div class="ethnics-legend">`;
  AGRO_ZONE_ORDER.forEach(function(key) {
    if (!seen[key]) return;
    html+=`<div class="eth-legend-item"><span class="eth-dot" style="background:${seen[key]};border:1px solid rgba(0,0,0,0.2);border-radius:3px;"></span><span style="font-size:10px;">${AGRO_LABELS[key]}</span></div>`;
  });
  html+='</div>';
  el.innerHTML=html;
}

function showInfoAgro(p) {
  document.getElementById("infoCardContent").innerHTML=`
    <div class="info-name" style="font-size:13px;">${p.ZoneLabel}</div>
    <span class="info-type-badge badge-village" style="background:${p.ZoneColor}22;color:${p.ZoneColor};border:1px solid ${p.ZoneColor}55;">${p.Zone_Geo}</span>
    <div style="margin-top:10px;font-size:10px;color:var(--text-muted);line-height:1.6;">${p.Name_Geo}</div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartAgro(p, data) {
  var canvas=document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display="none";
  canvas.classList.remove("hidden");
  var ctx=canvas.getContext("2d");
  if(bottomChart)bottomChart.destroy();

  // ჯამური ფართობი ზონების მიხედვით
  var areas={}, colors={}, labels={};
  data.features.forEach(function(f){
    var k=f.properties.ZoneKey;
    areas[k]  = (areas[k]||0) + (f.properties.Area_km2||0);
    colors[k] = f.properties.ZoneColor;
    labels[k] = f.properties.ZoneLabel || AGRO_LABELS[k];
  });

  // ფართობის მიხედვით დავალაგოთ კლებადობით
  var sorted = Object.keys(areas).sort(function(a,b){ return areas[b]-areas[a]; });

  bottomChart=new Chart(ctx,{type:"bar",
    data:{
      labels: sorted.map(k=>labels[k]),
      datasets:[{
        label:"ფართობი (კმ²)",
        data:  sorted.map(k=>Math.round(areas[k])),
        backgroundColor: sorted.map(k=>colors[k]+"CC"),
        borderColor:     sorted.map(k=>colors[k]),
        borderWidth:2, borderRadius:5,
      }],
    },
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        title:{display:true,
          text:`აგროკლიმ. ზონები — ${p.ZoneLabel} (ფართობი კმ²)`,
          font:{family:"Fira Sans",size:12,weight:"600"},color:"#1A1A18",padding:{bottom:6}},
        tooltip:{callbacks:{label:c=>` ${c.parsed.y.toLocaleString()} კმ²`}},
      },
      scales:{
        y:{beginAtZero:true,grid:{color:"rgba(0,0,0,0.05)"},
          ticks:{font:{family:"Fira Sans",size:10},color:"#6B6862",
            callback:function(v){return v.toLocaleString()+" კმ²";}}},
        x:{ticks:{font:{family:"Fira Sans",size:9},color:"#1A1A18",maxRotation:20},grid:{display:false}},
      },
      animation:{
        onComplete:function(){
          var chart=this; var ctx2=chart.ctx;
          ctx2.font="bold 9px 'Fira Sans',sans-serif";
          ctx2.fillStyle="#444"; ctx2.textAlign="center"; ctx2.textBaseline="bottom";
          chart.data.datasets.forEach(function(ds,i){
            chart.getDatasetMeta(i).data.forEach(function(bar,idx){
              var val=ds.data[idx];
              if(val>0) ctx2.fillText(val.toLocaleString()+" კმ²", bar.x, bar.y-3);
            });
          });
        }
      },
    },
  });
}

// ===== Landscape Layers =====
var landscapeLayer      = null;
var landscapeAntropLayer= null;
var landscapeData       = null;
var landscapeAntropData = null;

var LANDSCAPE_ORDER = ['ქვედა მთები (რცხილა, მხე)','საშ. მთები (წიფლნარები)','სუბალპური ტყე-ბუჩქნარები','ალპური მდელოები','მთისწინეთი (არიდული)','ვაკეები (ნახევრარუდული)','მდინარეთა ჭალები'];
var ANTROP_ORDER   = ['უმნიშვნელოდ შეცვლილი','საშუალოდ შეცვლილი','ძლიერ შეცვლილი','პრაქტიკულად გარდაქმნილი'];

function buildLandscapeLayer(data, layerRef) {
  if (layerRef.layer) map.removeLayer(layerRef.layer);
  var noBorder = layerRef.noBorder || false;
  layerRef.layer = L.geoJSON(data, {
    style: function(feat) {
      return {
        fillColor:   feat.properties.LandColor,
        fillOpacity: 0.72,
        color:       noBorder ? feat.properties.LandColor : "#888",
        weight:      noBorder ? 0.5 : 0.5,
        opacity:     noBorder ? 0 : 0.7,
      };
    },
    onEachFeature: function(feature, layer) {
      var p = feature.properties;
      layer.on("click",    function() { showInfoLandscape(p); showBottomChartLandscape(p, data, layerRef.order); });
      layer.on("mouseover",function() { layer.setStyle({weight:2, fillOpacity:0.9}); });
      layer.on("mouseout", function() { layerRef.layer.resetStyle(layer); });
    },
  }).addTo(map);
  updateLandscapeLegend(data, layerRef.order);
}

var landscapeLayerRef      = { layer:null, order:LANDSCAPE_ORDER };
var landscapeAntropLayerRef= { layer:null, order:ANTROP_ORDER, noBorder:true };

function loadLandscape() {
  if (landscapeData) { buildLandscapeLayer(landscapeData, landscapeLayerRef); loadNatureMuniCenters(); return; }
  fetch("data/landscape.geojson").then(r=>r.json()).then(data=>{
    landscapeData=data; buildLandscapeLayer(data, landscapeLayerRef); loadNatureMuniCenters();
  });
}

function loadLandscapeAntrop() {
  if (landscapeAntropData) { buildLandscapeLayer(landscapeAntropData, landscapeAntropLayerRef); loadNatureMuniCenters(); return; }
  fetch("data/landscape_antrop.geojson").then(r=>r.json()).then(data=>{
    landscapeAntropData=data; buildLandscapeLayer(data, landscapeAntropLayerRef); loadNatureMuniCenters();
  });
}

function updateLandscapeLegend(data, order) {
  var el=document.getElementById("legendContent"); if(!el) return;
  var seen={};
  data.features.forEach(function(f){ var p=f.properties; if(!seen[p.LandLabel]) seen[p.LandLabel]=p.LandColor; });

  var html=`<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">ლანდშაფტის ტიპი</div><div class="ethnics-legend">`;
  order.forEach(function(label){
    if(!seen[label]) return;
    html+=`<div class="eth-legend-item"><span class="eth-dot" style="background:${seen[label]};border:1px solid rgba(0,0,0,0.15);border-radius:3px;"></span><span style="font-size:10px;">${label}</span></div>`;
  });
  html+='</div>';
  el.innerHTML=html;
}

function showInfoLandscape(p) {
  document.getElementById("infoCardContent").innerHTML=`
    <div class="info-name" style="font-size:13px;">${p.LandLabel}</div>
    <span class="info-type-badge badge-village" style="background:${p.LandColor}33;color:#333;border:1px solid ${p.LandColor}88;">${p.Area_km2} კმ²</span>
    <div style="margin-top:10px;font-size:10px;color:var(--text-muted);line-height:1.6;">${p.Name_Geo||p.Name_Eng||"–"}</div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartLandscape(p, data, order) {
  var canvas=document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display="none";
  canvas.classList.remove("hidden");
  var ctx=canvas.getContext("2d"); if(bottomChart)bottomChart.destroy();

  // ჯამური ფართობი ლეიბლების მიხედვით
  var areas={}, colors={};
  data.features.forEach(function(f){
    var k=f.properties.LandLabel;
    areas[k]  = (areas[k]||0) + (f.properties.Area_km2||0);
    colors[k] = f.properties.LandColor;
  });

  // order-ის მიხედვით, მაგრამ ფართობის კლებადობით
  var sorted = Object.keys(areas).sort(function(a,b){ return areas[b]-areas[a]; });

  bottomChart=new Chart(ctx,{type:"bar",
    data:{
      labels: sorted.map(k=>k),
      datasets:[{
        label:"ფართობი (კმ²)",
        data:  sorted.map(k=>Math.round(areas[k])),
        backgroundColor: sorted.map(k=>colors[k]+"CC"),
        borderColor:     sorted.map(k=>colors[k]),
        borderWidth:2, borderRadius:5,
      }],
    },
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        title:{display:true,
          text:`${p.LandLabel} — ლანდშაფტები ფართობის მიხედვით (კმ²)`,
          font:{family:"Fira Sans",size:12,weight:"600"},color:"#1A1A18",padding:{bottom:6}},
        tooltip:{callbacks:{label:c=>` ${c.parsed.y.toLocaleString()} კმ²`}},
      },
      scales:{
        y:{beginAtZero:true,grid:{color:"rgba(0,0,0,0.05)"},
          ticks:{font:{family:"Fira Sans",size:10},color:"#6B6862",callback:v=>v.toLocaleString()+" კმ²"}},
        x:{ticks:{font:{family:"Fira Sans",size:9},color:"#1A1A18",maxRotation:25},grid:{display:false}},
      },
      animation:{onComplete:function(){
        var chart=this; var ctx2=chart.ctx;
        ctx2.font="bold 9px 'Fira Sans',sans-serif"; ctx2.fillStyle="#444";
        ctx2.textAlign="center"; ctx2.textBaseline="bottom";
        chart.data.datasets.forEach(function(ds,i){
          chart.getDatasetMeta(i).data.forEach(function(bar,idx){
            var val=ds.data[idx];
            if(val>0) ctx2.fillText(val.toLocaleString()+" კმ²", bar.x, bar.y-3);
          });
        });
      }},
    },
  });
}

// ===== Hazard Layers =====
var hazardZoningLayer   = null;
var hazardLandslideLayer= null;
var hazardRockfallLayer = null;
var hazardZoningData    = null;
var hazardLandslideData = null;
var hazardRockfallData  = null;

var HAZARD_ZONING_ORDER = ['მაღალი','საშუალო','დაბალი'];

function loadHazard() {
  var loaded = 0;
  function tryRender() { if(++loaded===3) renderHazardLayers(); }
  if(!hazardZoningData)
    fetch("data/landslide_zoning.geojson").then(r=>r.json()).then(d=>{ hazardZoningData=d; tryRender(); });
  else tryRender();
  if(!hazardLandslideData)
    fetch("data/landslide.geojson").then(r=>r.json()).then(d=>{ hazardLandslideData=d; tryRender(); });
  else tryRender();
  if(!hazardRockfallData)
    fetch("data/rockfall.geojson").then(r=>r.json()).then(d=>{ hazardRockfallData=d; tryRender(); });
  else tryRender();
}

function renderHazardLayers() {
  // ზონირება — polygon ფენა
  if(hazardZoningLayer) map.removeLayer(hazardZoningLayer);
  hazardZoningLayer = L.geoJSON(hazardZoningData, {
    style: function(feat) {
      return { fillColor:feat.properties.ZoneColor, fillOpacity:0.7, color:"#999", weight:0.4, opacity:0.5 };
    },
    onEachFeature: function(feature, layer) {
      var p=feature.properties;
      layer.on("click",    function() { showInfoHazardZone(p); showBottomChartHazard(); });
      layer.on("mouseover",function() { layer.setStyle({weight:1.5, fillOpacity:0.9}); });
      layer.on("mouseout", function() { hazardZoningLayer.resetStyle(layer); });
    },
  }).addTo(map);

  // მეწყერი — წითელი წერტილები
  if(hazardLandslideLayer) map.removeLayer(hazardLandslideLayer);
  hazardLandslideLayer = L.geoJSON(hazardLandslideData, {
    pointToLayer: function(feature, latlng) {
      var marker = L.circleMarker(latlng, {
        radius:5, fillColor:"#C0392B", color:"#7B241C", weight:1.2, fillOpacity:0.85
      });
      marker.bindTooltip(feature.properties.Name_Geo||"მეწყერი", {direction:"top",className:"village-label",offset:[0,-6]});
      marker.on("click", function() { showInfoHazardPoint(feature.properties, "landslide"); showBottomChartHazard(); });
      return marker;
    },
  }).addTo(map);

  // კლდეზვავი — ნარინჯი სამკუთხა სიმბოლო
  if(hazardRockfallLayer) map.removeLayer(hazardRockfallLayer);
  hazardRockfallLayer = L.geoJSON(hazardRockfallData, {
    pointToLayer: function(feature, latlng) {
      var svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="14" viewBox="0 0 16 14">
        <polygon points="8,1 15,13 1,13" fill="#E67E22" stroke="#A04000" stroke-width="1.2"/>
      </svg>`;
      var icon = L.divIcon({ html:svg, iconSize:[16,14], iconAnchor:[8,13], className:"" });
      var marker = L.marker(latlng, { icon:icon });
      marker.bindTooltip(feature.properties.Name_Geo||"კლდეზვავი", {direction:"top",className:"village-label",offset:[0,-14]});
      marker.on("click", function() { showInfoHazardPoint(feature.properties, "rockfall"); showBottomChartHazard(); });
      return marker;
    },
  }).addTo(map);

  updateHazardLegend();
  loadNatureMuniCenters();
}

function updateHazardLegend() {
  var el=document.getElementById("legendContent"); if(!el) return;
  // ზონირების ფერები
  var zoneColors={'მაღალი':'#AD9F90','საშუალო':'#CBC3B9','დაბალი':'#E9E3DC'};
  var html=`<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">მეწყ./კლდეზვ. ზონები</div>
  <div class="ethnics-legend">`;
  HAZARD_ZONING_ORDER.forEach(function(label){
    html+=`<div class="eth-legend-item"><span class="eth-dot" style="background:${zoneColors[label]};border:1px solid rgba(0,0,0,0.15);border-radius:3px;"></span><span style="font-size:10px;">${label}</span></div>`;
  });
  html+=`</div><div style="margin-top:10px;font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">სახეობა</div>
  <div class="ethnics-legend">
    <div class="eth-legend-item">
      <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#C0392B;border:1.5px solid #7B241C;flex-shrink:0;"></span>
      <span style="font-size:10px;">მეწყერი (${hazardLandslideData?hazardLandslideData.features.length:''})</span>
    </div>
    <div class="eth-legend-item">
      <svg width="13" height="12" viewBox="0 0 16 14" style="flex-shrink:0;"><polygon points="8,1 15,13 1,13" fill="#E67E22" stroke="#A04000" stroke-width="1.2"/></svg>
      <span style="font-size:10px;">კლდეზვავი/დაქვათაცვენა (${hazardRockfallData?hazardRockfallData.features.length:''})</span>
    </div>
  </div>`;
  el.innerHTML=html;
}

function showInfoHazardZone(p) {
  document.getElementById("infoCardContent").innerHTML=`
    <div class="info-name">${p.Name_Geo||"–"}</div>
    <span class="info-type-badge badge-village" style="background:${p.ZoneColor}55;color:#444;border:1px solid ${p.ZoneColor};">${p.Name_Eng||""}</span>
    <div class="info-row" style="margin-top:8px;"><span class="info-key">ფართობი</span><span class="info-val">${p.Area_km2} კმ²</span></div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showInfoHazardPoint(p, type) {
  var color = type==="landslide" ? "#C0392B" : "#E67E22";
  var label = type==="landslide" ? "მეწყერი" : "კლდეზვავი/დაქვათაცვენა";
  document.getElementById("infoCardContent").innerHTML=`
    <div class="info-name">${p.Name_Geo||p.Name_Eng||"–"}</div>
    <span class="info-type-badge" style="background:${color}22;color:${color};border:1px solid ${color}55;">${label}</span>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartHazard() {
  var canvas=document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display="none";
  canvas.classList.remove("hidden");
  var ctx=canvas.getContext("2d"); if(bottomChart)bottomChart.destroy();

  // ზონირება — ფართობი
  var areas={}, colors={};
  hazardZoningData.features.forEach(function(f){
    var k=f.properties.Name_Geo;
    areas[k]  = (areas[k]||0)+(f.properties.Area_km2||0);
    colors[k] = f.properties.ZoneColor;
  });
  var sorted = HAZARD_ZONING_ORDER.filter(k=>areas[k]);

  bottomChart=new Chart(ctx,{type:"bar",
    data:{labels:sorted,
      datasets:[{label:"ფართობი (კმ²)",data:sorted.map(k=>Math.round(areas[k])),
        backgroundColor:sorted.map(k=>colors[k]),
        borderColor:sorted.map(k=>colors[k].replace(/^#/,'').match(/../g).map(h=>Math.max(0,parseInt(h,16)-30).toString(16).padStart(2,'0')).reduce((a,b)=>a+b,'#')),
        borderWidth:1.5, borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},
        title:{display:true,text:"მეწყ./კლდეზვ. ზონირება — ფართობი (კმ²)",
          font:{family:"Fira Sans",size:12,weight:"600"},color:"#1A1A18",padding:{bottom:6}},
        tooltip:{callbacks:{label:c=>` ${c.parsed.y.toLocaleString()} კმ²`}}},
      scales:{y:{beginAtZero:true,grid:{color:"rgba(0,0,0,0.05)"},
        ticks:{font:{family:"Fira Sans",size:10},color:"#6B6862",callback:v=>v.toLocaleString()+" კმ²"}},
        x:{ticks:{font:{family:"Fira Sans",size:10},color:"#1A1A18"},grid:{display:false}}},
      animation:{onComplete:function(){
        var chart=this; var ctx2=chart.ctx;
        ctx2.font="bold 9px 'Fira Sans',sans-serif"; ctx2.fillStyle="#444";
        ctx2.textAlign="center"; ctx2.textBaseline="bottom";
        chart.data.datasets.forEach(function(ds,i){
          chart.getDatasetMeta(i).data.forEach(function(bar,idx){
            var val=ds.data[idx];
            if(val>0) ctx2.fillText(val.toLocaleString()+" კმ²", bar.x, bar.y-3);
          });
        });
      }},
    },
  });
}

// ===== GroundWater Layer =====
var groundwaterZoningLayer = null;
var groundwaterPointLayer  = null;
var groundwaterZoningData  = null;
var groundwaterPointData   = null;

var HYDROGEO_ORDER = ['III9','III12','IV2','IV3','V1','V2'];
var HYDROGEO_COLORS = {
  'III9':  '#B8D4E8', 'III12': '#7BB8D4',
  'IV2':   '#C8E6C9', 'IV3':   '#A5D6A7',
  'V1':    '#FFE0B2', 'V2':    '#FFCC80',
};

function loadGroundwater() {
  var loaded=0;
  function tryRender(){ if(++loaded===2) renderGroundwaterLayers(); }
  if(!groundwaterZoningData)
    fetch("data/hydrogeology_zoning.geojson").then(r=>r.json()).then(d=>{ groundwaterZoningData=d; tryRender(); });
  else tryRender();
  if(!groundwaterPointData)
    fetch("data/groundwater.geojson").then(r=>r.json()).then(d=>{ groundwaterPointData=d; tryRender(); });
  else tryRender();
}

function renderGroundwaterLayers() {
  // ზონირება — polygon
  if(groundwaterZoningLayer) map.removeLayer(groundwaterZoningLayer);
  groundwaterZoningLayer = L.geoJSON(groundwaterZoningData, {
    style: function(feat) {
      return { fillColor:feat.properties.ZoneColor, fillOpacity:0.65, color:"#5599AA", weight:1, opacity:0.7 };
    },
    onEachFeature: function(feature, layer) {
      var p=feature.properties;
      layer.on("click",    function(){ showInfoGWZone(p); showBottomChartGW(); });
      layer.on("mouseover",function(){ layer.setStyle({weight:2, fillOpacity:0.85}); });
      layer.on("mouseout", function(){ groundwaterZoningLayer.resetStyle(layer); });
    },
  }).addTo(map);

  // წყალპუნქტები — SVG სიმბოლოები
  if(groundwaterPointLayer) map.removeLayer(groundwaterPointLayer);
  groundwaterPointLayer = L.geoJSON(groundwaterPointData, {
    pointToLayer: function(feature, latlng) {
      var p=feature.properties;
      var isBorehole = p.Type_Geo === 'ჭაბურღილი';

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

      var svgHtml   = isBorehole ? boreholdSVG : springSVG;
      var iconW     = isBorehole ? 28 : 24;
      var iconH     = isBorehole ? 22 : 18;
      var anchorX   = isBorehole ? 14 : 6;  // ჭაბ: ცენტრი; წყარო: მარცხენა ხაზის ბოლო
      var anchorY   = isBorehole ? 11 : 9;

      var icon = L.divIcon({
        html: svgHtml,
        iconSize: [iconW, iconH],
        iconAnchor: [anchorX, anchorY],
        className: "",
      });
      var marker = L.marker(latlng, { icon: icon });
      marker.bindTooltip(`${p.Number} ${p.Name_Geo}`, {direction:"top", className:"village-label", offset:[0, -iconH]});
      marker.on("click", function(){ showInfoGWPoint(p); showBottomChartGWPoint(p); });
      return marker;
    },
  }).addTo(map);

  updateGWLegend();
  loadNatureMuniCenters();
}

function updateGWLegend() {
  var el=document.getElementById("legendContent"); if(!el) return;
  var html=`<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">ჰიდროგეოლ. დარაიონება</div><div class="ethnics-legend">`;
  var seen={};
  groundwaterZoningData.features.forEach(function(f){
    var p=f.properties;
    if(!seen[p.Code]){ seen[p.Code]=1;
      html+=`<div class="eth-legend-item"><span class="eth-dot" style="background:${p.ZoneColor};border:1px solid #5599AA88;border-radius:3px;"></span><span style="font-size:9px;">${p.ShortLabel}</span></div>`;
    }
  });
  html+=`</div><div style="margin-top:10px;font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">წყალპუნქტები</div>
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
  el.innerHTML=html;
}

function showInfoGWZone(p) {
  document.getElementById("infoCardContent").innerHTML=`
    <div class="info-name" style="font-size:12px;">${p.ShortLabel}</div>
    <span class="info-type-badge badge-village" style="background:${p.ZoneColor};color:#333;border:1px solid #5599AA55;">${p.Code}</span>
    <div class="info-row" style="margin-top:8px;"><span class="info-key">ფართობი</span><span class="info-val">${p.Area_km2} კმ²</span></div>
    <div style="margin-top:8px;font-size:9px;color:var(--text-muted);line-height:1.5;">${p.Name_Geo}</div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showInfoGWPoint(p) {
  var isBH = p.Type_Geo==='ჭაბურღილი';
  var color = isBH ? "#1565C0" : "#0288D1";
  document.getElementById("infoCardContent").innerHTML=`
    <div class="info-name">${p.Number} ${p.Name_Geo}</div>
    <span class="info-type-badge" style="background:${color}22;color:${color};border:1px solid ${color}55;">${p.Type_Geo}</span>
    <div class="info-row"><span class="info-key">მუნიც.</span><span class="info-val">${p.Munic_Geo||"–"}</span></div>
    <div class="info-row"><span class="info-key">ტემპ.</span><span class="info-val">${p.Temp_Geo||"–"}</span></div>
    <hr style="margin:8px 0;border-top:1px solid #f0ede8;">
    <div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;">მინერალიზაცია და ქიმ. შემადგ. (%)</div>
    <div class="info-row"><span class="info-key">M (გ/ლ)</span><span class="info-val pop-num">${p.Mineral_M||"–"}</span></div>
    <div class="info-row"><span class="info-key">HCO₃</span><span class="info-val">${p.HCO3||0}%</span></div>
    <div class="info-row"><span class="info-key">SO₄</span><span class="info-val">${p.SO4||0}%</span></div>
    <div class="info-row"><span class="info-key">Ca</span><span class="info-val">${p.Ca||0}%</span></div>
    <div class="info-row"><span class="info-key">Mg</span><span class="info-val">${p.Mg||0}%</span></div>
    <div class="info-row"><span class="info-key">Na+K</span><span class="info-val">${p.Na_K||0}%</span></div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartGW() {
  var canvas=document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display="none";
  canvas.classList.remove("hidden");
  var ctx=canvas.getContext("2d"); if(bottomChart)bottomChart.destroy();

  var areas={}, colors={}, labels={};
  groundwaterZoningData.features.forEach(function(f){
    var p=f.properties;
    areas[p.Code]  = (areas[p.Code]||0)+p.Area_km2;
    colors[p.Code] = p.ZoneColor;
    labels[p.Code] = p.ShortLabel;
  });
  var sorted=HYDROGEO_ORDER.filter(k=>areas[k]).sort(function(a,b){return areas[b]-areas[a];});

  bottomChart=new Chart(ctx,{type:"bar",
    data:{labels:sorted.map(k=>labels[k]),
      datasets:[{label:"ფართობი (კმ²)",data:sorted.map(k=>Math.round(areas[k])),
        backgroundColor:sorted.map(k=>colors[k]),
        borderColor:sorted.map(k=>"#5599AA"),
        borderWidth:1, borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},
        title:{display:true,text:"ჰიდროგეოლ. ზონირება — ფართობი (კმ²)",
          font:{family:"Fira Sans",size:12,weight:"600"},color:"#1A1A18",padding:{bottom:6}},
        tooltip:{callbacks:{label:c=>` ${c.parsed.y.toLocaleString()} კმ²`}}},
      scales:{y:{beginAtZero:true,grid:{color:"rgba(0,0,0,0.05)"},
        ticks:{font:{family:"Fira Sans",size:10},color:"#6B6862",callback:v=>v.toLocaleString()+" კმ²"}},
        x:{ticks:{font:{family:"Fira Sans",size:8},color:"#1A1A18",maxRotation:25},grid:{display:false}}},
      animation:{onComplete:function(){
        var chart=this; var ctx2=chart.ctx;
        ctx2.font="bold 9px 'Fira Sans',sans-serif"; ctx2.fillStyle="#444";
        ctx2.textAlign="center"; ctx2.textBaseline="bottom";
        chart.data.datasets.forEach(function(ds,i){
          chart.getDatasetMeta(i).data.forEach(function(bar,idx){
            var val=ds.data[idx];
            if(val>0) ctx2.fillText(val.toLocaleString()+" კმ²",bar.x,bar.y-3);
          });
        });
      }},
    },
  });
}

function showBottomChartGWPoint(p) {
  var canvas=document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display="none";
  canvas.classList.remove("hidden");
  var ctx=canvas.getContext("2d"); if(bottomChart)bottomChart.destroy();

  var ions=["HCO3","SO4","Cl","Ca","Mg","Na_K"];
  var labels=["HCO₃","SO₄","Cl","Ca","Mg","Na+K"];
  var ionColors=["#1E88E5","#FDD835","#EF5350","#43A047","#8E24AA","#FB8C00"];
  var vals=ions.map(k=>p[k]||0);

  bottomChart=new Chart(ctx,{type:"doughnut",
    data:{labels:labels,
      datasets:[{data:vals,backgroundColor:ionColors.map(c=>c+"BB"),borderColor:ionColors,borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{
        legend:{position:"right",labels:{font:{family:"Fira Sans",size:10},color:"#1A1A18",padding:8}},
        title:{display:true,text:`${p.Number} ${p.Name_Geo} — ქიმიური შემადგენლობა (%) | M=${p.Mineral_M} გ/ლ`,
          font:{family:"Fira Sans",size:11,weight:"600"},color:"#1A1A18",padding:{bottom:6}},
        tooltip:{callbacks:{label:c=>` ${c.label}: ${c.parsed}%`}},
      },
    },
  });
}

// ===== Earthquake Layer =====
var eqNewLayer      = null;
var eqOldLayer      = null;
var eqStationLayer  = null;
var eqNewData       = null;
var eqOldData       = null;
var eqStationData   = null;

var MAG_CLASSES = [
  { label:'< 3',   color:'#FFCCCC', r:3  },
  { label:'3.1–4', color:'#FF8C8C', r:5  },
  { label:'4.1–5', color:'#FF4444', r:7  },
  { label:'5.1–6', color:'#CC0000', r:9  },
  { label:'> 6',   color:'#7B0000', r:12 },
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
  var loaded=0;
  function tryRender(){ if(++loaded===3) renderEarthquakeLayers(); }
  if(!eqNewData)     fetch("data/earthquakes_new.geojson").then(r=>r.json()).then(d=>{ eqNewData=d;     tryRender(); });
  else tryRender();
  if(!eqOldData)     fetch("data/earthquakes_old.geojson").then(r=>r.json()).then(d=>{ eqOldData=d;     tryRender(); });
  else tryRender();
  if(!eqStationData) fetch("data/seismic_stations.geojson").then(r=>r.json()).then(d=>{ eqStationData=d; tryRender(); });
  else tryRender();
}

function renderEarthquakeLayers() {
  if(eqNewLayer)     map.removeLayer(eqNewLayer);
  if(eqOldLayer)     map.removeLayer(eqOldLayer);
  if(eqStationLayer) map.removeLayer(eqStationLayer);

  // ინსტრუმენტული — წრეები
  eqNewLayer = L.geoJSON(eqNewData, {
    pointToLayer: function(feature, latlng) {
      var p=feature.properties;
      var marker=L.circleMarker(latlng,{
        radius: p.Radius,
        fillColor: p.Color,
        color: darken(p.Color),
        weight: 0.6,
        fillOpacity: 0.7,
      });
      marker.bindTooltip(`Mw ${p.Mw} | ${p.Year}`,{direction:"top",className:"village-label"});
      marker.on("click",function(){ showInfoEQ(p,"instrumental"); showBottomChartEQ(); });
      return marker;
    },
  }).addTo(map);

  // ისტორიული — კვადრატი
  eqOldLayer = L.geoJSON(eqOldData, {
    pointToLayer: function(feature, latlng) {
      var p=feature.properties;
      var size=p.Radius*3;
      var svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <rect x="1" y="1" width="${size-2}" height="${size-2}" fill="${p.Color}" stroke="${darken(p.Color)}" stroke-width="1"/>
      </svg>`;
      var icon=L.divIcon({html:svg,iconSize:[size,size],iconAnchor:[size/2,size/2],className:""});
      var marker=L.marker(latlng,{icon:icon});
      marker.bindTooltip(`Mw ${p.Mw} | ${p.Year} (ისტ.)`,{direction:"top",className:"village-label",offset:[0,-size/2]});
      marker.on("click",function(){ showInfoEQ(p,"historical"); showBottomChartEQ(); });
      return marker;
    },
  }).addTo(map);

  // სეისმური სადგურები
  eqStationLayer = L.geoJSON(eqStationData, {
    pointToLayer: function(feature, latlng) {
      var p=feature.properties;
      var svgHtml=p.Active ? SEISMIC_SVG_ACTIVE : SEISMIC_SVG_INACTIVE;
      var icon=L.divIcon({html:svgHtml,iconSize:[22,17],iconAnchor:[11,17],className:""});
      var marker=L.marker(latlng,{icon:icon,zIndexOffset:1000});
      marker.bindTooltip(p.Name_Geo,{direction:"top",className:"village-label",offset:[0,-18]});
      return marker;
    },
  }).addTo(map);

  updateEQLegend();
  loadNatureMuniCenters();
}

function darken(hex) {
  var r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return '#'+[Math.max(0,r-40),Math.max(0,g-40),Math.max(0,b-40)].map(v=>v.toString(16).padStart(2,'0')).join('');
}

function updateEQLegend() {
  var el=document.getElementById("legendContent"); if(!el) return;
  var html=`<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">მაგნიტუდა (Mw)</div>
  <div class="ethnics-legend">`;
  MAG_CLASSES.forEach(function(mc){
    html+=`<div class="eth-legend-item">
      <span style="display:inline-block;width:${mc.r*2}px;height:${mc.r*2}px;border-radius:50%;background:${mc.color};border:1px solid ${darken(mc.color)};flex-shrink:0;"></span>
      <span style="font-size:10px;">${mc.label}</span>
    </div>`;
  });
  html+=`</div>
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
  el.innerHTML=html;
}

function showInfoEQ(p, period) {
  var periodLabel = period==="instrumental" ? "ინსტრუმენტული (1900+)" : "ისტორიული (1900-მდე)";
  document.getElementById("infoCardContent").innerHTML=`
    <div class="info-name">Mw ${p.Mw}</div>
    <span class="info-type-badge badge-city" style="background:${p.Color}33;color:${darken(p.Color)};border:1px solid ${p.Color}88;">${p.MagClass}</span>
    <div class="info-row"><span class="info-key">წელი</span><span class="info-val">${p.Year}</span></div>
    <div class="info-row"><span class="info-key">პერიოდი</span><span class="info-val" style="font-size:10px;">${periodLabel}</span></div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartEQ() {
  var canvas=document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display="none";
  canvas.classList.remove("hidden");
  var ctx=canvas.getContext("2d"); if(bottomChart)bottomChart.destroy();

  // მაგნიტუდის განაწილება
  var counts={};
  MAG_CLASSES.forEach(function(mc){ counts[mc.label]=0; });
  eqNewData.features.forEach(function(f){ counts[f.properties.MagClass]=(counts[f.properties.MagClass]||0)+1; });

  bottomChart=new Chart(ctx,{type:"bar",
    data:{
      labels: MAG_CLASSES.map(mc=>mc.label),
      datasets:[{
        label:"მიწისძვრათა რ-ბა",
        data:  MAG_CLASSES.map(mc=>counts[mc.label]||0),
        backgroundColor: MAG_CLASSES.map(mc=>mc.color+"CC"),
        borderColor:     MAG_CLASSES.map(mc=>darken(mc.color)),
        borderWidth:1.5, borderRadius:4,
      }],
    },
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},
        title:{display:true,text:`მიწისძვრები მაგნიტუდის მიხედვით — სულ ${eqNewData.features.length+eqOldData.features.length}`,
          font:{family:"Fira Sans",size:12,weight:"600"},color:"#1A1A18",padding:{bottom:6}},
        tooltip:{callbacks:{label:c=>` ${c.parsed.y} მიწისძვრა`}}},
      scales:{
        y:{beginAtZero:true,grid:{color:"rgba(0,0,0,0.05)"},
          ticks:{font:{family:"Fira Sans",size:10},color:"#6B6862"}},
        x:{ticks:{font:{family:"Fira Sans",size:11},color:"#1A1A18"},grid:{display:false}},
      },
      animation:{onComplete:function(){
        var chart=this; var ctx2=chart.ctx;
        ctx2.font="bold 10px 'Fira Sans',sans-serif"; ctx2.fillStyle="#444";
        ctx2.textAlign="center"; ctx2.textBaseline="bottom";
        chart.data.datasets.forEach(function(ds,i){
          chart.getDatasetMeta(i).data.forEach(function(bar,idx){
            var val=ds.data[idx];
            if(val>0) ctx2.fillText(val, bar.x, bar.y-3);
          });
        });
      }},
    },
  });
}

// Nature checkbox
document.getElementById("chkNature").addEventListener("change", function(e) {
  if (e.target.checked) {
    document.getElementById("mainLayerView").style.display = "none";
    document.getElementById("sublayerView").style.display  = "none";
    document.getElementById("natureView").style.display    = "";
    removeNeutralLayers();
    // პირველი ქვე-ფენა ავტომატურად
    removeAllNatureLayers();
    document.querySelectorAll("[data-naturesub]").forEach(b=>b.classList.remove("active"));
    document.querySelector("[data-naturesub='agrovlimat']").classList.add("active");
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

document.getElementById("btnNatureBack").addEventListener("click", function() {
  document.getElementById("chkNature").checked = false;
  document.getElementById("natureView").style.display    = "none";
  document.getElementById("mainLayerView").style.display = "";
  removeAllNatureLayers();
  document.getElementById("chartEmpty").style.display="flex";
  document.getElementById("chartCanvas").classList.add("hidden");
  document.getElementById("infoCard").classList.add("hidden");
  resetPopLegend();
  loadNeutralLayers();
});

// ===== Meteo & Hydro Stations =====
var meteoLayer = null;
var hydroLayer = null;
var meteoData  = null;
var hydroData  = null;

function removeAllNatureLayers() {
  if(madflowZoningLayer)  {map.removeLayer(madflowZoningLayer);  madflowZoningLayer=null;}
  if(madflowPointLayer)   {map.removeLayer(madflowPointLayer);   madflowPointLayer=null;}
  if(madflowErosionLayer) {map.removeLayer(madflowErosionLayer); madflowErosionLayer=null;}
  if(forestLayer)         {map.removeLayer(forestLayer);         forestLayer=null;}
  if(vegetationLayer)  {map.removeLayer(vegetationLayer);  vegetationLayer=null;}
  if(_avgTempRef.layer) {map.removeLayer(_avgTempRef.layer); _avgTempRef.layer=null;}
  if(_maxTempRef.layer) {map.removeLayer(_maxTempRef.layer); _maxTempRef.layer=null;}
  if(_precipRef.layer)  {map.removeLayer(_precipRef.layer);  _precipRef.layer=null;}
  if(_hotRef.layer)     {map.removeLayer(_hotRef.layer);     _hotRef.layer=null;}
  if(_tropRef.layer)   {map.removeLayer(_tropRef.layer);   _tropRef.layer=null;}
  if(_frostRef.layer)  {map.removeLayer(_frostRef.layer);  _frostRef.layer=null;}
  if(heatWavesLayer)   {map.removeLayer(heatWavesLayer);   heatWavesLayer=null;}
  if(droughtLayer)     {map.removeLayer(droughtLayer);     droughtLayer=null;}
  if(hailTotalLayer)   {map.removeLayer(hailTotalLayer);   hailTotalLayer=null;}
  if(hail100Layer)     {map.removeLayer(hail100Layer);     hail100Layer=null;}
  if(soilsLayer)       {map.removeLayer(soilsLayer);       soilsLayer=null;}
  if(soilsBornLayer)   {map.removeLayer(soilsBornLayer);   soilsBornLayer=null;}
  if(geologyLayer)     {map.removeLayer(geologyLayer);     geologyLayer=null;}
  if(foultsLayer)      {map.removeLayer(foultsLayer);      foultsLayer=null;}
  if(metalOreLayer)    {map.removeLayer(metalOreLayer);    metalOreLayer=null;}
  if(nonmetalOreLayer) {map.removeLayer(nonmetalOreLayer); nonmetalOreLayer=null;}
  if(oilGasLayer)      {map.removeLayer(oilGasLayer);      oilGasLayer=null;}
  if(agrovlimatLayer){map.removeLayer(agrovlimatLayer);agrovlimatLayer=null;}
  if(meteoLayer){map.removeLayer(meteoLayer);meteoLayer=null;}
  if(hydroLayer){map.removeLayer(hydroLayer);hydroLayer=null;}
  if(landscapeLayerRef.layer){map.removeLayer(landscapeLayerRef.layer);landscapeLayerRef.layer=null;}
  if(landscapeAntropLayerRef.layer){map.removeLayer(landscapeAntropLayerRef.layer);landscapeAntropLayerRef.layer=null;}
  if(hazardZoningLayer)   {map.removeLayer(hazardZoningLayer);   hazardZoningLayer=null;}
  if(hazardLandslideLayer){map.removeLayer(hazardLandslideLayer);hazardLandslideLayer=null;}
  if(hazardRockfallLayer) {map.removeLayer(hazardRockfallLayer); hazardRockfallLayer=null;}
  if(groundwaterZoningLayer){map.removeLayer(groundwaterZoningLayer);groundwaterZoningLayer=null;}
  if(groundwaterPointLayer) {map.removeLayer(groundwaterPointLayer); groundwaterPointLayer=null;}
  if(eqNewLayer)     {map.removeLayer(eqNewLayer);     eqNewLayer=null;}
  if(eqOldLayer)     {map.removeLayer(eqOldLayer);     eqOldLayer=null;}
  if(eqStationLayer) {map.removeLayer(eqStationLayer); eqStationLayer=null;}
  removeNatureMuniCenters();
}

// SVG სიმბოლოები
function meteoIcon(active) {
  var fill  = active ? "#E8540A" : "#999";
  var stroke= active ? "#8B2A00" : "#666";
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
  return L.divIcon({ html:svg, iconSize:[22,22], iconAnchor:[11,11], className:"" });
}

function hydroIcon(active) {
  var fill  = active ? "#1565C0" : "#999";
  var stroke= active ? "#0D47A1" : "#666";
  // წვეთის სიმბოლო
  var svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="24" viewBox="0 0 20 24">
    <path d="M10 2 C10 2, 2 12, 2 16 C2 20.4 5.6 23 10 23 C14.4 23 18 20.4 18 16 C18 12 10 2 10 2 Z"
      fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
  </svg>`;
  return L.divIcon({ html:svg, iconSize:[20,24], iconAnchor:[10,23], className:"" });
}

function buildMeteoLayer(data) {
  if(meteoLayer) map.removeLayer(meteoLayer);
  meteoLayer = L.geoJSON(data, {
    pointToLayer: function(feature, latlng) {
      var p = feature.properties;
      var marker = L.marker(latlng, { icon: meteoIcon(p.Active) });
      marker.on("click", function() { showInfoMeteo(p); showBottomChartStations("meteo"); });
      marker.bindTooltip(p.Name_Geo||"", {direction:"top", className:"village-label", offset:[0,-8]});
      return marker;
    },
  }).addTo(map);
  updateStationLegend("meteo", data);
}

function buildHydroLayer(data) {
  if(hydroLayer) map.removeLayer(hydroLayer);
  hydroLayer = L.geoJSON(data, {
    pointToLayer: function(feature, latlng) {
      var p = feature.properties;
      var marker = L.marker(latlng, { icon: hydroIcon(p.Active) });
      marker.on("click", function() { showInfoHydro(p); showBottomChartStations("hydro"); });
      marker.bindTooltip(p.Name_Geo||"", {direction:"top", className:"village-label", offset:[0,-12]});
      return marker;
    },
  }).addTo(map);
  updateStationLegend("hydro", data);
}

function loadMeteo() {
  if(meteoData) { buildMeteoLayer(meteoData); loadNatureMuniCenters(); return; }
  fetch("data/meteo_stations.geojson").then(r=>r.json()).then(data=>{ meteoData=data; buildMeteoLayer(data); loadNatureMuniCenters(); });
}

function loadHydro() {
  if(hydroData) { buildHydroLayer(hydroData); loadNatureMuniCenters(); return; }
  fetch("data/hydro_stations.geojson").then(r=>r.json()).then(data=>{ hydroData=data; buildHydroLayer(data); loadNatureMuniCenters(); });
}

function updateStationLegend(type, data) {
  var el = document.getElementById("legendContent"); if(!el) return;
  var isMeteo = type === "meteo";
  var title   = isMeteo ? "მეტეოსადგურები" : "ჰიდრ. სადგურები";
  var actColor= isMeteo ? "#E8540A" : "#1565C0";
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
  var active   = data.features.filter(f=>f.properties.Active).length;
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
    <div class="info-name">${p.Name_Geo||p.Name_Eng||"–"}</div>
    ${badge}
    <div class="info-row"><span class="info-key">სადგ. ID</span><span class="info-val">${p.Station_ID||"–"}</span></div>
    <div class="info-row"><span class="info-key">ტიპი</span><span class="info-val">${p.Station_Ty||"–"}</span></div>
    <div class="info-row"><span class="info-key">სიმაღლე</span><span class="info-val">${p.Elevation!=null?p.Elevation+" მ":"–"}</span></div>
    <div class="info-row"><span class="info-key">რაიონი</span><span class="info-val">${p.District||"–"}</span></div>
    <hr style="margin:8px 0;border-top:1px solid #f0ede8;">
    <div style="font-size:10px;color:var(--text-muted);line-height:1.5;">${p.Type_Geo||"–"}</div>
    <div class="info-row" style="margin-top:6px;"><span class="info-key">დაწყება</span><span class="info-val">${p.Begin_Obs||"–"}</span></div>
    ${p.End_Obs?`<div class="info-row"><span class="info-key">დასასრული</span><span class="info-val">${p.End_Obs}</span></div>`:""}
  `;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showInfoHydro(p) {
  var badge = p.Active
    ? `<span class="info-type-badge badge-village" style="background:#E3F0FC;color:#1565C0;border:1px solid #1565C055;">მოქმედი</span>`
    : `<span class="info-type-badge badge-city" style="background:#f3f4f6;color:#999;border:1px solid #ccc;">დახურული</span>`;
  document.getElementById("infoCardContent").innerHTML = `
    <div class="info-name">${p.Name_Geo||p.Name_Eng||"–"}</div>
    ${badge}
    <div class="info-row"><span class="info-key">მდინარე</span><span class="info-val">${p.River||"–"}</span></div>
    <div class="info-row"><span class="info-key">River (Eng)</span><span class="info-val">${p.River_Eng||"–"}</span></div>
    <hr style="margin:8px 0;border-top:1px solid #f0ede8;">
    <div class="info-row"><span class="info-key">გახსნა</span><span class="info-val">${p.Year_Open||"–"}</span></div>
    ${p.Year_Close?`<div class="info-row"><span class="info-key">დახურვა</span><span class="info-val">${p.Year_Close}</span></div>`:""}
    <div class="info-row"><span class="info-key">პერიოდი</span><span class="info-val" style="font-size:10px;">${p.Year_||"–"}</span></div>
  `;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartStations(type) {
  var data    = type==="meteo" ? meteoData : hydroData;
  var canvas  = document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display="none";
  canvas.classList.remove("hidden");
  var ctx=canvas.getContext("2d"); if(bottomChart)bottomChart.destroy();

  var active   = data.features.filter(f=>f.properties.Active);
  var inactive = data.features.filter(f=>!f.properties.Active);
  var actColor = type==="meteo" ? "#E8540A" : "#1565C0";
  var title    = type==="meteo" ? "მეტეოსადგურები" : "ჰიდრ. სადგურები";

  bottomChart = new Chart(ctx,{type:"doughnut",
    data:{labels:["მოქმედი","დახურული"],
      datasets:[{data:[active.length,inactive.length],
        backgroundColor:[actColor+"BB","#BBBBBB"],
        borderColor:[actColor,"#999"],borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{
        legend:{position:"right",labels:{font:{family:"Fira Sans",size:12},color:"#1A1A18",padding:12}},
        title:{display:true,text:`${title} — სულ ${data.features.length}`,
          font:{family:"Fira Sans",size:12,weight:"600"},color:"#1A1A18",padding:{bottom:6}},
        tooltip:{callbacks:{label:c=>` ${c.label}: ${c.parsed}`}},
      },
    },
  });
}

// nature sublayer buttons
document.querySelectorAll("[data-naturesub]").forEach(function(btn) {
  btn.addEventListener("click", function() {
    document.querySelectorAll("[data-naturesub]").forEach(b=>b.classList.remove("active"));
    this.classList.add("active");
    var sub = this.dataset.naturesub;
    // წინა ფენები გამოვრთოთ
    removeAllNatureLayers();
    document.getElementById("infoCard").classList.add("hidden");
    document.getElementById("chartEmpty").style.display="flex";
    document.getElementById("chartCanvas").classList.add("hidden");
    resetPopLegend();
    if(sub==="agrovlimat")        loadAgrovlimat();
    else if(sub==="meteo")        loadMeteo();
    else if(sub==="hydro")        loadHydro();
    else if(sub==="landscape")    loadLandscape();
    else if(sub==="landscape_antrop") loadLandscapeAntrop();
    else if(sub==="hazard")           loadHazard();
    else if(sub==="groundwater")      loadGroundwater();
    else if(sub==="earthquake")       loadEarthquake();
    else if(sub==="madflow")           loadMadflow();
    else if(sub==="geology")          loadGeology();
    else if(sub==="forest")             loadForest();
    else if(sub==="vegetation")         loadVegetation();
    else if(sub==="avg_temp")           loadAvgTemp();
    else if(sub==="max_temp")           loadMaxTemp();
    else if(sub==="precip")             loadPrecip();
    else if(sub==="hot_days")           loadHotDays();
    else if(sub==="trop_nights")        loadTropNights();
    else if(sub==="frost_days")         loadFrostDays();
    else if(sub==="heat_waves")         loadHeatWaves();
    else if(sub==="drought")            loadDrought();
    else if(sub==="hail_total")        loadHailTotal();
    else if(sub==="soils")            loadSoils();
    else if(sub==="soils_born")       loadSoilsBorn();
  });
});



// ============================================================
// ჰაერის ტემპერატურა და ნალექები
// ============================================================
var avgTempLayer   = null;
var maxTempLayer   = null;
var precipLayer    = null;
var avgTempData    = null;
var maxTempData    = null;
var precipData     = null;

var AVG_TEMP_CLASSES = [
  {label:'1–2°C',  color:'#5887BD'},{label:'2–4°C',  color:'#A4CCE2'},
  {label:'4–6°C',  color:'#CCE6F0'},{label:'6–8°C',  color:'#FDD384'},
  {label:'8–10°C', color:'#FA9D59'},{label:'10–12°C',color:'#F67D4A'},
  {label:'12–14°C',color:'#DE3F2E'},{label:'14–15°C',color:'#B10B26'},
];
var MAX_TEMP_CLASSES = [
  {label:'6–8°C',  color:'#FFD3A7'},{label:'8–10°C', color:'#FFB66C'},
  {label:'10–12°C',color:'#FB8D3A'},{label:'12–14°C',color:'#EB4225'},
  {label:'14–16°C',color:'#D41817'},{label:'16–18°C',color:'#B6000C'},
  {label:'18–20°C',color:'#8E0003'},
];
var PRECIP_CLASSES = [
  {label:'< 500 მმ',  color:'#B5DCFA'},
  {label:'500–550 მმ',color:'#7ABFF7'},
  {label:'550–600 მმ',color:'#53ADF5'},
  {label:'600–650 მმ',color:'#3096ED'},
  {label:'650–700 მმ',color:'#1976D2'},
  {label:'> 700 მმ',  color:'#1156B0'},
];

function _buildTempLayer(data, refObj, onClickFn) {
  if(refObj.layer) map.removeLayer(refObj.layer);
  var layer = L.geoJSON(data, {
    style: function(feat) {
      return {fillColor:feat.properties.Color, fillOpacity:0.78,
              color:feat.properties.Color, weight:0.2, opacity:0.4};
    },
    onEachFeature: function(feature, lyr) {
      var p=feature.properties;
      lyr.on('mouseover', function(){lyr.setStyle({weight:1.2,fillOpacity:0.95});});
      lyr.on('mouseout',  function(){lyr.setStyle({fillColor:p.Color,fillOpacity:0.78,color:p.Color,weight:0.2,opacity:0.4});});
      lyr.on('click', function(){onClickFn(p, data);});
    },
  }).addTo(map);
  refObj.layer = layer;
}

var _avgTempRef  = {layer:null};
var _maxTempRef  = {layer:null};
var _precipRef   = {layer:null};

function loadAvgTemp() {
  if(avgTempData){_buildTempLayer(avgTempData,_avgTempRef,_showInfoAvgTemp);updateTempLegend('avg');loadNatureMuniCenters();return;}
  fetch('data/avg_temp.geojson').then(r=>r.json()).then(function(d){
    avgTempData=d;_buildTempLayer(d,_avgTempRef,_showInfoAvgTemp);updateTempLegend('avg');loadNatureMuniCenters();
  });
}
function loadMaxTemp() {
  if(maxTempData){_buildTempLayer(maxTempData,_maxTempRef,_showInfoMaxTemp);updateTempLegend('max');loadNatureMuniCenters();return;}
  fetch('data/max_temp.geojson').then(r=>r.json()).then(function(d){
    maxTempData=d;_buildTempLayer(d,_maxTempRef,_showInfoMaxTemp);updateTempLegend('max');loadNatureMuniCenters();
  });
}
function loadPrecip() {
  if(precipData){_buildTempLayer(precipData,_precipRef,_showInfoPrecip);updateTempLegend('precip');loadNatureMuniCenters();return;}
  fetch('data/precipitation.geojson').then(r=>r.json()).then(function(d){
    precipData=d;_buildTempLayer(d,_precipRef,_showInfoPrecip);updateTempLegend('precip');loadNatureMuniCenters();
  });
}

function _showInfoAvgTemp(p, data) {
  document.getElementById('infoCardContent').innerHTML=
    '<div class="info-name" style="font-size:13px;">საშ. ტემპერატურა</div>'+
    '<span class="info-type-badge badge-village" style="background:'+p.Color+'55;color:#333;border:1px solid '+p.Color+';">'+p.Label+' °C</span>'+
    '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);">მრავალწლიური საშუალო  |  1990–2022</div>';
  document.getElementById('infoCard').classList.remove('hidden');
  showBottomChartTemp(data,'avg');
}
function _showInfoMaxTemp(p, data) {
  document.getElementById('infoCardContent').innerHTML=
    '<div class="info-name" style="font-size:13px;">მაქს. ტემპერატურა</div>'+
    '<span class="info-type-badge badge-village" style="background:'+p.Color+'55;color:#333;border:1px solid '+p.Color+';">'+p.Label+' °C</span>'+
    '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);">მრავალწლიური მაქსიმუმი  |  1990–2022</div>';
  document.getElementById('infoCard').classList.remove('hidden');
  showBottomChartTemp(data,'max');
}
function _showInfoPrecip(p, data) {
  document.getElementById('infoCardContent').innerHTML=
    '<div class="info-name" style="font-size:13px;">ატმ. ნალექები</div>'+
    '<span class="info-type-badge badge-village" style="background:'+p.Color+'55;color:#333;border:1px solid '+p.Color+';">'+p.Label+' მმ</span>'+
    '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);">მრავალწლიური ჯამი  |  1990–2022</div>';
  document.getElementById('infoCard').classList.remove('hidden');
  showBottomChartTemp(data,'precip');
}

function showBottomChartTemp(data, type) {
  var canvas=document.getElementById('chartCanvas');
  document.getElementById('chartEmpty').style.display='none';
  canvas.classList.remove('hidden');
  var ctx=canvas.getContext('2d'); if(bottomChart)bottomChart.destroy();
  var titles={
    avg:'საშ. ტემპერატურა — ფართობის განაწილება',
    max:'მაქს. ტემპერატურა — ფართობის განაწილება',
    precip:'ატმ. ნალექები — ფართობის განაწილება'
  };
  var units={avg:'°C',max:'°C',precip:'მმ'};
  var areas={}, colors={};
  data.features.forEach(function(f){
    var k=f.properties.Label+' '+units[type];
    var ring=f.geometry.coordinates[0];
    var a=0;
    for(var i=0;i<ring.length;i++){
      var j=(i+1)%ring.length;
      a+=(ring[i][0]*83000)*(ring[j][1]*111000)-(ring[j][0]*83000)*(ring[i][1]*111000);
    }
    areas[k]=(areas[k]||0)+Math.abs(a)/2/1e6;
    colors[k]=f.properties.Color;
  });
  var sorted=Object.keys(areas).sort(function(a,b){return parseFloat(a)-parseFloat(b);});
  bottomChart=new Chart(ctx,{type:'bar',
    data:{labels:sorted,datasets:[{label:'კმ²',
      data:sorted.map(function(k){return Math.round(areas[k]);}),
      backgroundColor:sorted.map(function(k){return colors[k]+'CC';}),
      borderColor:sorted.map(function(k){return colors[k];}),
      borderWidth:1.5,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},
        title:{display:true,text:titles[type],font:{family:'Fira Sans',size:11,weight:'600'},color:'#1A1A18',padding:{bottom:6}},
        tooltip:{callbacks:{label:function(c){return ' '+Math.round(c.parsed.y).toLocaleString()+' კმ²';}}}},
      scales:{
        y:{beginAtZero:true,ticks:{font:{family:'Fira Sans',size:10},callback:function(v){return v.toLocaleString()+' კმ²';}}},
        x:{ticks:{font:{family:'Fira Sans',size:9},maxRotation:35},grid:{display:false}}},
    },
  });
}

function updateTempLegend(type) {
  var el=document.getElementById('legendContent'); if(!el) return;
  var configs={
    avg:   {classes:AVG_TEMP_CLASSES,  title:'საშ. ტემ. (1990–2022)'},
    max:   {classes:MAX_TEMP_CLASSES,  title:'მაქს. ტემ. (1990–2022)'},
    precip:{classes:PRECIP_CLASSES,    title:'ნალექი (1990–2022)'},
  };
  var cfg=configs[type];
  var html='<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">'+cfg.title+'</div>';
  html+='<div class="ethnics-legend">';
  cfg.classes.forEach(function(c){
    html+='<div class="legend-item" style="margin-bottom:3px;">'+
      '<span style="display:inline-block;width:14px;height:14px;background:'+c.color+';border:1px solid #ccc;flex-shrink:0;margin-right:5px;vertical-align:middle;"></span>'+
      '<span style="font-size:10px;vertical-align:middle;">'+c.label+'</span></div>';
  });
  html+='</div>';
  el.innerHTML=html;
}

// ============================================================
// ცხელი დღეები, ტროპიკული ღამეები, ყინვიანი დღეები
// ============================================================
var hotDaysLayer       = null;
var tropNightsLayer    = null;
var frostDaysLayer     = null;
var hotDaysData        = null;
var tropNightsData     = null;
var frostDaysData      = null;

// ლეგენდის კლასები PDF-ის მიხედვით
var HOT_DAYS_CLASSES = [
  {label:'0–10',  color:'#FFF9C4'},{label:'10–20', color:'#FFE082'},
  {label:'20–30', color:'#FFB300'},{label:'30–40', color:'#FB8C00'},
  {label:'40–50', color:'#E53935'},{label:'50–60', color:'#C62828'},
  {label:'60–70', color:'#9B1B1B'},{label:'70–78', color:'#7B1F1F'},
];
var TROP_NIGHTS_CLASSES = [
  {label:'0–10',  color:'#FCE4EC'},{label:'10–20', color:'#F48FB1'},
  {label:'20–30', color:'#CE93D8'},{label:'30–40', color:'#AB47BC'},
  {label:'40–48', color:'#4A148C'},
];
var FROST_DAYS_CLASSES = [
  {label:'60–80',   color:'#E8F5E9'},{label:'80–100',  color:'#B3E5FC'},
  {label:'100–120', color:'#90CAF9'},{label:'120–140', color:'#5C6BC0'},
  {label:'140–160', color:'#3949AB'},{label:'160–180', color:'#283593'},
  {label:'180–200', color:'#1A237E'},{label:'200–240', color:'#0D1642'},
];

function _buildClimateLayer(data, layerRef, onClickFn) {
  if(layerRef.layer) map.removeLayer(layerRef.layer);
  var layer = L.geoJSON(data, {
    style: function(feat) {
      return {
        fillColor:   feat.properties.Color,
        fillOpacity: 0.75,
        color:       feat.properties.Color,
        weight:      0.2,
        opacity:     0.4,
      };
    },
    onEachFeature: function(feature, layer) {
      var p = feature.properties;
      layer.on('mouseover', function() { layer.setStyle({weight:1.2, fillOpacity:0.9}); });
      layer.on('mouseout',  function() { layer.setStyle({fillColor:p.Color, fillOpacity:0.75, color:p.Color, weight:0.2, opacity:0.4}); });
      layer.on('click', function() { onClickFn(p, data); });
    },
  }).addTo(map);
  layerRef.layer = layer;
}

var _hotRef   = {layer:null};
var _tropRef  = {layer:null};
var _frostRef = {layer:null};

function loadHotDays() {
  if(hotDaysData) { _buildClimateLayer(hotDaysData, _hotRef, _showInfoHotDays); updateClimateLegend('hot'); loadNatureMuniCenters(); return; }
  fetch('data/hot_days.geojson').then(r=>r.json()).then(function(d){
    hotDaysData=d; _buildClimateLayer(d, _hotRef, _showInfoHotDays); updateClimateLegend('hot'); loadNatureMuniCenters();
  });
}

function loadTropNights() {
  if(tropNightsData) { _buildClimateLayer(tropNightsData, _tropRef, _showInfoTropNights); updateClimateLegend('trop'); loadNatureMuniCenters(); return; }
  fetch('data/tropical_nights.geojson').then(r=>r.json()).then(function(d){
    tropNightsData=d; _buildClimateLayer(d, _tropRef, _showInfoTropNights); updateClimateLegend('trop'); loadNatureMuniCenters();
  });
}

function loadFrostDays() {
  if(frostDaysData) { _buildClimateLayer(frostDaysData, _frostRef, _showInfoFrostDays); updateClimateLegend('frost'); loadNatureMuniCenters(); return; }
  fetch('data/frost_days.geojson').then(r=>r.json()).then(function(d){
    frostDaysData=d; _buildClimateLayer(d, _frostRef, _showInfoFrostDays); updateClimateLegend('frost'); loadNatureMuniCenters();
  });
}

function _showInfoHotDays(p, data) {
  document.getElementById('infoCardContent').innerHTML=
    '<div class="info-name" style="font-size:13px;">ცხელი დღეები</div>'+
    '<span class="info-type-badge badge-village" style="background:'+p.Color+'55;color:#333;border:1px solid '+p.Color+';">'+p.Label+' დღე</span>'+
    '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);">დღის t° > 30°C  |  1990–2022</div>';
  document.getElementById('infoCard').classList.remove('hidden');
  showBottomChartClimate(data, 'hot');
}

function _showInfoTropNights(p, data) {
  document.getElementById('infoCardContent').innerHTML=
    '<div class="info-name" style="font-size:13px;">ტროპიკული ღამეები</div>'+
    '<span class="info-type-badge badge-village" style="background:'+p.Color+'55;color:#333;border:1px solid '+p.Color+';">'+p.Label+' ღამე</span>'+
    '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);">ღამის t° > 20°C  |  1990–2022</div>';
  document.getElementById('infoCard').classList.remove('hidden');
  showBottomChartClimate(data, 'trop');
}

function _showInfoFrostDays(p, data) {
  document.getElementById('infoCardContent').innerHTML=
    '<div class="info-name" style="font-size:13px;">ყინვიანი დღეები</div>'+
    '<span class="info-type-badge badge-village" style="background:'+p.Color+'55;color:#333;border:1px solid '+p.Color+';">'+p.Label+' დღე</span>'+
    '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);">t° < 0°C  |  1990–2022</div>';
  document.getElementById('infoCard').classList.remove('hidden');
  showBottomChartClimate(data, 'frost');
}

function showBottomChartClimate(data, type) {
  var canvas=document.getElementById('chartCanvas');
  document.getElementById('chartEmpty').style.display='none';
  canvas.classList.remove('hidden');
  var ctx=canvas.getContext('2d'); if(bottomChart)bottomChart.destroy();
  var titles = {hot:'ცხელი დღეების განაწილება (კმ²)', trop:'ტროპ. ღამეების განაწილება (კმ²)', frost:'ყინვიანი დღეების განაწილება (კმ²)'};
  var areas={}, colors={};
  data.features.forEach(function(f){
    var k=f.properties.Label;
    var ring=f.geometry.coordinates[0];
    var a=0;
    for(var i=0;i<ring.length;i++){
      var j=(i+1)%ring.length;
      a+=(ring[i][0]*83000)*(ring[j][1]*111000)-(ring[j][0]*83000)*(ring[i][1]*111000);
    }
    areas[k]=(areas[k]||0)+Math.abs(a)/2/1e6;
    colors[k]=f.properties.Color;
  });
  var sorted=Object.keys(areas).sort(function(a,b){return parseFloat(a)-parseFloat(b);});
  bottomChart=new Chart(ctx,{type:'bar',
    data:{labels:sorted,datasets:[{label:'კმ²',
      data:sorted.map(function(k){return Math.round(areas[k]);}),
      backgroundColor:sorted.map(function(k){return colors[k]+'CC';}),
      borderColor:sorted.map(function(k){return colors[k];}),
      borderWidth:1.5,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},
        title:{display:true,text:titles[type],font:{family:'Fira Sans',size:11,weight:'600'},color:'#1A1A18',padding:{bottom:6}},
        tooltip:{callbacks:{label:function(c){return ' '+Math.round(c.parsed.y).toLocaleString()+' კმ²';}}}},
      scales:{
        y:{beginAtZero:true,ticks:{font:{family:'Fira Sans',size:10},callback:function(v){return v+' კმ²';}}},
        x:{ticks:{font:{family:'Fira Sans',size:9},maxRotation:35},grid:{display:false}}},
    },
  });
}

function updateClimateLegend(type) {
  var el=document.getElementById('legendContent'); if(!el) return;
  var configs = {
    hot:   {classes:HOT_DAYS_CLASSES,   title:'ცხელი დღეები (1990–2022)', unit:'დღე'},
    trop:  {classes:TROP_NIGHTS_CLASSES, title:'ტროპიკული ღამეები (1990–2022)', unit:'ღამე'},
    frost: {classes:FROST_DAYS_CLASSES,  title:'ყინვიანი დღეები (1990–2022)', unit:'დღე'},
  };
  var cfg = configs[type];
  var html='<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">'+cfg.title+'</div>';
  html+='<div class="ethnics-legend">';
  cfg.classes.forEach(function(c){
    html+='<div class="legend-item" style="margin-bottom:3px;">'+
      '<span style="display:inline-block;width:14px;height:14px;background:'+c.color+';border:1px solid #ccc;flex-shrink:0;margin-right:5px;vertical-align:middle;"></span>'+
      '<span style="font-size:10px;vertical-align:middle;">'+c.label+' '+cfg.unit+'</span></div>';
  });
  html+='</div>';
  el.innerHTML=html;
}

// ============================================================
// სითბური ტალღები და გვალვის ინდექსი
// ============================================================
var heatWavesLayer   = null;
var droughtLayer     = null;
var heatWavesData    = null;
var droughtData      = null;

function loadHeatWaves() {
  if(heatWavesData) { buildHeatWavesLayer(heatWavesData); loadNatureMuniCenters(); return; }
  fetch('data/heat_waves.geojson').then(r=>r.json()).then(d=>{
    heatWavesData=d; buildHeatWavesLayer(d); loadNatureMuniCenters();
  });
}

function loadDrought() {
  if(droughtData) { buildDroughtLayer(droughtData); loadNatureMuniCenters(); return; }
  fetch('data/drought_index.geojson').then(r=>r.json()).then(d=>{
    droughtData=d; buildDroughtLayer(d); loadNatureMuniCenters();
  });
}

function buildHeatWavesLayer(data) {
  if(heatWavesLayer) map.removeLayer(heatWavesLayer);
  heatWavesLayer = L.geoJSON(data, {
    style: function(feat) {
      return {
        fillColor:   feat.properties.Color,
        fillOpacity: 0.75,
        color:       feat.properties.Color,
        weight:      0.3,
        opacity:     0.5,
      };
    },
    onEachFeature: function(feature, layer) {
      var p = feature.properties;
      layer.on('mouseover', function() { layer.setStyle({weight:1.5, fillOpacity:0.9}); });
      layer.on('mouseout',  function() { heatWavesLayer.resetStyle(layer); });
      layer.on('click', function() {
        document.getElementById("infoCardContent").innerHTML=
          '<div class="info-name" style="font-size:13px;">სითბური ტალღების ტენდენცია</div>'+
          '<span class="info-type-badge badge-village" style="background:'+p.Color+'55;color:#333;border:1px solid '+p.Color+';">სიხშირე: '+p.Label+'</span>'+
          '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);line-height:1.7;">'+
          '<b>დიაპაზონი:</b> '+p.ContourMin+' – '+p.ContourMax+'<br>'+
          '<b>პერიოდი:</b> 1990–2022</div>';
        document.getElementById("infoCard").classList.remove("hidden");
        showBottomChartHeatWaves(data);
      });
    },
  }).addTo(map);
  updateHeatWavesLegend();
}

function buildDroughtLayer(data) {
  if(droughtLayer) map.removeLayer(droughtLayer);
  droughtLayer = L.geoJSON(data, {
    style: function(feat) {
      return {
        fillColor:   feat.properties.Color,
        fillOpacity: 0.75,
        color:       feat.properties.Color,
        weight:      0.3,
        opacity:     0.5,
      };
    },
    onEachFeature: function(feature, layer) {
      var p = feature.properties;
      layer.on('mouseover', function() { layer.setStyle({weight:1.5, fillOpacity:0.9}); });
      layer.on('mouseout',  function() { droughtLayer.resetStyle(layer); });
      layer.on('click', function() {
        document.getElementById("infoCardContent").innerHTML=
          '<div class="info-name" style="font-size:13px;">გვალვის ინდექსი</div>'+
          '<span class="info-type-badge badge-village" style="background:'+p.Color+'55;color:#333;border:1px solid '+p.Color+';">'+p.Category+'</span>'+
          '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);line-height:1.7;">'+
          '<b>ინდექსი:</b> '+p.Label+'<br>'+
          '<b>პერიოდი:</b> 1990–2022</div>';
        document.getElementById("infoCard").classList.remove("hidden");
        showBottomChartDrought(data);
      });
    },
  }).addTo(map);
  updateDroughtLegend();
}

function showBottomChartHeatWaves(data) {
  var canvas=document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display="none";
  canvas.classList.remove("hidden");
  var ctx=canvas.getContext("2d"); if(bottomChart)bottomChart.destroy();
  var areas={}, colors={};
  data.features.forEach(function(f){
    var k=f.properties.Label;
    if(!areas[k]) areas[k]=0;
    var ring=f.geometry.coordinates[0];
    var a=0;
    for(var i=0;i<ring.length;i++){var j=(i+1)%ring.length;a+=(ring[i][0]*83000)*(ring[j][1]*111000)-(ring[j][0]*83000)*(ring[i][1]*111000);}
    areas[k]+=Math.abs(a)/2/1e6;
    colors[k]=f.properties.Color;
  });
  var sorted=Object.keys(areas).sort(function(a,b){return parseFloat(a)-parseFloat(b);});
  bottomChart=new Chart(ctx,{type:'bar',
    data:{labels:sorted,datasets:[{label:'ფართობი',
      data:sorted.map(function(k){return Math.round(areas[k]);}),
      backgroundColor:sorted.map(function(k){return colors[k]+'CC';}),
      borderColor:sorted.map(function(k){return colors[k];}),
      borderWidth:1.5,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},
        title:{display:true,text:'სითბური ტალღების ტენდენცია — ფართობი (კმ²)',
          font:{family:'Fira Sans',size:11,weight:'600'},color:'#1A1A18',padding:{bottom:6}},
        tooltip:{callbacks:{label:function(c){return ' '+c.parsed.y.toLocaleString()+' კმ²';}}}},
      scales:{
        y:{beginAtZero:true,ticks:{callback:function(v){return v+' კმ²';}}},
        x:{ticks:{font:{family:'Fira Sans',size:9},maxRotation:35},grid:{display:false}}},
    },
  });
}

function showBottomChartDrought(data) {
  var canvas=document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display="none";
  canvas.classList.remove("hidden");
  var ctx=canvas.getContext("2d"); if(bottomChart)bottomChart.destroy();
  var areas={}, colors={};
  data.features.forEach(function(f){
    var k=f.properties.Category;
    if(!areas[k]) areas[k]=0;
    var ring=f.geometry.coordinates[0];
    var a=0;
    for(var i=0;i<ring.length;i++){var j=(i+1)%ring.length;a+=(ring[i][0]*83000)*(ring[j][1]*111000)-(ring[j][0]*83000)*(ring[i][1]*111000);}
    areas[k]+=Math.abs(a)/2/1e6;
    colors[k]=f.properties.Color;
  });
  var order=['გვალვა არ არის','საშუალო','ზომიერი','მკაცრი','ექსტრემალური'];
  var labels=order.filter(function(k){return areas[k];});
  bottomChart=new Chart(ctx,{type:'bar',
    data:{labels:labels,datasets:[{label:'ფართობი',
      data:labels.map(function(k){return Math.round(areas[k]);}),
      backgroundColor:labels.map(function(k){return colors[k]+'CC';}),
      borderColor:labels.map(function(k){return colors[k];}),
      borderWidth:1.5,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},
        title:{display:true,text:'გვალვის ინდექსი — კატეგორიების ფართობი (კმ²)',
          font:{family:'Fira Sans',size:11,weight:'600'},color:'#1A1A18',padding:{bottom:6}},
        tooltip:{callbacks:{label:function(c){return ' '+c.parsed.y.toLocaleString()+' კმ²';}}}},
      scales:{
        y:{beginAtZero:true,ticks:{callback:function(v){return v+' კმ²';}}},
        x:{ticks:{font:{family:'Fira Sans',size:10},color:'#1A1A18'},grid:{display:false}}},
    },
  });
}

function updateHeatWavesLegend() {
  var el=document.getElementById('legendContent'); if(!el) return;
  var classes=[
    {label:'0.05–0.06',color:'#FFF9C4'},{label:'0.06–0.07',color:'#FFF176'},
    {label:'0.07–0.08',color:'#FFEE58'},{label:'0.08–0.09',color:'#FDD835'},
    {label:'0.09–0.10',color:'#F9A825'},{label:'0.10–0.11',color:'#FB8C00'},
    {label:'0.11–0.12',color:'#E64A19'},{label:'0.12–0.13',color:'#C62828'},
    {label:'0.13–0.14',color:'#B71C1C'},{label:'0.14–0.15',color:'#7B1F1F'},
  ];
  var html='<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">სიხშირის ტენდენცია (1990–2022)</div><div class="ethnics-legend">';
  classes.forEach(function(c){
    html+='<div class="legend-item" style="margin-bottom:3px;">'+
      '<span style="display:inline-block;width:14px;height:14px;background:'+c.color+';border:1px solid #ccc;flex-shrink:0;margin-right:5px;vertical-align:middle;"></span>'+
      '<span style="font-size:10px;vertical-align:middle;">'+c.label+'</span></div>';
  });
  html+='</div>';
  el.innerHTML=html;
}

function updateDroughtLegend() {
  var el=document.getElementById('legendContent'); if(!el) return;
  var classes=[
    {label:'ექსტრემალური  (< -1.5)',color:'#7B1F1F'},
    {label:'მკაცრი (-1.5 – -1.0)',color:'#E53935'},
    {label:'ზომიერი (-1.0 – -0.5)',color:'#FFA726'},
    {label:'საშუალო (-0.5 – 0.0)',color:'#FFFDE7'},
  ];
  var html='<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">გვალვის კატეგორია (1990–2022)</div><div class="ethnics-legend">';
  classes.forEach(function(c){
    html+='<div class="legend-item" style="margin-bottom:4px;">'+
      '<span style="display:inline-block;width:14px;height:14px;background:'+c.color+';border:1px solid #ccc;flex-shrink:0;margin-right:5px;vertical-align:middle;"></span>'+
      '<span style="font-size:10px;vertical-align:middle;">'+c.label+'</span></div>';
  });
  html+='</div>';
  el.innerHTML=html;
}


// ============================================================
// ღვარცოფები
// ============================================================
var madflowZoningLayer  = null;
var madflowPointLayer   = null;
var madflowErosionLayer = null;
var madflowData         = null;

var MADFLOW_ZONING_ORDER = ['დაბალი','საშუალო','მაღალი'];
var MADFLOW_ZONE_COLORS  = {
  'დაბალი':  '#C8DBD7',
  'საშუალო': '#A6C8C3',
  'მაღალი':  '#82ADA9',
};

function loadMadflow() {
  if(madflowData) { renderMadflowLayers(madflowData); return; }
  fetch('data/madflow.geojson').then(r=>r.json()).then(function(d){
    madflowData=d; renderMadflowLayers(d);
  });
}

function renderMadflowLayers(data) {
  // ---- ზონირება (Polygons) ----
  if(madflowZoningLayer)  { map.removeLayer(madflowZoningLayer);  madflowZoningLayer=null; }
  if(madflowPointLayer)   { map.removeLayer(madflowPointLayer);   madflowPointLayer=null; }
  if(madflowErosionLayer) { map.removeLayer(madflowErosionLayer); madflowErosionLayer=null; }

  var zoningFeats  = {type:'FeatureCollection', features: data.features.filter(function(f){ return f.properties.type==='zoning'; })};
  var madflowFeats = {type:'FeatureCollection', features: data.features.filter(function(f){ return f.properties.type==='madflow'; })};
  var erosionFeats = {type:'FeatureCollection', features: data.features.filter(function(f){ return f.properties.type==='erosion'; })};

  // Zoning polygons
  madflowZoningLayer = L.geoJSON(zoningFeats, {
    style: function(feat) {
      var c = MADFLOW_ZONE_COLORS[feat.properties.Name_Geo] || '#BDBDBD';
      return { fillColor:c, fillOpacity:0.65, color:'#999', weight:0.4, opacity:0.5 };
    },
    onEachFeature: function(feature, layer) {
      var p = feature.properties;
      layer.on('mouseover', function() { layer.setStyle({weight:1.5, fillOpacity:0.9}); });
      layer.on('mouseout',  function() { madflowZoningLayer.resetStyle(layer); });
      layer.on('click', function() { showInfoMadflowZone(p); showBottomChartMadflow(data); });
    },
  }).addTo(map);

  // MadFlow points — ლურჯი ნაკადის სიმბოლო
  madflowPointLayer = L.geoJSON(madflowFeats, {
    pointToLayer: function(feature, latlng) {
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">' +
        '<path fill="#1565C0" stroke="#0D47A1" stroke-width="1" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>' +
        '</svg>';
      var icon = L.divIcon({ html:svg, iconSize:[16,16], iconAnchor:[8,8], className:'' });
      var marker = L.marker(latlng, {icon:icon});
      marker.bindTooltip(feature.properties.Name_Geo||'ღვარცოფი',
        {direction:'top', className:'village-label', offset:[0,-10]});
      marker.on('click', function() { showInfoMadflowPoint(feature.properties, 'madflow'); showBottomChartMadflow(data); });
      return marker;
    },
  }).addTo(map);

  // Erosion points — ნარინჯი ტალღის სიმბოლო
  madflowErosionLayer = L.geoJSON(erosionFeats, {
    pointToLayer: function(feature, latlng) {
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14">' +
        '<rect x="1" y="1" width="12" height="12" rx="2" fill="#E65100" stroke="#BF360C" stroke-width="1"/>' +
        '<line x1="3" y1="7" x2="11" y2="7" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>' +
        '<line x1="7" y1="3" x2="7" y2="11" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>';
      var icon = L.divIcon({ html:svg, iconSize:[14,14], iconAnchor:[7,7], className:'' });
      var marker = L.marker(latlng, {icon:icon});
      marker.bindTooltip(feature.properties.Name_Geo||'ეროზია',
        {direction:'top', className:'village-label', offset:[0,-10]});
      marker.on('click', function() { showInfoMadflowPoint(feature.properties, 'erosion'); showBottomChartMadflow(data); });
      return marker;
    },
  }).addTo(map);

  updateMadflowLegend(data);
  loadNatureMuniCenters();
}

function showInfoMadflowZone(p) {
  var color = MADFLOW_ZONE_COLORS[p.Name_Geo] || '#BDBDBD';
  document.getElementById('infoCardContent').innerHTML=
    '<div class="info-name">' + (p.Name_Geo||'') + '</div>' +
    '<span class="info-type-badge badge-village" style="background:' + color + '55;color:#444;border:1px solid ' + color + ';">' + (p.Name_Eng||'') + '</span>' +
    '<div class="info-row" style="margin-top:8px;"><span class="info-key">ფართობი</span><span class="info-val">' + (p.Area_km2||0).toLocaleString() + ' კმ²</span></div>';
  document.getElementById('infoCard').classList.remove('hidden');
}

function showInfoMadflowPoint(p, type) {
  var color = type==='madflow' ? '#1565C0' : '#E65100';
  var label = type==='madflow' ? 'ღვარცოფი' : 'მდინარის ნაპირგარეცხვა';
  document.getElementById('infoCardContent').innerHTML=
    '<div class="info-name">' + (p.Name_Geo||p.Name_Eng||'–') + '</div>' +
    '<span class="info-type-badge" style="background:' + color + '22;color:' + color + ';border:1px solid ' + color + '55;">' + label + '</span>';
  document.getElementById('infoCard').classList.remove('hidden');
}

function showBottomChartMadflow(data) {
  var canvas=document.getElementById('chartCanvas');
  document.getElementById('chartEmpty').style.display='none';
  canvas.classList.remove('hidden');
  var ctx=canvas.getContext('2d'); if(bottomChart)bottomChart.destroy();

  var areas={}, colors={};
  data.features.filter(function(f){ return f.properties.type==='zoning'; })
    .forEach(function(f){
      var k=f.properties.Name_Geo;
      areas[k]=(areas[k]||0)+(f.properties.Area_km2||0);
      colors[k]=MADFLOW_ZONE_COLORS[k]||'#BDBDBD';
    });
  var sorted=MADFLOW_ZONING_ORDER.filter(function(k){ return areas[k]; });

  bottomChart=new Chart(ctx,{type:'bar',
    data:{labels:sorted,
      datasets:[{label:'ფართობი (კმ²)',
        data:sorted.map(function(k){return Math.round(areas[k]);}),
        backgroundColor:sorted.map(function(k){return colors[k]+'CC';}),
        borderColor:sorted.map(function(k){return colors[k];}),
        borderWidth:1.5, borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},
        title:{display:true,text:'ღვარცოფის საფრთხის ზონირება — ფართობი (კმ²)',
          font:{family:'Fira Sans',size:12,weight:'600'},color:'#1A1A18',padding:{bottom:6}},
        tooltip:{callbacks:{label:function(c){return ' '+c.parsed.y.toLocaleString()+' კმ²';}}}},
      scales:{
        y:{beginAtZero:true,grid:{color:'rgba(0,0,0,0.05)'},
          ticks:{font:{family:'Fira Sans',size:10},color:'#6B6862',callback:function(v){return v.toLocaleString()+' კმ²';}}},
        x:{ticks:{font:{family:'Fira Sans',size:10},color:'#1A1A18'},grid:{display:false}}},
      animation:{onComplete:function(){
        var chart=this; var ctx2=chart.ctx;
        ctx2.font="bold 9px 'Fira Sans',sans-serif"; ctx2.fillStyle='#444';
        ctx2.textAlign='center'; ctx2.textBaseline='bottom';
        chart.data.datasets.forEach(function(ds,i){
          chart.getDatasetMeta(i).data.forEach(function(bar,idx){
            var val=ds.data[idx];
            if(val>0) ctx2.fillText(val.toLocaleString()+' კმ²', bar.x, bar.y-3);
          });
        });
      }},
    },
  });
}

function updateMadflowLegend(data) {
  var el=document.getElementById('legendContent'); if(!el) return;
  var html='<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">ღვარცოფის საფრთხის ზონები</div>';
  html+='<div class="ethnics-legend">';
  MADFLOW_ZONING_ORDER.forEach(function(label){
    var c=MADFLOW_ZONE_COLORS[label]||'#BDBDBD';
    html+='<div class="eth-legend-item">'+
      '<span class="eth-dot" style="background:'+c+';border:1px solid rgba(0,0,0,0.15);border-radius:3px;"></span>'+
      '<span style="font-size:10px;">'+label+'</span></div>';
  });
  html+='</div>';

  var madflowCount = data ? data.features.filter(function(f){return f.properties.type==='madflow';}).length : '';
  var erosionCount = data ? data.features.filter(function(f){return f.properties.type==='erosion';}).length : '';

  html+='<div style="margin-top:10px;font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">სახეობა</div>';
  html+='<div class="ethnics-legend">'+
    '<div class="eth-legend-item">'+
      '<svg width="16" height="16" viewBox="0 0 24 24" style="flex-shrink:0;"><path fill="#1565C0" stroke="#0D47A1" stroke-width="1" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>'+
      '<span style="font-size:10px;">ღვარცოფი ('+madflowCount+')</span></div>'+
    '<div class="eth-legend-item">'+
      '<svg width="14" height="14" viewBox="0 0 14 14" style="flex-shrink:0;"><rect x="1" y="1" width="12" height="12" rx="2" fill="#E65100" stroke="#BF360C" stroke-width="1"/><line x1="3" y1="7" x2="11" y2="7" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><line x1="7" y1="3" x2="7" y2="11" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>'+
      '<span style="font-size:10px;">ნაპირგარეცხვა ('+erosionCount+')</span></div>'+
  '</div>';
  el.innerHTML=html;
}

// ============================================================
// ტყეები და მცენარეული საფარი
// ============================================================
var forestLayer     = null;
var vegetationLayer = null;
var forestData      = null;
var vegetationData  = null;

// ლეგენდის მონაცემები
var FOREST_LEGEND = [
  {color:'#1B5E20', label:'ნაძვი და სოჭი'},
  {color:'#2E7D32', label:'წიფელი'},
  {color:'#6D4C41', label:'წაბლი'},
  {color:'#8D6E63', label:'მუხა და სხვა ფოთლოვნები'},
  {color:'#C8894E', label:'რცხილა და ჯაგრცხილა'},
  {color:'#A5D6A7', label:'თხემლა'},
  {color:'#E0E0E0', label:'ნათელი ტყე / ჭალის ტყე'},
];
var VEG_LEGEND = [
  {color:'#F9A825', label:'ნათელი ტყე'},
  {color:'#66BB6A', label:'სანაპირო (ჭალის ტყე)'},
  {color:'#8D6E63', label:'მუხნარი და რცხილნარი'},
  {color:'#2E7D32', label:'აღმ. საქ. წიფლნარი'},
  {color:'#1B5E20', label:'მთის ფიჭვნარი'},
  {color:'#D4E157', label:'მაღალმთის ველი'},
  {color:'#AED581', label:'სუბალპ. მდელო ველის ელ.'},
  {color:'#C5E1A5', label:'აღმ. საქ. სუბალპ. მდელო'},
  {color:'#E6EE9C', label:'ალპური მდელო'},
  {color:'#BCAAA4', label:'ჯაგეკლ. ველი ტყის ელ.'},
  {color:'#FFF9C4', label:'უროიანი ველი'},
];

function loadForest() {
  if(forestData) { buildForestLayer(forestData); loadNatureMuniCenters(); return; }
  fetch('data/forest.geojson').then(r=>r.json()).then(d=>{
    forestData=d; buildForestLayer(d); loadNatureMuniCenters();
  });
}

function loadVegetation() {
  if(vegetationData) { buildVegetationLayer(vegetationData); loadNatureMuniCenters(); return; }
  fetch('data/vegetation.geojson').then(r=>r.json()).then(d=>{
    vegetationData=d; buildVegetationLayer(d); loadNatureMuniCenters();
  });
}

function buildForestLayer(data) {
  if(forestLayer) map.removeLayer(forestLayer);
  forestLayer = L.geoJSON(data, {
    style: function(feat) {
      return {
        fillColor:   feat.properties.Color,
        fillOpacity: 0.75,
        color:       '#555',
        weight:      0.4,
        opacity:     0.6,
      };
    },
    onEachFeature: function(feature, layer) {
      var p = feature.properties;
      layer.on('mouseover', function() { layer.setStyle({weight:1.5, fillOpacity:0.92}); });
      layer.on('mouseout',  function() { forestLayer.resetStyle(layer); });
      layer.on('click', function() {
        document.getElementById("infoCardContent").innerHTML=
          '<div class="info-name" style="font-size:13px;">'+(p.Name_Geo||'')+'</div>'+
          '<span class="info-type-badge badge-village" style="background:'+p.Color+'55;color:#333;border:1px solid '+p.Color+';">'+
          (p.Name_Eng||'')+'</span>'+
          '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);line-height:1.7;">'+
          '<b>ფართობი:</b> '+(p.Area_km2||0).toLocaleString()+' კმ²</div>';
        document.getElementById("infoCard").classList.remove("hidden");
        showBottomChartForest(data);
      });
    },
  }).addTo(map);
  updateForestLegend();
}

function buildVegetationLayer(data) {
  if(vegetationLayer) map.removeLayer(vegetationLayer);
  vegetationLayer = L.geoJSON(data, {
    style: function(feat) {
      return {
        fillColor:   feat.properties.Color,
        fillOpacity: 0.75,
        color:       '#555',
        weight:      0.4,
        opacity:     0.6,
      };
    },
    onEachFeature: function(feature, layer) {
      var p = feature.properties;
      layer.on('mouseover', function() { layer.setStyle({weight:1.5, fillOpacity:0.92}); });
      layer.on('mouseout',  function() { vegetationLayer.resetStyle(layer); });
      layer.on('click', function() {
        document.getElementById("infoCardContent").innerHTML=
          '<div class="info-name" style="font-size:13px;">'+(p.Name_Geo||'')+'</div>'+
          '<span class="info-type-badge badge-village" style="background:'+p.Color+'55;color:#333;border:1px solid '+p.Color+';">'+
          (p.Name_Eng||'')+'</span>'+
          '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);line-height:1.7;">'+
          '<b>ფართობი:</b> '+(p.Area_km2||0).toLocaleString()+' კმ²</div>';
        document.getElementById("infoCard").classList.remove("hidden");
        showBottomChartVegetation(data);
      });
    },
  }).addTo(map);
  updateVegetationLegend();
}

function _calcChartAreas(data, keyField) {
  var areas={}, colors={};
  data.features.forEach(function(f){
    var k=f.properties[keyField];
    areas[k]=(areas[k]||0)+(f.properties.Area_km2||0);
    colors[k]=f.properties.Color;
  });
  return {areas:areas, colors:colors};
}

function showBottomChartForest(data) {
  var canvas=document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display="none";
  canvas.classList.remove("hidden");
  var ctx=canvas.getContext("2d"); if(bottomChart)bottomChart.destroy();
  var d=_calcChartAreas(data,"Name_Geo");
  var sorted=Object.keys(d.areas).filter(function(k){return k!=="-";})
    .sort(function(a,b){return d.areas[b]-d.areas[a];});
  bottomChart=new Chart(ctx,{type:"bar",
    data:{labels:sorted,datasets:[{label:"ფართობი",
      data:sorted.map(function(k){return Math.round(d.areas[k]);}),
      backgroundColor:sorted.map(function(k){return d.colors[k]+"CC";}),
      borderColor:sorted.map(function(k){return d.colors[k];}),
      borderWidth:1.5,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},
        title:{display:true,text:"ტყეები — ფართობის განაწილება სახეობების მიხედვით (კმ²)",
          font:{family:"Fira Sans",size:11,weight:"600"},color:"#1A1A18",padding:{bottom:6}},
        tooltip:{callbacks:{label:function(c){return " "+c.parsed.y.toLocaleString()+" კმ²";}}}},
      scales:{
        y:{beginAtZero:true,grid:{color:"rgba(0,0,0,0.05)"},
          ticks:{font:{family:"Fira Sans",size:10},color:"#6B6862",callback:function(v){return v+" კმ²";}}},
        x:{ticks:{font:{family:"Fira Sans",size:9},color:"#1A1A18",maxRotation:35},grid:{display:false}}},
      animation:{onComplete:function(){
        var chart=this;var ctx2=chart.ctx;
        ctx2.font="bold 9px 'Fira Sans',sans-serif";ctx2.fillStyle="#444";
        ctx2.textAlign="center";ctx2.textBaseline="bottom";
        chart.data.datasets.forEach(function(ds,i){
          chart.getDatasetMeta(i).data.forEach(function(bar,idx){
            var val=ds.data[idx];
            if(val>0)ctx2.fillText(val.toLocaleString()+" კმ²",bar.x,bar.y-2);
          });
        });
      }},
    },
  });
}

function showBottomChartVegetation(data) {
  var canvas=document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display="none";
  canvas.classList.remove("hidden");
  var ctx=canvas.getContext("2d"); if(bottomChart)bottomChart.destroy();
  var d=_calcChartAreas(data,"Name_Geo");
  var sorted=Object.keys(d.areas).sort(function(a,b){return d.areas[b]-d.areas[a];});
  bottomChart=new Chart(ctx,{type:"bar",
    data:{labels:sorted,datasets:[{label:"ფართობი",
      data:sorted.map(function(k){return Math.round(d.areas[k]);}),
      backgroundColor:sorted.map(function(k){return d.colors[k]+"CC";}),
      borderColor:sorted.map(function(k){return d.colors[k];}),
      borderWidth:1.5,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},
        title:{display:true,text:"მცენარეული საფარი — ფართობის განაწილება (კმ²)",
          font:{family:"Fira Sans",size:11,weight:"600"},color:"#1A1A18",padding:{bottom:6}},
        tooltip:{callbacks:{label:function(c){return " "+c.parsed.y.toLocaleString()+" კმ²";}}}},
      scales:{
        y:{beginAtZero:true,grid:{color:"rgba(0,0,0,0.05)"},
          ticks:{font:{family:"Fira Sans",size:10},color:"#6B6862",callback:function(v){return v+" კმ²";}}},
        x:{ticks:{font:{family:"Fira Sans",size:8},color:"#1A1A18",maxRotation:40},grid:{display:false}}},
      animation:{onComplete:function(){
        var chart=this;var ctx2=chart.ctx;
        ctx2.font="bold 8px 'Fira Sans',sans-serif";ctx2.fillStyle="#444";
        ctx2.textAlign="center";ctx2.textBaseline="bottom";
        chart.data.datasets.forEach(function(ds,i){
          chart.getDatasetMeta(i).data.forEach(function(bar,idx){
            var val=ds.data[idx];
            if(val>0)ctx2.fillText(val.toLocaleString()+" კმ²",bar.x,bar.y-2);
          });
        });
      }},
    },
  });
}

function updateForestLegend() {
  var el=document.getElementById("legendContent"); if(!el) return;
  var html='<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">ძირითადი მერქნიანი სახეობები</div>';
  html+='<div class="ethnics-legend">';
  FOREST_LEGEND.forEach(function(c){
    html+='<div class="legend-item" style="margin-bottom:3px;">'+
      '<span style="display:inline-block;width:14px;height:14px;background:'+c.color+';border:1px solid #aaa;flex-shrink:0;margin-right:5px;vertical-align:middle;"></span>'+
      '<span style="font-size:10px;vertical-align:middle;">'+c.label+'</span></div>';
  });
  html+='</div>';
  el.innerHTML=html;
}

function updateVegetationLegend() {
  var el=document.getElementById("legendContent"); if(!el) return;
  var html='<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">მცენარეული საფარი</div>';
  html+='<div class="ethnics-legend">';
  VEG_LEGEND.forEach(function(c){
    html+='<div class="legend-item" style="margin-bottom:3px;">'+
      '<span style="display:inline-block;width:14px;height:14px;background:'+c.color+';border:1px solid #aaa;flex-shrink:0;margin-right:5px;vertical-align:middle;"></span>'+
      '<span style="font-size:10px;vertical-align:middle;">'+c.label+'</span></div>';
  });
  html+='</div>';
  el.innerHTML=html;
}

// ============================================================
// ნიადაგები
// ============================================================

var soilsLayer     = null;
var soilsBornLayer = null;
var soilsData      = null;
var soilsBornData  = null;


// ===== Info + Chart functions for Soils =====
function showInfoSoils(p) {
  document.getElementById("infoCardContent").innerHTML=`
    <div class="info-name" style="font-size:13px;">${p.Name_Geo||''}</div>
    <span class="info-type-badge badge-village" style="background:${p.Color}33;color:#555;border:1px solid ${p.Color}88;">${p.Name_Eng||''}</span>
    <div style="margin-top:8px;font-size:10px;color:var(--text-muted);line-height:1.7;">
      <b>FAO:</b> ${p.Soil_Name||'-'}<br>
      <b>pH:</b> ${p.soil_pH||'-'} &nbsp;|&nbsp; <b>ტექსტურა:</b> ${p.Soil_textu||'-'}<br>
      <b>ფართობი:</b> ${p.Area_km2 ? p.Area_km2.toLocaleString()+' კმ²' : '-'}
    </div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartSoils(data) {
  var canvas=document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display="none";
  canvas.classList.remove("hidden");
  var ctx=canvas.getContext("2d"); if(bottomChart)bottomChart.destroy();

  var areas={}, colors={};
  data.features.forEach(function(f){
    var k=f.properties.Name_Geo;
    areas[k]  = (areas[k]||0)+(f.properties.Area_km2||0);
    colors[k] = f.properties.Color;
  });
  var sorted=Object.keys(areas).sort(function(a,b){return areas[b]-areas[a];});

  bottomChart=new Chart(ctx,{type:"bar",
    data:{
      labels:sorted,
      datasets:[{label:"ფართობი (კმ²)",
        data:sorted.map(k=>Math.round(areas[k])),
        backgroundColor:sorted.map(k=>colors[k]+"CC"),
        borderColor:sorted.map(k=>colors[k]),
        borderWidth:1.5, borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},
        title:{display:true,text:"ნიადაგის ტიპები — ფართობის განაწილება (კმ²)",
          font:{family:"Fira Sans",size:12,weight:"600"},color:"#1A1A18",padding:{bottom:6}},
        tooltip:{callbacks:{label:c=>` ${c.parsed.y.toLocaleString()} კმ²`}}},
      scales:{
        y:{beginAtZero:true,grid:{color:"rgba(0,0,0,0.05)"},
          ticks:{font:{family:"Fira Sans",size:10},color:"#6B6862",callback:v=>v.toLocaleString()+" კმ²"}},
        x:{ticks:{font:{family:"Fira Sans",size:9},color:"#1A1A18",maxRotation:35},grid:{display:false}}},
      animation:{onComplete:function(){
        var chart=this; var ctx2=chart.ctx;
        ctx2.font="bold 9px 'Fira Sans',sans-serif"; ctx2.fillStyle="#444";
        ctx2.textAlign="center"; ctx2.textBaseline="bottom";
        chart.data.datasets.forEach(function(ds,i){
          chart.getDatasetMeta(i).data.forEach(function(bar,idx){
            var val=ds.data[idx];
            if(val>0) ctx2.fillText(val.toLocaleString()+" კმ²", bar.x, bar.y-3);
          });
        });
      }},
    },
  });
}

// ===== Info + Chart functions for Soils Born =====
function showInfoSoilsBorn(p) {
  document.getElementById("infoCardContent").innerHTML=`
    <div class="info-name" style="font-size:13px;">ტიპი ${p.Soil_Geo||''}</div>
    <span class="info-type-badge badge-village" style="background:${p.Color}33;color:#555;border:1px solid ${p.Color}88;">${p.Name_Eng ? p.Name_Eng.split('(')[0].trim() : ''}</span>
    <div style="margin-top:8px;font-size:10px;color:var(--text-muted);line-height:1.6;">${p.Name_Geo||'-'}<br>
      <b>ფართობი:</b> ${p.Area_km2 ? p.Area_km2.toLocaleString()+' კმ²' : '-'}
    </div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartSoilsBorn(data) {
  var canvas=document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display="none";
  canvas.classList.remove("hidden");
  var ctx=canvas.getContext("2d"); if(bottomChart)bottomChart.destroy();

  var areas={}, colors={}, labels={};
  data.features.forEach(function(f){
    var k=f.properties.Soil_Geo;
    areas[k]  = (areas[k]||0)+(f.properties.Area_km2||0);
    colors[k] = f.properties.Color;
    labels[k] = 'ტიპი '+k;
  });
  var sorted=Object.keys(areas).sort(function(a,b){return areas[b]-areas[a];});

  bottomChart=new Chart(ctx,{type:"bar",
    data:{
      labels:sorted.map(k=>labels[k]),
      datasets:[{label:"ფართობი (კმ²)",
        data:sorted.map(k=>Math.round(areas[k])),
        backgroundColor:sorted.map(k=>colors[k]+"CC"),
        borderColor:sorted.map(k=>colors[k]),
        borderWidth:1.5, borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},
        title:{display:true,text:"ნიადაგ-წარმ. ქანები — ფართობის განაწილება (კმ²)",
          font:{family:"Fira Sans",size:12,weight:"600"},color:"#1A1A18",padding:{bottom:6}},
        tooltip:{callbacks:{label:c=>` ${c.parsed.y.toLocaleString()} კმ²`}}},
      scales:{
        y:{beginAtZero:true,grid:{color:"rgba(0,0,0,0.05)"},
          ticks:{font:{family:"Fira Sans",size:10},color:"#6B6862",callback:v=>v.toLocaleString()+" კმ²"}},
        x:{ticks:{font:{family:"Fira Sans",size:10},color:"#1A1A18"},grid:{display:false}}},
      animation:{onComplete:function(){
        var chart=this; var ctx2=chart.ctx;
        ctx2.font="bold 9px 'Fira Sans',sans-serif"; ctx2.fillStyle="#444";
        ctx2.textAlign="center"; ctx2.textBaseline="bottom";
        chart.data.datasets.forEach(function(ds,i){
          chart.getDatasetMeta(i).data.forEach(function(bar,idx){
            var val=ds.data[idx];
            if(val>0) ctx2.fillText(val.toLocaleString()+" კმ²", bar.x, bar.y-3);
          });
        });
      }},
    },
  });
}

// ===== Info + Chart functions for Geology =====
function showInfoGeology(p) {
  document.getElementById("infoCardContent").innerHTML=`
    <div class="info-name" style="font-size:15px;font-weight:700;">${p.Index||''}</div>
    <span class="info-type-badge badge-village" style="background:${p.Color}33;color:#555;border:1px solid ${p.Color}88;">გეოლ. ასაკი</span>
    <div style="margin-top:8px;font-size:10px;color:var(--text-muted);line-height:1.6;">
      ${p.Name_Geo||'-'}<br>
      <i>${p.Name_Eng||''}</i><br>
      <b>ფართობი:</b> ${p.Area_km2 ? p.Area_km2.toLocaleString()+' კმ²' : '-'}
    </div>`;
  document.getElementById("infoCard").classList.remove("hidden");
}

function showBottomChartGeology(data) {
  var canvas=document.getElementById("chartCanvas");
  document.getElementById("chartEmpty").style.display="none";
  canvas.classList.remove("hidden");
  var ctx=canvas.getContext("2d"); if(bottomChart)bottomChart.destroy();

  var areas={}, colors={};
  data.features.forEach(function(f){
    var k=f.properties.Index;
    areas[k]  = (areas[k]||0)+(f.properties.Area_km2||0);
    colors[k] = f.properties.Color;
  });
  var sorted=Object.keys(areas).sort(function(a,b){return areas[b]-areas[a];});

  bottomChart=new Chart(ctx,{type:"bar",
    data:{
      labels:sorted,
      datasets:[{label:"ფართობი (კმ²)",
        data:sorted.map(k=>Math.round(areas[k])),
        backgroundColor:sorted.map(k=>colors[k]+"CC"),
        borderColor:sorted.map(k=>colors[k]),
        borderWidth:1.5, borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},
        title:{display:true,text:"გეოლოგიური ფენები — ფართობის განაწილება (კმ²)",
          font:{family:"Fira Sans",size:12,weight:"600"},color:"#1A1A18",padding:{bottom:6}},
        tooltip:{callbacks:{label:c=>` ${c.parsed.y.toLocaleString()} კმ²`}}},
      scales:{
        y:{beginAtZero:true,grid:{color:"rgba(0,0,0,0.05)"},
          ticks:{font:{family:"Fira Sans",size:10},color:"#6B6862",callback:v=>v.toLocaleString()+" კმ²"}},
        x:{ticks:{font:{family:"Fira Sans",size:10},color:"#1A1A18"},grid:{display:false}}},
      animation:{onComplete:function(){
        var chart=this; var ctx2=chart.ctx;
        ctx2.font="bold 9px 'Fira Sans',sans-serif"; ctx2.fillStyle="#444";
        ctx2.textAlign="center"; ctx2.textBaseline="bottom";
        chart.data.datasets.forEach(function(ds,i){
          chart.getDatasetMeta(i).data.forEach(function(bar,idx){
            var val=ds.data[idx];
            if(val>0) ctx2.fillText(val.toLocaleString()+" კმ²", bar.x, bar.y-3);
          });
        });
      }},
    },
  });
}


// ============================================================
// სეტყვა
// ============================================================
var hailTotalLayer  = null;
var hail100Layer    = null;
var hailTotalData   = null;
var hail100Data     = null;
var hailActiveType  = 'total';   // 'total' | '100'

var HAIL_TOTAL_CLASSES = [
  {cls:'≤ 1', r:7,  color:'#4FC3F7'},
  {cls:'1–2', r:10, color:'#0288D1'},
  {cls:'2–3', r:13, color:'#01579B'},
  {cls:'3–4', r:16, color:'#1A237E'},
  {cls:'4–5', r:19, color:'#311B92'},
  {cls:'5–7', r:22, color:'#4A148C'},
  {cls:'> 7', r:26, color:'#880E4F'},
];
var HAIL_100_CLASSES = [
  {cls:'≤ 1', r:7,  color:'#EF9A9A'},
  {cls:'1–2', r:10, color:'#E53935'},
  {cls:'2–3', r:13, color:'#B71C1C'},
  {cls:'3–4', r:16, color:'#7B1FA2'},
  {cls:'> 4', r:20, color:'#4A148C'},
];

// კლასის განსაზღვრა
function _hailClassTotal(v) {
  var c = HAIL_TOTAL_CLASSES;
  if(v<=1) return c[0]; if(v<=2) return c[1]; if(v<=3) return c[2];
  if(v<=4) return c[3]; if(v<=5) return c[4]; if(v<=7) return c[5];
  return c[6];
}
function _hailClass100(v) {
  var c = HAIL_100_CLASSES;
  if(v<=1) return c[0]; if(v<=2) return c[1]; if(v<=3) return c[2];
  if(v<=4) return c[3]; return c[4];
}

function loadHailTotal() {
  hailActiveType = 'total';
  _loadHailBoth(function() { _drawHailLayer('total'); loadNatureMuniCenters(); });
}

function loadHail100() {
  hailActiveType = '100';
  _loadHailBoth(function() { _drawHailLayer('100'); loadNatureMuniCenters(); });
}

function _loadHailBoth(cb) {
  var loaded = 0;
  var needed = (!hailTotalData ? 1 : 0) + (!hail100Data ? 1 : 0);
  if(needed === 0) { cb(); return; }
  function tryDraw() { if(++loaded === needed) cb(); }
  if(!hailTotalData) fetch('data/hail_total.geojson').then(r=>r.json()).then(d=>{ hailTotalData=d; tryDraw(); });
  if(!hail100Data)   fetch('data/hail_100.geojson').then(r=>r.json()).then(d=>{ hail100Data=d;   tryDraw(); });
}

function _drawHailLayer(type) {
  // ორივე ფენა გამოვრთოთ
  if(hailTotalLayer) { map.removeLayer(hailTotalLayer); hailTotalLayer=null; }
  if(hail100Layer)   { map.removeLayer(hail100Layer);   hail100Layer=null; }

  var data   = type==='total' ? hailTotalData : hail100Data;
  var valKey = type==='total' ? 'Total_km2'   : 'P100_km2';
  var getFn  = type==='total' ? _hailClassTotal : _hailClass100;

  var layer = L.geoJSON(data, {
    pointToLayer: function(feat, latlng) {
      var p = feat.properties;
      var val = p[valKey];
      var cls = getFn(val);
      var marker = L.circleMarker(latlng, {
        radius:      cls.r,
        fillColor:   cls.color,
        color:       '#fff',
        weight:      1.5,
        fillOpacity: 0.88,
      });
      marker.bindTooltip(
        p.Name_Geo + '<br><b>' + val + ' კმ²</b>',
        {direction:'top', className:'village-label', offset:[0, -cls.r]}
      );
      marker.on('click', function() {
        showInfoHail(p, type);
        showBottomChartHail(data, type);
      });
      return marker;
    },
  }).addTo(map);

  if(type==='total') hailTotalLayer=layer; else hail100Layer=layer;
  updateHailLegend(type);
}

// ლეგენდის toggle handler
function _switchHailType(type) {
  if(type===hailActiveType) return;
  hailActiveType = type;
  _drawHailLayer(type);
}

function showInfoHail(p, type) {
  var val   = type==='total' ? p.Total_km2 : p.P100_km2;
  var label = type==='total' ? 'საერთო დაზ. ფართობი' : '100%-ით დაზ. ფართობი';
  var cls   = (type==='total' ? _hailClassTotal : _hailClass100)(val);
  document.getElementById("infoCardContent").innerHTML=`
    <div class="info-name" style="font-size:13px;">${p.Name_Geo||''}</div>
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
  if(bottomChart) bottomChart.destroy();

  var valKey   = type==='total' ? 'Total_km2' : 'P100_km2';
  var getFn    = type==='total' ? _hailClassTotal : _hailClass100;
  var titleTxt = type==='total'
    ? 'საერთო დაზიანებული ფართობი ერთ სეტყვიანობაზე (კმ²)'
    : '100%-ით დაზ. ფართობი ერთ სეტყვიანობაზე (კმ²)';

  var feats = data.features.slice().sort(function(a,b){
    return b.properties[valKey] - a.properties[valKey];
  });

  bottomChart = new Chart(ctx, {type:'bar',
    data:{
      labels:   feats.map(f=>f.properties.Name_Geo),
      datasets:[{
        label: 'ფართობი (კმ²)',
        data:  feats.map(f=>f.properties[valKey]),
        backgroundColor: feats.map(f=>getFn(f.properties[valKey]).color+'CC'),
        borderColor:     feats.map(f=>getFn(f.properties[valKey]).color),
        borderWidth:1.5, borderRadius:4,
      }],
    },
    options:{responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        title:{display:true, text:titleTxt,
          font:{family:'Fira Sans',size:11,weight:'600'},color:'#1A1A18',padding:{bottom:6}},
        tooltip:{callbacks:{label:c=>` ${c.parsed.y} კმ²`}},
      },
      scales:{
        y:{beginAtZero:true, grid:{color:'rgba(0,0,0,0.05)'},
          ticks:{font:{family:'Fira Sans',size:10},color:'#6B6862',callback:v=>v+' კმ²'}},
        x:{ticks:{font:{family:'Fira Sans',size:8},color:'#1A1A18',maxRotation:40},grid:{display:false}},
      },
      animation:{onComplete:function(){
        var chart=this; var ctx2=chart.ctx;
        ctx2.font="bold 8px 'Fira Sans',sans-serif";
        ctx2.fillStyle="#444"; ctx2.textAlign="center"; ctx2.textBaseline="bottom";
        chart.data.datasets.forEach(function(ds,i){
          chart.getDatasetMeta(i).data.forEach(function(bar,idx){
            var val=ds.data[idx];
            if(val>0) ctx2.fillText(val+' კმ²', bar.x, bar.y-2);
          });
        });
      }},
    },
  });
}

function updateHailLegend(type) {
  var el = document.getElementById('legendContent'); if(!el) return;
  var classes  = type==='total' ? HAIL_TOTAL_CLASSES : HAIL_100_CLASSES;
  var titleTxt = type==='total' ? 'საერთო დაზ. ფართობი (კმ²)' : '100%-ით დაზ. ფართობი (კმ²)';

  // toggle — year-btn სტილი (ზუსტად მოქალაქეობის ფენასავით)
  var html = `<div class="ethnics-legend">
    ${classes.map(function(c){
      var d=c.r*2;
      return '<div class="eth-legend-item"><svg width="'+(d+4)+'" height="'+(d+4)+'" style="flex-shrink:0;margin-right:6px;"><circle cx="'+(d/2+2)+'" cy="'+(d/2+2)+'" r="'+c.r+'" fill="'+c.color+'" stroke="#fff" stroke-width="1.5" fill-opacity="0.88"/></svg><span>'+c.cls+' კმ²</span></div>';
    }).join('')}
  </div>
  <div style="margin-top:10px;">
    <div style="font-size:9px;font-weight:700;color:var(--text-muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;">სეტყვა</div>
    <div style="display:flex;gap:6px;">
      <button class="year-btn ${type==='total'?'active':''}" data-hailtype="total">საერთო</button>
      <button class="year-btn ${type==='100'?'active':''}" data-hailtype="100">100%</button>
    </div>
  </div>`;

  el.innerHTML = html;

  // event listeners
  el.querySelectorAll('[data-hailtype]').forEach(function(btn){
    btn.addEventListener('click', function(){
      _switchHailType(this.dataset.hailtype);
    });
  });
}

function loadSoils() {
  if(soilsData) { buildSoilsLayer(soilsData); loadNatureMuniCenters(); return; }
  fetch('data/soils.geojson').then(r=>r.json()).then(d=>{
    soilsData=d; buildSoilsLayer(d); loadNatureMuniCenters();
  });
}

function loadSoilsBorn() {
  if(soilsBornData) { buildSoilsBornLayer(soilsBornData); loadNatureMuniCenters(); return; }
  fetch('data/soils_born.geojson').then(r=>r.json()).then(d=>{
    soilsBornData=d; buildSoilsBornLayer(d); loadNatureMuniCenters();
  });
}

function buildSoilsLayer(data) {
  if(soilsLayer) map.removeLayer(soilsLayer);
  soilsLayer = L.geoJSON(data, {
    style: function(feat) {
      return {
        fillColor:   feat.properties.Color,
        fillOpacity: 0.72,
        color:       '#888',
        weight:      0.5,
        opacity:     0.8,
      };
    },
    onEachFeature: function(feature, layer) {
      var p = feature.properties;
      layer.on('mouseover', function() { layer.setStyle({weight:2, fillOpacity:0.9}); });
      layer.on('mouseout',  function() { soilsLayer.resetStyle(layer); });
      layer.on('click', function() {
        showInfoSoils(p);
        showBottomChartSoils(data);
      });
    },
  }).addTo(map);
  updateSoilsLegend();
}

function buildSoilsBornLayer(data) {
  if(soilsBornLayer) map.removeLayer(soilsBornLayer);
  soilsBornLayer = L.geoJSON(data, {
    style: function(feat) {
      return {
        fillColor:   feat.properties.Color,
        fillOpacity: 0.72,
        color:       '#888',
        weight:      0.5,
        opacity:     0.8,
      };
    },
    onEachFeature: function(feature, layer) {
      var p = feature.properties;
      layer.on('mouseover', function() { layer.setStyle({weight:2, fillOpacity:0.9}); });
      layer.on('mouseout',  function() { soilsBornLayer.resetStyle(layer); });
      layer.on('click', function() {
        showInfoSoilsBorn(p);
        showBottomChartSoilsBorn(data);
      });
    },
  }).addTo(map);
  updateSoilsBornLegend();
}

function updateSoilsLegend() {
  var el = document.getElementById('legendContent'); if(!el) return;
  var html = '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">ნიადაგის ტიპები</div>';
  html += '<div class="ethnics-legend">';
  SOIL_LEGEND.forEach(function(item) {
    html += '<div class="legend-item" style="margin-bottom:3px;">' +
      '<span style="display:inline-block;width:14px;height:14px;background:' + item[0] + ';border:1px solid #aaa;flex-shrink:0;margin-right:5px;vertical-align:middle;"></span>' +
      '<span style="font-size:10px;vertical-align:middle;">' + item[1] + '</span></div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function updateSoilsBornLegend() {
  var el = document.getElementById('legendContent'); if(!el) return;
  var html = '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">ნიადაგ-წარმომქმნელი ქანები</div>';
  html += '<div class="ethnics-legend">';
  BORN_LEGEND.forEach(function(item) {
    html += '<div class="legend-item" style="margin-bottom:3px;">' +
      '<span style="display:inline-block;width:14px;height:14px;background:' + item[1] + ';border:1px solid #aaa;flex-shrink:0;margin-right:5px;vertical-align:middle;"></span>' +
      '<span style="font-size:10px;vertical-align:middle;"><b>' + item[0] + '</b> — ' + item[2] + '</span></div>';
  });
  html += '</div>';
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

var geologyLayer      = null;
var foultsLayer       = null;
var metalOreLayer     = null;
var nonmetalOreLayer  = null;
var oilGasLayer       = null;
var geologyData       = null;
var foultsData        = null;
var metalOreData      = null;
var nonmetalOreData   = null;
var oilGasData        = null;

function geoMineralIcon(symbolKey) {
  var svg = GEO_SVG_SYMBOLS[symbolKey] || GEO_SVG_SYMBOLS['kirqva'];
  // inject width/height directly into SVG tag since classes are already scoped
  var sized = svg.replace('<svg ', '<svg width="22" height="27" ');
  if (symbolKey === 'navtobi') {
    sized = svg.replace('<svg ', '<svg width="16" height="27" ');
  }
  return L.divIcon({ html: sized, iconSize:[22,27], iconAnchor:[11,14], className:'' });
}

function loadGeology() {
  var loaded = 0;
  function tryRender() { if(++loaded === 5) renderGeologyLayers(); }
  if(!geologyData)     fetch('data/geology.geojson').then(r=>r.json()).then(d=>{ geologyData=d; tryRender(); }); else tryRender();
  if(!foultsData)      fetch('data/foults.geojson').then(r=>r.json()).then(d=>{ foultsData=d; tryRender(); }); else tryRender();
  if(!metalOreData)    fetch('data/metal_ore.geojson').then(r=>r.json()).then(d=>{ metalOreData=d; tryRender(); }); else tryRender();
  if(!nonmetalOreData) fetch('data/nonmetal_ore.geojson').then(r=>r.json()).then(d=>{ nonmetalOreData=d; tryRender(); }); else tryRender();
  if(!oilGasData)      fetch('data/oil_gas.geojson').then(r=>r.json()).then(d=>{ oilGasData=d; tryRender(); }); else tryRender();
}

function renderGeologyLayers() {
  // ---- 1. გეოლოგიური პოლიგონები ----
  if(geologyLayer) map.removeLayer(geologyLayer);
  geologyLayer = L.geoJSON(geologyData, {
    style: function(feat) {
      return {
        fillColor:   feat.properties.Color,
        fillOpacity: 0.65,
        color:       '#888',
        weight:      0.6,
        opacity:     0.8,
      };
    },
    onEachFeature: function(feature, layer) {
      var p = feature.properties;

      layer.on('click', function() {
        showInfoGeology(p);
        showBottomChartGeology(geologyData);
      });
      layer.on('mouseover', function() { layer.setStyle({weight:1.5, fillOpacity:0.85}); });
      layer.on('mouseout',  function() { geologyLayer.resetStyle(layer); });
    },
  }).addTo(map);

  // ---- 2. რღვევები (Foults) ----
  if(foultsLayer) map.removeLayer(foultsLayer);
  foultsLayer = L.geoJSON(foultsData, {
    style: function() {
      return { color:'#CC0000', weight:2, opacity:0.8, dashArray:'6,3' };
    },
  }).addTo(map);

  // ---- 3. ლითონური წიაღისეული ----
  if(metalOreLayer) map.removeLayer(metalOreLayer);
  metalOreLayer = L.geoJSON(metalOreData, {
    pointToLayer: function(feat, latlng) {
      var p = feat.properties;
      var marker = L.marker(latlng, { icon: geoMineralIcon(p.symbol), zIndexOffset: 500 });
      marker.bindTooltip(p.Name_Geo + ' (' + p.Type_Geo + ')', {direction:'top', className:'village-label', offset:[0,-27]});
      marker.on('click', function() {
        document.getElementById('infoCard').classList.remove('hidden');
        document.getElementById('infoCard').innerHTML =
          '<div class="info-title">' + (p.Name_Geo||'') + '</div>' +
          '<div class="info-row"><span class="info-label">სახეობა:</span><span class="info-value">' + (p.Type_Geo||'-') + '</span></div>' +
          '<div class="info-row"><span class="info-label">რაიონი:</span><span class="info-value">' + (p.raioni||'-') + '</span></div>' +
          '<div class="info-row"><span class="info-label">Type:</span><span class="info-value">' + (p.Type_Eng||'-') + '</span></div>';
      });
      return marker;
    },
  }).addTo(map);

  // ---- 4. არალითონური წიაღისეული ----
  if(nonmetalOreLayer) map.removeLayer(nonmetalOreLayer);
  nonmetalOreLayer = L.geoJSON(nonmetalOreData, {
    pointToLayer: function(feat, latlng) {
      var p = feat.properties;
      var marker = L.marker(latlng, { icon: geoMineralIcon(p.symbol), zIndexOffset: 400 });
      marker.bindTooltip(p.Name_Geo + ' (' + p.Type_Geo + ')', {direction:'top', className:'village-label', offset:[0,-27]});
      marker.on('click', function() {
        document.getElementById('infoCard').classList.remove('hidden');
        document.getElementById('infoCard').innerHTML =
          '<div class="info-title">' + (p.Name_Geo||'') + '</div>' +
          '<div class="info-row"><span class="info-label">სახეობა:</span><span class="info-value">' + (p.Type_Geo||'-') + '</span></div>' +
          '<div class="info-row"><span class="info-label">გამოყენება:</span><span class="info-value">' + (p.Use_Geo||'-') + '</span></div>' +
          '<div class="info-row"><span class="info-label">რაიონი:</span><span class="info-value">' + (p.raioni||'-') + '</span></div>';
      });
      return marker;
    },
  }).addTo(map);

  // ---- 5. ნავთობი და გაზი ----
  if(oilGasLayer) map.removeLayer(oilGasLayer);
  oilGasLayer = L.geoJSON(oilGasData, {
    pointToLayer: function(feat, latlng) {
      var p = feat.properties;
      var marker = L.marker(latlng, { icon: geoMineralIcon('navtobi'), zIndexOffset: 600 });
      marker.bindTooltip(p.Name_Geo, {direction:'top', className:'village-label', offset:[0,-27]});
      marker.on('click', function() {
        document.getElementById('infoCard').classList.remove('hidden');
        document.getElementById('infoCard').innerHTML =
          '<div class="info-title">' + (p.Name_Geo||'') + '</div>' +
          '<div class="info-row"><span class="info-label">სახეობა:</span><span class="info-value">' + (p.Type_Geo||'-') + '</span></div>' +
          '<div class="info-row"><span class="info-label">რაიონი:</span><span class="info-value">' + (p.raioni||'-') + '</span></div>';
      });
      return marker;
    },
  }).addTo(map);

  updateGeologyLegend();
  loadNatureMuniCenters();
}

function updateGeologyLegend() {
  var el = document.getElementById('legendContent'); if(!el) return;

  // Geology polygon colors
  var geoIndexes = {};
  if(geologyData) geologyData.features.forEach(function(f) {
    var p = f.properties;
    geoIndexes[p.Index] = { color: p.Color, name: p.Name_Eng ? p.Name_Eng.split(',')[0] : p.Index };
  });

  // Mineral symbols used
  var metalSyms   = {};
  var nonMetSyms  = {};
  if(metalOreData)    metalOreData.features.forEach(function(f)   { metalSyms[f.properties.symbol]  = f.properties.Type_Geo; });
  if(nonmetalOreData) nonmetalOreData.features.forEach(function(f) { nonMetSyms[f.properties.symbol] = f.properties.Type_Geo; });

  var geoNamesMap = {"andeziti": "ანდეზიტი", "aqati": "აქატი", "bariti": "ბარიტი", "bazalti": "ბაზალტი", "diabazi": "დიაბაზი", "faifuris_qva": "ფაიფურის ქვა", "gabro": "გაბრო", "gaji": "გაჯი", "gamarmariloebuli_kirqva": "გამარმ. კირქვა", "graniti": "გრანიტი", "kirqva": "კირქვა", "litografiuli_qva": "ლითოგრ. ქვა", "navtobi": "ნავთობი და გაზი", "oqro": "ოქრო", "qvisha_xreshi": "ქვიშა-ხრეში", "qvishaqva": "ქვიშაქვა", "rkina": "რკინა", "saagure_tixa": "სააგ. თიხა", "sacemente_masala": "საცემ. მასალა", "spilendzi": "სპილენძი", "torfi": "ტორფი", "tufi": "ტუფი", "vercxli": "ვერცხლი", "vulkanuri_ferfli": "ვულკ. ფერფლი", "zeoliti": "ცეოლითი"};

  var html = '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">ამგები ქანების ასაკი</div>';
  html += '<div class="ethnics-legend">';
  Object.keys(geoIndexes).sort().forEach(function(idx) {
    var info = geoIndexes[idx];
    html += '<div class="legend-item" style="margin-bottom:3px;">' +
      '<span style="display:inline-block;width:14px;height:14px;background:' + info.color + ';border:1px solid #aaa;flex-shrink:0;margin-right:5px;vertical-align:middle;"></span>' +
      '<span style="font-size:10px;vertical-align:middle;"><b>' + idx + '</b></span>' +
      '</div>';
  });
  html += '</div>';

  html += '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin:8px 0 4px;text-transform:uppercase;letter-spacing:.06em;">ლითონური წიაღისეული</div>';
  html += '<div class="ethnics-legend">';
  Object.keys(metalSyms).sort().forEach(function(sym) {
    var svgSmall = (GEO_SVG_SYMBOLS[sym]||'').replace('<svg ', '<svg width="14" height="17" ');
    html += '<div class="legend-item" style="margin-bottom:3px;align-items:center;">' +
      '<span style="display:inline-block;width:14px;height:17px;margin-right:5px;vertical-align:middle;flex-shrink:0;">' + svgSmall + '</span>' +
      '<span style="font-size:10px;vertical-align:middle;">' + (geoNamesMap[sym] || sym) + '</span></div>';
  });
  html += '</div>';

  html += '<div style="font-size:10px;font-weight:700;color:var(--text-muted);margin:8px 0 4px;text-transform:uppercase;letter-spacing:.06em;">არალითონური</div>';
  html += '<div class="ethnics-legend">';
  Object.keys(nonMetSyms).sort().forEach(function(sym) {
    var svgSmall = (GEO_SVG_SYMBOLS[sym]||'').replace('<svg ', '<svg width="14" height="17" ');
    html += '<div class="legend-item" style="margin-bottom:3px;align-items:center;">' +
      '<span style="display:inline-block;width:14px;height:17px;margin-right:5px;vertical-align:middle;flex-shrink:0;">' + svgSmall + '</span>' +
      '<span style="font-size:10px;vertical-align:middle;">' + (geoNamesMap[sym] || sym) + '</span></div>';
  });
  // navtobi
  var navSvg = (GEO_SVG_SYMBOLS['navtobi']||'').replace('<svg ', '<svg width="11" height="17" ');
  html += '<div class="legend-item" style="margin-bottom:3px;align-items:center;">' +
    '<span style="display:inline-block;width:14px;height:17px;margin-right:5px;vertical-align:middle;flex-shrink:0;">' + navSvg + '</span>' +
    '<span style="font-size:10px;vertical-align:middle;">ნავთობი და გაზი</span></div>';
  html += '</div>';

  // Foult line
  html += '<div class="legend-item" style="margin-top:6px;align-items:center;">' +
    '<span style="display:inline-block;width:24px;height:3px;background:#CC0000;margin-right:5px;border-top:2px dashed #CC0000;"></span>' +
    '<span style="font-size:10px;">რღვევა</span></div>';

  el.innerHTML = html;
}


// ===== Population checkbox — მთავარი toggle =====
function showMainView() {
  document.getElementById("mainLayerView").style.display = "";
  document.getElementById("sublayerView").style.display  = "none";
  document.getElementById("natureView").style.display    = "none";
  document.getElementById("filterSection").style.display = "none";
  document.getElementById("chkPopulation").checked = false;
  document.getElementById("chkNature").checked = false;
  removeAllThematic();
  removeAllNatureLayers();
  resetPopLegend();
  loadNeutralLayers();
}

function showSublayerView() {
  document.getElementById("mainLayerView").style.display = "none";
  document.getElementById("sublayerView").style.display  = "";
  // ნეიტრალური ფენები ვმალავთ
  removeNeutralLayers();
  // პირველი ქვე-ფენა ავტომატურად
  activeSublayer = "population";
  document.querySelectorAll(".sublayer-btn").forEach(b => b.classList.remove("active"));
  document.querySelector(".sublayer-btn[data-sublayer='population']").classList.add("active");
  switchSublayer("population");
}

document.getElementById("chkPopulation").addEventListener("change", function(e) {
  if (e.target.checked) {
    showSublayerView();
  } else {
    showMainView();
  }
});

// უკან ღილაკი
document.getElementById("btnBack").addEventListener("click", function() {
  showMainView();
});

// ===== Sublayer buttons =====
document.querySelectorAll(".sublayer-btn").forEach(function(btn) {
  btn.addEventListener("click", function() {
    document.querySelectorAll(".sublayer-btn").forEach(b=>b.classList.remove("active"));
    this.classList.add("active");
    switchSublayer(this.dataset.sublayer);
  });
});

// ===== Type pills =====
document.querySelectorAll(".pill").forEach(function(btn) {
  btn.addEventListener("click", function() {
    document.querySelectorAll(".pill").forEach(p=>p.classList.remove("active"));
    this.classList.add("active"); activeType=this.dataset.type;
    if(activeSublayer==="population") applyFilters();
  });
});

// ===== Municipality select =====
document.getElementById("muniSelect").addEventListener("change", function() {
  activeMuni=this.value;
  if(activeSublayer==="population") applyFilters();
});

// ===== Basemap switcher =====
document.querySelectorAll(".basemap-item").forEach(function(item) {
  item.addEventListener("click", function() {
    var key=this.dataset.basemap;
    map.removeLayer(currentBasemap); currentBasemap=basemaps[key]; currentBasemap.addTo(map);
    if(currentLayer)  currentLayer.bringToFront();
    if(ethnicsLayer)  ethnicsLayer.bringToFront();
    if(religionLayer) religionLayer.bringToFront();
    if(neutralBoundaryLayer) neutralBoundaryLayer.bringToFront();
    if(neutralLabelLayer)    neutralLabelLayer.bringToFront();
    document.querySelectorAll(".basemap-item").forEach(el=>el.classList.remove("active"));
    this.classList.add("active");
  });
});

// ===== Init =====
document.getElementById("mainLayerView").style.display  = "";
document.getElementById("sublayerView").style.display   = "none";
document.getElementById("natureView").style.display     = "none";
document.getElementById("filterSection").style.display  = "none";
document.getElementById("btnCensus").disabled = true;
document.getElementById("btnCensus").style.opacity = "0.45";
document.getElementById("btnCensus").style.cursor = "not-allowed";
document.getElementById("btnCensus").title = "ჯერ რუკაზე პუნქტი აირჩიეთ";
loadNeutralLayers();
