#!/usr/bin/env node
/**
 * KilaCombs Full-Service API
 * Wholesale · Personal Training (NYC & Online) · Nutrition · Merch · Workout Plans
 * Excel sync via xlsx npm package — no Python needed
 * Deploy: Railway / Render / any Node host
 * Local:  node server.js → http://localhost:3000
 */

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const PORT      = process.env.PORT || 3000;
const DB_FILE   = path.join(__dirname, 'data', 'kilacombs-db.json');
const XLSX_FILE = path.join(__dirname, 'data', 'kilacombs_datasheet.xlsx');
const PUBLIC    = path.join(__dirname, 'public');

// Ensure data dir exists
if (!fs.existsSync(path.join(__dirname, 'data')))
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

// ── XLSX (lazy-load so server starts even before npm install on cold boot) ────
let XLSX = null;
function getXLSX() {
  if (!XLSX) { try { XLSX = require('xlsx'); } catch { XLSX = null; } }
  return XLSX;
}

// ── DB ─────────────────────────────────────────────────────────────────────────
function loadDB() {
  if (fs.existsSync(DB_FILE)) {
    try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch {}
  }
  return {
    orders: [], email_signups: [],
    training_bookings: [], nutrition_orders: [],
    merch_orders: [], workout_plan_orders: [],
    neurotrack_orders: [],
    discount_codes: []
  };
}
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
function uid(prefix = '') {
  return prefix + crypto.randomBytes(8).toString('hex').toUpperCase();
}

let db = loadDB();
['training_bookings','nutrition_orders','merch_orders','workout_plan_orders','neurotrack_orders']
  .forEach(k => { if (!db[k]) db[k] = []; });

db.discount_codes = [
  { code:'SCHOOL15',    category:'school',  value:15, active:true, label:'School Program'      },
  { code:'YOUTHFUEL',   category:'school',  value:15, active:true, label:'Youth Fuel'          },
  { code:'MILITARY20',  category:'veteran', value:20, active:true, label:'Active Military'     },
  { code:'VETERAN20',   category:'veteran', value:20, active:true, label:'Veteran Program'     },
  { code:'KIDS15',      category:'kids',    value:15, active:true, label:'Youth Sports'        },
  { code:'AFTERSCHOOL', category:'kids',    value:15, active:true, label:'After-School'        },
  { code:'NEWYEAR10',   category:'holiday', value:10, active:true, label:'New Year'            },
  { code:'JULY4TH',     category:'holiday', value:10, active:true, label:'July 4th'            },
  { code:'BFCM10',      category:'holiday', value:10, active:true, label:'Black Friday'        },
  { code:'HOLIDAY10',   category:'holiday', value:10, active:true, label:'Holiday Season'      },
];
saveDB(db);

// ── EXCEL SYNC (pure Node / xlsx) ─────────────────────────────────────────────
const STATUS_FILLS = {
  pending_review: 'E67E22', confirmed: '2980B9', paid: '27AE60',
  shipped: '8E44AD', delivered: '16A085', cancelled: 'E74C3C'
};

function xlsxCell(ws, addr, val, opts = {}) {
  const cell = { v: val, t: typeof val === 'number' ? 'n' : 's' };
  if (opts.fmt)   cell.z = opts.fmt;
  if (opts.bold || opts.bg || opts.color) {
    cell.s = {
      font:      { name: 'Arial', sz: opts.sz || 10, bold: !!opts.bold, color: { rgb: opts.color || 'F5F0E8' } },
      fill:      opts.bg ? { fgColor: { rgb: opts.bg }, patternType: 'solid' } : undefined,
      alignment: { horizontal: opts.h || 'left', vertical: 'center', wrapText: !!opts.wrap },
      border:    { top:{style:'thin',color:{rgb:'2A2A2A'}}, bottom:{style:'thin',color:{rgb:'2A2A2A'}},
                   left:{style:'thin',color:{rgb:'2A2A2A'}}, right:{style:'thin',color:{rgb:'2A2A2A'}} }
    };
  }
  ws[addr] = cell;
}

