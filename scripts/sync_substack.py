#!/usr/bin/env python3
"""Mirror the Wegway Substack onto the site.

Pulls every published post from wegway.substack.com and rewrites:
  writing_posts_data.js   full posts (read by post.html)
  writing_index_data.js   list-page metadata, no bodies (read by substack.html)
  writing-thumbs/*.jpg    160px list thumbnails

New posts are added, edited posts are refreshed, and posts that no longer
exist on Substack are removed (thumbnails included). Runs from the
"Sync Substack" GitHub Action, or by hand:  python3 scripts/sync_substack.py

Needs: beautifulsoup4, pillow.
"""
import io
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from bs4 import BeautifulSoup, Comment, NavigableString, Tag
from PIL import Image

PUB = "https://wegway.substack.com"
ROOT = Path(__file__).resolve().parent.parent
POSTS_JS = ROOT / "writing_posts_data.js"
INDEX_JS = ROOT / "writing_index_data.js"
THUMB_DIR = ROOT / "writing-thumbs"
THUMB_EDGE = 160
UA = {"User-Agent": "Mozilla/5.0 (compatible; wegway-site-sync)"}

# Same rules as sanitizeHtml() in post.js.
DROP_TAGS = {"script", "style", "button", "svg", "noscript", "form", "input", "select", "textarea"}
DROP_CLASS = [
    "image-link-expand", "pencraft", "subscription-widget", "subscribe-widget",
    "poll-embed", "like-button", "share-button", "restack", "comment-button",
    "button-wrapper", "paywall", "post-ufi", "audio-player", "subscribe-caret",
    "hide-text",
]
UNWRAP_CLASS = ["image-link"]
ATTR_WHITELIST = {
    "img": {"src", "srcset", "alt", "width", "height"},
    "source": {"srcset", "type", "sizes"},
    "a": {"href"},
    "iframe": {"src", "width", "height", "frameborder", "allow", "allowfullscreen", "loading", "title"},
}


def fetch(url, binary=False, tries=4):
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                data = r.read()
            return data if binary else json.loads(data)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            if isinstance(e, urllib.error.HTTPError) and e.code in (400, 403, 404):
                raise
            if attempt == tries - 1:
                raise
            time.sleep(2 * (attempt + 1))


def list_posts():
    posts, cursor = [], None
    while True:
        url = PUB + "/api/v1/archive?sort=new&limit=20"
        if cursor:
            url += "&cursor=" + urllib.parse.quote(cursor)
        page = fetch(url)
        posts += page.get("posts", [])
        cursor = page.get("nextCursor")
        if not cursor or not page.get("posts"):
            return posts


def class_has(tag, patterns):
    cls = " ".join(tag.get("class", [])) if isinstance(tag.get("class"), list) else (tag.get("class") or "")
    return any(p in cls for p in patterns)


def walk(node):
    for child in list(node.children):
        if isinstance(child, Comment):
            child.extract()
            continue
        if not isinstance(child, Tag):
            continue
        if child.name in DROP_TAGS or class_has(child, DROP_CLASS):
            child.decompose()
            continue
        walk(child)
        if child.name == "a" and class_has(child, UNWRAP_CLASS):
            child.unwrap()
            continue
        if child.name == "iframe":
            try:
                w, h = int(child.get("width", "")), int(child.get("height", ""))
                child["style"] = "aspect-ratio: %d / %d;" % (w, h)
            except ValueError:
                pass
        allowed = ATTR_WHITELIST.get(child.name, set())
        for attr in list(child.attrs):
            if attr == "style" and child.name == "iframe":
                continue
            if attr not in allowed:
                del child.attrs[attr]
        if child.name == "a" and child.has_attr("href"):
            child["target"] = "_blank"
            child["rel"] = "noopener"


def s3_key(url):
    m = re.search(r"substack-post-media\.s3\.amazonaws\.com(?:%2F|/)([^&\s\"]+)", url or "")
    return urllib.parse.unquote(m.group(1)) if m else None


def remove_duplicate_lead_image(root, cover):
    key = s3_key(cover)
    first = root.find("img")
    if not key or first is None or s3_key(first.get("src")) != key:
        return
    target = first.find_parent("figure") or first.parent
    parent = target.parent
    if parent is None:
        return
    target.decompose()
    node, depth = parent, 0
    while node is not None and node is not root and depth < 3:
        meaningful = any(
            isinstance(c, Tag) or (isinstance(c, NavigableString) and str(c).strip())
            for c in node.children
        )
        if meaningful:
            break
        up = node.parent
        if up is None:
            break
        node.decompose()
        node = up
        depth += 1


