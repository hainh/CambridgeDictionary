
/**
 * @type {(id: String) => HTMLElement}
 */
 let getById = document.getElementById.bind(document);

function toggleClick() {
    chrome.runtime.sendMessage({method: 'toggle'}, setStatus);
}

window.onload = function() {
    getById('toggleBtn').onclick = toggleClick;
    getById('ctrl-key').onchange = shortKeyChange;
    getById('alt-key').onchange = shortKeyChange;
    getById('shift-key').onchange = shortKeyChange;
    getById('key').onkeydown = function(evt) {
        setTimeout(shortKeyChange.bind('', evt), 0)
    };
    chrome.runtime.sendMessage({method: 'isEnabled'}, setStatus);
    chrome.runtime.sendMessage({method: 'getSwitchKeys'}, renderShortKeys);
}

function setStatus(enabled) {
    getById('status').innerText = 'Dictionary Is ' + (enabled ? 'Enabled' : 'Disabled');
}

/**
 * @param {String} keyChain 
 */
function renderShortKeys(keyChain) {
    keyChain = keyChain || 'Alt+Q';
    let keys = keyChain.split('+');
    let shiftKey = keys.some(key => key === 'Shift');
    let ctrlKey = keys.some(key => key === 'Ctrl');
    let altKey = keys.some(key => key === 'Alt');
    let key = keys[keys.length - 1];

    getById('shift-key').checked = shiftKey;
    getById('ctrl-key').checked = ctrlKey;
    getById('alt-key').checked = altKey;
    getById('key').value = key;
}

function getChecked(id) {
    return getById(id).checked;
}
function setChecked(id, checked) {
    getById(id).checked = checked;
}

function shortKeyChange(evt) {
    let ctrlKey = getChecked('ctrl-key');
    let shiftKey = getChecked('shift-key');
    let altKey = getChecked('alt-key');
    /** @type {HTMLInputElement} */
    let keyInput = getById('key');
    let key = keyInput.value.toUpperCase();
    if (key.length > 1) {
        key = key[key.length - 1];
        keyInput.value = key;
    }
    if (!key || !(ctrlKey || shiftKey || altKey)) {
        return;
    }
    setShortKey(ctrlKey, altKey, shiftKey, key);
}

function setShortKey(ctrlKey, altKey, shiftKey, key) {
    let keyChain = [ctrlKey && 'Ctrl', altKey && 'Alt', shiftKey && 'Shift', key].filter(x => x).join('+');
    chrome.runtime.sendMessage({method: 'setSwitchKeys', keys: keyChain});
}