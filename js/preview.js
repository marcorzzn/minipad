function updatePreview() {
    let rawMarkdown = document.getElementById('editor').value;

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
        if (typeof marked.parse === 'function') {
            html = marked.parse(rawMarkdown, { gfm: true, breaks: true });
        } else if (typeof marked === 'function') {
            html = marked(rawMarkdown, { gfm: true, breaks: true });
        }
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
            return katex.renderToString(item.math.trim(), { throwOnError: false, displayMode: isDisplay });
        } catch (e) {
            return match; 
        }
    });

    // 6. Iniezione nel DOM
    document.getElementById('preview-content').innerHTML = html;
}