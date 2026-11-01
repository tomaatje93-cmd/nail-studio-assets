const $ = id => document.getElementById(id);
let items = [], base = null, mode = 'Similar', picked = [];
const modes = ['Similar', 'Contrast', 'Tonal', 'Accent', 'Stamping'];
const hexOK = h => /^#[0-9a-f]{6}$/i.test(h || '');

function lab(hex) {
    const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    const l = .4122214708 * rgb[0] + .5363325363 * rgb[1] + .0514459929 * rgb[2],
        m = .2119034982 * rgb[0] + .6806995451 * rgb[1] + .1073969566 * rgb[2],
        s = .0883024619 * rgb[0] + .2817188376 * rgb[1] + .6299787005 * rgb[2];
    const a = Math.cbrt(l), b = Math.cbrt(m), c = Math.cbrt(s);
    return [.2104542553 * a + .793617785 * b - .0040720468 * c, 1.9779984951 * a - 2.428592205 * b + .4505937099 * c, .0259040371 * a + .7827717662 * b - .808675766 * c]
}

function distance(a, b) {
    return Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]))
}

function hue(h) {
    const [, a, b] = lab(h);
    return Math.atan2(b, a)
}

function angle(a, b) {
    const d = Math.abs(hue(a) - hue(b));
    return Math.min(d, Math.PI * 2 - d)
}

function flags(p) {
    const v = (p.finish + ' ' + p.tags).toLowerCase();
    return {
        stamp: /stamping/.test(v),
        effect: /metallic|glitter|holo|shimmer|magnetic|flakie|multichrome|chrome/.test(v),
        topper: /topper|layering|top coat|topcoat/.test(v),
        sheer: /jelly|sheer|transparent/.test(v),
        magnetic: /magnetic/.test(v),
        multi: /multichrome|color.shifting|colour.shifting/.test(v)
    }
}

function chroma(p) {
    const [, a, b] = lab(p.hex);
    return Math.hypot(a, b)
}

function selectRecipe(type, pool) {
    const ranked = (fn, exclude = []) => pool.filter(p => !exclude.includes(p.id)).sort((a, b) => fn(a) - fn(b))[0];
    const d = p => distance(base.hex, p.hex), hd = p => angle(base.hex, p.hex),
        ld = p => Math.abs(lab(base.hex)[0] - lab(p.hex)[0]);
    const primary = ranked(p => type === 'Complementary' ? Math.abs(hd(p) - Math.PI) * .7 + ld(p) * .15 : type === 'Dramatic' ? -ld(p) * 1.2 + hd(p) * .08 : type === 'Metallic' ? (flags(p).effect ? 0 : 2) + hd(p) * .08 : type === 'Tonal' ? hd(p) * .6 + Math.abs(ld(p) - .15) : d(p));
    if (!primary) return [];
    const second = ranked(p => {
        const f = flags(p);
        const gap = distance(primary.hex, p.hex);
        if (type === 'Metallic') return (f.effect ? 0 : 1.5) + Math.abs(gap - .16);
        if (type === 'Subtle') return d(p) * .7 + gap * .3 + (f.magnetic || f.multi ? .1 : 0);
        if (type === 'Dramatic') return -(ld(p) + gap) * .5;
        if (type === 'Complementary') return Math.abs(hd(p) - Math.PI) * .4 + gap * .3;
        return hd(p) * .6 + Math.abs(ld(p) - .25)
    }, [primary.id]);
    return [primary, second].filter(Boolean)
}

function renderRecipes(pool) {
    $('recipes').replaceChildren();
    if (!hexOK(base.hex)) {
        const p = document.createElement('p');
        p.className = 'muted';
        p.textContent = 'This polish needs a colour reference before palettes can be generated.';
        $('recipes').append(p);
        return
    }
    const definitions = [['Subtle', 'Close shades with gentle variation'], ['Tonal', 'Same hue family, varied depth'], ['Dramatic', 'Strong lightness contrast'], ['Complementary', 'Opposing colour-wheel hues'], ['Metallic', 'Effect finishes as accents']];
    definitions.forEach(([type, desc]) => {
        const selection = selectRecipe(type, pool), palette = [base, ...selection];
        if (selection.length < 2) return;
        const card = document.createElement('div');
        card.className = 'recipe';
        const h = document.createElement('h3');
        h.textContent = type;
        const p = document.createElement('p');
        p.textContent = desc;
        const strip = document.createElement('div');
        strip.className = 'palette';
        palette.forEach(item => {
            const tile = document.createElement('div');
            swatch(tile, item.hex);
            tile.title = item.brand + ' — ' + item.name;
            strip.append(tile)
        });
        const names = document.createElement('p');
        names.textContent = selection.map(x => x.name).join(' + ');
        const button = document.createElement('button');
        button.textContent = 'Use this palette';
        button.onclick = () => {
            picked = selection.map(x => x.id);
            render()
        };
        card.append(h, p, strip, names, button);
        $('recipes').append(card)
    })
}

