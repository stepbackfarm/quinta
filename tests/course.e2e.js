// Browser test of the Learn course: every quiz question builds, passing and failing quizzes, locks,
// Practice my mistakes, a game, the grown-ups page, reload, and phone width.
// Run: python3 -m http.server 8765 --bind 127.0.0.1 (in the repo), then node tests/course.e2e.js <screenshot-dir>
const {chromium}=require('playwright');
const shots=process.argv[2];
(async()=>{
  const b=await chromium.launch();
  const pg=await b.newPage({viewport:{width:1180,height:820}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); pg.on('console',m=>{ if(m.type()==='error'&&!/ERR_FAILED/.test(m.text())) errs.push(m.text()); });
  await pg.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  await pg.goto('http://127.0.0.1:8765/index.html#learn');
  // every question every lesson can ask builds
  console.log('questions:',await pg.evaluate(()=>{
    let n=0; const bad=[];
    for(const L of LESSONS){ for(let t=0;t<30;t++){ for(const k of quizKeys(L.quiz)){ n++; const q=makeQ(k,400); if(!q||!q.choices.some(c=>c.v===q.answer)) bad.push(L.id+':'+k); } } if(quizKeys(L.quiz).length!==5) bad.push(L.id+' has '+quizKeys(L.quiz).length); }
    for(const k of ['ear:69','fingx:71','name:62']) if(!makeQ(k,400)) bad.push(k);
    return {n,bad:[...new Set(bad)]};
  }));
  console.log('locked at start:',await pg.evaluate(()=>LESSONS.map((l,k)=>l.id+(lessonOpen(k)?'':'🔒')).join(' ')));
  await pg.screenshot({path:shots+'/learn-start.png'});
  const answer=async(right)=>{ await pg.evaluate(r=>{ const z=S.quiz,q=z.qs[z.k]; const i=q.choices.findIndex(c=>r?c.v===q.answer:c.v!==q.answer); document.querySelectorAll('[data-act="q-answer"]')[i].click(); },right); };
  // Lesson 1: pass with 5/5
  await pg.click('[data-act="quiz-start"]');
  await answer(true);
  await pg.screenshot({path:shots+'/quiz-q.png'});
  await pg.click('[data-act="q-next"]');
  for(let i=1;i<5;i++){ await answer(true); await pg.click('[data-act="q-next"]'); }
  await pg.screenshot({path:shots+'/quiz-end.png'});
  console.log('after l1:',await pg.evaluate(()=>({stars:S.progress.stars.l1,open2:lessonOpen(1),log:S.progress.log.length})));
  // Lesson 2 (high and low): fail with 3/5
  await pg.click('[data-act="lesson"][data-id="hl"]'); await pg.click('[data-act="quiz-start"]');
  for(let i=0;i<5;i++){ await answer(i<3); await pg.click('[data-act="q-next"]'); }
  console.log('after hl fail:',await pg.evaluate(()=>({stars:S.progress.stars.hl,open3:lessonOpen(2),weak:weakKeys(),text:document.querySelector('.quizend p').textContent})));
  // fingering quiz lesson open via openAll? check the lock pane
  await pg.click('[data-act="lesson"][data-id="fm"]');
  console.log('locked pane:',await pg.evaluate(()=>document.querySelector('#lessonPane').textContent.trim().slice(0,90)));
  // review the mistakes, get them right
  await pg.click('[data-act="review"]');
  const nrev=await pg.evaluate(()=>S.quiz.qs.length);
  for(let i=0;i<nrev;i++){ await answer(true); await pg.click('[data-act="q-next"]'); }
  console.log('review:',nrev,'questions, weak now',await pg.evaluate(()=>weakKeys().length));
  // a game round to log items
  await pg.click('[data-act="game"][data-id="reader"]');
  for(let i=0;i<10;i++){ await pg.evaluate(w=>{ const g=S.game; const m=w?FLUTE.find(f=>f.m!==g.target).m:g.target; document.querySelector(`[data-act="g-answer"][data-m="${m}"]`).click(); },i<2); await pg.click('[data-act="g-next"]'); }
  // open everything and see a flute-choice question
  await pg.evaluate(()=>{ S.settings.openAll=true; }); await pg.click('[data-act="lesson"][data-id="fm"]'); await pg.click('[data-act="quiz-start"]');
  await pg.screenshot({path:shots+'/quiz-flutes.png'});
  await pg.click('[data-act="lesson"][data-id="l5"]'); await pg.click('[data-act="quiz-start"]');
  for(let i=0;i<5 && await pg.evaluate(()=>S.quiz.qs[S.quiz.k].type!=='bar');i++){ await answer(true); await pg.click('[data-act="q-next"]'); }
  await pg.screenshot({path:shots+'/quiz-bar.png'});
  await pg.evaluate(()=>{ S.settings.openAll=false; });
  // fake some practice minutes on earlier days for the chart
  await pg.evaluate(()=>{ const d=new Date(); [12,0,8,15,0,22,9,0,0,14,30,18,6].forEach((v,i)=>{ const x=new Date(d); x.setDate(d.getDate()-13+i); if(v) S.progress.days[dayKey(x)]=v; }); });
  await pg.click('[data-act="grownups"]');
  await pg.screenshot({path:shots+'/grownups.png',fullPage:true});
  await pg.evaluate(()=>document.querySelector('#view-learn').scrollTop=900); await pg.screenshot({path:shots+'/grownups2.png'});
  // reload keeps everything
  await pg.reload(); await pg.waitForTimeout(300);
  console.log('after reload:',await pg.evaluate(()=>({stars:S.progress.stars,log:S.progress.log.map(e=>e.kind+':'+e.score+'/'+e.total),streak:streak(),games:S.progress.games})));
  await pg.setViewportSize({width:390,height:844}); await pg.goto('http://127.0.0.1:8765/index.html#learn'); await pg.waitForTimeout(300);
  console.log('phone width',await pg.evaluate(()=>document.documentElement.scrollWidth));
  await pg.click('[data-act="grownups"]'); console.log('phone width grownups',await pg.evaluate(()=>document.documentElement.scrollWidth));
  await pg.screenshot({path:shots+'/phone-learn.png'});
  console.log('errors:',errs);
  await b.close();
})();
