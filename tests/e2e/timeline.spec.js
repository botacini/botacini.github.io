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
    return {
      inside: done.top >= box.top && done.bottom <= box.bottom && fail.top >= box.top && fail.bottom <= box.bottom,
      ordered: emoji.top <= title.top && title.top <= done.top,
      equalActions: Math.abs(done.width - fail.width) < 1,
      actionsUseWidth: (done.width + fail.width + 4) / content.width > .9,
      headerAtTop: Math.abs(header.top - box.top) < 2,
      contentCentered: Math.abs((emoji.top + emoji.height / 2) - (content.top + content.height / 2)) < content.height / 2
    };
  }));
  expect(layout.every(card => card.inside && card.ordered && card.equalActions && card.actionsUseWidth && card.headerAtTop && card.contentCentered)).toBe(true);
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
