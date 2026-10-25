import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
import { verificationFixtures } from './lib/game-fixtures.mjs';
import { verificationOptions } from './lib/verification-options.mjs';

const options = verificationOptions('visual');
const { key, advanced, encode } = await verificationFixtures();
const browser = await chromium.launch({
  executablePath: options.executablePath,
});
const checks = [];
const errors = [];
try {
  for (const [width, height] of [
    [1440, 900],
    [1366, 768],
    [390, 844],
    [320, 740],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      reducedMotion: 'reduce',
    });
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('requestfailed', (request) => errors.push(request.url()));
    await page.addInitScript(
      ({ key, value, origin }) => {
        if (location.origin === origin && !localStorage.getItem(key))
          localStorage.setItem(key, value);
      },
      { key, value: encode(advanced), origin: options.origin },
    );
    await page.clock.install({ time: new Date('2026-10-25T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-25T00:00:01Z'));
    const response = await page.goto(options.url);
    assert.equal(
      await response.text(),
      readFileSync(`${options.dist}/index.html`, 'utf8'),
      'Visual check must use the expected build',
    );
    await expect(page.locator('.save-state')).toContainText(
      /自動保存|保存済み/,
    );
    for (const textSize of ['standard', 'largest']) {
      await page.getByRole('button', { name: '設定', exact: true }).click();
      await page
        .getByLabel('文字の大きさ', { exact: true })
        .selectOption(textSize);
      await page
        .getByRole('button', { name: '設定とヘルプを閉じる', exact: true })
        .click();
      for (const [name, id, title] of [
        ['工房', 'workshop', '錬金術工房'],
        ['冒険者', 'expeditions', '冒険者ギルド'],
        ['在庫・販売', 'inventory', '在庫と販売'],
        ['研究', 'research', '錬金術の研究'],
      ]) {
        await page
          .getByRole('navigation')
          .getByRole('button', { name, exact: true })
          .click();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        );
        assert.equal(overflow, false, `${width}px ${textSize} ${name}`);
        await expect(
          page.getByRole('heading', { name: title, exact: true }),
        ).toBeVisible();
        await page.screenshot({
          path: `${options.output}/${width}-${id}-${textSize}.png`,
        });
        checks.push({
          width,
          height,
          textSize,
          screen: id,
          horizontalOverflow: overflow,
        });
        if (id === 'workshop' && width <= 1000) {
          await page
            .getByRole('button', { name: '調合釜 #1', exact: true })
            .click();
          const sheet = page.getByRole('dialog', {
            name: '設備の詳細',
            exact: true,
          });
          await expect(sheet).toBeVisible();
          const sheetOverflow = await sheet.evaluate(
            (element) => element.scrollWidth > element.clientWidth,
          );
          assert.equal(
            sheetOverflow,
            false,
            `${width}px ${textSize} equipment sheet`,
          );
          await sheet.screenshot({
            path: `${options.output}/${width}-sheet-${textSize}.png`,
          });
          await sheet
            .getByRole('button', { name: '自動合成を開始', exact: true })
            .scrollIntoViewIfNeeded();
          await page.keyboard.press('Escape');
          await expect(
            page.getByRole('button', { name: '調合釜 #1', exact: true }),
          ).toBeFocused();
          checks.push({
            width,
            height,
            textSize,
            screen: 'equipment-sheet',
            horizontalOverflow: sheetOverflow,
          });
        }
      }
    }
    await page.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    `${options.output}/result.json`,
    JSON.stringify(
      {
        commit: options.commit,
        workingTreeDirty: options.workingTreeDirty,
        url: options.url,
        browser: browser.version(),
        checks,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ screens: checks.length, errors }));
} finally {
  await browser.close();
}
