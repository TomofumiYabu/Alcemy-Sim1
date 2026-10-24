import { expect, test as base } from '@playwright/test';

export const test = base.extend<{ clientErrors: void }>({
  clientErrors: [async ({ context }, use) => {
    const errors: string[] = [];
    context.on('page', (page) => {
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    });
    await use();
    expect(errors, 'Unexpected browser errors').toEqual([]);
  }, { auto: true }],
});
export { expect };
