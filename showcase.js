/**
 * OMNIVERSE V9 ENGINE - THE INFINITE TRANSCRIPTOR
 * Total JSON-to-DOM Orchestration.
 */

let currentContent = null;
let hoveredNodeId = null;
let activeNodeId = null;
let selectedNodePath = null;
let isDragging = false;
let startTime = Date.now();
let externalData = {};
let actionLog = [];
let mouseX = 0, mouseY = 0;

window.onmousemove = (e) => {
    mouseX = e.clientX / window.innerWidth;
    mouseY = e.clientY / window.innerHeight;
};

/**
 * RESOLUTION ENGINE V9
 * Recursive deep-resolver for Variables, Props, External Data, and Math.
 */
function resolveValue(val, context = {}) {
    if (typeof val !== 'string') return val;

    // Deep resolution loop (up to 5 iterations for complex dependencies)
    let lastVal;
    let iterations = 0;
    do {
        lastVal = val;

        // 1. Props: {{prop}}
        val = val.replace(/\{\{(.*?)\}\}/g, (_, path) => {
            const parts = path.trim().split('.');
            let curr = context.props || {};
            for (const p of parts) {
                if (curr && curr[p] !== undefined) curr = curr[p];
                else return `{{${path}}}`;
            }
            return typeof curr === 'object' ? JSON.stringify(curr) : String(curr);
        });

        // 2. Variables: $path
        val = val.replace(/\$([\w\.]+)/g, (match, path) => {
            const parts = path.split('.');
            let curr = currentContent || {};
            for (const p of parts) {
                if (curr && curr[p] !== undefined) curr = curr[p];
                else return match;
            }
            return typeof curr === 'object' ? JSON.stringify(curr) : String(curr);
        });

        // 3. External Data: [[path]]
        val = val.replace(/\[\[(.*?)\]\]/g, (_, fullPath) => {
            for (const fetchPath in externalData) {
                if (fullPath.startsWith(fetchPath)) {
                    let curr = externalData[fetchPath];
                    const remaining = fullPath.slice(fetchPath.length).replace(/^\./, '');
                    if (!remaining) return typeof curr === 'object' ? JSON.stringify(curr) : String(curr);
                    for (const p of remaining.split('.')) {
                        if (curr && curr[p] !== undefined) curr = curr[p];
                        else { curr = null; break; }
                    }
                    if (curr !== null) return typeof curr === 'object' ? JSON.stringify(curr) : String(curr);
                }
            }
            return `[[${fullPath}]]`;
        });

        // 4. Fluid Math: math(expr)
        val = val.replace(/math\((.*?)\)/g, (_, expr) => {
            try {
                const mathContext = {
                    ...Math,
                    time: (Date.now() - startTime) / 1000,
                    scroll: window.scrollY,
                    mx: mouseX,
                    my: mouseY,
                    clamp: (min, val, max) => Math.max(min, Math.min(val, max)),
                    lerp: (a, b, t) => a + (b - a) * t,
                    noise: (x) => Math.sin(x) * Math.cos(x * 1.5)
                };

                // Optimized evaluation: cache compiled functions
                if (!window._mathCache) window._mathCache = {};
                if (!window._mathCache[expr]) {
                    const keys = Object.keys(mathContext);
                    window._mathCache[expr] = new Function(...keys, `return ${expr}`);
                }
                return window._mathCache[expr](...Object.values(mathContext));
            } catch(e) { return expr; }
        });

        iterations++;
    } while (val !== lastVal && iterations < 5);

    return val;
}

/**
 * ACTION DISPATCHER V9
 * Orchestrates JSON-defined logic and lifecycle events.
 */