function score(p) {
    const d = distance(base.hex, p.hex), hd = angle(base.hex, p.hex), l = Math.abs(lab(base.hex)[0] - lab(p.hex)[0]);
    if (mode === 'Similar') return d;
    if (mode === 'Contrast') return -d;
    if (mode === 'Tonal') return hd * 0.3 + l * .2;
    if (mode === 'Accent') return (flags(p).effect ? 0 : 2) + (flags(p).topper ? .25 : 0) + hd * .2;
    if (mode === 'Stamping') return (flags(p).stamp ? 0 : 5) - l;
    return d
}

function swatch(el, hex) {
    el.style.background = hex || 'repeating-linear-gradient(45deg,#302738,#302738 9px,#44364d 9px,#44364d 18px)'
}

function render() {
    base = items.find(p => p.id === $('base').value) || items[0];
    if (!base) return;
    swatch($('baseSwatch'), base.hex);
    $('baseInfo').textContent = base.brand + ' · ' + base.name + ' · ' + (base.finish || 'Finish unrecorded') + ' · ' + (base.hex || 'No colour reference');
    $('modes').innerHTML = '';
    modes.forEach(m => {
        const b = document.createElement('button');
        b.textContent = m;
        b.className = mode === m ? 'active' : '';
        b.onclick = () => {
            mode = m;
            render()
        };
        $('modes').append(b)
    });
    const available = items.filter(p => p.id !== base.id && hexOK(p.hex));
    renderRecipes(available);
    const matches = hexOK(base.hex) ? available.sort((a, b) => score(a) - score(b)).slice(0, +$('count').value) : [];
    $('total').textContent = '(' + matches.length + ')';
    $('results').replaceChildren();
    matches.forEach(p => {
        const card = document.createElement('div');
        card.className = 'result';
        const chip = document.createElement('div');
        chip.className = 'chip';
        swatch(chip, p.hex);
        const name = document.createElement('strong');
        name.textContent = p.name;
        const detail = document.createElement('small');
        detail.textContent = p.brand + ' · ' + (p.finish || p.family || 'Unknown finish');
        const btn = document.createElement('button');
        btn.textContent = picked.includes(p.id) ? 'Remove from palette' : 'Add to palette';
        btn.onclick = () => {
            picked = picked.includes(p.id) ? picked.filter(id => id !== p.id) : [...picked, p.id];
            render()
        };
        card.append(chip, name, detail, btn);
        $('results').append(card)
    });
    const palette = [base, ...picked.map(id => items.find(p => p.id === id)).filter(Boolean)];
    $('palette').replaceChildren();
    palette.forEach(p => {
        const div = document.createElement('div');
        swatch(div, p.hex);
        div.title = p.brand + ' ' + p.name;
        $('palette').append(div)
    });
    $('paletteNames').textContent = palette.map(p => p.name).join(' + ');
    $('status').textContent = items.length + ' catalogue entries · ' + items.filter(p => hexOK(p.hex)).length + ' with colour references. Polishes without hex references are excluded from automated ranking.'
}

function options() {
    const q = $('find').value.toLowerCase();
    const found = items.filter(p => (p.brand + ' ' + p.name).toLowerCase().includes(q));
    const current = base?.id || $('base').value;
    $('base').replaceChildren();
    found.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.brand + ' — ' + p.name + (!hexOK(p.hex) ? ' (no hex)' : '');
        $('base').append(opt)
    });
    $('base').value = found.some(p => p.id === current) ? current : found[0]?.id || '';
    render()
}

$('find').oninput = options;
$('base').onchange = () => {
    picked = [];
    render()
};
$('count').onchange = render;
$('copy').onclick = async () => {
    const palette = [base, ...picked.map(id => items.find(p => p.id === id)).filter(Boolean)];
    const text = palette.map(p => p.brand + ' — ' + p.name).join('\n');
    try {
        await navigator.clipboard.writeText(text);
        $('status').textContent = 'Palette copied.'
    } catch {
        $('status').textContent = 'Clipboard unavailable. Palette: ' + text.replaceAll('\n', '; ')
    }
};
fetch('../catalogue-snapshot.json').then(r => {
    if (!r.ok) throw Error('HTTP ' + r.status);
    return r.json()
}).then(snapshot => {
    items = Object.values(snapshot.records.polish || {}).filter(r => r.data?.status === 'owned').map(r => ({
        id: r.id,
        brand: r.data.brand || 'Unspecified',
        name: r.data.shade_name || r.name,
        hex: [r.data.override_hex, r.data.personal_hex, r.data.manufacturer_hex].find(hexOK) || '',
        family: r.data.color_family || '',
        finish: r.data.finish || '',
        tags: (r.tags || []).join(' ')
    }));
    items.sort((a, b) => (a.brand + ' ' + a.name).localeCompare(b.brand + ' ' + b.name));
    $('find').value = '';
    options();
    const suggested = items.find(p => p.name === 'Lo-fi Lavender' && hexOK(p.hex)) || items.find(p => hexOK(p.hex));
    if (suggested) {
        $('base').value = suggested.id;
        render()
    }
}).catch(e => {
    $('status').textContent = 'Could not load catalogue: ' + e.message
});
