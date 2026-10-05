// 把现有行为检查复用到真正的 iPad WebKit；测试夹具仅由 DEBUG 启动参数启用。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const gameRoot = path.resolve(__dirname, '../NuannuanFarm/Game');
const core = JSON.parse(fs.readFileSync(path.join(__dirname, 'core-cases.json'), 'utf8'));
const inputs = [path.join(__dirname, 'ipad-check.cjs'), path.join(__dirname, 'native-extra.cjs')];
const additional = inputs.flatMap((file) => {
  const source = fs.readFileSync(file, 'utf8');
  return [...source.matchAll(/check\((['"])(.*?)\1, `([\s\S]*?)`\);/g)]
    .map((match) => ({ name: match[2], body: match[3] }));
});
const cases = [...core, ...additional].map((test) => {
    const match = [null, null, test.name, test.body];
    let body = match[3]
      .replace(/document\.querySelector\(([^)]+)\)\.listeners\.click/g,
        '(() => document.querySelector($1).click())')
      .replace(/button\.listeners\.click\(\)/g, 'button.click()')
      .replace(/document\.querySelector\('#game'\)\.listeners\.pointerdown/g, 'regressionPointer')
      .replace(/window\.listeners\.keydown\((\{key:'w',preventDefault\(\)\{\}\})\)/g,
        "window.dispatchEvent(new KeyboardEvent('keydown', $1))")
      .replace(/(catAtlas|boardingCatAtlas)\.url/g, "$1.getAttribute('src')");
    // 真正的 WebKit 原型方法必须绑定接收者；调用仍然实际绘制。
    body = body.replace('ctx.fillRect=(...args)=>fillRects.push(args);',
      'const originalFillRect=ctx.fillRect.bind(ctx); ctx.fillRect=(...args)=>{fillRects.push(args);originalFillRect(...args);};');
    // 冰箱取药后会真正关门；每次取另一瓶都要重新开门。
    if (match[2] === '漏服一种药可补齐，药袋与冰箱不重复扣库存') {
      body = body.replace("if(location==='fridge') collectMedicineFromFridge('nuannuan',index);",
        "if(location==='fridge') { openFridge(); collectMedicineFromFridge('nuannuan',index); }");
      body = body.replace("collectMedicineFromFridge('nuannuan',1);\n  assert.equal",
        "openFridge(); collectMedicineFromFridge('nuannuan',1);\n  assert.equal");
    }
    // 诊疗完成后宠物停在真实病床边，不能用旧站位远程喂药。
    if (match[2] === '医生和兽医的三日疗程与守卫') {
      body = body.replace("farmTime.day=day; dose('dog',0); dose('dog',1);",
        "farmTime.day=day; player.x=dog.x+20; player.y=dog.y+20; dose('dog',0); dose('dog',1);");
    }
    if (match[2] === '走到真实马旁上马、经门出栏，下马保留马的脚位') {
      body = body.replace('player.x=1007; player.y=500;',
        "player.x=650; player.y=775; for(const a of animals) if(a.cell!==3) a.visitScene='barn'; rebuildGrid();");
    }
    // 成长/闲逛检查结束后，绘制骑乘服装需要确定的空地；随机贴墙站位允许拒绝上马。
    if (match[2] === '围栏与草地动物成长走动、骑马保持蓝衣服') {
      body = body.replace("outfit='blue'; busyUntil=0;",
        "for(const a of animals) if(a.cell!==3) a.visitScene='barn'; " +
        "animals[3].visitScene='farm';animals[3].visitPosition={x:650,y:775};" +
        "animals[3].nextVisitWander=Infinity;rebuildGrid();outfit='blue'; busyUntil=0;");
    }
    // 不用随机种子猜某只牛的位置，明确占住真实门洞后再让开。
    if (match[2] === '奶牛堵门时上马提示等待，让开后可重试，不传送马') {
      body = `
        changeScene('farm'); farmTime.hour=9;
        const horse=animals[3], cow=animals[4], original={...farmAnimalPosition(horse)};
        for(const a of animals) { a.nextWander=Infinity; if(a.cell!==3) a.visitScene='barn'; }
        cow.visitScene='farm'; cow.visitPosition={x:531,y:560}; cow.nextVisitWander=Infinity;
        requestAnimalTravel('horse','ride');
        for(let frame=0;frame<2400&&(route.length||pendingPlace||penGate.destination);frame++) update(1/60);
        assert.equal(riding,false,'实际占住门洞时不能穿过牛上马');
        assert.ok(distance(farmAnimalPosition(horse),original)<.01,'不能传送马');
        cow.visitScene='barn';busyUntil=0;requestAnimalTravel('horse','ride');
        for(let frame=0;frame<3000&&!riding;frame++) update(1/60);
        assert.ok(riding,'门洞让开后可以重试');
        clock=mountStarted+1;updateAnimalTravel(0);walkTo({x:690,y:700});assert.ok(route.length);
      `;
    }
    new vm.Script(body, { filename: match[2] });
    return { name: match[2], body };
});
fs.mkdirSync(path.join(gameRoot, 'tests'), { recursive: true });
fs.writeFileSync(path.join(gameRoot, 'tests/native-cases.json'), JSON.stringify(cases));
console.log(`已生成 ${cases.length} 个 iPad WebKit 回归用例。`);
