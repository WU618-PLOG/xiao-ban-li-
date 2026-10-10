/* =========================================================
   小板栗 · PWA 支持（离线缓存注册 + 安装引导）
   依赖：app.js 的全局 toast()、index.html 的 #btn-install 按钮
   加载顺序：必须排在 app.js 之后
   ========================================================= */
(function () {
  'use strict';

  /* ---------- Service Worker 注册 ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });

    /* 新版本 Service Worker 接管后自动刷新一次，避免新旧文件混用 */
    if (navigator.serviceWorker.controller) {
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    }
  }

  /* ---------- 安装引导 ---------- */
  const btn = document.getElementById('btn-install');
  if (!btn) return;

  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  if (standalone) return; // 已以应用形态打开，无需引导

  let deferred = null;

  /* Android / 桌面 Chrome、Edge：支持一键安装 */
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    btn.hidden = false;
  });

  window.addEventListener('appinstalled', () => {
    btn.hidden = true;
    deferred = null;
    toast('安装完成，去桌面找小板栗吧');
  });

  /* iOS Safari 没有安装事件：显示按钮并给出手动步骤 */
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (ua.indexOf('Mac') > -1 && 'ontouchend' in document);
  const isSafari = isIOS && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  if (isSafari) btn.hidden = false;

  btn.addEventListener('click', async () => {
    if (deferred) {
      deferred.prompt();
      const choice = await deferred.userChoice;
      deferred = null;
      if (choice && choice.outcome === 'accepted') btn.hidden = true;
      return;
    }
    toast('点底部分享按钮，选「添加到主屏幕」即可安装');
  });
})();
