/**
 * NEXUS V6 ENGINE - THE REACTIVE TRANSCRIPTOR
 * Beyond Static. Beyond Imaginable.
 * A Living Design System powered by Native CSS + JSON.
 */

let currentContent = null;
let hoveredNodeId = null;
let activeNodeId = null;
let mouseX = 0, mouseY = 0;
let scrollY = 0;
let startTime = Date.now();

/**
 * META-SEEDS: Architectural Design Patterns
 * These are expanded into native CSS properties before rendering.
 */
const SEEDS = {
    "glass": {
        "backdrop-filter": "blur(20px) saturate(180%)",
        "background-color": "rgba(255, 255, 255, 0.05)",
        "border": "1px solid rgba(255, 255, 255, 0.1)",
        "box-shadow": "0 8px 32px 0 rgba(0, 0, 0, 0.37)"
    },
    "neo": {
        "background": "#e0e0e0",
        "box-shadow": "20px 20px 60px #bebebe, -20px -20px 60px #ffffff",
        "border-radius": "50px"
    },
    "cyber": {
        "background": "linear-gradient(45deg, #ff003c 0%, #00f0ff 100%)",
        "clip-path": "polygon(0% 0%, 100% 0%, 100% 75%, 75% 100%, 0% 100%)",
        "filter": "drop-shadow(0 0 10px #ff003c)"
    }
};

/**
 * RESOLUTION ENGINE
 */
function resolveValue(val, variables = {}) {
    if (typeof val !== 'string') return val;

    // 1. Resolve $variables
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
 * CORE TRANSCRIPTOR V6
 */
function transcribir(data, container, path = 'pagina', variables = {}) {
    const elementId = `node-${path.replace(/\./g, '-')}`;
    let el = document.getElementById(elementId);
    const localVariables = { ...variables, ...(data.variables || {}) };

    if (!el) {
        let tagName = data.tagName || 'div';
        if (!data.tagName) {
            const idLower = path.toLowerCase();
            if (idLower.includes('boton') || idLower.includes('cta')) tagName = 'button';
            else if (idLower.includes('imagen') || idLower.includes('img')) tagName = 'img';
            else if (idLower.includes('titulo')) tagName = 'h2';
            else if (idLower.includes('parrafo')) tagName = 'p';
            else if (idLower.includes('enlace')) tagName = 'a';
        }
        el = document.createElement(tagName);
        el.id = elementId;
        container.appendChild(el);
    }

    const estilos = {};
    const hijos = {};
    let texto = '';

    // Step 0: Expand Seeds
    const dataExpanded = { ...data };
    if (data._seed && SEEDS[data._seed]) {
        Object.assign(dataExpanded, SEEDS[data._seed]);
    }

    // Step 1: Categorize
    for (const key in dataExpanded) {
        const val = dataExpanded[key];
        if (['nombre', 'tagName', 'variables', '_seed'].includes(key)) continue;
        if (key === 'texto') {
            texto = resolveValue(val, localVariables);
            continue;
        }

        if (typeof val === 'object' && val !== null) {
            if (['hover', 'active', 'responsive', 'animations'].includes(key)) continue;
            hijos[key] = val;
        } else {
            estilos[key] = resolveValue(val, localVariables);
        }
    }

    // Step 2: Responsive Overrides
    if (data.responsive) {
        const vw = window.innerWidth;
        const bps = Object.keys(data.responsive).sort((a, b) => parseInt(a) - parseInt(b));
        for (const bp of bps) {
            if (vw >= parseInt(bp)) {
                for (const k in data.responsive[bp]) estilos[k] = resolveValue(data.responsive[bp][k], localVariables);
            }
        }
    }

    // Step 3: Interaction Overrides
    if (data.hover && hoveredNodeId === el.id) {
        for (const k in data.hover) estilos[k] = resolveValue(data.hover[k], localVariables);
    }
    if (data.active && activeNodeId === el.id) {
        for (const k in data.active) estilos[k] = resolveValue(data.active[k], localVariables);
    }

    // Step 4: Apply Native CSS via setProperty
    // Using setProperty ensures we can use standard kebab-case from JSON
    el.style.cssText = '';
    for (const key in estilos) {
        el.style.setProperty(key, estilos[key]);
    }

    // Interaction Listeners
    el.onmouseenter = (e) => { e.stopPropagation(); hoveredNodeId = el.id; };
    el.onmouseleave = () => { if (hoveredNodeId === el.id) hoveredNodeId = null; };
    el.onmousedown = (e) => { e.stopPropagation(); activeNodeId = el.id; };
    el.onmouseup = () => { if (activeNodeId === el.id) activeNodeId = null; };

    // Step 5: Content
    if (el.tagName === 'IMG' && texto) { if (el.src !== texto) el.src = texto; }
    else {
        let textNode = Array.from(el.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
        if (texto) {
            if (textNode) { if (textNode.textContent !== texto) textNode.textContent = texto; }
            else el.prepend(document.createTextNode(texto));
        } else if (textNode) el.removeChild(textNode);
    }

    // Step 6: Children Reconciliation
    const currentHijosIds = Object.keys(hijos).map(k => `node-${path.replace(/\./g, '-')}-${k}`);
    Array.from(el.children).forEach(child => {
        if (child.id.startsWith(`node-${path.replace(/\./g, '-')}-`) && !currentHijosIds.includes(child.id)) {
            el.removeChild(child);
        }
    });
    for (const key in hijos) transcribir(hijos[key], el, `${path}.${key}`, localVariables);
}

/**
 * ENVIRONMENTAL ENGINE
 * The pulse of the system.
 */
function updateEnvironment() {
    const root = document.documentElement;
    const time = (Date.now() - startTime) / 1000;

    // Inject Living Variables
    root.style.setProperty('--nexus-time', time);
    root.style.setProperty('--nexus-scroll', window.scrollY);
    root.style.setProperty('--nexus-mouse-x', mouseX);
    root.style.setProperty('--nexus-mouse-y', mouseY);
    root.style.setProperty('--nexus-vh', window.innerHeight);
    root.style.setProperty('--nexus-vw', window.innerWidth);
}

document.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });

/**
 * GLOBAL CSS GENERATOR
 */
function updateGlobalStyles(data) {
    let styleEl = document.getElementById('nexus-global');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'nexus-global';
        document.head.appendChild(styleEl);
    }

    let css = '';
    if (data.animations) {
        for (const name in data.animations) {
            css += `@keyframes ${name} {\n`;
            for (const step in data.animations[name]) {
                css += `  ${step} {\n`;
                for (const prop in data.animations[name][step]) {
                    css += `    ${prop}: ${data.animations[name][step][prop]};\n`;
                }
                css += `  }\n`;
            }
            css += `}\n`;
        }
    }
    if (styleEl.innerHTML !== css) styleEl.innerHTML = css;
}

let lastState = '';
function mainLoop() {
    updateEnvironment();
    if (currentContent) {
        // Only re-transcribe if data changes, but environment variables update every frame via CSS
        const stateStr = JSON.stringify(currentContent) + hoveredNodeId + activeNodeId;
        if (stateStr !== lastState) {
            updateGlobalStyles(currentContent);
            transcribir(currentContent, document.getElementById('app'), 'pagina', currentContent.variables || {});
            lastState = stateStr;
        }
    }
    requestAnimationFrame(mainLoop);
}

window.addEventListener('message', (e) => {
    if (e.data.type === 'update-content') currentContent = e.data.content;
});

async function init() {
    try {
        const res = await fetch('content.json');
        if (res.ok) currentContent = await res.json();
    } catch(e) {}
    mainLoop();
}

init();
