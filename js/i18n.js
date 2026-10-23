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

// ქართული ტექსტის თარგმანი (თუ ლექსიკონშია), სხვა შემთხვევაში — უცვლელად
function t(text) {
  if (LANG !== "en" || typeof text !== "string" || !GEO_CHARS.test(text)) return text;
  var key = text.replace(/\s+/g, " ").trim();
  var en = I18N_EN[key];
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
    if (skip(node.parentElement)) return;
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
