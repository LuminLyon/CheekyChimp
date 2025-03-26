// ==UserScript==
// @name         Bilibili 视频速度控制
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  在Bilibili网站播放视频时可以任意调节速度，调节范围从0.1倍到16倍，有按钮控制，并且可以恢复默认速度。使用鼠标滑轮调节速度。
// @author       Liang
// @match        *://www.bilibili.com/video/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    function waitForPlayer() {
        console.log('B站视频速度控制脚本启动');
        
        // 使用MutationObserver监听DOM变化，确保在播放器加载后运行
        const observer = new MutationObserver((mutations, obs) => {
            const player = document.querySelector('.bpx-player-ctrl-playbackrate');
            if (player) {
                console.log('找到B站播放器速度控制元素');
                addWheelControl(player);
                obs.disconnect(); // 找到后停止观察
            }
        });
        
        // 开始观察document.body整体变化
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // 同时尝试直接检查元素是否已经存在
        const player = document.querySelector('.bpx-player-ctrl-playbackrate');
        if (player) {
            console.log('直接找到B站播放器速度控制元素');
            addWheelControl(player);
            observer.disconnect();
        }
    }

    // 添加滑轮控制功能
    function addWheelControl(player) {
        console.log('添加滑轮控制');
        
        // 创建一个显示当前速度的元素
        const speedIndicator = document.createElement('div');
        speedIndicator.className = 'custom-speed-indicator';
        speedIndicator.style.cssText = 'position: absolute; top: -30px; background: rgba(0,0,0,0.7); color: white; padding: 5px 10px; border-radius: 4px; display: none; z-index: 1000;';
        player.appendChild(speedIndicator);
        
        // 使用鼠标滑轮调节速度
        player.addEventListener('mouseenter', () => {
            document.addEventListener('wheel', onWheel, { passive: false });
            
            // 显示当前速度
            const video = document.querySelector('video');
            if (video) {
                speedIndicator.textContent = `速度: ${video.playbackRate}x`;
                speedIndicator.style.display = 'block';
            }
        });

        player.addEventListener('mouseleave', () => {
            document.removeEventListener('wheel', onWheel);
            speedIndicator.style.display = 'none';
        });

        function onWheel(event) {
            event.preventDefault(); // 防止页面滚动
            const video = document.querySelector('video');
            if (video) {
                let newRate;
                if (event.deltaY < 0) {
                    // 向上滚动，增加速度
                    newRate = Math.min(parseFloat((video.playbackRate + 0.1).toFixed(1)), 16);
                } else {
                    // 向下滚动，减小速度
                    newRate = Math.max(parseFloat((video.playbackRate - 0.1).toFixed(1)), 0.1);
                }
                
                // 更新视频速度
                video.playbackRate = newRate;
                
                // 更新指示器
                speedIndicator.textContent = `速度: ${newRate}x`;
                speedIndicator.style.display = 'block';
                
                // 同时更新B站自己的速度显示
                try {
                    const speedDisplay = player.querySelector('.bpx-player-ctrl-playbackrate-menu-item-active');
                    if (speedDisplay) {
                        speedDisplay.innerText = `${newRate}x`;
                    }
                } catch (e) {
                    console.error('更新B站速度显示失败', e);
                }
                
                console.log(`视频速度已设置为: ${newRate}x`);
            }
        }
    }

    // 当DOM加载完成后启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForPlayer);
    } else {
        waitForPlayer();
    }
})();