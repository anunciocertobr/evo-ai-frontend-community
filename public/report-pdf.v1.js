/**
 * Geração de PDF do relatório de Meta Ads (Dashboard › Relatórios e link público /r/:token).
 *
 * O PDF é montado no navegador com jsPDF: cada gráfico selecionado entra como
 * imagem (o Chart.js desenha em <canvas>, e o jsPDF não sabe ler canvas), e o
 * resumo de métricas vai como texto de verdade, pesquisável.
 *
 * Este arquivo é carregado pelo HTML do item `mtlsot4v-cf6f9s` de
 * `dashboard-menu-items` (ver Public::ReportHtml do backend). Ele depende de
 * variáveis `const` do script principal do relatório — metaAdsState,
 * metaAdsAllData, META_METRIC_CONFIG, fetchData, renderMetaAds, dayjs etc. —,
 * que só existem porque os dois são scripts clássicos: `let`/`const` de topo
 * caem no ambiente léxico global, compartilhado entre scripts clássicos. Se
 * algum dia o relatório virar `type="module"`, este arquivo quebra e o botão
 * simplesmente não aparece.
 */
(function () {
  'use strict';

  if (window.__EVO_REPORT_PDF__) return;
  window.__EVO_REPORT_PDF__ = true;

  var JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js';

  // Catálogo dos gráficos da aba Meta Ads. `opts` reproduz os seletores que a
  // tela já oferece, para o PDF sair igual ao que o usuário está vendo.
  var CHARTS = [
    { id: 'meta-chart-daily', title: 'Análise Diária de Métricas', opts: [{ key: 'activeDailyMetrics', label: 'Métricas', type: 'metrics' }] },
    { id: 'meta-chart-objective', title: 'Desempenho por Objetivo' },
    {
      id: 'meta-chart-top5', title: 'Top 5', opts: [
        { key: 'top5Dimension', label: 'Dimensão', type: 'dimension' },
        { key: 'top5Metric', label: 'Métrica', type: 'metric' }
      ]
    },
    { id: 'meta-chart-hourly', title: 'Análise por Hora do Dia', opts: [{ key: 'activeHourlyMetric', label: 'Métrica', type: 'metric' }] },
    {
      id: 'meta-chart-demographics', title: 'Perfil Demográfico', opts: [
        { key: 'activeDemographicMetric', label: 'Métrica', type: 'metric' },
        { key: 'demographicView', label: 'Visualizar', type: 'view', values: [['age', 'Por Idade'], ['gender', 'Por Gênero']] }
      ]
    },
    { id: 'meta-chart-platform', title: 'Plataforma' },
    { id: 'meta-chart-position', title: 'Posicionamento', opts: [{ key: 'activePositioningMetric', label: 'Métrica', type: 'metric' }] },
    { id: 'meta-chart-device', title: 'Dispositivo' },
    { id: 'meta-chart-region', title: 'Análise por Região', opts: [{ key: 'activeRegionMetric', label: 'Métrica', type: 'metric' }] }
  ];

  var PERIODS = [
    ['today', 'Hoje'], ['yesterday', 'Ontem'], ['week', 'Esta semana'],
    ['month', 'Este mês'], ['year', 'Este ano'], ['all', 'Tudo']
  ];

  // Metas que compõem o Total. As derivadas (CPM, CPC, CTR...) são sempre
  // recalculadas a partir dos totais do período, nunca tiradas da Meta.
  var BASE_METRICS = ['spent', 'impressions', 'reach', 'clicks', 'messages', 'leads', 'purchases'];

  var MONTH_CAP = 3; // mesmo limite do handleDateFilterClick do relatório

  // ---------------------------------------------------------------- período

  function computePeriod(key) {
    var today = dayjs(), s, e;
    switch (key) {
      case 'today': s = today; e = today; break;
      case 'yesterday': s = today.subtract(1, 'day'); e = today.subtract(1, 'day'); break;
      case 'week': s = today.startOf('isoWeek'); e = today.endOf('isoWeek'); break;
      case 'month': s = today.startOf('month'); e = today.endOf('month'); break;
      case 'year': s = today.startOf('year'); e = today; break;
      default: s = dayjs('2020-01-01'); e = today; break;
    }
    if (e.diff(s, 'months', true) > MONTH_CAP) s = e.clone().subtract(MONTH_CAP, 'months');
    return { key: key, start: s.format('YYYY-MM-DD'), end: e.format('YYYY-MM-DD') };
  }

  function currentPeriod() {
    var key = metaAdsState.activeDateFilter;
    if (key && key !== 'custom') return computePeriod(key);
    return { key: 'custom', start: metaAdsState.startDate, end: metaAdsState.endDate };
  }

  function applyPeriod(p) {
    metaAdsState.activeDateFilter = p.key;
    metaAdsState.startDate = p.start;
    metaAdsState.endDate = p.end;
    document.getElementById('meta-start-date').value = p.start;
    document.getElementById('meta-end-date').value = p.end;
    document.querySelectorAll('#meta-date-filters button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.period === p.key);
    });
    return fetchData('meta-ads');
  }

  function periodLabel(p) {
    if (p.start === p.end) return p.start;
    return p.start + ' a ' + p.end;
  }

  // ------------------------------------------------------------- agregação

  function filteredRows() {
    var st = metaAdsState;
    return (metaAdsAllData.geral || []).filter(function (ad) {
      return (st.selectedObjective === 'all' || ad.Objetivo === st.selectedObjective) &&
        (st.selectedCampaign === 'all' || ad['Nome da campanha'] === st.selectedCampaign) &&
        (st.selectedAdSet === 'all' || ad['Nome do conjunto de anúncios'] === st.selectedAdSet) &&
        (st.selectedAd === 'all' || ad['Nome do anúncio'] === st.selectedAd);
    });
  }

  // Mesmas fórmulas do calculateMetrics do relatório — se um dia elas mudarem
  // lá, precisam mudar aqui também. A diferença é o guarda de divisão por
  // zero: `x / 0 || 0` devolve Infinity (que é truthy), e formatCurrency(Infinity)
  // chega no PDF como "R$ ∞", que o Helvetica não tem e vira lixo na página.
  function safeDiv(a, b, factor) {
    if (!b) return 0;
    var v = (a / b) * (factor || 1);
    return isFinite(v) ? v : 0;
  }

  function calcMetrics(rows) {
    var t = {};
    BASE_METRICS.forEach(function (k) {
      t[k] = rows.reduce(function (s, ad) { return s + parseMetaNumber(ad[META_METRIC_CONFIG[k].key]); }, 0);
    });
    t.cpm = safeDiv(t.spent, t.impressions, 1000);
    t.cpc = safeDiv(t.spent, t.clicks);
    t.costPerMessage = safeDiv(t.spent, t.messages);
    t.costPerLead = safeDiv(t.spent, t.leads);
    t.costPerPurchase = safeDiv(t.spent, t.purchases);
    t.frequency = safeDiv(t.impressions, t.reach);
    t.ctr = safeDiv(t.clicks, t.impressions);
    return t;
  }

  // Média por dia = média dos valores de cada dia com dados no período. Para
  // as derivadas isso é a média das derivadas diárias, não a derivada da média.
  function averageByDay(rows, keys) {
    var byDay = {};
    rows.forEach(function (ad) {
      if (ad.Dia) (byDay[ad.Dia] = byDay[ad.Dia] || []).push(ad);
    });
    var days = Object.keys(byDay);
    if (!days.length) {
      var zero = {}; keys.forEach(function (k) { zero[k] = 0; });
      return { avg: zero, dayCount: 0 };
    }
    var perDay = days.map(function (d) { return calcMetrics(byDay[d]); });
    var avg = {};
    keys.forEach(function (k) {
      avg[k] = perDay.reduce(function (s, m) { return s + m[k]; }, 0) / days.length;
    });
    return { avg: avg, dayCount: days.length };
  }

  function groupByObjective(rows) {
    var byObj = {};
    rows.forEach(function (ad) {
      var o = ad.Objetivo || 'Não especificado';
      (byObj[o] = byObj[o] || []).push(ad);
    });
    return Object.keys(byObj).sort().map(function (o) {
      return { name: o, metrics: calcMetrics(byObj[o]) };
    });
  }

  function formatValue(key, value) {
    var m = META_METRIC_CONFIG[key] || {};
    if (m.isCurrency) return formatCurrency(value);
    if (m.isPercentage) return formatPercentage(value);
    if (m.isRatio) return formatRatio(value);
    return formatNumber(value);
  }

  // Na coluna "Média por dia" a contagem vira decimal (1.495,467 impressões por
  // dia) porque o Intl padrão mostra até 3 casas. Contagem arredonda; dinheiro e
  // proporção mantêm as casas.
  function formatAverage(key, value) {
    var m = META_METRIC_CONFIG[key] || {};
    if (m.isCurrency) return formatCurrency(value);
    if (m.isPercentage) return formatPercentage(value);
    if (m.isRatio) return formatRatio(value);
    return formatNumber(Math.round(value));
  }

  // ---------------------------------------------------------------- canvas

  // O canvas do Chart.js é transparente e o texto dos gráficos é claro: sem
  // pintar o fundo antes, o PNG sairia com texto branco sobre branco no PDF.
  function resolveBackground(el) {
    var node = el;
    while (node && node !== document.documentElement) {
      var bg = getComputedStyle(node).backgroundColor;
      if (bg && bg !== 'transparent' && !/rgba\(0, 0, 0, 0\)/.test(bg)) return bg;
      node = node.parentElement;
    }
    return '#0f172a';
  }

  function captureChart(canvasId) {
    var el = document.getElementById(canvasId);
    if (!el || typeof Chart === 'undefined') return null;
    var chart = Chart.getChart(el);
    if (!chart) return null;
    var src = chart.canvas;
    var out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    var ctx = out.getContext('2d');
    ctx.fillStyle = resolveBackground(el);
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(src, 0, 0);
    return {
      dataUrl: out.toDataURL('image/png'),
      jpegUrl: out.toDataURL('image/jpeg', 0.95),
      w: src.width,
      h: src.height
    };
  }

  // ------------------------------------------------------------------ PDF

  var M = { top: 14, bottom: 16, left: 12, right: 12 };
  var doc, pageW, pageH, contentW, y;

  function newPage() {
    doc.addPage();
    y = M.top;
  }

  function need(h) {
    if (y + h > pageH - M.bottom) newPage();
  }

  function text(str, opts) {
    opts = opts || {};
    doc.setFontSize(opts.size || 9);
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    if (opts.color) doc.setTextColor.apply(doc, opts.color);
    var lines = doc.splitTextToSize(String(str), opts.width || contentW);
    var lh = (opts.size || 9) * 0.42 + 1;
    need(lines.length * lh);
    doc.text(lines, opts.x === undefined ? M.left : opts.x, y, { lineHeightFactor: 0.42 });
    y += lines.length * lh;
  }

  function heading(str) {
    need(24);
    y += 4;
    text(str, { size: 13, bold: true, color: [15, 23, 42] });
    y += 2;
  }

  function spacer(h) { y += h || 6; }

  function drawTable(head, rows, widths) {
    var rowH = 7;
    function header() {
      need(rowH * 2);
      doc.setFillColor(226, 232, 240);
      doc.rect(M.left, y, contentW, rowH, 'F');
      var x = M.left;
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      head.forEach(function (h, i) {
        doc.text(String(h), x + 2, y + 4.8, { maxWidth: widths[i] - 4 });
        x += widths[i];
      });
      y += rowH;
    }
    header();
    rows.forEach(function (row, r) {
      if (y + rowH > pageH - M.bottom) { newPage(); header(); }
      if (r % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(M.left, y, contentW, rowH, 'F');
      }
      var x = M.left;
      row.forEach(function (cell, i) {
        doc.setFontSize(8.5);
        doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
        doc.setTextColor(30, 41, 59);
        var val = String(cell);
        // números à direita, texto à esquerda
        if (i > 0) {
          var w = doc.getTextWidth(val);
          if (w > widths[i] - 4) val = doc.splitTextToSize(val, widths[i] - 4);
          if (Array.isArray(val)) doc.text(val, x + widths[i] - 2, y + 4.8, { align: 'right' });
          else doc.text(val, x + widths[i] - 2, y + 4.8, { align: 'right' });
        } else {
          doc.text(doc.splitTextToSize(val, widths[i] - 4), x + 2, y + 4.8);
        }
        x += widths[i];
      });
      y += rowH;
    });
    spacer(4);
  }

  function drawImage(img, title, subtitle) {
    var maxW = contentW;
    var maxH = 118;
    var ratio = Math.min(maxW / img.w, maxH / img.h);
    var dw = img.w * ratio, dh = img.h * ratio;

    // Título e imagem têm que caber juntos: senão o título fica sozinho no
    // fim de uma página e o gráfico cai na seguinte, sem contexto.
    var titleH = (title ? (11 * 0.42 + 1) : 0) + (subtitle ? (8.5 * 0.42 + 1) : 0) + 3;
    if (y + titleH + dh > pageH - M.bottom) newPage();

    if (title) text(title, { size: 11, bold: true, color: [15, 23, 42] });
    if (subtitle) text(subtitle, { size: 8.5, color: [71, 85, 105] });
    y += 3;
// Sempre JPEG, nunca PNG: o jsPDF decodifica o PNG e grava os pixels em RGB
    // cru dentro do PDF (1230x350x3 = 1,29 MB por gráfico, sem /Filter), e o
    // arquivo chega a 6,8 MB — grande demais para e-mail/WhatsApp. Com JPEG o
    // mesmo gráfico entra em ~60 KB. A 0.95 o texto da legenda continua
    // legível; é imagem de gráfico, não texto de verdade.
    var isPng = false;
    doc.addImage(isPng ? img.dataUrl : img.jpegUrl, isPng ? 'PNG' : 'JPEG', M.left + (contentW - dw) / 2, y, dw, dh);
    y += dh + 8;
  }

  function addFooters() {
    var total = doc.internal.getNumberOfPages();
    for (var i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 130, 145);
      doc.text('Página ' + i + ' de ' + total, pageW - M.right, pageH - 8, { align: 'right' });
      doc.text('Relatório de Meta Ads', M.left, pageH - 8);
    }
  }

  // -------------------------------------------------------------- geração

  function loadJsPdf() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = JSPDF_URL;
      s.onload = function () {
        if (window.jspdf && window.jspdf.jsPDF) resolve(window.jspdf.jsPDF);
        else reject(new Error('jsPDF carregou mas não expôs window.jspdf.jsPDF'));
      };
      s.onerror = function () { reject(new Error('não consegui carregar o jsPDF')); };
      document.head.appendChild(s);
    });
  }

  function optionValues(opt) {
    if (opt.type === 'metric') return Object.keys(META_METRIC_CONFIG);
    if (opt.type === 'metrics') return Object.keys(META_METRIC_CONFIG);
    if (opt.type === 'dimension') return Object.keys(META_TOP5_DIMENSION_CONFIG);
    if (opt.type === 'view') return opt.values.map(function (v) { return v[0]; });
    return [];
  }

  function optionLabel(opt, value) {
    if (opt.type === 'view') {
      var found = opt.values.filter(function (x) { return x[0] === value; })[0];
      return found ? found[1] : value;
    }
    if (opt.key === 'top5Dimension') return (META_TOP5_DIMENSION_CONFIG[value] || {}).label || value;
    return (META_METRIC_CONFIG[value] || {}).label || value;
  }

  function currentOptionValue(key) {
    var v = metaAdsState[key];
    return Array.isArray(v) ? v.slice() : v;
  }

  // Estado do relatório é global e o usuário está olhando para ele: se o PDF
  // pedir outro período, mudamos, lemos, e devolvemos tudo ao que estava.
  function withState(selection, fn) {
    var before = {
      period: currentPeriod(),
      opts: {}
    };
    CHARTS.forEach(function (c) {
      (c.opts || []).forEach(function (o) { before.opts[o.key] = currentOptionValue(o.key); });
    });

    var periodChanged = selection.period.start !== before.period.start || selection.period.end !== before.period.end;
    var optsChanged = false;
    CHARTS.forEach(function (c) {
      (c.opts || []).forEach(function (o) {
        var want = selection.opts[o.key];
        var have = before.opts[o.key];
        if (Array.isArray(want) && Array.isArray(have)) {
          if (want.join(',') !== have.join(',')) optsChanged = true;
        } else if (want !== have) optsChanged = true;
      });
    });

    // Animação fora: com animação ligada o canvas pode estar no meio do
    // desenho quando o jsPDF lê, e o gráfico sai cortado no PDF.
    var animBackup = Chart.defaults.animation;
    Chart.defaults.animation = false;

    var work = Promise.resolve();
    if (periodChanged) work = work.then(function () { return applyPeriod(selection.period); });
    if (optsChanged) {
      CHARTS.forEach(function (c) {
        (c.opts || []).forEach(function (o) { metaAdsState[o.key] = selection.opts[o.key]; });
      });
      work = work.then(function () { renderMetaAds(processMetaAdsData()); });
    }

    return work
      .then(fn)
      .catch(function (err) { throw err; })
      .then(function (out) {
        Chart.defaults.animation = animBackup;
        var restore = Promise.resolve();
        if (optsChanged || periodChanged) {
          CHARTS.forEach(function (c) {
            (c.opts || []).forEach(function (o) { metaAdsState[o.key] = before.opts[o.key]; });
          });
          restore = applyPeriod(before.period).then(function () { renderMetaAds(processMetaAdsData()); });
        }
        return restore.then(function () { return out; });
      })
      .catch(function (err) {
        Chart.defaults.animation = animBackup;
        throw err;
      });
  }

  function buildPdf(selection, shots, stats, perObjective, accountLabel) {
    var JsPDF = window.jspdf.jsPDF;
    doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    pageW = doc.internal.pageSize.getWidth();
    pageH = doc.internal.pageSize.getHeight();
    contentW = pageW - M.left - M.right;
    y = M.top;

    // Cabeçalho
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 26, 'F');
    doc.setTextColor(248, 250, 252);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('Relatório de Meta Ads', M.left, 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Período: ' + periodLabel(selection.period), M.left, 17.5);
    if (accountLabel) doc.text('Conta: ' + accountLabel, M.left, 22);
    doc.text('Gerado em ' + new Date().toLocaleString('pt-BR'), pageW - M.right, 17.5, { align: 'right' });
    y = 34;

    // Filtros que estavam na tela — o PDF sai sempre filtrado como a tela.
    var st = metaAdsState;
    var filtros = [
      st.selectedObjective !== 'all' ? 'Objetivo: ' + st.selectedObjective : null,
      st.selectedCampaign !== 'all' ? 'Campanha: ' + st.selectedCampaign : null,
      st.selectedAdSet !== 'all' ? 'Conjunto: ' + st.selectedAdSet : null,
      st.selectedAd !== 'all' ? 'Anúncio: ' + st.selectedAd : null
    ].filter(Boolean);
    if (filtros.length) text('Filtros aplicados — ' + filtros.join(' | '), { size: 8.5, color: [71, 85, 105] });

    if (selection.wantTotals || selection.wantAverage) {
      heading('Resumo de métricas');
      var keys = selection.metrics.slice();
      var rows = keys.map(function (k) {
        var line = [META_METRIC_CONFIG[k].label];
        if (selection.wantTotals) line.push(formatValue(k, stats[k]));
        if (selection.wantAverage) line.push(formatAverage(k, stats.avg[k]));
        return line;
      });
      var head = ['Métrica'];
      if (selection.wantTotals) head.push('Total');
      if (selection.wantAverage) head.push('Média por dia');
      var w0 = 70;
      var wRest = (contentW - w0) / (head.length - 1);
      drawTable(head, rows, [w0].concat(head.slice(1).map(function () { return wRest; })));
      text(stats.dayCount > 1
        ? 'Média diária calculada sobre ' + stats.dayCount + ' dias com dados no período.'
        : 'Média diária: o período tem ' + stats.dayCount + ' dia com dados.', { size: 8, color: [120, 130, 145] });
      spacer(4);
    }

    if (selection.wantObjective && perObjective.length) {
      heading('Por Resultado');
      text('Agrupado pelo resultado configurado na campanha (Objetivo).', { size: 8, color: [120, 130, 145] });
      spacer(2);
      // 5 colunas de métrica por vez: 14 métricas não cabem na largura da
      // página e uma tabela ilegível é pior que duas.
      var chunk = 5;
      for (var i = 0; i < selection.metrics.length; i += chunk) {
        var cols = selection.metrics.slice(i, i + chunk);
        var wFirst = 46;
        var wCol = (contentW - wFirst) / cols.length;
        drawTable(
          ['Resultado'].concat(cols.map(function (k) { return META_METRIC_CONFIG[k].label; })),
          perObjective.map(function (o) {
            return [o.name].concat(cols.map(function (k) { return formatValue(k, o.metrics[k]); }));
          }),
          [wFirst].concat(cols.map(function () { return wCol; }))
        );
      }
    }

    if (shots.length) {
      heading('Gráficos');
      shots.forEach(function (s) { drawImage(s.img, s.title, s.subtitle); });
    }

    addFooters();
    var nome = 'relatorio-meta-ads_' + selection.period.start + '_a_' + selection.period.end + '.pdf';
    doc.save(nome);
    return nome;
  }

  // ----------------------------------------------------------------- modal

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  function buildModal() {
    var overlay = el('div', 'fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4');
    overlay.id = 'evo-pdf-modal';
    overlay.style.display = 'none';

    var box = el('div', 'bg-slate-800 border border-slate-700 rounded-lg w-full max-w-3xl my-8 shadow-2xl');
    overlay.appendChild(box);

    box.appendChild(el('div', 'px-5 py-4 border-b border-slate-700 flex items-center justify-between',
      '<h3 class="text-lg font-semibold text-white">Gerar PDF do relatório</h3>'));
    var fechar = el('button', 'text-slate-400 hover:text-white text-xl leading-none px-2', '&times;');
    box.appendChild(fechar);

    var body = el('div', 'px-5 py-4 space-y-6 text-sm text-slate-300');
    box.appendChild(body);

    // --- período
    var per = el('div');
    per.appendChild(el('h4', 'font-semibold text-white mb-2', 'Período'));
    var periodRow = el('div', 'flex flex-wrap gap-2 mb-3');
    var periodKey = currentPeriod().key;
    PERIODS.forEach(function (p) {
      var b = el('button', 'px-3 py-1.5 text-sm rounded-md border ' +
        (p[0] === periodKey ? 'bg-sky-600 border-sky-500 text-white' : 'bg-slate-700 border-slate-600 hover:bg-slate-600'), p[1]);
      b.dataset.period = p[0];
      b.onclick = function () {
        periodKey = p[0];
        periodRow.querySelectorAll('button').forEach(function (x) {
          var on = x.dataset.period === periodKey;
          x.className = 'px-3 py-1.5 text-sm rounded-md border ' +
            (on ? 'bg-sky-600 border-sky-500 text-white' : 'bg-slate-700 border-slate-600 hover:bg-slate-600');
        });
        customWrap.classList.add('hidden');
      };
      periodRow.appendChild(b);
    });
    per.appendChild(periodRow);

    var customBtn = el('button', 'px-3 py-1.5 text-sm rounded-md border ' +
      (periodKey === 'custom' ? 'bg-sky-600 border-sky-500 text-white' : 'bg-slate-700 border-slate-600 hover:bg-slate-600'), 'Personalizado');
    periodRow.appendChild(customBtn);

    var customWrap = el('div', 'flex flex-wrap items-center gap-2 mt-2' +
      (periodKey === 'custom' ? '' : ' hidden'));
    customWrap.appendChild(el('label', 'text-slate-400', 'de'));
    var dIn = el('input', 'bg-slate-700 border border-slate-600 rounded-md px-2 py-1.5 text-white');
    dIn.type = 'date'; dIn.value = currentPeriod().start;
    var dOut = el('input', 'bg-slate-700 border border-slate-600 rounded-md px-2 py-1.5 text-white');
    dOut.type = 'date'; dOut.value = currentPeriod().end;
    customWrap.appendChild(dIn);
    customWrap.appendChild(el('label', 'text-slate-400', 'até'));
    customWrap.appendChild(dOut);
    customWrap.appendChild(el('span', 'text-xs text-slate-500', '(máximo de 3 meses)'));
    customBtn.onclick = function () {
      periodKey = 'custom';
      periodRow.querySelectorAll('button').forEach(function (x) {
        x.className = 'px-3 py-1.5 text-sm rounded-md border ' +
          (x === customBtn ? 'bg-sky-600 border-sky-500 text-white' : 'bg-slate-700 border-slate-600 hover:bg-slate-600');
      });
      customWrap.classList.remove('hidden');
    };
    per.appendChild(customWrap);
    body.appendChild(per);

    // --- blocos do resumo
    var bloco = el('div');
    bloco.appendChild(el('h4', 'font-semibold text-white mb-2', 'Blocos do resumo'));
    var wantTotals = el('input'); wantTotals.type = 'checkbox'; wantTotals.checked = true;
    var wantAverage = el('input'); wantAverage.type = 'checkbox'; wantAverage.checked = true;
    var wantObjective = el('input'); wantObjective.type = 'checkbox'; wantObjective.checked = true;
    bloco.appendChild(el('label', 'flex items-center gap-2 mb-1', ''));
    bloco.lastChild.appendChild(wantTotals);
    bloco.lastChild.appendChild(el('span', '', 'Total do período'));
    bloco.appendChild(el('label', 'flex items-center gap-2 mb-1', ''));
    bloco.lastChild.appendChild(wantAverage);
    bloco.lastChild.appendChild(el('span', '', 'Média por dia'));
    bloco.appendChild(el('label', 'flex items-center gap-2', ''));
    bloco.lastChild.appendChild(wantObjective);
    bloco.lastChild.appendChild(el('span', '', 'Por Resultado (objetivo da campanha)'));
    body.appendChild(bloco);

    // --- métricas
    var met = el('div');
    met.appendChild(el('h4', 'font-semibold text-white mb-2', 'Métricas'));
    var metGrid = el('div', 'grid grid-cols-2 sm:grid-cols-3 gap-2');
    var metricBoxes = {};
    Object.keys(META_METRIC_CONFIG).forEach(function (k) {
      var m = META_METRIC_CONFIG[k];
      var lab = el('label', 'flex items-center gap-2 bg-slate-900/40 border border-slate-700 rounded-md px-2 py-1.5 cursor-pointer');
      var cb = el('input'); cb.type = 'checkbox'; cb.checked = true;
      metricBoxes[k] = cb;
      lab.appendChild(cb);
      lab.appendChild(el('span', '', m.label));
      metGrid.appendChild(lab);
    });
    met.appendChild(metGrid);
    body.appendChild(met);

    // --- gráficos
    var gra = el('div');
    gra.appendChild(el('h4', 'font-semibold text-white mb-2', 'Gráficos'));
    CHARTS.forEach(function (c) {
      var wrap = el('div', 'bg-slate-900/40 border border-slate-700 rounded-md px-3 py-2 mb-2');
      var head = el('label', 'flex items-center gap-2 cursor-pointer');
      var cb = el('input'); cb.type = 'checkbox'; cb.checked = true;
      c._box = cb;
      head.appendChild(cb);
      head.appendChild(el('span', 'font-medium text-white', c.title));
      wrap.appendChild(head);
      if (c.opts && c.opts.length) {
        var optsWrap = el('div', 'mt-2 pl-6 space-y-2');
        c.opts.forEach(function (o) {
          var rowEl = el('div', 'flex flex-wrap items-center gap-2 text-xs');
          rowEl.appendChild(el('span', 'text-slate-400 w-20', o.label + ':'));
          var cur = currentOptionValue(o.key);
          var values = optionValues(o);
          if (o.type === 'metrics') {
            // multi-seleção: checkboxes das 14 métricas (como na tela)
            values.forEach(function (v) {
              var l = el('label', 'flex items-center gap-1 bg-slate-700 rounded px-1.5 py-0.5 cursor-pointer');
              var b = el('input'); b.type = 'checkbox';
              b.checked = Array.isArray(cur) ? cur.indexOf(v) > -1 : false;
              b.dataset.key = v;
              c._opts = c._opts || {}; c._opts[o.key] = c._opts[o.key] || [];
              c._opts[o.key].push(b);
              l.appendChild(b);
              l.appendChild(el('span', '', META_METRIC_CONFIG[v].label));
              rowEl.appendChild(l);
            });
          } else {
            var sel = el('select', 'bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white');
            values.forEach(function (v) {
              var op = el('option', '', optionLabel(o, v));
              op.value = v;
              if (Array.isArray(cur) ? cur.indexOf(v) > -1 : cur === v) op.selected = true;
              sel.appendChild(op);
            });
            c._opts = c._opts || {}; c._opts[o.key] = sel;
            rowEl.appendChild(sel);
          }
          optsWrap.appendChild(rowEl);
        });
        wrap.appendChild(optsWrap);
      }
      gra.appendChild(wrap);
    });
    body.appendChild(gra);

    // --- rodapé
    var status = el('div', 'text-xs text-slate-400 min-h-[1.2rem]');
    var foot = el('div', 'px-5 py-4 border-t border-slate-700 flex items-center justify-between gap-3');
    foot.appendChild(status);
    var acoes = el('div', 'flex gap-2');
    var cancelar = el('button', 'px-4 py-2 text-sm rounded-md bg-slate-700 hover:bg-slate-600 text-white', 'Cancelar');
    var gerar = el('button', 'px-4 py-2 text-sm rounded-md bg-sky-600 hover:bg-sky-500 text-white font-medium', 'Gerar PDF');
    gerar.id = 'evo-pdf-gerar';
    acoes.appendChild(cancelar);
    acoes.appendChild(gerar);
    foot.appendChild(acoes);
    box.appendChild(foot);

    function close() { overlay.style.display = 'none'; }
    fechar.onclick = close;
    cancelar.onclick = close;
    overlay.onclick = function (e) { if (e.target === overlay) close(); };

    gerar.onclick = function () {
      var metrics = Object.keys(metricBoxes).filter(function (k) { return metricBoxes[k].checked; });
      var selection = {
        period: periodKey === 'custom'
          ? { key: 'custom', start: dIn.value, end: dOut.value }
          : computePeriod(periodKey),
        metrics: metrics,
        wantTotals: wantTotals.checked,
        wantAverage: wantAverage.checked,
        wantObjective: wantObjective.checked,
        opts: {}
      };
      CHARTS.forEach(function (c) {
        (c.opts || []).forEach(function (o) {
          var v = c._opts[o.key];
          if (Array.isArray(v)) {
            selection.opts[o.key] = v.filter(function (b) { return b.checked; })
              .map(function (b) { return b.dataset.key; });
          } else {
            selection.opts[o.key] = v.value;
          }
        });
      });

      if (!metrics.length) { status.textContent = 'Escolha ao menos uma métrica.'; return; }

      gerar.disabled = true;
      gerar.textContent = 'Gerando...';
      status.textContent = 'Carregando dados do período e montando o PDF...';

      var accountLabel = (document.getElementById('meta-act-id').selectedOptions[0] || {}).textContent || '';

      withState(selection, function () {
        return loadJsPdf().then(function () {
          var shots = [];
          CHARTS.forEach(function (c) {
            if (!c._box.checked) return;
            var img = captureChart(c.id);
            if (!img) return;
            var sub = (c.opts || []).map(function (o) {
              var v = selection.opts[o.key];
              if (Array.isArray(v)) return o.label + ': ' + v.map(function (k) { return META_METRIC_CONFIG[k].label; }).join(', ');
              return o.label + ': ' + optionLabel(o, v);
            }).filter(Boolean).join(' | ');
            shots.push({ img: img, title: c.title, subtitle: sub });
          });

          var rows = filteredRows();
          var totals = calcMetrics(rows);
          var avg = averageByDay(rows, metrics);
          totals.avg = avg.avg;
          totals.dayCount = avg.dayCount;
          var perObjective = groupByObjective(rows);

          return buildPdf(selection, shots, totals, perObjective, accountLabel);
        });
      }).then(function (nome) {
        status.textContent = 'PDF gerado: ' + nome;
      }).catch(function (err) {
        status.textContent = 'Erro ao gerar: ' + (err && err.message ? err.message : err);
      }).then(function () {
        gerar.disabled = false;
        gerar.textContent = 'Gerar PDF';
      });
    };

    return overlay;
  }

  // ----------------------------------------------------------------- boot

  function boot() {
    var anchor = document.getElementById('meta-date-filters');
    if (!anchor) return;
    if (document.getElementById('btn-gerar-pdf')) return;

    var btn = el('button', 'filter-button px-4 py-2 text-sm font-medium rounded-md transition-colors bg-sky-700 hover:bg-sky-600 text-white', 'Gerar PDF');
    btn.id = 'btn-gerar-pdf';
    var modal = buildModal();
    btn.onclick = function () { modal.style.display = 'flex'; };
    anchor.appendChild(btn);
    document.body.appendChild(modal);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();