function writeOrderToExcel(orderData) {
  const X = getXLSX();
  if (!X) { console.warn('[Excel] xlsx not installed — skipping'); return false; }

  try {
    let wb;
    if (fs.existsSync(XLSX_FILE)) {
      const buf = fs.readFileSync(XLSX_FILE);
      wb = X.read(buf, { type: 'buffer', cellStyles: true });
    } else {
      wb = X.utils.book_new();
    }

    const sheetName = 'Orders';
    if (!wb.SheetNames.includes(sheetName)) {
      const ws = {};
      // Header row
      const headers = ['Order ID','Date','Name','Email','Phone','Business','Biz Type','Buyer Type',
                       'City','State','Items','Qty','Subtotal','Disc Code','Disc %','Disc Amt','Total','Status','Notes'];
      headers.forEach((h, i) => {
        const addr = X.utils.encode_cell({ r: 0, c: i });
        ws[addr] = { v: h, t: 's', s: { font:{name:'Arial',sz:9,bold:true,color:{rgb:'0A0A0A'}}, fill:{fgColor:{rgb:'C8840A'},patternType:'solid'}, alignment:{horizontal:'center',vertical:'center'} } };
      });
      ws['!ref'] = X.utils.encode_range({ s:{r:0,c:0}, e:{r:0,c:headers.length-1} });
      ws['!cols'] = [22,18,20,28,16,26,24,18,14,7,30,10,13,12,8,13,13,16,30].map(w=>({wch:w}));
      X.utils.book_append_sheet(wb, ws, sheetName);
    }

    const ws  = wb.Sheets[sheetName];
    const ref = X.utils.decode_range(ws['!ref'] || 'A1:S1');
    const row = ref.e.r + 1; // next empty row (0-indexed)

    const {
      id='', date='', name='', email='', phone='', biz='', biz_type='',
      buyer_type='', city='', state='', variant_name='', qty=0,
      subtotal=0, code='', dpct=0, damt=0, total=0, status='pending_review', notes=''
    } = orderData;

    const bg = row % 2 === 0 ? '1A1A1A' : '222222';
    const vals = [id,date,name,email,phone,biz,biz_type,buyer_type,city,state,variant_name,qty,subtotal,code||'—',dpct/100||0,damt,total,status.replace(/_/g,' '),notes];
    const fmts = [null,null,null,null,null,null,null,null,null,null,null,'#,##0','$#,##0.00',null,'0%','$#,##0.00','$#,##0.00',null,null];
    const fgs  = [null,null,null,null,null,null,null,null,null,null,'FFD06B',null,'FFD06B',null,null,null,'FFD06B',null,null];

    vals.forEach((v, c) => {
      const addr = X.utils.encode_cell({ r: row, c });
      const isStatus = c === 17;
      const statusBg = isStatus ? (STATUS_FILLS[status] || '888888') : bg;
      ws[addr] = {
        v, t: typeof v === 'number' ? 'n' : 's',
        z: fmts[c] || undefined,
        s: {
          font: { name:'Arial', sz:10, bold: isStatus || c===0, color:{ rgb: isStatus ? '000000' : (fgs[c]||'F5F0E8') } },
          fill: { fgColor:{ rgb: statusBg }, patternType:'solid' },
          alignment: { horizontal: [11,12,14,15,16,17].includes(c)?'center':'left', vertical:'center' },
          border: { top:{style:'thin',color:{rgb:'2A2A2A'}}, bottom:{style:'thin',color:{rgb:'2A2A2A'}},
                    left:{style:'thin',color:{rgb:'2A2A2A'}}, right:{style:'thin',color:{rgb:'2A2A2A'}} }
        }
      };
    });

    // Update sheet ref
    ws['!ref'] = X.utils.encode_range({ s:{r:0,c:0}, e:{r:row,c:18} });
    if (!ws['!cols']) ws['!cols'] = [22,18,20,28,16,26,24,18,14,7,30,10,13,12,8,13,13,16,30].map(w=>({wch:w}));

    // Write Signups sheet placeholder if missing
    if (!wb.SheetNames.includes('Signups')) {
      const ws2 = X.utils.aoa_to_sheet([['Email','Source','Date','Buyer Type','Status']]);
      X.utils.book_append_sheet(wb, ws2, 'Signups');
    }

    const buf = X.write(wb, { type:'buffer', bookType:'xlsx', cellStyles:true });
    fs.writeFileSync(XLSX_FILE, buf);
    console.log(`[Excel] Order ${id} → row ${row + 1}`);
    return true;
  } catch (err) {
    console.error('[Excel] write error:', err.message);
    return false;
  }
}

