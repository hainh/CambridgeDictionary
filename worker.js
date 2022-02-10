let enabled = -1;

// chrome.action.onClicked.addListener(function(tab) { alert('icon clicked')});

chrome.runtime.onStartup.addListener(onStart);
chrome.runtime.onInstalled.addListener(onStart);

function onStart() {
    if (enabled === -1) {
        isEnabled().then(value => {
            enabled = value;
            setIcon(enabled);
        });
    }

    chrome.tabs.query({}, tabs => {
        tabs.forEach(tab => {
            lastTabs[tab.windowId] = lastTabs[tab.windowId] || [];
            lastTabs[tab.windowId].push(tab.id);
            // console.log('Loaded tab', tab);
        });
    });
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (!handlers[request.method]) {
        return false;
    }
    handlers[request.method](request).then(sendResponse);
    return true;
});

async function loadDict(request) {
    if (!enabled) return null;
    try {
        var response = await fetch(`https://dictionary.cambridge.org/dictionary/${request.dict || 'english-vietnamese'}/${request.text}`);
        var text = await response.text();
        request.definition = text;
    } finally {
        return request;
    }
}

async function get(key) {
    let result = await chrome.storage.sync.get([key]);
    return result[key];
}

async function set(key, value) {
    await chrome.storage.sync.set({[key]: value});
}

async function isEnabled() {
    return (await get('enabled')) !== '0';
}

let handlers = {
    loadDict,
    isEnabled,
    getDict() {
        return get('dict');
    },
    setDict(request) {
        return set('dict', request.dict);
    },
    getSwitchKeys() {
        return get('switchkey');
    },
    setSwitchKeys(request) {
        for (var windowId in lastTabs) {
            for (var tabId of lastTabs[windowId]) {
                chrome.tabs.sendMessage(tabId, {keyChain: request.keys}, function() {});
            }
        }
        return set('switchkey', request.keys);
    },
    async getTabs() {
        let window = await chrome.windows.getCurrent();
        if (!lastTabs[window.id]) return [];
        let tabs = await chrome.tabs.query({windowId: window.id});
        let result = tabs.map(tab => ({
            index: lastTabs[window.id].indexOf(tab.id),
            favIcon: tab.favIconUrl,
            title: tab.title,
            id: tab.id
        }));
        console.log('getTabs', result);
        return result;
    },
    async activateTab(request) {
        await chrome.tabs.update(request.id, {active: true});
    },
    async toggle() {
        enabled = !(await isEnabled());
        await set('enabled', enabled ? '1' : '0');
        setIcon(enabled);
        console.log('Translation is ' + (enabled ? 'enabled' : 'disabled'));
        let tabs = await chrome.tabs.query({});
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {enabled: enabled}, function(value){
                console.log('Sent toggle', value, 'to', JSON.stringify(tab));
            });
        });
        return enabled;
    }
}

function setIcon(enabled) {
    const icon_enabled = {
        "16": "icon16.png",
        "48": "icon48.png",
        "128": "icon128.png"
    },  icon_disabled = {
        "16": "icon16-stop.png",
        "48": "icon48-stop.png",
        "128": "icon128-stop.png"
    };
    chrome.action.setIcon({path: enabled ? icon_enabled : icon_disabled});
    chrome.action.setTitle({title: 'Cambridge Dictionary Is ' + (enabled ? 'Enabled' : 'Disabled')})
}

chrome.commands.onCommand.addListener(async (command) => {
    switch (command) {
        case 'toggle-translation':
            await handlers.toggle();
            break;
        case 'close-all-definition-windows':
            var tabs = await chrome.tabs.query({active: true, currentWindow: true});
            chrome.tabs.sendMessage(tabs[0].id, {closeAllDefWindows: true});
            break;
        case 'switch-tab1':
        case 'switch-tab2':
            var tabs = lastTabs[(await chrome.windows.getCurrent()).id];
            if (tabs) break;

            break;
    }
    console.log(`Command ${command} triggered`);
});

/**
 * @type {{[key: number]: Array<Number>}}
 */
let lastTabs = {};

chrome.tabs.onActivated.addListener(async tab => {
    let tabs = lastTabs[tab.windowId];
    if (tabs) {
        let active = tabs.indexOf(tab.tabId);
        if (active >= 0) {
            tabs.splice(active, 1);
        }
        tabs.unshift(tab.tabId);
    } else {
        lastTabs[tab.windowId] = [tab.tabId];
    }
    console.log(lastTabs, tabs);
});