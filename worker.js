
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (!handlers[request.method]) {
        return false;
    }
    handlers[request.method](request).then(sendResponse);
    return true;
});

async function loadDict(request) {
    try {
        var response = await fetch(`https://dictionary.cambridge.org/dictionary/${request.dict || 'english-vietnamese'}/${request.text}`);
        var text = await response.text();
        request.definition = text;
    } finally {
        return request;
    }
}

function getDict() {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(['dict'], function(result) {
            resolve(result.dict);
        });
    });
}

function setDict(params) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.set({dict: params.dict}, function() {
            resolve(params.dict);
        });
    });
}

let handlers = {
    loadDict, getDict, setDict
}