function writeSignupToExcel(email, source, buyerType) {
  const X = getXLSX();
  if (!X) return false;
  try {
    let wb;
    if (fs.existsSync(XLSX_FILE)) {
      wb = X.read(fs.readFileSync(XLSX_FILE), { type:'buffer', cellStyles:true });
    } else {
      wb = X.utils.book_new();
    }
    if (!wb.SheetNames.includes('Signups')) {
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['Email','Source','Date','Buyer Type','Status']]), 'Signups');
    }
    const ws  = wb.Sheets['Signups'];
    const ref = X.utils.decode_range(ws['!ref'] || 'A1:E1');
    const row = ref.e.r + 1;
    const now = new Date().toISOString().slice(0,16).replace('T',' ');
    [email, source||'Website', now, buyerType||'', 'Active'].forEach((v, c) => {
      ws[X.utils.encode_cell({r:row,c})] = { v, t:'s' };
    });
    ws['!ref'] = X.utils.encode_range({s:{r:0,c:0},e:{r:row,c:4}});
    fs.writeFileSync(XLSX_FILE, X.write(wb,{type:'buffer',bookType:'xlsx',cellStyles:true}));
    return true;
  } catch (err) {
    console.error('[Excel] signup error:', err.message);
    return false;
  }
}

function readExcelStats() {
  const X = getXLSX();
  if (!X || !fs.existsSync(XLSX_FILE)) return null;
  try {
    const wb = X.read(fs.readFileSync(XLSX_FILE),{type:'buffer',cellStyles:true});
    const ws = wb.Sheets['Orders'];
    if (!ws) return null;
    const rows = X.utils.sheet_to_json(ws, { defval:'' });
    const paid = ['paid','shipped','delivered'];
    const revenue = rows.filter(r=>paid.includes((r['Status']||'').toLowerCase().replace(/ /g,'_'))).reduce((s,r)=>s+(parseFloat(r['Total'])||0),0);
    const ws2  = wb.Sheets['Signups'];
    const sigs = ws2 ? X.utils.sheet_to_json(ws2).length : 0;
    return {
      total_orders: rows.length,
      pending:      rows.filter(r=>r['Status']==='pending review').length,
      paid_shipped: rows.filter(r=>paid.includes((r['Status']||'').toLowerCase().replace(/ /g,'_'))).length,
      cancelled:    rows.filter(r=>r['Status']==='cancelled').length,
      revenue:      Math.round(revenue*100)/100,
      email_signups: sigs,
      avg_order:    rows.length ? Math.round(revenue/rows.length*100)/100 : 0
    };
  } catch (err) {
    console.error('[Excel] stats error:', err.message);
    return null;
  }
}

// ── HTTP helpers ───────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function respond(res, data, status=200) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, { 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(body), ...CORS });
  res.end(body);
}

function readBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 5e6) req.destroy(); });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

const MIME = {
  '.html':'text/html', '.css':'text/css', '.js':'application/javascript',
  '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg',
  '.svg':'image/svg+xml', '.ico':'image/x-icon',
  '.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

function serveStatic(res, fp) {
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ct = MIME[path.extname(fp)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type':ct, 'Cache-Control':'no-cache' });
    res.end(data);
  });
}

