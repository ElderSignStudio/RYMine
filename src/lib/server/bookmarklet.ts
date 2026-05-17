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
found.set(url,{url:url,title:title,artist:artist,year:year,dateAdded:dateAdded,genres:genres});
});
var albums=Array.from(found.values());
if(!albums.length){alert('RYMScraper: no albums detected on this page. Are you on a wishlist?');return;}
fetch(ENDPOINT,{method:'POST',mode:'cors',headers:{'content-type':'application/json'},body:JSON.stringify({albums:albums,sourceUrl:location.href})}).then(function(r){return r.json().then(function(b){return{s:r.status,b:b};});}).then(function(o){
if(o.s>=200&&o.s<300&&o.b&&o.b.ok){
var msg='RYMScraper: imported '+o.b.added+' new, '+o.b.duplicates+' duplicate';
if(o.b.datesRefreshed){msg+=', '+o.b.datesRefreshed+' date'+(o.b.datesRefreshed===1?'':'s')+' refreshed';}
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
