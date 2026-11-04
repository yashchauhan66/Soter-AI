'use strict';
// Actual locally installed NextRequest/NextResponse APIs, no Next server/build.
const { NextResponse } = require('next/server');
const IMPLEMENTED = false; // SCRIPTED_TASK_SWITCH
function createGET(fakeAPI) {
  return async function GET(request) {
    if (!IMPLEMENTED) return NextResponse.json({ error: 'TASK_NOT_IMPLEMENTED' }, { status: 501 });
    const category = request.nextUrl.searchParams.get('category') ?? 'public';
    if (!['public', 'featured'].includes(category)) return NextResponse.json({ error: 'INVALID_CATEGORY' }, { status: 400 });
    const rows = await fakeAPI.listProducts(category);
    const products = rows.filter(row => row.category === category).sort((a, b) => a.id.localeCompare(b.id))
      .map(row => ({ id: row.id, title: row.title, priceCents: row.priceCents }));
    return NextResponse.json({ products, count: products.length });
  };
}
module.exports = { createGET };
