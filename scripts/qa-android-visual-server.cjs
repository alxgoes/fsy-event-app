'use strict';
// Offline synthetic fixture server. Never forwards requests to the real portal.
const http = require('node:http');
const company = { id: 'qa-company', name: 'Companhia Girassol', color: '#007DA5', youth_count: 24, counselors: [], counselor_profiles: [] };
const overview = { total_youth: 120, youth_with_company: 108, youth_with_room: 108, total_companies: 5, total_counselors: 10, medical_records: 0, total_announcements: 4, total_photos: 0, recent_announcements: [], generated_at: '2027-02-06T09:41:00-03:00' };
const routes = {
  '/api/admin/overview': overview,
  '/api/admin/accounts': { data: [], total: 0, page: 1, per_page: 20 },
  '/api/companies': { companies: [company], all_counselors: [] },
  '/api/schedule': [],
  '/api/admin/registrations': { records: [], batches: [], pagination: { page: 1, pageSize: 25, totalCount: 0, totalPages: 1 }, metrics: {} },
  '/api/medical': [], '/api/appointments': [], '/api/inclusion': [], '/api/logistics': [],
  '/api/media': [], '/api/admin/counselor-audit': [], '/api/announcements': [],
};
http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') { res.statusCode = 405; res.end(JSON.stringify({ error: 'Demonstração visual: alterações desativadas.' })); return; }
  res.end(JSON.stringify(routes[pathname] ?? []));
}).listen(8765, '127.0.0.1', () => process.stdout.write('Synthetic Android visual fixtures ready on 127.0.0.1:8765\n'));