function dispatchActions(actions, context = {}) {
    if (!actions) return;
    if (!Array.isArray(actions)) actions = [actions];

    actions.forEach(action => {
        actionLog.push({ time: Date.now(), ...action });
        if (actionLog.length > 50) actionLog.shift();

        if (action.type === 'set') {
            const path = action.path.split('.');
            let curr = currentContent;
            for (let i = 0; i < path.length - 1; i++) {
                if (!curr[path[i]]) curr[path[i]] = {};
                curr = curr[path[i]];
            }

            let val = action.value;
            // Resolve value in context of current state
            curr[path[path.length - 1]] = resolveValue(val, context);
        }

        if (action.type === 'fetch') {
            fetch(action.url).then(r => r.json()).then(data => {
                externalData[action.path || action.url] = data;
            });
        }

        if (action.type === 'toggle') {
            const path = action.path.split('.');
            let curr = currentContent;
            for (let i = 0; i < path.length - 1; i++) curr = curr[path[i]];
            curr[path[path.length - 1]] = !curr[path[path.length - 1]];
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
        // Generic heuristics based on properties if tagName is missing
        if (!effectiveData.tagName) {
            if (effectiveData.href) tagName = 'a';
            else if (effectiveData['background-image'] && !effectiveData.texto) tagName = 'div';
            else if (effectiveData.src || path.includes('img')) tagName = 'img';
            else if (effectiveData.texto && (path.includes('boton') || effectiveData.cursor === 'pointer')) tagName = 'button';
        }
        el = document.createElement(tagName);
        el.id = elementId;
        container.appendChild(el);
    }

    // 3. Expansion
    if (effectiveData._seed && currentContent._seeds && currentContent._seeds[effectiveData._seed]) {
        Object.assign(effectiveData, currentContent._seeds[effectiveData._seed]);
    }

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

    // 5. Surgical Native CSS Application
    // Merge States (Hover/Active)
    const combinedStyles = { ...estilos };
    if (hoveredNodeId === el.id && effectiveData.hover) Object.assign(combinedStyles, effectiveData.hover);
    if (activeNodeId === el.id && effectiveData.active) Object.assign(combinedStyles, effectiveData.active);

    // Track active properties to handle removals
    const newAppliedKeys = new Set();

    for (const key in combinedStyles) {
        const rawValue = combinedStyles[key];
        const resolvedValue = resolveValue(rawValue, localContext);

        // Only update if value actually changed
        if (el.style.getPropertyValue(key) !== String(resolvedValue)) {
            el.style.setProperty(key, resolvedValue);
        }
        newAppliedKeys.add(key);
    }

    // Clean up properties that are no longer present
    const prevKeys = el._prevStyles || new Set();
    prevKeys.forEach(key => {
        if (!newAppliedKeys.has(key)) {
            el.style.removeProperty(key);
        }
    });
    el._prevStyles = newAppliedKeys;

    // 6. Interaction & Actions
    el.onmouseenter = (e) => {
        e.stopPropagation();
        hoveredNodeId = el.id;
        if (effectiveData.onMouseEnter) dispatchActions(effectiveData.onMouseEnter, localContext);
    };
    el.onmouseleave = (e) => {
        if (hoveredNodeId === el.id) hoveredNodeId = null;
        if (effectiveData.onMouseLeave) dispatchActions(effectiveData.onMouseLeave, localContext);
    };
    el.onmousemove = (e) => {
        if (effectiveData.onMouseMove) dispatchActions(effectiveData.onMouseMove, { ...localContext, event: e });
    };
    el.onclick = (e) => {
        e.stopPropagation();
        if (effectiveData._actions) dispatchActions(effectiveData._actions, localContext);
        if (effectiveData.onClick) dispatchActions(effectiveData.onClick, localContext);
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

    // 7. Surgical Rendering of Content
    if (el.tagName === 'IMG') {
        if (el.src !== texto) el.src = texto;
    } else {
        let tNode = Array.from(el.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
        if (texto) {
            if (tNode) {
                if (tNode.textContent !== texto) tNode.textContent = texto;
            } else {
                el.prepend(document.createTextNode(texto));
            }
        } else if (tNode) {
            el.removeChild(tNode);
        }
    }

    // 8. Lifecycle Events
    if (!el._mounted) {
        el._mounted = true;
        if (effectiveData.onMount) dispatchActions(effectiveData.onMount, localContext);
    }
    if (effectiveData.onUpdate) dispatchActions(effectiveData.onUpdate, localContext);

    // Dynamic Fetch (Legacy support)
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
 * CANVAS OVERLAY SYSTEM
 */
function updateCanvasOverlay() {
    if (isDragging) return;

    let overlay = document.getElementById('nexus-canvas-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'nexus-canvas-overlay';
        overlay.style.cssText = 'position:fixed; inset:0; pointer-events:none; z-index:999999;';
        document.body.appendChild(overlay);

        window.addEventListener('mousedown', startCanvasDrag);
        window.addEventListener('mousemove', handleCanvasDrag);
        window.addEventListener('mouseup', endCanvasDrag);
        window.addEventListener('dblclick', handleCanvasDblClick);
        window.addEventListener('click', handleCanvasClick);
    }

    if (!selectedNodePath) {
        overlay.style.display = 'none';
        return;
    }
    overlay.style.display = 'block';

    const targetId = selectedNodePath ? `node-pagina-${selectedNodePath.replace(/\./g, '-')}` : 'node-pagina';
    const el = document.getElementById(targetId);
    if (!el) {
        overlay.style.display = 'none';
        return;
    }

    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);

    const mt = parseFloat(style.marginTop) || 0;
    const mb = parseFloat(style.marginBottom) || 0;
    const ml = parseFloat(style.marginLeft) || 0;
    const mr = parseFloat(style.marginRight) || 0;

    const pt = parseFloat(style.paddingTop) || 0;
    const pb = parseFloat(style.paddingBottom) || 0;
    const pl = parseFloat(style.paddingLeft) || 0;
    const pr = parseFloat(style.paddingRight) || 0;

    // Use surgical updates to prevent detachment flicker
    let box = document.getElementById('canvas-selection-box');
    if (!box || box.dataset.path !== selectedNodePath) {
        overlay.innerHTML = `
            <div id="canvas-selection-box" data-path="${selectedNodePath}" style="position:absolute; border:1px solid #00f0ff; box-shadow:0 0 10px rgba(0,240,255,0.3); pointer-events:auto;">
                <div id="canvas-label" style="position:absolute; top:-20px; left:0; background:#00f0ff; color:#000; font-size:10px; font-weight:bold; padding:2px 6px; white-space:nowrap; cursor:move;">
                    ${selectedNodePath.split('.').pop()}
                </div>

                <!-- Quick Action Bar -->
            <div id="canvas-actions" style="position:absolute; bottom:-35px; left:50%; transform:translateX(-50%); background:#1a1a20; border:1px solid #00f0ff; border-radius:4px; display:flex; gap:4px; padding:4px; box-shadow:0 5px 25px rgba(0,0,0,0.8); white-space:nowrap;">
                <button class="canvas-action" data-action="glass" title="Glass Effect" style="background:#222; border:1px solid #444; color:#fff; cursor:pointer; padding:4px 8px; font-size:12px; border-radius:3px;">💎</button>
                <button class="canvas-action" data-action="glow" title="Neon Glow" style="background:#222; border:1px solid #444; color:#fff; cursor:pointer; padding:4px 8px; font-size:12px; border-radius:3px;">✨</button>
                <button class="canvas-action" data-action="float" title="Float Animation" style="background:#222; border:1px solid #444; color:#fff; cursor:pointer; padding:4px 8px; font-size:12px; border-radius:3px;">☁️</button>
                <button class="canvas-action" data-action="pulse" title="Pulse Animation" style="background:#222; border:1px solid #444; color:#fff; cursor:pointer; padding:4px 8px; font-size:12px; border-radius:3px;">💓</button>
                <button class="canvas-action" data-action="click" title="Click Toggle Interaction" style="background:#222; border:1px solid #444; color:#fff; cursor:pointer; padding:4px 8px; font-size:12px; border-radius:3px;">🖱️</button>
                <div style="width:1px; background:#444; margin:0 4px;"></div>
                <button class="canvas-action" data-action="duplicate" title="Duplicate" style="background:#222; border:1px solid #444; color:#fff; cursor:pointer; padding:4px 8px; font-size:12px; border-radius:3px;">⧉</button>
                <button class="canvas-action" data-action="delete" title="Delete" style="background:#222; border:1px solid #444; color:#ff4a4a; cursor:pointer; padding:4px 8px; font-size:12px; border-radius:3px;">✕</button>
                </div>

                <div class="resizer br" data-type="br" style="position:absolute; right:-4px; bottom:-4px; width:8px; height:8px; background:#fff; border:1px solid #00f0ff; cursor:nwse-resize;"></div>
                <div class="resizer r" data-type="r" style="position:absolute; right:-4px; top:50%; margin-top:-10px; width:4px; height:20px; background:#fff; border:1px solid #00f0ff; cursor:ew-resize;"></div>
                <div class="resizer b" data-type="b" style="position:absolute; bottom:-4px; left:50%; margin-left:-10px; width:20px; height:4px; background:#fff; border:1px solid #00f0ff; cursor:ns-resize;"></div>
            </div>
            <div id="canvas-margin-overlay" style="position:absolute; border:1px solid rgba(217, 119, 6, 0.3); background:rgba(217, 119, 6, 0.05);"></div>
            <div id="canvas-padding-overlay" style="position:absolute; border:1px dashed rgba(45, 138, 78, 0.3); background:rgba(45, 138, 78, 0.05);"></div>
        `;
        box = document.getElementById('canvas-selection-box');
    }

    box.style.left = rect.left + 'px';
    box.style.top = rect.top + 'px';
    box.style.width = rect.width + 'px';
    box.style.height = rect.height + 'px';

    const marginOverlay = document.getElementById('canvas-margin-overlay');
    marginOverlay.style.left = (rect.left - ml) + 'px';
    marginOverlay.style.top = (rect.top - mt) + 'px';
    marginOverlay.style.width = (rect.width + ml + mr) + 'px';
    marginOverlay.style.height = (rect.height + mt + mb) + 'px';

    const paddingOverlay = document.getElementById('canvas-padding-overlay');
    paddingOverlay.style.left = (rect.left + pl) + 'px';
    paddingOverlay.style.top = (rect.top + pt) + 'px';
    paddingOverlay.style.width = Math.max(0, rect.width - pl - pr) + 'px';
    paddingOverlay.style.height = Math.max(0, rect.height - pt - pb) + 'px';
}

let dragTarget = null;
let startX, startY, startW, startH;

function startCanvasDrag(e) {
    const handle = e.target.closest('.resizer');
    if (!handle) return;
    isDragging = true;
    dragTarget = handle.dataset.type;
    startX = e.clientX; startY = e.clientY;
    const box = document.getElementById('canvas-selection-box');
    startW = box.offsetWidth; startH = box.offsetHeight;
    e.preventDefault();
}

function handleCanvasDrag(e) {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const box = document.getElementById('canvas-selection-box');
    const el = document.getElementById(`node-${selectedNodePath.replace(/\./g, '-')}`);
    if (dragTarget === 'r' || dragTarget === 'br') {
        const newW = startW + dx;
        box.style.width = newW + 'px';
        if (el) el.style.width = newW + 'px';
    }
    if (dragTarget === 'b' || dragTarget === 'br') {
        const newH = startH + dy;
        box.style.height = newH + 'px';
        if (el) el.style.height = newH + 'px';
    }
}

function endCanvasDrag(e) {
    if (!isDragging) return;
    const box = document.getElementById('canvas-selection-box');
    window.parent.postMessage({
        type: 'canvas-update',
        path: selectedNodePath,
        updates: { width: box.offsetWidth + 'px', height: box.offsetHeight + 'px' }
    }, '*');
    isDragging = false;
    dragTarget = null;
}

function handleCanvasDblClick(e) {
    const target = e.target.closest('[id^="node-"]');
    if (!target) return;
    const path = target.id.replace('node-', '').replace(/-/g, '.');
    window.parent.postMessage({ type: 'request-text-edit', path: path }, '*');
}

function handleCanvasClick(e) {
    const btn = e.target.closest('.canvas-action');
    if (!btn) return;

    // Visual Feedback
    const originalText = btn.textContent;
    btn.textContent = '✅';
    setTimeout(() => btn.textContent = originalText, 1000);

    // Flash the selection box
    const box = document.getElementById('canvas-selection-box');
    if (box) {
        box.style.transition = 'background 0.2s';
        box.style.background = 'rgba(0, 240, 255, 0.2)';
        setTimeout(() => box.style.background = 'transparent', 300);
    }

    const action = btn.dataset.action;
    window.parent.postMessage({ type: 'canvas-apply-preset', path: selectedNodePath, action: action }, '*');
}

/**
 * RUNTIME
 */
let lastStateHash = '';
function mainLoop() {
    const time = (Date.now() - startTime) / 1000;
    const scroll = window.scrollY;

    document.documentElement.style.setProperty('--nexus-time', time);
    document.documentElement.style.setProperty('--nexus-scroll', scroll);

    if (currentContent) {
        // Fast path for high-frequency updates (only updates dynamic properties)
        updateHighFrequencyProps(currentContent, 'pagina');
        updateCanvasOverlay();

        // Full transcription only if structure or base values changed
        // We use a lighter "fingerprint" than full JSON.stringify
        const stateHash = `${currentContent._v || 0}-${JSON.stringify(externalData).length}-${hoveredNodeId}-${activeNodeId}`;

        if (stateHash !== lastStateHash) {
            updateGlobalStyles(currentContent);
            transcribir(currentContent, document.getElementById('app'), 'pagina');
            lastStateHash = stateHash;

            window.parent.postMessage({
                type: 'sync-data',
                data: {
                    external: externalData,
                    actionLog: actionLog,
                    state: { ...currentContent, time: time, scroll: scroll }
                }
            }, '*');
        }
    }
    requestAnimationFrame(mainLoop);
}

/**
 * FAST PATH: HIGH-FREQUENCY PROPERTY UPDATE
 * Recursively updates only properties containing dynamic math (time, mx, my, scroll).
 */
function updateHighFrequencyProps(data, path, context = {}) {
    if (path === 'templates') return;

    const el = document.getElementById(`node-${path.replace(/\./g, '-')}`);
    if (!el) return;

    const localContext = { props: data.props || {} };

    // Check styles for dynamic math
    for (const key in data) {
        const val = data[key];
        if (typeof val === 'string' && val.includes('math(')) {
            const resolved = resolveValue(val, localContext);
            if (el.style.getPropertyValue(key) !== String(resolved)) {
                el.style.setProperty(key, resolved);
            }
        }

        // Recurse into children
        if (typeof val === 'object' && val !== null && !['hover', 'active', 'responsive', 'animations', 'props'].includes(key)) {
            updateHighFrequencyProps(val, `${path}.${key}`, localContext);
        }
    }
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

window.addEventListener('message', (e) => {
    if (e.data.type === 'update-content') currentContent = e.data.content;
    if (e.data.type === 'set-selected') selectedNodePath = e.data.path;
    if (e.data.type === 'get-rect') {
        const el = document.getElementById(`node-${e.data.path.replace(/\./g, '-')}`);
        if (el) {
            const rect = el.getBoundingClientRect();
            window.parent.postMessage({
                type: 'rect-result',
                rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
                path: e.data.path
            }, '*');
        }
    }
});
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