// ── ROUTER ─────────────────────────────────────────────────────────────────────
async function router(req, res) {
  const url  = new URL(req.url, `http://localhost:${PORT}`);
  const p    = url.pathname.replace(/\/$/, '') || '/';
  const meth = req.method.toUpperCase();

  if (meth === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }

  // ── Health ───────────────────────────────────────────────────────────────────
  if (meth==='GET' && p==='/api/health') {
    return respond(res, {
      status:'ok', service:'KilaCombs API', version:'2.0',
      xlsx_installed: !!getXLSX(), xlsx_file: fs.existsSync(XLSX_FILE),
      orders: db.orders.length, signups: db.email_signups.length,
      training: db.training_bookings.length, merch: db.merch_orders.length,
      neurotrack: db.neurotrack_orders.length,
      timestamp: new Date().toISOString()
    });
  }

  // ── Discount validate ────────────────────────────────────────────────────────
  if (meth==='POST' && p==='/api/discounts/validate') {
    const {code,qty} = await readBody(req);
    const d = db.discount_codes.find(x=>x.code===code?.toUpperCase()&&x.active);
    if (!d) return respond(res,{success:false,error:'Invalid or expired code'},404);
    const sub = (qty||500)*3;
    return respond(res,{success:true,code:d.code,label:d.label,category:d.category,value:d.value,savings:(sub*d.value/100).toFixed(2)});
  }

  if (meth==='GET' && p==='/api/discounts') {
    const g = {};
    db.discount_codes.filter(d=>d.active).forEach(d=>{ if(!g[d.category]) g[d.category]=[]; g[d.category].push({code:d.code,value:d.value,label:d.label}); });
    return respond(res,{success:true,discounts:g});
  }

  // ── POST /api/orders/full — unified cart checkout ────────────────────────────
  if (meth==='POST' && p==='/api/orders/full') {
    const body = await readBody(req);
    const {contact,business,cart,discount,subtotal,discount_amount,total,notes,wholesale,training,nutrition,workout,merch,neurotrack} = body;

    if (!contact?.email || !contact?.name || !contact?.phone)
      return respond(res,{success:false,error:'contact.email, name, phone required'},400);
    if (!cart?.length)
      return respond(res,{success:false,error:'Cart is empty'},400);

    const orderId = 'KC-' + uid();
    const now = new Date().toISOString().slice(0,16).replace('T',' ');

    const newOrder = {
      id:orderId, status:'pending_review', created_at:now,
      contact:{name:contact.name,email:contact.email,phone:contact.phone},
      business:business||{}, cart, discount,
      subtotal:subtotal||0, discount_amount:discount_amount||0, total:total||subtotal||0,
      notes:notes||'',
      types: {
        wholesale:   !!(wholesale?.length),
        training:    !!(training?.length),
        nutrition:   !!(nutrition?.length),
        workout:     !!(workout?.length),
        merch:       !!(merch?.length),
        neurotrack:  !!(neurotrack?.length),
      }
    };

    db.orders.push(newOrder);
    if (training?.length)   db.training_bookings.push({orderId,contact,items:training,created_at:now});
    if (nutrition?.length)  db.nutrition_orders.push({orderId,contact,items:nutrition,created_at:now});
    if (merch?.length)      db.merch_orders.push({orderId,contact,items:merch,created_at:now});
    if (workout?.length)    db.workout_plan_orders.push({orderId,contact,items:workout,created_at:now});
    if (neurotrack?.length) db.neurotrack_orders.push({orderId,contact,items:neurotrack,created_at:now});
    saveDB(db);

    // Build notes summary
    const noteLines = [notes||''];
    if (training?.length)   noteLines.push('Training: '+training.map(t=>t.name).join(', '));
    if (nutrition?.length)  noteLines.push('Nutrition: '+nutrition.map(n=>n.name).join(', '));
    if (workout?.length)    noteLines.push('Plans: '+workout.map(w=>w.name).join(', '));
    if (merch?.length)      noteLines.push('Merch: '+merch.map(m=>m.name).join(', '));
    if (neurotrack?.length) noteLines.push('NeuroTrack: '+neurotrack.map(n=>n.name).join(', '));
    const noteStr = noteLines.filter(Boolean).join(' | ').substring(0,200);

    const itemSummary = cart.map(c=>`${c.name}(${c.qty}x$${c.price})`).join(' | ');
    const types = [...new Set(cart.map(c=>c.type))].join('+');

    // Write to Excel async
    setImmediate(() => {
      writeOrderToExcel({
        id:orderId, date:now, name:contact.name, email:contact.email, phone:contact.phone,
        biz:business?.name||'', biz_type:business?.type||'',
        buyer_type:types,
        city:business?.city||'', state:business?.state||'',
        variant_name: itemSummary.substring(0,80),
        qty: cart.reduce((s,c)=>s+c.qty,0),
        subtotal:subtotal||0, code:discount?.code||'',
        dpct:discount?.pct||0, damt:discount_amount||0,
        total:total||subtotal||0, status:'pending_review', notes:noteStr
      });
    });

    return respond(res,{
      success:true, order_id:orderId, status:'pending_review',
      message:'Order received! We will contact you within 24 hours.',
      excel_sync: getXLSX()?'queued':'xlsx not installed (run npm install)',
      summary:{items:cart.length,subtotal,discount_amount,total}
    },201);
  }

  // ── POST /api/orders — legacy wholesale-only ─────────────────────────────────
  if (meth==='POST' && p==='/api/orders') {
    const body = await readBody(req);
    const {contact,business,order,notes,buyer_type} = body;
    if (!contact?.email||!contact?.name||!contact?.phone)
      return respond(res,{success:false,error:'contact required'},400);
    const vmap = {original:'Original Honey Blend',ginger:'Ginger Boost',bvitamin:'B-Vitamin Surge'};
    const qty  = parseInt(order?.qty)||500;
    const dCode = order?.discount_code?.toUpperCase();
    const disc  = db.discount_codes.find(d=>d.code===dCode&&d.active);
    const sub   = qty*3; const discAmt=disc?sub*(disc.value/100):0; const tot=sub-discAmt;
    const orderId='KC-WS-'+uid();
    const now=new Date().toISOString().slice(0,16).replace('T',' ');
    db.orders.push({id:orderId,status:'pending_review',created_at:now,contact,business,order:{...order,subtotal:sub,discount_amount:discAmt,total:tot},notes:notes||''});
    saveDB(db);
    setImmediate(()=>writeOrderToExcel({id:orderId,date:now,name:contact.name,email:contact.email,phone:contact.phone,biz:business?.name||'',biz_type:business?.type||'',buyer_type:buyer_type||'wholesale',city:business?.city||'',state:business?.state||'',variant_name:vmap[order?.variant]||order?.variant||'',qty,subtotal:sub,code:dCode||'',dpct:disc?.value||0,damt:discAmt,total:tot,status:'pending_review',notes:notes||''}));
    return respond(res,{success:true,order_id:orderId,message:'Wholesale order received.',summary:{qty:qty+' packs',total:'$'+tot.toFixed(2)}},201);
  }

  // ── Order lookup ─────────────────────────────────────────────────────────────
  const om = p.match(/^\/api\/orders\/([A-Z0-9-]+)$/);
  if (meth==='GET' && om) {
    const o=db.orders.find(x=>x.id===om[1]);
    return o ? respond(res,{success:true,order:o}) : respond(res,{success:false,error:'Not found'},404);
  }

  // ── Status update ────────────────────────────────────────────────────────────
  const sm = p.match(/^\/api\/orders\/([A-Z0-9-]+)\/status$/);
  if (meth==='PATCH' && sm) {
    const {status}=await readBody(req);
    const valid=['pending_review','confirmed','paid','shipped','delivered','cancelled'];
    if (!valid.includes(status)) return respond(res,{success:false,error:'Invalid status'},400);
    const o=db.orders.find(x=>x.id===sm[1]);
    if (!o) return respond(res,{success:false,error:'Not found'},404);
    o.status=status; o.updated_at=new Date().toISOString(); saveDB(db);
    return respond(res,{success:true,order_id:o.id,status});
  }

  // ── Signups ──────────────────────────────────────────────────────────────────
  if (meth==='POST' && p==='/api/signups') {
    const {email,source,buyer_type}=await readBody(req);
    if (!email?.includes('@')) return respond(res,{success:false,error:'Valid email required'},400);
    const norm=email.toLowerCase().trim();
    if (db.email_signups.find(s=>s.email===norm))
      return respond(res,{success:true,message:"You're already on the list!"});
    db.email_signups.push({id:uid('SU-'),email:norm,source:source||'website',buyer_type:buyer_type||'',created_at:new Date().toISOString()});
    saveDB(db);
    setImmediate(()=>writeSignupToExcel(norm,source,buyer_type));
    return respond(res,{success:true,message:"You're on the list! Welcome to KilaCombs."},201);
  }

  // ── Excel stats ──────────────────────────────────────────────────────────────
  if (meth==='GET' && p==='/api/excel/stats') {
    const stats = readExcelStats();
    if (!stats) {
      // Fall back to DB stats
      const paid=['paid','shipped','delivered'];
      const paidOrders=db.orders.filter(o=>paid.includes(o.status));
      return respond(res,{success:true,source:'db',stats:{
        total_orders:db.orders.length,
        pending:db.orders.filter(o=>o.status==='pending_review').length,
        paid_shipped:paidOrders.length,
        cancelled:db.orders.filter(o=>o.status==='cancelled').length,
        revenue:paidOrders.reduce((s,o)=>s+(o.total||o.order?.total||0),0),
        email_signups:db.email_signups.length,
        avg_order: paidOrders.length ? paidOrders.reduce((s,o)=>s+(o.total||0),0)/paidOrders.length : 0
      }});
    }
    return respond(res,{success:true,source:'excel',stats});
  }

  // ── Excel download ───────────────────────────────────────────────────────────
  if (meth==='GET' && p==='/api/excel/download') {
    if (!fs.existsSync(XLSX_FILE)) return respond(res,{success:false,error:'Datasheet not found. Place an order first.'},404);
    const data=fs.readFileSync(XLSX_FILE);
    const fname=`KilaCombs_Data_${new Date().toISOString().slice(0,10)}.xlsx`;
    res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="${fname}"`,'Content-Length':data.length,...CORS});
    return res.end(data);
  }

  // ── Admin stats ──────────────────────────────────────────────────────────────
  if (meth==='GET' && p==='/api/admin/stats') {
    const paid=db.orders.filter(o=>['paid','shipped','delivered'].includes(o.status));
    const pending=db.orders.filter(o=>o.status==='pending_review');
    return respond(res,{success:true,stats:{
      total_orders:db.orders.length, pending:pending.length, paid_shipped:paid.length,
      revenue:'$'+paid.reduce((s,o)=>s+(o.total||0),0).toFixed(2),
      training:db.training_bookings.length, nutrition:db.nutrition_orders.length,
      merch:db.merch_orders.length, workout:db.workout_plan_orders.length,
      neurotrack:db.neurotrack_orders.length,
      signups:db.email_signups.length, xlsx:fs.existsSync(XLSX_FILE),
      recent:db.orders.slice(-10).reverse().map(o=>({id:o.id,status:o.status,name:o.contact?.name,total:'$'+(o.total||0).toFixed(2),date:o.created_at,types:o.types}))
    }});
  }

  // ── Static files ─────────────────────────────────────────────────────────────
  if (meth==='GET') {
    // Root → serve shop
    if (p==='/'||p===''||p==='/index.html') {
      const fp=path.join(PUBLIC,'shop.html');
      if (fs.existsSync(fp)) return serveStatic(res,fp);
    }
    const fp = path.join(PUBLIC, p==='/'?'shop.html':p.slice(1));
    if (fs.existsSync(fp)&&fs.statSync(fp).isFile()) return serveStatic(res,fp);
  }

  respond(res,{success:false,error:`Not found: ${meth} ${p}`},404);
}

const server = http.createServer(async (req,res) => {
  try { await router(req,res); }
  catch(err) { console.error('[Error]',err); respond(res,{success:false,error:'Internal error'},500); }
});

server.listen(PORT, ()=>{
  const xlsxReady = !!getXLSX();
  const xlsxFile  = fs.existsSync(XLSX_FILE);
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║   KilaCombs Full-Service API  🍯  NYC                        ║
║   http://localhost:${PORT}                                      ║
╚═══════════════════════════════════════════════════════════════╝

  xlsx npm:   ${xlsxReady?'✅ Installed':'❌ Run: npm install'}
  Excel file: ${xlsxFile ?'✅ Found':'📄 Will be created on first order'}

  Endpoints:
  ├─ GET    /                      → shop.html
  ├─ GET    /api/health
  ├─ GET    /api/discounts
  ├─ POST   /api/orders/full       → Unified checkout → Excel
  ├─ POST   /api/orders            → Wholesale legacy → Excel
  ├─ POST   /api/signups           → Email list → Excel
  ├─ GET    /api/excel/stats       → Live stats (Excel or DB fallback)
  ├─ GET    /api/excel/download    → Download live xlsx
  └─ GET    /api/admin/stats       → Full admin breakdown

  Every order instantly written to: data/kilacombs_datasheet.xlsx
  `);
});
