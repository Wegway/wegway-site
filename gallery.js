/* Gallery: year-sectioned scroll (newest at top, earliest at bottom) + lightbox */
(function () {

  function groupByYear() {
    var byYear = {};
    GALLERY.forEach(function (item) {
      var key = item.year === null ? 'undated' : item.year;
      (byYear[key] = byYear[key] || []).push(item);
    });
    var years = Object.keys(byYear).filter(function (k) { return k !== 'undated'; })
      .map(Number).sort(function (a, b) { return b - a; }); // newest first
    var order = years.slice();
    if (byYear.undated) order.push('undated');
    return { byYear: byYear, order: order };
  }

  var flatOrder = []; // full flattened list in display order, for lightbox prev/next

  function buildSections(grouped) {
    var tabsEl = document.getElementById('ledgerTabs');
    var mainEl = document.getElementById('ledgerMain');
    tabsEl.innerHTML = '';
    mainEl.innerHTML = '';
    flatOrder = [];

    grouped.order.forEach(function (key) {
      var items = grouped.byYear[key];
      var anchorId = 'y-' + key;
      items.forEach(function (it) { flatOrder.push(it); });

      // jump-index entry
      var link = document.createElement('a');
      link.className = 'tab-btn';
      link.href = '#' + anchorId;
      link.dataset.year = key;
      link.innerHTML = (key === 'undated' ? 'Undated' : key) + '<span class="n">' + items.length + ' works</span>';
      tabsEl.appendChild(link);

      // section
      var section = document.createElement('section');
      section.className = 'year-section';
      section.id = anchorId;

      var heading = document.createElement('div');
      heading.className = 'ledger-heading';
      var h2 = document.createElement('h2');
      h2.textContent = key === 'undated' ? 'Undated' : key;
      var count = document.createElement('span');
      count.className = 'count';
      count.textContent = items.length + (items.length === 1 ? ' work' : ' works');
      heading.appendChild(h2);
      heading.appendChild(count);
      section.appendChild(heading);

      var grid = document.createElement('div');
      grid.className = 'gallery';
      items.forEach(function (item) {
        grid.appendChild(buildPlate(item));
      });
      section.appendChild(grid);

      mainEl.appendChild(section);
    });

    initScrollSpy();
  }

  function buildPlate(item) {
    var fig = document.createElement('div');
    fig.className = 'plate';
    fig.tabIndex = 0;
    fig.setAttribute('role', 'button');
    fig.setAttribute('aria-label', 'Open plate ' + (item.i + 1) + (item.year ? ', ' + item.year : '') + ' in full view');

    var img = document.createElement('img');
    img.src = item.url;
    img.loading = 'lazy';
    img.alt = 'Work by Steve Armstrong' + (item.year ? ', ' + item.year : ', undated');
    fig.appendChild(img);

    var tag = document.createElement('div');
    tag.className = 'tag';
    tag.textContent = 'No. ' + String(item.i + 1).padStart(3, '0') + (item.year ? '  —  ' + item.year : '  —  undated');
    fig.appendChild(tag);

    function open() {
      var idx = flatOrder.indexOf(item);
      openLightbox(flatOrder, idx);
    }
    fig.addEventListener('click', open);
    fig.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });

    return fig;
  }

  /* ---- Scroll-spy for the jump index ---- */
  function initScrollSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll('#ledgerTabs .tab-btn'));
    var sections = Array.prototype.slice.call(document.querySelectorAll('.year-section'));
    if (!('IntersectionObserver' in window) || !sections.length) return;

    var current = null;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          current = entry.target.id;
        }
      });
      links.forEach(function (l) {
        l.classList.toggle('active', l.getAttribute('href') === '#' + current);
      });
    }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });

    sections.forEach(function (s) { observer.observe(s); });
  }

  /* ---- Lightbox ---- */
  var lbIndex = 0;
  var lbList = [];

  function openLightbox(list, idx) {
    lbList = list;
    lbIndex = idx;
    renderLightbox();
    document.getElementById('lightbox').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    document.getElementById('lightbox').classList.remove('open');
    document.body.style.overflow = '';
  }

  function renderLightbox() {
    var item = lbList[lbIndex];
    var img = document.getElementById('lbImg');
    img.src = item.url;
    img.alt = 'Work by Steve Armstrong' + (item.year ? ', ' + item.year : ', undated');
    document.getElementById('lbCap').textContent =
      'No. ' + String(item.i + 1).padStart(3, '0') + (item.year ? '  —  ' + item.year : '  —  undated') +
      '  —  ' + (lbIndex + 1) + ' / ' + lbList.length;
  }

  function step(delta) {
    lbIndex = (lbIndex + delta + lbList.length) % lbList.length;
    renderLightbox();
  }

  function initLightbox() {
    document.getElementById('lbClose').addEventListener('click', closeLightbox);
    document.getElementById('lbPrev').addEventListener('click', function () { step(-1); });
    document.getElementById('lbNext').addEventListener('click', function () { step(1); });
    document.getElementById('lightbox').addEventListener('click', function (e) {
      if (e.target.id === 'lightbox') closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if (!document.getElementById('lightbox').classList.contains('open')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    });
  }

  /* ---- Hero rotation ---- */
  function initHero() {
    var wrap = document.getElementById('heroFigure');
    if (!wrap) return;
    var byDecade = {};
    GALLERY.forEach(function (g) {
      var k = g.decade === null ? 'u' : g.decade;
      (byDecade[k] = byDecade[k] || []).push(g);
    });
    var picks = [];
    [2020, 2010, 2000, 1990, 1980, 1970].forEach(function (d) {
      if (byDecade[d] && byDecade[d].length) {
        picks.push(byDecade[d][Math.floor(byDecade[d].length / 2)]);
      }
    });

    var imgs = picks.map(function (item) {
      var img = document.createElement('img');
      img.src = item.url;
      img.alt = 'Work by Steve Armstrong' + (item.year ? ', ' + item.year : '');
      wrap.insertBefore(img, wrap.firstChild);
      return { el: img, item: item };
    });

    var cap = document.getElementById('heroCap');
    var i = 0;
    function show(n) {
      imgs.forEach(function (o, j) { o.el.classList.toggle('is-visible', j === n); });
      if (cap) {
        cap.querySelector('.y').textContent = imgs[n].item.year || 'undated';
        cap.querySelector('.idx').textContent = String(imgs[n].item.i + 1).padStart(3, '0');
      }
    }
    show(0);
    if (imgs.length > 1) {
      setInterval(function () {
        i = (i + 1) % imgs.length;
        show(i);
      }, 4200);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var grouped = groupByYear();
    buildSections(grouped);
    initLightbox();
    initHero();
  });
})();
