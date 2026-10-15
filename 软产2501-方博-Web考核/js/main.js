/* ==========================================================================
   个人主页 · 交互脚本
   原生 JavaScript（ES6+），无任何第三方库。
   包含 6 项交互：
     1. 深浅色主题切换（localStorage 记忆 + 跟随系统偏好）
     2. 移动端导航菜单展开 / 收起
     3. 未来规划 Tab 切换（支持键盘方向键）
     4. 学习目标手风琴折叠 / 展开（按内容实测高度做动画）
     5. 滚动联动：导航高亮、阅读进度条、内容渐入、技能条增长
     6. 回到顶部按钮 + 一键复制 QQ 号
   ========================================================================== */

(function () {
  'use strict';

  const $ = (selector, scope) => (scope || document).querySelector(selector);
  const $$ = (selector, scope) => Array.from((scope || document).querySelectorAll(selector));
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------
     1. 主题切换：data-theme 属性 + localStorage 记忆
     ------------------------------------------------------------------ */
  const THEME_KEY = 'homepage-theme';
  const themeToggle = $('#themeToggle');

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    if (themeToggle) {
      themeToggle.setAttribute('aria-label',
        theme === 'dark' ? '切换到浅色主题' : '切换到深色主题');
    }
  }

  (function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    // 用户手动选过就用用户的选择；否则跟随系统偏好
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (systemDark ? 'dark' : 'light'));
  })();

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem(THEME_KEY, next);   // 记忆选择，刷新后仍是同一主题
    });
  }

  /* ------------------------------------------------------------------
     2. 移动端导航菜单
     ------------------------------------------------------------------ */
  const menuToggle = $('#menuToggle');
  const nav = $('#primaryNav');

  function closeMenu() {
    if (!nav || !menuToggle) return;
    nav.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', '打开导航菜单');
  }

  if (menuToggle && nav) {
    menuToggle.addEventListener('click', function () {
      const open = nav.classList.toggle('is-open');
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
    });

    // 点击导航项后自动收起（移动端体验）
    $$('.nav-link', nav).forEach(link => link.addEventListener('click', closeMenu));

    // 点击区域外或按 Esc 也收起
    document.addEventListener('click', function (event) {
      if (!nav.classList.contains('is-open')) return;
      if (nav.contains(event.target) || menuToggle.contains(event.target)) return;
      closeMenu();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeMenu();
    });
  }

  /* ------------------------------------------------------------------
     3. Tab 切换（含键盘操作，符合无障碍习惯）
     ------------------------------------------------------------------ */
  const tabButtons = $$('.tab-btn');

  function selectTab(button) {
    tabButtons.forEach(function (btn) {
      const selected = btn === button;
      btn.classList.toggle('is-active', selected);
      btn.setAttribute('aria-selected', String(selected));
      btn.tabIndex = selected ? 0 : -1;

      const panel = document.getElementById(btn.getAttribute('aria-controls'));
      if (panel) panel.classList.toggle('is-active', selected);
    });
  }

  tabButtons.forEach(function (btn, index) {
    btn.addEventListener('click', () => selectTab(btn));

    // 左右方向键切换，Home / End 跳首尾
    btn.addEventListener('keydown', function (event) {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      let target = null;

      if (step) target = tabButtons[(index + step + tabButtons.length) % tabButtons.length];
      else if (event.key === 'Home') target = tabButtons[0];
      else if (event.key === 'End') target = tabButtons[tabButtons.length - 1];
      if (!target) return;

      event.preventDefault();
      selectTab(target);
      target.focus();
    });
  });

  /* ------------------------------------------------------------------
     4. 手风琴：折叠 / 展开
        用元素实测内容高度设置 max-height，避免固定高度裁剪长文本
     ------------------------------------------------------------------ */
  const accordionItems = $$('.accordion-item');

  function expandPanel(body) {
    body.style.maxHeight = body.scrollHeight + 'px';
    // 展开动画结束后改为 none，内容再变高也不会被裁剪
    body.addEventListener('transitionend', function onEnd(event) {
      if (event.propertyName !== 'max-height') return;
      body.removeEventListener('transitionend', onEnd);
      if (body.closest('.accordion-item').classList.contains('is-open')) {
        body.style.maxHeight = 'none';
      }
    });
  }

  function collapsePanel(body) {
    // 从 none 过渡到 0 无法动画，先锁定当前高度再收起
    if (getComputedStyle(body).maxHeight === 'none') {
      body.style.maxHeight = body.scrollHeight + 'px';
      void body.offsetHeight;            // 强制重排，让浏览器记录起始高度
    }
    body.style.maxHeight = '0px';
  }

  accordionItems.forEach(function (item) {
    const button = $('.accordion-btn', item);
    const body = $('.accordion-body', item);
    if (!button || !body) return;

    // 初始状态：HTML 里标了 is-open 的先展开
    if (item.classList.contains('is-open')) expandPanel(body);
    else body.style.maxHeight = '0px';

    button.addEventListener('click', function () {
      const willOpen = !item.classList.contains('is-open');
      item.classList.toggle('is-open', willOpen);
      button.setAttribute('aria-expanded', String(willOpen));
      willOpen ? expandPanel(body) : collapsePanel(body);
    });
  });

  // 窗口尺寸变化时，重算已展开面板的高度（debounce 200ms）
  let resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      accordionItems.forEach(function (item) {
        const body = $('.accordion-body', item);
        if (body && item.classList.contains('is-open')) {
          body.style.maxHeight = body.scrollHeight + 'px';
          body.style.maxHeight = 'none';
        }
      });
    }, 200);
  });

  /* ------------------------------------------------------------------
     5. 滚动联动
     ------------------------------------------------------------------ */
  const header = $('#siteHeader');
  const progressBar = $('#scrollProgress');
  const backToTop = $('#backToTop');

  // 滚动帧内只做一次计算，避免高频布局抖动
  let ticking = false;
  function onScroll() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;

    if (header) header.classList.toggle('is-scrolled', scrollTop > 8);
    if (progressBar) {
      progressBar.style.width = (docHeight > 0 ? (scrollTop / docHeight) * 100 : 0) + '%';
    }
    if (backToTop) backToTop.hidden = scrollTop < 420;
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(onScroll);
  }, { passive: true });
  onScroll();

  // 5.1 导航高亮：用 IntersectionObserver 监听各区块
  const navLinks = $$('.nav-link');
  const sections = navLinks
    .map(link => document.getElementById(link.getAttribute('href').slice(1)))
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    const spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) {
          link.classList.toggle('is-active',
            link.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, {
      // 让"当前区块"取屏幕中部那一个，避免相邻区块来回跳
      rootMargin: '-45% 0px -50% 0px',
      threshold: 0
    });
    sections.forEach(section => spy.observe(section));
  }

  // 5.2 内容渐入 + 技能条增长
  const revealTargets = $$('.reveal');
  if ('IntersectionObserver' in window && !prefersReducedMotion) {
    const revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);       // 只播一次
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    revealTargets.forEach(el => revealObserver.observe(el));
  } else {
    revealTargets.forEach(el => el.classList.add('is-visible'));
  }

  /* ------------------------------------------------------------------
     6. 回到顶部 + 复制 QQ 号
     ------------------------------------------------------------------ */
  if (backToTop) {
    backToTop.addEventListener('click', function () {
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
    });
  }

  const copyButton = $('#copyQQ');
  const copyTip = $('#copyTip');

  if (copyButton) {
    copyButton.addEventListener('click', async function () {
      // 以页面上显示的 QQ 号为准，保证只有一处需要维护
      const target = $('#contact .contact-value');
      const text = target ? target.textContent.trim() : '';
      if (!text) return;

      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch (err) {
        // 剪贴板 API 不可用时退回 execCommand 方案
        const temp = document.createElement('textarea');
        temp.value = text;
        temp.style.position = 'fixed';
        temp.style.opacity = '0';
        document.body.appendChild(temp);
        temp.select();
        ok = document.execCommand('copy');
        document.body.removeChild(temp);
      }

      if (copyTip) {
        copyTip.textContent = ok ? '已复制：' + text : '复制失败，请手动选中复制';
        setTimeout(() => { copyTip.textContent = ''; }, 2200);
      }
    });
  }

  /* ------------------------------------------------------------------
     7. 页尾年份自动更新
     ------------------------------------------------------------------ */
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
