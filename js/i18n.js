// ===== ენა: ქართული (ძირითადი) / ინგლისური =====
// ინგლისური ირთვება ბმულით ?lang=en ან სათაურის გადამრთველით (EN / ქარ); არჩევანი ბრაუზერში ინახება.
// თარგმანი — js/i18n-en.js (I18N_EN: ქართული ტექსტი → ინგლისური). ინგლისურ რეჟიმში გვერდზე
// გამოჩენილი ყველა ტექსტი — მათ შორის მოგვიანებით დამატებული (ლეგენდა, ბარათი, წარწერა) —
// ლექსიკონით ითარგმნება (MutationObserver). ქართულ რეჟიმში არაფერი იცვლება.
// ახალი ტექსტის თარგმნა: i18n-en.js-ში ზუსტად იგივე ქართული ტექსტი → ინგლისური.
var LANG = (function () {
  var q = /[?&]lang=(en|ka)\b/.exec(location.search);
  if (q) {
    try { localStorage.setItem("atlasLang", q[1]); } catch (e) {}
    return q[1];
  }
  try {
    return localStorage.getItem("atlasLang") === "en" ? "en" : "ka";
  } catch (e) {
    return "ka";
  }
})();

var GEO_CHARS = /[Ⴀ-ჿ]/;

// ლექსიკონში ძებნა: ჯერ ინტერფეისი (I18N_EN), მერე მონაცემები (I18N_DATA_EN, js/i18n-data-en.js).
// თუ ზუსტი ჩანაწერი არ არის — ნიმუშები:
//   „10–20 დღე“ → „10–20 days“ (ერთეულები: I18N_UNITS)
//   „ფართობი:“ → „Area:“; „ფართობი: 12 კმ²“ → „Area: 12 km²“
//   „მეწყერი (121)“, „ფართობი (კმ²)“ → ფრჩხილის გარე და შიდა ნაწილი ცალ-ცალკე
//   „X — Y“, „X · Y“, „X | Y“ → თითოეული ნაწილი ცალ-ცალკე (თუ ყველა ითარგმნება)
var NUM_UNIT = /^([^Ⴀ-ჿ]*\d)\s*(\S+)$/;
var PAREN_TAIL = /^(.*\S)\s*\(([^()]+)\)$/;
var LABEL_VALUE = /^([^:]+):\s*(.*)$/;
var TRAIL_NUM = /^(.*[^\s\d.,–-])\s+([-−–\d.,/]*\d[-−–\d.,/]*|[A-Z0-9]{2,6})$/;
var LEAD_NUM = /^(№\s?[\w-]+)\s+(.+)$/;
var EDGE_PUNCT = /^([|·•]\s+)?(.*?)(\s+[|·•])?$/;
var SEPARATORS = [" — ", " · ", " | ", "; ", ", "];
function i18nPart(s) {
  if (!GEO_CHARS.test(s)) return s;
  var v = i18nLookup(s.trim());
  return v === undefined ? undefined : s.replace(s.trim(), v);
}
function i18nLookup(key) {
  var en = I18N_EN[key];
  if (en !== undefined) return en;
  if (typeof I18N_DATA_EN !== "undefined") {
    en = I18N_DATA_EN[key];
    if (en !== undefined) return en;
  }
  if (I18N_UNITS[key]) return I18N_UNITS[key];
  var m = NUM_UNIT.exec(key);
  var unit = m && (I18N_UNITS[m[2]] || I18N_EN[m[2]]);
  if (unit) return m[1] + " " + unit;
  if (/:$/.test(key)) {
    en = i18nLookup(key.slice(0, -1).trim());
    return en === undefined ? undefined : en + ":";
  }
  m = LABEL_VALUE.exec(key);
  if (m) {
    var k = I18N_EN[m[1].trim() + ":"];
    k = k !== undefined ? k.replace(/:$/, "") : i18nLookup(m[1].trim());
    var v = m[2] ? i18nPart(m[2]) : "";
    if (k !== undefined && v !== undefined) return k + ":" + (m[2] ? " " + v : "");
  }
  for (var i = 0; i < SEPARATORS.length; i++) {
    if (key.indexOf(SEPARATORS[i]) === -1) continue;
    var parts = key.split(SEPARATORS[i]).map(i18nPart);
    if (parts.indexOf(undefined) === -1) return parts.join(SEPARATORS[i]);
  }
  m = PAREN_TAIL.exec(key);
  if (m) {
    var base = i18nPart(m[1]);
    var inner = i18nPart(m[2]);
    if (base !== undefined && inner !== undefined) return base + " (" + inner + ")";
  }
  // „მაგნიტუდა 6.07“, „სულ 28“, „ტიპი 3“, „სეისმური სადგური TRLT“, „№41 ქვემობოლნისი“
  m = TRAIL_NUM.exec(key);
  if (m) {
    en = i18nLookup(m[1]);
    if (en !== undefined) return en + " " + m[2];
  }
  // „სულ 3566 კმ²“ — სიტყვა + რიცხვი ერთეულით
  m = /^([^\d]*[^\s\d])\s+(\d.*)$/.exec(key);
  if (m) {
    en = i18nLookup(m[1]);
    var tail = i18nPart(m[2]);
    if (en !== undefined && tail !== undefined) return en + " " + tail;
  }
  m = LEAD_NUM.exec(key);
  if (m) {
    en = i18nLookup(m[2]);
    if (en !== undefined) return m[1] + " " + en;
  }
  // კიდეებზე გამყოფი: „8.15 კმ² |“
  m = EDGE_PUNCT.exec(key);
  if (m && (m[1] || m[3])) {
    en = i18nPart(m[2]);
    if (en !== undefined) return (m[1] || "") + en + (m[3] || "");
  }
  return undefined;
}

