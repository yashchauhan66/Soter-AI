'use strict';
// Fixture-only selection from exact shipped contributions. No host/API action.
const assert=require('node:assert/strict');
const VIEWS=['soterai-protected-items','soterai-protection-activity','soterai-protection-coverage'];
function paletteQueries(manifest){
 const c=manifest?.contributes;assert(c&&Array.isArray(c.commands)&&Array.isArray(c.menus?.commandPalette));
 const commands=c.commands.filter(row=>row.command==='soterai.openControlPanel');assert.equal(commands.length,1,'unique public command required');
 const open=commands[0];assert.equal(open.category,'SoterAI');assert.equal(open.title,'Open Control Panel');
 assert.equal(c.menus.commandPalette.filter(row=>row.command===open.command).length,0,'visible public entry without conditional menu overrides required');
 const containers=c.viewsContainers?.activitybar?.filter(row=>row.id==='soterai-explorer');assert.equal(containers?.length,1,'exact native view container required');
 const title=containers[0].title;assert(typeof title==='string'&&title.length>0&&title.length<80&&!/[\u0000-\u001f]/.test(title));
 const focus=VIEWS.map(id=>{const rows=c.views?.['soterai-explorer']?.filter(row=>row.id===id);assert.equal(rows?.length,1,'exact native view required');assert.equal(rows[0].when,'soterai.protectionCenter');assert(typeof rows[0].name==='string'&&rows[0].name.length<80);return title+': Focus on '+rows[0].name+' View';});
 return Object.freeze({open:open.category+': '+open.title,focus:Object.freeze(focus)});
}
module.exports={paletteQueries};
