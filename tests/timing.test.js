// Tests the "Follow me" timing grade. Run: node tests/timing.test.js [index.html]
const fs=require('fs'), vm=require('vm'), path=require('path');
const file=process.argv[2]||path.join(__dirname,'..','index.html');
const src=fs.readFileSync(file,'utf8');
const core=src.slice(src.indexOf('// ==CORE START=='),src.indexOf('// ==CORE END=='));
const ctx={}; vm.createContext(ctx);
vm.runInContext(core+'\nthis.api={parseABC,makeFollow,followTiming,judgeGap,beatStarts};',ctx);
const {parseABC,makeFollow,followTiming,judgeGap}=ctx.api;
let fails=0;
const eq=(name,got,want)=>{ const ok=JSON.stringify(got)===JSON.stringify(want); if(!ok){ fails++; console.log('FAIL',name,'\n  got ',JSON.stringify(got),'\n  want',JSON.stringify(want)); } else console.log('ok  ',name); };

// Hot Cross Buns: B A G2 | B A G2 | G/G/G/G/ A/A/A/A/ | B A G2
const hcb=parseABC('T:Hot Cross Buns\nM:4/4\nL:1/4\nK:G\nB A G2 | B A G2 | G/G/G/G/ A/A/A/A/ | B A G2 |]').notes;
const spb=60/80; // 80 beats a minute
// Play every note through makeFollow at the given onset times (seconds).
function play(notes,times,{wrongAt}={}){
  const st=makeFollow(notes); let k=0;
  notes.forEach((n,i)=>{
    if(n.m==null) return;
    const t=times[k++]*1000;
    if(wrongAt===i){ st.feed({type:'on',m:76,t:t-400}); st.feed({type:'held',m:76,ms:300,t:t-100}); st.feed({type:'off',m:76,t:t-50}); }
    st.feed({type:'on',m:n.m,t}); st.feed({type:'off',m:n.m,t:t+50});
  });
  return st;
}
const beats=ctx.api.beatStarts(hcb);
const perfect=beats.map(b=>2+b*spb);
let st=play(hcb,perfect);
let r=followTiming(hcb,st.targets,st.result,st.onsets,spb);
eq('perfect timing: every note after the first is on the beat',[r.ok,r.early,r.late,r.total],[hcb.length-1,0,0,hcb.length-1]);

// Small human wobble (±60 ms) still counts as on the beat.
const wobble=perfect.map((t,i)=>t+(i%2?0.06:-0.06));
st=play(hcb,wobble); r=followTiming(hcb,st.targets,st.result,st.onsets,spb);
eq('±60 ms wobble is on the beat',r.ok,r.total);

// Holding the first G (a half note) for 3 beats makes only the next note late.
const held=perfect.map((t,i)=>i>=3?t+spb:t);
st=play(hcb,held); r=followTiming(hcb,st.targets,st.result,st.onsets,spb);
eq('a long note makes only the next note late',[r.res[3],r.late,r.ok],['late',1,r.total-1]);

// Cutting the half note short (next note 1 beat early).
const rushed=perfect.map((t,i)=>i>=3?t-spb:t);
st=play(hcb,rushed); r=followTiming(hcb,st.targets,st.result,st.onsets,spb);
eq('rushing a half note makes the next note early',[r.res[3],r.early],['early',1]);

// A wrong note first: that note is orange and not timed.
st=play(hcb,held,{wrongAt:3}); r=followTiming(hcb,st.targets,st.result,st.onsets,spb);
eq('a note that needed a second try is not timed',[st.result[3],r.res[3]===undefined,r.total],['retry',true,hcb.length-2]);

// Eighth notes: 0.375 s apart at 80 bpm; tolerance stays under half the gap.
eq('eighth 120 ms late is late',judgeGap(0.375+0.2,0.375,spb).grade,'late');
eq('eighth 100 ms late is on the beat',judgeGap(0.375+0.1,0.375,spb).grade,'ok');

// Rests count toward the gap.
const withRest=parseABC('L:1/4\nM:4/4\nK:G\nB z A2 |]').notes;
st=play(withRest,[1,1+2*spb]); r=followTiming(withRest,st.targets,st.result,st.onsets,spb);
eq('a rest counts toward the wait',r.res[2],'ok');

// Tied notes: B2- B2 A — A comes 4 beats after B.
const tied=parseABC('L:1/4\nM:4/4\nK:G\nB2- B2 | A4 |]').notes;
st=makeFollow(tied); st.feed({type:'on',m:71,t:1000}); st.feed({type:'off',m:71,t:3900}); st.feed({type:'on',m:69,t:1000+4*spb*1000});
r=followTiming(tied,st.targets,st.result,st.onsets,spb);
eq('a tied note counts its full length',r.res[2],'ok');

console.log(fails?`\n${fails} failed`:'\nAll timing tests passed');
process.exit(fails?1:0);
