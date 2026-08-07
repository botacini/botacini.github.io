import { test, expect } from '@playwright/test';

const members = [
  { id: 'pai', name: 'PAI', avatar: '👨', color: '#378add', role: 'pai' },
  { id: 'mae', name: 'MÃE', avatar: '👩', color: '#e879c9', role: 'mae' },
  { id: 'filho', name: 'FILHO', avatar: '🧒', color: '#5cb832', role: 'crianca' }
];

async function renderFixture(page) {
  await page.route('**/js/main.js', route => route.abort());
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async ({ members }) => {
    document.getElementById('auth-overlay')?.remove();
    const [{ state }, renderer] = await Promise.all([
      import('/js/state.js'),
      import('/js/render.js')
    ]);
    state.today = '2026-07-30';
    state.selectedDate = '2026-07-30';
    state.config = { members, teamStarsGoal: 20, customGoals: [], familyName: 'TESTE' };
    state.memberStars = { pai: 1, mae: 2, filho: 0 };
    state.familyWallet = { earned: 3, spent: 0, balance: 3 };
    state.missions = [
      { id: 'm1', title: 'DEVOCIONAL', emoji: '📖', start: '06:15', end: '07:00', assignee: ['pai', 'mae'], schedule: { type: 'weekly' } },
      { id: 'm2', title: 'AULA', emoji: '✏️', start: '08:30', end: '09:30', assignee: ['mae', 'filho'], schedule: { type: 'weekly' } },
      { id: 'm3', title: 'TAREFA CURTA', emoji: '✓', start: '10:00', end: '10:10', assignee: ['pai'], schedule: { type: 'once' } },
      { id: 'm4', title: 'TRABALHO', emoji: '💻', start: '10:00', end: '12:00', assignee: ['mae'], schedule: { type: 'once' } }
    ];
    state.missionStatus = {
      m1: { status: 'done', stars: 3, bonus: { capricho: true, pontual: true, semreclamar: true } },
      m3: { status: 'done', stars: 0, bonus: {} }
    };
    renderer.renderMembersBar();
    renderer.renderMissions();
  }, { members });
}

test('renders shared timeline and proportional durations', async ({ page }) => {
  await renderFixture(page);
  await expect(page.locator('.timeline-task')).toHaveCount(6);
  await expect(page.locator('.timeline-task.shared-task')).toHaveCount(4);
  await expect(page.locator('.timeline-task[data-mission-id="m1"]').first()).toContainText('◉ 2');
  const shortBox = await page.locator('.timeline-task[data-mission-id="m3"]').boundingBox();
  const longBox = await page.locator('.timeline-task[data-mission-id="m4"]').boundingBox();
  expect(longBox.height / shortBox.height).toBeGreaterThan(10);
  const shared = page.locator('.timeline-task[data-mission-id="m1"]');
  await expect(shared).toHaveCount(2);
  await expect(shared.nth(0)).toHaveCSS('grid-column-start', '2');
  await expect(shared.nth(1)).toHaveCSS('grid-column-start', '3');
  await expect(page.locator('.task-edit-direct')).toHaveCount(0);
  await expect(page.locator('[data-edit-mission]')).toHaveCount(4);
  await expect(page.locator('.task-header')).toHaveCount(6);
  await expect(page.locator('.task-actions')).toHaveCount(6);

  const layout = await page.locator('.timeline-task').evaluateAll(cards => cards.map(card => {
    const box = card.getBoundingClientRect();
    const header = card.querySelector('.task-header').getBoundingClientRect();
    const content = card.querySelector('.task-content').getBoundingClientRect();
    const emoji = card.querySelector('.task-emoji').getBoundingClientRect();
    const title = card.querySelector('.task-title').getBoundingClientRect();
    const done = card.querySelector('.task-done').getBoundingClientRect();
    const fail = card.querySelector('.task-fail').getBoundingClientRect();
    const menu = card.querySelector('.task-menu-btn')?.getBoundingClientRect();
    const isUltra = card.classList.contains('timeline-task--ultra');
    const inside = rect => rect.top >= box.top && rect.bottom <= box.bottom
      && rect.left >= box.left && rect.right <= box.right;
    return {
      inside: [header, emoji, title, done, fail, menu].filter(Boolean).every(inside),
      ordered: isUltra || (emoji.top <= title.top && title.top <= done.top),
      equalActions: Math.abs(done.width - fail.width) < 1,
      actionsUseWidth: isUltra || (done.width + fail.width + 4) / content.width > .9,
      headerAtTop: Math.abs(header.top - box.top) < 2,
      contentCentered: isUltra || Math.abs((emoji.top + emoji.height / 2) - (content.top + content.height / 2)) < content.height / 2,
      ultraReorganized: !isUltra || (emoji.right <= title.left && title.right <= done.left)
    };
  }));
  expect(layout.every(card => card.inside && card.ordered && card.equalActions && card.actionsUseWidth && card.headerAtTop && card.contentCentered && card.ultraReorganized)).toBe(true);
});

