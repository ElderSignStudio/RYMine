/**
 * Builds the JS source for the "RYMine Import" bookmarklet.
 *
 * This code runs inside the user's real, logged-in RYM browser tab. It mirrors
 * the selector + extraction strategy from `parseWishlistHtml.ts` so behaviour
 * is consistent between the HTML-file import path and the bookmarklet path.
 */
export function buildBookmarkletSource(endpoint: string): string {
	const endpointJson = JSON.stringify(endpoint);
	return `(function(){
var ENDPOINT=${endpointJson};
var RELEASE=/\\/release\\/(album|ep|single|compilation|mixtape|video|dj-mix|bootleg|unauth|comp)\\//i;
var MONTHS={Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
function norm(s){return (s||'').replace(/\\s+/g,' ').trim();}
function parseDate(s){if(!s)return undefined;var m=s.match(/\\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\W*(\\d{1,2})\\W*(\\d{4})\\b/);if(!m)return undefined;return m[3]+'-'+MONTHS[m[1]]+'-'+(m[2].length===1?'0'+m[2]:m[2]);}
if(!/^https?:\\/\\/(?:www\\.)?rateyourmusic\\.com\\//i.test(location.href)){alert('RYMine: open this on a rateyourmusic.com wishlist page first.');return;}
var found=new Map();
document.querySelectorAll('a[href*="/release/"]').forEach(function(link){
var href=link.getAttribute('href');
if(!href||!RELEASE.test(href))return;
var url;try{url=new URL(href,location.origin).href;}catch(e){return;}
if(found.has(url))return;
var title=norm(link.textContent);
if(!title)return;
var row=link.closest('tr, li, .collection_table_row, .release_list_item, .ui_list_main_item')||link.parentElement;
if(!row)return;
// Artist(s) — walk .or_q_albumartist children up to (but not including) the
// <i> that wraps the album title. That gives us "Artist1 & Artist2, Artist3"
// with whatever separators RYM rendered between the artist anchors, instead
// of only the first <a class="artist">'s text.
var artist='';
var artistWrap=row.querySelector('.or_q_albumartist');
if(artistWrap){
  var artistParts=[];
  for(var an=artistWrap.firstChild;an;an=an.nextSibling){
    if(an.nodeType===1){
      var tag=an.tagName;
      if(tag==='I'||tag==='DIV'||tag==='BR')break;
      artistParts.push(an.textContent||'');
    }else if(an.nodeType===3){
      artistParts.push(an.nodeValue||'');
    }
  }
  artist=norm(artistParts.join('')).replace(/\\s*[-\\u2013\\u2014]\\s*$/,'').trim();
}
if(!artist){
  var artistEl=row.querySelector('a[href*="/artist/"]');
  artist=artistEl?norm(artistEl.textContent):'';
}
if(!artist)return;
var rowText=norm(row.textContent);
var yp=rowText.match(/\\(((?:19|20)\\d{2})\\)/);
var year=yp?parseInt(yp[1],10):(function(){var m=rowText.match(/\\b(19|20)\\d{2}\\b/);return m?parseInt(m[0],10):undefined;})();
var dateAdded;
var dateEl=row.querySelector('.or_q_wishlist_date, .or_q_wishlist_date_rating, .date_added, [class*=wishlist_date], [class*=date_added]');
if(dateEl){dateAdded=parseDate(norm(dateEl.textContent));}
if(!dateAdded){dateAdded=parseDate(rowText);}
var genres=[];
var gl=row.querySelectorAll('a[href*="/genre/"], a[href*="/genres/"]');
if(gl.length){gl.forEach(function(g){var t=norm(g.textContent);if(t&&genres.indexOf(t)===-1)genres.push(t);});}
else{row.querySelectorAll('.genre').forEach(function(g){var t=norm(g.textContent);if(t&&genres.indexOf(t)===-1)genres.push(t);});}
var coverUrl;
var imgEl=row.querySelector('.or_q_thumb_album img[src], img[src]');
if(imgEl){var src=imgEl.getAttribute('src');if(src){try{var u=new URL(src,location.origin).href;if(/^https?:\\/\\//i.test(u))coverUrl=u;}catch(e){}}}
found.set(url,{url:url,title:title,artist:artist,year:year,dateAdded:dateAdded,coverUrl:coverUrl,genres:genres});
});
var albums=Array.from(found.values());
if(!albums.length){alert('RYMine: no albums detected on this page. Are you on a wishlist?');return;}
fetch(ENDPOINT,{method:'POST',mode:'cors',headers:{'content-type':'application/json'},body:JSON.stringify({albums:albums,sourceUrl:location.href})}).then(function(r){return r.json().then(function(b){return{s:r.status,b:b};});}).then(function(o){
if(o.s>=200&&o.s<300&&o.b&&o.b.ok){
var msg='RYMine: imported '+o.b.added+' new, '+o.b.duplicates+' duplicate';
if(o.b.datesRefreshed){msg+=', '+o.b.datesRefreshed+' date'+(o.b.datesRefreshed===1?'':'s')+' refreshed';}
if(o.b.coversRefreshed){msg+=', '+o.b.coversRefreshed+' cover'+(o.b.coversRefreshed===1?'':'s')+' refreshed';}
if(o.b.artistsRefreshed){msg+=', '+o.b.artistsRefreshed+' artist'+(o.b.artistsRefreshed===1?'':'s')+' refreshed';}
msg+=' (total '+o.b.total+').';
if(o.b.sync&&o.b.sync.active){msg+=' [sync: page '+o.b.sync.pageCount+', '+o.b.sync.totalSeen+' albums seen]';}
alert(msg);
}
else{alert('RYMine error: '+((o.b&&o.b.error)||('HTTP '+o.s)));}
}).catch(function(){alert('RYMine: could not reach the local app at '+ENDPOINT+'. Is \`npm run dev\` running?');});
})();`;
}

