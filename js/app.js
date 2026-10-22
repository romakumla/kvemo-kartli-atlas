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

function showMainView() {
  document.getElementById("mainLayerView").style.display = "";
  document.getElementById("sublayerView").style.display = "none";
  document.getElementById("natureView").style.display = "none";
  document.getElementById("historyView").style.display = "none";
  document.getElementById("economyView").style.display = "none";
  document.getElementById("educationView").style.display = "none";
  document.getElementById("tourismView").style.display = "none";
  document.getElementById("healthView").style.display = "none";
  document.getElementById("filterSection").style.display = "none";
  document.getElementById("chkPopulation").checked = false;
  document.getElementById("chkNature").checked = false;
  document.getElementById("chkHistory").checked = false;
  document.getElementById("chkEconomy").checked = false;
  document.getElementById("chkEducation").checked = false;
  document.getElementById("chkTourism").checked = false;
  document.getElementById("chkHealth").checked = false;
  removeAllThematic();
  removeAllNatureLayers();
  removeAllHistoryLayers();
  removeAllEconomyLayers();
  removeAllEducationLayers();
  removeAllTourismLayers();
  removeAllHealthLayers();
  removeAllSocialLayers();
  removeAllZooLayers();
  resetPopLegend();
  loadNeutralLayers();
  hideChartPanel();
  hideSettlementLegend();
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
    .querySelectorAll("[data-sublayer]")
    .forEach((b) => b.classList.remove("active"));
  document
    .querySelector("[data-sublayer='population']")
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

// ===== Sublayer buttons (მხოლოდ მოსახლეობის პანელი) =====
// მნიშვნელოვანი: სელექტორი უნდა იყოს [data-sublayer], და არა ".sublayer-btn",
// რადგან ".sublayer-btn" კლასი ყველა პანელის ღილაკს აქვს — შედეგად
// switchSublayer(undefined) ეშვებოდა და ინფო-ღილაკს აქრობდა.
document.querySelectorAll("[data-sublayer]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    if (this.classList.contains("active")) return; // იგივეზე ხელახლა დაწკაპება
    document
      .querySelectorAll("[data-sublayer]")
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
  if (_searchData) {
    cb(_searchData);
    return;
  }
  fetch(dataUrl("data/settlements.geojson"))
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