test('uses compact variants only for tasks at or below fifteen minutes', async ({ page }) => {
  await renderFixture(page);
  await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    const renderer = await import('/js/render.js');
    state.missions.push(
      { id: 'm5', title: 'QUINZE MINUTOS', emoji: '⏱️', start: '12:05', end: '12:20', assignee: ['pai'], desc: '[categoria:saude]', schedule: { type: 'once' } },
      { id: 'm6', title: 'TRINTA MINUTOS', emoji: '🧹', start: '12:20', end: '12:50', assignee: ['filho'], desc: '[categoria:outros]', schedule: { type: 'once' } }
    );
    renderer.renderMissions();
  });

  await expect(page.locator('.timeline-task[data-mission-id="m3"]')).toHaveClass(/timeline-task--ultra/);
  await expect(page.locator('.timeline-task[data-mission-id="m5"]')).toHaveClass(/timeline-task--compact/);
  await expect(page.locator('.timeline-task[data-mission-id="m6"]')).not.toHaveClass(/timeline-task--(?:compact|ultra)/);
  await expect(page.locator('.timeline-task[data-mission-id="m5"] .task-category')).toBeVisible();
  await expect(page.locator('.timeline-task[data-mission-id="m3"] .task-meta')).toBeHidden();

  const contained = await page.locator('.timeline-task[data-mission-id="m3"], .timeline-task[data-mission-id="m5"]').evaluateAll(cards => cards.every(card => {
    const box = card.getBoundingClientRect();
    return [...card.querySelectorAll('.task-header, .task-emoji, .task-title, .task-btn')].every(element => {
      const rect = element.getBoundingClientRect();
      return rect.top >= box.top && rect.bottom <= box.bottom && rect.left >= box.left && rect.right <= box.right;
    });
  }));
  expect(contained).toBe(true);
});

