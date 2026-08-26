/* Renders a single Writing post. Looks the slug up in the pre-baked
   WRITING_POSTS data (writing_posts_data.js) first — fast, works offline,
   and covers the full back catalog. If the slug isn't there (a post
   published after the data was last generated), it falls back to fetching
   the live Substack feed through the same CORS proxy writing.js uses,
   sanitizing that post's content the same way the build pipeline does. */
(function () {
  var FEED_URL = 'https://wegway.substack.com/feed';
  var PROXY_URL = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(FEED_URL);

  var DROP_TAGS = ['SCRIPT', 'STYLE', 'BUTTON', 'SVG', 'NOSCRIPT', 'FORM', 'INPUT', 'SELECT', 'TEXTAREA'];
  var DROP_CLASS_SUBSTR = [
    'image-link-expand', 'pencraft', 'subscription-widget', 'subscribe-widget',
    'poll-embed', 'like-button', 'share-button', 'restack', 'comment-button',
    'button-wrapper', 'paywall', 'post-ufi', 'audio-player', 'subscribe-caret',
    'hide-text'
  ];
  var UNWRAP_CLASS_SUBSTR = ['image-link'];
  var ATTR_WHITELIST = {
    IMG: ['src', 'srcset', 'alt', 'width', 'height'],
    SOURCE: ['srcset', 'type', 'sizes'],
    A: ['href'],
    IFRAME: ['src', 'width', 'height', 'frameborder', 'allow', 'allowfullscreen', 'loading', 'title']
  };

  function classMatches(el, patterns) {
    var cls = el.getAttribute('class') || '';
    return patterns.some(function (p) { return cls.indexOf(p) !== -1; });
  }

  function walk(node) {
    var children = Array.prototype.slice.call(node.childNodes);
    children.forEach(function (child) {
      if (child.nodeType === Node.COMMENT_NODE) { node.removeChild(child); return; }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      var tag = child.tagName;

      if (DROP_TAGS.indexOf(tag) !== -1 || classMatches(child, DROP_CLASS_SUBSTR)) {
        node.removeChild(child);
        return;
      }

      walk(child);

      if (tag === 'A' && classMatches(child, UNWRAP_CLASS_SUBSTR)) {
        while (child.firstChild) node.insertBefore(child.firstChild, child);
        node.removeChild(child);
        return;
      }

      if (tag === 'IFRAME') {
        var w = parseInt(child.getAttribute('width'), 10);
        var h = parseInt(child.getAttribute('height'), 10);
        if (w && h) child.setAttribute('style', 'aspect-ratio: ' + w + ' / ' + h + ';');
      }

      var allowed = ATTR_WHITELIST[tag] || [];
      Array.prototype.slice.call(child.attributes).forEach(function (attr) {
        if (attr.name === 'style' && tag === 'IFRAME') return;
        if (allowed.indexOf(attr.name) === -1) child.removeAttribute(attr.name);
      });
      if (tag === 'A' && child.hasAttribute('href')) {
        child.setAttribute('target', '_blank');
        child.setAttribute('rel', 'noopener');
      }
    });
  }

  function s3Key(url) {
    if (!url) return null;
    var m = /substack-post-media\.s3\.amazonaws\.com(?:%2F|\/)([^&\s"]+)/.exec(url);
    return m ? decodeURIComponent(m[1]) : null;
  }

  // Substack often sets a post's cover image to the same photo that's
  // already the lead image inside the body — without this, that photo
  // would render twice (once as the hero, once again in the article).
  function removeDuplicateLeadImage(root, coverUrl) {
    var coverKey = s3Key(coverUrl);
    if (!coverKey) return;
    var firstImg = root.querySelector('img');
    if (!firstImg || s3Key(firstImg.getAttribute('src')) !== coverKey) return;

    var target = firstImg.closest('figure') || firstImg.parentElement;
    var parent = target && target.parentElement;
    if (!parent) return;
    target.remove();

    var node = parent;
    var depth = 0;
    while (node && node !== root && depth < 3) {
      var meaningful = Array.prototype.some.call(node.childNodes, function (c) {
        return c.nodeType === Node.ELEMENT_NODE ||
          (c.nodeType === Node.TEXT_NODE && c.textContent.trim() !== '');
      });
      if (meaningful) break;
      var gp = node.parentElement;
      if (!gp) break;
      node.remove();
      node = gp;
      depth++;
    }
  }

  function sanitizeHtml(rawHtml, coverUrl) {
    var doc = new DOMParser().parseFromString('<div>' + rawHtml + '</div>', 'text/html');
    var root = doc.body.firstChild;
    walk(root);
    if (coverUrl) removeDuplicateLeadImage(root, coverUrl);
    return root.innerHTML;
  }

  function coverImageFrom(item) {
    if (item.thumbnail) return item.thumbnail;
    if (item.enclosure && item.enclosure.link) return item.enclosure.link;
    var m = /<img[^>]+src="([^"]+)"/.exec(item.content || '');
    return m ? m[1] : '';
  }

  function formatDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function render(post) {
    document.title = post.title + ' — Steve Armstrong';
    document.getElementById('postTitle').textContent = post.title;

    if (post.subtitle) {
      var sub = document.getElementById('postSubtitle');
      sub.textContent = post.subtitle;
      sub.hidden = false;
    }

    document.getElementById('postDate').textContent = formatDate(post.date);

    if (post.coverImage) {
      var hero = document.getElementById('postHero');
      document.getElementById('postHeroImg').src = post.coverImage;
      document.getElementById('postHeroImg').alt = post.title;
      hero.hidden = false;
    }

    document.getElementById('postBody').innerHTML = post.bodyHtml;
    document.getElementById('postOriginalLink').href = post.substackUrl;

    document.getElementById('postLoading').hidden = true;
    document.getElementById('postArticle').hidden = false;
  }

  function showNotFound() {
    document.getElementById('postLoading').hidden = true;
    document.getElementById('postNotFound').hidden = false;
  }

  function tryLiveFallback(slug) {
    fetch(PROXY_URL)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.status !== 'ok' || !data.items) { showNotFound(); return; }
        var item = data.items.find(function (it) {
          return it.link && it.link.replace(/\/$/, '').split('/p/')[1] === slug;
        });
        if (!item) { showNotFound(); return; }
        var cover = coverImageFrom(item);
        render({
          title: item.title,
          subtitle: (item.description || '').trim(),
          date: item.pubDate.replace(' ', 'T') + 'Z',
          coverImage: cover,
          bodyHtml: sanitizeHtml(item.content || '', cover),
          substackUrl: item.link
        });
      })
      .catch(showNotFound);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var params = new URLSearchParams(location.search);
    var slug = params.get('slug');
    if (!slug) { showNotFound(); return; }

    var local = (typeof WRITING_POSTS !== 'undefined') ? WRITING_POSTS.find(function (p) { return p.slug === slug; }) : null;
    if (local) {
      render(local);
    } else {
      tryLiveFallback(slug);
    }
  });
})();
