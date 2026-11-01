const enrichmentDrafts = new Map();
let enrichmentScope = null;
let enrichmentQuery = '';
function renderEnrichment() {
  current = null;
  const batches = catalog.enrichmentBatches || [];
  if (enrichmentScope === null) enrichmentScope = batches.at(-1)?.id || 'missing';
  app.innerHTML = `<a href="#">← All polishes</a><h1>Enrich your polishes.</h1><p class="muted">Every field is optional. Add any references you have, or leave a polish unchanged for later research. Pictures use their original URLs.</p><div class="toolbar"><select id="enrichment-scope" aria-label="Choose a batch"><option value="missing">All polishes needing references</option><option value="all">All polishes</option>${batches.map(b=>`<option value="${escapeHtml(b.id)}">${escapeHtml(b.name)} (${b.ids.length})</option>`).join('')}</select><input id="enrichment-search" aria-label="Search enrichment list" placeholder="Find a brand or shade…"></div><p id="enrichment-status" role="status" aria-live="polite"></p><section aria-labelledby="enrichment-todo-title"><h2 id="enrichment-todo-title">To enrich</h2><div class="grid" id="enrichment-list"></div></section><section class="refinement-queue" aria-labelledby="refinement-queue-title"><h2 id="refinement-queue-title">Queued for further refinement</h2><p class="muted">Saved for the next refinement pass. You can keep editing these references or remove a polish from the queue.</p><div class="grid" id="refinement-queue-list"></div></section>`;
  const scope = document.querySelector('#enrichment-scope'); scope.value = enrichmentScope;
  const search = document.querySelector('#enrichment-search'); search.value = enrichmentQuery;
  scope.onchange = () => { enrichmentScope = scope.value; listEnrichment(); };
  search.oninput = () => { enrichmentQuery = search.value; listEnrichment(); };
  listEnrichment();
}
function listEnrichment() {
  const batch = (catalog.enrichmentBatches || []).find(b=>b.id===enrichmentScope);
  const rows = catalog.rows.filter(row=>{
    const refs = imageReferences[row.brand+'/'+row.shade_name]?.images || [];
    const inScope = batch ? batch.ids.includes(row.id) : enrichmentScope === 'all' || row.refinement_queued || enrichmentDrafts.has(row.id) || !row.swatch_or_product_url || !refs.length || !row.finish;
    return inScope && (row.brand+' '+row.shade_name).toLowerCase().includes(enrichmentQuery.trim().toLowerCase());
  });
  const cardHtml = row=>{
    const draft = enrichmentDrafts.get(row.id) || {};
    const finish = draft.finish ?? row.finish;
    const color = draft.color_family ?? row.color_family;
    return `<section class="card enrichment-card" data-polish-id="${escapeHtml(row.id)}"><span class="tag">${escapeHtml(row.brand || 'Brand unknown')}</span><h2><a href="#${key(row)}">${escapeHtml(row.shade_name)}</a></h2>${finishProductPhoto(row)}${swatch(effective(row),'small-swatch',{...row,finish,color_family:color})}<label>Product / manufacturer / retailer URL <input type="url" data-field="swatch_or_product_url" placeholder="Optional https://…" value="${escapeHtml(draft.swatch_or_product_url ?? row.swatch_or_product_url)}"></label><label>Direct picture URL <input type="url" data-field="reference_image_url" placeholder="Optional https://…jpg" value="${escapeHtml(draft.reference_image_url || '')}"></label><label>Colour family <select data-field="color_family"><option value="">Unknown / leave blank</option>${catalog.colorFamilies.map(c=>`<option${color===c?' selected':''}>${escapeHtml(c)}</option>`).join('')}</select></label><p class="muted">Finish — optional; select any that apply.</p><div class="finish-choices" role="group" aria-label="Finishes for ${escapeHtml(row.shade_name)}">${Object.entries(catalog.finishOptions).map(([value,label])=>`<button type="button" class="finish-choice" data-finish="${escapeHtml(value)}" aria-pressed="${finish.split(';').includes(value)}">${escapeHtml(label)}</button>`).join('')}</div><label>Extra details for research <textarea data-field="enrichment_note" rows="2" placeholder="Optional: bottle number, spelling, special effect…">${escapeHtml(draft.enrichment_note || '')}</textarea></label><button type="button" class="save-enrichment">${row.refinement_queued ? 'Save references' : 'Save references & queue'}</button>${row.refinement_queued ? '<button type="button" class="secondary remove-refinement">Remove from queue</button>' : ''}</section>`;
  };
  const waiting = rows.filter(row=>!row.refinement_queued);
  const queued = rows.filter(row=>row.refinement_queued);
  document.querySelector('#enrichment-todo-title').textContent = 'To enrich (' + waiting.length + ')';
  document.querySelector('#refinement-queue-title').textContent = 'Queued for further refinement (' + queued.length + ')';
  document.querySelector('#enrichment-list').innerHTML = waiting.map(cardHtml).join('') || '<p>No polishes waiting in this view.</p>';
  document.querySelector('#refinement-queue-list').innerHTML = queued.map(cardHtml).join('') || '<p>No polishes queued in this view yet.</p>';
  for (const card of app.querySelectorAll('.enrichment-card')) {
    const row = catalog.rows.find(r=>r.id===card.dataset.polishId);
    const searchQuery = [row.brand, row.shade_name].filter(Boolean).join(' ');
    card.querySelector('h2').insertAdjacentHTML('afterend', `<p><a href="https://www.google.com/search?q=${encodeURIComponent(searchQuery)}" target="_blank" rel="noopener" aria-label="${escapeHtml('Google '+searchQuery)}">Google ${escapeHtml(searchQuery)} ↗</a></p>`);
    const changed = (field,value) => { enrichmentDrafts.set(row.id,{...(enrichmentDrafts.get(row.id)||{}),[field]:value}); dirty=true; card.querySelector('.save-enrichment').disabled=false; };
    for (const input of card.querySelectorAll('[data-field]')) input.oninput = () => changed(input.dataset.field,input.value);
    for (const button of card.querySelectorAll('.finish-choice')) button.onclick = () => {
      button.setAttribute('aria-pressed',button.getAttribute('aria-pressed')!=='true');
      const finish = [...card.querySelectorAll('.finish-choice[aria-pressed="true"]')].map(b=>b.dataset.finish).join(';');
      changed('finish',finish);
      card.querySelector('.small-swatch').outerHTML = swatch(effective(row),'small-swatch',{...row,finish});
    };
    const photo=card.querySelector('.finish-photo img'); if(photo) photo.onerror=()=>{photo.hidden=true;card.querySelector('.photo-error').hidden=false;};
    const persist = async (remove = false) => {
      const controls=[...app.querySelectorAll('input,select,textarea,button')]; controls.forEach(c=>c.disabled=true);
      const status=document.querySelector('#enrichment-status'); status.textContent='Saving…';
      try {
        const draft=remove ? {} : {...enrichmentDrafts.get(row.id)};
        for(const field of ['swatch_or_product_url','reference_image_url']) if(field in draft) draft[field]=draft[field].trim();
        const response=await fetch('api.php',{method:'POST',headers:{'Content-Type':'application/json','X-Polish-Editor':'1'},body:JSON.stringify({id:row.id,version:catalog.version,...draft,refinement_queued:!remove})});
        const result=await response.json(); if(!response.ok) throw Error(result.error || 'Save failed.');
        catalog=result; imageReferences=result.imageReferences; if(!remove) enrichmentDrafts.delete(row.id);
        renderEnrichment(); document.querySelector('#enrichment-status').textContent=remove ? `Removed ${row.shade_name} from the queue. References and any unsaved edits are kept.` : `Saved ${row.shade_name} and queued for further refinement.`;
      } catch(error) {
        status.textContent=error.message; controls.forEach(c=>c.disabled=false);
      }
      dirty=enrichmentDrafts.size>0;
    };
    card.querySelector('.save-enrichment').onclick = () => persist();
    const remove = card.querySelector('.remove-refinement');
    if(remove) remove.onclick = () => persist(true);
  }
  dirty=enrichmentDrafts.size>0;
}