test('keeps window and timeline scroll positions when a task status changes', async ({ page }) => {
  await renderFixture(page);
  await page.evaluate(() => {
    window.GP_SUPABASE_CONFIG = { url: 'https://example.test', publishableKey: 'test-key' };
    window.supabase = { createClient: () => ({ rpc: async () => ({ error: null }) }) };
    document.body.style.minHeight = '2400px';
    const timeline = document.querySelector('.timeline-scroll');
    const card = document.querySelector('.timeline-task[data-mission-id="m4"]');
    timeline.scrollTop = card.offsetTop - 80;
    window.scrollTo(0, 300);
    window.__statusScrollSnapshot = {
      windowY: window.scrollY,
      timelineY: timeline.scrollTop,
      card,
      sharedCards: [...document.querySelectorAll('.timeline-task[data-mission-id="m1"]')]
    };
  });

  await page.evaluate(async () => {
    const missions = await import('/js/missions.js');
    missions.handleMissionAction('m4', 'fail');
    missions.handleMissionAction('m1', 'done');
    await new Promise(resolve => requestAnimationFrame(resolve));
  });

  const result = await page.evaluate(() => {
    const timeline = document.querySelector('.timeline-scroll');
    const card = document.querySelector('.timeline-task[data-mission-id="m4"]');
    return {
      sameCard: card === window.__statusScrollSnapshot.card,
      windowY: window.scrollY,
      timelineY: timeline.scrollTop,
      expectedWindowY: window.__statusScrollSnapshot.windowY,
      expectedTimelineY: window.__statusScrollSnapshot.timelineY,
      failed: card.classList.contains('fail'),
      activeFail: card.querySelector('.task-fail').classList.contains('active'),
      sharedCardsUpdatedInPlace: [...document.querySelectorAll('.timeline-task[data-mission-id="m1"]')]
        .every((sharedCard, index) => sharedCard === window.__statusScrollSnapshot.sharedCards[index]
          && !sharedCard.classList.contains('done'))
    };
  });
  expect(result.sameCard).toBe(true);
  expect(result.windowY).toBe(result.expectedWindowY);
  expect(result.timelineY).toBe(result.expectedTimelineY);
  expect(result.failed).toBe(true);
  expect(result.activeFail).toBe(true);
  expect(result.sharedCardsUpdatedInPlace).toBe(true);
});

test('desktop starts the progress panel below the header without displacing navigation', async ({ page }) => {
  test.skip((page.viewportSize()?.width || 0) < 768, 'desktop-only layout assertion');
  await renderFixture(page);
  const layout = await page.evaluate(() => {
    const header = document.querySelector('.app-header').getBoundingClientRect();
    const progress = document.querySelector('.progress-box').getBoundingClientRect();
    const navigation = document.querySelector('.tab-bar').getBoundingClientRect();
    return {
      membersDisplay: getComputedStyle(document.querySelector('.members-bar')).display,
      progressGap: progress.top - header.bottom,
      navigationLeft: navigation.left,
      navigationWidth: navigation.width
    };
  });
  expect(layout.membersDisplay).toBe('none');
  expect(layout.progressGap).toBeLessThanOrEqual(24);
  expect(layout.navigationLeft).toBe(0);
  expect(layout.navigationWidth).toBeGreaterThan(200);
});

test('shows independent individual and family progress', async ({ page }) => {
  await renderFixture(page);
  await expect(page.locator('#prog-pct')).toHaveText('44%');
  await expect(page.locator('.individual-progress-row')).toHaveCount(3);
  await expect(page.locator('#header-team-stars')).toHaveText('3');
  await expect(page.locator('#car-avatar')).toBeVisible();
  await expect(page.locator('.finish-line')).toBeVisible();
});

test('keeps the clicked member as primary and restores shared assignees on edit', async ({ page }) => {
  await renderFixture(page);
  await page.evaluate(async () => {
    const actions = await import('/js/quick-actions.js');
    actions.openNewTaskPopup('pai');
  });
  const primary = page.locator('.qa-assignee-checkbox[value="pai"]');
  await expect(primary).toBeChecked();
  await expect(primary).toBeDisabled();
  await expect(page.locator('.qa-assignee-checkbox:checked')).toHaveCount(1);

  await page.evaluate(async () => {
    const [{ state }, actions] = await Promise.all([
      import('/js/state.js'),
      import('/js/quick-actions.js')
    ]);
    actions.openNewTaskPopup('pai', state.missions.find(mission => mission.id === 'm1'));
  });
  await expect(page.locator('.qa-assignee-checkbox:checked')).toHaveCount(2);
  await expect(page.locator('.qa-assignee-checkbox[value="mae"]')).toBeChecked();
  await expect(page.locator('#qa-task-start')).toHaveAttribute('step', '300');
  await expect(page.locator('.qa-assignee-option')).toHaveCount(3);
  await expect(page.locator('#qa-task-category option')).toHaveCount(11);
});

