'use strict';
// Synthetic coding project. The deterministic harness edits this single TODO.
const IMPLEMENTED = true; // SCRIPTED_TASK_SWITCH
function createOrdersHandler(fakeDB) {
  return async function orders(req, res) {
    if (!IMPLEMENTED) return res.status(501).json({ error: 'TASK_NOT_IMPLEMENTED' });
    const status = req.query.status ?? 'paid';
    if (!['paid', 'pending'].includes(status)) return res.status(400).json({ error: 'INVALID_STATUS' });
    const rows = await fakeDB.listOrders(status);
    const orders = rows.filter(row => row.status === status).sort((a, b) => a.id.localeCompare(b.id))
      .map(row => ({ id: row.id, totalCents: row.totalCents }));
    return res.status(200).json({ orders, totalCents: orders.reduce((sum, row) => sum + row.totalCents, 0) });
  };
}
// Genuine Express registration is supplied for a future authorized dependency
// step. The current dry run must report it NOT_RUN when Express is unavailable.
function createExpressApp(express, fakeDB) {
  const app = express(); app.get('/orders', createOrdersHandler(fakeDB)); return app;
}
module.exports = { createOrdersHandler, createExpressApp };
