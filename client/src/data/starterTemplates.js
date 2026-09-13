const wrap = (accentColor, containerBg, inner) =>
  `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:20px;background:#f4f4f8;font-family:Arial,Helvetica,sans-serif}a{color:${accentColor}}@media(max-width:600px){.col{display:block!important;width:100%!important;padding:0 0 12px!important}}</style></head><body><div style="max-width:600px;margin:0 auto;background:${containerBg};border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10)">${inner}</div></body></html>`;

const btn = (text, url, bg, color = '#fff', radius = 8) =>
  `<a href="${url}" style="display:inline-block;background:${bg};color:${color};padding:14px 36px;border-radius:${radius}px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:.06em;font-family:Arial,sans-serif">${text}</a>`;

const hero = (bg, title, sub, cta, ctaUrl, ctaColor = '#fff') =>
  `<div style="background:${bg};padding:56px 40px;text-align:center"><h1 style="margin:0 0 14px;color:#fff;font-size:32px;font-weight:800;line-height:1.2;font-family:Arial,sans-serif">${title}</h1><p style="margin:0 0 28px;color:rgba(255,255,255,.88);font-size:16px;line-height:1.7;font-family:Arial,sans-serif">${sub}</p>${btn(cta, ctaUrl, ctaColor, bg)}</div>`;

const section = (bg, inner, pad = '32px 40px') =>
  `<div style="background:${bg};padding:${pad}">${inner}</div>`;

const footer = (company = 'Your Company', color = '#9ca3af') =>
  `<div style="background:#f9fafb;padding:28px 40px;text-align:center"><p style="margin:0 0 6px;font-size:12px;color:${color};font-family:Arial">© ${new Date().getFullYear()} ${company}. All rights reserved.</p><p style="margin:0;font-size:11px;color:${color};font-family:Arial">You received this email because you subscribed. <a href="{{unsubscribe_url}}" style="color:${color};text-decoration:underline">Unsubscribe</a></p></div>`;