test('expands the timeline to early tasks and labels every five minutes', async ({ page }) => {
  await renderFixture(page);
  await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    const renderer = await import('/js/render.js');
    state.missions.push({
      id: 'm5', title: 'MADRUGADA', emoji: '🌙', start: '04:30', end: '04:35',
      assignee: ['pai'], desc: '[categoria:sono]', schedule: { type: 'once' }
    });
    renderer.renderMissions();
  });
  await expect(page.locator('.timeline-time-label').first()).toHaveText('04:30');
  await expect(page.locator('.timeline-time-label').nth(1)).toHaveText('04:35');
  await expect(page.locator('.timeline-task[data-mission-id="m5"] .task-emoji')).toBeVisible();
  await expect(page.locator('.timeline-task[data-mission-id="m5"]')).toContainText('Sono');
});

test('manages task categories from the parent panel', async ({ page }) => {
  await renderFixture(page);
  await page.evaluate(async ({ members }) => {
    window.GP_SUPABASE_CONFIG = { url: 'https://example.test', publishableKey: 'test-key' };
    window.__taskRows = [{ description: '[categoria:sono]' }];
    window.__settingsPayload = null;
    window.supabase = {
      createClient: () => ({
        rpc: async () => ({ data: 'family-test', error: null }),
        from: table => ({
          select: () => ({
            eq: async () => ({ data: table === 'tasks' ? window.__taskRows : [], error: null })
          }),
          update: payload => {
            window.__settingsPayload = payload;
            return { eq: async () => ({ error: null }) };
          }
        })
      })
    };
    const [{ state, setTaskCategories }, panel] = await Promise.all([
      import('/js/state.js'),
      import('/js/parent-panel.js')
    ]);
    state.config = {
      members,
      pin: '1234',
      requireApproval: false,
      skipParentPanelPin: true,
      teamStarsGoal: 20,
      customGoals: [],
      familyName: 'TESTE',
      taskCategories: [
        { id: 'sono', name: 'Sono', color: '#52627a' },
        { id: 'outros', name: 'Outros', color: '#74777f' }
      ]
    };
    state.weekState = { weekKey: '2026-07-27', days: {}, finalized: false };
    state.badgesUnlocked = [];
    setTaskCategories(state.config.taskCategories);
    panel.wireParentPanelEvents();
    panel.openParentPanelOnTab('categorias');
  }, { members });

  await expect(page.locator('.pp-category-row')).toHaveCount(2);
  await page.locator('#pp-category-name').fill('Musica');
  await page.locator('#pp-category-color').fill('#112233');
  await page.locator('[data-save-category]').click();
  await expect(page.locator('.pp-category-row').filter({ hasText: 'Musica' })).toBeVisible();

  const created = page.locator('.pp-category-row').filter({ hasText: 'Musica' });
  await created.locator('[data-edit-category]').click();
  await page.locator('#pp-category-name').fill('Arte');
  await page.locator('#pp-category-color').fill('#223344');
  await page.locator('[data-save-category]').click();
  await expect(page.locator('.pp-category-row').filter({ hasText: 'Arte' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__settingsPayload.task_categories.find(item => item.id === 'musica')?.color)).toBe('#223344');

  page.once('dialog', async dialog => {
    expect(dialog.message()).toContain('1 tarefa');
    await dialog.dismiss();
  });
  await page.locator('.pp-category-row').filter({ hasText: 'Sono' }).locator('[data-delete-category]').click();
  await expect(page.locator('.pp-category-row').filter({ hasText: 'Sono' })).toBeVisible();

  await page.evaluate(() => { window.__taskRows = []; });
  page.once('dialog', async dialog => { await dialog.accept(); });
  await page.locator('.pp-category-row').filter({ hasText: 'Arte' }).locator('[data-delete-category]').click();
  await expect(page.locator('.pp-category-row').filter({ hasText: 'Arte' })).toHaveCount(0);
});
