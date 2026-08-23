/* Writing page: patches the static post list with anything new from Substack.
   Substack's own feed has no CORS headers, so browsers can't fetch it directly —
   this routes through rss2json's free proxy, which only returns the latest 10
   items on the no-key tier. That's enough to detect and insert new posts; the
   full history stays as the static list already in the page. New rows link to
   the local post.html?slug=... copy, same as the static ones, so a click-through
   always stays on-site. If the fetch fails for any reason, the static list is
   simply left as-is. */
(function () {
  var FEED_URL = 'https://wegway.substack.com/feed';
  var PROXY_URL = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(FEED_URL);

  function stripHtml(html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    return (tmp.textContent || tmp.innerText || '').trim();
  }

  function excerptFrom(html, title, nWords) {
    var text = stripHtml(html).replace(/\s+/g, ' ').trim();
    if (title && text.toLowerCase().indexOf(title.trim().toLowerCase()) === 0) {
      text = text.slice(title.trim().length).replace(/^[\s\-–—:.,]+/, '');
    }
    var words = text.split(' ').filter(Boolean);
    if (words.length <= nWords) return words.join(' ');
    return words.slice(0, nWords).join(' ') + '…';
  }

  function slugFromLink(link) {
    var m = /\/p\/([^/?#]+)/.exec(link || '');
    return m ? m[1] : null;
  }

  function coverImageFrom(item) {
    if (item.thumbnail) return item.thumbnail;
    if (item.enclosure && item.enclosure.link) return item.enclosure.link;
    var m = /<img[^>]+src="([^"]+)"/.exec(item.content || '');
    return m ? m[1] : '';
  }

  function parseFeedDate(raw) {
    // rss2json normalizes dates to "YYYY-MM-DD HH:MM:SS" in GMT
    return new Date(raw.replace(' ', 'T') + 'Z');
  }

  function monthDay(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function buildRow(item) {
    var row = document.createElement('div');
    row.className = 'entry-row';

    var yr = document.createElement('span');
    yr.className = 'yr';
    yr.textContent = monthDay(item.date);
    row.appendChild(yr);

    var body = document.createElement('span');
    body.className = 'entry-body';

    if (item.thumbnail) {
      var thumbLink = document.createElement('a');
      thumbLink.className = 'thumb';
      thumbLink.href = 'post.html?slug=' + item.slug;
      var img = document.createElement('img');
      img.src = item.thumbnail;
      img.alt = '';
      img.loading = 'lazy';
      thumbLink.appendChild(img);
      body.appendChild(thumbLink);
    }

    var text = document.createElement('span');
    text.className = 'entry-text';

    var a = document.createElement('a');
    a.className = 'title';
    a.href = 'post.html?slug=' + item.slug;
    a.textContent = item.title;
    text.appendChild(a);

    var descText = [item.subtitle, item.excerpt].filter(Boolean).join(' — ');
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

  function updateCount(section) {
    var n = section.querySelectorAll('.entry-row').length;
    section.querySelector('.count').textContent = n + (n === 1 ? ' post' : ' posts');
  }

  function ensureYearSection(container, year) {
    var existing = container.querySelector('.year-section[data-year="' + year + '"]');
    if (existing) return existing;

    var section = document.createElement('div');
    section.className = 'year-section';
    section.dataset.year = String(year);

    var heading = document.createElement('div');
    heading.className = 'ledger-heading';
    var h2 = document.createElement('h2');
    h2.textContent = String(year);
    var count = document.createElement('span');
    count.className = 'count';
    count.textContent = '0 posts';
    heading.appendChild(h2);
    heading.appendChild(count);
    section.appendChild(heading);

    var sections = Array.prototype.slice.call(container.querySelectorAll('.year-section'));
    var placed = false;
    for (var i = 0; i < sections.length; i++) {
      if (Number(sections[i].dataset.year) < year) {
        container.insertBefore(section, sections[i]);
        placed = true;
        break;
      }
    }
    if (!placed) container.appendChild(section);
    return section;
  }

  function addNewPosts(items) {
    var container = document.getElementById('writingSections');
    if (!container) return;

    var existingSlugs = {};
    Array.prototype.forEach.call(container.querySelectorAll('.entry-row a.title'), function (a) {
      var m = /[?&]slug=([^&]+)/.exec(a.getAttribute('href') || '');
      if (m) existingSlugs[decodeURIComponent(m[1])] = true;
    });

    var touched = {};
    items.forEach(function (item) {
      if (!item.slug || existingSlugs[item.slug]) return;
      var year = item.date.getFullYear();
      var section = ensureYearSection(container, year);
      var heading = section.querySelector('.ledger-heading');
      section.insertBefore(buildRow(item), heading.nextSibling);
      touched[year] = section;
    });

    Object.keys(touched).forEach(function (year) { updateCount(touched[year]); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    fetch(PROXY_URL)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.status !== 'ok' || !data.items) return;
        var items = data.items
          .map(function (it) {
            var title = it.title || '';
            return {
              title: title,
              slug: slugFromLink(it.link),
              date: parseFeedDate(it.pubDate),
              subtitle: stripHtml(it.description),
              excerpt: excerptFrom(it.content || '', title, 10),
              thumbnail: coverImageFrom(it)
            };
          })
          .filter(function (it) { return it.slug && !isNaN(it.date.getTime()); })
          .sort(function (a, b) { return b.date - a.date; });
        addNewPosts(items);
      })
      .catch(function () { /* offline or proxy down — static list stands */ });
  });
})();
