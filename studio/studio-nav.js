(() => {
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
