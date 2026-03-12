/**
 * SINGULARITY V8 ENGINE - THE LOGIC ORCHESTRATOR
 * The pinnacle of JSON-driven architecture.
 * Logic, State, and Actions within the Data Model.
 */

let currentContent = null;
let hoveredNodeId = null;
let activeNodeId = null;
let startTime = Date.now();
let externalData = {};

// DESIGN SEEDS
const SEEDS = {
    "glass": {
        "backdrop-filter": "blur(20px) saturate(180%)",
        "background-color": "rgba(255, 255, 255, 0.05)",
        "border": "1px solid rgba(255, 255, 255, 0.1)",
        "box-shadow": "0 8px 32px 0 rgba(0, 0, 0, 0.37)"
    },
    "cyber": {
        "background": "linear-gradient(45deg, #ff003c 0%, #00f0ff 100%)",
        "clip-path": "polygon(0% 0%, 100% 0%, 100% 75%, 75% 100%, 0% 100%)",
        "filter": "drop-shadow(0 0 10px #ff003c)"
    }
};

/**
 * RESOLUTION ENGINE V8
 */
function resolveValue(val, context = {}) {
    if (typeof val !== 'string') return val;

    // 1. Fluid Math: math(50 + 20)
    val = val.replace(/math\((.*?)\)/g, (_, expr) => {
        try {
            // Replace css variables with their values
            const cleanExpr = expr.replace(/--([\w-]+)/g, (m) => {
                return getComputedStyle(document.documentElement).getPropertyValue(m).trim() || "0";
            });
            return eval(cleanExpr);
        } catch(e) { return expr; }
    });

    // 2. Props: {{prop}}
    val = val.replace(/\{\{(.*?)\}\}/g, (_, path) => {
        const parts = path.trim().split('.');
        let curr = context.props || {};
        for (const p of parts) { if (curr && curr[p] !== undefined) curr = curr[p]; else return `{{${path}}}`; }
        return curr;
    });

    // 3. External Data: [[path]]
    val = val.replace(/\[\[(.*?)\]\]/g, (_, fullPath) => {
        for (const fetchPath in externalData) {
            if (fullPath.startsWith(fetchPath)) {
                let curr = externalData[fetchPath];
                const remaining = fullPath.slice(fetchPath.length).replace(/^\./, '');
                if (!remaining) return curr;
                for (const p of remaining.split('.')) {
                    if (curr && curr[p] !== undefined) curr = curr[p];
                    else { curr = null; break; }
                }
                if (curr !== null) return typeof curr === 'object' ? JSON.stringify(curr) : curr;
            }
        }
        return `[[${fullPath}]]`;
    });

    // 4. Variables: $path
    if (val.includes('$')) {
        return val.replace(/\$([\w\.]+)/g, (match, path) => {
            const parts = path.split('.');
            let curr = currentContent || {};
            for (const p of parts) {
                if (curr && curr[p] !== undefined) curr = curr[p];
                else return match;
            }
            return curr;
        });
    }

    return val;
}

/**
 * ACTION DISPATCHER
 * Executes logic defined in JSON
 */
function dispatchActions(actions) {
    if (!actions) return;
    actions.forEach(action => {
        if (action.type === 'set') {
            const path = action.path.split('.');
            let curr = currentContent;
            for (let i = 0; i < path.length - 1; i++) curr = curr[path[i]];

            let val = action.value;
            if (typeof val === 'string' && val.includes('math(')) {
                // For actions, we resolve variables against the current state before evaluating math
                const resolvedVal = val.replace(/\$([\w\.]+)/g, (_, p) => {
                    let c = currentContent;
                    for(const part of p.split('.')) c = c[part];
                    return c;
                });
                val = resolveValue(resolvedVal);
            }
            curr[path[path.length - 1]] = val;
        }
    });
}

/**
 * SINGULARITY TRANSCRIPTOR
 */
