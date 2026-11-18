/* Writing page: builds the post list from writing_index_data.js, which
   scripts/sync_substack.py regenerates from the Wegway Substack (the
   "Sync Substack" GitHub Action runs it automatically). Rows link to the
   local post.html?slug=... copy, so a click-through stays on-site. */
(function () {
  var TZ = 'America/Toronto';

  function partsOf(iso) {
    var d = new Date(iso);
    return {
      year: Number(d.toLocaleDateString('en-US', { year: 'numeric', timeZone: TZ })),
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: TZ })
    };
  }

  function buildRow(post, label) {
    var row = document.createElement('div');
    row.className = 'entry-row';

    var yr = document.createElement('span');
    yr.className = 'yr';
    yr.textContent = label;
    row.appendChild(yr);

    var body = document.createElement('span');
    body.className = 'entry-body';
    var href = 'post.html?slug=' + encodeURIComponent(post.slug);

    if (post.thumbImage) {
      var thumbLink = document.createElement('a');
      thumbLink.className = 'thumb';
      thumbLink.href = href;
      var img = document.createElement('img');
      img.src = post.thumbImage;
      img.alt = '';
      img.loading = 'lazy';
      thumbLink.appendChild(img);
      body.appendChild(thumbLink);
    }

    var text = document.createElement('span');
    text.className = 'entry-text';

    var a = document.createElement('a');
    a.className = 'title';
    a.href = href;
    a.textContent = post.title;
    text.appendChild(a);

    var descText = [post.subtitle, post.excerpt].filter(Boolean).join(' — ');
    if (descText) {
      var desc = document.createElement('span');
      desc.className = 'desc';
      desc.textContent = descText;
      text.appendChild(desc);
    }

    body.appendChild(text);
    row.appendChild(body);
    return row;
  }

  function buildSection(year, posts) {
    var section = document.createElement('div');
    section.className = 'year-section';
    section.dataset.year = String(year);

    var heading = document.createElement('div');
    heading.className = 'ledger-heading';
    var h2 = document.createElement('h2');
    h2.textContent = String(year);
    var count = document.createElement('span');
    count.className = 'count';
    count.textContent = posts.length + (posts.length === 1 ? ' post' : ' posts');
    heading.appendChild(h2);
    heading.appendChild(count);
    section.appendChild(heading);

    posts.forEach(function (p) { section.appendChild(buildRow(p.post, p.label)); });
    return section;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var container = document.getElementById('writingSections');
    if (!container || typeof WRITING_INDEX === 'undefined') return;

    var byYear = {};
    WRITING_INDEX.slice()
      .sort(function (a, b) { return new Date(b.date) - new Date(a.date); })
      .forEach(function (post) {
        var p = partsOf(post.date);
        (byYear[p.year] = byYear[p.year] || []).push({ post: post, label: p.label });
      });

    Object.keys(byYear).map(Number).sort(function (a, b) { return b - a; })
      .forEach(function (year) { container.appendChild(buildSection(year, byYear[year])); });
  });
})();
