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
    var enabled = true;
    try {
        chrome.runtime.sendMessage({method: 'isEnabled'}, (value) => {
            enabled = value;
        });
        chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
            if (typeof request.enabled === 'boolean') {
                enabled = request.enabled;
                sendResponse(enabled);
            } else if (request.closeAllDefWindows) {
                closeAllDefWindows();
            }
            return true;
        });
    } catch (e) {
        testing = true;
    }

    function start() {
        console.log('$ version', $.fn.jquery);

        $(document.body).on('mouseup', startLookup).on('keyup', closeTopWindow);
        if (!testing) {
            chrome.runtime.sendMessage({
                method: 'getDict'
            }, function (response) {
                cambridgeDict = response || defaultDict;
            });
        }
    }

    /** @param {KeyboardEvent} event*/
    function closeTopWindow(event) {
        if (!event.metaKey && !event.shiftKey && !event.ctrlKey && !event.altKey && !isEditable(event.target)) {
            if (event.key.startsWith('Esc')) {
                closeAllDefWindows();
            } else if (/^[A-Z]$/.test(event.key.toUpperCase())) {
                var max = -1, maxEl;
                $('.cambr-dict-cont').each(function() {
                    let z = +$(this).css('z-index');
                    if (z > max) {
                        max = z;
                        maxEl = this;
                    }
                })
                maxEl && $(maxEl).find('.cambr-dict-header span.cambr-dict-close-btn').trigger('click');
            }
        }
    }

    /** @param {HTMLElement} el */
    function isEditable(el) {
        if (el.isContentEditable) {
            return true;
        }
        var nodeName = el.nodeName.toLowerCase();
        if (el.nodeType == 1 && (nodeName == "textarea" ||
            (nodeName == "input" && /^(?:text|email|number|search|tel|url|password)$/i.test(el.type)))) {
            return true;
        }

        return false;
    }

    function closeAllDefWindows() {
        $('.cambr-dict-header span.cambr-dict-close-btn').trigger('click');
    }

    /** @param {MouseEvent} event */
    function startLookup(event) {
        if (event.ctrlKey && event.shiftKey && event.altKey) {
        } else if (event.ctrlKey && event.shiftKey) {
        } else if (event.ctrlKey) {
            closeAllDefWindows();
        } else if (event.altKey) {
            return;
        }
        if (!enabled || event.button !== 0 || event.target.id.startsWith('camb-dict-word') || event.target.id.startsWith('cambr-dict-header')) {
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
        loadDictWindow(selectedText);
    }

    function loadDictWindow(selectedText) {
        if (history[selectedText.dict + selectedText.text]) {
            render($(Mustache.render(template, history[selectedText.dict + selectedText.text])), selectedText);
        } else if (testing) {
            $.get(`https://dictionary.cambridge.org/dictionary/${selectedText.dict || defaultDict}/${selectedText.text}`, function(text) {
                displayDict(Object.assign({definition: text}, selectedText));
            })
        } else {
            chrome.runtime.sendMessage(selectedText, displayDict);
        }
    }

    function displayDict(response) {
        if (!response) return;
        var dictDef = parseContent(response);
        if (!dictDef.originSource.entries && !testing && response.dict !== 'english' && response.dict.startsWith('english')) {
            response.dict = 'english';
            chrome.runtime.sendMessage(response, displayDict);
            return;
        }
        render(dictDef, response);
    }

    /**
     * 
     * @param {JQuery<HTMLElement>} dictDef 
     * @param {*} selectedText 
     */
    function render(dictDef, selectedText) {
        dictDef.find('br').first().remove();
        $(document.body).append(dictDef);
        var top = selectedText.y - dictDef.outerHeight() - 5;
        var scrollTop = (window.pageYOffset !== undefined) ? window.pageYOffset : (document.documentElement || document.body.parentNode).scrollTop;
        if (top - scrollTop < 0) top = selectedText.y + selectedText.height + 5;
        var left = Math.max(0, Math.min($(document).width() - dictDef.outerWidth(), selectedText.x - dictDef.outerWidth() / 2));
        var selectedTextCopy = JSON.parse(JSON.stringify(selectedText));
        delete selectedTextCopy.definition;
        dictDef.css({top, left, zIndex: ++zIndex, width: Math.min($(document).width(), dictDef.outerWidth())})
            .attr('selected-text', encodeURIComponent(JSON.stringify(selectedTextCopy)));
        dragElement(dictDef[0]);
        dictDef.find('.cambr-dict-header span.cambr-dict-close-btn').on('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            $(this).parent().parent().remove();
            var word = $(this).attr('data-dict');
            openingDefs[word] = Math.max(0, (openingDefs[word] || 0) - 1);
        });
        dictDef.find('.help-btn').on('click', showHelp);
        dictDef.find('select').on('change', setDict);
        dictDef.on('mousedown', function(event) {
            $(this).css('zIndex', ++zIndex);
        });
        dictDef.find('select').val(cambridgeDict || defaultDict);
    }

    /**
     * @typedef {Object} Definition
     * @property {String} def
     * @property {String} trans
     * @property {String} examp
     */
    /**
     * @typedef {Object} Pron
     * @property {String} region
     * @property {String} lab
     * @property {String} aud audio
     * @property {String} ipa
     */
    /**
     * @typedef {Object} Entry 
     * @property {String} word
     * @property {String} pos
     * @property {Array<Pron>} prons
     * @property {Array<Definition>} defs
     */
    /**
     * @param {{doc: JQuery<HTMLElement>}} source
     * @returns {Array<Entry>}
     */
    function findEntriesVn(source) {
        return source.doc.find('.kdic').map((i, elem) => {
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
                word, pos, prons: [{ipa: pron}], defs
            }
        }).toArray();
    }

    /**
     * @param {{doc: JQuery<HTMLElement>}} source
     * @returns {Array<Entry>}
     */
    function findEntriesEn(source) {
        return source.doc.find('.entry-body .pr.entry-body__el').map((i, elem) => {
            var parent = $(elem);
            var word = parent.find('.pos-header .di-title').text().trim();
            var pos = parent.find('.pos-header .pos').text().trim();
            var prons = parent.find('.pos-header > span').map(function() {
                var elem = $(this);
                var region = elem.find('.region').text().trim().toUpperCase();
                var aud = elem.find('.daud audio source[type="audio/ogg"]').attr('src');
                var lab = elem.find('.lab').text().trim();
                var ipa = elem.find('.ipa').text().trim();
                return {region, aud, lab, ipa};
            }).toArray();
            var defs = parent.find('.pos-body .dsense').map(function() {
                var parent = $(this);
                var def = parent.find('.def').text().trim();
                var trans = parent.find('.trans').text().trim() || undefined;
                var examp = parent.find('.examp').map(function(){return $(this).text().replace('●', '').trim()}).toArray();
                return {def, trans, examp};
            }).toArray();

            source.word = source.word || word;
            return {
                word, pos, prons, defs
            }
        }).toArray();
    }

    function findEntries(doc, dict) {
        switch (dict) {
            case 'english-vietnamese': return findEntriesVn(doc);
            default: return findEntriesEn(doc);
        }
    }

    function parseContent(response) {
        var source = {doc: $(response.definition)};
        var entries = findEntries(source, response.dict);
        if (!entries.length) {
            source = {
                origin: response.text,
                id: idFn(),
                word: decodeURIComponent(response.text),
            };
        } else {
            if (response.dict !== cambridgeDict) {
                entries.unshift({word: '', pos: `No definition or translation of "${response.text}" in ${dictNames[cambridgeDict]} Dictionary, show in English Dictionary below.`})
            }
            source.origin = response.text;
            source.entries = entries;
            source.id = idFn();
        }

        testing && console.log(source);
        history[cambridgeDict + response.text] = source;
        var dictDef = $(Mustache.render(template, source));
        dictDef.originSource = source;
        return dictDef;
    }

    let id = 1;
    const idFn = _ => id++;
    var dictNames = {
        "english-vietnamese": "English–Vietnamese",
        "english": "English",
        "english-arabic": "English–Arabic",
        "english-catalan": "English–Catalan",
        "english-chinese-traditional": "English–Chinese (Tra)",
        "english-chinese-simplified": "English–Chinese (Sim)",
        "english-czech": "English–Czech",
        "english-danish": "English–Danish",
        "english-french": "English–French",
        "english-german": "English–German",
        "english-indonesian": "English–Indonesian",
        "english-italian": "English–Italian",
        "english-japanese": "English–Japanese",
        "english-korean": "English–Korean",
        "english-malay": "English–Malay",
        "english-norwegian": "English–Norwegian",
        "english-polish": "English–Polish",
        "english-portuguese": "English–Portuguese",
        "english-spanish": "English–Spanish",
        "english-russian": "English–Russian",
        "english-thai": "English–Thai",
        "english-turkish": "English–Turkish",
        "dutch-english": "Dutch–English",
        "french-english": "French–English",
        "germanenglish": "German–English",
        "indonesian-english": "Indonesian–English",
        "italian-english": "Italian–English",
        "japanese-english": "Japaneschemase–English",
        "polish-english": "Polish–English",
        "portuguese-english": "Portuguese–English",
        "spanish-english": "Spanish–English",
    };
    var template = `
    <div class="cambr-dict-cont" id="camb-dict-word-{{id}}">
        <div class="cambr-dict-header" id="camb-dict-word-{{id}}-header">
            <span class="cambr-dict-title">Cambridge Dictionanry</span>
            <span id="camb-dict-word-{{id}}-close" class="cambr-dict-close-btn" data-dict="{{origin}}">x</span>
        </div>
        <div class="cambr-dict-content">
            {{#entries}}
                <br/>
                <div class="word">{{word}}</div>
                {{#pos}}
                    <div class="pos">{{pos}}</div>
                {{/pos}}
                <div class="prons">
                {{#prons}}
                    <span>
                        {{#region}}
                            <span class="region">{{region}}</span>&nbsp
                        {{/region}}
                        {{#lab}}
                            <span class="lab">{{lab}}</span>&nbsp
                        {{/lab}}
                        {{#aud}}
                        {{/aud}}
                        {{#ipa}}
                            <span class="ipa">/{{ipa}}</span>
                        {{/ipa}}
                    </span>&nbsp
                {{/prons}}
                </div>
                {{#defs}}
                    <div class="def">- {{def}}</div>
                    {{#trans}}
                        <div class="trans">= {{trans}}</div>
                    {{/trans}}
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
                <dictsllist/>
            </select>
            <button class="help-btn">Help</button>
        </div>
    </div>
    `.replace('<dictsllist/>', Object.getOwnPropertyNames(dictNames).map(dict => `<option value="${dict}">${dictNames[dict]}</option>`).join('\n'));
    
    function showHelp() {
        var currentHelper = $('.cambr-dict-cont.helper');
        if (currentHelper.length) {
            currentHelper.css('zIndex', ++zIndex);
            return;
        }
        var parent = $(this).parent().parent();
        var selectedText = JSON.parse(decodeURIComponent(parent.attr('selected-text')));
        var dialog = $(`
        <div class="cambr-dict-cont helper">
            <div class="cambr-dict-header">
                <span class="cambr-dict-title">Cambridge Dictionanry</span>
                <span class="cambr-dict-close-btn" data-dict="helper-999">x</span>
            </div>
            <div class="cambr-dict-content">
                <br/>
                <div>Shortcuts:</div>
                <ul>
                    <li>Ctrl+Shift+Q: Toggle enable/disable dictionary lookup (can change shortcut in Chrome extension manager).</li>
                    <li>Esc or Ctrl+Shift+Z or Ctrl+Left Click: Close all dictionary windows.</li>
                    <li>A-Z: Close top-most dictionary window.</li>
                    <li>Alt+Select Text: Select text without open dictionary</li>
                </ul>
            </div>
        </div>
        `);
        render(dialog, selectedText);
    }

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
        var sts = $('.cambr-dict-cont').map(function() {
            var container = $(this);
            return JSON.parse(decodeURIComponent(container.attr('selected-text')));
        }).toArray();
        closeAllDefWindows();
        sts.forEach(selectedText => {
            selectedText.dict = newDict;
            loadDictWindow(selectedText);
        });
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