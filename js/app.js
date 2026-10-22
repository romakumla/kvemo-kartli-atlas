// აპლიკაციის გაშვება: პანელების ნავიგაცია, ღილაკები, ფილტრები, ძიება, ბეჭდვა, მობილური ვერსია
// Part of the atlas script, split from the former js/main.js. Files are loaded in
// order by index.html; theme files only define things, their start-up code is
// here: it runs the other files' start-up code, then its own.

// ===== Start-up of all theme files, in their original order =====
initCore();
initPopulation();
initMapCommon();
initNatureLandscapeHazards();
initHistory();
initEconomy();
initEducation();
initTourism();
initHealth();

// მთავარ რუკაზე ინფო-ღილაკი არ ჩანს (თავიდან ცარიელი, უმოქმედო ღილაკი ჩანდა)
setInfoBtn(null);

// ===== თემების ნავიგაცია =====
// თითოეული თემა: მონიშვნის ველი მარცხენა პანელში (chk), თემის პანელი (view),
// „უკან“ ღილაკი (back) და ქვეფენების ღილაკების ატრიბუტი (sub → [data-sub]).
var THEMES = [
  { chk: "chkPopulation", view: "sublayerView", back: "btnBack", sub: "sublayer" },
  { chk: "chkNature", view: "natureView", back: "btnNatureBack", sub: "naturesub" },
  { chk: "chkHistory", view: "historyView", back: "btnHistoryBack", sub: "histsub" },
  { chk: "chkEconomy", view: "economyView", back: "btnEconomyBack", sub: "econsub" },
  { chk: "chkEducation", view: "educationView", back: "btnEducationBack", sub: "edusub" },
  { chk: "chkTourism", view: "tourismView", back: "btnTourismBack", sub: "toursub" },
  { chk: "chkHealth", view: "healthView", back: "btnHealthBack", sub: "healthsub" },
];

// ჩანს მხოლოდ ერთი პანელი (მთავარი ან ერთ-ერთი თემის); მონიშნულია მხოლოდ მისი ველი
function showOnlyView(viewId) {
  document.getElementById("mainLayerView").style.display =
    viewId === "mainLayerView" ? "" : "none";
  THEMES.forEach(function (t) {
    document.getElementById(t.view).style.display = t.view === viewId ? "" : "none";
    document.getElementById(t.chk).checked = t.view === viewId;
  });
}

// ყველა თემის ფენა, მათ შორის მუნიციპალიტეტების ცენტრები და საზღვრები
function removeAllThemeLayers() {
  removeAllThematic();
  removeAllNatureLayers();
  removeAllHistoryLayers();
  removeAllEconomyLayers();
  removeAllEducationLayers();
  removeAllTourismLayers();
  removeAllHealthLayers();
  removeAllSocialLayers();
  removeAllZooLayers();
  removeNatureMuniCenters();
}

// საერთო გასუფთავება: ფენები, ინფო ბარათი, ფილტრები, ლეგენდა, ინფო-ღილაკი
function resetThemeState() {
  removeAllThemeLayers();
  document.getElementById("filterSection").style.display = "none";
  document.getElementById("infoCard").classList.add("hidden");
  hideSettlementLegend();
  setInfoBtn(null);
}

// მთავარი პანელი: ნეიტრალური რუკა მუნიციპალიტეტებით
function showMainView() {
  showOnlyView("mainLayerView");
  resetThemeState();
  resetPopLegend();
  hideChartPanel();
  loadNeutralLayers();
}

// თემის გახსნა: ჩაირთვება პირველი ქვეფენა — ისე, თითქოს მის ღილაკს დააწკაპეს
function openTheme(theme) {
  showOnlyView(theme.view);
  resetThemeState();
  removeNeutralLayers();
  showChartPanel();
  resetChartPanel();
  var buttons = document.querySelectorAll("[data-" + theme.sub + "]");
  buttons.forEach(function (b) {
    b.classList.remove("active");
  });
  buttons[0].click();
}

THEMES.forEach(function (theme) {
  document.getElementById(theme.chk).addEventListener("change", function (e) {
    if (e.target.checked) openTheme(theme);
    else showMainView();
  });
  document.getElementById(theme.back).addEventListener("click", showMainView);
});

// ===== Sublayer buttons (მხოლოდ მოსახლეობის პანელი) =====
// მნიშვნელოვანი: სელექტორი უნდა იყოს [data-sublayer], და არა ".sublayer-btn",
// რადგან ".sublayer-btn" კლასი ყველა პანელის ღილაკს აქვს — შედეგად
// switchSublayer(undefined) ეშვებოდა და ინფო-ღილაკს აქრობდა.
bindSublayerButtons("sublayer", function () {
  switchSublayer(this.dataset.sublayer);
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
    finalizeLayerOrder();
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

document.getElementById("tourismView").style.display = "none";

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
  loadData("data/settlements.geojson", function (d) {
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
          clearLayer(_searchMarker);
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
    _searchMarker = clearLayer(_searchMarker);
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

// Populate selects (compareA/B removed — now using cmpA/cmpB in census modal)
// ["compareA", "compareB"] no longer in DOM

// Dataset sources — pull from existing data objects

// ============================================================
// 📱 Mobile panel toggles
// ============================================================
function initMobilePanels() {
  var leftBtn = document.getElementById("mobLeftBtn");
  var rightBtn = document.getElementById("mobRightBtn");
  var backdrop = document.getElementById("mobBackdrop");
  var leftPanel = document.getElementById("layerPanel");
  var rightPanel = document.getElementById("basemapPanel");

  if (!leftBtn || !rightBtn) return;

  function closeAll() {
    leftPanel.classList.remove("mob-open");
    rightPanel.classList.remove("mob-open");
    backdrop.classList.remove("visible");
  }

  function toggleLeft(e) {
    e.preventDefault();
    e.stopPropagation();
    var isOpen = leftPanel.classList.contains("mob-open");
    closeAll();
    if (!isOpen) {
      leftPanel.classList.add("mob-open");
      backdrop.classList.add("visible");
    }
  }

  function toggleRight(e) {
    e.preventDefault();
    e.stopPropagation();
    var isOpen = rightPanel.classList.contains("mob-open");
    closeAll();
    if (!isOpen) {
      rightPanel.classList.add("mob-open");
      backdrop.classList.add("visible");
    }
  }

  // Both click and touchend for mobile
  leftBtn.addEventListener("click", toggleLeft);
  leftBtn.addEventListener("touchend", toggleLeft);
  rightBtn.addEventListener("click", toggleRight);
  rightBtn.addEventListener("touchend", toggleRight);

  backdrop.addEventListener("click", closeAll);
  backdrop.addEventListener("touchend", closeAll);

  document
    .querySelectorAll('.layer-item input[type="checkbox"]')
    .forEach(function (cb) {
      cb.addEventListener("change", function () {
        if (window.innerWidth <= 768) setTimeout(closeAll, 300);
      });
    });
}

// Run after DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMobilePanels);
} else {
  setTimeout(initMobilePanels, 100);
}
