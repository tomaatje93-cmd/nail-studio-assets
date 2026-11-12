const app = document.querySelector('#app');
const publicMode = document.body.dataset.catalogueMode === 'public';
let catalog, current, dirty = false, imageReferences = {};
const overviewState = { scrollY: 0, search: '', brand: '', category: '', finishClass: '', tags: new Set(), tagsOpen: false, tagMode: 'and' };
const comparison = { active: false, ids: new Set() };
const polishFinishClasses = row => [...new Set((row.finish || '').split(';').map(f => catalog.finishClasses?.[f.trim()] || 'neither'))];
const normalizePolishTag = value => value.trim().toLowerCase();
const normalizePolishQuery = value => value.toLowerCase().replace(/\bholographic\b/g, 'holo').replace(/\bdark (blue|green|purple)\b/g, 'dark-$1').replace(/\bgrey\b/g, 'gray');
const filterTags = row => [...new Set([...(row.tags || []), ...[row.finish, row.color_family, row.role].flatMap(value => (value || '').split(';'))].map(normalizePolishTag).filter(Boolean))];
function tagGroup(tag) {
  if (tagColourDot(tag) || catalog.rows.some(row => (row.color_family || '').split(';').some(value => value.trim().toLowerCase() === tag))) return 'colour';
  if (['holo','holographic','iridescent','flakie','foil','duochrome','multichrome','reflective'].includes(tag) || catalog.rows.some(row => (row.finish || '').split(';').some(value => value.trim().toLowerCase() === tag))) return 'finish';
  if (['base','color','colour','topper','treatment','stamping'].includes(tag) || catalog.rows.some(row => (row.role || '').split(';').some(value => value.trim().toLowerCase() === tag))) return 'role';
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
    'dark-red':'#651D35', 'dark-teal':'#164D65', 'berry-pink':'#B44481',
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
const fields = ['manufacturer_hex', 'personal_hex', 'override_hex', 'manufacturer_source', 'personal_source'];
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key = row => encodeURIComponent(row.id);
const effective = row => row.override_hex || row.personal_hex || row.manufacturer_hex || '';
const transparent = row => row.color_family.split(';').map(s=>s.trim()).includes('clear') && !row.override_hex && !row.personal_hex;
const transparentLabel = row => 'Transparent' + (row.finish.split(';').map(s=>s.trim()).includes('matte') ? ' · Matte' : row.finish.split(';').map(s=>s.trim()).includes('glossy') ? ' · Glossy' : row.role === 'base' ? ' · Base coat' : ' · Topcoat');
const displayLabel = row => transparent(row) ? transparentLabel(row) : effective(row) || 'Colour unknown';
const categoryLabel = row => catalog.categories[row.category] || catalog.categories.unknown;
const categoryBadge = row => `<span class="category-badge category-${escapeHtml(row.category || 'unknown')}">${escapeHtml(categoryLabel(row))}</span>`;
const tagLabel = tag => String(tag).toLowerCase() === 'glitter' ? `\u2728 ${escapeHtml(tag)} \u2728` : escapeHtml(String(tag).replace(/-/g, ' '));
function burstHoloGlitter(button, event) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const rect = button.getBoundingClientRect();
    const x = event.detail ? event.clientX : rect.left + rect.width / 2;
    const y = event.detail ? event.clientY : rect.top + rect.height / 2;
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    // Rainbow Snow: dense silver microglitter, with independently refracting flecks.
    // Cap the count on smaller screens to keep the burst responsive.
    const count = Math.min(750, Math.max(320, Math.round(width * height / 1250)));
    const burst = document.createElement('div');
    burst.className = 'holo-glitter-burst';
    burst.setAttribute('aria-hidden', 'true');
    burst.style.setProperty('--origin-x', `${x}px`);
    burst.style.setProperty('--origin-y', `${y}px`);

    // Exact 40/40/20 distribution, shuffled so shapes do not appear in batches.
    const shapes = Array.from({length: count}, (_, i) =>
        i < Math.round(count * .4) ? 'hex' :
        i < Math.round(count * .8) ? 'circle' : 'square');
    for (let i = shapes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shapes[i], shapes[j]] = [shapes[j], shapes[i]];
    }
    const particles = document.createDocumentFragment();
    let longestFlight = 0;
    for (const shape of shapes) {
        const particle = document.createElement('span');
        particle.className = 'holo-particle-' + shape;
        // Spread launch points around the click and let some flecks fly offscreen.
        const originX = x + (Math.random() - .5) * 90;
        const originY = y + (Math.random() - .5) * 90;
        const targetX = (Math.random() * 1.3 - .15) * width;
        const targetY = (Math.random() * 1.3 - .15) * height;
        const size = shape === 'circle'
            ? 1.5 + Math.pow(Math.random(), 1.8) * 13
            : shape === 'hex' ? 2 + Math.random() * 7 : 2 + Math.random() * 8;
        const flight = 950 + Math.random() * 1450;
        const shineDelay = Math.random() * -900;
        longestFlight = Math.max(longestFlight, flight);
        particle.style.setProperty('--particle-x', `${originX}px`);
        particle.style.setProperty('--particle-y', `${originY}px`);
        particle.style.setProperty('--dx', `${targetX - originX}px`);
        particle.style.setProperty('--dy', `${targetY - originY}px`);
        particle.style.setProperty('--size', `${size}px`);
        particle.style.setProperty('--angle', `${Math.random() * 360}deg`);
        particle.style.setProperty('--spin', `${(Math.random() < .5 ? -1 : 1) * (180 + Math.random() * 900)}deg`);
        particle.style.setProperty('--shine-delay', `${shineDelay}ms`);
        particle.style.setProperty('--shine-speed', `${310 + Math.random() * 620}ms`);
        particle.style.setProperty('--flight', `${flight}ms`);
        particle.style.setProperty('--hue', `${Math.floor(Math.random() * 360)}deg`);
        particles.append(particle);
    }
    burst.append(particles);

    document.querySelector('.holo-glitter-burst')?.remove();
    document.body.append(burst);
    window.setTimeout(() => burst.remove(), longestFlight + 120);
}
function polishTags(tags = []) {
  const labels = [...new Set(tags.map(normalizePolishTag))];
  return labels.length ? `<div class="polish-tags" aria-label="Polish tags">${labels.map(tag=>`<span class="polish-tag">${tagColourDot(tag)}${tagLabel(tag)}</span>`).join('')}</div>` : '<p class="muted">No tags recorded.</p>';
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
  const domain = brandIconDomains[brand === 'MoYou London' ? 'MoYou' : brand];
  const whiteLogo = brand === 'Holo Taco';
  const url = whiteLogo ? 'https://www.holotaco.com/cdn/shop/files/favicon.png?crop=center&height=32&v=1613599192&width=32' : domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64` : '';
  const image = url ? `<img class="brand-logo${whiteLogo ? ' brand-logo-white' : ''}" src="${escapeHtml(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true">` : '';
  return `<span class="brand-mark">${image}<span>${escapeHtml(brand || 'Unspecified brand')}</span></span>`;
}
let usedSavePending = false;
async function saveUsed(checkbox) {
  if (usedSavePending) return;
  const row = catalog.rows.find(item => item.id === checkbox.dataset.polishId);
  if (!row) return;
  const previous = row.used === true;
  const desired = checkbox.checked;
  const status = checkbox.closest('.used-control').querySelector('.used-status');
  usedSavePending = true;
  document.querySelectorAll('.used-checkbox').forEach(input => { input.disabled = true; });
  status.textContent = '';
  try {
    const response = await fetch('api.php', {method:'POST', headers:{'Content-Type':'application/json','X-Polish-Editor':'1'}, body:JSON.stringify({id:row.id,version:catalog.version,used:desired})});
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'Save failed.');
    catalog = result;
    imageReferences = result.imageReferences;
    if (current?.id === row.id) current.used = desired;
    status.textContent = '';
    // Celebrate only a confirmed transition to Used, never the pending request.
    if (desired && !previous && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const card = checkbox.closest('.polish-overview-card');
      if (card) {
        card.classList.remove('used-save-pulse');
        void card.offsetWidth;
        card.classList.add('used-save-pulse');
        card.addEventListener('animationend', () => card.classList.remove('used-save-pulse'), { once: true });
      }
    }
  } catch (error) {
    checkbox.checked = previous;
    status.textContent = error.message || 'Save failed';
  } finally {
    usedSavePending = false;
    document.querySelectorAll('.used-checkbox').forEach(input => { input.disabled = false; });
  }
}
function usedControl(row) {
  return `<label class="used-control"><input type="checkbox" class="used-checkbox" data-polish-id="${escapeHtml(row.id)}" ${row.used === true ? 'checked' : ''} aria-label="Used: ${escapeHtml(row.brand + ' ' + row.shade_name)}" title="Mark this polish as used"><span class="used-label">Used</span><span class="used-status" role="status" aria-live="polite"></span></label>`;
}
function bindUsedControls(scope = app) {
  if (publicMode) return;
  scope.querySelectorAll('.used-checkbox').forEach(input => { input.onchange = () => saveUsed(input); });
}
const defaultCardImageFrame = Object.freeze({x: 0, y: 0, zoom: 1});
function validCardImageFrame(frame) {
    return frame && Number.isFinite(frame.x) && Math.abs(frame.x) <= 0.5
        && Number.isFinite(frame.y) && Math.abs(frame.y) <= 0.5
        && Number.isFinite(frame.zoom) && frame.zoom >= 0.5 && frame.zoom <= 3;
}
function cardImageTransform(frame) {
    const {x, y, zoom} = validCardImageFrame(frame) ? frame : defaultCardImageFrame;
    return `translate(${x * 100}%, ${y * 100}%) scale(${zoom})`;
}
function catalogueCardPhotos(row) {
  const photos = (imageReferences[row.brand + '/' + row.shade_name]?.images || []).filter(photo => safeImageUrl(photo.url));
  const bottle = photos.find(photo => photo.kind === 'manufacturer') || photos.find(photo => /(?:bottle|product)/i.test(photo.caption || ''));
  const nailPhoto = photos.find(photo => photo.kind === 'swatch') || photos.find(photo => /(?:hand|nail|swatch)/i.test(photo.caption || ''));
  return {bottle, nailPhoto, first: photos[0]};
}
function overviewCard(row) {
  const {bottle, nailPhoto, first} = catalogueCardPhotos(row);
  const photo = bottle || nailPhoto || first;
  const framing = bottle && validCardImageFrame(row.card_image_frame)
      ? ` style="transform:${cardImageTransform(row.card_image_frame)}"` : '';
  const alternate = nailPhoto && nailPhoto.url !== photo?.url ? nailPhoto : null;
  const attributes = [...new Set([row.finish, row.color_family].flatMap(value => (value || '').split(';')).map(value => value.trim()).filter(Boolean))];
  const selected = comparison.active && comparison.ids.has(row.id);
  const name = escapeHtml([row.brand, row.shade_name].filter(Boolean).join(' '));
  const opening = comparison.active
    ? '<div class="polish-card-main">'
    : `<a class="polish-card-main" href="#${key(row)}">`;
  return `<article class="card tile polish-overview-card${selected ? ' is-compared' : ''}">${opening}
    <div class="overview-photo${photo ? '' : ' overview-photo-empty'}">
      ${photo ? `<img class="overview-product"${framing} src="${escapeHtml(safeImageUrl(photo.url))}" alt="${escapeHtml(row.brand + ' ' + row.shade_name + ' reference')}" loading="lazy" referrerpolicy="no-referrer">` : `<span class="overview-placeholder" aria-hidden="true">No photo yet</span>`}
      ${alternate ? `<img class="overview-nail" src="${escapeHtml(safeImageUrl(alternate.url))}" alt="${escapeHtml(row.shade_name + ' nail swatch')}" loading="lazy" referrerpolicy="no-referrer">` : ''}
    </div>
    <div class="overview-card-body"><h2>${escapeHtml(row.shade_name)}</h2><p class="overview-brand">${brandMark(row.brand)}</p>
    ${swatch(effective(row),'small-swatch',row)}
    <div class="overview-attributes">${attributes.slice(0,4).map(value => `<span class="overview-attribute">${tagColourDot(value.toLowerCase())}${tagLabel(value)}</span>`).join('')}</div>
    </div>${comparison.active ? `</div><button type="button" class="compare-card-toggle" data-compare-id="${escapeHtml(row.id)}" aria-label="Compare ${name}" aria-pressed="${selected}"><span class="compare-card-check" aria-hidden="true">✓</span></button>` : '</a>'}${publicMode || comparison.active ? '' : `<div class="polish-card-actions"><a class="polish-card-edit" href="#enrich/${encodeURIComponent(row.id)}" aria-label="Edit ${escapeHtml(row.brand + ' ' + row.shade_name)}">✎ Edit polish</a>${usedControl(row)}</div>`}</article>`;
}
function swatch(value, extra = '', row = null) {
  const finishes = row ? row.finish.split(';').map(f=>f.trim()) : [];
  const effects = ['creme','jelly','shimmer','metallic','holo','glitter','magnetic','thermal','matte','glossy','duochrome'].filter(f=>finishes.includes(f) || (f === 'duochrome' && row?.tags?.includes(f)));
  const layers = effects.map(f=>`<span class="finish-effect finish-${f}" aria-hidden="true"></span>`).join('');
  const description = effects.length ? `Illustrative ${effects.join(', ')} finish; not a measured appearance` : 'Flat colour reference';
  if(row && transparent(row)) return `<div class="swatch swatch-transparent ${extra}" role="img" aria-label="${escapeHtml(transparentLabel(row) + '. ' + description)}" title="${escapeHtml(description)}">${layers}</div>`;
  return `<div class="swatch ${extra}" role="img" aria-label="${escapeHtml((value || 'Colour unknown') + '. ' + description)}" title="${escapeHtml(description)}" ${value ? `style="background-color:${escapeHtml(value)}"` : ''}>${value ? layers : 'Colour unknown'}</div>`;
}
function polishHashMatches(row, hash) {
  if (key(row) === hash) return true;
  try {
    const decoded = decodeURIComponent(hash);
    const slash = decoded.indexOf('/');
    const brandKey = value => value.trim().toLowerCase().replace(/\./g, '');
    return slash >= 0 && brandKey(decoded.slice(0, slash)) === brandKey(row.brand) && decoded.slice(slash + 1) === row.shade_name;
  } catch { return false; }
}
function renderComparison(hash) {
    current = null;
    const rowsById = new Map(catalog.rows.map(row => [key(row), row]));
    const rows = [...new Set(hash.slice('#compare/'.length).split('/'))].map(id => rowsById.get(id)).filter(Boolean);
    if (rows.length < 2) {
        app.innerHTML = '<h1 tabindex="-1">Compare polishes</h1><p>Choose at least two available polishes to compare.</p><a href="#">Back to catalogue</a>';
    } else {
        comparison.active = true;
        comparison.ids = new Set(rows.map(row => row.id));
        app.innerHTML = `<a href="#">← Back to selection</a>
            <h1 tabindex="-1">Compare polishes</h1>
            <p class="muted">Colour previews are illustrative. Reference photos show how finishes can look in different lighting.</p>
            <div class="compare-grid">${rows.map(comparisonCard).join('')}</div>`;
        app.querySelectorAll('.compare-photo img').forEach(image => {
            image.onerror = () => {
                image.hidden = true;
                image.nextElementSibling.hidden = false;
            };
            if (image.complete && !image.naturalWidth) image.onerror();
        });
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
    app.querySelector('h1')?.focus({ preventScroll: true });
}

function comparisonCard(row) {
    const {bottle, nailPhoto, first} = catalogueCardPhotos(row);
    const photo = nailPhoto || bottle || first;
    const name = escapeHtml([row.brand, row.shade_name].filter(Boolean).join(' '));
    return `<article class="card compare-polish">
        <h2><a href="#${key(row)}">${escapeHtml(row.shade_name)}</a></h2>
        <p class="overview-brand">${brandMark(row.brand)}</p>
        <div class="compare-photo">
            ${photo ? `<img src="${escapeHtml(safeImageUrl(photo.url))}" alt="${name} ${photo === nailPhoto ? 'nail swatch' : 'reference photo'}" loading="lazy" referrerpolicy="no-referrer"><span class="muted" hidden>Photo unavailable</span>` : '<span class="muted">No photo yet</span>'}
        </div>
        ${swatch(effective(row), 'small-swatch', row)}
        <dl>
            <dt>Colour preview</dt><dd>${escapeHtml(displayLabel(row))}</dd>
            <dt>Colour family</dt><dd>${escapeHtml(row.color_family?.replace(/;/g, ', ').replace(/-/g, ' ') || 'Not recorded')}</dd>
            <dt>Finish</dt><dd>${escapeHtml(row.finish?.replace(/;/g, ', ').replace(/-/g, ' ') || 'Not recorded')}</dd>
            <dt>Category</dt><dd>${categoryBadge(row)}</dd>
        </dl>
        ${polishTags(row.tags)}
    </article>`;
}

function render() {
  if (publicMode && (['#enrich', '#finish-review'].includes(location.hash) || location.hash.startsWith('#enrich/'))) {
    current = null;
    dirty = false;
    app.innerHTML = '<h1>Page unavailable</h1><p><a href="#">Browse polishes</a></p>';
    return;
  }
  if (location.hash === '#enrich' || location.hash.startsWith('#enrich/') || location.hash === '#finish-review') { renderEnrichment(); return; }
  if (location.hash.startsWith('#compare/')) {
    dirty = false;
    renderComparison(location.hash);
    return;
  }
  const row = catalog.rows.find(item => polishHashMatches(item, location.hash.slice(1)));
  dirty = false;
  if (!row) {
    current = null;
    app.innerHTML = `<div class="catalogue-heading"><h1>All the shades.</h1><div class="catalogue-heading-actions"><button type="button" id="compare-mode" aria-pressed="${comparison.active}">${comparison.active ? 'Exit Compare mode' : 'Compare mode'}</button>${!publicMode ? `<a class="review-link catalogue-refine-link" href="#enrich">Refine (${catalog.rows.filter(row => !row.enrichment_complete || row.refinement_queued).length})</a>` : ""}</div></div><div class="toolbar"><input id="search" aria-label="Search polishes" placeholder="Find a brand or shade…"></div><div class="grid" id="library"></div>
      <div class="compare-bar" role="group" aria-label="Comparison selection"${comparison.active ? '' : ' hidden'}>
        <p id="compare-count" role="status"></p>
        <button type="button" id="compare-clear" class="secondary">Clear selection</button>
        <button type="button" id="compare-open">Compare selected</button>
      </div>`;
    const library = document.querySelector('#library');
    const modeButton = document.querySelector('#compare-mode');
    const bar = document.querySelector('.compare-bar');
    const count = document.querySelector('#compare-count');
    const clear = document.querySelector('#compare-clear');
    const open = document.querySelector('#compare-open');
    function updateComparison() {
      const size = comparison.ids.size;
      bar.hidden = !comparison.active;
      count.textContent = size ? `${size} selected` : 'Select at least 2 polishes';
      clear.disabled = size === 0;
      open.disabled = size < 2;
    }
    modeButton.onclick = () => {
      comparison.active = !comparison.active;
      if (!comparison.active) comparison.ids.clear();
      modeButton.setAttribute('aria-pressed', String(comparison.active));
      modeButton.textContent = comparison.active ? 'Exit Compare mode' : 'Compare mode';
      list();
      updateComparison();
    };
    library.onclick = event => {
      const button = event.target.closest('.compare-card-toggle');
      if (!button) return;
      const id = button.dataset.compareId;
      const selected = !comparison.ids.has(id);
      if (selected) comparison.ids.add(id);
      else comparison.ids.delete(id);
      button.setAttribute('aria-pressed', String(selected));
      button.closest('.polish-overview-card').classList.toggle('is-compared', selected);
      updateComparison();
    };
    clear.onclick = () => {
      comparison.ids.clear();
      list();
      updateComparison();
      modeButton.focus({ preventScroll: true });
    };
    open.onclick = () => {
      if (comparison.ids.size >= 2) location.hash = '#compare/' + [...comparison.ids].map(encodeURIComponent).join('/');
    };
    updateComparison();
    const brands = [...new Set(catalog.rows.map(row => row.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    document.querySelector('.toolbar').insertAdjacentHTML('beforeend', `<details class="brand-filter-menu"><summary aria-label="Filter by brand"><span id="brand-filter-label">All brands</span></summary><div class="brand-filter-options" role="group" aria-label="Choose brand"><button type="button" class="brand-filter-option" data-brand="" aria-pressed="true">All brands</button>${brands.map(brand => `<button type="button" class="brand-filter-option" data-brand="${escapeHtml(brand)}" aria-pressed="false">${brandMark(brand)} <span class="brand-filter-count">(${catalog.rows.filter(row => row.brand === brand).length})</span></button>`).join('')}</div></details><input type="hidden" id="brand-filter" value="">`);
    document.querySelector('.toolbar').insertAdjacentHTML('beforeend', `<select id="category-filter" aria-label="Filter polish category"><option value="">All categories</option>${Object.entries(catalog.categories).map(([id, label])=>`<option value="${escapeHtml(id)}">${escapeHtml(label)} (${catalog.rows.filter(r=>r.category===id).length})</option>`).join('')}</select>`);
    document.querySelector('.toolbar').insertAdjacentHTML('beforeend', '<select id="finish-class-filter" aria-label="Filter by finish classification"><option value="">All finish types</option><option value="plain">Plain</option><option value="specialty">Specialty</option><option value="neither">Neither</option></select>');
    document.querySelector('#search').placeholder = 'Find a brand, shade or tag…';
    document.querySelector('#library').insertAdjacentHTML('beforebegin', '<p id="result-count" class="muted" role="status" aria-live="polite"></p>');
    const tags = [...new Set(catalog.rows.flatMap(filterTags))].sort((a,b) => a.localeCompare(b));
    const tagCounts = new Map(tags.map(tag => [tag, catalog.rows.filter(row => filterTags(row).includes(tag)).length]));
    tags.sort((a, b) => tagCounts.get(b) - tagCounts.get(a) || a.localeCompare(b));
    const toolbar = document.querySelector('.toolbar');
    toolbar.insertAdjacentHTML('beforeend', `<details class="tag-filters"${overviewState.tagsOpen ? ' open' : ''}><summary>Filter by tags <span id="tag-filter-count"></span></summary><div class="tag-match-mode" role="group" aria-label="Match selected tags"><span>Match selected tags</span><button type="button" class="tag-mode-button" data-mode="and" aria-pressed="${overviewState.tagMode === 'and'}" title="Match all selected tags">AND</button><button type="button" class="tag-mode-button" data-mode="or" aria-pressed="${overviewState.tagMode === 'or'}" title="Match any selected tag">OR</button></div><div class="tag-legend" aria-label="Tag colour key"><span class="tag-group-colour">Colour</span><span class="tag-group-finish">Finish / effect</span><span class="tag-group-role">Product role</span><span class="tag-group-context">Collection / context</span></div><div class="tag-filter-options">${tags.map(tag => `<button type="button" class="tag-filter tag-group-${tagGroup(tag)}" title="${tagGroup(tag) === 'context' ? 'Collection / context' : tagGroup(tag)}" data-tag="${escapeHtml(tag)}" aria-pressed="${overviewState.tags.has(tag)}">${tagColourDot(tag)}${tagLabel(tag)} (${tagCounts.get(tag)})</button>`).join('')}</div><button type="button" class="secondary clear-tag-filters">Clear tags</button></details>`);
    const tagFilters = toolbar.querySelector('.tag-filters');
    const tagSummary = tagFilters.querySelector('summary');
    tagFilters.addEventListener('toggle', () => { overviewState.tagsOpen = tagFilters.open; });
    // Animate the actual layout change rather than flex-basis across a wrapping row.
    tagSummary.addEventListener('click', event => {
      if (typeof document.startViewTransition !== 'function'
          || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      event.preventDefault();
      if (tagFilters.dataset.transitioning === 'true') return;
      tagFilters.dataset.transitioning = 'true';
      const transition = document.startViewTransition(() => {
        tagFilters.open = !tagFilters.open;
        overviewState.tagsOpen = tagFilters.open;
      });
      transition.finished.finally(() => { delete tagFilters.dataset.transitioning; });
    });
    function list() {
      const query = normalizePolishQuery(document.querySelector('#search').value.trim());
      const brand = document.querySelector('#brand-filter').value;
      const category = document.querySelector('#category-filter').value;
      const finishClass = document.querySelector('#finish-class-filter').value;
      const rows = catalog.rows.filter(r => (!brand || r.brand === brand) && (!category || r.category === category) && (!finishClass || polishFinishClasses(r).includes(finishClass)) && (!overviewState.tags.size || (overviewState.tagMode === 'or' ? [...overviewState.tags].some(tag => filterTags(r).includes(tag)) : [...overviewState.tags].every(tag => filterTags(r).includes(tag)))) && [r.brand,r.shade_name,categoryLabel(r),...filterTags(r),...filterTags(r).map(tag => tag.replace(/-/g, ' '))].join(' ').toLowerCase().includes(query));
      // AND counts describe the result of adding each tag to the current filters.
      const counts = overviewState.tagMode === 'and'
        ? new Map(tags.map(tag => [tag, rows.filter(row => filterTags(row).includes(tag)).length]))
        : tagCounts;
      const options = document.querySelector('.tag-filter-options');
      const focusedTag = options.contains(document.activeElement) ? document.activeElement : null;
      const buttons = [...options.querySelectorAll('.tag-filter')];
      buttons.sort((a, b) => counts.get(b.dataset.tag) - counts.get(a.dataset.tag) || a.dataset.tag.localeCompare(b.dataset.tag));
      for (const button of buttons) {
        const tag = button.dataset.tag;
        button.innerHTML = `${tagColourDot(tag)}${tagLabel(tag)} (${counts.get(tag)})`;
        options.appendChild(button);
      }
      focusedTag?.focus({ preventScroll: true });
      document.querySelector('#tag-filter-count').textContent = overviewState.tags.size ? `(${overviewState.tags.size} selected)` : '';
      document.querySelector('.clear-tag-filters').disabled = !overviewState.tags.size;
      document.querySelector('#result-count').textContent = `${rows.length} of ${catalog.rows.length} products`;
      document.querySelector('#library').innerHTML = rows.map(overviewCard).join('') || '<p>No polishes match these filters.</p>';
      bindUsedControls(document.querySelector('#library'));
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
    document.querySelector('#brand-filter').value = overviewState.brand;
    const brandMenu = document.querySelector('.brand-filter-menu');
    if (window.brandMenuAbort) window.brandMenuAbort.abort();
    const brandMenuAbort = new AbortController();
    window.brandMenuAbort = brandMenuAbort;
    const updateBrandMenu = () => {
      const selected = overviewState.brand;
      document.querySelector('#brand-filter-label').innerHTML = selected ? brandMark(selected) : 'All brands';
      brandMenu.querySelectorAll('.brand-filter-option').forEach(option => option.setAttribute('aria-pressed', String(option.dataset.brand === selected)));
    };
    brandMenu.querySelectorAll('.brand-filter-option').forEach(option => {
      option.onclick = () => {
        overviewState.brand = option.dataset.brand;
        document.querySelector('#brand-filter').value = overviewState.brand;
        updateBrandMenu();
        brandMenu.open = false;
        brandMenu.querySelector('summary').focus();
        list();
      };
    });
    document.addEventListener('pointerdown', event => {
      if (brandMenu.open && !brandMenu.contains(event.target)) brandMenu.open = false;
    }, { signal: brandMenuAbort.signal });
    brandMenu.addEventListener('keydown', event => {
      if (event.key === 'Escape' && brandMenu.open) {
        brandMenu.open = false;
        brandMenu.querySelector('summary').focus();
        event.preventDefault();
      }
    });
    updateBrandMenu();
    document.querySelector('#category-filter').value = overviewState.category;
    document.querySelector('#finish-class-filter').value = overviewState.finishClass;
    document.querySelectorAll('.tag-filter').forEach(button => { button.onclick = event => {
      const tag = button.dataset.tag;
      const activating = !overviewState.tags.has(tag);
      if (activating) overviewState.tags.add(tag); else overviewState.tags.delete(tag);
      button.setAttribute('aria-pressed', String(activating));
      if (activating && tag === 'glitter') burstHoloGlitter(button, event);
      list();
    }; });
    document.querySelector('.clear-tag-filters').onclick = () => {
      tagSummary.focus({ preventScroll: true });
      overviewState.tags.clear();
      document.querySelectorAll('.tag-filter').forEach(button => button.setAttribute('aria-pressed', 'false'));
      list();
    };
    list();
    document.querySelector('#search').oninput = () => { overviewState.search = document.querySelector('#search').value; list(); };
    document.querySelector('#category-filter').onchange = () => { overviewState.category = document.querySelector('#category-filter').value; list(); };
    document.querySelector('#finish-class-filter').onchange = () => { overviewState.finishClass = document.querySelector('#finish-class-filter').value; list(); };
    const restoreY = overviewState.scrollY;
    requestAnimationFrame(() => { if (!location.hash || location.hash === '#') window.scrollTo({ top: restoreY, behavior: 'instant' }); });
    return;
  }
  if (publicMode) { renderPublicPolish(row); return; }
  current = {...row};
  app.innerHTML = `<a href="#">← All polishes</a><p class="tag">${brandMark(row.brand)}</p><h1>${escapeHtml(row.shade_name)}</h1><p><a class="review-link" href="#enrich/${encodeURIComponent(row.id)}">✎ Edit polish</a></p><p class="muted">${escapeHtml([row.color_family,row.finish,row.role].filter(Boolean).join(' · ').replace(/-/g, ' '))}</p><p>Color in use: <strong id="effective"></strong></p>${gallery(row)}<div class="grid">${reference('manufacturer','Manufacturer reference','A listed hex or a sample from a manufacturer picture.')}${reference('personal','Your manicure / swatch','Sample a nail in your own photo, in the lighting you prefer.')}<section class="card"><h2>Your override</h2><p class="muted">Fine-tune the color used for this polish.</p><div id="override-preview" class="swatch"></div><label for="override_hex">Hex</label><input id="override_hex" placeholder="#735A91" maxlength="7"><label for="hue">Hue <output id="hue-value"></output></label><input type="range" id="hue" min="0" max="360" value="280"><label for="saturation">Saturation <output id="saturation-value"></output></label><input type="range" id="saturation" min="0" max="100" value="40"><label for="lightness">Lightness <output id="lightness-value"></output></label><input type="range" id="lightness" min="0" max="100" value="50"><button id="clear" class="secondary">Clear override</button></section></div><button id="save">Save colors</button><p id="status" role="status" aria-live="polite">Saved colors load from the JSON record. Changes are saved with the button above.</p><p class="muted">A single hex is a representative color; shimmer, transparency and magnetic effects vary with lighting. Photo samples are estimates.</p>`;
  app.querySelector('h1').insertAdjacentHTML('afterend', categoryBadge(row) + polishTags(row.tags) + swatch(effective(current), 'product-swatch', current) + usedControl(row));
  bindUsedControls();
  enhancePolishDetail(row);
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
  const detailHero = app.querySelector('.polish-detail-hero');
  if (!hasBottle || !hasNail) {
    if (detailHero) detailHero.insertAdjacentElement('afterend', editor);
    else if (references) references.insertAdjacentElement('afterend', editor);
  }
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
function enhancePolishDetail(row) {
  // Keep existing editor controls and event handlers intact; only reorganize the header.
  const heading = app.querySelector('h1');
  const preview = app.querySelector('.product-swatch');
  if (!heading || !preview) return;
  const back = app.querySelector('a[href="#"]');
  const hero = document.createElement('section');
  hero.className = 'polish-detail-hero';
  const information = document.createElement('div');
  information.className = 'polish-detail-information';
  const visual = document.createElement('div');
  visual.className = 'polish-detail-visual';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'polish-detail-eyebrow';
  eyebrow.textContent = 'THE POLISH FILE';
  information.append(eyebrow);
  const brand = heading.previousElementSibling;
  if (brand?.classList.contains('tag')) information.append(brand);
  information.append(heading);
  const badge = app.querySelector('.category-badge');
  if (badge) information.append(badge);
  const tags = app.querySelector('.polish-tags');
  if (tags) information.append(tags);
  const used = app.querySelector('.used-control');
  if (used) information.append(used);
  const edit = [...app.querySelectorAll('a.review-link')].find(link => link.hash.startsWith('#enrich/'));
  if (edit?.parentElement?.tagName === 'P') information.append(edit.parentElement);
  const meta = [...app.children].find(node => node.classList?.contains('muted') && node.tagName === 'P');
  if (meta) information.append(meta);
  const effectiveLabel = [...app.children].find(node => node.tagName === 'P' && /colou?r in use:/i.test(node.textContent));
  if (effectiveLabel) information.append(effectiveLabel);
  const gallerySection = app.querySelector('.references');
  if (gallerySection) {
    gallerySection.classList.add('polish-detail-gallery');
    visual.append(gallerySection);
  }
  const colourStrip = document.createElement('div');
  colourStrip.className = 'polish-detail-colour-strip';
  visual.append(colourStrip);
  colourStrip.append(preview);
  const caption = document.createElement('p');
  caption.className = 'polish-detail-preview-caption';
  caption.textContent = 'Illustrative colour preview · appearance changes with lighting and finish';
  colourStrip.append(caption);
  hero.append(information, visual);
  if (back) {
    back.classList.add('polish-detail-back');
    back.insertAdjacentElement('afterend', hero);
  } else app.prepend(hero);
  app.classList.add('polish-detail-page');
}
function renderPublicPolish(row) {
    current = null;
    app.innerHTML = `<a href="#">← All polishes</a><p class="tag">${brandMark(row.brand)}</p><h1>${escapeHtml(row.shade_name)}</h1>${categoryBadge(row)}${polishTags(row.tags)}<p class="muted">${escapeHtml([row.color_family, row.finish, row.role].filter(Boolean).join(' · ').replace(/-/g, ' '))}</p>${swatch(effective(row), 'product-swatch', row)}<p>Colour in use: ${escapeHtml(displayLabel(row))}</p>${gallery(row)}<div class="grid">${['manufacturer', 'personal', 'override'].map(type => `<section class="card"><h2>${escapeHtml({manufacturer:'Manufacturer reference', personal:'Personal reference', override:'User override'}[type])}</h2>${swatch(row[type + '_hex'], 'small-swatch')}<p>${escapeHtml(row[type + '_hex'] || 'Not recorded')}</p></section>`).join('')}</div><p class="muted">Colour and finish previews are illustrative. </p><p><a href="../colour-lab/">Explore colour combinations →</a></p>`;
    enhancePolishDetail(row);
    for (const image of app.querySelectorAll('.photo-grid img')) {
        image.onerror = () => {
            image.hidden = true;
            image.closest('figure').querySelector('.photo-error').hidden = false;
        };
    }
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
window.addEventListener('hashchange',event=>{if(dirty){if(!confirm('Leave and discard unsaved changes?')){history.replaceState(null,'',event.oldURL);return;}if (typeof enrichmentDrafts !== 'undefined') enrichmentDrafts.clear();}render();});
load().catch(error=>app.textContent=error.message);
