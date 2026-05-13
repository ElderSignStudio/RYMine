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
function norm(s){return (s||'').replace(/\\s+/g,' ').trim();}
if(!/^https?:\\/\\/(?:www\\.)?rateyourmusic\\.com\\//i.test(location.href)){alert('RYMScraper: open this on a rateyourmusic.com wishlist page first.');return;}
var found=new Map();
document.querySelectorAll('a[href*="/release/"]').forEach(function(link){
var href=link.getAttribute('href');
if(!href||!RELEASE.test(href))return;
var url;try{url=new URL(href,location.origin).href;}catch(e){return;}
if(found.has(url))return;
var title=norm(link.textContent);
if(!title)return;
var row=link.closest('tr, li, .or_q_albumartist, .collection_table_row, .release_list_item, .ui_list_main_item')||link.parentElement;
if(!row)return;
var artistEl=row.querySelector('a[href*="/artist/"]');
var artist=artistEl?norm(artistEl.textContent):'';
if(!artist)return;
var ym=norm(row.textContent).match(/\\b(19|20)\\d{2}\\b/);
var year=ym?parseInt(ym[0],10):undefined;
var genres=[];
var gl=row.querySelectorAll('a[href*="/genre/"], a[href*="/genres/"]');
if(gl.length){gl.forEach(function(g){var t=norm(g.textContent);if(t&&genres.indexOf(t)===-1)genres.push(t);});}
else{row.querySelectorAll('.genre').forEach(function(g){var t=norm(g.textContent);if(t&&genres.indexOf(t)===-1)genres.push(t);});}
found.set(url,{url:url,title:title,artist:artist,year:year,genres:genres});
});
var albums=Array.from(found.values());
if(!albums.length){alert('RYMScraper: no albums detected on this page. Are you on a wishlist?');return;}
fetch(ENDPOINT,{method:'POST',mode:'cors',headers:{'content-type':'text/plain'},body:JSON.stringify({albums:albums,sourceUrl:location.href})}).then(function(r){return r.json().then(function(b){return{s:r.status,b:b};});}).then(function(o){
if(o.s>=200&&o.s<300&&o.b&&o.b.ok){alert('RYMScraper: imported '+o.b.added+' new, '+o.b.duplicates+' duplicate (total '+o.b.total+').');}
else{alert('RYMScraper error: '+((o.b&&o.b.error)||('HTTP '+o.s)));}
}).catch(function(){alert('RYMScraper: could not reach the local app at '+ENDPOINT+'. Is \`npm run dev\` running?');});
})();`;
}

export function buildBookmarkletHref(endpoint: string): string {
	return 'javascript:' + encodeURIComponent(buildBookmarkletSource(endpoint));
}
