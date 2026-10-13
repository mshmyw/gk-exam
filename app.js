/* 公考刷题 · 纯静态 H5 —— 无框架、无构建、无后端、无 Service Worker */
(function () {
  'use strict';

  var PAPERS = Array.isArray(window.EXAM_PAPERS) ? window.EXAM_PAPERS : [];
  var TYPE_ORDER = ['国考', '广东省考', '广东事业单位（编制）'];
  var K_PROGRESS = 'gk.progress.';
  var K_RESULT = 'gk.result.';
  var K_WRONG = 'gk.wrong';
  var K_ESSAY = 'gk.essay.';
  var K_HELPED = 'gk.helped';
  var WRONG_ID = '__wrong__';

  var $app = document.getElementById('app');
  var $title = document.getElementById('topTitle');
  var $right = document.getElementById('topRight');
  var $back = document.getElementById('backBtn');
  var $sheet = document.getElementById('sheet');
  var $sheetTitle = document.getElementById('sheetTitle');
  var $sheetBody = document.getElementById('sheetBody');
  var $sheetFoot = document.getElementById('sheetFoot');

  var quiz = null;       // 当前会话（客观题或申论）
  var timerId = null;
  var saveTimer = null;
  var reviewAll = true;

  /* ==================== 工具 ==================== */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function letter(i) { return String.fromCharCode(65 + i); }
  function readJSON(k, def) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; }
    catch (e) { return def; }
  }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function markFlag(k) { try { localStorage.setItem(k, '1'); } catch (e) {} }
  function hasFlag(k) { try { return localStorage.getItem(k) === '1'; } catch (e) { return false; } }
  function removeKey(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function fmtTime(sec) {
    sec = Math.max(0, sec | 0);
    var h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
    var mm = h ? String(m).padStart(2, '0') : String(m);
    return (h ? h + ':' : '') + mm + ':' + String(s).padStart(2, '0');
  }
  function countChars(s) { return String(s || '').replace(/\s/g, '').length; }
  function isEssayPaper(p) { return p && p.kind === 'essay'; }
  function qType(q) { return q.type || 'single'; }
  function typeLabel(q) {
    var t = qType(q);
    return t === 'multi' ? '多选' : (t === 'judge' ? '判断' : '');
  }
  /* 判断题的选项圈里显示 √ / ×，更直观 */
  function keyLabel(q, i) {
    return qType(q) === 'judge' ? (i === 0 ? '√' : '×') : letter(i);
  }

  function isAnswered(a) { return Array.isArray(a) ? a.length > 0 : a !== null && a !== undefined; }
  function isCorrect(q, a) {
    if (!isAnswered(a)) return false;
    if (qType(q) === 'multi') {
      if (!Array.isArray(a) || a.length !== q.answer.length) return false;
      return a.join(',') === q.answer.join(',');
    }
    return a === q.answer;
  }
  function rightText(q) {
    return qType(q) === 'multi' ? q.answer.map(letter).join('、') : letter(q.answer);
  }
  function pickedText(q, a) {
    if (!isAnswered(a)) return '未作答';
    return qType(q) === 'multi' ? a.map(letter).join('、') : letter(a);
  }
  function optIsRight(q, k) {
    return qType(q) === 'multi' ? q.answer.indexOf(k) >= 0 : k === q.answer;
  }
  function optIsPicked(q, a, k) {
    if (!isAnswered(a)) return false;
    return qType(q) === 'multi' ? a.indexOf(k) >= 0 : k === a;
  }

  /* ==================== 索引 ==================== */

  function flatten(paper) {
    var out = [];
    (paper.sections || []).forEach(function (sec) {
      (sec.questions || []).forEach(function (q) {
        out.push({ q: q, section: sec.name, material: sec.material || '' });
      });
    });
    return out;
  }
  function paperById(id) {
    for (var i = 0; i < PAPERS.length; i++) if (PAPERS[i].id === id) return PAPERS[i];
    return null;
  }
  function qCount(p) {
    return isEssayPaper(p)
      ? (p.questions || []).length
      : (p.sections || []).reduce(function (a, s) { return a + s.questions.length; }, 0);
  }

  var QINDEX = {};   // 只有客观题卷参与错题本
  PAPERS.forEach(function (p) {
    (p.sections || []).forEach(function (s) {
      (s.questions || []).forEach(function (q) { QINDEX[q.id] = q; });
    });
  });

  PAPERS.sort(function (a, b) {
    var ta = TYPE_ORDER.indexOf(a.examType), tb = TYPE_ORDER.indexOf(b.examType);
    if (ta < 0) ta = 99;
    if (tb < 0) tb = 99;
    return ta !== tb ? ta - tb : (a.year || 0) - (b.year || 0);
  });

  /* ==================== 错题本 ==================== */

  function getWrong() { return readJSON(K_WRONG, {}); }
  function wrongCount() { return Object.keys(getWrong()).length; }
  function wrongPaper() {
    var qs = Object.keys(getWrong()).map(function (id) { return QINDEX[id]; }).filter(Boolean);
    if (!qs.length) return null;
    return {
      id: WRONG_ID, title: '错题本', examType: '错题本', subject: '错题重做',
      year: 0, duration: Math.max(10, qs.length),
      sections: [{ name: '错题重做', material: null, questions: qs }]
    };
  }

  /* ==================== 抽屉 ==================== */

  function openDrawer(title, bodyHtml, footHtml) {
    $sheetTitle.textContent = title;
    $sheetBody.innerHTML = bodyHtml;
    $sheetFoot.innerHTML = footHtml || '';
    $sheet.hidden = false;
    $sheetBody.scrollTop = 0;
  }
  function closeDrawer() { $sheet.hidden = true; }

  /* 答题卡 / 申论题目列表 */
  function openCardDrawer() {
    if (!quiz) return;
    var essay = quiz.kind === 'essay';
    var n = essay ? quiz.drafts.length : quiz.items.length;
    var html = '<div class="sheet-grid">';
    for (var i = 0; i < n; i++) {
      var cls = (isItemAnswered(i) ? 'done' : '') + (i === quiz.idx ? ' cur' : '');
      html += '<button type="button" class="' + cls + '" data-act="jump" data-i="' + i + '">' + (i + 1) + '</button>';
    }
    html += '</div><div class="sheet-legend">' +
      '<span><i class="dot done"></i>' + (essay ? '已写' : '已答') + '</span>' +
      '<span><i class="dot todo"></i>未' + (essay ? '写' : '答') + '</span>' +
      '<span><i class="dot cur"></i>当前</span></div>';

    openDrawer(essay ? '题目列表' : '答题卡', html,
      '<button type="button" class="btn primary block" data-act="submit">' +
      (essay ? '完成作答' : '交卷') + '</button>');
  }

  /* 客观题：答案与解析 */
  function openAnswerDrawer() {
    if (!quiz || quiz.kind !== 'obj') return;
    var it = quiz.items[quiz.idx];
    var a = quiz.answers[quiz.idx];
    var t = qType(it.q);

    var body = '<div class="ans-head">正确答案：<b>' + rightText(it.q) + '</b>' +
      (typeLabel(it.q) ? '<span class="badge">' + typeLabel(it.q) + '</span>' : '') +
      (isAnswered(a) ? '<span class="muted">你选了 ' + esc(pickedText(it.q, a)) + '</span>' : '') +
      '</div>';
    body += '<div class="ans-stem">' + esc(it.q.stem) + '</div><div class="opts">';
    (it.q.options || []).forEach(function (opt, k) {
      var cls = optIsRight(it.q, k) ? ' right' : (optIsPicked(it.q, a, k) ? ' wrong' : '');
      body += '<div class="opt' + cls + (t === 'multi' ? ' multi' : '') + '">' +
        '<span class="key">' + keyLabel(it.q, k) + '</span>' +
        '<span class="body">' + esc(opt) + '</span></div>';
    });
    body += '</div><div class="explain"><b>解析：</b>' + esc(it.q.explain || '暂无解析') + '</div>';

    openDrawer('答案与解析', body,
      '<button type="button" class="btn primary block" data-act="closeDrawer">知道了</button>');
  }

  /* 申论：参考要点 / 参考范文 */
  function openRefDrawer() {
    if (!quiz || quiz.kind !== 'essay') return;
    var q = quiz.paper.questions[quiz.idx];
    var isBig = !!q.min;
    var body = '<div class="ans-head">第 ' + (quiz.idx + 1) + ' 题 · ' + (q.score || 0) + ' 分' +
      (q.limit ? ' · 不超过 ' + q.limit + ' 字' : '') +
      '<span class="badge hint">对照自评</span></div>' +
      '<div class="ref">' + esc(q.answer || '暂无参考要点') + '</div>';

    openDrawer(isBig ? '参考范文与写作提示' : '参考要点与评分参考', body,
      '<button type="button" class="btn primary block" data-act="closeDrawer">收起</button>');
  }

  /* 使用说明 / 新手指引 */
  function openHelpDrawer() {
    markFlag(K_HELPED);
    var body = '<div class="help">' +
      '<h3>这是什么</h3>' +
      '<p>广东公考刷题练习页，共 15 套卷：国考与广东省考的《行测》《申论》，以及广东事业单位《公共基础知识》。' +
      '题目是依据历年真题题型结构编写的<b>原创模拟题</b>，不是官方真题原文。</p>' +

      '<h3>三种客观题型怎么答</h3>' +
      '<ul>' +
      '<li><b>单选</b>：点一个选项即选中，可以随时改。</li>' +
      '<li><b>多选</b>：选项框是方的，可以点多个；<b>漏选、错选都不得分</b>，要把正确答案全部勾上。再点一次取消。</li>' +
      '<li><b>判断</b>：选项圈显示 √ / ×，选择「正确」或「错误」。</li>' +
      '</ul>' +

      '<h3>做题时能用的功能</h3>' +
      '<ul>' +
      '<li><b>答题卡</b>：底部按钮，题号网格总览，已答 / 未答 / 当前一目了然，点题号直接跳题。</li>' +
      '<li><b>查看答案与解析</b>：题目下方按钮，想立刻对答案时用（抽屉里显示正确答案、选项标记和解析）。' +
      '交卷后也会在回顾页逐题列出。</li>' +
      '<li><b>计时</b>：右上角正计时，仅供参考，不会自动交卷。</li>' +
      '<li><b>交卷</b>：最后一题或答题卡底部，出百分制得分；有未答题会先确认。</li>' +
      '</ul>' +

      '<h3>申论怎么用</h3>' +
      '<ul>' +
      '<li>上方是给定资料，可上下滚动阅读；下方是答题框，<b>边写边显示字数</b>，对照题目的字数上限。</li>' +
      '<li>草稿自动存在本机浏览器，关掉页面再回来可以接着写。</li>' +
      '<li>每题都能点「查看参考要点」（大作文是「查看参考范文」），在抽屉里展开对照自评。</li>' +
      '<li>点「完成」后有汇总页，把你的作答和参考要点并排列出来，也能随时回去修改。</li>' +
      '</ul>' +

      '<h3>进度与错题</h3>' +
      '<ul>' +
      '<li>答题进度、上次得分、申论草稿都存在本机浏览器，换设备或清缓存会丢失。</li>' +
      '<li>客观题答错会自动收进<b>错题本</b>，答对自动移出，可以单独重做。</li>' +
      '</ul>' +

      '<h3>说明</h3>' +
      '<p>纯静态页面，无后端、不联网、不使用 Service Worker。申论是主观题，页面不会自动打分，请对照参考要点自评。' +
      '题目与答案仅供练习，最终以官方考试大纲和教材为准。随时可以点右上角 <code>?</code> 再打开本说明。</p>' +
      '</div>';

    openDrawer('使用说明', body,
      '<button type="button" class="btn primary block" data-act="closeDrawer">开始刷题</button>');
  }

  /* ==================== 首页 ==================== */

  function renderHome() {
    stopTimer();
    quiz = null;
    $title.textContent = '公考刷题';
    $right.textContent = '';
    $back.hidden = true;

    if (!PAPERS.length) {
      $app.innerHTML = '<div class="card">未加载到题库。请确认 <code>data/papers.js</code> 是否存在。</div>';
      return;
    }

    var objN = 0, essayN = 0;
    PAPERS.forEach(function (p) { if (isEssayPaper(p)) essayN++; else objN++; });

    var html = '<div class="hero"><h2>广东公考刷题</h2>' +
      '<p class="muted">广东省考 · 国考 · 广东事业单位（编制），2023—2025 三个年度，共 ' +
      PAPERS.length + ' 套（客观题卷 ' + objN + ' 套 / 申论卷 ' + essayN + ' 套）。' +
      '题目均为依据历年真题题型结构编写的<b>原创模拟题</b>，非官方真题原文。' +
      '第一次使用可点右上角 <b>?</b> 看使用说明。</p></div>';

    var wc = wrongCount();
    if (wc > 0) {
      html += '<div class="card paper" data-act="open" data-id="' + WRONG_ID + '">' +
        '<div class="info"><div class="name">错题本</div>' +
        '<div class="meta">共 ' + wc + ' 道错题，答对后自动移出</div></div>' +
        '<span class="go">&#8250;</span></div>';
    }

    var groups = {};
    PAPERS.forEach(function (p) { (groups[p.examType] = groups[p.examType] || []).push(p); });

    Object.keys(groups).forEach(function (type) {
      groups[type].sort(function (a, b) {
        var ka = isEssayPaper(a) ? 1 : 0, kb = isEssayPaper(b) ? 1 : 0;
        return ka !== kb ? ka - kb : (a.year || 0) - (b.year || 0);
      });
      html += '<div class="group-title">' + esc(type) + '</div>';
      groups[type].forEach(function (p) {
        var n = qCount(p);
        var meta = (p.subject || '') + ' · ' + n + ' 题 · ' + (p.duration || 90) + ' 分钟';
        var tail = '<span class="go">&#8250;</span>';

        if (isEssayPaper(p)) {
          var st = readJSON(K_ESSAY + p.id, null) || {};
          var written = (st.drafts || []).filter(function (d) { return d && d.trim(); }).length;
          if (st.done) {
            meta += ' · 已完卷 · 用时 ' + fmtTime(st.elapsed || 0);
            tail = '<span class="score">已完成</span>';
          } else if (written > 0) {
            meta += ' · 已写 ' + written + '/' + n + ' 题';
            tail = '<span class="tag">继续</span>';
          } else {
            tail = '<span class="tag alt">未开始</span>';
          }
        } else {
          var res = readJSON(K_RESULT + p.id, null);
          var prog = readJSON(K_PROGRESS + p.id, null);
          if (res) {
            meta += ' · 上次 ' + res.score + ' 分 · 用时 ' + fmtTime(res.elapsed);
            tail = '<span class="score">' + res.score + ' 分</span>';
          } else if (prog && (prog.answers || []).some(isAnswered)) {
            var done = prog.answers.filter(isAnswered).length;
            meta += ' · 已答 ' + done + '/' + n;
            tail = '<span class="tag">继续</span>';
          }
        }

        html += '<div class="card paper" data-act="open" data-id="' + esc(p.id) + '">' +
          '<div class="info"><div class="name">' + esc(p.title) + '</div>' +
          '<div class="meta">' + esc(meta) + '</div></div>' + tail + '</div>';
      });
    });

    html += '<p class="muted" style="margin:16px 2px">答题进度与申论草稿自动保存在本机浏览器，关闭页面后可继续。</p>';
    $app.innerHTML = html;
  }

  /* ==================== 会话启动 ==================== */

  function startPaper(paper) {
    if (isEssayPaper(paper)) return startEssay(paper);

    var items = flatten(paper);
    if (!items.length) return;
    var answers = items.map(function () { return null; });
    var idx = 0, elapsed = 0;

    if (paper.id !== WRONG_ID) {
      var prog = readJSON(K_PROGRESS + paper.id, null);
      if (prog && prog.answers && prog.answers.length === items.length) {
        answers = prog.answers;
        idx = Math.min(prog.idx || 0, items.length - 1);
        elapsed = prog.elapsed || 0;
      }
    }
    quiz = { kind: 'obj', paper: paper, items: items, answers: answers, idx: idx, elapsed: elapsed };
    startTimer();
    renderQuiz();
  }

  function startEssay(paper) {
    var n = (paper.questions || []).length;
    if (!n) return;
    var drafts = new Array(n).fill('');
    var idx = 0, elapsed = 0, done = false;

    var st = readJSON(K_ESSAY + paper.id, null);
    if (st && Array.isArray(st.drafts) && st.drafts.length === n) {
      drafts = st.drafts;
      idx = Math.min(st.idx || 0, n - 1);
      elapsed = st.elapsed || 0;
      done = !!st.done;
    }
    quiz = { kind: 'essay', paper: paper, drafts: drafts, idx: idx, elapsed: elapsed, done: done };
    startTimer();
    renderEssay();
  }

  function startTimer() {
    stopTimer();
    timerId = setInterval(function () {
      if (!quiz) return;
      quiz.elapsed++;
      var n = quiz.kind === 'essay' ? quiz.drafts.length : quiz.items.length;
      $right.textContent = fmtTime(quiz.elapsed) + ' · ' + (quiz.idx + 1) + '/' + n;
      if (quiz.elapsed % 5 === 0) saveSession();
    }, 1000);
  }
  function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

  function saveSession() {
    if (!quiz) return;
    if (quiz.kind === 'essay') {
      writeJSON(K_ESSAY + quiz.paper.id, {
        drafts: quiz.drafts, idx: quiz.idx, elapsed: quiz.elapsed, done: !!quiz.done
      });
    } else if (quiz.paper.id !== WRONG_ID) {
      writeJSON(K_PROGRESS + quiz.paper.id, {
        answers: quiz.answers, idx: quiz.idx, elapsed: quiz.elapsed
      });
    }
  }
  function scheduleEssaySave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveSession, 400);
  }

  /* ==================== 客观题作答 ==================== */

  function renderQuiz() {
    var it = quiz.items[quiz.idx];
    var picked = quiz.answers[quiz.idx];
    var t = qType(it.q);

    $back.hidden = false;
    $title.textContent = quiz.paper.title;
    $right.textContent = fmtTime(quiz.elapsed) + ' · ' + (quiz.idx + 1) + '/' + quiz.items.length;

    var html = '<div class="card">' +
      '<div class="sec-name">' +
      '<span class="chip">' + esc(it.section) + '</span>' +
      (typeLabel(it.q) ? '<span class="badge">' + typeLabel(it.q) + '</span>' : '') +
      (t === 'multi' ? '<span class="badge hint">选出所有正确答案</span>' : '') +
      '</div>' +
      (it.material ? '<div class="material">' + esc(it.material) + '</div>' : '') +
      '<div class="stem">' + esc(it.q.stem) + '</div><div class="opts">';

    (it.q.options || []).forEach(function (opt, i) {
      var on = optIsPicked(it.q, picked, i);
      html += '<button type="button" class="opt' + (on ? ' sel' : '') + (t === 'multi' ? ' multi' : '') +
        '" data-act="opt" data-i="' + i + '">' +
        '<span class="key">' + keyLabel(it.q, i) + '</span><span class="body">' + esc(opt) + '</span></button>';
    });

    html += '</div><button type="button" class="link-btn" data-act="answer">查看答案与解析</button></div>' +
      '<div class="navbar">' +
      '<button type="button" class="btn" data-act="prev"' + (quiz.idx === 0 ? ' disabled' : '') + '>上一题</button>' +
      '<button type="button" class="btn" data-act="card">答题卡</button>' +
      (quiz.idx === quiz.items.length - 1
        ? '<button type="button" class="btn primary" data-act="submit">交卷</button>'
        : '<button type="button" class="btn primary" data-act="next">下一题</button>') +
      '</div>';

    $app.innerHTML = html;
    window.scrollTo(0, 0);
  }

  function pickOption(i) {
    var q = quiz.items[quiz.idx].q;
    if (qType(q) === 'multi') {
      var cur = quiz.answers[quiz.idx];
      if (!Array.isArray(cur)) cur = [];
      var k = cur.indexOf(i);
      if (k >= 0) cur.splice(k, 1); else cur.push(i);
      cur.sort(function (a, b) { return a - b; });
      quiz.answers[quiz.idx] = cur.length ? cur : null;
    } else {
      quiz.answers[quiz.idx] = i;
    }
    saveSession();
    renderQuiz();
  }

  function goto(delta) {
    var n = quiz.kind === 'essay' ? quiz.drafts.length : quiz.items.length;
    var next = quiz.idx + delta;
    if (next < 0 || next >= n) return;
    quiz.idx = next;
    saveSession();
    if (quiz.kind === 'essay') renderEssay(); else renderQuiz();
  }

  /* ==================== 申论作答 ==================== */

  function renderEssay() {
    var q = quiz.paper.questions[quiz.idx];
    var text = quiz.drafts[quiz.idx] || '';

    $back.hidden = false;
    $title.textContent = quiz.paper.title;
    $right.textContent = fmtTime(quiz.elapsed) + ' · ' + (quiz.idx + 1) + '/' + quiz.drafts.length;

    var limitTxt = q.limit ? '不超过 ' + q.limit + ' 字' : '';
    var minTxt = q.min ? '不少于 ' + q.min + ' 字' : '';
    var reqTxt = [minTxt, limitTxt].filter(Boolean).join('，');

    var html = '<div class="card">' +
      '<div class="sec-name"><span class="chip">' + esc(quiz.paper.materialTitle || '给定资料') + '</span>' +
      '<span class="badge hint">材料较长，可上下滚动阅读</span></div>' +
      '<div class="material essay-material">' + esc(quiz.paper.material || '') + '</div>' +
      '</div>';

    html += '<div class="card">' +
      '<div class="q-no">第 ' + (quiz.idx + 1) + ' 题 · 本题 ' + (q.score || 0) + ' 分' +
      (reqTxt ? ' · ' + reqTxt : '') + '</div>' +
      '<div class="stem">' + esc(q.stem) + '</div>' +
      '<textarea class="draft" id="draft" rows="10" placeholder="在此作答，草稿会自动保存…">' + esc(text) + '</textarea>' +
      '<div class="counter">已写 <b id="cnt">' + countChars(text) + '</b> 字' +
      (q.limit ? ' <span>／ 上限 ' + q.limit + ' 字</span>' : '') + '</div>' +
      '<button type="button" class="link-btn" data-act="ref">' +
      (q.min ? '查看参考范文与写作提示' : '查看参考要点与评分参考') + '</button>' +
      '</div>';

    html += '<div class="navbar">' +
      '<button type="button" class="btn" data-act="prev"' + (quiz.idx === 0 ? ' disabled' : '') + '>上一题</button>' +
      '<button type="button" class="btn" data-act="card">题目列表</button>' +
      (quiz.idx === quiz.drafts.length - 1
        ? '<button type="button" class="btn primary" data-act="submit">完成</button>'
        : '<button type="button" class="btn primary" data-act="next">下一题</button>') +
      '</div>';

    $app.innerHTML = html;
    window.scrollTo(0, 0);
  }

  function onDraftInput(el) {
    quiz.drafts[quiz.idx] = el.value;
    var c = document.getElementById('cnt');
    if (c) c.textContent = countChars(el.value);
    scheduleEssaySave();
  }

  function finishEssay() {
    var written = quiz.drafts.filter(function (d) { return d && d.trim(); }).length;
    var n = quiz.drafts.length;
    if (written < n && !window.confirm('还有 ' + (n - written) + ' 题没有作答，确定完成吗？（草稿会保留，可随时回来修改）')) return;
    stopTimer();
    closeDrawer();
    quiz.done = true;
    saveSession();
    renderEssayReview();
  }

  function renderEssayReview() {
    $back.hidden = false;
    $title.textContent = quiz.paper.title;
    $right.textContent = '已完卷';

    var p = quiz.paper;
    var html = '<div class="card score-box">' +
      '<div class="score-num" style="font-size:26px">申论 · 无法自动判分</div>' +
      '<div class="muted">' + esc(p.title) + '</div>' +
      '<div class="stat-row">' +
      '<div class="stat"><b>' + quiz.drafts.length + '</b><span>题目数</span></div>' +
      '<div class="stat"><b>' + quiz.drafts.filter(function (d) { return d && d.trim(); }).length + '</b><span>已作答</span></div>' +
      '<div class="stat"><b>' + quiz.drafts.reduce(function (a, d) { return a + countChars(d); }, 0) + '</b><span>总字数</span></div>' +
      '<div class="stat"><b>' + fmtTime(quiz.elapsed) + '</b><span>用时</span></div>' +
      '</div></div>';

    html += '<div class="navbar" style="position:static;background:none">' +
      '<button type="button" class="btn" data-act="redo">继续修改</button>' +
      '<button type="button" class="btn" data-act="home">返回首页</button></div>';

    html += '<div class="card muted">申论是主观题，页面无法自动评分。请对照每题下方的参考要点 / 参考范文，' +
      '从「要点是否齐全、结构是否清晰、字数是否达标」三个角度自评。</div>';

    p.questions.forEach(function (q, i) {
      var mine = quiz.drafts[i] || '';
      html += '<div class="card review-item">' +
        '<div class="q-no">第 ' + (i + 1) + ' 题 · ' + (q.score || 0) + ' 分' +
        (q.limit ? ' · 不超过 ' + q.limit + ' 字' : '') +
        ' · 已写 ' + countChars(mine) + ' 字</div>' +
        '<div class="stem">' + esc(q.stem) + '</div>' +
        '<div class="mine">' + (mine.trim() ? esc(mine) : '<span class="muted">（未作答）</span>') + '</div>' +
        '<div class="explain"><b>' + (q.min ? '参考范文：' : '参考要点：') + '</b>' + esc(q.answer || '暂无') + '</div>' +
        '</div>';
    });

    $app.innerHTML = html;
    window.scrollTo(0, 0);
  }

  /* ==================== 交卷与结果 ==================== */

  function isItemAnswered(i) {
    return quiz.kind === 'essay'
      ? !!(quiz.drafts[i] && quiz.drafts[i].trim())
      : isAnswered(quiz.answers[i]);
  }

  function submitSession() {
    if (quiz.kind === 'essay') return finishEssay();

    var unanswered = quiz.answers.filter(function (a) { return !isAnswered(a); }).length;
    if (unanswered > 0 && !window.confirm('还有 ' + unanswered + ' 题未作答，确定交卷吗？')) return;

    stopTimer();
    closeDrawer();

    var items = quiz.items, answers = quiz.answers;
    var correct = 0, wrong = 0, blank = 0;

    answers.forEach(function (a, i) {
      if (!isAnswered(a)) blank++;
      else if (isCorrect(items[i].q, a)) correct++;
      else wrong++;
    });

    var score = Math.round((correct / items.length) * 100);
    var elapsed = quiz.elapsed;

    /* 错题本：答对移出，答错收录（未作答不进错题本） */
    var wb = getWrong();
    answers.forEach(function (a, i) {
      var id = items[i].q.id;
      if (!isAnswered(a)) return;
      if (isCorrect(items[i].q, a)) delete wb[id]; else wb[id] = 1;
    });
    writeJSON(K_WRONG, wb);

    if (quiz.paper.id !== WRONG_ID) {
      removeKey(K_PROGRESS + quiz.paper.id);
      writeJSON(K_RESULT + quiz.paper.id, { score: score, elapsed: elapsed, at: Date.now() });
    }

    quiz = {
      kind: 'obj', paper: quiz.paper, items: items, answers: answers, idx: 0,
      elapsed: elapsed, done: true,
      stat: { correct: correct, wrong: wrong, blank: blank, total: items.length, score: score }
    };
    renderResult(true);
  }

  function renderResult(resetFilter) {
    if (resetFilter) reviewAll = true;
    var s = quiz.stat, items = quiz.items, answers = quiz.answers;

    $back.hidden = false;
    $title.textContent = quiz.paper.title;
    $right.textContent = '得分 ' + s.score;

    var html = '<div class="card score-box">' +
      '<div class="score-num">' + s.score + '<small> 分</small></div>' +
      '<div class="muted">' + esc(quiz.paper.title) + '</div>' +
      '<div class="stat-row">' +
      '<div class="stat"><b style="color:var(--ok)">' + s.correct + '</b><span>答对</span></div>' +
      '<div class="stat"><b style="color:var(--bad)">' + s.wrong + '</b><span>答错</span></div>' +
      '<div class="stat"><b>' + s.blank + '</b><span>未答</span></div>' +
      '<div class="stat"><b>' + fmtTime(quiz.elapsed) + '</b><span>用时</span></div>' +
      '</div></div>';

    html += '<div class="navbar" style="position:static;background:none">' +
      '<button type="button" class="btn" data-act="filter" data-v="' + (reviewAll ? 'wrong' : 'all') + '">' +
      (reviewAll ? '只看错题' : '看全部题目') + '</button>' +
      '<button type="button" class="btn" data-act="redo">重做本卷</button>' +
      '<button type="button" class="btn" data-act="home">返回首页</button></div>';

    var shown = 0;
    items.forEach(function (it, i) {
      var a = answers[i];
      var ok = isCorrect(it.q, a);
      if (!reviewAll && ok) return;
      shown++;

      var verdict = !isAnswered(a)
        ? '<span class="verdict skip">未作答</span>'
        : (ok ? '<span class="verdict ok">答对</span>' : '<span class="verdict bad">答错</span>');

      html += '<div class="card review-item">' +
        '<div class="q-no">第 ' + (i + 1) + ' 题 · ' + esc(it.section) +
        (typeLabel(it.q) ? ' · ' + typeLabel(it.q) : '') +
        ' · 正确答案 ' + rightText(it.q) + verdict + '</div>' +
        (it.material ? '<div class="material">' + esc(it.material) + '</div>' : '') +
        '<div class="stem">' + esc(it.q.stem) + '</div><div class="opts">';

      (it.q.options || []).forEach(function (opt, k) {
        var cls = '';
        if (optIsRight(it.q, k)) cls = ' right';
        else if (optIsPicked(it.q, a, k)) cls = ' wrong';
        html += '<div class="opt' + cls + (qType(it.q) === 'multi' ? ' multi' : '') + '">' +
          '<span class="key">' + keyLabel(it.q, k) + '</span>' +
          '<span class="body">' + esc(opt) + '</span></div>';
      });

      html += '</div>' +
        (qType(it.q) === 'multi' ? '<div class="mine-line">你的选择：' + esc(pickedText(it.q, a)) + '</div>' : '') +
        '<div class="explain"><b>解析：</b>' + esc(it.q.explain || '暂无解析') + '</div></div>';
    });

    if (!shown) html += '<div class="card muted">全部答对，没有错题。</div>';

    $app.innerHTML = html;
    window.scrollTo(0, 0);
  }

  /* ==================== 事件 ==================== */

  function onAction(act, el) {
    /* 打开试卷（首页专用） */
    if (act === 'open') {
      var id = el.getAttribute('data-id');
      var paper = id === WRONG_ID ? wrongPaper() : paperById(id);
      if (!paper) return;
      if (id !== WRONG_ID) {
        if (isEssayPaper(paper)) {
          var st = readJSON(K_ESSAY + id, null);
          if (st && st.done && !window.confirm('这套申论已经完卷，继续修改吗？')) return;
        } else {
          var res = readJSON(K_RESULT + id, null);
          var prog = readJSON(K_PROGRESS + id, null);
          var unfinished = prog && (prog.answers || []).some(isAnswered);
          if (res && !unfinished && !window.confirm('上次得分 ' + res.score + ' 分，重新做一遍？')) return;
        }
      }
      startPaper(paper);
      return;
    }

    if (act === 'help') return openHelpDrawer();
    if (act === 'closeDrawer') return closeDrawer();
    if (!quiz) return;

    switch (act) {
      case 'opt': pickOption(Number(el.getAttribute('data-i'))); break;
      case 'prev': goto(-1); break;
      case 'next': goto(1); break;
      case 'card': openCardDrawer(); break;
      case 'answer': openAnswerDrawer(); break;
      case 'ref': openRefDrawer(); break;
      case 'jump':
        quiz.idx = Number(el.getAttribute('data-i'));
        saveSession();
        closeDrawer();
        if (quiz.kind === 'essay') renderEssay(); else renderQuiz();
        break;
      case 'submit': submitSession(); break;
      case 'filter': reviewAll = el.getAttribute('data-v') === 'all'; renderResult(false); break;
      case 'redo':
        if (quiz.kind === 'essay') { quiz.done = false; renderEssay(); }
        else startPaper(quiz.paper.id === WRONG_ID ? (wrongPaper() || quiz.paper) : (paperById(quiz.paper.id) || quiz.paper));
        break;
      case 'home': closeDrawer(); renderHome(); break;
    }
  }

  /* 主区域 + 抽屉共用同一套动作分发 */
  function bindActions(root) {
    root.addEventListener('click', function (e) {
      var el = e.target.closest('[data-act]');
      if (!el) return;
      onAction(el.getAttribute('data-act'), el);
    });
  }
  bindActions($app);
  bindActions($sheet);

  /* 申论输入：实时字数统计 + 草稿防抖保存 */
  $app.addEventListener('input', function (e) {
    if (!quiz || quiz.kind !== 'essay') return;
    if (!e.target.classList || !e.target.classList.contains('draft')) return;
    onDraftInput(e.target);
  });

  $back.addEventListener('click', function () {
    if (quiz && !quiz.done) {
      if (!window.confirm('返回后本次作答会保存，下次可继续。确定返回？')) return;
      saveSession();
    }
    closeDrawer();
    renderHome();
  });

  document.getElementById('sheetClose').addEventListener('click', closeDrawer);
  document.getElementById('helpBtn').addEventListener('click', openHelpDrawer);
  $sheet.addEventListener('click', function (e) { if (e.target === $sheet) closeDrawer(); });
  window.addEventListener('beforeunload', function () { if (quiz && !quiz.done) saveSession(); });

  /* 启动：首页；首次访问自动打开一次使用说明 */
  renderHome();
  if (!hasFlag(K_HELPED)) openHelpDrawer();
})();
