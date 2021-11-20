chrome.runtime.sendMessage({method: 'toggle'}, value => {
    document.getElementById('status').innerText = 'Dictionary Is ' + (value ? 'Enabled' : 'Disabled');
})