function transcribir(data, container, path = 'pagina', context = {}) {
    if (path === 'templates') return; // Do not render definition root

    // 1. Template & Slot Logic
    let effectiveData = { ...data };
    if (data._template && currentContent.templates && currentContent.templates[data._template]) {
        const template = JSON.parse(JSON.stringify(currentContent.templates[data._template]));

        // Handle Slots: Find any child with "_slot": "name" and replace with instance children
        function processSlots(node) {
            for (const k in node) {
                if (node[k] && typeof node[k] === 'object' && node[k] !== null) {
                    if (node[k]._slot) {
                        const slotName = node[k]._slot;
                        if (data[slotName]) {
                            // Instead of replacing the whole object, we keep the slot key
                            // but replace its content with the instance data.
                            // OR better: we merge them so we keep the slot ID path stable.
                            Object.keys(node[k]).forEach(key => { if(key !== '_slot') delete node[k][key]; });
                            Object.assign(node[k], data[slotName]);
                        } else {
                            delete node[k];
                        }
                    } else {
                        processSlots(node[k]);
                    }
                }
            }
        }
        processSlots(template);

        effectiveData = template;
        // Merge instance overrides (styles, props, actions)
        Object.assign(effectiveData, data);
        effectiveData.props = { ...(template.props || {}), ...(data.props || {}) };
    }

    const elementId = `node-${path.replace(/\./g, '-')}`;
    let el = document.getElementById(elementId);
    const localContext = { props: effectiveData.props || {} };

    // 2. DOM Lifecycle
    if (!el) {
        let tagName = effectiveData.tagName || 'div';
        if (!effectiveData.tagName) {
            if (path.includes('boton')) tagName = 'button';
            else if (path.includes('img')) tagName = 'img';
        }
        el = document.createElement(tagName);
        el.id = elementId;
        container.appendChild(el);
    }

    // 3. Expansion
    if (effectiveData._seed && SEEDS[effectiveData._seed]) Object.assign(effectiveData, SEEDS[effectiveData._seed]);

    const estilos = {};
    const hijos = {};
    let texto = '';

    // 4. Attribute Processing
    for (const key in effectiveData) {
        const val = effectiveData[key];
        if (['nombre', 'tagName', 'variables', '_seed', '_template', 'props', '_fetch', '_actions'].includes(key)) continue;

        if (key === 'texto') { texto = resolveValue(val, localContext); continue; }

        if (typeof val === 'object' && val !== null) {
            if (['hover', 'active', 'responsive', 'animations'].includes(key)) continue;
            hijos[key] = val;
        } else {
            estilos[key] = resolveValue(val, localContext);
        }
    }

    // 5. Native CSS Application
    el.style.cssText = '';

    // Apply States (Hover/Active)
    if (hoveredNodeId === el.id && effectiveData.hover) {
        Object.assign(estilos, effectiveData.hover);
    }
    if (activeNodeId === el.id && effectiveData.active) {
        Object.assign(estilos, effectiveData.active);
    }

    for (const key in estilos) {
        el.style.setProperty(key, resolveValue(estilos[key], localContext));
    }

    // 6. Interaction & Actions
    el.onmouseenter = (e) => {
        e.stopPropagation();
        hoveredNodeId = el.id;
        if (effectiveData.hover) {
            // Re-render handled by mainLoop since state changed
        }
    };
    el.onmouseleave = () => { if (hoveredNodeId === el.id) hoveredNodeId = null; };
    el.onclick = (e) => {
        if (effectiveData._actions) {
            e.stopPropagation();
            dispatchActions(effectiveData._actions);
        }
    };
    el.onmousedown = () => { activeNodeId = el.id; };
    el.onmouseup = () => { activeNodeId = null; };

    // Communication with Editor
    if (path !== 'pagina') { // Don't allow selecting root as often
        el.addEventListener('click', (e) => {
            if (e.ctrlKey || e.metaKey) { // Meta-click to select in editor
                e.preventDefault();
                e.stopPropagation();
                window.parent.postMessage({ type: 'select-node', path: path }, '*');
            }
        }, true);
    }

    // 7. Rendering Content
    if (el.tagName === 'IMG' && texto) el.src = texto;
    else {
        let tNode = Array.from(el.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
        if (texto) {
            if (tNode) tNode.textContent = texto;
            else el.prepend(document.createTextNode(texto));
        } else if (tNode) el.removeChild(tNode);
    }

    // 8. Dynamic Fetch
    if (effectiveData._fetch && !externalData[path]) {
        externalData[path] = { loading: true };
        fetch(effectiveData._fetch).then(r => r.json()).then(d => { externalData[path] = d; });
    }

    // 9. Reconciliation
    const currentHijosIds = Object.keys(hijos).map(k => `node-${path.replace(/\./g, '-')}-${k}`);
    Array.from(el.children).forEach(child => {
        if (child.id.startsWith(`node-${path.replace(/\./g, '-')}-`) && !currentHijosIds.includes(child.id)) el.removeChild(child);
    });
    for (const key in hijos) transcribir(hijos[key], el, `${path}.${key}`, localContext);
}

/**
 * RUNTIME
 */
let lastState = '';
function mainLoop() {
    const time = (Date.now() - startTime) / 1000;
    document.documentElement.style.setProperty('--nexus-time', time);
    document.documentElement.style.setProperty('--nexus-scroll', window.scrollY);

    if (currentContent) {
        const stateStr = JSON.stringify(currentContent) + JSON.stringify(externalData) + hoveredNodeId + activeNodeId;
        if (stateStr !== lastState) {
            updateGlobalStyles(currentContent);
            transcribir(currentContent, document.getElementById('app'), 'pagina');
            lastState = stateStr;
            window.parent.postMessage({
                type: 'sync-data',
                data: {
                    external: externalData,
                    state: { ...currentContent, time: time, scroll: window.scrollY }
                }
            }, '*');
        }
    }
    requestAnimationFrame(mainLoop);
}

function updateGlobalStyles(data) {
    let styleEl = document.getElementById('nexus-global');
    if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'nexus-global'; document.head.appendChild(styleEl); }
    let css = '';
    if (data.animations) {
        for (const name in data.animations) {
            css += `@keyframes ${name} {\n`;
            for (const step in data.animations[name]) {
                css += `  ${step} {\n`;
                for (const prop in data.animations[name][step]) css += `    ${prop}: ${data.animations[name][step][prop]};\n`;
                css += `  }\n`;
            }
            css += `}\n`;
        }
    }
    if (styleEl.innerHTML !== css) styleEl.innerHTML = css;
}

window.addEventListener('message', (e) => { if (e.data.type === 'update-content') currentContent = e.data.content; });
async function init() {
    if (!currentContent) {
        try {
            const res = await fetch('content.json');
            if (res.ok) currentContent = await res.json();
        } catch(e) {}
    }
    mainLoop();
}
init();
