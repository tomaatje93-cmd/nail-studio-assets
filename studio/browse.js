const elements = {
    search: document.getElementById('search'),
    filter: document.getElementById('filter'),
    cards: document.getElementById('cards'),
    status: document.getElementById('status'),
};
const type = document.body.dataset.recordType;
let records = [];

function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
}

function image(url, caption) {
    const img = element('img', '', 'reference-image');
    img.src = url;
    img.alt = caption;
    img.loading = 'lazy';
    img.addEventListener('error', () => {
        img.replaceWith(element('p', 'Reference image unavailable.', 'hint'));
    }, { once: true });
    return img;
}

function productCard(record) {
    const card = element('article', '', 'browse-card');
    const data = record.data;
    const photo = data.images[0];
    if (photo) card.append(image(photo.url, photo.caption));
    card.append(element('h2', record.name));
    card.append(element('p', [data.brand, data.color_family, data.finish || 'Finish unconfirmed'].filter(Boolean).join(' · '), 'meta'));
    const hex = [data.override_hex, data.personal_hex, data.manufacturer_hex].find(value => /^#[0-9a-f]{6}$/i.test(value || ''));
    if (hex) {
        const chip = element('div', '', 'swatch-chip');
        chip.style.backgroundColor = hex;
        chip.setAttribute('role', 'img');
        chip.setAttribute('aria-label', `Approximate colour ${hex}`);
        card.append(chip);
    }
    if (photo) {
        card.append(element('p', photo.caption, 'hint'));
        if (/^https?:\/\//i.test(photo.source)) {
            const source = element('a', 'Image source');
            source.href = photo.source;
            source.rel = 'noreferrer';
            card.append(source);
        }
    }
    const lab = element('a', 'Explore colour combinations →');
    lab.href = '../colour-lab/';
    const action = element('p');
    action.append(lab);
    card.append(action);
    return card;
}

function plateCard(record) {
    const card = element('article', '', 'browse-card');
    const data = record.data;
    if (data.reference_image) card.append(image('../' + data.reference_image, record.name));
    card.append(element('h2', record.name));
    card.append(element('p', `${data.brand} · ${data.stamps.length} designs`, 'meta'));
    const designer = element('a', 'Open Stamp Designer →');
    designer.href = '../stamp-explorer/';
    card.append(designer);
    if (data.stamps.length) {
        const details = element('details');
        details.append(element('summary', 'Show individual designs'));
        const list = element('div', '', 'stamp-list');
        for (const stamp of data.stamps) {
            const figure = element('figure');
            figure.append(image('../' + stamp.image, stamp.title), element('figcaption', `${stamp.id} · ${stamp.title}`));
            list.append(figure);
        }
        details.append(list);
        card.append(details);
    }
    return card;
}

function render() {
    const query = elements.search.value.trim().toLowerCase();
    const filter = elements.filter.value;
    const found = records.filter(record => {
        const data = record.data;
        const text = [record.name, data.brand, data.color_family, data.finish, ...(record.tags || []),
            ...(data.stamps || []).flatMap(stamp => [stamp.title, ...(stamp.tags || [])])].join(' ').toLowerCase();
        const filterValues = type === 'polish' ? (data.finish || '').split(';') : [data.brand];
        return (!query || text.includes(query)) && (!filter || filterValues.includes(filter));
    });
    elements.cards.replaceChildren(...found.map(type === 'polish' ? productCard : plateCard));
    elements.status.textContent = `${found.length} of ${records.length} ${type === 'polish' ? 'polishes' : 'plates'}`;
    if (!found.length) elements.cards.append(element('p', 'No matches. Try another search or clear the filter.', 'hint'));
}

elements.search.addEventListener('input', render);
elements.filter.addEventListener('change', render);
fetch('../catalogue-snapshot.json')
    .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    })
    .then(snapshot => {
        records = Object.values(snapshot.records[type] || {}).sort((a, b) => a.name.localeCompare(b.name));
        const values = [...new Set(records.flatMap(record => type === 'polish'
            ? (record.data.finish || '').split(';') : [record.data.brand]))].filter(Boolean).sort();
        for (const value of values) {
            const option = element('option', value);
            option.value = value;
            elements.filter.append(option);
        }
        render();
    })
    .catch(error => {
        elements.status.textContent = `Could not load the collection: ${error.message}. Reload to retry.`;
    });
