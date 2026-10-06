/**
 * Geração de PDF do relatório de Meta Ads (Dashboard › Relatórios e link público /r/:token).
 *
 * O PDF é montado no navegador com jsPDF e segue o mesmo visual do relatório
 * (fundo escuro, cards de totais, cores da tela). Os gráficos são desenhados
 * direto no PDF a partir dos dados do Chart.js (ou dos dados do período, nos
 * gráficos personalizados), para que os valores apareçam em cada barra/ponto.
 * Só cai para imagem do canvas quando o tipo de gráfico não é barra nem linha.
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

  // Cores do relatório (Tailwind slate + as cores dos gráficos da tela).
  var THEME = {
    page: [15, 23, 42],      // slate-900: fundo da página
    card: [30, 41, 59],      // slate-800: cards e blocos de gráfico
    cardAlt: [51, 65, 85],   // slate-700: cabeçalho de tabela e linhas
    text: [241, 245, 249],   // slate-100: títulos e valores
    body: [226, 232, 240],   // slate-200: texto corrido
    muted: [148, 163, 184]   // slate-400: rótulos e legendas
  };
  var PALETTE = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#f87171', '#fb923c', '#60a5fa', '#e879f9'];

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

  // Grupo de escala: barras só se comparam dentro do mesmo tipo de métrica
  // (R$ com R$, quantidade com quantidade). Mensagens e custo por mensagem
  // ficam em escalas separadas, cada uma com o próprio valor marcado.
  function scaleGroup(key) {
    var m = META_METRIC_CONFIG[key] || {};
    if (m.isCurrency) return 'currency';
    if (m.isPercentage) return 'percent';
    if (m.isRatio) return 'ratio';
    return 'count';
  }

  function keyForLabel(label) {
    var ks = Object.keys(META_METRIC_CONFIG);
    for (var i = 0; i < ks.length; i++) {
      if (META_METRIC_CONFIG[ks[i]].label === label) return ks[i];
    }
    return null;
  }

  // ------------------------------------------------------ dados dos gráficos

  // Lê o gráfico que já está na tela (Chart.js) e devolve os mesmos dados,
  // para o PDF desenhar com valores. Gráfico que não é barra nem linha → null.
  function chartSpec(canvasId) {
    var el = document.getElementById(canvasId);
    if (!el || typeof Chart === 'undefined') return null;
    var chart = Chart.getChart(el);
    if (!chart || (chart.config.type !== 'bar' && chart.config.type !== 'line')) return null;
    var labels = (chart.data.labels || []).map(String);
    var series = [];
    chart.data.datasets.forEach(function (ds, i) {
      if (chart.isDatasetVisible && !chart.isDatasetVisible(i)) return;
      var label = ds.label || '';
      var key = keyForLabel(label);
      var color = typeof ds.backgroundColor === 'string' ? ds.backgroundColor : ds.borderColor;
      series.push({
        label: label,
        color: hexOrPalette(color, series.length),
        data: (ds.data || []).map(function (v) { return Number(v) || 0; }),
        fmt: function (v) { return key ? formatValue(key, v) : formatNumber(Math.round(v)); }
      });
    });
    if (!series.length) return null;
    return { kind: chart.config.type, labels: labels, series: series };
  }

  // Gráfico personalizado de linha: evolução diária das métricas escolhidas.
  function dailySpec(rows, keys, title) {
    var byDay = {};
    rows.forEach(function (ad) {
      if (ad.Dia) (byDay[ad.Dia] = byDay[ad.Dia] || []).push(ad);
    });
    var days = Object.keys(byDay).sort();
    var perDay = days.map(function (d) { return calcMetrics(byDay[d]); });
    return {
      title: title,
      subtitle: 'Cada linha usa a própria escala. Os valores reais aparecem nos pontos.',
      kind: 'line',
      labels: days.map(function (d) { return dayjs(parseAPIDate(d)).format('DD/MM'); }),
      series: keys.map(function (k, i) {
        return {
          label: META_METRIC_CONFIG[k].label,
          color: PALETTE[i % PALETTE.length],
          data: perDay.map(function (m) { return m[k]; }),
          fmt: function (v) { return formatValue(k, v); }
        };
      })
    };
  }

  // Gráfico personalizado de barras: total de cada métrica escolhida.
  function totalsRows(totals, keys) {
    return keys.map(function (k) {
      return {
        label: META_METRIC_CONFIG[k].label,
        value: totals[k] || 0,
        fmt: function (v) { return formatValue(k, v); },
        group: scaleGroup(k)
      };
    });
  }

  // ---------------------------------------------------------------- canvas

  // Só usado para o caso de fallback (gráfico que não é barra nem linha). O
  // canvas do Chart.js é transparente e o texto dos gráficos é claro: sem
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
      jpegUrl: out.toDataURL('image/jpeg', 0.95),
      w: src.width,
      h: src.height
    };
  }

  // ------------------------------------------------------------------ PDF

  var M = { top: 14, bottom: 16, left: 12, right: 12 };
  var doc, pageW, pageH, contentW, y;
  var CHART_H = 104;

  function hexOrPalette(c, idx) {
    return /^#[0-9a-f]{6}$/i.test(c || '') ? c : PALETTE[idx % PALETTE.length];
  }

  function hexRgb(hex) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return [56, 189, 248];
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // Pinta a página inteira de escuro. Chamado em toda página nova, senão a
  // página nasce branca.
  function paintPage() {
    doc.setFillColor.apply(doc, THEME.page);
    doc.rect(0, 0, pageW, pageH, 'F');
  }

  function newPage() {
    doc.addPage();
    paintPage();
    y = M.top;
  }

  function need(h) {
    if (y + h > pageH - M.bottom) newPage();
  }

  function spacer(h) { y += h || 6; }

  function text(str, opts) {
    opts = opts || {};
    var size = opts.size || 9;
    doc.setFontSize(size);
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setTextColor.apply(doc, opts.color || THEME.body);
    var lines = doc.splitTextToSize(String(str), opts.width || contentW);
    var lh = size * 0.42 + 1;
    need(lines.length * lh);
    doc.text(lines, opts.x === undefined ? M.left : opts.x, y, { lineHeightFactor: 0.42 });
    y += lines.length * lh;
  }

  function heading(str) {
    need(24);
    y += 4;
    text(str, { size: 13, bold: true, color: THEME.text });
    y += 2;
  }

  // Texto solto numa posição (rótulos de gráfico). Não mexe em `y`.
  function label(str, x, yy, o) {
    o = o || {};
    doc.setFontSize(o.size || 7);
    doc.setFont('helvetica', o.bold ? 'bold' : 'normal');
    doc.setTextColor.apply(doc, o.color || THEME.body);
    var opts = { align: o.align || 'left' };
    if (o.angle) opts.angle = o.angle;
    doc.text(String(str), x, yy, opts);
  }

  // Corta o texto até caber na largura. Precisa do tamanho de fonte já definido.
  function fitText(str, maxW) {
    var s = String(str);
    if (doc.getTextWidth(s) <= maxW) return s;
    while (s.length > 1 && doc.getTextWidth(s + '…') > maxW) s = s.slice(0, -1);
    return s + '…';
  }

  function card(x, yy, w, h) {
    doc.setFillColor.apply(doc, THEME.card);
    doc.roundedRect(x, yy, w, h, 2, 2, 'F');
  }

  // Cards de totais (mesmo formato dos cards do relatório).
  function drawKpiCards(items) {
    var cols = 3, gap = 4;
    var w = (contentW - gap * (cols - 1)) / cols;
    var h = 22;
    var i = 0;
    while (i < items.length) {
      need(h + gap);
      for (var c = 0; c < cols && i < items.length; c++, i++) {
        var it = items[i];
        var x = M.left + c * (w + gap);
        card(x, y, w, h);
        label(it.label, x + 4, y + 6.5, { size: 8, color: THEME.muted });
        label(it.value, x + 4, y + 14.5, { size: 13, bold: true, color: THEME.text });
        if (it.sub) label(it.sub, x + 4, y + 19.2, { size: 7, color: THEME.muted });
      }
      y += h + gap;
    }
    spacer(2);
  }

  function drawTable(head, rows, widths) {
    var rowH = 7;
    function header() {
      need(rowH * 2);
      doc.setFillColor.apply(doc, THEME.cardAlt);
      doc.rect(M.left, y, contentW, rowH, 'F');
      var x = M.left;
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor.apply(doc, THEME.text);
      head.forEach(function (h, i) {
        doc.text(fitText(h, widths[i] - 4), x + 2, y + 4.8);
        x += widths[i];
      });
      y += rowH;
    }
    header();
    rows.forEach(function (row, r) {
      if (y + rowH > pageH - M.bottom) { newPage(); header(); }
      doc.setFillColor.apply(doc, r % 2 === 1 ? THEME.card : THEME.page);
      doc.rect(M.left, y, contentW, rowH, 'F');
      var x = M.left;
      row.forEach(function (cell, i) {
        doc.setFontSize(8.5);
        doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
        doc.setTextColor.apply(doc, THEME.body);
        var val = String(cell);
        if (i > 0) {
          doc.text(val, x + widths[i] - 2, y + 4.8, { align: 'right' });
        } else {
          doc.text(doc.splitTextToSize(val, widths[i] - 4), x + 2, y + 4.8);
        }
        x += widths[i];
      });
      y += rowH;
    });
    spacer(4);
  }

  // Bloco de gráfico de barras ou linhas, com valores em cada barra/ponto.
  function drawChartBlock(spec) {
    need(CHART_H + 4);
    var top = y;
    card(M.left, top, contentW, CHART_H);

    label(spec.title, M.left + 6, top + 7, { size: 10.5, bold: true, color: THEME.text });
    label(fitText(spec.subtitle || '', contentW - 12), M.left + 6, top + 12, { size: 7.5, color: THEME.muted });

    var series = spec.series;
    var x0 = M.left + 10, plotW = contentW - 20;
    var legendY = top + 17;
    var lx = x0;
    series.forEach(function (s) {
      var rgb = hexRgb(s.color);
      doc.setFillColor.apply(doc, rgb);
      doc.rect(lx, legendY - 2.2, 2.2, 2.2, 'F');
      doc.setFontSize(7.5);
      var itemW = Math.min(doc.getTextWidth(s.label), 50);
      label(fitText(s.label, 50), lx + 3.4, legendY, { size: 7.5, color: THEME.body });
      lx += 3.4 + itemW + 7;
    });

    var plotTop = top + 23;
    var plotBottom = top + CHART_H - 11;
    var plotH = plotBottom - plotTop;
    var n = spec.labels.length;
    if (!n || !series.length) { y = top + CHART_H + 5; return; }

    // Eixo de base
    doc.setDrawColor.apply(doc, THEME.cardAlt);
    doc.setLineWidth(0.2);
    doc.line(x0, plotBottom, x0 + plotW, plotBottom);

    var gw = plotW / n;
    var i;

    if (spec.kind === 'bar') {
      var groupW = Math.min(gw * 0.8, 40);
      var bw = groupW / series.length;
      var rotate = bw < 6.5;
      var headroom = rotate ? plotH - 14 : plotH - 5;
      series.forEach(function (s, si2) {
        var mx = Math.max.apply(null, s.data.concat([0])) || 1;
        var barRgb = hexRgb(s.color);
        s.data.forEach(function (v, idx) {
          var h = Math.max(0, v) / mx * headroom;
          var bx = x0 + idx * gw + (gw - groupW) / 2 + si2 * bw;
          var by = plotBottom - h;
          // o texto também usa a cor de preenchimento no jsPDF: redefinir a cor a cada forma
          doc.setFillColor.apply(doc, barRgb);
          doc.rect(bx + 0.3, by, Math.max(bw - 0.6, 0.5), h, 'F');
          if (rotate) {
            label(s.fmt(v), bx + bw / 2 + 1.2, by - 1.5, { size: 6.5, angle: 90, bold: true, color: THEME.text });
          } else {
            label(s.fmt(v), bx + bw / 2, by - 1.5, { size: 6.5, bold: true, color: THEME.text, align: 'center' });
          }
        });
      });
    } else {
      var step = Math.max(1, Math.ceil(n / 14));
      series.forEach(function (s, si3) {
        var mx = Math.max.apply(null, s.data.concat([0])) || 1;
        var rgb = hexRgb(s.color);
        var pts = s.data.map(function (v, idx) {
          return {
            x: n === 1 ? x0 + plotW / 2 : x0 + idx * plotW / (n - 1),
            y: plotBottom - Math.max(0, v) / mx * (plotH - 8)
          };
        });
        doc.setDrawColor.apply(doc, rgb);
        doc.setLineWidth(0.6);
        for (i = 1; i < pts.length; i++) doc.line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
        pts.forEach(function (p, idx) {
          doc.setFillColor.apply(doc, rgb);
          doc.circle(p.x, p.y, 0.8, 'F');
          if (idx % step === 0) {
            // séries alternam acima/abaixo do ponto para não sobrepor os valores
            var ly = si3 % 2 ? p.y + 4 : p.y - 2.2;
            label(s.fmt(s.data[idx]), p.x, ly, { size: 6.5, bold: true, color: THEME.text, align: 'center' });
          }
        });
      });
    }

    // Rótulos do eixo X
    var stepX = 1;
    if (spec.kind === 'bar') stepX = Math.max(1, Math.ceil(7 / gw));
    else stepX = Math.max(1, Math.ceil(n / 14));
    spec.labels.forEach(function (lb, idx) {
      if (idx % stepX) return;
      doc.setFontSize(7);
      var cx = spec.kind === 'bar' ? x0 + idx * gw + gw / 2 : (n === 1 ? x0 + plotW / 2 : x0 + idx * plotW / (n - 1));
      var w = spec.kind === 'bar' ? gw * stepX - 1 : 14;
      label(fitText(lb, w), cx, plotBottom + 4.5, { size: 7, color: THEME.muted, align: 'center' });
    });

    y = top + CHART_H + 5;
  }

  // Barras horizontais: uma linha por métrica, cada grupo de escala usa seu
  // próprio máximo (R$ com R$, quantidade com quantidade...).
  function drawRowsBlock(spec) {
    var rows = spec.rows;
    var H = 22 + rows.length * 9 + 4;
    need(H + 4);
    var top = y;
    card(M.left, top, contentW, H);
    label(spec.title, M.left + 6, top + 7, { size: 10.5, bold: true, color: THEME.text });
    label(fitText(spec.subtitle || '', contentW - 12), M.left + 6, top + 12, { size: 7.5, color: THEME.muted });

    var labelW = 56, valueW = 34;
    var barX = M.left + 6 + labelW;
    var barMaxW = contentW - 12 - labelW - valueW;
    var groupMax = {};
    rows.forEach(function (r) { groupMax[r.group] = Math.max(groupMax[r.group] || 0, r.value); });

    rows.forEach(function (r, i) {
      var ry = top + 20 + i * 9;
      doc.setFontSize(8);
      label(fitText(r.label, labelW - 3), M.left + 6, ry + 3.6, { size: 8, color: THEME.body });
      var gm = groupMax[r.group] || 1;
      var w = Math.max(0, r.value) / gm * barMaxW;
      doc.setFillColor.apply(doc, hexRgb(PALETTE[i % PALETTE.length]));
      doc.rect(barX, ry, Math.max(w, 0.5), 4.6, 'F');
      label(r.fmt(r.value), barX + w + 2, ry + 3.6, { size: 8, bold: true, color: THEME.text });
    });

    y = top + H + 5;
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

    if (title) text(title, { size: 11, bold: true, color: THEME.text });
    if (subtitle) text(subtitle, { size: 8.5, color: THEME.muted });
    y += 3;
    // Sempre JPEG, nunca PNG: o jsPDF grava PNG em RGB cru (1,29 MB por gráfico).
    doc.addImage(img.jpegUrl, 'JPEG', M.left + (contentW - dw) / 2, y, dw, dh);
    y += dh + 8;
  }

  function addFooters() {
    var total = doc.internal.getNumberOfPages();
    for (var i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor.apply(doc, THEME.muted);
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

  function buildPdf(selection, blocks, stats, perObjective, accountLabel) {
    var JsPDF = window.jspdf.jsPDF;
    doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    pageW = doc.internal.pageSize.getWidth();
    pageH = doc.internal.pageSize.getHeight();
    contentW = pageW - M.left - M.right;
    y = M.top;
    paintPage();

    // Cabeçalho
    doc.setFillColor.apply(doc, THEME.card);
    doc.rect(0, 0, pageW, 26, 'F');
    doc.setTextColor.apply(doc, THEME.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('Relatório de Meta Ads', M.left, 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, THEME.body);
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
    if (filtros.length) text('Filtros aplicados — ' + filtros.join(' | '), { size: 8.5, color: THEME.muted });

    if (selection.wantTotals || selection.wantAverage) {
      heading('Resumo de métricas');
      var items = selection.metrics.map(function (k) {
        var label = META_METRIC_CONFIG[k].label;
        if (selection.wantTotals) {
          return {
            label: label,
            value: formatValue(k, stats[k]),
            sub: selection.wantAverage ? 'Média/dia: ' + formatAverage(k, stats.avg[k]) : null
          };
        }
        return { label: label, value: formatAverage(k, stats.avg[k]), sub: 'Média por dia' };
      });
      drawKpiCards(items);
    }

    if (selection.wantObjective && perObjective.length) {
      heading('Por Resultado');
      text('Agrupado pelo resultado configurado na campanha (Objetivo).', { size: 8, color: THEME.muted });
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

    if (blocks.length) {
      heading('Gráficos');
      blocks.forEach(function (b) {
        if (b.kind === 'chart') drawChartBlock(b.spec);
        else if (b.kind === 'rows') drawRowsBlock(b.spec);
        else if (b.kind === 'image') drawImage(b.img, b.title, b.subtitle);
      });
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
    gra.appendChild(el('h4', 'font-semibold text-white mb-2', 'Gráficos da tela'));
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

    // --- gráficos personalizados (só existem no PDF)
    var customs = [];
    var customList = el('div');
    var custom = el('div');
    custom.appendChild(el('h4', 'font-semibold text-white mb-1', 'Gráficos personalizados'));
    custom.appendChild(el('p', 'text-xs text-slate-500 mb-2',
      'Barras: total de cada métrica escolhida. Linha: evolução dia a dia. Cada gráfico aparece com os valores.'));
    custom.appendChild(customList);

    function addCustomBlock() {
      var wrap = el('div', 'bg-slate-900/40 border border-slate-700 rounded-md px-3 py-2 mb-2 space-y-2');
      var top = el('div', 'flex flex-wrap items-center gap-2');
      var tIn = el('input', 'bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-xs flex-1 min-w-[10rem]');
      tIn.type = 'text';
      tIn.placeholder = 'Título (opcional)';
      var tSel = el('select', 'bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-xs');
      [['bar', 'Barras: total por métrica'], ['line', 'Linha: evolução diária']].forEach(function (opt) {
        var op = el('option', '', opt[1]);
        op.value = opt[0];
        tSel.appendChild(op);
      });
      var rm = el('button', 'text-xs text-red-400 hover:text-red-300 px-2', 'Remover');
      top.appendChild(tIn);
      top.appendChild(tSel);
      top.appendChild(rm);
      wrap.appendChild(top);

      var grid = el('div', 'flex flex-wrap gap-1 text-xs');
      var boxes = {};
      Object.keys(META_METRIC_CONFIG).forEach(function (k) {
        var l = el('label', 'flex items-center gap-1 bg-slate-700 rounded px-1.5 py-0.5 cursor-pointer');
        var b = el('input'); b.type = 'checkbox';
        boxes[k] = b;
        l.appendChild(b);
        l.appendChild(el('span', '', META_METRIC_CONFIG[k].label));
        grid.appendChild(l);
      });
      wrap.appendChild(grid);

      var block = { el: wrap, tIn: tIn, tSel: tSel, boxes: boxes };
      customs.push(block);
      rm.onclick = function () {
        wrap.remove();
        customs.splice(customs.indexOf(block), 1);
      };
      customList.appendChild(wrap);
    }

    var addBtn = el('button', 'px-3 py-1.5 text-sm rounded-md bg-slate-700 hover:bg-slate-600 text-white border border-slate-600', '+ Adicionar gráfico');
    addBtn.type = 'button';
    addBtn.onclick = addCustomBlock;
    custom.appendChild(addBtn);
    body.appendChild(custom);

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
          var blocks = [];
          CHARTS.forEach(function (c) {
            if (!c._box.checked) return;
            var sub = (c.opts || []).map(function (o) {
              var v = selection.opts[o.key];
              if (Array.isArray(v)) return o.label + ': ' + v.map(function (k) { return META_METRIC_CONFIG[k].label; }).join(', ');
              return o.label + ': ' + optionLabel(o, v);
            }).filter(Boolean).join(' | ');
            var spec = chartSpec(c.id);
            if (spec) {
              spec.title = c.title;
              spec.subtitle = sub;
              blocks.push({ kind: 'chart', spec: spec });
              return;
            }
            var img = captureChart(c.id);
            if (img) blocks.push({ kind: 'image', img: img, title: c.title, subtitle: sub });
          });

          var rows = filteredRows();
          var totals = calcMetrics(rows);
          var avg = averageByDay(rows, metrics);
          totals.avg = avg.avg;
          totals.dayCount = avg.dayCount;
          var perObjective = groupByObjective(rows);

          customs.forEach(function (b, idx) {
            var keys = Object.keys(b.boxes).filter(function (k) { return b.boxes[k].checked; });
            if (!keys.length) return;
            var title = b.tIn.value.trim() || ('Gráfico personalizado ' + (idx + 1));
            if (b.tSel.value === 'line') {
              blocks.push({ kind: 'chart', spec: dailySpec(rows, keys, title) });
            } else {
              blocks.push({
                kind: 'rows',
                spec: {
                  title: title,
                  subtitle: 'Cada barra usa a escala do seu tipo (R$, quantidade, % ou taxa).',
                  rows: totalsRows(totals, keys)
                }
              });
            }
          });

          return buildPdf(selection, blocks, totals, perObjective, accountLabel);
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