export function buildBookmarkletHref(endpoint: string): string {
	return 'javascript:' + encodeURIComponent(buildBookmarkletSource(endpoint));
}

/**
 * Bookmarklet for enriching a single album from its RYM release page.
 *
 * Only runs on `rateyourmusic.com/release/...` URLs. Extracts large cover,
 * average rating, primary/secondary genres, descriptors, and the user's own
 * rating (if non-zero). POSTs to `/api/enrich`, which looks the album up by
 * normalised URL and merges the fields. If the album isn't already in the
 * local wishlist.json, the server responds with a clear 404 rather than
 * silently creating one.
 *
 * The selectors are heuristic — RYM occasionally tweaks class names, so the
 * code falls back through several common shapes and the user can iterate.
 */
export function buildEnrichBookmarkletSource(endpoint: string): string {
	const endpointJson = JSON.stringify(endpoint);
	return `(function(){
var ENDPOINT=${endpointJson};
function norm(s){return (s||'').replace(/\\s+/g,' ').trim();}
function num(s){if(s==null)return undefined;var n=parseFloat(String(s).replace(/[^0-9.]/g,''));return isNaN(n)?undefined:n;}
if(!/^https?:\\/\\/(?:www\\.)?rateyourmusic\\.com\\/release\\//i.test(location.href)){alert('RYMine Enrich: open a rateyourmusic.com release/album page first.');return;}

// Large cover: prefer og:image (most stable), fall back to known cover containers.
var largeCoverUrl;
var ogm=document.querySelector('meta[property="og:image"], meta[name="og:image"]');
if(ogm){var c=ogm.getAttribute('content');if(c){try{largeCoverUrl=new URL(c,location.origin).href;}catch(e){}}}
if(!largeCoverUrl){
  var coverEl=document.querySelector('.coverart_in_detail img, .release_cover img, #release_cover img, .release_release_cover img, .release_cover_art img, .page_release_art_frame img');
  if(coverEl&&coverEl.src)largeCoverUrl=coverEl.src;
}

// RYM average rating: itemprop=ratingValue is the most reliable hook.
var rymRating;
var rv=document.querySelector('[itemprop="ratingValue"]');
if(rv){rymRating=num(rv.getAttribute('content')||rv.textContent);}
if(rymRating===undefined){var av=document.querySelector('.avg_rating, .release_avg_rating, .page_release_avg_rating');if(av)rymRating=num(av.textContent);}

function collect(sel){var out=[];document.querySelectorAll(sel).forEach(function(e){var t=norm(e.textContent);if(t&&out.indexOf(t)===-1)out.push(t);});return out;}

// Primary / secondary genre lists — RYM uses pri/sec class hooks.
var primaryGenres=collect('.release_pri_genres a, .release_pri_genres .genre');
var secondaryGenres=collect('.release_sec_genres a, .release_sec_genres .genre');
// Descriptors: RYM puts all descriptors in a single span as comma-separated
// text (no inner anchors). e.g. <span class="release_pri_descriptors">
// instrumental, progressive, complex, technical, playful</span>. So we read
// the wrapper text and split on commas rather than looking for child links.
var descriptors=[];
['.release_pri_descriptors','.release_sec_descriptors'].forEach(function(sel){
  var el=document.querySelector(sel);
  if(!el)return;
  norm(el.textContent).split(/\\s*,\\s*/).forEach(function(d){
    d=d.trim();
    if(d&&descriptors.indexOf(d)===-1)descriptors.push(d);
  });
});

// User's own rating. RYM's widget exposes the value in two places:
//   - <div class="rating_num">5.0</div>   -> literal numeric string ("---" if unrated)
//   - <div class="rating_stars star-10m"> -> class "star-Nm" where N is in
//     half-star units (so N/2 = 0..5, N=10 means 5 full stars, N=7 means 3.5).
// The visible stars are a CSS sprite keyed off the class, not individual
// elements you can count — that's why earlier "filled" descendant counting
// never worked. We try .rating_num first (most direct), .rating_stars as
// backup, and keep some generic fallbacks for future-proofing. Only a
// strictly positive 0–5 value is kept; unrated → undefined → not sent.
var myRating;

// (1) PRIMARY: RYM's .rating_num child holds the numeric rating.
// Unrated albums contain "---" → num() returns undefined.
var ratingNum=document.querySelector('.my_catalog_rating .rating_num, [id^="rating_num_"]');
if(ratingNum){
  var n=num(ratingNum.textContent);
  if(typeof n==='number'&&n>0&&n<=5)myRating=n;
}

// (2) BACKUP: parse RYM's star-Nm class on the .rating_stars element.
if(myRating===undefined){
  var starsClassEl=document.querySelector('.my_catalog_rating .rating_stars, [id^="rating_stars_"]');
  if(starsClassEl){
    var m=starsClassEl.className.match(/\\bstar-(\\d{1,2})m\\b/);
    if(m){var h=parseInt(m[1],10);if(h>0&&h<=10)myRating=h/2;}
  }
}

// (3) generic numeric-text fallback for older / non-RYM-standard widgets
if(myRating===undefined){
  var myEl=document.querySelector('.your_rating, .release_my_rating, .release_rating_user, [class*="my_rating"]:not([class*="my_ratings"]):not(.my_catalog_rating), .user_rating_score, .user-rating-value');
  if(myEl){
    var n2=num(myEl.textContent)||num(myEl.getAttribute('data-value'));
    if(typeof n2==='number'&&n2>0&&n2<=5)myRating=n2;
  }
}

// (4) data-rating-style attribute fallback
if(myRating===undefined){
  var starsAttrEl=document.querySelector('[data-user-rating]:not([data-user-rating="0"]):not([data-user-rating=""]), [data-my-rating]:not([data-my-rating="0"]):not([data-my-rating=""]), .user_rating[data-rating], .release_my_rating[data-rating]');
  if(starsAttrEl){
    var attr=starsAttrEl.getAttribute('data-user-rating')||starsAttrEl.getAttribute('data-my-rating')||starsAttrEl.getAttribute('data-rating');
    var n3=num(attr);
    if(typeof n3==='number'&&n3>0&&n3<=5)myRating=n3;
  }
}

// Streaming-service links. RYM renders each one as a dedicated icon-button
// inside .ui_media_links with a service-specific class. We use those classes
// as the primary signal (most precise) and only fall back to a URL-pattern
// scan SCOPED TO that container if a class is missing. We never scan the
// whole document — that's how we used to pick up YouTube links from review
// bodies, related-video widgets and "before/after this album" panels.
var streamingLinks={};
var serviceClass={spotify:'ui_media_link_btn_spotify',appleMusic:'ui_media_link_btn_applemusic',youtube:'ui_media_link_btn_youtube',bandcamp:'ui_media_link_btn_bandcamp'};
for(var sk in serviceClass){
  var btn=document.querySelector('a.'+serviceClass[sk]+'[href]');
  if(btn&&btn.href)streamingLinks[sk]=btn.href;
}
// Backup: if a class miss happens (RYM renames something), scan ONLY inside
// the media-links container to keep reviews / embeds out of the running.
if(!streamingLinks.spotify||!streamingLinks.appleMusic||!streamingLinks.youtube||!streamingLinks.bandcamp){
  var streamingScope=document.querySelector('.ui_media_links, .ui_media_links_container, [class*="media_link_container"]');
  if(streamingScope){
    var streamingPatterns={
      spotify:/\\b(?:open\\.|www\\.)?spotify\\.com\\b/i,
      appleMusic:/\\b(?:[a-z0-9-]+\\.)*(?:music|itunes)\\.apple\\.com\\b|\\bapple\\.co\\b/i,
      youtube:/\\b(?:music\\.|www\\.|m\\.)?(?:youtube\\.com|youtu\\.be)\\b/i,
      bandcamp:/\\b[a-z0-9-]*bandcamp\\.com\\b/i
    };
    var scopedAnchors=streamingScope.querySelectorAll('a[href]');
    for(var sa=0;sa<scopedAnchors.length;sa++){
      var h=scopedAnchors[sa].href;
      if(!h||!/^https?:/i.test(h))continue;
      for(var pk in streamingPatterns){
        if(!streamingLinks[pk]&&streamingPatterns[pk].test(h))streamingLinks[pk]=h;
      }
    }
  }
}
var hasStreaming=streamingLinks.spotify||streamingLinks.appleMusic||streamingLinks.youtube||streamingLinks.bandcamp;

// Canonical URL — strip query/hash/trailing slash; server normalises again.
var url;try{var u=new URL(location.href);u.search='';u.hash='';u.pathname=u.pathname.replace(/\\/+$/,'');url=u.toString();}catch(e){url=location.href;}

var payload={url:url,largeCoverUrl:largeCoverUrl,rymRating:rymRating,primaryGenres:primaryGenres.length?primaryGenres:undefined,secondaryGenres:secondaryGenres.length?secondaryGenres:undefined,descriptors:descriptors.length?descriptors:undefined,myRating:myRating,streamingLinks:hasStreaming?streamingLinks:undefined,sourceUrl:location.href};

fetch(ENDPOINT,{method:'POST',mode:'cors',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}).then(function(r){return r.json().then(function(b){return{s:r.status,b:b};});}).then(function(o){
if(o.s>=200&&o.s<300&&o.b&&o.b.ok){
var fu=o.b.fieldsUpdated||[];
var who=(o.b.artist||'?')+' — '+(o.b.title||'?');
alert('RYMine enriched: '+who+(fu.length?' ['+fu.join(', ')+']':' (no changes).'));
}else if(o.s===404){alert('RYMine enrich: '+((o.b&&o.b.error)||'Album not found in local wishlist.'));}
else{alert('RYMine enrich error: '+((o.b&&o.b.error)||('HTTP '+o.s)));}
}).catch(function(){alert('RYMine enrich: could not reach the local app at '+ENDPOINT+'. Is the server running?');});
})();`;
}

export function buildEnrichBookmarkletHref(endpoint: string): string {
	return 'javascript:' + encodeURIComponent(buildEnrichBookmarkletSource(endpoint));
}
