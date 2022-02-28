(function() {
    var ctrlKey = false, shiftKey = false, altKey = false, shortKey = 'Q', metaLength = 0;
    var start = false, chosenTab = -1, tabs = [{index: 0, favIcon: '', title: '', id: 0}];
    var cardsPerRow = 1;

    function init() {
        $(document.body).on('keyup', switchTabKeyup).on('keydown', switchTabKeydown);
        document.addEventListener('visibilitychange', removeTabChooser);
        window.addEventListener('keydown', function(event) {
            if (start && altKey && !shiftKey && !ctrlKey && ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']) {
                event.preventDefault();
            }
        });
    }
    
    function setKeyChain(keyChain) {
        /**@type {String[]} */
        let keys = keyChain.split('+');
        shiftKey = keys.some(key => key === 'Shift');
        ctrlKey = keys.some(key => key === 'Ctrl');
        altKey = keys.some(key => key === 'Alt');
        shortKey = keys[keys.length - 1];
        metaLength = [ctrlKey, shiftKey, altKey].filter(x => x).length;
    }

    /** @param {KeyboardEvent} event*/
    function matchMetaKey(event) {
        return [event.ctrlKey && ctrlKey, event.shiftKey && shiftKey, event.altKey && altKey].filter(x => x).length;
    }
    
    /** @param {KeyboardEvent} event*/
    function switchTabKeydown(event) {
        if (matchMetaKey(event) === metaLength) {
            if (!start && chosenTab < 0 && event.key.length > 1) {
                // console.log('Switch tab Start');
                chosenTab = 0;
                chrome.runtime.sendMessage({method: 'getTabs'}, result => {
                    tabs = result;
                    if (tabs.length === 0) {
                        removeTabChooser();
                        // console.log('No tab loaded');
                        return;
                    }
                    tabs.sort((a, b) => a.index - b.index);
                    // console.log('loaded tabs', tabs);
                    renderTabs();
                });
            } else if (event.key.length === 1) {
                start = true;
                // console.log('start');
            }
        } else if (start || chosenTab >= 0) {
            // console.log('Deactivate switch tab');
            removeTabChooser();
        }
        // console.log('key down', event.ctrlKey, event.shiftKey, event.altKey, event.key, event.code, event.which);
    }
    
    /** @param {KeyboardEvent} event*/
    function switchTabKeyup(event) {
        if (!start) return;
        if (matchMetaKey(event) === metaLength) {
            if (event.key.toUpperCase() === shortKey || event.key === 'ArrowRight') {
                switchChosenTab(1);
            } else if (event.key === 'ArrowLeft') {
                switchChosenTab(-1)
            } else if (event.key === 'ArrowUp') {
                switchChosenTab(-cardsPerRow)
            } else if (event.key === 'ArrowDown') {
                switchChosenTab(cardsPerRow)
            }
        } else if (event.key.length > 1 && matchMetaKey(event) < metaLength) {
            // console.log('Do switch tab', chosenTab, tabs[chosenTab]);
            if (tabs[chosenTab]) {
                chrome.runtime.sendMessage({method: 'activateTab', id: tabs[chosenTab].id});
            }
            removeTabChooser()
        }
        // console.log('key up', event.ctrlKey, event.shiftKey, event.altKey, event.key.toUpperCase())
    }

    function renderTabs() {
        let width = window.innerWidth || document.documentElement.clientWidth;
        let containerWidth = width * 0.8;
        cardsPerRow = Math.floor(containerWidth / 130);
        let rowCount = tabs.length / cardsPerRow;
        rowCount = Math.floor(rowCount) + (rowCount - Math.floor(rowCount) > 0 ? 1 : 0);
        containerWidth = cardsPerRow * 130;
        containerWidth = Math.min(tabs.length * 130, containerWidth);

        let rows = [];
        for (var i = 0; i < rowCount; ++i) {
            let cards = [];
            for (var c = i * cardsPerRow; c < (i + 1) * cardsPerRow; ++c) {
                let card = tabs[c];
                if (card) {
                    cards.push(card)
                } else {
                    break;
                }
            }
            rows.push({cards});
        }

        let htmlElement = $(Mustache.render(template, {rows, width: containerWidth + 'px'}));
        $(document.body).append(htmlElement);
        $('.tab-card').on('click', function() {
            let id = $(this).attr('id').split('-').pop();
            chosenTab = tabs.findIndex(tab => tab.id == id);
            if (tabs[chosenTab]) {
                chrome.runtime.sendMessage({method: 'activateTab', id: tabs[chosenTab].id});
                removeTabChooser();
            }
        });
    }

    function switchChosenTab(direction) {
        if (direction > 1 || direction < -1) {
            let currentRow = Math.floor(chosenTab / cardsPerRow);
            let rowCount = tabs.length / cardsPerRow;
            rowCount = Math.floor(rowCount) + (rowCount - Math.floor(rowCount) > 0 ? 1 : 0);
            let cardsLastRowCount = tabs.length % cardsPerRow;
            if (cardsLastRowCount === 0) cardsLastRowCount = cardsPerRow;
            let startXOfLastRow = (cardsPerRow - cardsLastRowCount) / 2;
            let xOfCurrentRow = chosenTab % cardsPerRow;
            let nextRow = (currentRow + rowCount + (direction > 0 ? 1 : -1)) % rowCount;
            let nextRowIsLast = nextRow === rowCount - 1;
            let currentRowIsLast = currentRow === rowCount - 1;
            if (currentRowIsLast) {
                // Find closest card
                let xOfChosenCard = startXOfLastRow + (chosenTab % cardsPerRow);
                let closestCard = Math.min(Math.round(xOfChosenCard), cardsPerRow - 1);
                let newDirection = xOfCurrentRow + cardsPerRow - closestCard;
                direction = (direction > 0 ? 1 : -1) * newDirection;
                // console.log('current row is last', xOfChosenCard, closestCard, direction)
            } else if (nextRowIsLast) {
                let minX = 1_000_000;
                let xOfClosestCard = 0;
                for (let i = 0; i < cardsLastRowCount; ++i) {
                    let x = startXOfLastRow + i;
                    let d = Math.abs(x - xOfCurrentRow);
                    if (d < minX) {
                        minX = d;
                        xOfClosestCard = i;
                    }
                } 
                let closestCard = cardsPerRow * nextRow + xOfClosestCard;
                direction = closestCard - chosenTab;
                // console.log('next row is last', xOfCurrentRow, xOfClosestCard, closestCard, direction, cardsPerRow)
            }
        }
        chosenTab = (chosenTab + direction + tabs.length * 100) % (tabs.length || 2);
        // console.log('choosen tab', chosenTab, tabs.length, direction);
        if (!tabs[chosenTab]) return console.log('chose tab failed', chosenTab, tabs.length);
        $('.tab-row .tab-card').removeClass('active');
        $('#tab-card-' + tabs[chosenTab].id).addClass('active');
        let container = $('#main-tab-container');
        if (!container.hasClass('active')) {
            container.addClass('active');
        }
    }

    function removeTabChooser() {
        start = false;
        chosenTab = -1;
        let e = document.getElementById('main-tab-container');
        // console.log('remove tab chooser')
        e && e.remove();
    }

    let template = `
<div class="tabs-container" id="main-tab-container" style="width: {{width}}">
    {{#rows}}
    <div class="tab-row">
        {{#cards}}
        <div class="tab-card" id="tab-card-{{id}}">
            <div>
                <div class="tab-icon" style="background-image: url('{{favIcon}}');"></div>
                <div class="tab-title">{{title}}</div>
            </div>
        </div>
        {{/cards}}
    </div>
    {{/rows}}
</div>`

    window.switchTab = {
        init,
        setKeyChain,
    }
})();
