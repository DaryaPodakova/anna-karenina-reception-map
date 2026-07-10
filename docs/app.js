const state = {
  reviews: [],
  mentions: [],
  reviewTexts: [],
  selected: { type: 'entity', value: 'Левин' },
  evidenceExpanded: false,
  graphData: null,
  view: 'comparison',
};

const labels = {
  object_type: { novel: 'Роман', film: 'Фильм' },
  source: { livelib: 'LiveLib', kinopoisk: 'Кинопоиск' },
  evaluation_target: {
    book_plot: 'Сюжет романа',
    book_character: 'Персонаж романа',
    book_language: 'Язык романа',
    book_structure: 'Композиция романа',
    author_position: 'Авторская позиция',
    adaptation_change: 'Адаптационное изменение',
    film_scene: 'Сцена фильма',
    acting: 'Актёрская игра',
    casting_appearance: 'Кастинг / внешность',
    visual_style: 'Визуальный стиль',
    music_atmosphere: 'Музыка / атмосфера',
    general_impression: 'Общее впечатление',
    directing: 'Режиссура / монтаж',
  },
  reception_frame: {
    moral_judgement: 'Моральная оценка',
    psychological_identification: 'Психологическое узнавание',
    gendered_reading: 'Гендерное чтение',
    age_rereading: 'Возрастное перечитывание',
    school_canon: 'Школьный канон',
    levin_as_alternative_center: 'Левин как второй центр',
    anna_as_tragic_symbol: 'Анна как трагический символ',
    family_marriage_conflict: 'Семья и брак',
    adaptation_loss: 'Адаптационная потеря',
    acting_reception: 'Актёрское воплощение',
    casting_reception: 'Восприятие кастинга',
    social_norms_pressure: 'Давление социальных норм',
    literary_form_reception: 'Литературная форма',
    film_craft_reception: 'Кинокрафт',
  },
  sentiment: {
    positive: 'Положительный',
    negative: 'Отрицательный',
    mixed: 'Смешанный',
    neutral: 'Нейтральный',
  },
  review_mode: {
    interpretive: 'Интерпретационный',
    emotional: 'Эмоциональный',
    comparative: 'Сравнительный',
    technical_film: 'Киноязык и исполнение',
    plot_retelling: 'Пересказ сюжета',
    canon_memory: 'Канон и перечитывание',
  },
};

const ENTITY_ORDER = ['Анна', 'Левин', 'Каренин', 'Вронский', 'Кити'];

const els = {
  researchPageTab: document.getElementById('researchPageTab'),
  reviewsPageTab: document.getElementById('reviewsPageTab'),
  researchPage: document.getElementById('researchPage'),
  reviewsPage: document.getElementById('reviewsPage'),
  levinFact: document.getElementById('levinFact'),
  lossFact: document.getElementById('lossFact'),
  actingFact: document.getElementById('actingFact'),
  filteredCount: document.getElementById('filteredCount'),
  objectFilter: document.getElementById('objectFilter'),
  frameFilter: document.getElementById('frameFilter'),
  sentimentFilter: document.getElementById('sentimentFilter'),
  searchInput: document.getElementById('searchInput'),
  resetFilters: document.getElementById('resetFilters'),
  networkGraph: document.getElementById('networkGraph'),
  graphEyebrow: document.getElementById('graphEyebrow'),
  graphTitle: document.getElementById('graphTitle'),
  graphDescription: document.getElementById('graphDescription'),
  graphLegend: document.getElementById('graphLegend'),
  graphHint: document.getElementById('graphHint'),
  networkView: document.getElementById('networkView'),
  comparisonView: document.getElementById('comparisonView'),
  proofType: document.getElementById('proofType'),
  proofTitle: document.getElementById('proofTitle'),
  proofMeta: document.getElementById('proofMeta'),
  proofTags: document.getElementById('proofTags'),
  proofInterpretation: document.getElementById('proofInterpretation'),
  proofEvidence: document.getElementById('proofEvidence'),
  clearSelection: document.getElementById('clearSelection'),
  tableCount: document.getElementById('tableCount'),
  toggleEvidence: document.getElementById('toggleEvidence'),
  mentionsTable: document.getElementById('mentionsTable'),
  reviewsVisibleCount: document.getElementById('reviewsVisibleCount'),
  reviewsObjectFilter: document.getElementById('reviewsObjectFilter'),
  reviewsModeFilter: document.getElementById('reviewsModeFilter'),
  reviewsSearch: document.getElementById('reviewsSearch'),
  resetReviewFilters: document.getElementById('resetReviewFilters'),
  reviewsList: document.getElementById('reviewsList'),
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  const [headers, ...data] = rows;
  if (!headers) return [];
  return data.map((values) => Object.fromEntries(
    headers.map((header, index) => [header.trim(), (values[index] || '').trim()])
  ));
}

async function loadCsv(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Не удалось загрузить ${path}`);
  return parseCsv(await response.text());
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Не удалось загрузить ${path}`);
  return response.json();
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function label(group, value) {
  return labels[group]?.[value] || value || 'Не задано';
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
}

