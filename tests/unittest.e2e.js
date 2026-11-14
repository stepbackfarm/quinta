// Browser test of the unit tests: locks, every question builds, passing sets the next check, a check comes due,
// failing points back to lessons, the grown-ups table, and phone width.
// Run: python3 -m http.server 8765 --bind 127.0.0.1 (in the repo), then node tests/unittest.e2e.js <screenshot-dir>
const {chromium}=require('playwright');
const shots=process.argv[2]||'.';
(async()=>{
  const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
  const pg=await b.newPage({viewport:{width:1180,height:820}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); pg.on('console',m=>{ if(m.type()==='error'&&!/ERR_FAILED/.test(m.text())) errs.push(m.text()); });
  await pg.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  await pg.goto('http://127.0.0.1:8765/index.html#learn');
  await pg.evaluate(()=>localStorage.clear()); await pg.reload();
  console.log('questions:',await pg.evaluate(()=>{ const bad=[]; let n=0;
    for(const T of UNIT_TESTS){ for(let i=0;i<40;i++){ const ks=quizKeys(T.spec); if(ks.length!==10) bad.push(T.id+' has '+ks.length); for(const k of ks){ n++; const q=makeQ(k,400); if(!q||(!q.tap&&!q.build&&!q.choices.some(c=>c.v===q.answer))) bad.push(k); if(!keyLesson(k)) bad.push('no lesson for '+k); } } }
    const phr=makeQ('phr:67-69-71',400); return {n,bad:[...new Set(bad)],phrChoices:phr.choices.map(c=>c.v)}; }));
  await pg.click('[data-act="lesson"][data-id="test:t1"]');
  console.log('locked:',await pg.evaluate(()=>document.querySelector('#lessonPane').textContent.replace(/\s+/g,' ').trim().slice(0,120)));
  // pass unit 1's lessons
  await pg.evaluate(()=>{ for(const id of ['l1','hl','l6']) S.progress.stars[id]=2; renderLearn(); });
  await pg.click('[data-act="lesson"][data-id="test:t1"]');
  await pg.screenshot({path:shots+'/test-intro.png'});
  const answer=async right=>pg.evaluate(r=>{ const z=S.quiz,q=z.qs[z.k]; const i=q.choices.findIndex(c=>r?c.v===q.answer:c.v!==q.answer); document.querySelectorAll('[data-act="q-answer"]')[i].click(); },right);
  await pg.click('[data-act="quiz-start"]');
  console.log('test types:',await pg.evaluate(()=>S.quiz.qs.map(q=>q.type).join(' ')));
  for(let i=0;i<10;i++){ if(i===0) await pg.screenshot({path:shots+'/test-q.png'}); await answer(i!==4); await pg.click('[data-act="q-next"]'); }
  console.log('pass 9/10:',await pg.evaluate(()=>({end:document.querySelector('.quizend').textContent.replace(/\s+/g,' ').trim(),rec:S.progress.tests.t1,st:testStatus(S.progress.tests.t1.runs,Date.now()).state})));
  await pg.screenshot({path:shots+'/test-pass.png'});
  // a week later the check is due
  await pg.evaluate(()=>{ S.progress.tests.t1.runs[0].t-=8*864e5; S.quiz=null; renderLearn(); });
  console.log('8 days later nav:',await pg.evaluate(()=>document.querySelector('[data-id="test:t1"]').textContent.replace(/\s+/g,' ').trim()));
  await pg.click('[data-act="lesson"][data-id="test:t1"]');
  console.log('pane:',await pg.textContent('#lessonPane .feedback'));
  await pg.screenshot({path:shots+'/test-due.png'});
  // fail the check
  await pg.click('[data-act="quiz-start"]');
  for(let i=0;i<10;i++){ await answer(i<5); await pg.click('[data-act="q-next"]'); }
  console.log('fail 5/10:',await pg.evaluate(()=>({end:document.querySelector('.quizend p').textContent,back:[...document.querySelectorAll('#lessonPane [data-act="lesson"]')].map(b=>b.textContent),st:testStatus(S.progress.tests.t1.runs,Date.now()).state,weak:weakKeys().length})));
  await pg.screenshot({path:shots+'/test-fail.png'});
  // the rhythm test renders its tap and build questions
  await pg.evaluate(()=>{ S.settings.openAll=true; S.lesson='test:t3'; startQuiz('test:t3',['tap:4:1.5-0.5-1-1-1.5-0.5-2@72','build:3','phr:62-71-76'],'test'); });
  await pg.screenshot({path:shots+'/test-tap.png'});
  await pg.evaluate(()=>{ S.lesson='test:t2'; startQuiz('test:t2',['phr:62-71-76'],'test'); }); await pg.screenshot({path:shots+'/test-phr.png'});
  await pg.evaluate(()=>{ S.quiz=null; S.settings.openAll=false; });
  await pg.click('[data-act="grownups"]');
  console.log('grown-ups:',await pg.evaluate(()=>[...document.querySelectorAll('.gtable')][0].innerText.split('\n').slice(0,6).join(' | ')));
  await pg.evaluate(()=>{ const h=[...document.querySelectorAll('#lessonPane h3')].find(x=>/Unit tests/.test(x.textContent)); h.scrollIntoView(); });
  await pg.screenshot({path:shots+'/test-grownups.png'});
  await pg.reload(); console.log('after reload runs:',await pg.evaluate(()=>S.progress.tests.t1.runs.map(r=>r.score)));
  await pg.setViewportSize({width:390,height:844}); await pg.click('[data-act="lesson"][data-id="test:t1"]');
  console.log('phone width',await pg.evaluate(()=>document.documentElement.scrollWidth));
  console.log('errors:',errs);
  await b.close();
})();
