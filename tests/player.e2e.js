// Browser test of the song player while playing: the active line sits just under the slim bar,
// the next line is in view, the metronome folds into the bar, and pull-down / Hide / the arrow work.
// Run: python3 -m http.server 8765 --bind 127.0.0.1 (in the repo), then node tests/player.e2e.js <screenshot-dir>
const {chromium}=require('playwright');
const shots=process.argv[2]||'.';
(async()=>{
  const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
  const pg=await b.newPage({viewport:{width:1180,height:820}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  await pg.goto('http://127.0.0.1:8765/index.html#songs');
  await pg.click('#metroBtn');
  await pg.click('[data-act="open-song"][data-id="swallows"]');
  await pg.evaluate(()=>{ S.player.tempo=140; });
  await pg.screenshot({path:shots+'/roll-0.png'});
  const state=()=>pg.evaluate(()=>{
    const view=document.querySelector('#view-songs'), vt=view.getBoundingClientRect().top, vb=view.getBoundingClientRect().bottom;
    const bar=document.querySelector('#controls').getBoundingClientRect();
    const g=document.querySelector('#playerScore .nt.on'); const svg=g&&g.ownerSVGElement;
    const svgs=[...document.querySelectorAll('#playerScore svg')]; const k=svgs.indexOf(svg);
    const r=svg&&svg.getBoundingClientRect(), nx=svgs[k+1]&&svgs[k+1].getBoundingClientRect();
    return {line:k+1+' of '+svgs.length, compact:document.querySelector('#controls').classList.contains('compact'), barH:Math.round(bar.height),
      lineTopUnderBar:r?Math.round(r.top-bar.bottom):null, nextLineFullyVisible:nx?nx.bottom<=vb:'(last line)',
      floatingMetroShown:getComputedStyle(document.querySelector('#metro')).display!=='none', miniMetro:!document.querySelector('#pmetro').hidden};
  });
  await pg.click('#bAlong');
  for(const wait of [2500,4000,4000]){ await pg.waitForTimeout(wait); console.log(await state()); }
  await pg.screenshot({path:shots+'/roll-1.png'});
  // pull the bar down with a drag
  const bb=await pg.locator('#controls').boundingBox();
  await pg.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2); await pg.mouse.down(); await pg.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2+60,{steps:6}); await pg.mouse.up();
  await pg.waitForTimeout(500);
  console.log('after pull-down:',await pg.evaluate(()=>({compact:document.querySelector('#controls').classList.contains('compact'),hideBtn:!document.querySelector('#bHide').hidden,scrollTop:document.querySelector('#view-songs').scrollTop,stillPlaying:S.player.mode})));
  await pg.screenshot({path:shots+'/roll-2.png'});
  await pg.click('#bHide'); await pg.waitForTimeout(300);
  console.log('after hide:',await pg.evaluate(()=>document.querySelector('#controls').classList.contains('compact')));
  await pg.click('[data-act="panel-show"]'); await pg.waitForTimeout(200);
  console.log('after tap handle:',await pg.evaluate(()=>document.querySelector('#controls').classList.contains('compact')));
  await pg.click('#bStop'); await pg.waitForTimeout(200);
  console.log('after stop:',await pg.evaluate(()=>({compact:document.querySelector('#controls').classList.contains('compact'),floating:getComputedStyle(document.querySelector('#metro')).display!=='none',head:getComputedStyle(document.querySelector('.player-head')).display})));
  // phone
  await pg.setViewportSize({width:390,height:844});
  await pg.click('#bListen'); await pg.waitForTimeout(6000);
  console.log('phone:',await state(), 'width',await pg.evaluate(()=>document.documentElement.scrollWidth));
  await pg.screenshot({path:shots+'/roll-phone.png'});
  console.log('errors:',errs);
  await b.close();
})();
