function parseMarkdown(markdown) {
    let rawMarkdown = markdown;

    // 1. Normalizza la sintassi LaTeX delle AI
    rawMarkdown = rawMarkdown.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
    rawMarkdown = rawMarkdown.replace(/\\\((.*?)\\\)/g, '$$$1$$');

    // 2. Estrai i blocchi matematici
    const mathBlocks = [];
    rawMarkdown = rawMarkdown.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
        mathBlocks.push({ type: 'display', math: math });
        return `%%MATH_BLOCK_${mathBlocks.length - 1}%%`;
    });
    rawMarkdown = rawMarkdown.replace(/\$(.*?)\$/g, (match, math) => {
        mathBlocks.push({ type: 'inline', math: math });
        return `%%MATH_INLINE_${mathBlocks.length - 1}%%`;
    });

    // 3. Rendering Markdown
    let html = rawMarkdown;
    try {
        html = marked.parse(rawMarkdown, { gfm: true, breaks: true });
    } catch(e) {
        console.warn("Markdown parsing error", e);
    }

    // 4. Sanitizzazione sicura
    try {
        html = DOMPurify.sanitize(html, {
            ADD_TAGS: ['svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'defs', 'marker', 'text', 'tspan', 'g', 'style'],
            ADD_ATTR: ['cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'rx', 'ry', 'd', 'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'transform', 'marker-end', 'marker-start', 'text-anchor', 'class', 'style', 'viewBox']
        });
    } catch(e) {}

    // 5. Ripristina e compila la matematica con KaTeX
    html = html.replace(/%%MATH_(BLOCK|INLINE)_(\d+)%%/g, (match, type, index) => {
        const item = mathBlocks[index];
        if (!item) return match;
        const isDisplay = item.type === 'display';
        try {
            return katex.renderToString(item.math.trim(), {
                throwOnError: false,
                displayMode: isDisplay,
                strict: false
            });
        } catch (e) {
            return `<span style="color:red; font-family:monospace;">${item.math}</span>`;
        }
    });

    return html;
}

function updatePreview() {
    if (typeof getEditorContent === 'function') {
        updatePreviewWithContent(getEditorContent());
    }
}

// Cache reference to avoid DOM lookup on every keystroke
let _previewContentEl = null;

function updatePreviewWithContent(content) {
    if (!_previewContentEl) {
        _previewContentEl = document.getElementById('preview-content');
    }
    if (!_previewContentEl || !content) return;

    const html = parseMarkdown(content);

    // Iniezione nel DOM (uso requestAnimationFrame per performance)
    requestAnimationFrame(() => {
        _previewContentEl.innerHTML = html;
    });
}

