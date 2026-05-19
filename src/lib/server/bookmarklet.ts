/**
 * Builds the JS source for the "RYMScraper Import" bookmarklet.
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
if(!/^https?:\\/\\/(?:www\\.)?rateyourmusic\\.com\\//i.test(location.href)){alert('RYMScraper: open this on a rateyourmusic.com wishlist page first.');return;}
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
var artistEl=row.querySelector('a[href*="/artist/"]');
var artist=artistEl?norm(artistEl.textContent):'';
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
if(!albums.length){alert('RYMScraper: no albums detected on this page. Are you on a wishlist?');return;}
fetch(ENDPOINT,{method:'POST',mode:'cors',headers:{'content-type':'application/json'},body:JSON.stringify({albums:albums,sourceUrl:location.href})}).then(function(r){return r.json().then(function(b){return{s:r.status,b:b};});}).then(function(o){
if(o.s>=200&&o.s<300&&o.b&&o.b.ok){
var msg='RYMScraper: imported '+o.b.added+' new, '+o.b.duplicates+' duplicate';
if(o.b.datesRefreshed){msg+=', '+o.b.datesRefreshed+' date'+(o.b.datesRefreshed===1?'':'s')+' refreshed';}
if(o.b.coversRefreshed){msg+=', '+o.b.coversRefreshed+' cover'+(o.b.coversRefreshed===1?'':'s')+' refreshed';}
msg+=' (total '+o.b.total+').';
if(o.b.sync&&o.b.sync.active){msg+=' [sync: page '+o.b.sync.pageCount+', '+o.b.sync.totalSeen+' albums seen]';}
alert(msg);
}
else{alert('RYMScraper error: '+((o.b&&o.b.error)||('HTTP '+o.s)));}
}).catch(function(){alert('RYMScraper: could not reach the local app at '+ENDPOINT+'. Is \`npm run dev\` running?');});
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
if(!/^https?:\\/\\/(?:www\\.)?rateyourmusic\\.com\\/release\\//i.test(location.href)){alert('RYMScraper Enrich: open a rateyourmusic.com release/album page first.');return;}

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
// Descriptors live in their own pri/sec containers too.
var descriptors=collect('.release_pri_descriptors a, .release_pri_descriptors .descriptor, .release_sec_descriptors a, .release_sec_descriptors .descriptor, .release_descriptors a, .release_descriptors .descriptor');

// User's own rating (only if logged in AND >0). RYM renders this as either
// a number, a fraction "X / 5", or a stars widget — try a few hooks and
// only keep a positive numeric value.
var myRating;
var myEl=document.querySelector('.my_catalog_rating, .your_rating, .release_my_rating, [class*="my_rating"]');
if(myEl){var n=num(myEl.textContent);if(typeof n==='number'&&n>0)myRating=n;}
if(myRating===undefined){
  var starsEl=document.querySelector('[class*="rating"][data-rating], [data-user-rating]');
  if(starsEl){var n2=num(starsEl.getAttribute('data-rating')||starsEl.getAttribute('data-user-rating'));if(typeof n2==='number'&&n2>0)myRating=n2;}
}

// Canonical URL — strip query/hash/trailing slash; server normalises again.
var url;try{var u=new URL(location.href);u.search='';u.hash='';u.pathname=u.pathname.replace(/\\/+$/,'');url=u.toString();}catch(e){url=location.href;}

var payload={url:url,largeCoverUrl:largeCoverUrl,rymRating:rymRating,primaryGenres:primaryGenres.length?primaryGenres:undefined,secondaryGenres:secondaryGenres.length?secondaryGenres:undefined,descriptors:descriptors.length?descriptors:undefined,myRating:myRating,sourceUrl:location.href};

fetch(ENDPOINT,{method:'POST',mode:'cors',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}).then(function(r){return r.json().then(function(b){return{s:r.status,b:b};});}).then(function(o){
if(o.s>=200&&o.s<300&&o.b&&o.b.ok){
var fu=o.b.fieldsUpdated||[];
var who=(o.b.artist||'?')+' — '+(o.b.title||'?');
alert('RYMScraper enriched: '+who+(fu.length?' ['+fu.join(', ')+']':' (no changes).'));
}else if(o.s===404){alert('RYMScraper enrich: '+((o.b&&o.b.error)||'Album not found in local wishlist.'));}
else{alert('RYMScraper enrich error: '+((o.b&&o.b.error)||('HTTP '+o.s)));}
}).catch(function(){alert('RYMScraper enrich: could not reach the local app at '+ENDPOINT+'. Is the server running?');});
})();`;
}

export function buildEnrichBookmarkletHref(endpoint: string): string {
	return 'javascript:' + encodeURIComponent(buildEnrichBookmarkletSource(endpoint));
}
