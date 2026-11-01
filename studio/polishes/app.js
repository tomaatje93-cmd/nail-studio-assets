const app = document.querySelector('#app');
const publicMode = document.body.dataset.catalogueMode === 'public';
let catalog, current, dirty = false, imageReferences = {};
let finishReviewIds = null;
const overviewState = { scrollY: 0, search: '', category: '', tags: new Set(), tagMode: 'and' };
const filterTags = row => [...new Set([...(row.tags || []), ...[row.finish, row.color_family].flatMap(value => (value || '').split(';'))].map(value => value.trim().toLowerCase()).filter(Boolean))];
function tagGroup(tag) {
  if (tagColourDot(tag) || catalog.rows.some(row => (row.color_family || '').split(';').some(value => value.trim().toLowerCase() === tag))) return 'colour';
  if (['holo','holographic','iridescent','flakie','foil','duochrome','multichrome','reflective'].includes(tag) || catalog.rows.some(row => (row.finish || '').split(';').some(value => value.trim().toLowerCase() === tag))) return 'finish';
  if (['base','color','colour','topper','treatment','stamping'].includes(tag)) return 'role';
  return 'context';
}
function tagColourDot(tag) {
  const colours = {
    red:'#C73148', orange:'#E58532', yellow:'#E6CE56', green:'#54A96A', blue:'#376DCC',
    purple:'#9661BD', pink:'#E18DB6', nude:'#D7B59E', brown:'#79513C', black:'#242127',
    white:'#FFFFFF', gray:'#909096', grey:'#909096', clear:'transparent',
    'gold/copper':'#C6A152', peach:'#EDA786', coral:'#EC827C', turquoise:'#279EAD',
    magenta:'#BE328C', burgundy:'#722744', 'berry pink':'#B44481', 'dark red':'#651D35',
    'dark green':'#174E42', 'dark teal':'#164D65', 'dark purple':'#3E245D', 'yellow/orange':'#EAB657',
    'aqua-blue':'#369CB7', 'bright-green':'#63CA48', 'cool-gold':'#B7A663', gold:'#C6A152',
    silver:'#BFC3CB', indigo:'#51458C', lavender:'#B7A0D2', lilac:'#C6A3D1',
    'medium-gray':'#909096', merlot:'#722C47', 'mint-green':'#A2CCAD', mustard:'#BE9F30',
    navy:'#263654', 'orchid-purple':'#B266BB', 'pickle-green':'#A9AD4A',
    'rainforest-green':'#28705A', 'sapphire-blue':'#2366AE', 'space-cadet-blue':'#424361',
    'steel-silver':'#999BAE', teal:'#278D8E', violet:'#8554B5',
    'dark-blue':'#243C69', 'dark-green':'#174E42', 'dark-purple':'#3E245D',
    'clear-base':'transparent', transparent:'transparent'
  };
  if (tag === 'multicolor') return '<span class="tag-colour-dot tag-colour-multicolor" aria-hidden="true"></span>';
  if (!(tag in colours)) return '';
  return `<span class="tag-colour-dot${colours[tag] === 'transparent' ? ' tag-colour-clear' : ''}" style="--dot-colour:${colours[tag]}" aria-hidden="true"></span>`;
}
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.addEventListener('scroll', () => {
  if (!location.hash || location.hash === '#') overviewState.scrollY = window.scrollY;
}, { passive: true });
const finishDrafts = new Map();
const fields = ['manufacturer_hex', 'personal_hex', 'override_hex', 'manufacturer_source', 'personal_source'];
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key = row => encodeURIComponent(row.id);
const effective = row => row.override_hex || row.personal_hex || row.manufacturer_hex || '';
const transparent = row => row.color_family.split(';').map(s=>s.trim()).includes('clear') && !row.override_hex && !row.personal_hex;
const transparentLabel = row => 'Transparent' + (row.finish.split(';').map(s=>s.trim()).includes('matte') ? ' · Matte' : row.finish.split(';').map(s=>s.trim()).includes('glossy') ? ' · Glossy' : row.role === 'base' ? ' · Base coat' : ' · Topcoat');
const displayLabel = row => transparent(row) ? transparentLabel(row) : effective(row) || 'Colour unknown';
const categoryLabel = row => catalog.categories[row.category] || catalog.categories.unknown;
const categoryBadge = row => `<span class="category-badge category-${escapeHtml(row.category || 'unknown')}">${escapeHtml(categoryLabel(row))}</span>`;
const tagLabel = tag => String(tag).toLowerCase() === 'glitter' ? `\u2728 ${escapeHtml(tag)} \u2728` : escapeHtml(tag);
function polishTags(tags = []) {
  return tags.length ? `<div class="polish-tags" aria-label="Polish tags">${tags.map(tag=>`<span class="polish-tag">${tagColourDot(tag.toLowerCase())}${tagLabel(tag)}</span>`).join('')}</div>` : '<p class="muted">No tags recorded.</p>';
}
async function load() {
  const response = await fetch(publicMode ? 'catalogue.json' : 'api.php');
  if (!response.ok) throw Error('Cannot load the catalogue. Reload to retry.');
  catalog = await response.json(); imageReferences = catalog.imageReferences; render();
}
function safeImageUrl(value) {
  if (/^\.\.\/images\/[a-z0-9/_-]+\.(png|jpe?g|webp|gif)$/i.test(value || '')) return new URL(value.replace('../images/', 'images/'), location.href).href;
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
}
function gallery(row) {
  const entry = imageReferences[row.brand + '/' + row.shade_name] || {};
  const photos = (entry.images || []).slice(0,3).filter(photo => safeImageUrl(photo.url) && safeImageUrl(photo.source));
  return `<section class="references" aria-label="Product and swatch photographs"><h2>In pictures</h2>${entry.note ? `<p class="reference-note">${escapeHtml(entry.note)}</p>` : ''}<div class="photo-grid">${photos.map(photo => `<figure><a href="${escapeHtml(safeImageUrl(photo.url))}" target="_blank" rel="noopener"><img src="${escapeHtml(safeImageUrl(photo.url))}" alt="${escapeHtml(row.brand + ' ' + row.shade_name + ': ' + photo.caption)}" loading="lazy" referrerpolicy="no-referrer"></a><figcaption><span class="tag">${photo.kind === 'manufacturer' ? 'Product picture' : 'Swatch reference'}</span><p>${escapeHtml(photo.caption)}</p><a href="${escapeHtml(safeImageUrl(photo.source))}" target="_blank" rel="noopener">Photo source ↗</a><p class="photo-error" hidden>Picture unavailable from the source. Open the photo source above.</p></figcaption></figure>`).join('') || '<p>No verified picture found yet.</p>'}</div><p class="muted">External reference photos, not your personal manicure photos. Open a picture to see it at full size.</p>${entry.estimate ? `<p class="muted">Research photo sample: ${escapeHtml(entry.estimate.hex)} · ${escapeHtml(entry.estimate.context)}. Photo estimate, not a manufacturer-listed hex.</p>` : ''}</section>`;
}
const brandIconDomains = {"Holo Taco":"holotaco.com","Hema":"hema.nl","Essie":"essie.com","Essence":"essence.eu","Sally Hansen":"sallyhansen.com","OPI":"opi.com","Orly":"orlybeauty.com","Mooncat":"mooncat.com","Cirque Colors":"cirquecolors.com","Kiko":"kikocosmetics.com","Nails Inc":"nailsinc.com","Nails Inc.":"nailsinc.com","Herzlack":"herzlack.de","Emily de Molly":"emilydemolly.com","Kruidvat":"kruidvat.nl","Miss Sporty":"miss-sporty.com","BLP":"blpbeauty.com","DA":"da.nl","Catrice":"catrice.eu","MoYou":"moyou.co.uk"};
function brandMark(brand) {
  const domain = brandIconDomains[brand];
  const image = domain ? `<img class="brand-logo" src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true">` : '';
  return `<span class="brand-mark">${image}<span>${escapeHtml(brand || 'Unspecified brand')}</span></span>`;
}
function overviewCard(row) {
  const photos = (imageReferences[row.brand + '/' + row.shade_name]?.images || []).filter(photo => safeImageUrl(photo.url));
  const bottle = photos.find(photo => photo.kind === 'manufacturer') || photos.find(photo => /(?:bottle|product)/i.test(photo.caption || ''));
  const nailPhoto = photos.find(photo => photo.kind === 'swatch') || photos.find(photo => /(?:hand|nail|swatch)/i.test(photo.caption || ''));
  const photo = bottle || nailPhoto || photos[0];
  const alternate = nailPhoto && nailPhoto.url !== photo?.url ? nailPhoto : null;
  const missing = [!bottle && 'Bottle', !nailPhoto && 'Nail swatch'].filter(Boolean);
  const attributes = [...new Set([row.finish, row.color_family].flatMap(value => (value || '').split(';')).map(value => value.trim()).filter(Boolean))];
  return `<a class="card tile polish-overview-card" href="#${key(row)}">
    <div class="overview-photo${photo ? '' : ' overview-photo-empty'}">
      ${photo ? `<img class="overview-product" src="${escapeHtml(safeImageUrl(photo.url))}" alt="${escapeHtml(row.brand + ' ' + row.shade_name + ' reference')}" loading="lazy" referrerpolicy="no-referrer">` : `<span class="overview-placeholder" aria-hidden="true">No photo yet</span>`}
      ${alternate ? `<img class="overview-nail" src="${escapeHtml(safeImageUrl(alternate.url))}" alt="${escapeHtml(row.shade_name + ' nail swatch')}" loading="lazy" referrerpolicy="no-referrer">` : ''}
      <span class="overview-photo-kind">${escapeHtml(photo ? (photo === nailPhoto ? 'Nail swatch' : 'Bottle / product') : 'Image needed')}</span>
    </div>
    <div class="overview-card-body"><h2>${escapeHtml(row.shade_name)}</h2><p class="overview-brand">${brandMark(row.brand)}</p>
    ${swatch(effective(row),'small-swatch',row)}
    <div class="overview-attributes">${attributes.slice(0,4).map(value => `<span class="overview-attribute">${tagColourDot(value.toLowerCase())}${escapeHtml(value)}</span>`).join('')}</div>
    ${missing.length ? `<span class="overview-missing" aria-label="Missing images: ${escapeHtml(missing.join(', '))}">＋ Add ${escapeHtml(missing.join(' & '))}</span>` : '<span class="overview-complete">✓ Bottle & swatch recorded</span>'}
    </div></a>`;
}
function swatch(value, extra = '', row = null) {
  const finishes = row ? row.finish.split(';').map(f=>f.trim()) : [];
  const effects = ['creme','jelly','shimmer','metallic','holo','glitter','magnetic','thermal','matte','glossy','duochrome'].filter(f=>finishes.includes(f) || (f === 'duochrome' && row?.tags?.includes(f)));
  const layers = effects.map(f=>`<span class="finish-effect finish-${f}" aria-hidden="true"></span>`).join('');
  const description = effects.length ? `Illustrative ${effects.join(', ')} finish; not a measured appearance` : 'Flat colour reference';
  if(row && transparent(row)) return `<div class="swatch swatch-transparent ${extra}" role="img" aria-label="${escapeHtml(transparentLabel(row) + '. ' + description)}" title="${escapeHtml(description)}">${layers}</div>`;
  return `<div class="swatch ${extra}" role="img" aria-label="${escapeHtml((value || 'Colour unknown') + '. ' + description)}" title="${escapeHtml(description)}" ${value ? `style="background-color:${escapeHtml(value)}"` : ''}>${value ? layers : 'Colour unknown'}</div>`;
}
function render() {
  if (publicMode && ['#enrich', '#finish-review'].includes(location.hash)) {
    renderPublicReview(location.hash === '#finish-review'); return;
  }
  if (location.hash === '#enrich') { renderEnrichment(); return; }
  if (location.hash === '#finish-review') { renderFinishReview(); return; }
  finishReviewIds = null;
  const row = catalog.rows.find(item => key(item) === location.hash.slice(1) || encodeURIComponent(item.brand + '/' + item.shade_name) === location.hash.slice(1));
  dirty = false;
  if (!row) {
    current = null;
    app.innerHTML = `<span class="tag">Your collection</span><h1>All the shades.</h1><p class="muted">${catalog.rows.length} products · Open a polish to compare references${publicMode ? '. Save corrections through Nail Studio chat.' : ' and set your own color.'}</p><div class="toolbar"><input id="search" aria-label="Search polishes" placeholder="Find a brand or shade…"></div><div class="grid" id="library"></div>`;
    document.querySelector('.toolbar').insertAdjacentHTML('beforeend', `<select id="category-filter" aria-label="Filter polish category"><option value="">All categories</option>${Object.entries(catalog.categories).map(([id, label])=>`<option value="${escapeHtml(id)}">${escapeHtml(label)} (${catalog.rows.filter(r=>r.category===id).length})</option>`).join('')}</select>`);
    document.querySelector('#search').placeholder = 'Find a brand, shade or tag…';
    document.querySelector('.toolbar').insertAdjacentHTML('afterend', '<p><a class="review-link" href="#enrich">Enrich polishes — optional references</a></p>');
    document.querySelector('.toolbar').insertAdjacentHTML('beforebegin', '<p class="muted">Swatches include illustrative finish effects. Open a polish for its photos and flat colour references.</p>');
    document.querySelector('.toolbar').insertAdjacentHTML('afterend', `<p><a class="review-link" href="#finish-review">Review unconfirmed finishes (${catalog.rows.filter(r=>!r.finish.trim()).length})</a></p>`);
    document.querySelector('#library').insertAdjacentHTML('beforebegin', '<p id="result-count" class="muted" role="status" aria-live="polite"></p>');
    const tags = [...new Set(catalog.rows.flatMap(filterTags))].sort((a,b) => a.localeCompare(b));
    const tagCounts = new Map(tags.map(tag => [tag, catalog.rows.filter(row => filterTags(row).includes(tag)).length]));
    tags.sort((a, b) => tagCounts.get(b) - tagCounts.get(a) || a.localeCompare(b));
    document.querySelector('#result-count').insertAdjacentHTML('beforebegin', `<details class="tag-filters"${overviewState.tags.size ? ' open' : ''}><summary>Filter by tags <span id="tag-filter-count"></span></summary><div class="tag-match-mode" role="group" aria-label="Match selected tags"><span>Match selected tags</span><button type="button" class="tag-mode-button" data-mode="and" aria-pressed="${overviewState.tagMode === 'and'}" title="Match all selected tags">AND</button><button type="button" class="tag-mode-button" data-mode="or" aria-pressed="${overviewState.tagMode === 'or'}" title="Match any selected tag">OR</button></div><div class="tag-legend" aria-label="Tag colour key"><span class="tag-group-colour">Colour</span><span class="tag-group-finish">Finish / effect</span><span class="tag-group-role">Product role</span><span class="tag-group-context">Collection / context</span></div><div class="tag-filter-options">${tags.map(tag => `<button type="button" class="tag-filter tag-group-${tagGroup(tag)}" title="${tagGroup(tag) === 'context' ? 'Collection / context' : tagGroup(tag)}" data-tag="${escapeHtml(tag)}" aria-pressed="${overviewState.tags.has(tag)}">${tagColourDot(tag)}${tagLabel(tag)} (${tagCounts.get(tag)})</button>`).join('')}</div><button type="button" class="secondary clear-tag-filters">Clear tags</button></details>`);
    function list() {
      const query = document.querySelector('#search').value.trim().toLowerCase();
      const category = document.querySelector('#category-filter').value;
      const rows = catalog.rows.filter(r => (!category || r.category === category) && (!overviewState.tags.size || (overviewState.tagMode === 'or' ? [...overviewState.tags].some(tag => filterTags(r).includes(tag)) : [...overviewState.tags].every(tag => filterTags(r).includes(tag)))) && [r.brand,r.shade_name,categoryLabel(r),...filterTags(r)].join(' ').toLowerCase().includes(query));
      // AND counts describe the result of adding each tag to the current filters.
      const counts = overviewState.tagMode === 'and'
        ? new Map(tags.map(tag => [tag, rows.filter(row => filterTags(row).includes(tag)).length]))
        : tagCounts;
      const options = document.querySelector('.tag-filter-options');
      const buttons = [...options.querySelectorAll('.tag-filter')];
      buttons.sort((a, b) => counts.get(b.dataset.tag) - counts.get(a.dataset.tag) || a.dataset.tag.localeCompare(b.dataset.tag));
      for (const button of buttons) {
        const tag = button.dataset.tag;
        button.innerHTML = `${tagColourDot(tag)}${tagLabel(tag)} (${counts.get(tag)})`;
        options.appendChild(button);
      }
      document.querySelector('#tag-filter-count').textContent = overviewState.tags.size ? `(${overviewState.tags.size} selected)` : '';
      document.querySelector('.clear-tag-filters').disabled = !overviewState.tags.size;
      document.querySelector('#result-count').textContent = `${rows.length} of ${catalog.rows.length} products`;
      document.querySelector('#library').innerHTML = rows.map(overviewCard).join('') || '<p>No polishes match these filters.</p>';
      document.querySelectorAll('#library .overview-photo img').forEach(img => {
        img.onload = () => { if (img.classList.contains('overview-nail')) img.parentElement.classList.add('has-nail-photo'); };
        img.onerror = () => { img.hidden = true; if (img.classList.contains('overview-nail')) img.parentElement.classList.remove('has-nail-photo'); };
        if (img.complete && img.naturalWidth) img.onload();
      });
    }
    document.querySelectorAll('.tag-mode-button').forEach(button => { button.onclick = () => {
      overviewState.tagMode = button.dataset.mode;
      document.querySelectorAll('.tag-mode-button').forEach(option => option.setAttribute('aria-pressed', String(option.dataset.mode === overviewState.tagMode)));
      list();
    }; });
    document.querySelector('#search').value = overviewState.search;
    document.querySelector('#category-filter').value = overviewState.category;
    document.querySelectorAll('.tag-filter').forEach(button => { button.onclick = () => {
      const tag = button.dataset.tag;
      if (overviewState.tags.has(tag)) overviewState.tags.delete(tag); else overviewState.tags.add(tag);
      button.setAttribute('aria-pressed', String(overviewState.tags.has(tag)));
      list();
    }; });
    document.querySelector('.clear-tag-filters').onclick = () => {
      overviewState.tags.clear();
      document.querySelectorAll('.tag-filter').forEach(button => button.setAttribute('aria-pressed', 'false'));
      list();
    };
    list();
    document.querySelector('#search').oninput = () => { overviewState.search = document.querySelector('#search').value; list(); };
    document.querySelector('#category-filter').onchange = () => { overviewState.category = document.querySelector('#category-filter').value; list(); };
    const restoreY = overviewState.scrollY;
    requestAnimationFrame(() => { if (!location.hash || location.hash === '#') window.scrollTo({ top: restoreY, behavior: 'instant' }); });
    return;
  }
  if (publicMode) { renderPublicPolish(row); return; }
  current = {...row};
  app.innerHTML = `<a href="#">← All polishes</a><p class="tag">${brandMark(row.brand)}</p><h1>${escapeHtml(row.shade_name)}</h1><p class="muted">${escapeHtml([row.color_family,row.finish,row.role].filter(Boolean).join(' · '))}</p><p>Color in use: <strong id="effective"></strong></p>${gallery(row)}<div class="grid">${reference('manufacturer','Manufacturer reference','A listed hex or a sample from a manufacturer picture.')}${reference('personal','Your manicure / swatch','Sample a nail in your own photo, in the lighting you prefer.')}<section class="card"><h2>Your override</h2><p class="muted">Fine-tune the color used for this polish.</p><div id="override-preview" class="swatch"></div><label for="override_hex">Hex</label><input id="override_hex" placeholder="#735A91" maxlength="7"><label for="hue">Hue <output id="hue-value"></output></label><input type="range" id="hue" min="0" max="360" value="280"><label for="saturation">Saturation <output id="saturation-value"></output></label><input type="range" id="saturation" min="0" max="100" value="40"><label for="lightness">Lightness <output id="lightness-value"></output></label><input type="range" id="lightness" min="0" max="100" value="50"><button id="clear" class="secondary">Clear override</button></section></div><button id="save">Save colors</button><p id="status" role="status" aria-live="polite">Saved colors load from the JSON record. Changes are saved with the button above.</p><p class="muted">A single hex is a representative color; shimmer, transparency and magnetic effects vary with lighting. Photo samples are estimates.</p>`;
  app.querySelector('h1').insertAdjacentHTML('afterend', categoryBadge(row) + polishTags(row.tags) + swatch(effective(current), 'product-swatch', current));
  // Compact image enrichment inside the detail view; uses the existing editor endpoint.
  const imageEntry = imageReferences[row.brand + '/' + row.shade_name] || {};
  const imageKinds = imageEntry.images || [];
  const hasBottle = imageKinds.some(p => p.kind === 'manufacturer' || /bottle|product/i.test(p.caption || ''));
  const hasNail = imageKinds.some(p => p.kind === 'swatch' || /nail|swatch|hand/i.test(p.caption || ''));
  const googleImages = term => 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent([row.brand,row.shade_name,term].join(' '));
  const editor = document.createElement('section');
  editor.className = 'card detail-image-editor';
  editor.innerHTML = `<h2>Complete the pictures</h2><p class="muted">Bottle: ${hasBottle ? 'Recorded' : 'Missing'} · Nail swatch: ${hasNail ? 'Recorded' : 'Missing'}. Find the exact pictures, then paste a direct image URL.</p>
    <div class="detail-image-fields"><div><a href="${escapeHtml(googleImages('nail polish bottle'))}" target="_blank" rel="noopener">Search bottle pictures ↗</a><label for="detail-bottle-url">Bottle image URL</label><input id="detail-bottle-url" type="url" placeholder="https://…"></div>
    <div><a href="${escapeHtml(googleImages('nail swatch'))}" target="_blank" rel="noopener">Search nail swatches ↗</a><label for="detail-nail-url">Nail swatch image URL</label><input id="detail-nail-url" type="url" placeholder="https://…"></div></div>
    <button id="detail-image-save" type="button">Save image references</button><p id="detail-image-status" role="status" aria-live="polite"></p><p class="muted">Only save images you've verified. Local edits require commit and push to sync with GitHub.</p>`;
  const references = app.querySelector('.references');
  if (references) references.insertAdjacentElement('afterend', editor);
  editor.querySelector('#detail-image-save').onclick = async () => {
    const bottle = editor.querySelector('#detail-bottle-url').value.trim();
    const nail = editor.querySelector('#detail-nail-url').value.trim();
    const status = editor.querySelector('#detail-image-status');
    if (!bottle && !nail) { status.textContent = 'Paste at least one image URL.'; return; }
    if ([bottle,nail].some(url => url && !safeImageUrl(url))) { status.textContent = 'Use direct HTTPS image URLs.'; return; }
    const button = editor.querySelector('#detail-image-save'); button.disabled = true; status.textContent = 'Saving…';
    try {
      // The existing API accepts a single reference_image_url per request.
      // Submit sequentially, refreshing the catalogue version between writes.
      for (const url of [bottle,nail].filter(Boolean)) {
        const response = await fetch('api.php',{method:'POST',headers:{'Content-Type':'application/json','X-Polish-Editor':'1'},body:JSON.stringify({id:row.id,version:catalog.version,reference_image_url:url,refinement_queued:true})});
        const result = await response.json(); if (!response.ok) throw Error(result.error || 'Save failed.');
        catalog = result; imageReferences = result.imageReferences;
      }
      status.textContent = 'Reference URL(s) saved locally. Commit and push to sync.';
      editor.querySelectorAll('input').forEach(input => input.value = '');
    } catch(error) { status.textContent = error.message; } finally { button.disabled = false; }
  };
  for (const image of app.querySelectorAll(".photo-grid img")) {
    image.onerror = () => { image.hidden = true; image.closest("figure").querySelector(".photo-error").hidden = false; };
  }
  for (const field of fields) {
    const input = document.getElementById(field); input.value = current[field] || '';
    input.oninput = () => { current[field] = input.value.trim(); changed(); if (field === 'override_hex' && valid(input.value)) syncSliders(input.value); paint(); };
  }
  for (const type of ['manufacturer','personal']) {
    document.getElementById(type+'-file').onchange = e => samplePhoto(type,e.target.files[0]);
    document.getElementById(type+'-search').href = 'https://www.google.com/search?tbm=isch&q='+encodeURIComponent(row.brand+' '+row.shade_name+' '+(type==='manufacturer'?'official swatch':'manicure'));
  }
  document.querySelector('#save').onclick = save;
  document.querySelector('#clear').onclick = () => { current.override_hex = ''; document.querySelector('#override_hex').value = ''; changed(); paint(); };
  for (const id of ['hue','saturation','lightness']) document.getElementById(id).oninput = () => {
    current.override_hex = hslHex(...['hue','saturation','lightness'].map(id => +document.getElementById(id).value));
    document.querySelector('#override_hex').value = current.override_hex; changed(); paint();
  };
  syncSliders(effective(current) || '#9955B3'); paint();
}
function renderPublicPolish(row) {
    current = null;
    app.innerHTML = `<a href="#">← All polishes</a><p class="tag">${brandMark(row.brand)}</p><h1>${escapeHtml(row.shade_name)}</h1>${categoryBadge(row)}${polishTags(row.tags)}<p class="muted">${escapeHtml([row.color_family, row.finish, row.role].filter(Boolean).join(' · '))}</p>${swatch(effective(row), 'product-swatch', row)}<p>Colour in use: ${escapeHtml(displayLabel(row))}</p>${gallery(row)}<div class="grid">${['manufacturer', 'personal', 'override'].map(type => `<section class="card"><h2>${escapeHtml({manufacturer:'Manufacturer reference', personal:'Personal reference', override:'User override'}[type])}</h2>${swatch(row[type + '_hex'], 'small-swatch')}<p>${escapeHtml(row[type + '_hex'] || 'Not recorded')}</p></section>`).join('')}</div><p class="muted">Colour and finish previews are illustrative. Save corrections through Nail Studio chat using polish ID: <strong>${escapeHtml(row.id)}</strong>.</p><p><a href="../colour-lab/">Explore colour combinations →</a></p>`;
    for (const image of app.querySelectorAll('.photo-grid img')) {
        image.onerror = () => {
            image.hidden = true;
            image.closest('figure').querySelector('.photo-error').hidden = false;
        };
    }
}

