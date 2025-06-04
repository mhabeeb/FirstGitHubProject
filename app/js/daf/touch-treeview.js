/*eslint eqeqeq: ["error", "smart"]*/
/*!
* Touch UI - Tree View
* Copyright 2023-2024 Code On Time LLC; Licensed MIT; http://codeontime.com/license
*/

(function () {
    var _app = $app,
        _input = _app.input,
        _touch = _app.touch,
        $document = $(document),
        hypermediaIcons = {
            create: 'material-icon-add',
            delete: 'material-icon-delete',
            rename: 'material-icon-drive_file_rename_outline'
        },
        resources = Web.DataViewResources,
        resourcesEditor = resources.Editor,
        booleanDefaultItems = resources.Data.BooleanDefaultItems,
        getBoundingClientRect = _app.clientRect,
        // core variables

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

    _touch.treeView = function (method, options, resolve, reject) {
        if (resolve) {
            _touch.treeView.ready = true;
            resolve();
            if (!method)
                return;
        }
        if (typeof method != 'string') {
            options = method;
            method = 'show';
        }
        var nodes = options.nodes;
        if (nodes instanceof Promise) {
            nodes.then(hierarchy => {
                options.nodes = hierarchy.nodes || {};
                _touch.treeView(method, options);
            })
        }
        else {
            var treeView = options.treeView,
                trackSelection = options.trackSelection;
            if (treeView) {
                nodes = options.nodes || treeView.data('nodes');
                createNodes($ul().appendTo(treeView.empty()), nodes, null);
            }
            else {
                var globals = {
                    accept: []
                };
                traverseNodes(nodes, null, globals);
                treeView = $div('app-treeview app-has-scrollbars').attr({ 'data-hierarchy': options.type, 'tabindex': -1 })
                    .data({
                        nodes,
                        trackSelection,
                        multiSelect: options.multiSelect,
                        dragDrop: options.dragDrop,
                        accept: globals.accept
                    });
                createNodes($ul().appendTo(treeView), nodes, null);
                if (options.container)
                    treeView.appendTo(options.container);
                if (options.before)
                    treeView.insertBefore(options.before);
                if (options.after)
                    treeView.insertAfter(options.after);
            }
            treeView.toggleClass('app-treeview-noicons', options.icons === false);
            var selectedNodePath = options.path || (trackSelection ? _app.userVar('treeview.' + options.type) : null);
            if (selectedNodePath) {
                navigating(true);
                navigateToNode(treeView.find('ul'), selectedNodePath);
            }
        }

    };

    function traverseNodes(nodes, parent, globals) {
        for (var nodeName in nodes) {
            var n = nodes[nodeName] || {};
            n.name = nodeName;
            if (parent)
                n.parent = parent;
            var accept = n.accept;
            if (accept) {
                if (!(accept instanceof Array)) {
                    accept = accept.toString().split(/\s+/g);
                }
                var acceptedNodeTypes = [];
                accept.forEach(nodeType => {
                    var m = nodeType.match(/^(\w+(\:[\w\-]+)?)$/);
                    if (m && m[2])
                        acceptedNodeTypes.push(nodeType);
                    else
                        acceptedNodeTypes.push(nodeType + ':move', nodeType + ':copy');
                });
                n.accept = acceptedNodeTypes;
                acceptedNodeTypes.forEach(nodeType => {
                    var ifSame = nodeType.match(/^(.+?\:(move|copy)-if-same-)(.+)$/);
                    if (ifSame)
                        nodeType = ifSame[1];
                    if (!globals.accept.includes(nodeType))
                        globals.accept.push(nodeType);
                });
            }
            var actions = n.actions;
            if (actions)
                for (var actionName in actions) {
                    var a = actions[actionName];
                    if (typeof a == 'string')
                        actions[actionName] = {
                            execute: a
                        };
                }
            if (n.nodes)
                traverseNodes(n.nodes, n, globals);
        }
    }

    function navigating(state, hideTree) {
        var currentState = _touch.treeView._navigating;
        if (arguments.length && currentState != state) {
            _touch.treeView._navigating = state;
            _touch.activePage('.app-treeview').css('visibility', state && hideTree != false ? 'hidden' : '');
        }
        return currentState;
    }

    function navigateToNode(container, nodePath) {
        var selectedNode;
        if (typeof nodePath == 'string') {
            var pathInfo = nodePath.match(/^(.+?)\:\/\/(.+)$/);
            if (pathInfo) {
                var context = _touch.treeView.context(container);
                if (context.hierarchy.endsWith('.' + pathInfo[1]))
                    nodePath = pathInfo[2];
                else {
                    navigating(false);
                    context.eventName = 'navigate';
                    context.path = nodePath;
                    var navigateEvent = $.Event('treeview.app', { treeView: context });
                    $(document).trigger(navigateEvent);
                    if (navigateEvent.isDefaultPrevented())
                        return;
                    else
                        _touch.notify({ text: `Unable to navigate to ${nodePath}`, duration: 'long' });
                }
            }
            nodePath = nodePath.split(/\//g);
            if (nodePath[0].match(/^\./) && nodePath.length === 1) {
                navigating(false);
                _touch.propGrid.select(nodePath[0].substring(1));
                return;
            }
            nodePath.forEach((n, index) => {
                if (!n.match(/^\./))
                    n = n.toLowerCase();
                nodePath[index] = decodeURIComponent(n);
            });
            if (nodePath[0] === '.') {
                // relative path "./" specified from the selected node
                selectedNode = container.find('.app-selected');
                nodePath.splice(0, 1, selectedNode.data('nodeId'));
            }
            else if (nodePath[0] === '..') {
                selectedNode = container.find('.app-selected');
                while (nodePath.length && nodePath[0] == '..') {
                    nodePath.splice(0, 1, selectedNode.data('nodeId'));
                    selectedNode = selectedNode.parent().closest('li');
                }
            }
        }
        if (nodePath.length) {
            if (!selectedNode)
                container.find('>li').each(function () {
                    var node = $(this);
                    var nodeId = node.data('nodeId');
                    if (nodeId === nodePath[0]) {
                        selectedNode = node;
                        return false;
                    }
                });
            if (selectedNode) {
                if (!nodePath._cleared) {
                    selectedNode.closest('.app-treeview').find('.app-selected').removeClass('app-selected');
                    nodePath._cleared = true;;
                }
                nodePath.splice(0, 1);
                var doSelect = true;
                if (nodePath.length === 1 && nodePath[0].match(/^\./)) {
                    var dataView = _touch.dataView();
                    _app.userVar(`${dataView._survey.context.instance}.navigate`, nodePath[0]);
                }
                else if (nodePath.length) {
                    doSelect = false;
                    if (selectedNode.is('.app-collapsed')) {
                        selectedNode.find('>.app-node>.app-toggle').trigger('vclick');
                    }
                    navigateToNode(selectedNode.find('ul'), nodePath);
                }
                if (doSelect) {
                    var nodeText = selectedNode.data('navigating', true).find('>.app-node').trigger('vclick');
                    selectedNode.removeData('navigating');
                    var anchor = nodeText.find('.app-anchor')[0];
                    if (anchor)
                        if (_touch.busy() || navigating())
                            anchor.scrollIntoView({ block: toSafeScrollBlock('center'), behavior: 'instant' });
                        else {
                            // TODO: remove this code. Navigation is always instant.
                            var treeViewRect = getBoundingClientRect(nodeText.closest('.app-treeview'));
                            var nodeTextRect = getBoundingClientRect(nodeText);
                            if (!(nodeTextRect.top > treeViewRect.top && nodeTextRect.bottom < treeViewRect.bottom)) {
                                //setTimeout(() => {
                                //    anchor.scrollIntoView({ block: 'center', behavior: 'smooth' })
                                //}, 32);
                                _touch.pageShown(() => {
                                    setTimeout(() => {
                                        anchor.scrollIntoView({ block: toSafeScrollBlock('center'), behavior: 'smooth' })
                                    });
                                });
                            }
                        }
                    navigating(false);
                }

            }
            else {
                var loading = container.find('>.app-loading');
                if (loading.length)
                    loading.data('navigate', nodePath);
                else
                    navigating(false);
            }
        }
    }

    function findParentNodeTemplate(nodeTemplate, nodeName) {
        var result = null;
        if (nodeTemplate) {
            if (nodeTemplate.name == nodeName)
                result = nodeTemplate;
            if (!result) {
                if (nodeTemplate.nodes)
                    result = nodeTemplate.nodes[nodeName];
                if (!result || result.clone)
                    result = findParentNodeTemplate(nodeTemplate.parent, nodeName);
            }
        }
        return result;
    }

    function mapNodeProps(template) {
        var map = {};
        for (var key in template)
            map[key] = template[key];
        return map;
    }

    function createNodes(parent, nodes, nodeData, placeholder) {
        var treeView = parent.closest('.app-treeview'),
            drag = treeView.data('dragDrop');
        var parentData = null;
        for (var nodeName in nodes) {
            var masterNodeTemplate = nodes[nodeName];
            var nodeTemplate = mapNodeProps(masterNodeTemplate);
            if (nodeTemplate.clone) {
                var parentTemplate = findParentNodeTemplate(nodeTemplate.parent, nodeTemplate.clone);
                if (parentTemplate) {
                    parentTemplate = mapNodeProps(parentTemplate);
                    for (var key in nodeTemplate)
                        if (!key.match(/^(clone|name|parent)$/))
                            parentTemplate[key] = nodeTemplate[key];
                    nodeTemplate = parentTemplate;
                }
            }
            var instanceData = nodeData;
            try {
                if (!instanceData && !nodeTemplate.iterate && nodeTemplate.inherit) {
                    if (!parentData) {
                        parentData = parent.closest('li').data();
                        instanceData = {};
                        instanceData[parentData.nodeName] = parentData.nodeData;
                        parentData = instanceData;
                    }
                    instanceData = parentData;
                }

                var text = _app.eval(nodeTemplate.text, instanceData) || _app.prettyText(nodeName, true);
                var id = nodeTemplate.id ? _app.eval(nodeTemplate.id, instanceData) : text;
                if (nodeTemplate.text == null || nodeTemplate.text === text)
                    id = nodeName;
                var nodeType = nodeTemplate.type;
                var li = $li().attr({ 'data-type': nodeType && nodeType.match(/\s+/) ? '' : nodeType }).data({ nodeName, nodeTemplate, nodeData, nodeId: encodeURIComponent(id.toLowerCase()) });
                if (nodeName === '_root')
                    li.addClass('app-root');
                if (placeholder)
                    li.insertBefore(placeholder);
                else
                    li.appendTo(parent);
                var textSpan = $span('app-node').appendTo(li);
                if (drag)
                    textSpan.attr('data-draggable', 'treeview');
                $span('app-anchor').appendTo(textSpan);
                var textNode = $span('app-text').appendTo(textSpan).text(text);
                if (nodeTemplate.textMuted) {
                    var mutedText = _app.eval(nodeTemplate.textMuted, instanceData);
                    if (mutedText != null)
                        $span('app-muted').appendTo(textSpan).text(mutedText);
                }
                var icon = nodeTemplate.icon;
                if (icon) {
                    icon = _app.eval(icon, instanceData);
                    if (typeof icon == 'string') {
                        var materialIcon = icon.match(/^material-icon-(.+)$/);
                        if (materialIcon)
                            $htmlTag('i', 'app-icon material-icon').text(materialIcon[1].replace(/\W/i, '_')).appendTo(textNode);
                        else {
                            if (!icon.match(/^[\w\-_]+$/))
                                icon = '';
                            materialIcon = icon.match(/^material-symbol-(.+)$/);
                            if (materialIcon)
                                $span('symbol').text(materialIcon[1].replace(/\-/g, '_')).appendTo($htmlTag('i', 'app-icon material-symbol ' + icon).appendTo(textSpan));
                            else
                                $htmlTag('i', 'app-icon ' + icon).appendTo(textSpan);
                        }
                    }
                }
                if (nodeTemplate.iterate && nodeData == null) {
                    textSpan.text('Loading...');
                    var templateNodeData = li.addClass('app-loading').data();
                    templateNodeData.nodeId += '-loading';
                    var parentNode = parent.closest('li');
                    if (!parentNode.length || parentNode.is('.app-expanded')) {
                        createNodesFromTemplate(nodeName, nodeTemplate, parent, li);
                    }
                }
                else {
                    var tooltip = nodeTemplate.tooltip;
                    if (typeof tooltip == 'string')
                        textNode.attr('data-title', _app.eval(tooltip, instanceData));
                    var children = nodeTemplate.nodes;
                    var terminal = nodeTemplate.terminal;
                    if (typeof terminal == 'string')
                        terminal = _app.eval(terminal, instanceData);

                    if (children) {
                        if (terminal)
                            children = null;
                    }
                    else if (terminal != null && !terminal)
                        children = [nodeTemplate];
                    if (children) {
                        li.addClass(nodeTemplate.expanded ? 'app-expanded' : 'app-collapsed');
                        $span('app-toggle').appendTo(textSpan);
                        var itemContainer = $ul().appendTo(li);
                        createNodes(itemContainer, children);
                        if (itemContainer.find('> li.app-loading').length)
                            itemContainer.find('> li:not(.app-loading)').addClass('app-loading-wait');
                    }
                }

            } catch (ex) {
                _touch.notify({ text: ex.message + ': \n' + JSON.stringify(clearParentOfNode(nodeTemplate), null, 2), duration: 'long' });
                throw ex;
            }

        }
    }

    function clearParentOfNode(nodeTemplate) {
        nodeTemplate.parent = null
        if (nodeTemplate.nodes)
            for (var key in nodeTemplate.nodes)
                clearParentOfNode(nodeTemplate.nodes[key]);
        return nodeTemplate;
    }

    function createNodesFromTemplate(nodeName, nodeTemplate, parent, li) {
        var e = triggerTreeViewEvent('iterate', li);
        if (e.isDefaultPrevented()) {
            li.remove();
            return;
        }
        var fetchNodeRequest = e.treeView.result;
        if (!(fetchNodeRequest instanceof Promise)) {
            if (!Array.isArray(fetchNodeRequest))
                fetchNodeRequest = [fetchNodeRequest];
            fetchNodeRequest = Promise.resolve(fetchNodeRequest);
        }
        fetchNodeRequest
            .then(list => {
                var nodeInstance = {};
                nodeInstance[nodeName] = nodeTemplate;
                list.forEach(nodeData => {
                    createNodes(parent, nodeInstance, nodeData, li);
                });
                parent.find('> li.app-loading-wait').removeClass('app-loading-wait');
                var navigate = li.data('navigate');
                li.remove(); // remove the first temlate item
                if (!list.length && !parent.find('.app-node').length)
                    parent.closest('li').removeClass('app-expanded').find('.app-node .app-toggle').remove();
                if (navigate)
                    navigateToNode(parent, navigate);
                else {
                    var parentItem = parent.parent();
                    var pendingResult = parentItem.data('pendingResult');
                    if (pendingResult) {
                        parentItem.removeData('pendingResult');
                        if (pendingResult.navigating)
                            navigating(false, true);
                        parent.prev('ul').remove();
                        var treeView = parent.closest('.app-treeview');
                        var selectIdentifiers = pendingResult.selectIdentifiers;
                        if (selectIdentifiers) {
                            selectIdentifiers.forEach((id, index) => selectIdentifiers[index] = id.toLowerCase());
                            parent.find('li').each(function () {
                                var li = $(this);
                                var identifierIndex = selectIdentifiers.indexOf(li.data().nodeId);
                                if (identifierIndex >= 0) {
                                    li.addClass('app-selected');
                                    selectIdentifiers.splice(identifierIndex, 1);
                                }
                            });
                            var selectedItem = parent.find('.app-selected').first();
                            if (selectedItem.length) {
                                var treeRect = getBoundingClientRect(treeView);
                                var selectedItemRect = getBoundingClientRect(selectedItem);
                                if (treeRect.top > selectedItemRect.top || treeRect.bottom < selectedItemRect.bottom)
                                    selectedItem[0].scrollIntoView(({ block: 'nearest', behavior: 'instant' }))
                                triggerTreeViewEvent('select', selectedItem);
                            }
                            else if (selectIdentifiers.length) {
                                var itemsToExpand = {};
                                selectIdentifiers.forEach(identifier => {
                                    var newId = identifier.split(/\//g);
                                    if (newId.length > 1) {
                                        var parentId = newId[0];
                                        var childIdentifiers = itemsToExpand[parentId];
                                        if (!childIdentifiers)
                                            childIdentifiers = itemsToExpand[parentId] = [];
                                        newId.splice(0, 1);
                                        childIdentifiers.push(newId.join('/'));
                                    }
                                });
                                for (var parentIdentifier in itemsToExpand) {
                                    var item = parent.find('li.app-collapsed').filter(function () {
                                        return $(this).data('nodeId') == parentIdentifier;
                                    });
                                    if (item.length) {
                                        item.data('pendingResult', { success: true, navigating: true, selectIdentifiers: itemsToExpand[parentIdentifier] });
                                        navigating(true, true);
                                        item.find('> .app-node .app-toggle').trigger('vclick');
                                    }
                                }
                            }
                            else {
                                // clear the Property Grid selection
                                triggerTreeViewEvent('select');
                            }
                        }
                        else {
                            if (!list.length && !parent.find('li').length)
                                parent.remove();
                            triggerTreeViewEvent('select');
                        }
                    }
                    if (!pendingResult || !parentItem.is('.app-expanded'))
                        scrollExpandedChildrenIntoView(parent.parent());
                }
            })
            .catch(ex => {
                _touch.notify({ text: ex.errors ? ex.errors[0].message : ex.message, duration: 'long' });
                throw ex;
            });
    }

    /********************************************************************
     * related:
     * - ancestor::controller/views/view/fieldName:${this.name}
     * - ancestor::controller/views/view/category/fieldName:${this.name}
     * - ancestor::controller/fields/name:${this.name}
     * - ancestor::views/view/fieldName:${this.name}
     * - ancestor::views/view/category/fieldName:${this.name}
     * - ancestor::controller/fields/name:${this.name}
     * - ancestor::views/view/fieldName:${this.name}
     * - ancestor::views/view/category/fieldName:${this.name}
     ********************************************************************/

    //function iterateNodes(startElem, path, callback) {
    //    var targetElem = startElem;
    //    var targetData;
    //    var rawSelector = path.match(/^(.+?)(\/|$)/);
    //    if (rawSelector) {
    //        var nodes = [];
    //        var selector = rawSelector[1].match(/^(\w+\:+)?(.+)$/);
    //        if (selector[1] === 'ancestor::') {
    //            targetElem = targetElem.parent().closest('li');
    //            while (targetElem.length) {
    //                targetData = targetElem.data();
    //                if (targetData.nodeName === selector[2]) {
    //                    nodes.push(targetElem);
    //                    break;
    //                }
    //                targetElem = targetElem.parent().closest('li');
    //            }
    //        }
    //        else {
    //            var children = targetElem.find('> ul > li');
    //            targetElem = null;
    //            children.each(function () {
    //                var child = $(this);
    //                targetData = child.data();
    //                if ((!selector[1] || selector[1] === 'name::') && targetData.nodeName === selector[2] ||
    //                    selector[1] && targetData.nodeData && targetData.nodeData[selector[1].substring(0, selector[1].length - 1)] == selector[2]) {
    //                    nodes.push(child);
    //                }
    //            });
    //        };
    //        if (nodes.length) {
    //            path = path.substring(rawSelector[0].length);
    //            nodes.forEach(n =>
    //                iterateNodes(n, path, callback)
    //            );
    //        }
    //    }
    //    else {
    //        callback(targetElem);
    //    }
    //}

    function replaceNode(treeView, nodeData) {
        treeView.nodeType = toNodeType(treeView.node, nodeData);
        var selfUrl = nodeData?._links?.self?.href;
        var relatedUrl = nodeData?._links?.related?.href;
        var nodesToReplace = [];
        var selfNodes = [];

        treeView.elem.find('li:not(.app-loading)').each(function () {
            var li = $(this),
                links = li.data()?.nodeData?._links;
            if (links) {
                var nodeSelfUrl = links?.self?.href;
                var nodeRelatedUrl = links?.related?.href;
                if (nodeSelfUrl === selfUrl)
                    selfNodes.push(li);
                else {
                    if (nodeSelfUrl && (nodeSelfUrl === selfUrl || nodeSelfUrl === relatedUrl) || nodeRelatedUrl && (nodeRelatedUrl === selfUrl || nodeRelatedUrl === relatedUrl))
                        nodesToReplace.push(li);
                }
            }
        });
        selfNodes.forEach(nodeElem => replaceNodeElement(nodeElem, nodeData))
        nodesToReplace.forEach(nodeElem => {
            var e = triggerTreeViewEvent('get', nodeElem);
            var getResult = e.treeView.result;
            if (getResult instanceof Promise)
                getResult.then(result => {
                    replaceNodeElement(nodeElem, result);
                });
            else
                replaceNodeElement(nodeElem, getResult);
        });
    }

    function replaceNodeElement(nodeElem, newNodeData) {
        var nodeData = nodeElem.data();
        var newNodeTemplate = {};
        newNodeTemplate[nodeData.nodeName] = nodeData.nodeTemplate;
        var selectedChild = nodeElem.find('.app-selected');
        var oldNode = nodeElem.find('> .app-node');
        var tempList = $ul();
        _touch.treeView.createNodes(tempList, newNodeTemplate, newNodeData);
        var draggable = oldNode.data('draggable');
        var newNodeElem = tempList.children().insertAfter(nodeElem).toggleClass('app-selected', nodeElem.is('.app-selected'));
        if (draggable)
            newNodeElem.find('> .app-node').attr('data-draggable', draggable);
        newNodeElem.data('self', newNodeData);
        if (selectedChild.length) {
            var data = newNodeElem.data('nodeData');
            nodeElem.data('nodeData', data);
            newNodeElem.find('> .app-node').insertAfter(oldNode);
            newNodeElem.remove();
            oldNode.remove();
        }
        else
            nodeElem.remove();
    }

    function animateCollapseExpand(li) {
        var ul = li.find('> ul');
        if (ul.length) {
            var transitionDuration = parseFloat(ul.css('transition-duration')) * 1000;
            if (transitionDuration) {
                transitionDuration += 16;
                var treeView = ul.closest('.app-treeview');
                if (treeView.data('animating'))
                    return;
                treeView.data('animating', true);
                var r = getBoundingClientRect(ul);
                //var stub = treeView.find('.app-treeview-stub');
                //if (!stub.length)
                //    stub = $div('app-treeview-stub').appendTo(treeView);
                if (r.height) {
                    ul.css('max-height', 0);
                    setTimeout(() => {
                        ul.css('max-height', r.height);
                        setTimeout(() => {
                            ul.css('max-height', '');
                            treeView.removeData('animating');
                        }, transitionDuration);
                    });
                }
                else {
                    ul.css('display', 'block');
                    r = getBoundingClientRect(ul);
                    ul.css('max-height', r.height);
                    setTimeout(() => {
                        ul.css('max-height', 0);
                        setTimeout(() => {
                            ul.css({ display: '', 'max-height': '' });
                            treeView.removeData('animating');
                        }, transitionDuration);
                    });
                }
            }
        }
    }

    function invalidInput() {
        var valid = true;
        if (!navigating()) {
            _input.blur();
            valid = _input.valid();
        }
        return !valid;
    }

    $(document)
        .on('vclick', '.app-toggle', e => {
            if (invalidInput())
                return false;
            var li = $(e.target).closest('li');
            if (li.is('.app-expanded')) {
                li.removeClass('app-expanded').addClass('app-collapsed');
                animateCollapseExpand(li);
            }
            else {
                li.removeClass('app-collapsed').addClass('app-expanded');
                var scrollIntoView = true;
                li.find('> ul > li.app-loading').each(function () {
                    var liTemplate = $(this),
                        liData = liTemplate.data();
                    createNodesFromTemplate(liData.nodeName, liData.nodeTemplate, liTemplate.parent(), liTemplate);
                    scrollIntoView = false;
                });
                if (scrollIntoView)
                    scrollExpandedChildrenIntoView(li);
            }
            return false;
        })
        .on('vclick', '.app-treeview li span', e => {
            if (invalidInput())
                return false;
            var target = $(e.target);
            var li = target.closest('li');
            if (li.is('.app-loading'))
                return false;
            if (!target.is('.app-toggle') && _touch.dblClick($(target))) {
                li.find('> .app-node .app-toggle').trigger('vclick');
                return false;
            }

            var treeView = target.closest('.app-treeview');
            var selectedItems = treeView.find('.app-selected');

            if (e.isDefaultPrevented() || li.is('.app-selected') && selectedItems.length === 1 && !e.ctrlKey)
                return false;

            var beforeSelect = triggerTreeViewEvent('beforeselect', li);
            if (beforeSelect.isDefaultPrevented())
                return false;

            var li = target.closest('li');
            var keepSelection;

            // perform multi-select when requested
            if (selectedItems.length && treeView.data('multiSelect')) {
                var itemData = li.data();
                var firstItem = selectedItems.first();
                var firstItemData = firstItem.data();
                if (itemData.nodeName === firstItemData.nodeName && firstItemData.type) {
                    if (e.ctrlKey) {
                        li.toggleClass('app-selected', !li.is('.app-selected'));
                        keepSelection = true;
                    }
                    else if (e.shiftKey) {

                        var lastItem = selectedItems.last();
                        var allVisibleItems = treeView.find(`li[data-type="${firstItemData.type}"]:not(.app-loading)`).filter(':visible');
                        var rangeStartIndex = -1;
                        var rangeEndIndex = -1;
                        var lastItemIndex = -1;
                        var i = 0;
                        while (i < allVisibleItems.length) {
                            var item = allVisibleItems[i];
                            if (rangeStartIndex === -1 && firstItem.is(item))
                                rangeStartIndex = i;
                            if (rangeEndIndex === -1 && li.is(item))
                                rangeEndIndex = i;
                            if (lastItemIndex === -1 && lastItem.is(item))
                                lastItemIndex = i;
                            i++;
                        }
                        if (rangeEndIndex < rangeStartIndex)
                            rangeStartIndex = lastItemIndex;
                        selectedItems.removeClass('app-selected');
                        var startIndex = rangeStartIndex < rangeEndIndex ? rangeStartIndex : rangeEndIndex;
                        var endIndex = rangeEndIndex > rangeStartIndex ? rangeEndIndex : rangeStartIndex;
                        for (i = startIndex; i <= endIndex; i++)
                            $(allVisibleItems[i]).addClass('app-selected');
                        keepSelection = true;
                    }
                }
                else if (selectedItems.length === 1 && !firstItemData.type && li.is('.app-selected') && e.ctrlKey) {
                    li.removeClass('app-selected');
                    keepSelection = true;

                }
            }

            if (!keepSelection) {
                selectedItems.removeClass('app-selected');
                li.addClass('app-selected');
            }
            var nodeElem = target.closest('.app-node');
            var scrollBlock = null;
            if (!navigating() && !li.data('navigating')) {
                var nodeRect = getBoundingClientRect(nodeElem);
                var scrollableRect = getBoundingClientRect(li.closest('.app-treeview'));
                if (nodeRect.bottom > scrollableRect.bottom)
                    scrollBlock = 'end';
                else if (nodeRect.top < scrollableRect.top)
                    scrollBlock = 'start';
            }
            if (scrollBlock)
                nodeElem[0].scrollIntoView({ block: toSafeScrollBlock(scrollBlock), behavior: 'smooth' });
            setTimeout(triggerTreeViewEvent, scrollBlock ? 16 * 6 : 0, 'select', li);
            return false;
        })
        .on('vclick', '[data-studio-link]', e => {
            if (invalidInput())
                return false;
            var target = $(e.target),
                link = target.closest('[data-studio-link]').attr('data-studio-link');
            if (link) {
                var propGrid = target.closest('.app-propgrid');
                var treeView = propGrid.find('[data-hierarchy]');
                var nodeData = propGrid.find('.app-selected').data('nodeData');
                if (nodeData)
                    link = _app.eval(link, nodeData);
                navigating(true, !link.match(/^\./));
                navigateToNode(treeView.find('>ul'), link);
            }
            return false;
        })
        .on('contextmenu taphold.app', '.app-treeview', e => {
            if (invalidInput())
                return false;
            var treeView = _touch.treeView.context($(e.target));
            var node = $(e.target).closest('.app-node');
            if (!node.length) {
                node = treeView.elem.find('.app-root .app-node');
                treeView = _touch.treeView.context(node);
            }
            var nodeItem = node.parent();
            if (treeView.elem.data('trackSelection')) {
                if (!nodeItem.is('.app-root') && (!treeView.node || nodeItem.length && !nodeItem.is('.app-selected'))) {
                    if (node.length) {
                        node.trigger('vclick');
                        _touch.idle(() =>
                            node.trigger('contextmenu')
                        );
                    }
                }
                else {
                    var selfRequest = ensureNodeSelf(treeView);
                    //if (nodeItem.data('self') == null && (treeView.node.get || treeView.node.iterate)) {
                    //    var selectEvent = triggerTreeViewEvent('select', nodeItem);
                    //    if (selectEvent.result)
                    //        selectEvent.result.then(data => {
                    //            node.trigger('contextmenu')
                    //        });
                    //}
                    if (selfRequest?.then)
                        selfRequest.then(data =>
                            node.trigger('contextmenu')
                        );
                    else {
                        var items = [];
                        var p = _touch.lastTouch();
                        enumerateTreeViewActions(treeView, items);
                        if (items.length)
                            _touch.listPopup({
                                x: p.x,
                                y: p.y,
                                items,
                                arrow: false
                            });
                        else
                            treeView.elem.focus();
                    }
                }
            }
            if (e.type === 'contextmenu')
                return false;
        });


    function treeViewAccepts(treeView, accept, names) {
        if (!Array.isArray(names))
            names = [names];
        for (var i = 0; i < names.length; i++)
            if (accept.includes(treeView.nodeName + ':' + names[i]))
                return true;
        return false;
    }

    function enumerateTreeViewActions(treeView, actions) {
        if (!actions)
            actions = [];
        var accept = treeView.elem.data('accept');
        var nodeElem = treeView.nodeElem;
        if (treeView.node) {
            if (treeViewAccepts(treeView, accept, ['move', 'move-if-same-', 'move-if-descendant'])) {
                actions.push({ text: resourcesEditor.Cut, icon: 'material-icon-content-cut', context: 'cut', callback: executeTreeAction });
            }
            // accept.includes(treeView.nodeName + ':copy')
            if (treeViewAccepts(treeView, accept, ['copy', 'copy-if-same-'])) {
                actions.push({ text: resourcesEditor.Copy, icon: 'material-icon-content-copy', context: 'copy', callback: executeTreeAction });
            }
            var clipboardSelection = _app.clipboard();
            if (typeof clipboardSelection == 'object') {
                clipboardSelection = _touch.treeView.selectionToList(clipboardSelection);
                if (clipboardSelection.length && nodeElem && !nodeElem.is('.app-cut')) {
                    var dropOptions = figureDropOptions(nodeElem, clipboardSelection);
                    if (dropOptions.canCopy || dropOptions.canMove)
                        actions.push({
                            text: resourcesEditor.Paste + (clipboardSelection.length > 1 ? ` (${clipboardSelection.length})` : ''),
                            //desc: dropOptions.canCopy ? 'paste' : 'move',
                            icon: 'material-icon-content-paste', context: dropOptions.canMove ? 'paste-move' : 'paste-copy', callback: executeTreeAction
                        })
                }
            }
            var resource = nodeElem ? nodeElem.data('self') : null;
            var links = resource?._links;
            var nodeActions = treeView.node.actions || {};
            var builtInActionCount = actions.length;
            var selection;
            for (var actionName in nodeActions) {
                var a = nodeActions[actionName] || {},
                    context = a,
                    callback = a.execute ? executeAction : null,
                    actionBody = a.body;
                if (a.selected != null) {
                    if (!selection) {
                        selection = [];
                        _touch.treeView.selectionToList(treeView.elem)
                            .forEach(n =>
                                selection.push(n.nodeData)
                            );
                    }

                    var selectedInt = parseInt(a.selected);
                    if (!isNaN(selectedInt) && selectedInt != selection.length)
                        continue;
                    if ('body' in a && !actionBody)
                        actionBody = undefined;
                    else {
                        if (!actionBody)
                            actionBody = {};
                        actionBody.parameters = {
                            data: selection
                        }
                    }
                }
                if (!callback && links) {
                    var link = links[actionName];
                    if (link) {
                        callback = executeHypermedia;
                        context = { treeView, hypermedia: actionName, resource, body: actionBody, trigger: a.trigger };
                    }
                }
                if (callback) {
                    if (actions.length == builtInActionCount || a.separator)
                        actions.push({});
                    actions.push({
                        text: a.text || _app.prettyText(actionName, true),
                        icon: a.icon || hypermediaIcons[actionName],
                        //desc: self.name || self.id, // debugging only
                        context,
                        callback
                    });
                }
            }
        }
        return actions;
    }

    function executeAction(context) {
        var treeView = _touch.treeView.context();
        _app.eval(context.execute + '\n', treeView.nodeData || {});
    }


    function hypermediaNop(error) {
        return new Promise(function (resolve, reject) {
            if (error)
                _touch.notify({ text: error, duration: 'long' });
            reject();
        });
    }

    function identifierPropertySelected() {
        // ensure that the "idenifier:true" or no property will be selected when the Property Grid shows the new object
        var dataView = _touch.dataView(),
            propGridInstance = dataView?._survey?.context?.instance;
        if (propGridInstance) {
            // instruct the Property Grid to navigate to the '$default' property to ensure that no property is selected.
            _app.userVar(`${propGridInstance}.navigate`, '$identifier');
            // clear the last focused field in the active page.
            _touch.activePage().data('last-focused-field', null);
        }
    }

    function executeHypermedia(context) {
        var hypermedia = context.hypermedia,
            links = context?.resource?._links,
            treeViewElem = context.treeView.elem;
        if (!links || !links[hypermedia])
            return hypermediaNop(`Hypermedia control "${hypermedia}" is not found in\n${JSON.stringify(context.resource, null, 4)}`);
        if (hypermedia == 'remove' && !context._confirmed) {
            var selection = _touch.treeView.selectionToList(treeViewElem);
            var maxNodes = 5;
            selection.forEach((item, index) =>
                selection[index] = item.nodeFriendlyPath);
            if (selection.length > maxNodes) {
                selection[maxNodes] = '+' + (selection.length - maxNodes)
                selection.splice(maxNodes + 1);
            }
            return _app.confirm(resources.Data.NoteDeleteConfirm + `\n\n${selection.join(', ')}`)
                .then(() => {
                    context._confirmed = true;
                    executeHypermedia(context);
                });
        }

        var url = context.resource._links[hypermedia],
            request = { url };
        if (context.body)
            request.body = context.body;
        var executeEvent = triggerTreeViewEvent('hypermedia', context.treeView.nodeElem, request, context.trigger);
        if (executeEvent.result)
            return executeEvent.result.then(response => {
                var result = response?.result;
                if (!result) {
                    switch (hypermedia) {
                        case 'create': {
                            var selfLinkHref = response?._links?.self?.href;
                            if (selfLinkHref) {
                                var selfLink = selfLinkHref.split(/\//);
                                result = { success: true, selectIdentifiers: [selfLink[selfLink.length - 1]] }
                                if (context.treeView.nodeElem.is('.app-root')) {
                                    identifierPropertySelected();
                                    refreshAndSelect(treeViewElem, result.selectIdentifiers[0])
                                    return;
                                }
                            }
                            break;
                        }
                        case 'delete': {
                            result = { success: true, refreshParent: [url.href] };
                            break;
                        }
                    }
                }
                if (result?.success) {
                    if (hypermedia.match(/^create(-.+)?$/))
                        identifierPropertySelected();
                    var nodesToRefresh = [],
                        nodeElem = context.treeView.nodeElem,
                        refreshParent = result.refreshParent,
                        hasParentToRefresh = refreshParent?.length,
                        refreshChildren = result.refreshChildren,
                        hasChildrenToRefresh = refreshChildren?.length;
                    if (hasParentToRefresh || hasChildrenToRefresh)
                        treeViewElem.find('li:not(.app-loading)').each(function () {
                            var li = $(this);
                            var selfHref = li.data()?.nodeData?._links?.self?.href;
                            if (hasParentToRefresh && refreshParent.includes(selfHref))
                                nodesToRefresh.push(li.parent().closest('li'));
                            else if (hasChildrenToRefresh && refreshChildren.includes(selfHref))
                                nodesToRefresh.push(li);
                        });
                    if (!nodesToRefresh.length)
                        if (result?.selectIdentifiers?.length)
                            nodesToRefresh.push(nodeElem);
                        else
                            nodesToRefresh.push(nodeElem.parent().closest('li'));
                    treeViewElem.find('.app-selected').removeClass('app-selected app-cut');
                    if (nodesToRefresh.length && nodesToRefresh[0].closest('li').length) {
                        // refresh the specified nodes
                        nodesToRefresh.forEach(li => {
                            var doSelect = context.treeView.nodeElem.closest(li).length,
                                pendingResult = doSelect ? result : {};
                            li.data('pendingResult', pendingResult);
                            if (!li.find('ul:first li:first').length) {
                                $span('app-toggle').appendTo(li.addClass('app-collapsed').removeClass('app-expanded').find('>.app-node'));
                                createNodes(
                                    $ul().appendTo(li),
                                    li.data().nodeTemplate.nodes);
                            }
                            var loading = li.find('> ul > .app-loading').length;
                            if (li.is('.app-collapsed') && doSelect)
                                li.find('> .app-node .app-toggle').trigger('vclick');
                            if (!loading)
                                createNodes(
                                    $ul().appendTo(li),
                                    li.data().nodeTemplate.nodes);
                        });
                    }
                    else {
                        result.handled = true;
                        refreshAndSelect(context.treeView.elem, result?.selectIdentifiers ? result?.selectIdentifiers[0] : null)
                    }

                }
                return response;
            });
        return hypermediaNop();
    }

    function refreshAndSelect(treeViewElem, identifier) {
        var nodes = treeViewElem.data('nodes');
        createNodes($ul().appendTo(treeViewElem.empty()), nodes, null);
        if (identifier != null) {
            navigating(true);
            navigateToNode(treeViewElem.find('ul'), identifier);
        }
        else
            triggerTreeViewEvent('select');
    }

    function executeTreeAction(context, link) {
        setTimeout(() => {
            switch (context) {
                case 'cut':
                    executeTreeViewCut();
                    break;
                case 'copy':
                    executeTreeViewCopy();
                    break;
                case 'paste-copy':
                    executeTreeViewPaste(null, null, 'copy');
                    break;
                case 'paste-move':
                    executeTreeViewPaste(null, null, 'move');
                    break;
            }
        });
    }

    function executeTreeViewCut() {
        var treeView = _touch.treeView.context().elem;
        treeView.find('.app-cut').removeClass('app-cut');
        treeView.find('.app-selected').addClass('app-cut');
        _app.clipboard(_touch.treeView.toSelection(treeView));
    }

    function executeTreeViewCopy() {
        var treeView = _touch.treeView.context().elem;
        treeView.find('.app-cut').removeClass('app-cut');
        _app.clipboard(_touch.treeView.toSelection(treeView));
    }

    function executeTreeViewPaste(target, selection, hypermedia) {
        var treeView = _touch.treeView.context(target);
        if (!target)
            target = treeView.nodeElem;
        var resource = target.data('self');
        if (!resource) {
            var selectEvent = triggerTreeViewEvent('select', target);
            if (selectEvent.result)
                selectEvent.result.then(data =>
                    executeTreeViewPaste(target, selection, hypermedia)
                );
        }
        else {
            var cutElements = treeView.elem.find('.app-cut').removeClass('app-cut');
            if (!target)
                target = treeView.nodeElem;
            if (!hypermedia)
                hypermedia = cutElements.length ? 'move' : 'copy';

            if (!selection) {
                selection = _touch.treeView.selectionToList(_app.clipboard());
                if (hypermedia === 'move')
                    _app.clipboard(null);
            }

            if (resource._links[hypermedia] && selection.length) {
                var data = [];
                if (selection.length > 1)
                    selection.forEach(n =>
                        data.push(n.nodeData)
                    );
                else
                    data = selection[0].nodeData;
                executeHypermedia({
                    treeView,
                    selection,
                    hypermedia,
                    resource,
                    body: {
                        parameters: {
                            data
                        }
                    }
                });
            }
            else
                _touch.notify(`${hypermedia} ${selection[0].nodeText}${selection.length > 1 ? ' +' + (selection.length - 1).toString() : ''} to ${target.find('> .app-node .app-text').text()}`);
        }
    }

    function triggerTreeViewEvent(eventName, nodeElem, eventArgs, trigger) {
        var treeView = _touch.treeView.context(nodeElem);
        treeView.eventName = eventName;
        treeView.eventArgs = eventArgs;
        treeView.trigger = trigger;
        var e = $.Event('treeview.app', { treeView });
        if (eventName === 'iterate') {
            if (treeView.node.when) {
                var iterate = _app.eval(treeView.node.when, treeView.nodeData);
                if (!iterate) {
                    e.preventDefault();
                    return e;
                }
            }
        }
        $(document).trigger(e);
        if (eventName === 'select') {
            if (treeView.elem.data('trackSelection') && treeView.nodePath !== '_root')
                _app.userVar('treeview.' + treeView.hierarchy, treeView.nodePath);
            if (e.result)
                e.result.then(data =>
                    treeView.nodeElem.data('self', Array.isArray(data) ? data[0] : data)
                );
        }
        return e;
    }

    _touch.treeView.data = function (type) {
        var obj;
        if (type) {
            if (!Array.isArray(type))
                type = type.split(/\s*,\s*/g);
        }
        else
            obj = {};
        _touch.activePage('.app-treeview .app-selected:first .app-node').parents('li').each(function () {
            var node = $(this),
                nodeType = node.attr('data-type'),
                nodeData = node.data('nodeData');
            if (type) {
                type.forEach(t => {
                    if (t === nodeType)
                        obj = nodeData;
                });
                if (obj)
                    return false;
            }
            else if (nodeType)
                obj[nodeType] = nodeData || {};
        });
        return obj;
    };

    _touch.treeView.toSelection = function (elem) {
        var selection = {},
            hierarchy = elem.data('hierarchy');
        elem.find('.app-selected').each(function () {
            var nodeElem = $(this);
            var data = {
                hierarchy,
                node: nodeElem.data('nodeTemplate'),
                nodeName: nodeElem.data('nodeName'),
                nodePath: _touch.treeView.toPath(nodeElem),
                nodeFriendlyPath: _touch.treeView.toPath(nodeElem, true),
                nodeText: nodeElem.find(' > .app-node .app-text').text(),
                nodeIcon: nodeElem.find('i')[0]?.outerHTML
            };
            while (nodeElem.length && !data.nodeData) {
                data.nodeData = nodeElem.data('nodeData');
                nodeElem = nodeElem.parent().closest('li');
            }
            selection[`${hierarchy}://${data.nodePath}`] = data;
        });
        return selection;
    }

    _touch.treeView.selectionToList = function (selection) {
        if (selection instanceof jQuery)
            selection = _touch.treeView.toSelection(selection);
        var list = [];
        for (var key in selection)
            list.push(selection[key]);
        return list;
    }

    _touch.treeView.toPath = function (elem, pretty) {
        var nodePath = [];
        while (elem.length) {
            nodePath.splice(0, 0, elem.is('.app-loading') ? '*' : pretty ? elem.find('>.app-node .app-text').text() : elem.data('nodeId'));
            elem = elem.parent().closest('li');
        }
        return nodePath.join('/');
    };

    function toNodeType(node, nodeData) {
        var nodeType = node?.typeAlt || node?.type;
        if (nodeType && nodeType.match(/\s/))
            nodeType = nodeData ? _app.eval(nodeType, nodeData) : null;
        return nodeType;
    }

    _touch.treeView.context = function (nodeElem) {
        if (!nodeElem)
            nodeElem = _touch.activePage('.app-treeview .app-selected').first();
        else if (nodeElem.is('.app-treeview'))
            nodeElem = nodeElem.find('.app-selected').first();
        else if (!nodeElem.is('li'))
            nodeElem = nodeElem.closest('.app-node').parent();
        var treeView = nodeElem.length ? nodeElem.closest('.app-treeview') : _touch.activePage('.app-treeview'),
            hierarchy = treeView.attr('data-hierarchy'),
            nodeName = nodeElem.data('nodeName'),
            node = nodeElem.data('nodeTemplate'),
            nodeData,
            elem = nodeElem;
        while (elem.length && !nodeData) {
            nodeData = elem.data('nodeData');
            elem = elem.parent().closest('li');
        }
        return {
            hierarchy,
            elem: treeView,
            node,
            nodeName,
            nodePath: _touch.treeView.toPath(nodeElem),
            nodeData,
            nodeElem,
            nodeType: toNodeType(node, nodeData)
        };
    };

    _touch.treeView.rename = function (newIdentifier) {
        var treeView = _touch.treeView.context();
        return executeHypermedia({
            treeView,
            hypermedia: 'rename',
            resource: treeView.nodeElem.data('self'),
            body: {
                parameters: {
                    newIdentifier
                }
            }
        });
    };

    _touch.treeView.actions = enumerateTreeViewActions;

    _touch.treeView.createNodes = createNodes;
    _touch.treeView.replaceNode = replaceNode;
    _touch.treeView.ensureNodeSelf = ensureNodeSelf;

    function ensureNodeSelf(treeView) {
        var nodeItem = treeView.nodeElem.closest('li');
        var self = nodeItem.data('self');
        if (self == null && (treeView.node.get || treeView.node.iterate)) {
            var selectEvent = triggerTreeViewEvent('select', nodeItem);
            return selectEvent.result;
        }
    }

    function scrollExpandedChildrenIntoView(li) {
        if (!navigating()) {
            var liRect = getBoundingClientRect(li);
            var treeView = li.closest('.app-treeview');
            var treeViewRect = getBoundingClientRect(treeView);
            var ul = li.find('> ul');
            var ulRect = getBoundingClientRect(ul);
            if (ulRect.bottom > treeViewRect.bottom) {
                var block = 'start';
                var scrollTarget = li;
                if (liRect.height < treeViewRect.height) {
                    scrollTarget = ul;
                    block = 'end';
                }
                if (scrollTarget.length)
                    scrollTarget[0].scrollIntoView({ block: toSafeScrollBlock(block), behavior: 'smooth' });
            }
            else
                animateCollapseExpand(li);
        }
    }

    function toSafeScrollBlock(block) {
        return _app.dragMan.active() ? 'nearest' : block;
    }

    function pathToNodeElem(contextElem, path) {
        if (typeof path == 'string') {
            contextElem = contextElem.closest('.app-treeview');
            path = path.split('/');
        }
        contextElem = contextElem.find('> ul > li');
        var result = null;
        contextElem.each(function () {
            var node = $(this);
            if (node.data().nodeId === path[0]) {
                result = node;
                return false;
            }
        });
        if (result) {
            path.splice(0, 1);
            if (path.length)
                result = pathToNodeElem(result, path);
        }
        return result;
    }

    function figureDropOptions(dropItem, selection, ctrlKey, sourceItem) {
        var moving = !ctrlKey;
        var copying = ctrlKey;
        var autoCopying = true;
        if (!sourceItem) {
            sourceItem = pathToNodeElem(dropItem, selection[0].nodePath);
            moving = dropItem.closest('.app-treeview').find('.app-cut').length > 0;
            copying = !moving;
            autoCopying = false;
            if (!sourceItem)
                sourceItem = $(sourceItem);
        }
        var dropData = dropItem.data();
        var accept = dropData.nodeTemplate.accept || [];
        var canMove = false;
        var canCopy = false;
        var firstNode = selection[0];
        var dropNodeName = firstNode.nodeName;

        // verify the "*:move-if-same-" and "*:copy-if-same-*", and "*:move-if-desendant"
        var ifSameDef = dropNodeName + ':move-if-same-'
        var moveIfSameAncestor = false;
        accept.every(dropAccept => {
            if (dropAccept.startsWith(ifSameDef))
                moveIfSameAncestor = haveSameAncestor(dropItem, sourceItem, dropAccept.substring(ifSameDef.length));
            return !moveIfSameAncestor;
        })

        ifSameDef = dropNodeName + ':copy-if-same-'
        var copyIfSameAncestor = false;
        accept.every(dropAccept => {
            if (dropAccept.startsWith(ifSameDef))
                copyIfSameAncestor = haveSameAncestor(dropItem, sourceItem, dropAccept.substring(ifSameDef.length));
            return !copyIfSameAncestor;
        })
        var isDescendant = accept.includes(dropNodeName + ':move-if-descendent') && sourceItem.closest(dropItem).length > 0;

        // figure the values of canCopy and canMove
        if (moving && (accept.includes(dropNodeName + ':move') || moveIfSameAncestor || isDescendant))
            canMove = true;
        if (!canMove && autoCopying)
            copying = true;
        if (copying && (accept.includes(dropNodeName + ':copy') || copyIfSameAncestor))
            canCopy = true;
        return { canMove, canCopy };
    }

    function haveSameAncestor(item1, item2, nodeName) {
        var result = false;
        if (nodeName === 'parent')
            result = item1.parent().is(item2.parent());
        else {
            var n1 = item1;
            var n2 = item2;
            while (n1.is('li') && n1.data('nodeName') != nodeName)
                n1 = n1.parent().parent();
            while (n2.is('li') && n2.data('nodeName') != nodeName)
                n2 = n2.parent().parent();
            if (n1.is(n2))
                result = true;
        }
        return result;
    }

    var treeViewDragMan = _app.dragMan['treeview'] = {
        options: {
            taphold: function (drag) {
                return drag.touch;
            },
            immediate: false
        },
        start: function (drag) {
            var target = this._target = drag.target;

            //*****************************************************************************************************
            // The code below does not allow dragging if there are no nodes that will accept this node for a drop.
            // This may be re-enabled in the future as an option if needed.
            // Presently any node can be dragged in the drag & drop is enabled.
            //*****************************************************************************************************
            //    var accept = target.closest('.app-treeview').data('accept');
            //    var nodeName = target.parent().data('nodeName');
            //    if (!(accept.includes(nodeName + ':move') || accept.includes(nodeName + ':copy')))
            //        drag.cancel = true;
            //    else {
            //        if (drag.touch) {
            //            drag.taphold = true;
            //            drag.dir = 'horizontal';
            //        }
            //        else {
            //            drag.dir = 'all';
            //            drag.sensitivity = 3;
            //        }
            //    }
            if (drag.touch) {
                drag.taphold = true;
                drag.dir = 'horizontal';
            }
            else {
                drag.dir = 'all';
                drag.sensitivity = 3;
            }
        },
        move: function (drag) {
            var that = this;
            var target = that._target;
            var treeView = that._treeView;

            if (drag.touch)
                return;

            if (!that._treeView) {
                treeView = that._treeView = target.closest('.app-treeview').addClass('app-dragging');
                var item = that._targetItem = target.parent();
                if (!item.is('.app-selected'))
                    target.trigger('vclick');
                target.addClass('app-dragging');
                that._data = item.data();
                rect = that._rect = getBoundingClientRect(treeView);
                that._glassPane(treeView,);
                that._scrollBy = Math.ceil(getBoundingClientRect(item).height);
                var selection = that._selection = _touch.treeView.selectionToList(treeView);
                var dropHint = that._dropHint = $span('app-treeview-drop-hint').appendTo('body');
                var dropNode = $span('app-node').appendTo(dropHint);
                var hintText = selection[0].nodeText;
                if (selection.length > 1)
                    hintText += ` +${selection.length - 1}`;
                $span('app-text').text(hintText).appendTo(dropNode);
                var icon = selection[0].nodeIcon;
                if (icon)
                    $(icon).appendTo(dropNode);
                $i('app-drop-mode material-icon').appendTo(dropNode);
            }

            if (that._toggleTimeout) {
                clearTimeout(that._toggleTimeout);
                that._toggleTimeout = null;
            }

            that._dropHint.css('transform', `translate3d(${drag.x}px,${drag.y}px,0)`);

            //console.log(`treeview: last=${drag.lastCtrlKey} current=${drag.ctrlKey}`);
            if (that._lastX != drag.x || that._lastY != drag.y || that._lastCtrlKey != drag.ctrlKey) {
                //console.log(`treeview: ${drag.ctrlKey}`);
                that._lastX = drag.x;
                that._lastY = drag.y;
                that._lastCtrlKey = drag.ctrlKey;
                var elem = _app.elementAt(drag);
                var dropNode = elem.closest('.app-node');
                var dropItem = dropNode.parent();
                if (dropNode.length) {
                    if (elem.is('.app-toggle'))
                        that._toggleTimeout = setTimeout(() => elem.trigger('vclick'), 500);
                    else if (dropItem.is('.app-selected'))
                        that._dropNode();
                    else {
                        var dropOptions = figureDropOptions(dropItem, that._selection, drag.ctrlKey, that._targetItem);
                        if (dropOptions.canCopy)
                            that._dropNode(dropNode, 'copy');
                        else {
                            if (dropOptions.canMove)
                                that._dropNode(dropNode, 'move');
                            else
                                that._dropNode();
                        }
                    }
                    if (!dropNode.is(that._lastDropNode)) {
                        that._dropNode();
                    }
                }
                else
                    that._dropNode();
            }
            that._resetTimeouts();
            that._startScrollTimeout = setTimeout(that._autoScroll, 500);
        },
        cancel: function (drag) {
            var that = this;
            that._resetTimeouts();
            that._dropNode();

            that._target.removeClass('app-dragging');

            delete that._target;
            if (that._treeView) {
                that._treeView.removeClass('app-dragging app-last-drop-move app-last-drop-copy');
                that._treeView = null;
                that._selection = null;
                that._dropType = null;
                that._lastX = null;
                that._lastY = null;
                that._lastCtrlKey = null;
                that._dropHint.remove();
                that._dropHint = null;
                that._targetItem = null;
            }
            that._glassPane();
        },
        end: function (drag) {
            var that = this,
                lastDropNode = that._lastDropNode,
                selection = that._selection,
                dropType = that._dropType;
            //delete that._width;
            if (lastDropNode && dropType)
                setTimeout(executeTreeViewPaste, 0, lastDropNode.parent(), selection, dropType);
            that.cancel();
        },
        _dropNode: function (node, type) {
            var that = treeViewDragMan,
                lastDropNode = that._lastDropNode,
                doClearLastDrop;
            if (lastDropNode) {
                if (node && node.is(lastDropNode))
                    lastDropNode.removeClass(type === 'move' ? 'app-drop-copy' : 'app-drop-move');
                else
                    lastDropNode.removeClass('app-drop-copy app-drop-move');
                that._lastDropNode = null;

                doClearLastDrop = true;
            }
            that._dropType = null;
            if (that._dropHint)
                that._dropHint.toggleClass('app-drop-copy', type === 'copy')
            if (arguments.length) {
                that._lastDropNode = node.addClass('app-drop-' + type);
                that._dropType = type;
                clearTimeout(that._clearLastDropTimeout);
                that._cleareLastDrop();
                doClearLastDrop = false;
                that._treeView.addClass('app-last-drop-' + type);
            }
            if (doClearLastDrop) {
                clearTimeout(that._clearLastDropTimeout);
                that._clearLastDropTimeout = setTimeout(that._cleareLastDrop, 96);
            }
            //console.log(`${type} - ${that._dropType}`);
        },
        _cleareLastDrop: function () {
            var treeView = treeViewDragMan._treeView;
            if (treeView)
                treeView.removeClass('app-last-drop-copy app-last-drop-move');
        },
        _resetTimeouts: function () {
            var that = this;
            if (that._startScrollTimeout) {
                clearTimeout(that._startScrollTimeout);
                that._startScrollTimeout = null;
            }
            if (that._scrollTimeout) {
                clearTimeout(that._scrollTimeout);
                that._scrollTimeout = null;
            }
        },
        _autoScroll: function (scrollX, scrollY) {
            let that = treeViewDragMan;
            let treeView = that._treeView;
            let rect = that._rect;
            clearTimeout(that._scrollTimeout);
            that._scrollTimeout = null;

            if (!treeView)
                return;
            var treeViewElem = treeView[0];


            // see if the auto-scroll is required
            let scrollTop = treeViewElem.scrollTop;
            let scrollLeft = treeViewElem.scrollLeft;
            let scrollWidth = treeViewElem.scrollWidth;
            let scrollHeight = treeViewElem.scrollHeight;

            if (arguments.length) {
                //treeView.one('scroll', e =>
                //    setTimeout(that._autoScroll, 64)
                //);
                treeViewElem.scrollBy({
                    left: scrollX == null ? 0 : scrollX,
                    top: scrollY == null ? 0 : scrollY,
                    behavior: 'instant'
                });
                setTimeout(that._autoScroll, 48)
                //    treeViewElem.scrollTo({
                //        left: scrollLeft + (scrollX == null ? 0 : scrollX),
                //        top: scrollTop + (scrollY == null ? 0 : scrollY),
                //        behavior: 'smooth'
                //    });
            }
            else {
                var newScrollX;
                var newScrollY;
                var scrollBy = that._scrollBy;
                var scrollSensitivity = scrollBy;
                var dir;
                var canScrollVertically = that._lastX >= rect.left && that._lastX <= rect.right;
                var canScrollHorizontally = that._lastY >= rect.top && that._lastY <= rect.bottom;
                if (that._lastX < rect.left + scrollSensitivity && canScrollHorizontally) {
                    // try scrolling left
                    if (scrollLeft) {
                        newScrollX = -Math.min(scrollLeft, scrollBy);
                        dir = 'left';
                    }

                }
                else if (that._lastX > rect.right - scrollSensitivity && canScrollHorizontally) {
                    // try scrolling right
                    if (scrollLeft + rect.width - 1 < scrollWidth) {
                        newScrollX = Math.min(scrollWidth - (scrollLeft + rect.width - 1), scrollBy);
                        dir = 'right';
                    }
                }
                if (that._lastY < rect.top + scrollSensitivity && canScrollVertically) {
                    // try scrollong up
                    if (scrollTop) {
                        newScrollY = -Math.min(scrollTop, scrollBy);
                        dir = 'up';
                    }
                }
                else if (that._lastY > rect.bottom - scrollSensitivity && canScrollVertically) {
                    // try scrolling down
                    if (scrollTop + rect.height - 1 <= scrollHeight) {
                        newScrollY = Math.min(scrollHeight - (scrollTop + rect.height - 1), scrollBy);
                        if (newScrollY < 1)
                            newScrollY = scrollBy;
                        dir = 'down';
                    }
                }
                if (newScrollX != null || newScrollY != null) {
                    that._cleareLastDrop();
                    that._autoScroll(newScrollX, newScrollY);
                    that._scrollingState(dir);
                }
                else
                    that._scrollingState();
            }
        },
        _scrollingState: function (dir) {
            this._panes.forEach((pane, index) =>
                pane.toggleClass('app-scroll-auto',
                    index === 0 && dir === 'up' ||
                    index === 1 && dir === 'right' ||
                    index === 2 && dir === 'down' ||
                    index === 3 && dir === 'left')
            );
            this._treeView.toggleClass('app-scroll-auto', !!dir);
        },
        _glassPane: function (treeView) {
            var that = this;
            var panes = that._panes;
            if (!panes) {
                panes = that._panes = [
                    $div('app-treeview-glass-pane'),
                    $div('app-treeview-glass-pane'),
                    $div('app-treeview-glass-pane'),
                    $div('app-treeview-glass-pane')
                ];
            }
            if (treeView) {
                var r = getBoundingClientRect(treeView);
                var body = $('body');
                panes[0].css({ left: 0, top: 0, width: '100%', height: r.top }).appendTo(body);
                panes[1].css({ left: r.right, top: r.top, width: screen.width - r.right + 1, height: r.height }).appendTo(body);
                panes[2].css({ left: 0, top: r.bottom, width: '100%', height: screen.height - r.bottom + 1 }).appendTo(body);
                panes[3].css({ left: 0, top: r.top, width: r.left + 4, height: r.height }).appendTo(body);
            }
            else {
                panes[0].remove();
                panes[1].remove();
                panes[2].remove();
                panes[3].remove();
            }
        }
    };

})();