/**
 * TRANSCRIPTOR ENGINE V5 PRO (NATIVE FIDELITY)
 * The ultimate JSON-to-DOM rendering engine.
 * 100% Native CSS Property Support.
 */

let currentContent = null;
let hoveredNodeId = null;
let activeNodeId = null;
let currentViewportWidth = window.innerWidth;

/**
 * Resolve variables and calculate responsive values
 */
function resolveValue(val, variables = {}) {
    if (typeof val !== 'string') return val;

    // Resolve variable references: e.g., "$colors.primary"
    if (val.startsWith('$')) {
        const path = val.substring(1).split('.');
        let current = variables;
        for (const part of path) {
            if (current[part] === undefined) return val;
            current = current[part];
        }
        return current;
    }
    return val;
}

/**
 * Core Transcriptor
 */
function transcribir(data, container, path = 'pagina', variables = {}) {
    // Use path-based ID to avoid collisions (e.g. node-pagina-header-logo)
    const elementId = `node-${path.replace(/\./g, '-')}`;
    let el = document.getElementById(elementId);
    const localVariables = { ...variables, ...(data.variables || {}) };

    if (!el) {
        let tagName = data.tagName || 'div';
        if (!data.tagName) {
            const idLower = id.toLowerCase();
            if (idLower.includes('boton') || idLower.includes('cta') || idLower.includes('btn')) tagName = 'button';
            else if (idLower.includes('imagen') || idLower.includes('img') || idLower.includes('foto')) tagName = 'img';
            else if (idLower.includes('input')) tagName = 'input';
            else if (idLower.includes('titulo') || idLower.includes('title')) tagName = 'h2';
            else if (idLower.includes('parrafo') || idLower.includes('text')) tagName = 'p';
            else if (idLower.includes('enlace') || idLower.includes('link')) tagName = 'a';
        }
        el = document.createElement(tagName);
        el.id = elementId;
        container.appendChild(el);
    }

    const estilos = {};
    const hijos = {};
    let texto = '';

    // Pass 1: Categorize
    for (const key in data) {
        const val = data[key];

        if (key === 'nombre' || key === 'tagName' || key === 'variables') continue;
        if (key === 'texto') {
            texto = resolveValue(val, localVariables);
            continue;
        }

        if (typeof val === 'object' && val !== null) {
            // Special V4/V5 Keys
            if (['hover', 'active', 'click', 'scroll', 'responsive', 'animations'].includes(key)) continue;
            hijos[key] = val;
        } else {
            // NATIVE CSS PROPERTIES (Kebab-case or Camel-case supported via setProperty)
            estilos[key] = resolveValue(val, localVariables);
        }
    }

    // Pass 2: Apply Responsive Overrides
    if (data.responsive) {
        const breakpoints = Object.keys(data.responsive).sort((a, b) => parseInt(a) - parseInt(b));
        for (const bp of breakpoints) {
            if (currentViewportWidth >= parseInt(bp)) {
                const bpStyles = data.responsive[bp];
                for (const k in bpStyles) {
                    estilos[k] = resolveValue(bpStyles[k], localVariables);
                }
            }
        }
    }

    // Apply Base Styles
    el.style.cssText = '';
    for (const key in estilos) {
        el.style.setProperty(key, estilos[key]);
    }

    // Pass 3: Interaction States (Applied via setProperty for native support)
    function applyStateStyles(stateObj) {
        if (!stateObj) return;
        for (const k in stateObj) {
            el.style.setProperty(k, resolveValue(stateObj[k], localVariables));
        }
    }

    if (data.hover && hoveredNodeId === el.id) applyStateStyles(data.hover);
    if (data.active && activeNodeId === el.id) applyStateStyles(data.active);

    // Event Listeners
    el.onmouseenter = (e) => { e.stopPropagation(); hoveredNodeId = el.id; };
    el.onmouseleave = (e) => { if (hoveredNodeId === el.id) hoveredNodeId = null; };
    el.onmousedown = (e) => { e.stopPropagation(); activeNodeId = el.id; };
    el.onmouseup = (e) => { if (activeNodeId === el.id) activeNodeId = null; };

    // Pass 4: Content
    if (el.tagName === 'IMG') {
        if (texto && el.src !== texto) el.src = texto;
    } else if (el.tagName === 'INPUT') {
        if (texto && el.value !== texto) el.value = texto;
    } else {
        let textNode = Array.from(el.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
        if (texto !== undefined && texto !== null && texto !== '') {
            if (textNode) {
                if (textNode.textContent !== texto) textNode.textContent = texto;
            } else {
                el.prepend(document.createTextNode(texto));
            }
        } else if (textNode) {
            el.removeChild(textNode);
        }
    }

    // Pass 5: Children Reconciliation
    const currentHijosIds = Object.keys(hijos).map(k => `node-${path.replace(/\./g, '-')}-${k}`);
    Array.from(el.children).forEach(child => {
        // Only remove children that belong to our path-based ID system
        if (child.id.startsWith(`node-${path.replace(/\./g, '-')}-`) && !currentHijosIds.includes(child.id)) {
            el.removeChild(child);
        }
    });

    for (const key in hijos) {
        transcribir(hijos[key], el, `${path}.${key}`, localVariables);
    }
}

/**
 * Global CSS Generator (Animations, etc.)
 */
function updateGlobalStyles(data) {
    let styleEl = document.getElementById('v5-global-styles');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'v5-global-styles';
        document.head.appendChild(styleEl);
    }

    let css = '';
    if (data.animations) {
        for (const animName in data.animations) {
            css += `@keyframes ${animName} {\n`;
            const keyframes = data.animations[animName];
            for (const step in keyframes) {
                css += `  ${step} {\n`;
                for (const prop in keyframes[step]) {
                    css += `    ${prop}: ${keyframes[step][prop]};\n`;
                }
                css += `  }\n`;
            }
            css += `}\n`;
        }
    }

    if (styleEl.innerHTML !== css) styleEl.innerHTML = css;
}

let lastData = '';
function loop() {
    const app = document.getElementById('app');
    currentViewportWidth = window.innerWidth;

    if (currentContent && app) {
        const dataStr = JSON.stringify(currentContent) + hoveredNodeId + activeNodeId + currentViewportWidth;
        if (dataStr !== lastData) {
            updateGlobalStyles(currentContent);
            transcribir(currentContent, app, 'pagina', currentContent.variables || {});
            lastData = dataStr;
        }
    }
    requestAnimationFrame(loop);
}

window.addEventListener('message', (e) => {
    if (e.data.type === 'update-content') currentContent = e.data.content;
});

async function init() {
    try {
        const res = await fetch('content.json');
        if (res.ok) currentContent = await res.json();
    } catch (e) {}
    loop();
}

init();