// ქართული ტექსტის თარგმანი (თუ ლექსიკონშია), სხვა შემთხვევაში — უცვლელად
function t(text) {
  if (LANG !== "en" || typeof text !== "string" || !GEO_CHARS.test(text)) return text;
  var key = text.replace(/\s+/g, " ").trim();
  var en = i18nLookup(key);
  if (en === undefined) return text;
  // წინა/ბოლო გამოტოვებები ვინარჩუნებთ (ტექსტი სხვა ელემენტებს ეკვრის)
  var lead = /^\s*/.exec(text)[0], trail = /\s*$/.exec(text)[0];
  return lead + en + trail;
}

function setLang(lang) {
  try { localStorage.setItem("atlasLang", lang); } catch (e) {}
  var params = location.search.replace(/^\?/, "").split("&").filter(function (p) {
    return p && p.indexOf("lang=") !== 0;
  });
  if (lang === "en") params.push("lang=en");
  location.href = location.pathname + (params.length ? "?" + params.join("&") : "") + location.hash;
}

// დიაგრამის წარწერა: სტრიქონი ან სტრიქონების მასივი (მრავალხაზიანი წარწერა)
function tChart(v) {
  if (Array.isArray(v)) {
    var joined = v.join(" ");
    var tj = t(joined);
    return tj !== joined ? tj : v.map(tChart);
  }
  return typeof v === "string" ? t(v) : v;
}
function tWrap(fn) {
  if (typeof fn !== "function" || fn.$i18n) return fn;
  var w = function () { return tChart(fn.apply(this, arguments)); };
  w.$i18n = true;
  return w;
}
function translateChart(chart) {
  var d = chart.data || {};
  if (d.labels && d.labels !== chart.$i18nLabels) {
    var orig = d.labels;
    d.labels = orig.map(tChart);
    d.labels.$orig = orig;
    chart.$i18nLabels = d.labels;
  }
  (d.datasets || []).forEach(function (ds) {
    if (typeof ds.label === "string") ds.label = t(ds.label);
  });
  var o = chart.config.options || {};
  var p = o.plugins || {};
  ["title", "subtitle"].forEach(function (k) {
    if (p[k] && p[k].text) p[k].text = tChart(p[k].text);
  });
  var cb = p.tooltip && p.tooltip.callbacks;
  if (cb) Object.keys(cb).forEach(function (k) { cb[k] = tWrap(cb[k]); });
  var lg = p.legend && p.legend.labels;
  if (lg && lg.generateLabels && !lg.generateLabels.$i18n) {
    var gl = lg.generateLabels;
    lg.generateLabels = function (c) {
      return gl.call(this, c).map(function (it) { it.text = tChart(it.text); return it; });
    };
    lg.generateLabels.$i18n = true;
  }
  Object.keys(o.scales || {}).forEach(function (k) {
    var sc = o.scales[k];
    if (sc.title && sc.title.text) sc.title.text = tChart(sc.title.text);
    if (sc.ticks && sc.ticks.callback) sc.ticks.callback = tWrap(sc.ticks.callback);
  });
}

(function initI18n() {
  document.documentElement.lang = LANG;

  // გადამრთველი სათაურის ნავიგაციაში
  var nav = document.querySelector(".site-nav");
  if (nav) {
    var sw = document.createElement("a");
    sw.href = "#";
    sw.className = "nav-link lang-switch";
    sw.setAttribute("data-no-i18n", "");
    sw.textContent = LANG === "en" ? "ქარ" : "EN";
    sw.title = LANG === "en" ? "ქართული ვერსია" : "English version";
    sw.addEventListener("click", function (e) {
      e.preventDefault();
      setLang(LANG === "en" ? "ka" : "en");
    });
    nav.appendChild(sw);
  }
  if (LANG !== "en") return;

  var ATTRS = ["title", "placeholder", "aria-label", "alt"];
  function skip(el) {
    return !el || (el.closest && el.closest("[data-no-i18n], script, style"));
  }
  function translateText(node) {
    var el = node.parentElement;
    if (skip(el)) return;
    // ერთი და იგივე ქართული სხვადასხვა ადგილას სხვანაირად ითარგმნება — data-en="…" ელემენტზე
    if (el.hasAttribute("data-en") && el.childNodes.length === 1) {
      if (node.nodeValue !== el.getAttribute("data-en")) node.nodeValue = el.getAttribute("data-en");
      return;
    }
    var v = node.nodeValue;
    if (!GEO_CHARS.test(v)) return;
    var tv = t(v);
    if (tv !== v) node.nodeValue = tv;
  }
  function translateAttrs(el) {
    if (skip(el)) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var v = el.getAttribute(ATTRS[i]);
      if (v && GEO_CHARS.test(v)) {
        var tv = t(v);
        if (tv !== v) el.setAttribute(ATTRS[i], tv);
      }
    }
  }
  function translateTree(root) {
    if (root.nodeType === 3) return translateText(root);
    if (root.nodeType !== 1) return;
    translateAttrs(root);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    var n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) translateText(n);
      else translateAttrs(n);
    }
  }

  // Chart.js: დიაგრამის წარწერები ტილოზე იხატება (DOM-ში არ არის), ამიტომ ცალკე ითარგმნება.
  // data.labels ითარგმნება, ქართული ორიგინალი ინახება labels.$orig-ში (highlightBottomBars ამას ადარებს).
  if (typeof Chart !== "undefined") Chart.register({ id: "i18n", beforeInit: translateChart, beforeUpdate: translateChart });

  document.title = t(document.title);
  translateTree(document.body);
  new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      if (m.type === "characterData") translateText(m.target);
      else if (m.type === "attributes") translateAttrs(m.target);
      else m.addedNodes.forEach(translateTree);
    });
  }).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRS,
  });
})();
