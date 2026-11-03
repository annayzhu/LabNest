/** Insert qPCR through the same writing menu used for tables and attachments. */
export async function openQpcrFromSlash(page, label) {
  const paragraph = page.locator('.tiptap p').first();
  await paragraph.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/qpcr');
  await page.getByRole('option', { name: label, exact: true }).click();
}
