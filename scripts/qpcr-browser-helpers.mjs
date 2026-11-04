/** Insert qPCR through the same writing menu used for tables and attachments. */
export async function openQpcrFromSlash(page, label) {
  const paragraph = page.locator('.tiptap p').first();
  await paragraph.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/qpcr');
  await page.getByRole('option', { name: new RegExp(`^${label}`) }).click();
}

/** These checks read the Chinese interface; the tools follow the record's language. */
export async function useChineseInterface(context, base) {
  await context.addCookies([{ name: 'labnest_locale', value: 'zh', url: base }]);
  await context.addInitScript(() => localStorage.setItem('labnest.locale', 'zh'));
}
