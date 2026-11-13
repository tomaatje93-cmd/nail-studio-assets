(() => {

    // Apply the stored palette before navigation loads; invalid storage is harmless.
    const themeKey = 'nail-studio-theme';
    const themes = ['default', 'forge-amethyst'];
    let savedTheme = 'default';
    try {
        savedTheme = localStorage.getItem(themeKey) || 'default';
    } catch (_) {
        // Browsing remains functional when storage is disabled.
    }
    if (!themes.includes(savedTheme)) savedTheme = 'default';
    const applyTheme = theme => {
        if (theme === 'default') document.documentElement.removeAttribute('data-studio-theme');
        else document.documentElement.dataset.studioTheme = theme;
    };
    applyTheme(savedTheme);
    const picker = document.createElement('div');
    picker.className = 'studio-theme-picker';
    const label = document.createElement('label');
    label.textContent = 'Theme';
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Nail Studio theme');
    for (const [value, title] of [['default', 'Original violet'], ['forge-amethyst', 'Forge & Amethyst']]) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = title;
        select.append(option);
    }
    select.value = savedTheme;
    select.addEventListener('change', () => {
        applyTheme(select.value);
        try { localStorage.setItem(themeKey, select.value); } catch (_) { /* Session-only selection. */ }
    });
    picker.append(label, select);
    for (const header of document.querySelectorAll('.studio-header')) header.append(picker.cloneNode(true));
    // Bind each cloned selector independently, including pages with multiple headers.
    for (const header of document.querySelectorAll('.studio-header')) {
        const control = header.querySelector('.studio-theme-picker select');
        if (!control) continue;
        control.value = savedTheme;
        control.addEventListener('change', () => {
            applyTheme(control.value);
            try { localStorage.setItem(themeKey, control.value); } catch (_) { /* Session-only selection. */ }
            for (const other of document.querySelectorAll('.studio-theme-picker select')) other.value = control.value;
        });
    }
    const script = document.currentScript;
    const root = new URL('./', script.src);
    fetch(new URL('site-pages.json', root))
        .then(response => {
            if (!response.ok) throw new Error('Navigation unavailable');
            return response.json();
        })
        .then(manifest => {
            const publicMode = document.body.dataset.catalogueMode === 'public';
            const pages = manifest.pages.filter(page => !publicMode || page.public === true);
            const included = new Set(pages.map(page => page.id));
            for (const link of document.querySelectorAll('[data-site-page]')) {
                if (!included.has(link.dataset.sitePage)) link.remove();
            }
            for (const nav of document.querySelectorAll('.studio-nav')) {
                const links = pages.map(page => {
                    const link = document.createElement('a');
                    const url = new URL(page.path, root);
                    link.href = url.href;
                    link.textContent = page.label;
                    link.dataset.sitePage = page.id;
                    if (url.pathname === location.pathname) link.setAttribute('aria-current', 'page');
                    return link;
                });
                nav.replaceChildren(...links);
            }
        })
        .catch(() => {
            // Keep the HTML navigation usable when the manifest cannot be loaded.
        });
})();
