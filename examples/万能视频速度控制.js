// ==UserScript==
// @name         万能视频速度控制
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  通过快捷键控制网页视频播放速度的油猴脚本
// @author       Liang
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 默认播放速度
    let playbackRate = 1.0;
    const MIN_SPEED = 0.1;
    const MAX_SPEED = 16.0;

    // 创建显示倍速的元素
    const speedDisplay = document.createElement('div');
    speedDisplay.style.position = 'fixed';
    speedDisplay.style.top = '10px';
    speedDisplay.style.right = '10px';
    speedDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    speedDisplay.style.color = 'white';
    speedDisplay.style.padding = '5px';
    speedDisplay.style.borderRadius = '5px';
    speedDisplay.style.zIndex = '9999';
    speedDisplay.style.display = 'none';
    speedDisplay.style.cursor = 'move'; // 添加移动光标样式
    document.body.appendChild(speedDisplay);

    // 添加拖动功能
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    speedDisplay.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;

        if (e.target === speedDisplay) {
            isDragging = true;
        }
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;

            xOffset = currentX;
            yOffset = currentY;

            setTranslate(currentX, currentY, speedDisplay);
        }
    }

    function setTranslate(xPos, yPos, el) {
        el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
    }

    function dragEnd() {
        isDragging = false;
    }

    // 监听键盘事件
    document.addEventListener('keydown', function(event) {
        // 检查是否在输入框中
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }

        // 获取所有视频元素
        const videos = document.querySelectorAll('video');

        // 如果没有视频元素，直接返回
        if (videos.length === 0) {
            return;
        }

        // 判断按键
        switch(event.key) {
            case '+': // 加速
                playbackRate = Math.min(MAX_SPEED, playbackRate + 0.1);
                break;
            case '-': // 减速
                playbackRate = Math.max(MIN_SPEED, playbackRate - 0.1);
                break;
            case '0': // 重置速度
                playbackRate = 1.0;
                break;
            default:
                return; // 其他按键不处理
        }

        // 限制小数点后两位
        playbackRate = parseFloat(playbackRate.toFixed(2));

        // 设置所有视频的播放速度
        videos.forEach(video => {
            video.playbackRate = playbackRate;
        });

        // 更新并显示倍速显示元素
        speedDisplay.textContent = `倍速: ${playbackRate}x`;
        speedDisplay.style.display = 'block';

        // 停止改变速度后隐藏倍速显示元素
        clearTimeout(speedDisplay.timeout);
        speedDisplay.timeout = setTimeout(() => {
            speedDisplay.style.display = 'none';
        }, 1000);

        // 阻止默认行为
        event.preventDefault();
    });
})();