function renderPublicReview(finishes) {
    current = null;
    dirty = false;
    const rows = finishes ? catalog.rows.filter(row => !row.finish.trim()) : catalog.rows;
    app.innerHTML = `<a href="#">← All polishes</a><h1>${finishes ? 'Unconfirmed finishes' : 'Product references'}</h1><p class="muted">${rows.length} products. Open a polish to review its pictures. Send confirmed finishes, exact product links or image references to Nail Studio chat with the polish ID to save them.</p><div class="grid">${rows.map(overviewCard).join('') || '<p>All polishes have a recorded finish.</p>'}</div>`;
}

function finishProductPhoto(row) {
  const photos = (imageReferences[row.brand + '/' + row.shade_name]?.images || []).filter(photo=>safeImageUrl(photo.url) && safeImageUrl(photo.source));
  const photo = photos.find(photo=>photo.kind === 'manufacturer') || photos[0];
  if (!photo) return '<p class="muted">No product picture recorded.</p>';
  return `<figure class="finish-photo"><a href="${escapeHtml(safeImageUrl(photo.url))}" target="_blank" rel="noopener"><img src="${escapeHtml(safeImageUrl(photo.url))}" alt="${escapeHtml(row.brand + ' ' + row.shade_name + ': ' + photo.caption)}" loading="lazy" referrerpolicy="no-referrer"></a><figcaption><p class="photo-error" hidden>Picture unavailable from the source.</p><a href="${escapeHtml(safeImageUrl(photo.source))}" target="_blank" rel="noopener">Photo source ↗</a></figcaption></figure>`;
}
function renderFinishReview() {
  current = null; dirty = false;
  if (!finishReviewIds) finishReviewIds = catalog.rows.filter(r=>!r.finish.trim()).map(r=>r.id);
  const rows = finishReviewIds.map(id=>catalog.rows.find(r=>r.id===id)).filter(Boolean);
  const remaining = catalog.rows.filter(r=>!r.finish.trim()).length;
  app.innerHTML = `<a href="#">← All polishes</a><h1>Confirm the finishes.</h1><p class="muted">${remaining} finishes still unconfirmed. Select one or more finishes, then save each polish. Leave any you are unsure about for later.</p><p id="finish-status" role="status" aria-live="polite"></p><div class="grid finish-review">${rows.map(row=>{
    const selected = finishDrafts.get(row.id) || row.finish.split(';').filter(Boolean);
    return `<section class="card finish-card" data-polish-id="${escapeHtml(row.id)}"><span class="tag">${escapeHtml(row.brand)}</span><h2><a href="#${key(row)}">${escapeHtml(row.shade_name)}</a></h2>${swatch(effective(row),'small-swatch',row)}<p class="muted">${row.finish ? 'Saved: '+escapeHtml(row.finish.split(';').map(f=>catalog.finishOptions[f] || f).join(', ')) : 'Finish unconfirmed'}</p><div class="finish-choices" role="group" aria-label="Finishes for ${escapeHtml(row.shade_name)}">${Object.entries(catalog.finishOptions).map(([value,label])=>`<button type="button" class="finish-choice" data-finish="${escapeHtml(value)}" aria-pressed="${selected.includes(value)}">${escapeHtml(label)}</button>`).join('')}</div><button type="button" class="save-finish"${selected.length ? '' : ' disabled'}>Save finish</button></section>`;
  }).join('') || '<p>All polishes have a recorded finish.</p>'}</div>`;
  for (const card of app.querySelectorAll('.finish-card')) {
    const row = catalog.rows.find(r=>r.id===card.dataset.polishId);
    card.querySelector('h2').insertAdjacentHTML('afterend', finishProductPhoto(row));
    const photo = card.querySelector('.finish-photo img');
    if (photo) photo.onerror = () => { photo.hidden = true; card.querySelector('.photo-error').hidden = false; };
    for (const button of card.querySelectorAll('.finish-choice')) button.onclick = () => {
      button.setAttribute('aria-pressed', button.getAttribute('aria-pressed') !== 'true');
      const selected = [...card.querySelectorAll('.finish-choice[aria-pressed="true"]')].map(b=>b.dataset.finish);
      finishDrafts.set(row.id, selected);
      card.querySelector('.small-swatch').outerHTML = swatch(effective(row), 'small-swatch', {...row,finish:selected.join(';')});
      card.querySelector('.save-finish').disabled = !selected.length;
      dirty = true;
    };
    card.querySelector('.save-finish').onclick = async () => {
      const selected = finishDrafts.get(row.id) || row.finish.split(';').filter(Boolean);
      const controls = [...app.querySelectorAll('button')]; controls.forEach(b=>b.disabled=true);
      const status = document.querySelector('#finish-status'); status.textContent = 'Saving…';
      try {
        const response = await fetch('api.php', {method:'POST',headers:{'Content-Type':'application/json','X-Polish-Editor':'1'},body:JSON.stringify({id:row.id,version:catalog.version,finish:selected.join(';')})});
        const result = await response.json(); if (!response.ok) throw Error(result.error || 'Save failed.');
        catalog = result; imageReferences = result.imageReferences; finishDrafts.delete(row.id);
        renderFinishReview(); dirty = finishDrafts.size > 0;
        document.querySelector('#finish-status').textContent = `Saved ${row.shade_name}.`;
      } catch(error) {
        status.textContent = error.message;
        controls.forEach(b=>b.disabled=false);
        for (const c of app.querySelectorAll('.finish-card')) c.querySelector('.save-finish').disabled = !c.querySelector('.finish-choice[aria-pressed="true"]');
      }
    };
  }
  dirty = finishDrafts.size > 0;
}
function reference(type,title,description) {
  return `<section class="card"><h2>${title}</h2><p class="muted">${description}</p><div id="${type}-preview" class="swatch"></div><label for="${type}_hex">Hex</label><input id="${type}_hex" placeholder="Not recorded" maxlength="7"><label for="${type}_source">Source URL or archive/photo path</label><input id="${type}_source" placeholder="Source reference"><p><a id="${type}-search" target="_blank" rel="noopener">Find reference pictures ↗</a></p><label for="${type}-file">Choose a reference photo, then click the nail to sample</label><input type="file" id="${type}-file" accept="image/png,image/jpeg,image/webp"><canvas id="${type}-canvas" hidden></canvas><p class="muted">The image stays on this device. Keep personal photos in manis/photos/ and enter their archive path above.</p></section>`;
}
const valid = value => /^#[0-9a-f]{6}$/i.test(value);
function changed() { dirty = true; document.querySelector('#status').textContent = 'Unsaved changes'; }
function paint() {
  const productSwatch = app.querySelector('.product-swatch');
  if(productSwatch) productSwatch.outerHTML = swatch(effective(current), 'product-swatch', current);
  for (const type of ['manufacturer','personal','override']) {
    const value = current[type+'_hex'] || '', element = document.getElementById(type+'-preview');
    element.style.background = valid(value) ? value : '';
    element.textContent = valid(value) ? value.toUpperCase() : 'Not recorded';
    element.style.color = valid(value) && parseInt(value.slice(1,3),16)*.299+parseInt(value.slice(3,5),16)*.587+parseInt(value.slice(5,7),16)*.114 < 140 ? 'white' : '#302c34';
  }
  document.querySelector('#effective').textContent = displayLabel(current);
  for (const id of ['hue','saturation','lightness']) document.getElementById(id+'-value').textContent = document.getElementById(id).value + (id==='hue'?'°':'%');
}
function hslHex(h,s,l) {
  s/=100; l/=100;
  const a=s*Math.min(l,1-l);
  const f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');};
  return ('#'+f(0)+f(8)+f(4)).toUpperCase();
}
function syncSliders(hex) {
  const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255), max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;
  let h=0,s=0;
  if(d){s=d/(1-Math.abs(2*l-1));h=(max===r?((g-b)/d+6)%6:max===g?(b-r)/d+2:(r-g)/d+4)*60;}
  [h,s*100,l*100].forEach((v,i)=>document.getElementById(['hue','saturation','lightness'][i]).value=Math.round(v));
}
async function samplePhoto(type,file) {
  if(!file) return;
  if(file.size>20000000){document.querySelector('#status').textContent='Choose a photo under 20 MB.';return;}
  const url=URL.createObjectURL(file), image=new Image();
  image.onload=()=>{
    const canvas=document.getElementById(type+'-canvas'), scale=Math.min(1,1200/image.width,1200/image.height);
    canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.hidden=false;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);
    canvas.onclick=e=>{
      const rect=canvas.getBoundingClientRect(),x=Math.min(canvas.width-1,Math.max(0,Math.floor((e.clientX-rect.left)*canvas.width/rect.width))),y=Math.min(canvas.height-1,Math.max(0,Math.floor((e.clientY-rect.top)*canvas.height/rect.height)));
      const pixel=ctx.getImageData(x,y,1,1).data;
      if(pixel[3]!==255){document.querySelector('#status').textContent='Choose an opaque part of the nail.';return;}
      const hex='#'+[...pixel].slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
      current[type+'_hex']=hex;document.getElementById(type+'_hex').value=hex;
      if(!current[type+'_source']){current[type+'_source']='Sampled from '+file.name;document.getElementById(type+'_source').value=current[type+'_source'];}
      changed();paint();
    };
  };
  image.onerror=()=>{URL.revokeObjectURL(url);document.querySelector('#status').textContent='Could not open this image.';};image.src=url;
}
async function save() {
  const button=document.querySelector('#save'), status=document.querySelector('#status');
  if(fields.slice(0,3).some(f=>current[f]&&!valid(current[f]))){status.textContent='Use # followed by six hex digits, or leave the color blank.';return;}
  const controls=[...app.querySelectorAll('input,button')];controls.forEach(el=>el.disabled=true);
  try {
    const payload={id:current.id,version:catalog.version};fields.forEach(f=>payload[f]=current[f]||'');
    const response=await fetch('api.php',{method:'POST',headers:{'Content-Type':'application/json','X-Polish-Editor':'1'},body:JSON.stringify(payload)});
    const result=await response.json();if(!response.ok)throw Error(result.error||'Save failed.');
    catalog=result;imageReferences=result.imageReferences;dirty=false;status.textContent='Saved to the JSON record; pages and exports refreshed. Commit and push to sync with GitHub and your phone.';
  } catch(error){status.textContent=error.message;} finally {controls.forEach(el=>el.disabled=false);}
}
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
window.addEventListener('hashchange',event=>{if(dirty){if(!confirm('Leave and discard unsaved changes?')){history.replaceState(null,'',event.oldURL);return;}finishDrafts.clear();enrichmentDrafts.clear();}render();});
load().catch(error=>app.textContent=error.message);