/* ═══════════════════════════════════════════════
   10 CATEGORIES × 2 TEMPLATES = 20 TOTAL
═══════════════════════════════════════════════ */
export const STARTER_TEMPLATES = [

  /* ── 1. E-COMMERCE ─────────────────────────────── */
  {
    category: 'E-Commerce',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>',
    accent: '#f97316',
    templates: [
      {
        name: 'Flash Sale Alert',
        subject: '⚡ 48-Hour Flash Sale — Up to 60% Off!',
        html_content: wrap('#fff7ed', '#ffffff',
          hero('linear-gradient(135deg,#f97316,#ea580c)',
            '⚡ 48-Hour Flash Sale',
            'Don\'t miss our biggest sale of the year. Save up to 60% on thousands of products.',
            'SHOP NOW →', '#', '#ffffff') +
          section('#fff7ed',
            `<p style="margin:0 0 20px;font-size:15px;color:#374151;font-family:Arial;text-align:center;font-weight:700">🔥 Top Deals Ending Soon</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td class="col" width="33%" style="padding:0 8px 0 0;vertical-align:top;text-align:center">
                <div style="background:#fff;border-radius:12px;padding:20px;border:1px solid #fed7aa">
                  <div style="font-size:28px;margin-bottom:8px">👟</div>
                  <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#111827;font-family:Arial">Sneakers</p>
                  <p style="margin:0;font-size:20px;font-weight:800;color:#f97316;font-family:Arial">40% OFF</p>
                </div>
              </td>
              <td class="col" width="33%" style="padding:0 4px;vertical-align:top;text-align:center">
                <div style="background:#fff;border-radius:12px;padding:20px;border:1px solid #fed7aa">
                  <div style="font-size:28px;margin-bottom:8px">💻</div>
                  <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#111827;font-family:Arial">Electronics</p>
                  <p style="margin:0;font-size:20px;font-weight:800;color:#f97316;font-family:Arial">60% OFF</p>
                </div>
              </td>
              <td class="col" width="33%" style="padding:0 0 0 8px;vertical-align:top;text-align:center">
                <div style="background:#fff;border-radius:12px;padding:20px;border:1px solid #fed7aa">
                  <div style="font-size:28px;margin-bottom:8px">🎒</div>
                  <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#111827;font-family:Arial">Bags</p>
                  <p style="margin:0;font-size:20px;font-weight:800;color:#f97316;font-family:Arial">50% OFF</p>
                </div>
              </td>
            </tr></table>`) +
          section('#ffffff',
            `<p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-align:center;text-transform:uppercase;letter-spacing:.1em;font-family:Arial">Sale ends in</p>
            <p style="margin:0 0 24px;font-size:36px;font-weight:800;color:#f97316;text-align:center;letter-spacing:.05em;font-family:Arial">48:00:00</p>
            <div style="text-align:center">${btn('CLAIM YOUR DISCOUNT', '#', '#f97316')}</div>`) +
          footer('ShopZone')
        ),
      },
      {
        name: 'New Arrival Launch',
        subject: '🆕 Just Dropped: Our New Collection is Here',
        html_content: wrap('#ffffff', '#ffffff',
          `<div style="background:#111827;padding:24px 40px;text-align:center"><p style="margin:0;font-size:13px;font-weight:800;color:#f97316;letter-spacing:.2em;text-transform:uppercase;font-family:Arial">ShopZone</p></div>` +
          section('#ffffff',
            `<h1 style="margin:0 0 12px;font-size:36px;font-weight:800;color:#111827;font-family:Arial;line-height:1.15">New Season.<br>New You.</h1>
            <p style="margin:0 0 28px;font-size:16px;color:#6b7280;line-height:1.7;font-family:Arial">Introducing our Spring/Summer collection — thoughtfully designed for the modern lifestyle. Fresh styles, premium quality.</p>
            <img src="https://placehold.co/520x240/f97316/ffffff?text=New+Collection" alt="New Collection" style="width:100%;border-radius:12px;display:block;margin-bottom:28px"/>
            <div style="text-align:center">${btn('EXPLORE COLLECTION', '#', '#f97316')}</div>`, '40px 40px 36px') +
          section('#fff7ed',
            `<p style="margin:0 0 16px;font-size:11px;font-weight:700;color:#f97316;text-transform:uppercase;letter-spacing:.15em;font-family:Arial">Why You\'ll Love It</p>
            ${['Free shipping on orders over $50','Easy 30-day returns','New styles added weekly'].map(t => `<p style="margin:0 0 10px;font-size:14px;color:#374151;font-family:Arial">✓ &nbsp;${t}</p>`).join('')}
            `) +
          footer('ShopZone')
        ),
      },
    ],
  },

  /* ── 2. SAAS / TECH ─────────────────────────────── */
  {
    category: 'SaaS & Tech',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>',
    accent: '#8b5cf6',
    templates: [
      {
        name: 'Welcome & Onboarding',
        subject: 'Welcome to {{first_name}} — Let\'s get you started 🚀',
        html_content: wrap('#f5f3ff', '#ffffff',
          `<div style="background:linear-gradient(135deg,#8b5cf6,#6d28d9);padding:48px 40px;text-align:center">
            <div style="width:64px;height:64px;background:rgba(255,255,255,.15);border-radius:16px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;font-size:28px;line-height:64px">⚡</div>
            <h1 style="margin:0 0 10px;color:#fff;font-size:28px;font-weight:800;font-family:Arial">Welcome aboard, {{first_name}}!</h1>
            <p style="margin:0;color:rgba(255,255,255,.85);font-size:15px;line-height:1.65;font-family:Arial">Your account is ready. Here\'s how to get the most out of it.</p>
          </div>` +
          section('#ffffff',
            ['Create your first project','Invite your team','Connect your tools'].map((s, i) =>
              `<div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:${i < 2 ? '20px' : '0'}">
                <div style="width:36px;height:36px;background:#8b5cf6;border-radius:10px;color:#fff;font-size:14px;font-weight:800;text-align:center;line-height:36px;flex-shrink:0;font-family:Arial">${i+1}</div>
                <div><p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#111827;font-family:Arial">${s}</p><p style="margin:0;font-size:13px;color:#9ca3af;font-family:Arial">Takes less than 2 minutes to complete.</p></div>
              </div>`
            ).join('')) +
          section('#f5f3ff',
            `<div style="text-align:center"><p style="margin:0 0 20px;font-size:15px;color:#374151;font-family:Arial">Ready to transform your workflow?</p>${btn('GET STARTED NOW', '#', '#8b5cf6')}</div>`) +
          footer('AppCloud')
        ),
      },
      {
        name: 'Feature Announcement',
        subject: '✨ Introducing [Feature] — Available Now',
        html_content: wrap('#ffffff', '#ffffff',
          `<div style="background:#0f172a;padding:20px 40px;text-align:center"><span style="font-size:13px;font-weight:800;color:#8b5cf6;letter-spacing:.2em;text-transform:uppercase;font-family:Arial">AppCloud</span></div>` +
          hero('linear-gradient(135deg,#1e1b4b,#312e81)',
            '✨ Meet Our Biggest Update Yet',
            'We\'ve been working hard behind the scenes. Today, we\'re excited to launch something that changes everything.',
            'SEE WHAT\'S NEW', '#', '#c4b5fd') +
          section('#ffffff',
            `<p style="margin:0 0 24px;font-size:13px;font-weight:700;color:#8b5cf6;text-transform:uppercase;letter-spacing:.12em;font-family:Arial">What\'s included</p>` +
            [['⚡','10× Faster Processing','New engine delivers results in milliseconds, not seconds.'],
             ['🤖','AI-Powered Suggestions','Smart recommendations that learn from your behaviour.'],
             ['📊','Advanced Analytics','Deep insights with customisable dashboards and exports.']
            ].map(([icon, title, desc]) =>
              `<div style="display:flex;gap:16px;margin-bottom:20px;padding:16px;background:#f8f7ff;border-radius:12px;border-left:3px solid #8b5cf6">
                <span style="font-size:24px;flex-shrink:0">${icon}</span>
                <div><p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#111827;font-family:Arial">${title}</p><p style="margin:0;font-size:13px;color:#6b7280;font-family:Arial">${desc}</p></div>
              </div>`
            ).join('') +
            `<div style="text-align:center;margin-top:8px">${btn('EXPLORE THE UPDATE', '#', '#8b5cf6')}</div>`) +
          footer('AppCloud')
        ),
      },
    ],
  },

  /* ── 3. RESTAURANT / FOOD ───────────────────────── */
  {
    category: 'Restaurant & Food',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>',
    accent: '#ef4444',
    templates: [
      {
        name: "Chef's Monthly Special",
        subject: "🍽️ This Month's Chef Special — Reserve Your Table",
        html_content: wrap('#fff5f5', '#ffffff',
          `<div style="background:linear-gradient(135deg,#7f1d1d,#991b1b);padding:28px 40px;text-align:center">
            <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,.6);letter-spacing:.2em;text-transform:uppercase;font-family:Arial">Est. 2010</p>
            <p style="margin:0;font-size:22px;font-weight:800;color:#fff;letter-spacing:.08em;font-family:Arial">LA BELLA CUCINA</p>
          </div>` +
          `<img src="https://placehold.co/600x280/ef4444/ffffff?text=Chef%27s+Special" alt="Chef Special" style="width:100%;display:block"/>` +
          section('#ffffff',
            `<p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:.15em;font-family:Arial">This Month Only</p>
            <h2 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#111827;font-family:Arial">Truffle Risotto & Wagyu Tenderloin</h2>
            <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.7;font-family:Arial">A luxurious pairing crafted by Chef Marco — rich arborio rice with black truffle, served alongside A5 Wagyu with a red wine reduction.</p>
            <div style="background:#fff5f5;border-radius:12px;padding:20px;border-left:4px solid #ef4444;margin-bottom:24px">
              <p style="margin:0;font-size:14px;color:#374151;font-family:Arial"><strong>Available:</strong> Weekends only &nbsp;·&nbsp; <strong>Price:</strong> $89 per person &nbsp;·&nbsp; <strong>Pairs with:</strong> 2019 Barolo</p>
            </div>
            <div style="text-align:center">${btn('RESERVE A TABLE', '#', '#ef4444')}</div>`) +
          footer("La Bella Cucina")
        ),
      },
      {
        name: 'Grand Opening Invite',
        subject: "🎉 You're Invited — Grand Opening This Saturday!",
        html_content: wrap('#fff5f5', '#ffffff',
          hero('linear-gradient(135deg,#ef4444,#b91c1c)',
            '🎉 You\'re Invited!',
            'Join us for the Grand Opening of our new downtown location. Free tastings, live music, and exclusive opening-night specials.',
            'RSVP NOW', '#', '#fee2e2') +
          section('#ffffff',
            `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              ${[['📅','Date','Saturday, July 12th'],['⏰','Time','6:00 PM — 10:00 PM'],['📍','Location','42 Main Street, Downtown']].map(([icon, label, val]) =>
                `<td class="col" style="text-align:center;padding:0 8px 0 0;vertical-align:top">
                  <div style="background:#fff5f5;border-radius:12px;padding:20px">
                    <div style="font-size:24px;margin-bottom:8px">${icon}</div>
                    <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:.1em;font-family:Arial">${label}</p>
                    <p style="margin:0;font-size:13px;color:#111827;font-weight:600;font-family:Arial">${val}</p>
                  </div>
                </td>`
              ).join('')}
            </tr></table>`) +
          section('#fef2f2',
            `<p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-align:center;font-family:Arial">Evening highlights</p>
            <p style="margin:0 0 20px;font-size:22px;font-weight:800;color:#111827;text-align:center;font-family:Arial">Free Tastings &nbsp;·&nbsp; Live Jazz &nbsp;·&nbsp; Chef Meet & Greet</p>
            <div style="text-align:center">${btn('CONFIRM ATTENDANCE', '#', '#ef4444')}</div>`) +
          footer('La Bella Cucina')
        ),
      },
    ],
  },

  /* ── 4. REAL ESTATE ─────────────────────────────── */
  {
    category: 'Real Estate',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>',
    accent: '#0ea5e9',
    templates: [
      {
        name: 'New Listing Alert',
        subject: '🏠 New Listing Alert — Dream Home Just Listed in {{city}}',
        html_content: wrap('#f0f9ff', '#ffffff',
          `<div style="background:linear-gradient(135deg,#0369a1,#0284c7);padding:24px 40px;text-align:center">
            <p style="margin:0;font-size:14px;font-weight:800;color:#fff;letter-spacing:.15em;text-transform:uppercase;font-family:Arial">PrimeRealty Group</p>
          </div>` +
          `<img src="https://placehold.co/600x300/0ea5e9/ffffff?text=Beautiful+Home+for+Sale" alt="Property" style="width:100%;display:block"/>` +
          section('#ffffff',
            `<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">
              <h2 style="margin:0;font-size:24px;font-weight:800;color:#111827;font-family:Arial">4BR / 3BA Modern Family Home</h2>
              <span style="font-size:26px;font-weight:800;color:#0ea5e9;font-family:Arial">$749,000</span>
            </div>
            <p style="margin:0 0 8px;font-size:14px;color:#6b7280;font-family:Arial">📍 &nbsp;124 Maplewood Drive, Sunnyvale, CA</p>
            <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.7;font-family:Arial">Stunning newly renovated home featuring an open-concept kitchen, hardwood floors, a spacious backyard with pool, and a 2-car garage in a top-rated school district.</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px">
              <tr>${[['🏠','2,240 sqft'],['🛏️','4 Bedrooms'],['🚿','3 Bathrooms'],['🚗','2-Car Garage']].map(([icon, label]) =>
                `<td style="text-align:center;padding:12px 4px;background:#f0f9ff;border-radius:8px"><p style="margin:0;font-size:18px">${icon}</p><p style="margin:4px 0 0;font-size:11px;font-weight:700;color:#374151;font-family:Arial">${label}</p></td>`
              ).join('')}</tr>
            </table>
            <div style="text-align:center">${btn('VIEW FULL LISTING', '#', '#0ea5e9')}</div>`) +
          footer('PrimeRealty Group')
        ),
      },
      {
        name: 'Open House Invitation',
        subject: '🔑 Open House This Sunday — Come See It In Person!',
        html_content: wrap('#f0f9ff', '#ffffff',
          hero('linear-gradient(135deg,#0369a1,#0ea5e9)',
            '🔑 Open House This Sunday',
            '124 Maplewood Drive, Sunnyvale is open for private viewings. Come experience the space in person.',
            'REGISTER TO ATTEND', '#', '#bae6fd') +
          section('#ffffff',
            `<div style="text-align:center;margin-bottom:28px">
              <p style="margin:0 0 16px;font-size:14px;color:#374151;font-family:Arial">Viewing slots available — reserve yours before they fill up</p>
              ${[['Morning Session','10:00 AM — 12:00 PM'],['Afternoon Session','2:00 PM — 5:00 PM']].map(([t, h]) =>
                `<div style="background:#f0f9ff;border-radius:12px;padding:16px;margin-bottom:10px;border:1px solid #bae6fd">
                  <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#0369a1;font-family:Arial">${t}</p>
                  <p style="margin:0;font-size:15px;font-weight:800;color:#111827;font-family:Arial">${h}</p>
                </div>`
              ).join('')}
            </div>
            <div style="background:#0369a1;border-radius:12px;padding:20px;text-align:center">
              <p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,.7);font-family:Arial">Your agent</p>
              <p style="margin:0 0 2px;font-size:16px;font-weight:800;color:#fff;font-family:Arial">Sarah Mitchell</p>
              <p style="margin:0;font-size:13px;color:#bae6fd;font-family:Arial">(555) 012-3456 &nbsp;·&nbsp; sarah@primerealty.com</p>
            </div>`) +
          footer('PrimeRealty Group')
        ),
      },
    ],
  },

  /* ── 5. HEALTH & FITNESS ────────────────────────── */
  {
    category: 'Health & Fitness',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>',
    accent: '#10b981',
    templates: [
      {
        name: '30-Day Challenge Invite',
        subject: '💪 Join Our 30-Day Transformation Challenge!',
        html_content: wrap('#f0fdf4', '#ffffff',
          hero('linear-gradient(135deg,#065f46,#059669)',
            '💪 30-Day Body Transformation Challenge',
            'Commit to 30 days. Change your life. Join 10,000+ members already transforming their bodies.',
            'JOIN FREE TODAY', '#', '#a7f3d0') +
          section('#ffffff',
            `<p style="margin:0 0 20px;font-size:13px;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:.12em;font-family:Arial;text-align:center">What you get</p>
            ${[['🏋️','Daily Workouts','Tailored 30-minute sessions for all fitness levels. No gym required.'],
               ['🥗','Nutrition Plan','Weekly meal plans with shopping lists and macro breakdowns.'],
               ['📈','Progress Tracking','Daily check-ins, before/after tools, and a supportive community.']
              ].map(([icon, title, desc]) =>
                `<div style="display:flex;gap:16px;align-items:flex-start;margin-bottom:18px;padding:16px;background:#f0fdf4;border-radius:12px">
                  <span style="font-size:24px;flex-shrink:0">${icon}</span>
                  <div><p style="margin:0 0 3px;font-size:14px;font-weight:700;color:#111827;font-family:Arial">${title}</p><p style="margin:0;font-size:13px;color:#6b7280;font-family:Arial">${desc}</p></div>
                </div>`
            ).join('')}` +
          `<div style="text-align:center;padding:24px 40px">${btn('START YOUR CHALLENGE', '#', '#10b981')}</div>`) +
          footer('FitLife Studio')
        ),
      },
      {
        name: 'Membership Renewal Offer',
        subject: '🏅 Your Membership Expires Soon — Renew & Save 30%',
        html_content: wrap('#f0fdf4', '#ffffff',
          `<div style="background:#064e3b;padding:24px 40px;text-align:center"><p style="margin:0;font-size:14px;font-weight:800;color:#34d399;letter-spacing:.15em;text-transform:uppercase;font-family:Arial">FitLife Studio</p></div>` +
          section('#ffffff',
            `<h2 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#111827;font-family:Arial;text-align:center">Don\'t Lose Your Progress!</h2>
            <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.7;font-family:Arial;text-align:center">Hi {{first_name}}, your membership expires on <strong>July 31st</strong>. Renew now and lock in your exclusive member pricing.</p>
            <div style="background:linear-gradient(135deg,#065f46,#059669);border-radius:16px;padding:28px;text-align:center;margin-bottom:28px">
              <p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,.75);text-transform:uppercase;letter-spacing:.1em;font-family:Arial">Renewal offer</p>
              <p style="margin:0 0 4px;font-size:40px;font-weight:800;color:#fff;font-family:Arial">30% OFF</p>
              <p style="margin:0 0 20px;font-size:14px;color:#a7f3d0;font-family:Arial">Annual plan — usually $199/yr, now $139/yr</p>
              ${btn('RENEW NOW & SAVE', '#', '#fff', '#059669')}
            </div>
            ${['Unlimited class access','Personal trainer session monthly','Premium app features','Member-only challenges'].map(f =>
              `<p style="margin:0 0 10px;font-size:14px;color:#374151;font-family:Arial">✅ &nbsp;${f}</p>`
            ).join('')}`) +
          footer('FitLife Studio')
        ),
      },
    ],
  },

  /* ── 6. EDUCATION ───────────────────────────────── */
  {
    category: 'Education',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 14l9-5-9-5-9 5 9 5z"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/></svg>',
    accent: '#3b82f6',
    templates: [
      {
        name: 'Course Launch Announcement',
        subject: '🎓 New Course Alert — {{course_name}} is Now Open for Enrollment',
        html_content: wrap('#eff6ff', '#ffffff',
          hero('linear-gradient(135deg,#1d4ed8,#3b82f6)',
            '🎓 New Course: Master UI/UX Design',
            'Learn to design world-class digital products. From fundamentals to advanced prototyping — in just 8 weeks.',
            'ENROLL NOW', '#', '#bfdbfe') +
          section('#ffffff',
            `<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:.12em;font-family:Arial">Course highlights</p>
            <h3 style="margin:0 0 20px;font-size:20px;font-weight:800;color:#111827;font-family:Arial">Everything you need to launch your design career</h3>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                ${[['40+','Lessons'],['8','Weeks'],['5','Projects'],['Lifetime','Access']].map(([val, label]) =>
                  `<td style="text-align:center;padding:16px 6px">
                    <p style="margin:0 0 2px;font-size:26px;font-weight:800;color:#3b82f6;font-family:Arial">${val}</p>
                    <p style="margin:0;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;font-family:Arial">${label}</p>
                  </td>`
                ).join('')}
              </tr>
            </table>`) +
          section('#eff6ff',
            `<p style="margin:0 0 16px;font-size:14px;color:#374151;font-family:Arial;font-weight:700">🔥 Early-bird pricing ends in 48 hours:</p>
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
              <div>
                <span style="font-size:32px;font-weight:800;color:#3b82f6;font-family:Arial">$97 </span>
                <span style="font-size:16px;color:#9ca3af;text-decoration:line-through;font-family:Arial">$197</span>
              </div>
              ${btn('GRAB EARLY-BIRD DEAL', '#', '#3b82f6')}
            </div>`) +
          footer('LearnHub Academy')
        ),
      },
      {
        name: 'Course Completion Certificate',
        subject: '🏆 Congratulations {{first_name}} — Your Certificate is Ready!',
        html_content: wrap('#eff6ff', '#ffffff',
          `<div style="background:linear-gradient(135deg,#1e3a8a,#1d4ed8);padding:48px 40px;text-align:center">
            <div style="font-size:56px;margin-bottom:16px">🏆</div>
            <h1 style="margin:0 0 10px;color:#fff;font-size:28px;font-weight:800;font-family:Arial">Congratulations, {{first_name}}!</h1>
            <p style="margin:0;color:#bfdbfe;font-size:15px;font-family:Arial">You have successfully completed</p>
            <p style="margin:8px 0 0;color:#fbbf24;font-size:22px;font-weight:800;font-family:Arial">Master UI/UX Design</p>
          </div>` +
          section('#ffffff',
            `<div style="border:2px dashed #bfdbfe;border-radius:16px;padding:28px;text-align:center;margin-bottom:24px">
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:.15em;font-family:Arial">Certificate of Completion</p>
              <p style="margin:0 0 4px;font-size:20px;font-weight:800;color:#111827;font-family:Arial">{{first_name}} {{last_name}}</p>
              <p style="margin:0;font-size:13px;color:#9ca3af;font-family:Arial">Issued ${new Date().toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'})}</p>
            </div>
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;font-family:Arial;text-align:center">Share your achievement and let the world know about your new skills. Your certificate PDF is ready to download.</p>
            <div style="text-align:center">${btn('DOWNLOAD CERTIFICATE', '#', '#3b82f6')}</div>`) +
          footer('LearnHub Academy')
        ),
      },
    ],
  },

  /* ── 7. TRAVEL ──────────────────────────────────── */
  {
    category: 'Travel & Tourism',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064"/></svg>',
    accent: '#06b6d4',
    templates: [
      {
        name: 'Exclusive Travel Deal',
        subject: '✈️ Exclusive Deal: Bali for $799 — Only 12 Spots Left!',
        html_content: wrap('#ecfeff', '#ffffff',
          `<img src="https://placehold.co/600x320/06b6d4/ffffff?text=Bali+Paradise+Package" alt="Bali" style="width:100%;display:block"/>` +
          section('#ffffff',
            `<div style="display:inline-block;background:#ecfeff;border:1px solid #67e8f9;color:#0e7490;font-size:11px;font-weight:700;padding:6px 14px;border-radius:20px;margin-bottom:16px;text-transform:uppercase;letter-spacing:.1em;font-family:Arial">Limited Offer — 12 spots remaining</div>
            <h2 style="margin:0 0 12px;font-size:28px;font-weight:800;color:#111827;font-family:Arial">7 Nights in Bali, Indonesia</h2>
            <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.7;font-family:Arial">Escape to paradise. Luxury resort stay, daily breakfast, guided temple tour, and sunset boat trip — all included.</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px">
              <tr>${[['✈️','Flights Included'],['🏨','5-Star Resort'],['🍳','Breakfast Daily'],['🚌','Airport Transfer']].map(([icon, label]) =>
                `<td style="text-align:center;padding:14px 4px;background:#ecfeff;border-radius:8px"><p style="margin:0 0 4px;font-size:20px">${icon}</p><p style="margin:0;font-size:10px;font-weight:700;color:#0e7490;text-transform:uppercase;font-family:Arial">${label}</p></td>`
              ).join('')}</tr>
            </table>
            <div style="background:linear-gradient(135deg,#0891b2,#06b6d4);border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
              <p style="margin:0 0 4px;font-size:13px;color:rgba(255,255,255,.75);font-family:Arial">Per person from</p>
              <p style="margin:0 0 16px;font-size:40px;font-weight:800;color:#fff;font-family:Arial">$799</p>
              ${btn('BOOK THIS DEAL', '#', '#fff', '#0891b2')}
            </div>`) +
          footer('WanderWise Travel')
        ),
      },
      {
        name: 'Travel Newsletter',
        subject: '🌍 5 Hidden Gems You Need to Visit This Summer',
        html_content: wrap('#ecfeff', '#ffffff',
          `<div style="background:linear-gradient(135deg,#164e63,#0891b2);padding:28px 40px;text-align:center">
            <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,.6);letter-spacing:.2em;text-transform:uppercase;font-family:Arial">WanderWise Travel</p>
            <p style="margin:0;font-size:18px;font-weight:800;color:#fff;font-family:Arial">Your Monthly Travel Digest 🌍</p>
          </div>` +
          section('#ffffff',
            `<h2 style="margin:0 0 24px;font-size:22px;font-weight:800;color:#111827;font-family:Arial">5 Hidden Gems for Summer 2025</h2>` +
            [['🇵🇹 Alentejo, Portugal','Rolling vineyards and medieval villages far from the tourist crowds. Perfect for slow travel.'],
             ['🇯🇵 Kanazawa, Japan','The mini-Kyoto of Japan — geisha districts, samurai quarters, and zero wait times.'],
             ['🇷🇴 Transylvania, Romania','Gothic castles, Saxon villages, and some of Europe\'s best hiking. Surprisingly affordable.'],
            ].map(([dest, desc]) =>
              `<div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #e0f2fe">
                <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#0e7490;font-family:Arial">${dest}</p>
                <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;font-family:Arial">${desc}</p>
              </div>`
            ).join('') +
            `<div style="text-align:center">${btn('READ FULL GUIDE', '#', '#06b6d4')}</div>`) +
          footer('WanderWise Travel')
        ),
      },
    ],
  },

  /* ── 8. FINANCE ─────────────────────────────────── */
  {
    category: 'Finance & Business',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>',
    accent: '#6366f1',
    templates: [
      {
        name: 'Monthly Market Update',
        subject: '📊 Your Monthly Financial Digest — June 2025',
        html_content: wrap('#eef2ff', '#ffffff',
          `<div style="background:linear-gradient(135deg,#312e81,#4338ca);padding:28px 40px">
            <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.15em;font-family:Arial">CapitalEdge Advisory</p>
            <p style="margin:0;font-size:20px;font-weight:800;color:#fff;font-family:Arial">Monthly Market Update — June 2025</p>
          </div>` +
          section('#ffffff',
            `<p style="margin:0 0 20px;font-size:13px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:.1em;font-family:Arial">Portfolio Snapshot</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px">
              <tr>${[['S&P 500','+4.2%','#10b981'],['NASDAQ','+6.1%','#10b981'],['Portfolio','+5.8%','#10b981'],['BTC','-2.3%','#ef4444']].map(([label, val, color]) =>
                `<td style="text-align:center;padding:16px 6px;background:#eef2ff;border-radius:8px">
                  <p style="margin:0 0 4px;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;font-family:Arial">${label}</p>
                  <p style="margin:0;font-size:20px;font-weight:800;color:${color};font-family:Arial">${val}</p>
                </td>`
              ).join('')}</tr>
            </table>
            <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#374151;font-family:Arial">Key Insights This Month</p>
            ${['Fed holds rates steady — bonds rally 2.8%','Tech sector leads with AI infrastructure spending','Emerging markets showing strong recovery signs'].map(t =>
              `<p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-family:Arial">→ &nbsp;${t}</p>`
            ).join('')}`) +
          section('#eef2ff',
            `<p style="margin:0 0 16px;font-size:14px;color:#374151;font-family:Arial">Ready to review your portfolio strategy for Q3?</p>
            <div style="text-align:center">${btn('SCHEDULE A REVIEW', '#', '#6366f1')}</div>`) +
          footer('CapitalEdge Advisory')
        ),
      },
      {
        name: 'Investment Opportunity',
        subject: '💼 Exclusive Investment Opportunity — Limited Access',
        html_content: wrap('#eef2ff', '#ffffff',
          hero('linear-gradient(135deg,#1e1b4b,#4338ca)',
            '💼 Exclusive Opportunity',
            'We\'re opening early access to our Q3 Managed Growth Portfolio. Minimum $10,000. Historically 12–18% annual returns.',
            'REQUEST DETAILS', '#', '#c7d2fe') +
          section('#ffffff',
            `${[['📈','Track Record','12 consecutive years of positive returns averaging 14.3% annually.'],
               ['🔒','Capital Protection','Downside protection strategies limit your maximum loss to 8%.'],
               ['👥','Expert Team','Our 12-person investment committee with 150+ years combined experience.']
              ].map(([icon, title, desc]) =>
              `<div style="display:flex;gap:16px;margin-bottom:18px">
                <span style="font-size:24px;flex-shrink:0">${icon}</span>
                <div><p style="margin:0 0 3px;font-size:14px;font-weight:700;color:#111827;font-family:Arial">${title}</p><p style="margin:0;font-size:13px;color:#6b7280;font-family:Arial">${desc}</p></div>
              </div>`
            ).join('')}
            <div style="background:#f5f3ff;border-radius:12px;padding:16px;margin-top:8px">
              <p style="margin:0;font-size:11px;color:#6b7280;font-family:Arial">⚠️ Past performance is not a guarantee of future results. Investments involve risk.</p>
            </div>`) +
          footer('CapitalEdge Advisory')
        ),
      },
    ],
  },

  /* ── 9. FASHION ─────────────────────────────────── */
  {
    category: 'Fashion & Lifestyle',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/></svg>',
    accent: '#ec4899',
    templates: [
      {
        name: 'New Collection Drop',
        subject: '👗 NEW DROP: The Celestial Collection is Here',
        html_content: wrap('#fdf2f8', '#111827',
          `<div style="background:#111827;padding:24px 40px;text-align:center"><p style="margin:0;font-size:16px;font-weight:800;color:#fff;letter-spacing:.25em;text-transform:uppercase;font-family:Arial">VÈLOUR</p></div>
          <img src="https://placehold.co/600x360/ec4899/ffffff?text=The+Celestial+Collection" alt="New Collection" style="width:100%;display:block"/>` +
          section('#111827',
            `<h2 style="margin:0 0 10px;font-size:30px;font-weight:800;color:#fff;font-family:Arial;letter-spacing:-.5px">The Celestial Collection</h2>
            <p style="margin:0 0 24px;font-size:15px;color:#9ca3af;line-height:1.7;font-family:Arial">Inspired by the night sky. Draped silhouettes, iridescent fabrics, and hand-embroidered constellations. 14 exclusive pieces, made to order.</p>
            <div style="text-align:center">${btn('SHOP THE COLLECTION', '#', '#ec4899')}</div>`) +
          section('#1f2937',
            `<p style="margin:0 0 16px;font-size:11px;color:#9ca3af;text-align:center;text-transform:uppercase;letter-spacing:.15em;font-family:Arial">Also trending</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              ${[['Silk Wrap Midi Dress','$285'],['Sequin Blazer','$310'],['Statement Earrings','$89']].map(([name, price]) =>
                `<td style="text-align:center;padding:0 6px">
                  <div style="background:#374151;border-radius:10px;padding:16px">
                    <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#f9fafb;font-family:Arial">${name}</p>
                    <p style="margin:0;font-size:14px;font-weight:800;color:#ec4899;font-family:Arial">${price}</p>
                  </div>
                </td>`
              ).join('')}
            </tr></table>`) +
          footer('VÈLOUR', '#6b7280')
        ),
      },
      {
        name: 'Seasonal Sale',
        subject: '🏷️ Summer Sale — Up to 50% Off Sitewide',
        html_content: wrap('#fdf2f8', '#ffffff',
          `<div style="background:linear-gradient(135deg,#831843,#be185d);padding:48px 40px;text-align:center">
            <p style="margin:0 0 8px;font-size:12px;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.2em;font-family:Arial">Summer Sale</p>
            <p style="margin:0 0 4px;font-size:72px;font-weight:800;color:#fff;line-height:1;font-family:Arial">50%</p>
            <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#fbcfe8;font-family:Arial">OFF SITEWIDE</p>
            ${btn('SHOP THE SALE', '#', '#be185d', '#fff')}
            <p style="margin:16px 0 0;font-size:11px;color:rgba(255,255,255,.6);font-family:Arial">Use code <strong style="color:#fce7f3">SUMMER50</strong> at checkout</p>
          </div>` +
          section('#ffffff',
            `<p style="margin:0 0 20px;font-size:14px;font-weight:700;color:#374151;text-align:center;font-family:Arial">Shop by category</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              ${[['👗','Dresses','Up to 50%'],['👠','Shoes','Up to 40%'],['👜','Bags','Up to 35%'],['💄','Beauty','Up to 30%']].map(([icon, label, disc]) =>
                `<td style="text-align:center;padding:0 4px">
                  <div style="background:#fdf2f8;border-radius:10px;padding:16px">
                    <div style="font-size:24px;margin-bottom:6px">${icon}</div>
                    <p style="margin:0 0 2px;font-size:12px;font-weight:700;color:#111827;font-family:Arial">${label}</p>
                    <p style="margin:0;font-size:11px;color:#ec4899;font-weight:700;font-family:Arial">${disc}</p>
                  </div>
                </td>`
              ).join('')}
            </tr></table>`) +
          footer('VÈLOUR')
        ),
      },
    ],
  },

  /* ── 10. NON-PROFIT ─────────────────────────────── */
  {
    category: 'Non-Profit & Charity',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>',
    accent: '#f59e0b',
    templates: [
      {
        name: 'Donation Appeal',
        subject: '❤️ {{first_name}}, Your Help Can Change Everything',
        html_content: wrap('#fffbeb', '#ffffff',
          `<img src="https://placehold.co/600x280/f59e0b/ffffff?text=Make+a+Difference+Today" alt="Cause" style="width:100%;display:block"/>` +
          section('#ffffff',
            `<h2 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#111827;font-family:Arial">Every Dollar Makes a Real Difference</h2>
            <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.7;font-family:Arial">Hi {{first_name}}, right now 1 in 4 children in underserved communities lack access to clean water and basic education. With your support, we can change that — one family at a time.</p>
            <div style="background:#fffbeb;border-radius:12px;padding:20px;margin-bottom:24px">
              ${[['$25','Provides clean water for a family for 1 month'],['$50','Buys school supplies for 3 children'],['$100','Funds a teacher\'s salary for a week']].map(([amt, desc]) =>
                `<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;padding:12px;background:#fff;border-radius:8px;border-left:3px solid #f59e0b">
                  <span style="font-size:16px;font-weight:800;color:#f59e0b;font-family:Arial;width:36px;flex-shrink:0">${amt}</span>
                  <span style="font-size:13px;color:#374151;font-family:Arial">${desc}</span>
                </div>`
              ).join('')}
            </div>
            <div style="text-align:center">${btn('DONATE NOW', '#', '#f59e0b')}</div>`) +
          section('#fffbeb',
            `<p style="margin:0;font-size:13px;color:#92400e;text-align:center;font-family:Arial">🔒 &nbsp;Your donation is 100% tax-deductible. EIN: 12-3456789. <a href="#" style="color:#92400e">View our financials.</a></p>`) +
          footer('BrightFutures Foundation', '#a16207')
        ),
      },
      {
        name: 'Annual Impact Report',
        subject: '📋 Look What We Achieved Together in 2024',
        html_content: wrap('#fffbeb', '#ffffff',
          hero('linear-gradient(135deg,#92400e,#d97706)',
            '2024 Impact Report',
            'Together we achieved something extraordinary. Here\'s what your generosity made possible this year.',
            'READ FULL REPORT', '#', '#fef3c7') +
          section('#ffffff',
            `<p style="margin:0 0 20px;font-size:13px;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:.12em;font-family:Arial;text-align:center">By the numbers</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px">
              <tr>${[['12,400','Families Helped'],['847','Wells Built'],['3,200','Kids in School'],['94%','Fund Efficiency']].map(([val, label]) =>
                `<td style="text-align:center;padding:16px 6px">
                  <p style="margin:0 0 4px;font-size:28px;font-weight:800;color:#f59e0b;font-family:Arial">${val}</p>
                  <p style="margin:0;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;font-family:Arial">${label}</p>
                </td>`
              ).join('')}</tr>
            </table>
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;font-family:Arial">"I never thought clean water would reach our village. Now my children go to school healthy and with hope." — <em>Amara, Kenya</em></p>
            <div style="text-align:center">${btn('DONATE FOR 2025', '#', '#f59e0b')}</div>`) +
          footer('BrightFutures Foundation', '#a16207')
        ),
      },
    ],
  },

];
