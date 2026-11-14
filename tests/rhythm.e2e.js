// Browser test of the rhythm lessons: tapping (on time, missed note, steady lag), the bar builder,
// the other rhythm questions, warm-up, and the Rhythm Tapper game.
// Run: python3 -m http.server 8765 --bind 127.0.0.1 (in the repo), then node tests/rhythm.e2e.js <screenshot-dir>
const {chromium}=require('playwright');
const shots=process.argv[2]||'.';
(async()=>{
  const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
  const pg=await b.newPage({viewport:{width:1180,height:820}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); pg.on('console',m=>{ if(m.type()==='error'&&!/ERR_FAILED/.test(m.text())) errs.push(m.text()); });
  await pg.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  await pg.goto('http://127.0.0.1:8765/index.html#learn');
  await pg.evaluate(()=>{ localStorage.clear(); S.settings.openAll=true; });
  // Tap the pad at each expected time (plus a lag), skipping some notes. Uses real pointer events.
  const tapRun=async(lag,skip=[])=>{
    await pg.click('[data-act="tap-start"]');
    await pg.evaluate(([lag,skip])=>{ const s=S.quiz.tapS; s.expected.forEach((t,k)=>{ if(skip.includes(k)) return; setTimeout(()=>document.querySelector('#tapPad').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})),(t-AC.currentTime+lag)*1000); }); },[lag,skip]);
    await pg.waitForFunction(()=>S.quiz.tapS&&S.quiz.tapS.phase==='done',null,{timeout:30000});
    return pg.evaluate(()=>{ const r=S.quiz.tapS.r; return {right:r.right,ok:r.ok,early:r.early,late:r.late,miss:r.miss,extra:r.extra,bias:Math.round(r.bias*1000),fb:document.querySelector('.feedback').textContent}; });
  };
  // Tap the beat: warm-up, then quiz questions
  await pg.click('[data-act="lesson"][data-id="tb"]');
  await pg.screenshot({path:shots+'/tb-lesson.png'});
  await pg.click('[data-act="warmup"]');
  console.log('warm-up on time:',await tapRun(0.03));
  await pg.screenshot({path:shots+'/tap-done.png'});
  await pg.click('[data-act="q-next"]');
  console.log('warm-up saved nothing:',await pg.evaluate(()=>({log:S.progress.log.length,items:Object.keys(S.progress.items).length})));
  // Rhythm Tapper: first 3 rhythms (on time, a missed note, a steady 80 ms lag)
  await pg.click('[data-act="tapper"]');
  console.log('tapper 1 on time:',await tapRun(0.02)); await pg.click('[data-act="q-next"]');
  console.log('tapper 2 missed note:',await tapRun(0.02,[2])); await pg.click('[data-act="q-next"]');
  console.log('tapper 3 steady lag:',await tapRun(0.08));
  await pg.screenshot({path:shots+'/tapper.png'});
  for(let k=3;k<8;k++){ await pg.click('[data-act="q-next"]'); await tapRun(0.02); }
  await pg.click('[data-act="q-next"]');
  console.log('tapper end:',await pg.evaluate(()=>({best:S.progress.games.tapper,log:S.progress.log.map(e=>e.kind+':'+e.title+':'+e.score+'/'+e.total),text:document.querySelector('.quizend').textContent.replace(/\s+/g,' ').trim()})));
  // Build a bar: too many beats first, then fixed
  await pg.click('[data-act="lesson"][data-id="bb"]');
  await pg.screenshot({path:shots+'/bb-lesson.png'});
  await pg.evaluate(()=>startQuiz('bb',['build:4','build:3'],'warmup'));
  for(const v of ['2','1','2']) await pg.click(`[data-act="b-add"][data-v="${v}"]`);
  console.log('over:',await pg.evaluate(()=>document.querySelector('.bcount').textContent));
  await pg.screenshot({path:shots+'/build-over.png'});
  await pg.click('[data-act="b-check"]');
  console.log('build 4 too many:',await pg.evaluate(()=>document.querySelector('.feedback').textContent));
  await pg.click('[data-act="q-next"]');
  for(const v of ['r1','0.5','0.5','1']) await pg.click(`[data-act="b-add"][data-v="${v}"]`);
  await pg.screenshot({path:shots+'/build-ok.png'});
  await pg.click('[data-act="b-check"]');
  console.log('build 3 right:',await pg.evaluate(()=>document.querySelector('.feedback').textContent));
  // the real bb quiz, answered right
  await pg.click('[data-act="q-next"]'); await pg.click('[data-act="quiz-start"]');
  for(let i=0;i<5;i++){
    const q=await pg.evaluate(()=>{ const q=S.quiz.qs[S.quiz.k]; return {type:q.type,build:q.build}; });
    if(q.type==='build'){ for(const v of ({4:['4'],3:['2','1'],2:['1','1']})[q.build]) await pg.click(`[data-act="b-add"][data-v="${v}"]`); await pg.click('[data-act="b-check"]'); }
    else { if(q.type==='miss') await pg.screenshot({path:shots+'/miss.png'}); await pg.evaluate(()=>{ const q=S.quiz.qs[S.quiz.k]; const i=q.choices.findIndex(c=>c.v===q.answer); document.querySelectorAll('[data-act="q-answer"]')[i].click(); }); }
    await pg.click('[data-act="q-next"]');
  }
  console.log('bb result:',await pg.evaluate(()=>({stars:S.progress.stars.bb,end:document.querySelector('.quizend h2').textContent})));
  // a hear question and a rest question render
  await pg.evaluate(()=>{ S.lesson='rh'; startQuiz('rh',['hear:c:1','rest:2','miss:3:0.5-0.5-1','beats:1.5']); });
  await pg.screenshot({path:shots+'/hear.png'});
  await pg.evaluate(()=>{ const q=S.quiz.qs[0]; const i=q.choices.findIndex(c=>c.v!==q.answer); document.querySelectorAll('[data-act="q-answer"]')[i].click(); });
  await pg.screenshot({path:shots+'/hear-wrong.png'});
  await pg.click('[data-act="q-next"]'); await pg.screenshot({path:shots+'/rest.png'});
  await pg.click('[data-act="lesson"][data-id="rh"]'); await pg.screenshot({path:shots+'/rh-lesson.png'});
  await pg.click('[data-act="lesson"][data-id="rs"]'); await pg.screenshot({path:shots+'/rs-lesson.png'});
  await pg.setViewportSize({width:390,height:844});
  await pg.evaluate(()=>{ startQuiz(null,['tap:4:1-0.5-0.5-1-1-2-2@72'],'tapper'); });
  console.log('phone width tap',await pg.evaluate(()=>document.documentElement.scrollWidth));
  await pg.screenshot({path:shots+'/phone-tap.png'});
  await pg.evaluate(()=>{ S.lesson='bb'; startQuiz('bb',['build:4'],'warmup'); });
  for(const v of ['2','1']) await pg.click(`[data-act="b-add"][data-v="${v}"]`);
  console.log('phone width build',await pg.evaluate(()=>document.documentElement.scrollWidth));
  await pg.screenshot({path:shots+'/phone-build.png'});
  console.log('errors:',errs);
  await b.close();
})();
