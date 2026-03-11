async function updatePreview() {
            let rawMarkdown = document.getElementById('editor').value;

            // 1. Normalize Gemini LaTeX syntax to standard $ and $$
            rawMarkdown = rawMarkdown.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
            rawMarkdown = rawMarkdown.replace(/\\\((.*?)\\\)/g, '$$$1$$');

            // 2. Extract Math to prevent marked.js from destroying symbols (e.g. < to &lt;)
            const mathBlocks = [];
            // Extract Block Math $$...$$
            rawMarkdown = rawMarkdown.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
                mathBlocks.push({ type: 'display', math: math });
                return `%%MATH_BLOCK_${mathBlocks.length - 1}%%`;
            });
            // Extract Inline Math $...$
            rawMarkdown = rawMarkdown.replace(/\$(.*?)\$/g, (match, math) => {
                mathBlocks.push({ type: 'inline', math: math });
                return `%%MATH_INLINE_${mathBlocks.length - 1}%%`;
            });

            // 3. Parse Markdown
            let html = '';
            try {
                if (typeof marked.parse === 'function') {
                    html = marked.parse(rawMarkdown, { gfm: true, breaks: true });
                } else if (typeof marked === 'function') {
                    html = marked(rawMarkdown, { gfm: true, breaks: true });
                } else {
                    html = rawMarkdown;
                }
            } catch(e) {
                html = rawMarkdown;
            }

            // 4. Sanitize HTML
            html = DOMPurify.sanitize(html, {
                ADD_TAGS: ['svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'defs', 'marker', 'text', 'tspan', 'g', 'style'],
                ADD_ATTR: ['cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'rx', 'ry', 'd', 'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'transform', 'marker-end', 'marker-start', 'text-anchor', 'class', 'style', 'viewBox']
            });

            // 5. Restore and Render Math via KaTeX
            html = html.replace(/%%MATH_(BLOCK|INLINE)_(\d+)%%/g, (match, type, index) => {
                const item = mathBlocks[index];
                if (!item) return match;
                const isDisplay = item.type === 'display';
                try {
                    return katex.renderToString(item.math.trim(), { throwOnError: false, displayMode: isDisplay });
                } catch (e) {
                    return match; // Fallback
                }
            });

            document.getElementById('preview-content').innerHTML = html;

            // 6. Resilient Mermaid Initialization
            if (window.mermaid) {
                mermaid.initialize({ startOnLoad: false, suppressErrorRendering: true });
            }

            document.querySelectorAll('#preview-content .mermaid, #preview-content code.language-mermaid').forEach(async (element, index) => {
                // If it's a code block, grab the parent pre to inject the svg
                const isCodeBlock = element.tagName.toLowerCase() === 'code';
                const targetElement = isCodeBlock ? element.parentElement : element;

                const id = 'mermaid-' + index;
                const code = element.textContent.trim();

                if (!code) return; // Skip empty matches

                try {
                    if (window.mermaid) {
                        const result = await mermaid.render(id, code);
                        // Gestione retrocompatibile: v9 restituisce string, v10+ restituisce {svg: string}
                        const svgText = typeof result === 'string' ? result : (result && result.svg ? result.svg : '');
                        
                        const lowerSvg = svgText.toLowerCase();
                        if (!svgText || lowerSvg.includes('error-icon') || lowerSvg.includes('syntax error') || lowerSvg.includes('mermaid version')) {
                            targetElement.style.display = 'none';
                        } else {
                            targetElement.style.display = 'block'; // Restore visibility if it was hidden
                            targetElement.innerHTML = svgText;
                            targetElement.style.border = "none";
                            targetElement.style.background = "transparent";
                            targetElement.style.padding = "0";
                        }
                    } else {
                        targetElement.style.display = 'none';
                    }
                } catch (e) {
                    // Silent: hide the broken code block, show nothing
                    targetElement.style.display = 'none';
                }
            });

            // Cleanup: Mermaid 11.x can leave orphaned temporary error divs at the bottom of the body. 
            // We must completely REMOVE them from the DOM to avoid phantom whitespace at the bottom.
            setTimeout(() => {
                document.querySelectorAll('body > div[id^="dmermaid"]').forEach(el => el.remove());
            }, 100);
        }

        /* --- MENU TOGGLE HELPERS (position:fixed dropdowns need viewport coords) --- */
        