// Tests turning heard notes into written notes. Run: node tests/record.test.js [index.html]
const fs=require('fs'), vm=require('vm'), path=require('path');
const file=process.argv[2]||path.join(__dirname,'..','index.html');
const src=fs.readFileSync(file,'utf8');
const core=src.slice(src.indexOf('// ==CORE START=='),src.indexOf('// ==CORE END=='));
const ctx={}; vm.createContext(ctx);
vm.runInContext(core+'\nthis.api={parseABC,transcribe,estimateBeat,barify};',ctx);
const {parseABC,transcribe}=ctx.api;
let fails=0;
const eq=(name,got,want)=>{ const ok=JSON.stringify(got)===JSON.stringify(want); if(!ok){ fails++; console.log('FAIL',name,'\n  got ',JSON.stringify(got),'\n  want',JSON.stringify(want)); } else console.log('ok  ',name); };
// Simple deterministic jitter
let seed=1; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647-0.5; };
// Turn written notes into heard events at a tempo, with timing wobble and a short breath between notes.
function perform(notes,bpm,{jit=0.04,t0=3.21,lat=0.06,detach=0.06}={}){
  const spb=60/bpm, evs=[]; let t=t0;
  notes.forEach((n,i)=>{
    const tiedIn=i>0&&notes[i-1].tie&&notes[i-1].m===n.m;
    if(n.m!=null && !tiedIn){ let d=n.d,j=i; while(notes[j].tie&&notes[j+1]&&notes[j+1].m===n.m){ j++; d+=notes[j].d; } const s=t+lat+rnd()*2*jit; evs.push({m:n.m,start:s,end:t+lat+d*spb-detach}); }
    t+=n.d*spb;
  });
  return evs;
}
const sig=ns=>ns.map(n=>(n.m==null?'z':n.m)+':'+n.d+(n.tie?'-':'')+(n.bar?'|':'')).join(' ');
const abc=a=>parseABC('M:4/4\nL:1/4\nK:G\n'+a).notes;

const hcb=abc('B A G2 | B A G2 | G/G/G/G/ A/A/A/A/ | B A G2 |]');
for(const bpm of [60,80,110]){
  let r=transcribe(perform(hcb,bpm),{spb:60/bpm,phase:3.21+0.75*60/bpm*4,beats:4});
  eq(`Hot Cross Buns with the metronome at ${bpm}`,sig(r.notes),sig(hcb));
  r=transcribe(perform(hcb,bpm),{beats:4});
  eq(`Hot Cross Buns with no metronome at ${bpm} (beat guessed)`,[sig(r.notes),Math.abs(r.bpm-bpm)<=3],[sig(hcb),true]);
}
const mary=abc('B A G A | B B B2 | A A A2 | B d d2 | B A G A | B B B B | A A B A | G4 |]');
let r=transcribe(perform(mary,90,{jit:0.06}),{beats:4});
eq('Mary Had a Little Lamb, no metronome, bigger wobble',sig(r.notes),sig(mary));

// Rests: a beat or more of silence becomes a rest; a short breath does not.
const rests=abc('A B z d | e2 z2 | A4 |]');
r=transcribe(perform(rests,80),{spb:0.75,phase:3.21,beats:4});
eq('rests of one and two beats',sig(r.notes),sig(rests));

// Dotted rhythms and a note held across the bar line.
const dotted=abc('G3/2 A/ B2 | A3 B- | B2 A2 |]');
r=transcribe(perform(dotted,72),{spb:60/72,phase:3.21,beats:4});
eq('dotted notes and a tie over the bar',sig(r.notes),sig(dotted));

// 3 beats in a bar.
const waltz=parseABC('M:3/4\nL:1/4\nK:G\nA2 B | d2 B | A3 |]').notes;
r=transcribe(perform(waltz,90),{spb:60/90,phase:3.21,beats:3});
eq('three beats in a bar',[sig(r.notes),r.meter],[sig(waltz),[3,4]]);

// Starting late on the metronome: the first note still starts bar 1.
r=transcribe(perform(hcb,80,{t0:3.21+0.75*2}),{spb:0.75,phase:3.21,beats:4});
eq('starting on beat 3 still starts bar 1',sig(r.notes),sig(hcb));

// Nothing heard, and a too-short blip.
eq('no notes',transcribe([],{}).notes.length,0);
eq('a blip is ignored',transcribe([{m:69,start:1,end:1.03}],{}).notes.length,0);

console.log(fails?`\n${fails} failed`:'\nAll recording tests passed');
process.exit(fails?1:0);
