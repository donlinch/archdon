<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>管理導覽 - 除錯版本</title>
    <style>
        /* 保持原有的樣式 */
        body {
            margin: 0;
            font-family: sans-serif;
            background-color: #f8f9fa;
        }

        .navbar {
            display: flex;
            background: linear-gradient(to right, #4361ee, #3f37c9);
            padding: 0 10px;
            overflow-x: auto;
            white-space: nowrap;
            height: 60px;
            align-items: center;
            -webkit-overflow-scrolling: touch;
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
        .navbar::-webkit-scrollbar { display: none; }

        .navbar ul {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            height: 100%;
        }

        .navbar li {
            position: relative;
            height: 100%;
            display: flex;
            align-items: center;
        }

        .navbar a, .navbar span {
            display: flex;
            align-items: center;
            color: rgba(255, 255, 255, 0.8);
            text-decoration: none;
            padding: 0 15px;
            height: 100%;
            font-size: 1rem;
            font-weight: 500;
            transition: background-color 0.3s ease, color 0.3s ease;
            cursor: pointer;
            border-bottom: 3px solid transparent;
            box-sizing: border-box;
        }

        .navbar li.has-children > a::after,
        .navbar li.has-children > span::after {
            content: ' ▼';
            font-size: 0.7em;
            margin-left: 5px;
        }

        .navbar a:hover, .navbar span:hover, .navbar li:hover > a, .navbar li:hover > span {
            background-color: rgba(255, 255, 255, 0.1);
            color: white;
        }
        .navbar a.active {
            color: white;
            font-weight: 600;
            border-bottom-color: #4cc9f0;
        }

        /* 下拉選單樣式 */
        .navbar ul ul {
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            background-color: #fff;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            min-width: 200px;
            z-index: 1000;
            padding: 5px 0;
            border-radius: 0 0 4px 4px;
            height: auto;
            flex-direction: column;
            white-space: normal;
        }

        .navbar ul ul.show-dropdown {
            display: flex;
        }

        .navbar ul ul li {
            width: 100%;
            height: auto;
        }

        .navbar ul ul a, .navbar ul ul span {
            color: #333;
            padding: 10px 15px;
            width: 100%;
            height: auto;
            display: block;
            box-sizing: border-box;
            border-bottom: none;
        }
        .navbar ul ul li.has-children > a::after,
        .navbar ul ul li.has-children > span::after {
            content: ' ▶';
            float: right;
            margin-left: 0;
        }

        .navbar ul ul a:hover, .navbar ul ul span:hover {
            background-color: #f0f0f0;
            color: #000;
        }

        .navbar ul ul ul {
            top: 0;
            left: 100%;
            margin-top: -5px;
            border-radius: 0 4px 4px 4px;
        }

        #loading-nav {
            color: white;
            padding: 20px;
            text-align: center;
        }

        /* 除錯資訊樣式 */
        .debug-info {
            background-color: #f8f9fa;
            padding: 20px;
            margin: 20px;
            border: 1px solid #dee2e6;
            border-radius: 5px;
            font-family: monospace;
            font-size: 14px;
        }
        .debug-info h3 {
            margin-top: 0;
            color: #495057;
        }
        .debug-info pre {
            background-color: #ffffff;
            padding: 10px;
            border: 1px solid #ced4da;
            border-radius: 3px;
            overflow-x: auto;
        }
    </style>
</head>
<body>
    <nav class="navbar">
        <ul id="nav-list">
            <div id="loading-nav">載入導覽列中...</div>
        </ul>
    </nav>

    <div class="debug-info">
        <h3>除錯資訊</h3>
        <div id="debug-content">
            <p>正在載入和分析導覽資料...</p>
        </div>
    </div>

    <script>
        const debugElement = document.getElementById('debug-content');
        
        function log(message, data = null) {
            console.log(message, data);
            
            const logEntry = document.createElement('div');
            logEntry.innerHTML = `
                <p><strong>${new Date().toLocaleTimeString()}</strong>: ${message}</p>
                ${data ? `<pre>${JSON.stringify(data, null, 2)}</pre>` : ''}
            `;
            debugElement.appendChild(logEntry);
        }

        document.addEventListener('DOMContentLoaded', async () => {
            const navList = document.getElementById('nav-list');
            const loadingIndicator = document.getElementById('loading-nav');

            try {
                log('開始獲取導覽連結...');
                
                // 檢查目前頁面的 URL
                log(`目前頁面 URL: ${window.location.href}`);
                
                const response = await fetch('/api/admin/nav-links');
                log(`API 回應狀態: ${response.status} ${response.statusText}`);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const links = await response.json();
                log(`獲取到 ${links.length} 個導覽連結`, links);

                // 分析資料結構
                const parentLinks = links.filter(link => !link.parent_id);
                const childLinks = links.filter(link => link.parent_id);
                log(`父層連結: ${parentLinks.length} 個`, parentLinks);
                log(`子層連結: ${childLinks.length} 個`, childLinks);

                // 建立樹狀結構
                log('建立樹狀結構...');
                const linkMap = {};
                const tree = [];
                links.forEach(link => { linkMap[link.id] = { ...link, children: [] }; });
                links.forEach(link => {
                    if (link.parent_id && linkMap[link.parent_id]) {
                        linkMap[link.parent_id].children.push(linkMap[link.id]);
                    } else {
                        tree.push(linkMap[link.id]);
                    }
                });
                
                log('完成樹狀結構', tree);

                // 檢查哪些項目有子選單
                const itemsWithChildren = tree.filter(item => item.children.length > 0);
                log(`有子選單的項目: ${itemsWithChildren.length} 個`, itemsWithChildren);

                // 生成 HTML
                const generateNavHtml = (items) => {
                    let html = '';
                    items.sort((a, b) => a.display_order - b.display_order);
                    items.forEach(item => {
                        const hasChildren = item.children.length > 0;
                        const isEffectivelyLink = item.url && item.url !== '#' && !hasChildren;
                        const tagName = isEffectivelyLink ? 'a' : 'span';

                        html += `<li class="${hasChildren ? 'has-children' : ''}">`;
                        html += `<${tagName} ${isEffectivelyLink ? `href="${item.url}" target="contentFrame"` : ''} ${item.url && item.url !== '#' && hasChildren ? `data-url="${item.url}"` : ''}>${item.name}</${tagName}>`;

                        if (hasChildren) {
                            html += '<ul>';
                            html += generateNavHtml(item.children);
                            html += '</ul>';
                        }
                        html += '</li>';
                    });
                    return html;
                };

                const navHtml = generateNavHtml(tree);
                log('生成的 HTML', navHtml);

                navList.innerHTML = navHtml;
                if (loadingIndicator) {
                    loadingIndicator.remove();
                }

                // 添加點擊事件
                const parentItems = navList.querySelectorAll('.has-children > a, .has-children > span');
                log(`找到 ${parentItems.length} 個父層項目`);

                parentItems.forEach((item, index) => {
                    item.addEventListener('click', function(event) {
                        log(`點擊了第 ${index + 1} 個父層項目: ${this.textContent}`);
                        
                        const parentLi = this.closest('li');
                        const subMenu = this.nextElementSibling;
                        
                        log('父層 li:', parentLi);
                        log('子選單:', subMenu);

                        if (subMenu && subMenu.tagName === 'UL') {
                            const isCurrentlyOpen = subMenu.classList.contains('show-dropdown');
                            log(`子選單當前狀態: ${isCurrentlyOpen ? '開啟' : '關閉'}`);
                            
                            // 關閉同層級的其他子選單
                            const parentUl = parentLi.parentElement;
                            const siblings = parentUl.querySelectorAll(':scope > li.has-children > ul.show-dropdown');
                            siblings.forEach(siblingMenu => {
                                if (siblingMenu !== subMenu) {
                                    siblingMenu.classList.remove('show-dropdown');
                                    log('關閉了同層級的子選單');
                                }
                            });

                            // 切換當前子選單
                            subMenu.classList.toggle('show-dropdown');
                            log(`子選單新狀態: ${subMenu.classList.contains('show-dropdown') ? '開啟' : '關閉'}`);

                            // 如果有 data-url，進行跳轉
                            const targetUrl = this.dataset.url;
                            if (targetUrl) {
                                log(`嘗試跳轉到: ${targetUrl}`);
                                if (window.parent && window.parent.frames && window.parent.frames['contentFrame']) {
                                    window.parent.frames['contentFrame'].location.href = targetUrl;
                                    log('成功跳轉到 contentFrame');
                                } else {
                                    log('找不到 contentFrame，嘗試在目前視窗開啟');
                                    window.open(targetUrl, '_blank');
                                }
                            }
                            
                            event.preventDefault();
                        }
                        event.stopPropagation();
                    });
                });

                // 點擊其他地方關閉所有下拉選單
                document.addEventListener('click', function(event) {
                    if (!navList.contains(event.target)) {
                        const openMenus = navList.querySelectorAll('ul.show-dropdown');
                        if (openMenus.length > 0) {
                            log(`關閉了 ${openMenus.length} 個開啟的子選單`);
                            openMenus.forEach(menu => {
                                menu.classList.remove('show-dropdown');
                            });
                        }
                    }
                });

                log('導覽列初始化完成');

            } catch (error) {
                console.error('載入導覽連結失敗:', error);
                log('載入導覽連結時發生錯誤', {
                    message: error.message,
                    stack: error.stack
                });
                
                if (loadingIndicator) {
                    loadingIndicator.textContent = '載入導覽列失敗';
                } else {
                    navList.innerHTML = '<li>載入導覽列失敗</li>';
                }
            }
        });
    </script>
</body>
</html>