function countBy(rows, getter) {
  return rows.reduce((acc, row) => {
    const key = typeof getter === 'function' ? getter(row) : row[getter];
    if (key) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function reviewMap() {
  return Object.fromEntries(state.reviews.map((review) => [review.review_id, review]));
}

function entityGroups(mention) {
  const value = (mention.entity_name || '').toLocaleLowerCase('ru');
  const groups = [];
  if (value.includes('анна')) groups.push('Анна');
  if (value.includes('левин')) groups.push('Левин');
  if (value.includes('каренин') && !value.includes('каренина')) groups.push('Каренин');
  if (value.includes('вронск')) groups.push('Вронский');
  if (value.includes('кити') || value.includes('китти')) groups.push('Кити');
  if (mention.reception_frame === 'levin_as_alternative_center') groups.push('Левин');
  return unique(groups);
}

function fillSelect(select, values, group, allLabel) {
  const current = select.value;
  const options = [''].concat(unique(values));
  select.innerHTML = options.map((value) => (
    `<option value="${escapeHtml(value)}">${escapeHtml(value ? label(group, value) : allLabel)}</option>`
  )).join('');
  select.value = options.includes(current) ? current : '';
}

function getFilteredMentions() {
  const reviews = reviewMap();
  const objectValue = els.objectFilter.value;
  const frameValue = els.frameFilter.value;
  const sentimentValue = els.sentimentFilter.value;
  const query = els.searchInput.value.trim().toLocaleLowerCase('ru');

  return state.mentions.filter((mention) => {
    const review = reviews[mention.review_id] || {};
    const searchText = [
      mention.entity_name,
      mention.segment_topic,
      mention.evidence_short,
      label('reception_frame', mention.reception_frame),
      label('evaluation_target', mention.evaluation_target),
      review.author_name,
    ].join(' ').toLocaleLowerCase('ru');
    return (!objectValue || review.object_type === objectValue)
      && (!frameValue || mention.reception_frame === frameValue)
      && (!sentimentValue || mention.sentiment === sentimentValue)
      && (!query || searchText.includes(query));
  });
}

function topValues(counts, limit) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru'))
    .slice(0, limit)
    .map(([value]) => value);
}

function createGraphData(rows) {
  const reviews = reviewMap();
  const edgeMap = new Map();
  const entityMentions = Object.fromEntries(ENTITY_ORDER.map((name) => [name, new Set()]));
  const frameMentions = { novel: {}, film: {} };

  rows.forEach((mention) => {
    const objectType = reviews[mention.review_id]?.object_type;
    const groups = entityGroups(mention);
    if (!objectType || !groups.length) return;
    frameMentions[objectType][mention.reception_frame] ||= new Set();
    frameMentions[objectType][mention.reception_frame].add(mention.mention_id);
    groups.forEach((entity) => {
      entityMentions[entity].add(mention.mention_id);
      const key = `${objectType}|||${entity}|||${mention.reception_frame}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, {
          id: key,
          type: 'edge',
          objectType,
          entity,
          frame: mention.reception_frame,
          rows: [],
        });
      }
      edgeMap.get(key).rows.push(mention);
    });
  });

  const novelFrames = topValues(
    Object.fromEntries(Object.entries(frameMentions.novel).map(([key, value]) => [key, value.size])),
    6
  );
  const filmFrames = topValues(
    Object.fromEntries(Object.entries(frameMentions.film).map(([key, value]) => [key, value.size])),
    6
  );
  const entities = ENTITY_ORDER.filter((name) => entityMentions[name].size > 0);

  const nodes = [
    ...novelFrames.map((frame) => ({
      id: `novel:${frame}`,
      type: 'novelFrame',
      value: frame,
      title: label('reception_frame', frame),
      count: frameMentions.novel[frame].size,
    })),
    ...entities.map((entity) => ({
      id: `entity:${entity}`,
      type: 'entity',
      value: entity,
      title: entity,
      count: entityMentions[entity].size,
    })),
    ...filmFrames.map((frame) => ({
      id: `film:${frame}`,
      type: 'filmFrame',
      value: frame,
      title: label('reception_frame', frame),
      count: frameMentions.film[frame].size,
    })),
  ];

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = [...edgeMap.values()].map((edge) => ({
    ...edge,
    count: edge.rows.length,
    source: edge.objectType === 'novel' ? `novel:${edge.frame}` : `entity:${edge.entity}`,
    target: edge.objectType === 'novel' ? `entity:${edge.entity}` : `film:${edge.frame}`,
  })).filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));

  return { nodes, edges, novelFrames, filmFrames, entities };
}

function createComparisonData(rows) {
  const reviews = reviewMap();
  const groups = Object.fromEntries(ENTITY_ORDER.map((entity) => [entity, {
    entity,
    novelRows: [],
    filmRows: [],
    novelIds: new Set(),
    filmIds: new Set(),
    filmLossIds: new Set(),
  }]));

  rows.forEach((mention) => {
    const objectType = reviews[mention.review_id]?.object_type;
    if (!objectType) return;
    entityGroups(mention).forEach((entity) => {
      const group = groups[entity];
      const ids = objectType === 'novel' ? group.novelIds : group.filmIds;
      const targetRows = objectType === 'novel' ? group.novelRows : group.filmRows;
      if (!ids.has(mention.mention_id)) {
        ids.add(mention.mention_id);
        targetRows.push(mention);
      }
      if (objectType === 'film' && mention.reception_frame === 'adaptation_loss') {
        group.filmLossIds.add(mention.mention_id);
      }
    });
  });

  return ENTITY_ORDER.map((entity) => ({
    entity,
    novelCount: groups[entity].novelIds.size,
    filmCount: groups[entity].filmIds.size,
    filmLossCount: groups[entity].filmLossIds.size,
    novelRows: groups[entity].novelRows,
    filmRows: groups[entity].filmRows,
  })).filter((group) => group.novelCount || group.filmCount);
}

function distribute(nodes, x, width, top = 48, bottom = 462) {
  if (!nodes.length) return;
  const step = nodes.length === 1 ? 0 : (bottom - top) / (nodes.length - 1);
  nodes.forEach((node, index) => {
    node.x = x;
    node.y = nodes.length === 1 ? (top + bottom) / 2 : top + index * step;
    node.width = width;
    node.height = 48;
  });
}

function wrapLabel(value, maxLength = 20) {
  const words = value.split(' ');
  const lines = [];
  let current = '';
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

function nodeMarkup(node, isSelected, isConnected) {
  const palette = node.type === 'entity'
    ? { fill: '#f5e7d2', stroke: '#b17a36', text: '#6f491c' }
    : node.type === 'novelFrame'
      ? { fill: '#f1e2e5', stroke: '#7d2939', text: '#651f2d' }
      : { fill: '#dfeeed', stroke: '#236368', text: '#174e52' };
  const lines = wrapLabel(node.title, node.type === 'entity' ? 18 : 22);
  const startY = node.y - ((lines.length - 1) * 7);
  const text = lines.map((line, index) => (
    `<tspan x="${node.x + 10}" y="${startY + index * 14}">${escapeHtml(line)}</tspan>`
  )).join('');
  const classes = ['network-node'];
  if (isSelected) classes.push('selected');
  if (!isConnected) classes.push('dimmed');
  return `
    <g class="${classes.join(' ')}" data-node-id="${escapeHtml(node.id)}" role="button" tabindex="0">
      <rect x="${node.x}" y="${node.y - node.height / 2}" width="${node.width}" height="${node.height}" rx="9" fill="${palette.fill}" stroke="${palette.stroke}"></rect>
      <text class="node-title" fill="${palette.text}">${text}</text>
      <text class="node-count" x="${node.x + node.width - 10}" y="${node.y + 4}" text-anchor="end" fill="${palette.text}">${node.count}</text>
      <title>${escapeHtml(node.title)}: ${node.count}</title>
    </g>`;
}

function edgePath(source, target) {
  const sx = source.x + source.width;
  const sy = source.y;
  const tx = target.x;
  const ty = target.y;
  const curve = Math.max(70, (tx - sx) * 0.46);
  return `M ${sx} ${sy} C ${sx + curve} ${sy}, ${tx - curve} ${ty}, ${tx} ${ty}`;
}

function selectedMatchesNode(node) {
  if (!state.selected || state.selected.type === 'edge') return false;
  return state.selected.type === node.type && state.selected.value === node.value;
}

function selectedEdgeId() {
  return state.selected?.type === 'edge' ? state.selected.id : null;
}

function renderGraph(rows) {
  const data = createGraphData(rows);
  state.graphData = data;
  const novelNodes = data.nodes.filter((node) => node.type === 'novelFrame');
  const entityNodes = data.nodes.filter((node) => node.type === 'entity');
  const filmNodes = data.nodes.filter((node) => node.type === 'filmFrame');
  distribute(novelNodes, 20, 190);
  distribute(entityNodes, 380, 150, 72, 438);
  distribute(filmNodes, 720, 180);
  const nodeById = Object.fromEntries(data.nodes.map((node) => [node.id, node]));

  if (state.selected && state.selected.type !== 'edge') {
    const exists = data.nodes.some((node) => selectedMatchesNode(node));
    if (!exists) state.selected = null;
  }
  if (state.selected?.type === 'edge' && !data.edges.some((edge) => edge.id === state.selected.id)) {
    state.selected = null;
  }

  const activeEdgeIds = new Set();
  if (state.selected?.type === 'edge') {
    activeEdgeIds.add(state.selected.id);
  } else if (state.selected) {
    const selectedNode = data.nodes.find((node) => selectedMatchesNode(node));
    if (selectedNode) {
      data.edges.forEach((edge) => {
        if (edge.source === selectedNode.id || edge.target === selectedNode.id) activeEdgeIds.add(edge.id);
      });
    }
  }
  const hasSelection = Boolean(state.selected);
  const connectedNodes = new Set();
  data.edges.forEach((edge) => {
    if (activeEdgeIds.has(edge.id)) {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    }
  });

  const edges = data.edges.map((edge) => {
    const source = nodeById[edge.source];
    const target = nodeById[edge.target];
    const path = edgePath(source, target);
    const active = activeEdgeIds.has(edge.id);
    const opacity = hasSelection ? (active ? 0.85 : 0.07) : 0.24;
    const color = edge.objectType === 'novel' ? '#7d2939' : '#236368';
    const width = Math.min(10, 1.2 + edge.count * 1.45);
    return `
      <path class="network-edge" d="${path}" stroke="${color}" stroke-width="${active ? width + 1.5 : width}" opacity="${opacity}"></path>
      <path class="edge-hit" data-edge-id="${escapeHtml(edge.id)}" d="${path}" fill="none" stroke="transparent" stroke-width="16" pointer-events="stroke"><title>${escapeHtml(edge.entity)} → ${escapeHtml(label('reception_frame', edge.frame))}: ${edge.count}</title></path>`;
  }).join('');

  const nodes = data.nodes.map((node) => nodeMarkup(
    node,
    selectedMatchesNode(node),
    !hasSelection || connectedNodes.has(node.id) || selectedMatchesNode(node)
  )).join('');

  els.networkGraph.innerHTML = `
    <svg class="network-svg" viewBox="0 0 920 490" aria-label="Граф связей между рамками романа, персонажами и рамками фильма">
      <text class="column-title" x="20" y="18">РАМКА ЧТЕНИЯ РОМАНА</text>
      <text class="column-title" x="380" y="18">ПЕРСОНАЖ / ЛИНИЯ</text>
      <text class="column-title" x="720" y="18">РАМКА ВОСПРИЯТИЯ ФИЛЬМА</text>
      <g>${edges}</g>
      <g>${nodes}</g>
    </svg>`;

  els.networkGraph.querySelectorAll('[data-node-id]').forEach((element) => {
    const activate = () => {
      const node = data.nodes.find((item) => item.id === element.dataset.nodeId);
      if (!node) return;
      state.selected = { type: node.type, value: node.value };
      state.evidenceExpanded = false;
      renderAll();
    };
    element.addEventListener('click', activate);
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') activate();
    });
  });
  els.networkGraph.querySelectorAll('[data-edge-id]').forEach((element) => {
    element.addEventListener('click', () => {
      const edge = data.edges.find((item) => item.id === element.dataset.edgeId);
      if (!edge) return;
      state.selected = { type: 'edge', id: edge.id };
      state.evidenceExpanded = false;
      renderAll();
    });
  });
}

function renderComparisonGraph(rows) {
  const groups = createComparisonData(rows);
  state.graphData = { comparisonGroups: groups };
  if (state.selected?.type === 'comparison') {
    const exists = groups.some((group) => group.entity === state.selected.entity);
    if (!exists) state.selected = null;
  }
  if (state.selected?.type === 'entity') {
    const exists = groups.some((group) => group.entity === state.selected.value);
    if (!exists) state.selected = null;
  }

  const max = Math.max(1, ...groups.flatMap((group) => [group.novelCount, group.filmCount]));
  const chartLeft = 60;
  const leftEnd = 365;
  const centerX = 390;
  const centerWidth = 140;
  const rightStart = 555;
  const chartRight = 860;
  const maxBarWidth = leftEnd - chartLeft;
  const top = 82;
  const step = groups.length > 1 ? 76 : 0;

  const selectedEntity = state.selected?.type === 'entity'
    ? state.selected.value
    : state.selected?.type === 'comparison'
      ? state.selected.entity
      : null;

  const rowsMarkup = groups.map((group, index) => {
    const y = groups.length === 1 ? 245 : top + index * step;
    const novelWidth = (group.novelCount / max) * maxBarWidth;
    const filmWidth = (group.filmCount / max) * maxBarWidth;
    const filmLossWidth = (group.filmLossCount / max) * maxBarWidth;
    const isSelected = selectedEntity === group.entity;
    const dimmed = selectedEntity && !isSelected;
    const novelActive = state.selected?.type === 'comparison'
      && state.selected.entity === group.entity
      && state.selected.objectType === 'novel';
    const filmActive = state.selected?.type === 'comparison'
      && state.selected.entity === group.entity
      && state.selected.objectType === 'film';
    return `
      <g class="comparison-row ${dimmed ? 'dimmed' : ''}" data-comparison-row="${escapeHtml(group.entity)}">
        <line class="comparison-guide" x1="${chartLeft}" y1="${y}" x2="${chartRight}" y2="${y}"></line>
        <g class="comparison-bar" data-comparison-entity="${escapeHtml(group.entity)}" data-comparison-object="novel" role="button" tabindex="0">
          <rect x="${leftEnd - novelWidth}" y="${y - 15}" width="${novelWidth}" height="30" rx="6" fill="#7d2939" opacity="${novelActive ? 1 : 0.82}" stroke="${novelActive ? '#511824' : 'none'}" stroke-width="2"></rect>
          <text class="comparison-value" x="${leftEnd - novelWidth - 9}" y="${y + 4}" text-anchor="end">${group.novelCount}</text>
          <title>${escapeHtml(group.entity)} · роман: ${group.novelCount}</title>
        </g>
        <g class="comparison-entity ${isSelected ? 'selected' : ''}" data-comparison-entity="${escapeHtml(group.entity)}" role="button" tabindex="0">
          <rect x="${centerX}" y="${y - 22}" width="${centerWidth}" height="44" rx="10" fill="#f5e7d2" stroke="#b17a36" stroke-width="1.4"></rect>
          <text class="node-title" x="${centerX + centerWidth / 2}" y="${y + 4}" text-anchor="middle" fill="#6f491c">${escapeHtml(group.entity)}</text>
        </g>
        <g class="comparison-bar" data-comparison-entity="${escapeHtml(group.entity)}" data-comparison-object="film" data-film-total="${group.filmCount}" data-film-loss="${group.filmLossCount}" role="button" tabindex="0">
          <rect x="${rightStart}" y="${y - 15}" width="${filmWidth}" height="30" rx="6" fill="#236368" opacity="${filmActive ? 1 : 0.82}" stroke="${filmActive ? '#174e52' : 'none'}" stroke-width="2"></rect>
          ${group.filmLossCount ? `<rect x="${rightStart}" y="${y - 15}" width="${filmLossWidth}" height="30" rx="6" fill="#c4744b" opacity="0.98"></rect>` : ''}
          ${group.filmLossCount && filmLossWidth >= 20 ? `<text class="comparison-loss-value" x="${rightStart + filmLossWidth / 2}" y="${y + 4}" text-anchor="middle">${group.filmLossCount}</text>` : ''}
          <text class="comparison-value" x="${rightStart + filmWidth + 9}" y="${y + 4}">${group.filmCount}</text>
          <title>${escapeHtml(group.entity)} · фильм: ${group.filmCount}; из них adaptation loss: ${group.filmLossCount}</title>
        </g>
      </g>`;
  }).join('');

  els.networkGraph.innerHTML = groups.length ? `
    <svg class="comparison-svg" viewBox="0 0 920 490" aria-label="Зеркальный график общих персонажей в книжных и киноотзывах">
      <text class="comparison-axis-label" x="210" y="28" text-anchor="middle">КНИЖНАЯ РЕЦЕПЦИЯ</text>
      <text class="comparison-axis-label" x="460" y="28" text-anchor="middle">ОБЩИЙ УЗЕЛ</text>
      <text class="comparison-axis-label" x="710" y="28" text-anchor="middle">КИНОРЕЦЕПЦИЯ</text>
      <text class="comparison-note" x="210" y="48" text-anchor="middle">упоминания только о романе</text>
      <text class="comparison-note" x="710" y="48" text-anchor="middle">упоминания только о фильме</text>
      ${rowsMarkup}
    </svg>` : '<p class="proof-meta" style="padding:20px;">Для выбранного среза нет общих персонажей.</p>';

  els.networkGraph.querySelectorAll('[data-comparison-entity]').forEach((element) => {
    const activate = () => {
      const entity = element.dataset.comparisonEntity;
      const objectType = element.dataset.comparisonObject;
      state.selected = objectType
        ? { type: 'comparison', entity, objectType }
        : { type: 'entity', value: entity };
      state.evidenceExpanded = false;
      renderAll();
    };
    element.addEventListener('click', activate);
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') activate();
    });
  });
}

function renderVisual(rows) {
  const comparison = state.view === 'comparison';
  els.networkView.classList.toggle('active', !comparison);
  els.comparisonView.classList.toggle('active', comparison);
  if (comparison) {
    els.graphEyebrow.textContent = 'Главный исследовательский аргумент';
    els.graphTitle.textContent = 'Роман ↔ фильм';
    els.graphDescription.textContent = 'Зеркальные полосы разделяют две независимые рецепции. Общим является узел в центре, а внутренний сегмент кино-полосы отмечает adaptation loss.';
    els.graphLegend.innerHTML = '<span class="legend-object">Роман</span><span class="legend-entity">Общий узел</span><span class="legend-frame">Фильм</span><span class="legend-loss">Из них потеря</span>';
    els.graphHint.textContent = 'Нажмите на полосу, чтобы выбрать одну выборку; центральный узел объединяет обе стороны без предположения о причинном переходе.';
    renderComparisonGraph(rows);
  } else {
    els.graphEyebrow.textContent = 'Общий обзор';
    els.graphTitle.textContent = 'Карта совместной встречаемости';
    els.graphDescription.textContent = 'Совместная встречаемость рамки и персонажа в размеченных упоминаниях. Толщина ребра показывает число таких упоминаний, но не переход от романа к фильму.';
    els.graphLegend.innerHTML = '<span class="legend-object">Книжная рамка</span><span class="legend-entity">Персонаж</span><span class="legend-frame">Кинорамка</span>';
    els.graphHint.textContent = 'Нажмите на узел или ребро. Составное упоминание может связываться с несколькими персонажами, поэтому рёбра не нужно суммировать до 80.';
    renderGraph(rows);
  }
}

function rowsForSelection(rows) {
  if (!state.selected) return rows;
  if (state.selected.type === 'comparison') {
    const reviews = reviewMap();
    return rows.filter((row) => (
      reviews[row.review_id]?.object_type === state.selected.objectType
        && entityGroups(row).includes(state.selected.entity)
    ));
  }
  if (state.selected.type === 'edge') {
    return state.graphData?.edges.find((edge) => edge.id === state.selected.id)?.rows || [];
  }
  if (state.selected.type === 'entity') {
    return rows.filter((row) => entityGroups(row).includes(state.selected.value));
  }
  const objectType = state.selected.type === 'novelFrame' ? 'novel' : 'film';
  const reviews = reviewMap();
  return rows.filter((row) => (
    reviews[row.review_id]?.object_type === objectType
      && row.reception_frame === state.selected.value
  ));
}

function representativeRows(rows) {
  return [...rows].sort((a, b) => {
    const priority = (row) => {
      if (row.reception_frame === 'levin_as_alternative_center') return 0;
      if (row.reception_frame === 'adaptation_loss') return 1;
      if (row.reception_frame === 'casting_reception') return 2;
      if (row.reception_frame === 'acting_reception') return 3;
      return 4;
    };
    return priority(a) - priority(b) || Number(b.confidence) - Number(a.confidence);
  });
}

function renderProof(baseRows) {
  const selectedRows = rowsForSelection(baseRows);
  const reviews = reviewMap();
  let title = 'Общий вид корпуса';
  let type = 'Как читать граф';
  let meta = `${baseRows.length} упоминаний проходят через выбранный срез. Выберите узел или ребро, чтобы проверить связь.`;
  let interpretation = 'Граф показывает структуру внимания внутри пилотной выборки, а не общий закон о романе или фильме.';
  let tagCounts = {};

  if (state.selected?.type === 'comparison') {
    const objectLabel = label('object_type', state.selected.objectType);
    title = `${state.selected.entity} · ${objectLabel}`;
    type = `Одна сторона пересечения · ${objectLabel}`;
    meta = `${selectedRows.length} упоминаний относятся только к ${state.selected.objectType === 'novel' ? 'книжной' : 'кино'} выборке; причинная связь между выборками не предполагается.`;
    tagCounts = countBy(selectedRows, 'reception_frame');
    if (state.selected.entity === 'Левин' && state.selected.objectType === 'film') {
      const lossCount = selectedRows.filter((row) => row.reception_frame === 'adaptation_loss').length;
      interpretation = `В кино-рецепции ${lossCount} из ${selectedRows.length} левинских упоминаний описывают утраченную или сокращённую линию.`;
    } else if (state.selected.entity === 'Левин' && state.selected.objectType === 'novel') {
      const centerCount = selectedRows.filter((row) => row.reception_frame === 'levin_as_alternative_center').length;
      interpretation = `В книжной выборке ${centerCount} из ${selectedRows.length} левинских упоминаний представляют его как второй центр романа.`;
    } else {
      interpretation = `Эта сторона показывает, как узел ${state.selected.entity} обсуждается только в ${state.selected.objectType === 'novel' ? 'книжной' : 'кино'} части пилота.`;
    }
  } else if (state.selected?.type === 'entity') {
    title = state.selected.value;
    type = 'Производная группа персонажа';
    const byObject = countBy(selectedRows, (row) => reviews[row.review_id]?.object_type);
    meta = `${selectedRows.length} связанных упоминаний: ${byObject.novel || 0} о романе и ${byObject.film || 0} о фильме.`;
    tagCounts = countBy(selectedRows, 'reception_frame');
    if (state.selected.value === 'Левин') {
      tagCounts = Object.fromEntries([
        'levin_as_alternative_center',
        'adaptation_loss',
        'casting_reception',
        'acting_reception',
      ].map((frame) => [frame, tagCounts[frame] || 0]).filter(([, count]) => count));
      interpretation = 'В книжной выборке Левин виден как второй центр романа; в кино-рецепции чаще появляется как утраченная или сокращённая линия.';
    } else {
      interpretation = `Общий узел показывает, что ${state.selected.value} заметен в обеих независимых выборках, но может обсуждаться через разные рамки.`;
    }
  } else if (state.selected?.type === 'novelFrame' || state.selected?.type === 'filmFrame') {
    const objectType = state.selected.type === 'novelFrame' ? 'Роман' : 'Фильм';
    title = label('reception_frame', state.selected.value);
    type = `Рамка · ${objectType}`;
    meta = `${selectedRows.length} упоминаний связаны с этой рамкой в выбранном срезе.`;
    selectedRows.forEach((row) => entityGroups(row).forEach((entity) => {
      tagCounts[entity] = (tagCounts[entity] || 0) + 1;
    }));
    interpretation = `Рамка ${label('reception_frame', state.selected.value)} связывает перечисленные узлы только внутри ${state.selected.type === 'novelFrame' ? 'книжной' : 'кино'} выборки.`;
  } else if (state.selected?.type === 'edge') {
    const edge = state.graphData?.edges.find((item) => item.id === state.selected.id);
    if (edge) {
      title = `${edge.entity} → ${label('reception_frame', edge.frame)}`;
      type = edge.objectType === 'novel' ? 'Связь романа' : 'Связь фильма';
      meta = `${edge.count} ${edge.count === 1 ? 'упоминание подтверждает' : 'упоминания подтверждают'} эту связь.`;
      tagCounts = countBy(edge.rows, 'evaluation_target');
      interpretation = `Ребро показывает совместную встречаемость узла ${edge.entity} и рамки ${label('reception_frame', edge.frame)} в размеченных упоминаниях.`;
    }
  } else {
    tagCounts = {
      'Левин как второй центр': Number(els.levinFact.textContent) || 0,
      'Адаптационная потеря': Number(els.lossFact.textContent) || 0,
      'Актёрское воплощение': Number(els.actingFact.textContent) || 0,
    };
  }

  const tags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([value, count]) => {
      const display = labels.reception_frame[value]
        || labels.evaluation_target[value]
        || value;
      return `<span>${escapeHtml(display)} · ${count}</span>`;
    }).join('');

  let proofRows = representativeRows(selectedRows);
  if (state.view === 'comparison' && state.selected?.type === 'entity') {
    const novelRows = proofRows.filter((row) => reviews[row.review_id]?.object_type === 'novel');
    const filmRows = proofRows.filter((row) => reviews[row.review_id]?.object_type === 'film');
    proofRows = [novelRows[0], filmRows[0], filmRows[1] || novelRows[1]].filter(Boolean);
  }
  const evidence = proofRows.slice(0, 3).map((row) => {
    const review = reviews[row.review_id] || {};
    return `
      <article class="proof-item">
        <small>${escapeHtml(label('source', review.source))} · ${escapeHtml(label('object_type', review.object_type))} · confidence ${escapeHtml(row.confidence)}</small>
        <p>${escapeHtml(row.evidence_short)}</p>
      </article>`;
  }).join('');

  els.proofType.textContent = type;
  els.proofTitle.textContent = title;
  els.proofMeta.textContent = meta;
  els.proofTags.innerHTML = tags;
  els.proofInterpretation.textContent = interpretation;
  els.proofEvidence.innerHTML = evidence || '<p class="proof-meta">Для выбранного среза доказательств нет.</p>';
}

function confidenceDots(value) {
  const level = Number(value) || 0;
  return `<span class="confidence-dots" aria-label="Уверенность ${level} из 3">${[1, 2, 3].map((n) => `<span class="${n <= level ? '' : 'off'}">●</span>`).join('')}</span>`;
}

function renderEvidence(baseRows) {
  const rows = rowsForSelection(baseRows);
  const reviews = reviewMap();
  const shown = state.evidenceExpanded ? rows : rows.slice(0, 6);
  els.tableCount.textContent = `${rows.length} ${rows.length === 1 ? 'строка' : 'строк'}`;
  els.toggleEvidence.style.display = rows.length > 6 ? '' : 'none';
  els.toggleEvidence.textContent = state.evidenceExpanded ? 'Свернуть' : 'Показать все';
  els.mentionsTable.innerHTML = shown.map((mention) => {
    const review = reviews[mention.review_id] || {};
    return `
      <tr>
        <td class="source-cell"><strong>${escapeHtml(label('source', review.source))} · ${escapeHtml(label('object_type', review.object_type))}</strong><small>${escapeHtml(review.author_name || 'Без автора')}</small></td>
        <td class="link-cell"><strong>${escapeHtml(mention.entity_name)}</strong><span>${escapeHtml(label('reception_frame', mention.reception_frame))}</span></td>
        <td>${escapeHtml(label('evaluation_target', mention.evaluation_target))}</td>
        <td>${escapeHtml(mention.evidence_short)}</td>
        <td>${confidenceDots(mention.confidence)}</td>
      </tr>`;
  }).join('') || '<tr><td colspan="5">Для выбранного среза данных нет.</td></tr>';
}

function renderReviewMention(mention) {
  const codes = [
    mention.entity_type,
    mention.evaluation_target,
    mention.reception_frame,
    mention.comparison_mode,
    mention.scene_origin,
    mention.sentiment,
    `confidence ${mention.confidence}`,
  ];
  return `
    <article class="review-mention">
      <h4>${escapeHtml(mention.segment_topic)}</h4>
      <div class="review-mention-meta">${codes.map((code) => `<code>${escapeHtml(code)}</code>`).join('')}</div>
      <p><strong>${escapeHtml(mention.entity_name)}</strong></p>
      <p>${escapeHtml(mention.evidence_short)}</p>
      ${mention.coder_notes ? `<p><strong>Комментарий разметчика:</strong> ${escapeHtml(mention.coder_notes)}</p>` : ''}
    </article>`;
}

function getFilteredReviews() {
  const textById = Object.fromEntries(state.reviewTexts.map((row) => [row.review_id, row]));
  const mentionsById = Object.groupBy
    ? Object.groupBy(state.mentions, (mention) => mention.review_id)
    : state.mentions.reduce((acc, mention) => {
      (acc[mention.review_id] ||= []).push(mention);
      return acc;
    }, {});
  const objectValue = els.reviewsObjectFilter.value;
  const modeValue = els.reviewsModeFilter.value;
  const query = els.reviewsSearch.value.trim().toLocaleLowerCase('ru');

  return state.reviews.filter((review) => {
    const original = textById[review.review_id]?.original_text || '';
    const annotations = (mentionsById[review.review_id] || [])
      .flatMap((mention) => [
        mention.segment_topic,
        mention.entity_name,
        mention.evidence_short,
        label('reception_frame', mention.reception_frame),
        label('evaluation_target', mention.evaluation_target),
      ]).join(' ');
    const text = [
      review.author_name,
      review.review_title,
      label('source', review.source),
      original,
      annotations,
    ].join(' ').toLocaleLowerCase('ru');
    return (!objectValue || review.object_type === objectValue)
      && (!modeValue || review.review_mode === modeValue)
      && (!query || text.includes(query));
  });
}

function renderReviews() {
  const textById = Object.fromEntries(state.reviewTexts.map((row) => [row.review_id, row]));
  const mentionsById = state.mentions.reduce((acc, mention) => {
    (acc[mention.review_id] ||= []).push(mention);
    return acc;
  }, {});
  const reviews = getFilteredReviews();
  els.reviewsVisibleCount.textContent = reviews.length;
  els.reviewsList.innerHTML = reviews.map((review) => {
    const original = textById[review.review_id] || {};
    const mentions = mentionsById[review.review_id] || [];
    const title = review.review_title || `Отзыв ${review.author_name || 'без автора'}`;
    const datetime = original.raw_datetime || review.review_date || 'дата не указана';
    const likes = review.likes_count || '—';
    const rating = review.rating || '—';
    const originalText = original.original_text || 'Полный текст не найден.';
    return `
      <article class="review-card ${escapeHtml(review.object_type)}" data-review-id="${escapeHtml(review.review_id)}">
        <header class="review-card-header">
          <div>
            <div class="review-kicker">
              <span>${escapeHtml(label('object_type', review.object_type))}</span>
              <span>${escapeHtml(label('source', review.source))}</span>
              <span>${escapeHtml(datetime)}</span>
            </div>
            <h3>${escapeHtml(title)}</h3>
            <p class="review-author">${escapeHtml(review.author_name || 'Автор не указан')} · <code>${escapeHtml(review.review_id)}</code></p>
          </div>
          <div class="review-card-stats">
            <span>лайки / полезные: ${escapeHtml(likes)}</span>
            <span>рейтинг: ${escapeHtml(rating)}</span>
            <span>${escapeHtml(label('review_mode', review.review_mode))}</span>
            <span>analytical value: ${escapeHtml(review.analytical_value)}</span>
            <span>меток: ${mentions.length}</span>
          </div>
        </header>
        <details>
          <summary>Оригинальный текст полностью <small>${originalText.length.toLocaleString('ru-RU')} знаков</small></summary>
          <div class="review-original">${escapeHtml(originalText)}</div>
        </details>
        <details>
          <summary>Наша текущая разметка <small>${mentions.length} меток</small></summary>
          <div class="review-annotations">${mentions.map(renderReviewMention).join('')}</div>
        </details>
      </article>`;
  }).join('') || '<div class="reviews-empty">По выбранным фильтрам отзывы не найдены.</div>';
}

function showPage(page) {
  const reviewsActive = page === 'reviews';
  els.researchPage.hidden = reviewsActive;
  els.reviewsPage.hidden = !reviewsActive;
  els.researchPageTab.classList.toggle('active', !reviewsActive);
  els.reviewsPageTab.classList.toggle('active', reviewsActive);
  if (reviewsActive) renderReviews();
  const hash = reviewsActive ? '#reviews' : '#research';
  if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
}

function renderFacts() {
  const reviews = reviewMap();
  const novel = state.mentions.filter((row) => reviews[row.review_id]?.object_type === 'novel');
  const film = state.mentions.filter((row) => reviews[row.review_id]?.object_type === 'film');
  els.levinFact.textContent = novel.filter((row) => row.reception_frame === 'levin_as_alternative_center').length;
  els.lossFact.textContent = film.filter((row) => row.reception_frame === 'adaptation_loss').length;
  els.actingFact.textContent = film.filter((row) => row.reception_frame === 'acting_reception').length;
}

function renderAll() {
  const filtered = getFilteredMentions();
  els.filteredCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'упоминание' : 'упоминаний'}`;
  renderVisual(filtered);
  renderProof(filtered);
  renderEvidence(filtered);
}

function resetFilters() {
  els.objectFilter.value = '';
  els.frameFilter.value = '';
  els.sentimentFilter.value = '';
  els.searchInput.value = '';
  state.selected = { type: 'entity', value: 'Левин' };
  state.evidenceExpanded = false;
  renderAll();
}

async function init() {
  try {
    const [reviews, mentions, reviewTexts] = await Promise.all([
      loadCsv('data/reviews.csv'),
      loadCsv('data/mentions.csv'),
      loadJson('data/review_texts.json'),
    ]);
    state.reviews = reviews.filter((row) => row.review_id);
    state.mentions = mentions.filter((row) => row.mention_id);
    state.reviewTexts = reviewTexts.filter((row) => row.review_id);
    fillSelect(els.objectFilter, state.reviews.map((row) => row.object_type), 'object_type', 'Роман + фильм');
    fillSelect(els.frameFilter, state.mentions.map((row) => row.reception_frame), 'reception_frame', 'Все рамки');
    fillSelect(els.sentimentFilter, state.mentions.map((row) => row.sentiment), 'sentiment', 'Любой тон');
    fillSelect(els.reviewsObjectFilter, state.reviews.map((row) => row.object_type), 'object_type', 'Роман + фильм');
    fillSelect(els.reviewsModeFilter, state.reviews.map((row) => row.review_mode), 'review_mode', 'Все режимы');
    renderFacts();
    renderAll();
    showPage(window.location.hash === '#reviews' ? 'reviews' : 'research');
  } catch (error) {
    document.body.insertAdjacentHTML('afterbegin', `<p style="margin:0;padding:16px;background:#fff3f3;color:#7a1f2b;">${escapeHtml(error.message)}</p>`);
  }
}

[els.objectFilter, els.frameFilter, els.sentimentFilter].forEach((element) => {
  element.addEventListener('input', () => {
    state.evidenceExpanded = false;
    renderAll();
  });
  element.addEventListener('change', () => {
    state.evidenceExpanded = false;
    renderAll();
  });
});
els.searchInput.addEventListener('input', () => {
  state.evidenceExpanded = false;
  renderAll();
});
els.resetFilters.addEventListener('click', resetFilters);
els.clearSelection.addEventListener('click', () => {
  state.selected = null;
  state.evidenceExpanded = false;
  renderAll();
});
els.toggleEvidence.addEventListener('click', () => {
  state.evidenceExpanded = !state.evidenceExpanded;
  renderEvidence(getFilteredMentions());
});
els.networkView.addEventListener('click', () => {
  state.view = 'network';
  state.selected = { type: 'entity', value: 'Левин' };
  state.evidenceExpanded = false;
  renderAll();
});
els.comparisonView.addEventListener('click', () => {
  state.view = 'comparison';
  state.selected = { type: 'entity', value: 'Левин' };
  state.evidenceExpanded = false;
  renderAll();
});
els.researchPageTab.addEventListener('click', () => showPage('research'));
els.reviewsPageTab.addEventListener('click', () => showPage('reviews'));
[els.reviewsObjectFilter, els.reviewsModeFilter].forEach((element) => {
  element.addEventListener('input', renderReviews);
  element.addEventListener('change', renderReviews);
});
els.reviewsSearch.addEventListener('input', renderReviews);
els.resetReviewFilters.addEventListener('click', () => {
  els.reviewsObjectFilter.value = '';
  els.reviewsModeFilter.value = '';
  els.reviewsSearch.value = '';
  renderReviews();
});
window.addEventListener('hashchange', () => {
  showPage(window.location.hash === '#reviews' ? 'reviews' : 'research');
});

init();
