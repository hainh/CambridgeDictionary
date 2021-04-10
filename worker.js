
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

async function getDict() {

}

async function setDict() {

}

let handlers = {
    loadDict, getDict, setDict
}