
chrome.action.onClicked.addListener(tab => {
    alert(`Clicked icon on tab ` + tab.id);
});

chrome.runtime.sendMessage({method: 'toggle'}, value => {
    document.getElementById('status').innerText = 'Dictionary Is ' + (value ? 'Enabled' : 'Disabled');
})