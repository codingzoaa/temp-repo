const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const ctx={document:{querySelector:()=>null,querySelectorAll:()=>[]}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('heatmap.js','utf8'),ctx);
const rows=ctx.mapLayout([{weight:70},{weight:20},{weight:10}],0,0,1000,500);
assert.equal(rows.length,3);for(const r of rows){assert(Math.abs(r.width*r.height/(1000*500)-r.item.weight/100)<1e-10);assert(r.x>=0&&r.y>=0&&r.x+r.width<=1000.001&&r.y+r.height<=500.001);}
for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){const a=rows[i],b=rows[j];assert(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)<1e-8||Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)<1e-8);}
assert.equal(ctx.mapColor(10),ctx.mapColor(3));assert.equal(ctx.mapColor(-10),ctx.mapColor(-3));assert.notEqual(ctx.mapColor(1),ctx.mapColor(-1));assert.equal(ctx.mapLayout([],0,0,1,1).length,0);
console.log('PASS: proportional areas, no overlaps, bounds, empty map and color saturation');
