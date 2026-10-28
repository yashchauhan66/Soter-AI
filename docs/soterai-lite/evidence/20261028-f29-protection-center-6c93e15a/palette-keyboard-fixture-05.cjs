'use strict';
// Evidence helper only. Observe focus before sending real keys; never set DOM
// values/focus or click an element. The actual full typed query must match.
const assert=require('node:assert/strict');
async function typePaletteQuery(page,query,until){
 assert(typeof query==='string'&&query.length>0&&query.length<=120&&!/[\u0000-\u001f\u007f]/.test(query));
 const input=page.locator('.quick-input-widget input');
 await until(async()=>await input.isVisible()&&await input.evaluate(element=>element===element.ownerDocument.activeElement),8000,'Actual command input is not visible and focused before typing');
 await page.keyboard.press('Control+A');
 await page.keyboard.type('>'+query,{delay:5});
 await until(async()=>await input.inputValue()==='>'+query,8000,'Actual complete command input differs from requested query; refusing Enter');
}
module.exports={typePaletteQuery};
