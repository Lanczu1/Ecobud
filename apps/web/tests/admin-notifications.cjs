const assert=require('node:assert/strict');
const { chromium }=require(process.env.ECOBUD_PLAYWRIGHT_MODULE || 'playwright');
const origin=process.env.ECOBUD_TEST_ORIGIN || 'http://127.0.0.1:5185';
const fixture=(id,category,recordType,recordId,title,actionRequired=false)=>({ id,category,recordType,recordId,title,message:'Explicit test fixture, not resident data.',actionRequired,resolvedAt:null,barangays:['Alibungbungan'],createdAt:'2026-10-05T01:00:00Z',isRead:false });
(async()=>{
  const browser=await chromium.launch({ channel:process.env.ECOBUD_BROWSER_CHANNEL || 'chrome',headless:true });
  try {
    const context=await browser.newContext(); const page=await context.newPage(); const errors=[]; const seen=[];
    let fail=false; let reads=new Set(); let prefs={ pushCategories:['system'],quietStart:null,quietEnd:null,publicKey:null };
    const items=[fixture('proof','challenge','challenge_submission','proof-record','Challenge proof waiting for review',true),fixture('publication','learning','lesson','lesson-record','Lesson published')];
    page.on('pageerror',error=>errors.push(error.message));
    await context.addInitScript(()=>{
      localStorage.setItem('ecobud_admin_user',JSON.stringify({ id:'notification-test',role:'admin',name:'Notification test admin' }));
      localStorage.setItem('ecobud_admin_token','test-only'); localStorage.setItem('ecobud_admin_authenticated','true');
      localStorage.setItem('ecobud_admin_session_started_at',String(Date.now())); localStorage.setItem('ecobud_admin_last_activity_at',String(Date.now()));
    });
    await context.route('**/api/**',async route=>{
      const req=route.request(); const url=new URL(req.url()); const path=url.pathname.replace('/api','');
      seen.push({ path,query:url.search,method:req.method() });
      const headers={ 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*' };
      if (req.method()==='OPTIONS') return route.fulfill({ status:204,headers });
      if (path==='/admin/notifications/preferences') {
        if (req.method()==='PUT') { prefs={ ...prefs,...req.postDataJSON() }; return route.fulfill({ json:{ success:true },headers }); }
        return route.fulfill({ json:prefs,headers });
      }
      if (path==='/admin/notifications/read-all') { reads=new Set(items.map(item=>item.id)); return route.fulfill({ json:{ success:true },headers }); }
      if (/^\/admin\/notifications\/[^/]+\/read$/.test(path)) { reads.add(path.split('/')[3]); return route.fulfill({ json:{ success:true },headers }); }
      if (path==='/admin/notifications') {
        if (fail) return route.fulfill({ status:503,json:{ message:'Fixture inbox temporarily unavailable.' },headers });
        let list=items.map(item=>({ ...item,isRead:reads.has(item.id) }));
        if (url.searchParams.get('filter')==='unread') list=list.filter(item=>!item.isRead);
        if (url.searchParams.get('filter')==='action') list=list.filter(item=>item.actionRequired && !item.resolvedAt);
        if (url.searchParams.get('category')) list=list.filter(item=>item.category===url.searchParams.get('category'));
        return route.fulfill({ json:{ items:list,unreadCount:items.filter(item=>!reads.has(item.id)).length,actionCount:1,next:null },headers });
      }
      if (path.startsWith('/admin/notifications/') && req.method()==='GET') {
        const item=items.find(item=>item.id===path.split('/')[3]);
        return item ? route.fulfill({ json:{ ...item,isRead:reads.has(item.id) },headers }) : route.fulfill({ status:404,json:{ message:'Notification is unavailable or outside your assigned barangay.' },headers });
      }
      if (path==='/admin/submissions') return route.fulfill({ json:{ items:[{ id:'proof-record',userId:'resident-fixture',challengeInstanceId:'instance-fixture',proofText:'Test proof',status:'pending',createdAt:'2026-10-05T01:00:00Z',detectedQuantity:1,reservedQuantity:1,
        user:{ id:'resident-fixture',name:'Fixture resident',profile:{ city:'Alibungbungan',displayName:'Fixture resident' } },challenge:{ id:'challenge-fixture',title:'Fixture challenge',type:'GENERAL' },submissionType:'CHALLENGE' }],pagination:{ page:1,pageSize:25,total:1,totalPages:1,totalResidents:1,totalBarangays:1 },filterOptions:{ users:[],barangays:[] } },headers });
      return route.fulfill({ json:{ items:[],pagination:{ page:1,pageSize:25,total:0,totalPages:1 },total:0 },headers });
    });
    await page.goto(`${origin}/#admin?section=Notifications`);
    await page.getByRole('heading',{ name:'Notifications',exact:true }).waitFor();
    await page.getByRole('button',{ name:'Notifications, 2 unread',exact:true }).click();
    await page.getByRole('heading',{ name:'Notifications',exact:true }).nth(1).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button',{ name:'Notifications, 2 unread',exact:true }).evaluate(el=>el===document.activeElement),true);
    await page.getByRole('link').filter({ hasText:'Challenge proof waiting for review' }).click();
    await page.getByRole('link',{ name:'Open record',exact:true }).waitFor();
    await page.getByRole('button',{ name:'Notifications, 1 unread',exact:true }).waitFor();
    await page.getByRole('link',{ name:'Open record',exact:true }).click();
    await page.getByText('Showing the linked record.',{ exact:false }).waitFor();
    await page.getByText('Fixture challenge',{ exact:false }).first().waitFor({ timeout:10000 }).catch(async error=>{
      console.log('Fixture render errors:',errors,'Fixture page text:',await page.locator('body').innerText());
      throw error;
    });
    assert(seen.some(req=>req.path==='/admin/submissions' && req.query.includes('recordId=proof-record')));
    await page.getByRole('link',{ name:'Return to all records',exact:true }).click();
    await page.getByRole('button',{ name:'Notifications',exact:true }).click();
    await page.getByRole('heading',{ name:'Notifications',exact:true }).waitFor();
    await page.getByRole('combobox',{ name:'Show',exact:true }).selectOption('action');
    await page.getByRole('link').filter({ hasText:'Challenge proof waiting for review' }).waitFor();
    await page.getByRole('link').filter({ hasText:'Lesson published' }).waitFor({ state:'hidden' });
    assert.equal(await page.getByRole('link').filter({ hasText:'Lesson published' }).count(),0);
    await page.getByRole('button',{ name:'Notification settings',exact:true }).click();
    await page.getByText('Browser push is awaiting server setup.',{ exact:false }).waitFor();
    assert.equal(await page.getByRole('button',{ name:'Enable alerts on this browser' }).isDisabled(),true);
    await page.getByRole('checkbox',{ name:'ID verification',exact:true }).check();
    await page.getByRole('combobox',{ name:'Quiet hours start',exact:true }).selectOption('22');
    await page.getByRole('combobox',{ name:'End',exact:true }).selectOption('7');
    await page.getByRole('button',{ name:'Save preferences',exact:true }).click();
    await page.getByText('Notification preferences saved.',{ exact:true }).waitFor();
    assert(prefs.pushCategories.includes('verification')); assert.equal(prefs.quietStart,22);
    await page.getByRole('button',{ name:'Mark all as read',exact:true }).click();
    await page.getByRole('combobox',{ name:'Show',exact:true }).selectOption('unread');
    await page.getByText('No notifications match this filter.',{ exact:true }).waitFor();
    fail=true; await page.getByRole('button',{ name:'Refresh',exact:true }).click();
    await page.getByText('Fixture inbox temporarily unavailable.',{ exact:false }).waitFor();
    fail=false; await page.getByRole('button',{ name:'Retry',exact:true }).click();
    await page.getByText('No notifications match this filter.',{ exact:true }).waitFor();
    await page.getByRole('button',{ name:'Switch to dark mode',exact:true }).click();
    await page.setViewportSize({ width:768,height:900 });
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
    await page.screenshot({ path:process.env.ECOBUD_NOTIFICATION_SCREENSHOT || 'tests/admin-notifications.png',fullPage:true });
    await page.goto(`${origin}/#admin?section=Notifications&notification=unavailable`);
    await page.getByText('Notification is unavailable or outside your assigned barangay.',{ exact:true }).waitFor();
    assert.deepEqual(errors,[]);
    console.log('Admin notification browser checks passed: unread bell, Escape focus, detail/read state, exact proof target, filters, preferences, unavailable push, empty/error/retry, dark theme, tablet width and missing destination.');
    await context.close();
  } finally { await browser.close(); }
})().catch(error=>{ console.error(error); process.exitCode=1; });
