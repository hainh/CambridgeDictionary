let enabled = -1;

// chrome.action.onClicked.addListener(function(tab) { alert('icon clicked')});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (!handlers[request.method]) {
        return false;
    }
    handlers[request.method](request).then(sendResponse);
    return true;
});

async function loadDict(request) {
    if (enabled === -1) {
        enabled = await isEnabled();
    }
    if (!enabled) return null;
    try {
        var response = await fetch(`https://dictionary.cambridge.org/dictionary/${request.dict || 'english-vietnamese'}/${request.text}`);
        var text = await response.text();
        request.definition = text;
    } finally {
        return request;
    }
}

function get(key) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get([key], function(result) {
            resolve(result[key]);
        });
    });
}

function set(key, value) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.set({[key]: value}, function() {
            resolve(value);
        });
    });
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
    async toggle() {
        enabled = !(await isEnabled());
        await set('enabled', enabled ? '1' : '0');
        console.log('Translation is ' + (enabled ? 'enabled' : 'disabled'));
        chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {enabled: enabled}, function(value){
                    console.log('Sent toggle', value, 'to', JSON.stringify(tab));
                });
            });
        });
        return enabled;
    }
}

chrome.commands.onCommand.addListener((command) => {
    switch (command) {
        case 'toggle-translation':
            handlers.toggle();
            break;
        case 'close-all-definition-windows':
            chrome.tabs.query({active: true, currentWindow: true}, tabs => {
                chrome.tabs.sendMessage(tabs[0].id, {closeAllDefWindows: true});
            });
            break;
    }
    console.log(`Command ${command} triggered`);
})