def sanitize(raw, cover):
    soup = BeautifulSoup("<div>" + (raw or "") + "</div>", "html.parser")
    root = soup.div
    walk(root)
    if cover:
        remove_duplicate_lead_image(root, cover)
    for p in root.find_all("p"):
        if not p.get_text(strip=True) and not p.find(True):
            p.decompose()
    return root.decode_contents(formatter="html5"), root.get_text(" ")


def excerpt(text, title, n=10):
    text = re.sub(r"\s+", " ", text).strip()
    if title and text.lower().startswith(title.strip().lower()):
        text = re.sub(r"^[\s\-–—:.,]+", "", text[len(title.strip()):])
    words = text.split(" ")
    words = [w for w in words if w]
    return " ".join(words) if len(words) <= n else " ".join(words[:n]) + "…"


def make_thumb(slug, cover):
    data = fetch(cover, binary=True)
    im = Image.open(io.BytesIO(data))
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[-1])
        im = bg
    im = im.convert("RGB")
    im.thumbnail((THUMB_EDGE, THUMB_EDGE), Image.LANCZOS)
    im.save(THUMB_DIR / (slug + ".jpg"), "JPEG", quality=80, optimize=True)


def load_js(path, name):
    if not path.exists():
        return []
    s = path.read_text(encoding="utf-8")
    return json.loads(s[s.index("["): s.rindex("]") + 1])


def dump_js(name, items):
    return "const %s = %s;\n" % (name, json.dumps(items, indent=2, ensure_ascii=False))


def write_if_changed(path, text):
    if path.exists() and path.read_text(encoding="utf-8") == text:
        return False
    path.write_text(text, encoding="utf-8")
    return True


def main():
    THUMB_DIR.mkdir(exist_ok=True)
    old = {p["slug"]: p for p in load_js(POSTS_JS, "WRITING_POSTS")}

    listing = [p for p in list_posts() if p.get("audience") == "everyone"]
    if not listing:
        sys.exit("Substack returned no posts; leaving the site untouched.")
    if old and len(listing) < len(old) / 2:
        sys.exit("Substack lists %d posts but the site has %d; refusing to delete "
                 "that many automatically." % (len(listing), len(old)))

    posts = []
    for item in sorted(listing, key=lambda p: p["post_date"], reverse=True):
        slug = item["slug"]
        try:
            full = fetch("%s/api/v1/posts/%s" % (PUB, slug))
            cover = full.get("cover_image") or ""
            title = (full.get("title") or "").strip()
            body, text = sanitize(full.get("body_html"), cover)
            entry = {
                "slug": slug,
                "title": title,
                "subtitle": (full.get("subtitle") or "").strip(),
                "date": full["post_date"],
                "coverImage": cover,
                "excerpt": excerpt(text, title),
                "substackUrl": full.get("canonical_url") or "%s/p/%s" % (PUB, slug),
                "bodyHtml": body,
                "thumbImage": "",
            }
        except Exception as e:  # keep what we already had rather than drop a post
            print("WARN %s: %s" % (slug, e))
            if slug not in old:
                continue
            entry = old[slug]
        prev = old.get(slug)
        thumb = THUMB_DIR / (slug + ".jpg")
        if entry["coverImage"]:
            if not thumb.exists() or not prev or prev.get("coverImage") != entry["coverImage"]:
                try:
                    make_thumb(slug, entry["coverImage"])
                except Exception as e:
                    print("WARN thumb %s: %s" % (slug, e))
            if thumb.exists():
                entry["thumbImage"] = "writing-thumbs/%s.jpg" % slug
        elif thumb.exists():
            thumb.unlink()
        posts.append(entry)
        time.sleep(0.15)

    keep = {p["slug"] for p in posts}
    removed = [s for s in old if s not in keep]
    for f in THUMB_DIR.glob("*.jpg"):
        if f.stem not in keep:
            f.unlink()

    index = [{k: p[k] for k in ("slug", "title", "subtitle", "date", "excerpt", "thumbImage")} for p in posts]
    changed = write_if_changed(POSTS_JS, dump_js("WRITING_POSTS", posts))
    changed |= write_if_changed(INDEX_JS, dump_js("WRITING_INDEX", index))
    added = [s for s in keep if s not in old]
    print("posts: %d  added: %s  removed: %s  files %s" % (
        len(posts), added or "none", removed or "none", "changed" if changed else "unchanged"))


if __name__ == "__main__":
    main()
