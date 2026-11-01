const app = document.querySelector('#app');
const publicMode = document.body.dataset.catalogueMode === 'public';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title = p => `${p.brand} ${p.collection} ${p.plate_number}`;
const tags = input => input.value.split(',').map(s => s.trim()).filter(Boolean);
const img = (path, alt, cls = '') => `<img class="${cls}" src="${esc(path)}" alt="${esc(alt)}">`;
async function request(url, options) {
  if (publicMode) {
    const response = await fetch('catalogue.json');
    if (!response.ok) throw new Error('Cannot load plates. Reload to retry.');
    const data = await response.json();
    const id = new URL(url, location.href).searchParams.get('id');
    if (!id) return data;
    const plate = data.plates.find(plate => plate.id === id);
    if (!plate) throw new Error('Plate not found. Return to the plate overview.');
    return {plate};
  }
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
async function start() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) {
    const {plates} = await request('api.php');
    app.innerHTML = '<h1>Stamping plates</h1><label for="search">Search plates and stamp motifs</label><input id="search" type="search" placeholder="Circuits, lettering, gaming…"><label for="card-size">Card size</label><select id="card-size"><option value="standard">Standard</option><option value="large">Large</option><option value="extra-large">Extra large</option></select><p id="count" role="status"></p><div class="grid" id="plates" data-card-size="standard"></div>';
    const render = () => {
      const q = document.querySelector('#search').value.toLowerCase();
      const found = plates.filter(p => JSON.stringify(p).toLowerCase().includes(q));
      document.querySelector('#count').textContent = `${found.length} plate(s)`;
      document.querySelector('#plates').innerHTML = found.map(p => `<a class="card" href="?id=${encodeURIComponent(p.id)}">${p.reference_image ? img(p.reference_image, title(p)) : ''}<h2>${esc(title(p))}</h2><p>${esc(p.status)} · ${p.stamps.length} stamps</p><p class="tag">${esc(p.tags.join(', '))}</p></a>`).join('');
    };
    document.querySelector('#card-size').addEventListener('change', event => {
      document.querySelector('#plates').dataset.cardSize = event.target.value;
    });
    document.querySelector('#search').addEventListener('input', render); render(); return;
  }
  let {plate: p, version} = await request(`api.php?id=${encodeURIComponent(id)}`);
  if (publicMode) { renderPublicPlate(p); return; }
  app.innerHTML = `<a href="?">← All plates</a><h1>${esc(title(p))}</h1>${p.reference_image ? img(p.reference_image, 'Plate-only reference', 'reference') : '<p>Reference image pending.</p>'}<form id="edit"><h2>Collection details</h2><label for="status">Ownership</label><select id="status">${['owned','wishlist','destashed'].map(s => `<option ${p.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select><label for="tags">Plate tags, separated by commas</label><input id="tags" value="${esc(p.tags.join(', '))}"><label for="notes">Plate notes</label><textarea id="notes">${esc(p.notes)}</textarea><h2>Stamp designs</h2><p class="muted">IDs describe reference positions, not manufacturer numbers. Each crop retains a complete pattern panel.</p><label for="stamp-search">Filter stamps by motif</label><input type="search" id="stamp-search"><p id="stamp-count" role="status"></p><div class="grid">${p.stamps.map((s, i) => `<section class="card stamp" data-index="${i}" id="${esc(s.id)}"><a href="#${esc(s.id)}">${esc(s.id)} · ${esc(s.position)}</a>${img(s.image, s.title)}<h3>${esc(s.title)}</h3><label for="tags-${i}">Tags, separated by commas</label><input id="tags-${i}" value="${esc(s.tags.join(', '))}"><label for="notes-${i}">Notes</label><textarea id="notes-${i}">${esc(s.notes)}</textarea></section>`).join('')}</div><button type="submit">Save plate and stamp details</button><p class="message" id="message" role="status"></p></form>`;
  const filter = () => {
    const q = document.querySelector('#stamp-search').value.toLowerCase();
    let count = 0;
    document.querySelectorAll('.stamp').forEach((el, i) => {
      const s = p.stamps[i];
      el.hidden = !`${s.id} ${s.title} ${s.position} ${document.querySelector(`#tags-${i}`).value} ${document.querySelector(`#notes-${i}`).value}`.toLowerCase().includes(q);
      if (!el.hidden) count++;
    });
    document.querySelector('#stamp-count').textContent = `${count} stamp(s)`;
  };
  document.querySelector('#stamp-search').addEventListener('input', filter); filter();
  document.querySelector('#edit').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button');
    const message = document.querySelector('#message'); button.disabled = true;
    try {
      const result = await request('api.php', {method:'POST', headers:{'Content-Type':'application/json','X-Plate-Editor':'1'}, body:JSON.stringify({id, version, status:document.querySelector('#status').value, tags:tags(document.querySelector('#tags')), notes:document.querySelector('#notes').value, stamps:p.stamps.map((s, i) => ({id:s.id, tags:tags(document.querySelector(`#tags-${i}`)), notes:document.querySelector(`#notes-${i}`).value}))})});
      version = result.version; p = result.plate;
      message.textContent = 'Saved locally. Commit and push to sync with GitHub.';
    } catch (error) { message.textContent = error.message; }
    finally { button.disabled = false; }
  });
}
function renderPublicPlate(plate) {
    app.innerHTML = `<a href="?">← All plates</a><h1>${esc(title(plate))}</h1>${plate.reference_image ? img(plate.reference_image, 'Plate-only reference', 'reference') : '<p>Reference image pending.</p>'}<p class="tag">${esc(plate.tags.join(', '))}</p><h2>Stamp designs</h2><p class="muted">IDs describe reference positions, not manufacturer numbers. Sizes are approximate. Save corrections through Nail Studio chat using plate ID: ${esc(plate.id)}.</p><p><a href="../stamp-explorer/">Open Stamp Designer →</a></p><label for="stamp-search">Filter stamps by motif</label><input type="search" id="stamp-search"><p id="stamp-count" role="status"></p><div class="grid" id="stamps"></div>`;
    const render = () => {
        const query = document.querySelector('#stamp-search').value.trim().toLowerCase();
        const stamps = plate.stamps.filter(stamp => [stamp.id, stamp.title, stamp.position, ...stamp.tags].join(' ').toLowerCase().includes(query));
        document.querySelector('#stamp-count').textContent = `${stamps.length} of ${plate.stamps.length} stamps`;
        document.querySelector('#stamps').innerHTML = stamps.map(stamp => `<section class="card stamp" id="${esc(stamp.id)}"><a href="#${esc(stamp.id)}">${esc(stamp.id)} · ${esc(stamp.position)}</a>${img(stamp.image, stamp.title)}<h3>${esc(stamp.title)}</h3><p>${esc(stamp.tags.join(', '))}</p></section>`).join('') || '<p>No designs match, or this plate has no separate crops.</p>';
    };
    document.querySelector('#stamp-search').addEventListener('input', render);
    render();
    const anchor = document.getElementById(location.hash.slice(1));
    if (anchor) anchor.scrollIntoView();
}
start().catch(error => { app.textContent = error.message; });
