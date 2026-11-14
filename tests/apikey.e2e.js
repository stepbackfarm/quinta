// Browser test of reading photos with a Claude API key (the standalone copy). Claude's API is replaced by a
// stand-in, so no real key or money is needed. The SDK itself is loaded from the CDN, so this needs internet.
// Run: python3 -m http.server 8765 --bind 127.0.0.1 (in the repo), then node tests/apikey.e2e.js <screenshot-dir>
const {chromium}=require('playwright');
const path=require('path');
const shots=process.argv[2]||'.';
const sse=(text,stop)=>[
  ['message_start',{type:'message_start',message:{id:'msg_1',type:'message',role:'assistant',model:'claude-opus-5-5',content:[],stop_reason:null,stop_sequence:null,usage:{input_tokens:10,output_tokens:1}}}],
  ['content_block_start',{type:'content_block_start',index:0,content_block:{type:'text',text:''}}],
  ['content_block_delta',{type:'content_block_delta',index:0,delta:{type:'text_delta',text}}],
  ['content_block_stop',{type:'content_block_stop',index:0}],
  ['message_delta',{type:'message_delta',delta:{stop_reason:stop,stop_sequence:null},usage:{output_tokens:20}}],
  ['message_stop',{type:'message_stop'}],
].map(([e,d])=>`event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join('');
(async()=>{
  const b=await chromium.launch();
  const pg=await b.newPage({viewport:{width:1180,height:820}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  let mode='ok', seen=null;
  const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
  await pg.route('https://api.anthropic.com/**',async r=>{
    const req=r.request();
    if(req.method()==='OPTIONS') return r.fulfill({status:204,headers:cors});
    const h=req.headers(); const key=h['x-api-key']||(h['authorization']||'').replace(/^Bearer /,'');
    if(key!=='sk-ant-good') return r.fulfill({status:401,headers:{...cors,'content-type':'application/json'},body:JSON.stringify({type:'error',error:{type:'authentication_error',message:'invalid x-api-key'}})});
    if(req.url().includes('/v1/models/')) return r.fulfill({status:200,headers:{...cors,'content-type':'application/json'},body:JSON.stringify({type:'model',id:'claude-opus-5-5',display_name:'Claude Opus 5.5',created_at:'2026-01-01T00:00:00Z'})});
    const body=JSON.parse(req.postData()); const c=body.messages[0].content;
    seen={url:req.url(),model:body.model,effort:body.output_config&&body.output_config.effort,fallbacks:body.fallbacks,stream:body.stream,max_tokens:body.max_tokens,
      beta:h['anthropic-beta'],browser:h['anthropic-dangerous-direct-browser-access'],version:h['anthropic-version'],
      image:c[0].type+'/'+c[0].source.media_type+'/'+(c[0].source.data.length>1000?'data ok':'no data'),prompt:c[1].text.slice(0,40)};
    if(mode==='slow') await new Promise(res=>setTimeout(res,4000));
    const text=mode==='refuse'?'':'T:Hot Cross Buns\nM:4/4\nL:1/4\nK:G\nB A G2 | B A G2 | G/G/G/G/ A/A/A/A/ | B A G2 |]';
    return r.fulfill({status:200,headers:{...cors,'content-type':'text/event-stream'},body:sse(text,mode==='refuse'?'refusal':'end_turn')});
  });
  await pg.goto('http://127.0.0.1:8765/index.html#make');
  console.log('no key, photo tab:',await pg.evaluate(()=>({btn:document.querySelector('#readBtn').disabled,msg:document.querySelector('#photoStatus').textContent})));
  // save a bad key, then a good one
  await pg.click('#settingsBtn');
  await pg.fill('#apiKey','hello'); await pg.click('[data-act="key-save"]');
  console.log('not a key:',await pg.textContent('#keyStatus'));
  await pg.fill('#apiKey','sk-ant-wrong'); await pg.click('[data-act="key-save"]');
  await pg.waitForFunction(()=>!/Checking/.test(document.querySelector('#keyStatus').textContent),null,{timeout:30000});
  console.log('wrong key test:',await pg.textContent('#keyStatus'));
  await pg.fill('#apiKey','sk-ant-good'); await pg.click('[data-act="key-save"]');
  await pg.waitForFunction(()=>!/Checking/.test(document.querySelector('#keyStatus').textContent),null,{timeout:30000});
  console.log('good key test:',await pg.textContent('#keyStatus'),'| input cleared:',await pg.inputValue('#apiKey')==='','| placeholder:',await pg.getAttribute('#apiKey','placeholder'));
  await pg.screenshot({path:shots+'/key-settings.png'});
  await pg.click('[data-act="settings-close"]');
  // read a photo
  await pg.setInputFiles('#photoInput',path.join(__dirname,'..','icon.png'));
  await pg.click('#readBtn');
  await pg.waitForFunction(()=>S.make.base!=null,null,{timeout:30000});
  console.log('request sent:',seen);
  console.log('result:',await pg.evaluate(()=>({title:S.make.title,notes:S.make.base.notes.length,origin:S.make.origin,status:document.querySelector('#photoStatus').textContent})));
  await pg.screenshot({path:shots+'/key-result.png'});
  // a declined photo
  mode='refuse'; await pg.evaluate(()=>{ S.make.base=null; }); await pg.click('#readBtn');
  await pg.waitForFunction(()=>/would not/.test(document.querySelector('#photoStatus').textContent),null,{timeout:30000});
  console.log('refusal:',await pg.textContent('#photoStatus'));
  // stop while reading
  mode='slow'; await pg.click('#readBtn'); await pg.waitForTimeout(800); await pg.click('#stopRead'); await pg.waitForTimeout(500);
  console.log('stopped:',JSON.stringify(await pg.textContent('#photoStatus')),'| read button back:',!(await pg.isDisabled('#readBtn')));
  // key rejected while reading
  mode='ok'; await pg.evaluate(()=>localStorage.setItem('quinta.apikey','sk-ant-revoked')); await pg.click('#readBtn');
  await pg.waitForFunction(()=>/not accepted/.test(document.querySelector('#photoStatus').textContent),null,{timeout:30000});
  console.log('revoked key:',await pg.textContent('#photoStatus'));
  // remove the key
  await pg.click('#settingsBtn'); await pg.click('[data-act="key-del"]');
  console.log('removed:',await pg.textContent('#keyStatus'),'| stored:',await pg.evaluate(()=>localStorage.getItem('quinta.apikey')));
  // the key is not in the saved settings
  console.log('key in settings JSON:',await pg.evaluate(()=>/sk-ant/.test(localStorage.getItem('quinta.settings')||'')));
  await pg.setViewportSize({width:390,height:844}); console.log('phone width',await pg.evaluate(()=>document.documentElement.scrollWidth));
  await pg.screenshot({path:shots+'/key-phone.png'});
  console.log('errors:',errs);
  await b.close();
})();
