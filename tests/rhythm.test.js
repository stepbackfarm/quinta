// Tests rhythm tapping grades. Run: node tests/rhythm.test.js [index.html]
const fs=require('fs'), vm=require('vm'), path=require('path');
const file=process.argv[2]||path.join(__dirname,'..','index.html');
const src=fs.readFileSync(file,'utf8');
const core=src.slice(src.indexOf('// ==CORE START=='),src.indexOf('// ==CORE END=='));
const ctx={}; vm.createContext(ctx);
vm.runInContext(core+'\nthis.api={gradeTaps,parseTapArg,rhythmItems};',ctx);
const {gradeTaps,parseTapArg}=ctx.api;
let fails=0;
const eq=(name,got,want)=>{ const ok=JSON.stringify(got)===JSON.stringify(want); if(!ok){ fails++; console.log('FAIL',name,'\n  got ',JSON.stringify(got),'\n  want',JSON.stringify(want)); } else console.log('ok  ',name); };
let seed=7; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647-0.5; };
function expectedOf(arg){ const p=parseTapArg(arg), spb=60/p.bpm; let pos=0; const ex=[]; for(const it of p.items){ if(!it.rest) ex.push(2+pos*spb); pos+=it.d; } return {ex,spb,p}; }

const k1='4:1-1-1-1-1-1-1-1@72';
let {ex,spb}=expectedOf(k1);
eq('parse',[parseTapArg(k1).beats,parseTapArg(k1).bpm,parseTapArg(k1).items.length],[4,72,8]);
eq('perfect taps are right',gradeTaps(ex,ex,spb).right,true);
let r=gradeTaps(ex,ex.map(t=>t+0.09),spb);
eq('a steady 90 ms lag (touch and speaker delay) still counts',[r.right,r.ok],[true,8]);
r=gradeTaps(ex,ex.map(t=>t+rnd()*0.12),spb);
eq('±60 ms wobble is right',r.right,true);
r=gradeTaps(ex,ex.filter((_,i)=>i!==4),spb);
eq('a missed note is wrong',[r.right,r.miss,r.res[4]],[false,1,'miss']);
r=gradeTaps(ex,[...ex,ex[3]+0.4,ex[6]+0.4],spb);
eq('two extra taps are wrong',[r.right,r.extra],[false,2]);
r=gradeTaps(ex,ex.map((t,i)=>i===5?t+0.3:t),spb);
eq('one clearly late tap is marked late',[r.res[5],r.right],['late',true]);
r=gradeTaps(ex,ex.map((t,i)=>i>=4?t+0.3:t),spb);
eq('rushing ahead half the time is wrong',r.right,false);
eq('taps during the count-in are ignored',gradeTaps(ex,[ex[0]-2,ex[0]-1.2,...ex],spb).right,true);

// Rests: tapping on a rest is an extra tap.
({ex,spb}=expectedOf('4:1-r1-1-r1-1-1-2@72'));
r=gradeTaps(ex,ex,spb); eq('rests: tapping only the notes is right',r.right,true);
r=gradeTaps(ex,[...ex,ex[0]+spb,ex[1]+spb],spb); eq('rests: tapping through both rests is wrong',r.right,false);

// Eighth notes and dotted rhythms use a tighter window.
({ex,spb}=expectedOf('4:0.5-0.5-1-1-1-0.5-0.5-0.5-0.5-2@66'));
r=gradeTaps(ex,ex.map(t=>t+rnd()*0.1),spb); eq('eighths with small wobble',r.right,true);
const even=[ex[0],ex[0]+spb,ex[0]+2*spb,ex[0]+3*spb]; // quarters where eighths were written
({ex,spb}=expectedOf('4:1.5-0.5-1-1-1.5-0.5-2@66'));
const straight=[0,1,2,3,4,5,6].map(k=>2+k*spb); // all even beats instead of long-short
r=gradeTaps(ex,straight,spb); eq('playing a long-short rhythm evenly is wrong',r.right,false);
r=gradeTaps(ex,ex.map(t=>t+rnd()*0.08),spb); eq('long-short rhythm played right',r.right,true);

// Every rhythm used by the app adds up to whole bars.
const keys=[...src.matchAll(/'tap:(\d:[0-9r.\-]+@\d+)'/g)].map(m=>m[1]);
const bad=keys.filter(k=>{ const p=parseTapArg(k); const sum=p.items.reduce((a,b)=>a+b.d,0); return Math.abs(sum/p.beats-Math.round(sum/p.beats))>1e-9; });
eq(`all ${keys.length} tap rhythms fill whole bars`,bad,[]);

console.log(fails?`\n${fails} failed`:'\nAll rhythm tests passed');
process.exit(fails?1:0);
