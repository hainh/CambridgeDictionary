let enabled = -1;

// chrome.action.onClicked.addListener(function(tab) { alert('icon clicked')});

chrome.runtime.onStartup.addListener(onStart);

function onStart() {
    if (enabled === -1) {
        isEnabled().then(value => {
            enabled = value;
            setIcon(enabled);
        });
    }

    console.log('Started')

    chrome.tabs.query({}, tabs => {
        tabs.forEach(tab => {
            lastTabs[tab.windowId] = lastTabs[tab.windowId] || [];
            lastTabs[tab.windowId].push(tab.id);
            // console.log('Loaded tab', tab);
        });
    });
}

// chrome.windows.onCreated.addListener(async window => {
//     let tabs = await chrome.tabs.query({windowId: window.id});
//     tabs.forEach(tab => {
//         lastTabs[tab.windowId] = lastTabs[tab.windowId] || [];
//         lastTabs[tab.windowId].push(tab.id);
//     });
// });

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (!handlers[request.method]) {
        return false;
    }
    handlers[request.method](request).then(sendResponse);
    return true;
});

async function loadDict(request) {
    // if (!enabled) return null;
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
    return value;
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
    async getSwitchKeys() {
        var keys = await get('switchkey');
        if (!keys) {
            keys = 'Alt+Q';
            await this.setSwitchKeys({keys})
        }
        return keys;
    },
    async setSwitchKeys(request) {
        for (var windowId in lastTabs) {
            for (var tabId of lastTabs[windowId]) {
                chrome.tabs.sendMessage(tabId, {keyChain: request.keys}, function() {});
            }
        }
        await set('switchkey', request.keys);
        return request.keys;
    },
    async getTabs() {
        let window = await chrome.windows.getCurrent();
        let tabs = await chrome.tabs.query({windowId: window.id});
        let result = tabs.filter(tab => tab.url && tab.url.indexOf('http') >= 0).map(tab => ({
            index: lastTabs[window.id].indexOf(tab.id) < 0 ? 100000 : lastTabs[window.id].indexOf(tab.id),
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
    }
});

/**
 * @type {{[key: number]: Array<Number>}}
 */
let lastTabs = {};

chrome.tabs.onActivated.addListener(async tab => {
    await tabChanged(tab.tabId, tab.windowId, false)
});

chrome.tabs.onAttached.addListener(async tab => {
    await tabChanged(tab.tabId, tab.windowId, false)
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    if (!removeInfo.isWindowClosing) {
        await tabChanged(tabId, removeInfo.windowId, true)
    }
});

chrome.tabs.onDetached.addListener(async (tabId, detachInfo) => {
    await tabChanged(tabId, detachInfo.oldWindowId, true)
    let window = await chrome.windows.getCurrent();
    await tabChanged(tabId, window.id, false);
})

/**
 * @param {Number} tabId 
 * @param {Number} windowId 
 * @param {Boolean} removed 
 */
async function tabChanged(tabId, windowId, removed) {
    let tabs = lastTabs[windowId];
    if (tabs) {
        let tabIndex = tabs.indexOf(tabId);
        if (tabIndex >= 0) {
            tabs.splice(tabIndex, 1);
        }
        if (!removed) tabs.unshift(tabId);
    } else if (!removed) {
        lastTabs[windowId] = [tabId];
    }
    let allWindows = await chrome.windows.getAll();
    let noWindow = [], windowIds = Object.getOwnPropertyNames(lastTabs);
    for (let i = 0; i < windowIds.length; i++) {
        windowId = +windowIds[i];
        if (allWindows.every(window => window.id != windowId)) {
            noWindow.push(windowId);
        } else {
            let allTabs = await chrome.tabs.query({windowId});
            tabs = lastTabs[windowId];
            for (let j = 0; j < tabs.length; j++) {
                let tabId1 = tabs[j];
                if (allTabs.every(tab => tab.id != tabId1)) {
                    tabs.splice(j--, 1);
                }
            }
        }
    }
    noWindow.forEach(windowId => delete lastTabs[windowId]);
    console.log(removed ? 'Remove' : 'Active', tabId, lastTabs);
}