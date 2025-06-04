/*eslint eqeqeq: ["error", "smart"]*/
/*!
* Data Aquarium Framework  - Universal "Code" Input
* Copyright 2024 Code On Time LLC; Licensed MIT; http://codeontime.com/license
*/

(function () {

    var _app = $app,
        _input = _app.input,
        _touch = _app.touch,
        $settings = _touch.settings,
        resources = Web.DataViewResources,
        resourcesMobile = resources.Mobile,
        // another alternative with categories, tags, and compatibility - https://fonts.google.com/metadata/icons?key=material_symbols&incomplete=true
        //materialSymbolsUrl = '~/js/lib/material-symbols.json', // https://raw.githubusercontent.com/google/material-design-icons/master/update/current_versions.json
        //materialSymbolsUrl2 = 'https://fonts.google.com/metadata/icons?key=material_symbols&incomplete=true',
        materialSymbols,
        materialSymbolsHtml,
        queryTimeout,
        // html utilities
        htmlUtilities = _app.html,
        htmlTag = htmlUtilities.tag,
        div = htmlUtilities.div,
        span = htmlUtilities.span,
        $htmlTag = htmlUtilities.$tag,
        $p = htmlUtilities.$p,
        $div = htmlUtilities.$div,
        $span = htmlUtilities.$span,
        $a = htmlUtilities.$a,
        $i = htmlUtilities.$i,
        $li = htmlUtilities.$li,
        $ul = htmlUtilities.$ul;

    _input.methods.code = {
        _init: function (field, v, _t, enhancementPlaceholder) {
            var enhancement = enhancementPlaceholder.parent();
            var dataInput = enhancement.parent();
            var sourceCode;
            var container;
            var editorHeight;

            function createCodeMirror() {
                var cm = CodeMirror(container[0], {
                    lineNumbers: true,
                    tabSize: 4,
                    matchBrackets: true,
                    readOnly: false,
                    mode,
                    scrollbarStyle: 'simple',
                    value: sourceCode,
                });
                cm.setOption("indentUnit", 4);
                container.find('.CodeMirror').height(editorHeight);
                cm.setSize(null, null);
                dataInput.data('CodeMirror', cm);
                cm.on('change', e => {
                    clearTimeout(dataInput.data('cmSaveTimeout'));
                    dataInput.data('cmSaveTimeout', setTimeout(updateCodeInput, 250, field, cm));
                });
                if (dataInput.data('setFocus'))
                    cm.focus();
            }

            var language = fieldToLanguage(field);
            if (language == 'materialsymbols') {
                var valueIcon = dataInput.find('.app-value-icon');
                if (!valueIcon.length) {
                    dataInput.addClass('app-has-value-icon');
                    valueIcon = $span('app-value-icon').appendTo(dataInput);
                }
                valueIcon.text(v ? toMaterialIcon(v) : '');
            }
            //if (enhancementPlaceholder.closest('[data-layout]').data('state') == 'write')
            if (!field._dataView.editing())
                enhancement.hide();
            else {
                if (field.tagged('input-code-prompt')) {
                    var button = dataInput.find('.app-data-input-button');
                    if (!button.length) {
                        button = $span('app-data-input-button').attr('data-title', resources.Actions.Scopes.Grid.Edit.HeaderText);
                        $span('app-caret').appendTo(button);
                        button.insertBefore(enhancement.hide());
                    }
                    dataInput.addClass('app-has-input-button').attr('data-input', typeof v == 'string' && v.match(/[\r\n]/) ? 'none' : 'text');
                }
                else {
                    enhancement.prev().hide();
                    dataInput.attr('data-input', 'code').removeClass('app-null');
                    container = $div('app-input-code-container').insertAfter(enhancement);//.text('hello world');
                    editorHeight = enhancement.height();
                    if (!editorHeight) {
                        var screen = _touch.screen();
                        editorHeight = screen.isVirtual ? Math.ceil(screen.height * .45) : '45vh';
                    }
                    var editorWidth = getComputedStyle(enhancementPlaceholder[0])['width'];
                    if (editorWidth === '0px' || editorWidth == '100%')
                        editorWidth = '';
                    container.css('width', editorWidth).height(editorHeight);
                    enhancement.hide();

                    var mode = 'text/plain'
                    switch (language) {
                        case 'javascript':
                            mode = 'text/javascript';
                            break;
                        case 'csharp':
                            mode = 'text/x-csharp';
                            break;
                        case 'sql':
                            mode = 'text/x-sql';
                            break;
                        case 'html':
                            mode = {
                                name: "htmlmixed",
                                scriptTypes: [{
                                    matches: /\/x-handlebars-template|\/x-mustache/i,
                                    mode: null
                                }/*,
                            {
                                matches: /(text|application)\/(x-)?vb(a|script)/i,
                                mode: "vbscript"
                                }*/
                                ]
                            };
                            break;
                    }

                    sourceCode = v;
                    if (sourceCode == null)
                        sourceCode = '';



                    if (typeof CodeMirror != 'undefined')
                        createCodeMirror();
                    else

                        _app.getScript('~/js/lib/codemirror.min.js', {
                            also: [
                                '~/js/lib/codemirror.min.css',
                                '~/css/daf/input-code.[min].css'
                            ],
                            then: createCodeMirror
                        });
                }
            }
        },
        render: function (_options) {
            //var that = this,
            //    dataInput = options.container,
            //    inner = options.inner,
            //    field = options.field, 
            //    onDemandStyle = field.OnDemandStyle,
            //    dataView = field._dataView,
            //    video = dataInput.find('app-inner-video');

            //_input.methods.text.render(options);
        },
        focus: function (target) {
            //_touch.hasFocus(target, true);
            var cm = target.data('CodeMirror');
            if (cm)
                cm.focus();
            else
                target.data('setFocus', true);
            var field = _input.elementToField(target);
            if (field)
                _touch.saveLastFocusedField(field);
            return true;
        },
        click: function (e) {
            //_input.methods.text.click(event);
        },
        blur: function (e) {
            //_input.methods.text.blur(event);
        },
        setup: function (e) {
            //_input.methods.text.setup(event);
        },
        dispose: function (target) {
            var cm = target.data('CodeMirror');
            if (cm) {
                clearTimeout(target.data('cmSaveTimeout'));
                cm.off('change');
                cm.getWrapperElement().remove();
            }
        }
    };

    function updateCodeInput(field, cm) {
        var text = cm.getValue();
        field._dataView._editRow[field.Index] = text;
    }

    function fieldToLanguage(field) {
        var language = field.tagged(/\binput\-code\-language\-(.+?)(\s|$)/);
        language = language ? language[1] : 'text';
        language = language.match(/^\-*(.+?)\-*$/);
        return language ? language[1].replace(/\-+/g, '') : null;
    }

    $(document)
        .on('vclick', '[data-input-enhancement="code"] .app-data-input-button', e => {
            var button = $(e.target);
            var settingFocus = button.data('settingFocus');
            button.removeData('settingFocus');
            if (!button.closest('.app-has-focus,.app-was-focused').length) {
                if (settingFocus)
                    return false;
                else {
                    button.data('settingFocus', true);
                    // start with a slight delay to ensure that the info pane is refreshed.
                    setTimeout(() => button.trigger('vclick'), 32);
                }
            }
            else {
                var field = _input.elementToField(button);
                if (field) {
                    var language = fieldToLanguage(field);
                    if (language) {


                        var propGrid = button.closest('.app-propgrid');
                        var options = {
                            text: propGrid.length ? `${propGrid.find('.app-selector-target .app-text').text()}` : false,
                            text2: propGrid.length ? `${$app.prettyText(propGrid.find('.app-selector-target .app-muted').text())}` : false,
                            questions: [
                                //{ name: 'Color' },
                                //{ name: 'Favorite Song' },
                                {
                                    name: 'code',
                                    field: field,
                                    label: propGrid.length ? `${propGrid.find('.app-infopane .app-title .app-text').text()}` : field.HeaderText,
                                    options: {
                                        spellCheck: false
                                    }
                                }
                            ],
                            field: field
                        };

                        var codeIcon = 'subject'
                        switch (language) {
                            case 'javascript':
                                codeIcon = 'javascript';
                                break;
                            case 'sql':
                                codeIcon = 'database';
                                break;
                            case 'html':
                                codeIcon = 'code';
                                break;
                            case 'materialsymbols':
                                codeIcon = 'font_download'
                                break;
                            case 'dataformatstring':
                                codeIcon = 'numbers';
                        }

                        options.icon = codeIcon;

                        var code = field._dataView.fieldValue(field.Name);

                        if (language == 'materialsymbols') {
                            if (materialSymbols) {
                                if (typeof code == 'string')
                                    code = toMaterialIcon(code);

                                options.layout = `
<div data-layout="form" data-layout-size="tn" data-input-container="survey1" data-state="write">
<div  data-container="simple" data-wrap="true" data-header-text="none">
<div data-container="row" data-merge="true">
<span data-control="label" data-field="code" style="font-size:1em"></span>
<div style="display:flex;justify-content:space-between">
<span data-control="field" data-field="code" data-notify="materialsymbolchanged.app" style="max-width:250px;min-width:250px"></span>
<span data-control="field" data-field="category" style="min-width:0;margin-right:24px"></span>
</div>
</div>
</div>${materialSymbolsHtml}
</div>`;
                                options.max = 'md';
                                options.questions[0].placeholder = 'search for an icon';
                                var categoryList = [];
                                for (var categoryKey in materialSymbols.categories) {
                                    var c = materialSymbols.categories[categoryKey];
                                    categoryList.push({ value: categoryKey, text: c.name });
                                }
                                categoryList = categoryList.sort((a, b) => {
                                    if (a.text < b.text)
                                        return -1;
                                    else if (a.text > b.text)
                                        return 1;
                                    return 0;
                                });
                                options.questions.push({
                                    name: 'category',
                                    placeholder: 'category',
                                    items: {
                                        //style: 'DropDownList',
                                        list: categoryList,
                                        targetController2: 'basket'
                                    },
                                    options: {
                                        lookup: {
                                            nullValue: false,
                                            openOnTap: true
                                        }
                                    },
                                    causesCalculate: true
                                });
                                options.discardChangesPrompt = false;
                                //_touch.pageShown(() => {
                                $(document).one('pageready.app', () => {
                                    var menuElem = _touch.activePage('.app-material-symbols-menu');
                                    if (code) {
                                        var codeElem = menuElem.find(`[data-icon="${code}"]`);
                                        if (codeElem.length)
                                            codeElem.addClass('app-selected')[0].scrollIntoView({ block: 'center' });
                                    }
                                });
                                options.calculate = 'materialsymbolscalculate.app';
                                showForm(options, code);
                            }
                            else
                                fetch(_touch.studio() + '/js/lib/material-symbols-catalog.json')
                                    .then(result =>
                                        result.json()
                                    )
                                    .then(data => {
                                        showMaterialSymbolsForm(data, button);
                                    }).catch(ex => {
                                        _touch.notify('Material Symbols are not available.')
                                    });
                        }
                        else {
                            options.questions[0].options.inputCode = {
                                //size: '100%x400',
                                language
                            }

                            showForm(options, code);
                        }
                    }
                }
                return false;
            }
        }).on('vclick', '[data-input-enhancement="code"][data-input="none"] .app-control-inner', e => {
            var controlInner = $(e.target);
            if (_touch.dblClick(controlInner)) {
                controlInner.closest('[data-input]').find('.app-data-input-button').trigger('vclick');
                return false;
            }
        }).on('fullscreen.app', e => {
            _touch.activePage('.CodeMirror').each(function () {
                var cm = $(this).closest('[data-input]').data('CodeMirror');
                if (cm)
                    cm.setSize(null, null);
            });
        }).on('vclick', '.app-material-symbols-menu .app-symbol-button', function (e) {
            var menu = $(e.target).closest('.app-material-symbols-menu');
            menu.find('.app-selected').removeClass('app-selected');
            var symbolButton = $(e.target).closest('[data-icon]')
            var code = symbolButton.attr('data-icon');
            menu.find(`[data-icon="${code}"]`).addClass('app-selected');
            symbolButton[0].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            _input.execute({ code: code });
            _input.focus({ field: 'code' });
            return false;
        }).on('materialsymbolchanged.app', e => {
            var query = e.inputData.value.trim();
            var menu = _touch.activePage('.app-material-symbols-menu');
            clearTimeout(queryTimeout);
            if (query.length)
                queryTimeout = setTimeout(queryMaterialSymbols, 350, menu, query);
            else {
                menu.removeClass('app-query').scrollTop(0).find('.app-selected').removeClass('app-selected');
                _input.execute({ category: null });
            }

        }).on('materialsymbolscalculate.app', e => {
            var data = e.dataView.data();
            if (data.category) {
                var menu = _touch.activePage('.app-material-symbols-menu');
                var section = menu.removeClass('app-query').find(`[data-category="${data.category}"]`);
                if (section.length) {
                    var iconList = section.find('.app-icon-list');
                    iconList[0].scrollIntoView({ block: 'start', behavior: 'instant' });
                    menu.scrollTop(newScrollTop);

                    var newScrollTop = menu.scrollTop() - 4;
                    var selectedIcon = iconList.find('.app-selected');
                    if (selectedIcon.length) {
                        var menuRect = _app.clientRect(menu);
                        var selectedIconRect = _app.clientRect(selectedIcon);
                        if (selectedIconRect.bottom > menuRect.bottom)
                            selectedIcon[0].scrollIntoView({ block: 'center', behavior: 'instant' });
                    }
                    setTimeout(() => menu.focus(), 100);
                }
            }
        });

    /*
    {
"host": "fonts.gstatic.com",
"asset_url_pattern": "/s/i/{family}/{icon}/v{version}/{asset}",
"families": [
"Material Icons",
"Material Icons Outlined",
"Material Icons Round",
"Material Icons Sharp",
"Material Icons Two Tone",
"Material Symbols Outlined",
"Material Symbols Rounded",
"Material Symbols Sharp"
],
"icons": [
{
  "name": "10k",
  "version": 298,
  "popularity": 191,
  "codepoint": 59729,
  "unsupported_families": [
    "Material Icons",
    "Material Icons Outlined",
    "Material Icons Round",
    "Material Icons Sharp",
    "Material Icons Two Tone"
  ],
  "categories": [
    "Audio\u0026Video"
  ],
  "tags": [
    "10000",
    "10K",
    "alphabet",
    "character",
    "digit",
    "display",
    "font",
    "letters",
    "numbers",
    "pixel",
    "pixels",
    "resolution",
    "symbol",
    "text",
    "type",
    "video"
  ],
  "sizes_px": [
    20,
    24,
    40,
    48
  ]
}]
}
    */

    function showMaterialSymbolsForm(symbols, button) {
        materialSymbols = {
            icons: symbols.icons, categories: {}//, search: {}
        };
        symbols.icons.forEach(icon => {
            //var searchKey = `${((Number.MAX_SAFE_INTEGER) - icon.popularity).toString().padStart(16, '0')}::${icon.name} `;
            //materialSymbols.search[searchKey] = icon;
            var categoryName = icon.categories[0] || 'Unknown'
            var categoryKey = categoryName.toLowerCase();
            var category = materialSymbols.categories[categoryKey];
            if (!category) {
                if (categoryName.length == 2)
                    categoryName = categoryName.toUpperCase();
                category = materialSymbols.categories[categoryKey] = {
                    id: categoryKey, name: _app.prettyText(categoryName, true).replace(/\s*\u0026\s*/, ' \u0026 '), popularity: 0, icons: [], iconMap: {}
                };
            }
            if (!category.iconMap[icon.name]) {
                category.iconMap[icon.name] = true;
                category.icons.push(icon);
                category.popularity += icon.popularity;
            }
        });
        var html = ['<div class="app-material-symbols-menu app-has-scrollbars" tabindex="1">'];
        renderSymbolButtons(materialSymbols, html, true);
        html.push('<section class="app-query-result"></section>');
        html.push('</div>')

        //html.push('<div class="app-material-symbols-categories">');
        //for (var categoryKey in materialSymbols.categories)
        //    html.push(`<span data-category="${categoryKey}">${materialSymbols.categories[categoryKey].name}</span>`);
        //html.push('</div>'); // categories

        //html.push('</div>'); // container


        materialSymbolsHtml = html.join('\n');

        _app.getScript('~/css/daf/input-code.[min].css')
            .then(() => button.trigger('vclick'));
    }

    function renderSymbolButtons(symbols, html, addSections) {
        var categoryList = [];
        for (var key in symbols.categories)
            categoryList.push(symbols.categories[key]);
        categoryList.sort((a, b) => {
            if (a.popularity > b.popularity)
                return -1;
            if (a.popularity < b.popularity)
                return 1;
            return 0;
        });
        categoryList.forEach(category => {
            if (addSections)
                html.push(`<section data-category="${category.id}"><h1>${category.name}</h1>`);
            html.push('<div class="app-icon-list">');
            category.icons.forEach(icon =>
                html.push(`<span class="app-symbol-button" data-icon="${icon.name}"><i class="material-icon">${icon.name}</i><span class="app-text">${icon.name.replace(/\_/g, ' ')}</span></span> `)
            );
            html.push('</div>');
            if (addSections)
                html.push('</section>');
        })
    }

    function queryMaterialSymbols(menu, query) {
        var matchCount = 0;
        var matches = {};
        var result = [];

        query = query.toLowerCase().replace(/\s+/g, '_');
        materialSymbols.icons.forEach(icon => {
            var iconName = icon.name;
            if (iconName.match(query)) {
                if (!(iconName in matches)) {
                    result.push(icon);
                    matches[iconName] = true;
                    matchCount++;
                }
            }
            else
                icon.tags.forEach(tag => {
                    if (tag.startsWith(query) && !(iconName in matches)) {
                        result.push(icon);
                        matches[iconName] = true;
                        matchCount++;
                    }
                });
        });

        result = result.sort((a, b) => {
            if (a.popularity > b.popularity)
                return -1;
            if (a.popularity < b.popularity)
                return 1;
            return 0;
        });

        var resultHtml = [];
        renderSymbolButtons(
            {
                categories: {
                    result: { icons: result }
                }
            },
            resultHtml, false);
        menu.find('.app-query-result').html(resultHtml.join(''));
        menu.toggleClass('app-query', matchCount > 0).scrollTop(0);
        setTimeout(() =>
            _input.execute({ category: null })
        );

    }

    function showForm(options, code) {
        var field = options.field;
        _app.survey({
            text: options.text,
            text2: options.text2,
            values: {
                code: code
            },
            topics: [
                {
                    wrap: true,
                    questions: options.questions
                }
            ],
            layout: options.layout,
            options: {
                contentStub: false,
                materialIcon: options.icon,
                layout: options.layout,
                modal: {
                    fitContent: true,
                    always: true,
                    max: options.max
                },
                discardChangesPrompt: options.discardChangesPrompt != false
            },
            calculate: options.calculate,
            submitText: resourcesMobile.Apply,
            submit: codeSaved,
            context: {
                field: options.field
            }
        });
    }

    function codeSaved(e) {
        var field = e.survey.context.field;
        var dataView = e.dataView;
        var data = dataView.data();
        dataView.discard();
        _touch.goBack(() => {
            _input.execute({ field: field.Name, value: data.code })
        });
    }

    function toMaterialIcon(icon) {
        if (icon) {
            if (icon.match(/^material-icon-/))
                icon = icon.substring('material-icon-'.length);
            icon = icon.replace(/\W/g, '_').toLowerCase();
        }
        return icon;
    }

})();