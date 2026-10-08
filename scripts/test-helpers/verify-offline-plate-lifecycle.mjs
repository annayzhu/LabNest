import assert from 'node:assert/strict';

// Check the legacy download adapter through the canonical plan transaction,
// not merely the existence of its calculation button.
export async function verifyOfflinePlateLifecycle(page) {
  await page.locator('#closeLiquidDrawerButton').click();
  await page.locator('[data-well="A1"]').click();
  await page.locator('[data-plate-calculator="seeding"]').first().click();
  await page.locator('.standalone-appearance-preview summary').click();
  await page.locator('[data-standalone-icon-pack]').focus();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.standalone-appearance-preview').evaluate(node => node.open), false);
  await page.locator('#closeLiquidDrawerButton').click();
  await page.locator('[data-plate-calculator="seeding"]').first().click();
  assert.equal(await page.locator('[name="wells"]').inputValue(), '1', 'Appearance Escape must preserve selected-well scope');
  await page.locator('#closeLiquidDrawerButton').click();
  for (const id of ['seeding', 'hydrogel', 'kill-curve', 'fold-dilution', 'master-mix', 'moi']) {
    await page.locator(`[data-plate-calculator="${id}"]`).first().click();
    await page.locator('[name="pipetteMinimumUl"]').fill('1');
    if (id === 'master-mix') {
      await page.locator('#liquidDrawer [data-liquid-module="reaction"]').click();
      assert.equal(await page.locator('[name="pipetteMinimumUl"]').inputValue(),'1','Active tab must preserve draft');
    }
    await page.locator('#standalonePlateCalculatorForm button[type="submit"]').click();
    await page.locator('[data-plate-result-action="apply"]').click();
    await page.locator('#liquidDrawer').waitFor({state:'hidden'});
    const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('plate-layout-studio:workspace:v2')).plates[0]);
    const before = await read();
    assert.equal(before.liquidPlans.length, 1);
    assert.equal(before.liquidPlans[0].calculatorId, id);
    assert.equal(before.liquidPlans[0].stale, false);
    await page.locator('[data-liquid-plan-action="edit"]').click();
    await page.locator('#standalonePlateCalculatorForm button[type="submit"]').click();
    await page.locator('[data-plate-result-action="apply"]').waitFor();
    await page.locator('#standalonePlateCalculatorForm input:not([readonly])').first().fill('999');
    assert.equal(await page.locator('[data-plate-result-action="apply"]').count(),0);
    await page.locator('#closeLiquidDrawerButton').click();
    assert.deepEqual((await read()).liquidPlans, before.liquidPlans, 'Draft edits must not mutate saved plans');
    await page.locator(`[data-plate-calculator="${id}"]`).first().click();
    await page.locator('#standalonePlateCalculatorForm').waitFor({state:'visible'});
    await page.locator('#closeLiquidDrawerButton').click();
    if (id === 'seeding') {
      // A historical host plan can store non-default units. Values shown by
      // the download form must be converted to its fixed displayed units.
      await page.evaluate(() => {
        const key='plate-layout-studio:workspace:v2',ws=JSON.parse(localStorage.getItem(key));
        Object.assign(ws.plates[0].liquidPlans[0].input,{volumePerWellUl:0.5,volumePerWellUlUnit:'mL'});
        localStorage.setItem(key,JSON.stringify(ws));
      });
      await page.reload({waitUntil:'domcontentloaded'});
      await page.locator('[data-liquid-plan-action="edit"]').click();
      assert(Math.abs(Number(await page.locator('[name="volumePerWellUl"]').inputValue())-500)<1e-9);
      const plates=page.locator('[name="plates"]');
      if(await plates.count()) { assert.equal(await plates.inputValue(),'1');assert(await plates.getAttribute('readonly') !== null); }
      await page.locator('[name="pipetteMinimumUl"]').fill('');
      await page.locator('#standalonePlateCalculatorForm button[type="submit"]').click();
      await page.locator('[data-plate-result-action="apply"]').click();
      await page.locator('#liquidDrawer').waitFor({state:'hidden'});
      const input=(await read()).liquidPlans[0].input;
      assert.equal(input.pipetteMinimumUl,undefined);
      assert(Math.abs(Number(input.volumePerWellUl)-500)<1e-9);
      assert.equal(input.volumePerWellUlUnit,'µL');
    }
  }
}
