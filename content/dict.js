(function () {
    window.onload = function () {
        loadjQuery();
        start();
    }

    var cambridgeDict = '';
    var defaultDict = 'english-vietnamese';
    var openingDefs = {};
    var history = {};
    var zIndex = 999999;
    var testing = false;
    try {
        chrome.runtime.sendMessage({}, function() {});
    } catch (e) {
        testing = true;
    }

    function start() {
        console.log('$ version', $.fn.jquery);

        $(document.body).on('mouseup', startLookup);
        if (!testing) {
            chrome.runtime.sendMessage({
                method: 'getDict'
            }, function (response) {
                cambridgeDict = response;
            });
        }
    }

    /** @param {MouseEvent} event */
    function startLookup(event) {
        if (event.ctrlKey && event.shiftKey && event.altKey) {
        } else if (event.ctrlKey && event.shiftKey) {
        } else if (event.ctrlKey) {
            $('.cambr-dict-header span.cambr-dict-close-btn').trigger('click');
        }
        if (event.button !== 0 || event.target.id.startsWith('camb-dict-word') || event.target.id.startsWith('cambr-dict-header')) {
            return;
        }
        var selectedText = getSelectedText();
        if (!selectedText || !selectedText.text || openingDefs[selectedText.text]) {
            return;
        }

        openingDefs[selectedText.text] = (openingDefs[selectedText.text] || 0) + 1;
        Object.assign(selectedText, {
            method: 'loadDict',
            dict: cambridgeDict
        });
        if (history[cambridgeDict + selectedText.text]) {
            render($(Mustache.render(template, history[cambridgeDict + selectedText.text])), selectedText);
        } else if (testing) {
            $.get(`https://dictionary.cambridge.org/dictionary/${selectedText.dict || defaultDict}/${selectedText.text}`, function(text) {
                displayDict(Object.assign({definition: text}, selectedText));
            })
        } else {
            chrome.runtime.sendMessage(selectedText, displayDict);
        }
    }

    function displayDict(response) {
        var dictDef = parseContent(response);
        render(dictDef, response);
    }

    function render(dictDef, selectedText) {
        dictDef.find('br').first().remove();
        $(document.body).append(dictDef);
        var top = selectedText.y - dictDef.outerHeight() - 5;
        var scrollTop = (window.pageYOffset !== undefined) ? window.pageYOffset : (document.documentElement || document.body.parentNode).scrollTop;
        if (top - scrollTop < 0) top = selectedText.y + selectedText.height + 5;
        var left = Math.max(0, Math.min($(document).width() - dictDef.outerWidth(), selectedText.x - dictDef.outerWidth() / 2))
        dictDef.css({top, left, zIndex, width: Math.min($(document).width(), dictDef.outerWidth())});
        dragElement(dictDef[0]);
        dictDef.find('.cambr-dict-header span.cambr-dict-close-btn').on('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            $(this).parent().parent().remove();
            var word = $(this).attr('data-dict');
            openingDefs[word] = Math.max(0, (openingDefs[word] || 0) - 1);
        });
        dictDef.find('select').on('change', setDict);
        dictDef.on('mousedown', function(event) {
            $(this).css('zIndex', ++zIndex);
        });
        dictDef.find('select').val(cambridgeDict || defaultDict);
    }

    function parseContent(response) {
        var source = {};
        var doc = $(response.definition);
        var entries = doc.find('.kdic').map((i, elem) => {
            var parent = $(elem);
            var word = parent.find('.di-title').text().trim();
            var pos = parent.find('.di-head .pos').text().trim();
            var pron = parent.find('.di-head .pron').text().trim();
            var defs = parent.find('.pos-body .pr').map(function() {
                var parent = $(this);
                var def = parent.find('.def-head').text().replace('●', '').trim();
                var trans = parent.find('.trans').text().trim();
                var examp = parent.find('.examp').map(function() {return $(this).text().trim()}).toArray();
                return {
                    def, trans, examp
                }
            }).toArray();

            source.word = source.word || word;
            return {
                word, pos, pron, defs
            }
        }).toArray();
        var idFn = _ => Math.round(Math.random() * 1_000_000);
        if (!entries.length) {
            source = {
                origin: response.text,
                id: idFn(),
                word: decodeURIComponent(response.text),
            };
        } else {
            source.origin = response.text;
            source.entries = entries;
            source.id = idFn();
        }

        testing && console.log(source);
        history[cambridgeDict + response.text] = source;
        var dictDef = $(Mustache.render(template, source));
        return dictDef;
    }

    var template = `
    <div class="cambr-dict-cont" id="camb-dict-word-{{id}}">
        <div class="cambr-dict-header" id="camb-dict-word-{{id}}-header">
            <span class="cambr-dict-title">Cambridge Dictionanry</span> <span id="camb-dict-word-{{id}}-close" class="cambr-dict-close-btn" data-dict="{{origin}}">x</span>
        </div>
        <div class="cambr-dict-content">
            {{#entries}}
                <br/>
                <div class="word">{{word}}</div>
                {{#pos}}
                    <div class="pos">{{pos}}</div>
                {{/pos}}
                {{#pron}}
                    <div class="pron">{{pron}}</div>
                {{/pron}}
                {{#defs}}
                    <div class="def">- {{def}}</div>
                    <div class="trans">= {{trans}}</div>
                    {{#examp.length}}
                    <ul>
                    {{/examp.length}}
                    {{#examp}}
                        <li class="examp">{{.}}</li>
                    {{/examp}}
                    {{#examp.length}}
                    </ul>
                    {{/examp.length}}
                {{/defs}}
            {{/entries}}
            {{^entries}}
                <div class="word">{{word}}</div>
                <div class="pos">No definition or translation</div>
            {{/entries}}
            <div class="dictsl">Select dictionary:</div>
            <select class="dictsllist">
                <option value="english-vietnamese">English–Vietnamese</option>
                <option value="english-arabic">English–Arabic</option>
                <option value="english-catalan">English–Catalan</option>
                <option value="english-chinese-traditional">English–Chinese (Tra)</option>
                <option value="english-chinese-simplified">English–Chinese (Sim)</option>
                <option value="english-czech">English–Czech</option>
                <option value="english-danish">English–Danish</option>
                <option value="english-french">English–French</option>
                <option value="english-german">English–German</option>
                <option value="english-indonesian">English–Indonesian</option>
                <option value="english-italian">English–Italian</option>
                <option value="english-japanese">English–Japanese</option>
                <option value="english-korean">English–Korean</option>
                <option value="english-malay">English–Malay</option>
                <option value="english-norwegian">English–Norwegian</option>
                <option value="english-polish">English–Polish</option>
                <option value="english-portuguese">English–Portuguese</option>
                <option value="english-spanish">English–Spanish</option>
                <option value="english-russian">English–Russian</option>
                <option value="english-thai">English–Thai</option>
                <option value="english-turkish">English–Turkish</option>
                <option value="dutch-english">Dutch–English</option>
                <option value="french-english">French–English</option>
                <option value="germanenglish">German–English</option>
                <option value="indonesian-english">Indonesian–English</option>
                <option value="italian-english">Italian–English</option>
                <option value="japanese-english">Japanese–English</option>
                <option value="polish-english">Polish–English</option>
                <option value="portuguese-english">Portuguese–English</option>
                <option value="spanish-english">Spanish–English</option>
            </select>
        </div>
    </div>
    `;

    function getSelectedText() {
        var selection = window.getSelection();
        if (!selection.rangeCount) return;
        var rect = selection.getRangeAt(0).getBoundingClientRect();
        var scrollTop = (window.pageYOffset !== undefined) ? window.pageYOffset : (document.documentElement || document.body.parentNode).scrollTop;
        var scrollLeft = (window.pageXOffset !== undefined) ? window.pageXOffset : (document.documentElement || document.body.parentNode).scrollLeft;
        var text = selection.toString().replace(/\s{2,1000}/g, ' ').trim().replace(/\s/g, '-');
        return {
            text: encodeURIComponent(text),
            x: rect.x + scrollLeft + rect.width / 2,
            y: rect.y + scrollTop,
            height: rect.height,
            dict: cambridgeDict
        };
    }

    function setDict() {
        var newDict = $(this).val();
        if (testing) {
            cambridgeDict = newDict;
        } else {
            chrome.runtime.sendMessage({
                method: 'setDict',
                dict: newDict
            }, function (response) {
                if (response) {
                    cambridgeDict = response;
                }
            })
        }
    }

    function dragElement(elmnt) {
        var pos1 = 0,
            pos2 = 0,
            pos3 = 0,
            pos4 = 0;
        if (document.getElementById(elmnt.id + "-header")) {
            // if present, the header is where you move the DIV from:
            document.getElementById(elmnt.id + "-header").onmousedown = dragMouseDown;
        } else {
            // otherwise, move the DIV from anywhere inside the DIV:
            elmnt.onmousedown = dragMouseDown;
        }

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            // get the mouse cursor position at startup:
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            // call a function whenever the cursor moves:
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            // calculate the new cursor position:
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            // set the element's new position:
            elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
            elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
        }

        function closeDragElement(e) {
            e.stopPropagation();
            // stop moving when mouse button is released:
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }
})();