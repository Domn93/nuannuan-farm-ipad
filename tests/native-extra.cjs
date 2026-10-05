// 由 native-regression.cjs 提取，在真实 iPad WebKit 中逐例重新加载执行。
// 用例设置初态，使用实际玩法函数、DOM 事件及真实 Canvas，和手动触屏验收分开记录。
check('小状态条不抢触摸，与首页和右侧按钮不重叠', `
  const hud=document.querySelector('#ipad-needs'),rect=hud.getBoundingClientRect();
  assert.equal(getComputedStyle(document.querySelector('.dpad')).display,'none');
  assert.equal(getComputedStyle(document.querySelector('#ipad-run')).display,'none');
  const home=document.querySelector('#ipad-home').getBoundingClientRect();
  const tools=document.querySelector('.header-right').getBoundingClientRect();
  assert.ok(rect.width>200&&rect.height<65,'小状态只占一行');
  assert.ok(rect.left>=home.right&&rect.right<=tools.left,'不遮挡首页或活动按钮');
  assert.ok(rect.top>=0&&rect.bottom<innerHeight*.12,'保留主要游戏画面');
  assert.equal(getComputedStyle(hud).pointerEvents,'none');
  assert.equal(document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2),canvas,'轻点状态条区域仍交给游戏');
  ipadHunger.satiety=10;hygiene.dirt=80;refreshIPadNeeds();
  assert.equal(document.querySelector('#ipad-belly-meter').getAttribute('aria-valuenow'),'10');
  assert.equal(document.querySelector('#ipad-clean-meter').getAttribute('aria-valuenow'),'20');
  assert.ok(document.querySelector('#ipad-belly').classList.contains('needs-care'));
  assert.ok(document.querySelector('#ipad-clean').classList.contains('needs-care'));
  setActivityMenu(true);assert.equal(activityDrawer.hidden,false);
  assert.ok(activityDrawer.getBoundingClientRect().top>=tools.bottom,'活动面板不能盖住右上按钮');
  setActivityMenu(false);
  for(const action of document.querySelectorAll('#interaction-actions button')) {
    action.hidden=false;action.textContent='先收好手里的东西，再回家搓泡泡。'.repeat(4);
  }
  toast('小肚子咕噜噜，找点好吃的吧！');
  const notice=document.querySelector('#toast').getBoundingClientRect();
  const actions=document.querySelector('#interaction-actions').getBoundingClientRect();
  assert.ok(notice.bottom<=actions.top,'提示不能盖住多行动作按钮');
`);

check('12 张地图逐帧走路碰撞、到达与正常出口转场', `
  const coverage=[];
  const exits={junction:['forest','city'],friends:['city'],city:['friends','boardingHouse'],boardingHouse:['city']};
  for(const map of ipadScenes) {
    changeScene(map);farmTime.hour=10;setFarmWeather('sunny');setFarmSeason(0);
    nextRoutineColdAt=Infinity;nextRoutinePetIllnessAt=Infinity;nuannuanHealth.protectedUntil=Infinity;
    for(const animal of animals)animal.visitScene='collision-fixture';
    for(const pet of pets)pet.boarded=true;
    penGate.open=true;balconyDoor.open=true;rebuildGrid();
    const start={x:player.x,y:player.y};
    assert.ok(canWalk(start.x,start.y),map+' 入口落脚');
    for(const point of [[-20,500],[W+20,500],[500,-20],[500,H+20]])
      assert.equal(canWalk(...point),false,map+' 地图边界');
    let walked=0,arrivals=0,frames=0;const transitions=[];
    const targets=[.08,.23,.4,.6,.77,.92].map(fraction=>({...grid[Math.floor(grid.length*fraction)]}));
    for(const target of targets) {
      if(scene!==map)changeScene(map);
      player.x=start.x;player.y=start.y;busyUntil=0;route=[];pendingPlace=null;
      const path=findPath(target);if(!path.length)continue;
      const end={...path[path.length-1]};
      walkTo(target);assert.ok(route.length,map+' 能开始走');
      let crossed=false;
      for(let n=0;n<2400&&route.length;n++) {
        update(1/60);frames++;
        if(scene!==map) {
          assert.ok(exits[map]?.includes(scene),map+' 只允许正常出口转场到 '+scene);
          assert.ok(canWalk(player.x,player.y),map+' 出口后的落脚点');
          transitions.push(scene);crossed=true;break;
        }
        assert.ok(canWalk(player.x,player.y),map+' 行走脚位碰撞');
        assert.ok(map!=='house'||playerClearOfPetBeds(player.x,player.y),map+' 不踩宠物床');
      }
      assert.equal(route.length,0,map+' 走路不能卡住');
      if(!crossed) {assert.ok(distance(player,end)<2,map+' 实际到达终点');arrivals++;}walked++;
    }
    assert.ok(walked>=4,map+' 覆盖至少四条分散路径');
    assert.ok(arrivals>=4,map+' 至少四条图内完整路线');
    coverage.push({map,paths:walked,arrivals,transitions,frames});draw();events.length=0;
  }
  window.regressionEvidence={collisionCoverage:coverage};
`);

check('12 张地图实际动画帧与更新绘制耗时采样', `
  (async () => {
    const samples=[];const realUpdate=update,realDraw=draw;
    let updateTimes=[],drawTimes=[];
    update=dt=>{const t=performance.now();realUpdate(dt);updateTimes.push(performance.now()-t);};
    draw=()=>{const t=performance.now();realDraw();drawTimes.push(performance.now()-t);};
    const avg=values=>values.reduce((sum,value)=>sum+value,0)/values.length;
    const p95=values=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1];
    const scenarios=ipadScenes.map(map=>({map,season:0,weather:'sunny',hour:10}));
    for(const weather of ['cloudy','rain','wind','snow','hail'])
      scenarios.push({map:'farm',season:weather==='snow'?3:0,weather,hour:10});
    scenarios.push({map:'house',season:0,weather:'sunny',hour:21});
    try {
      for(const scenario of scenarios) {
        const {map,season,weather,hour}=scenario;
        changeScene(map);farmTime.hour=hour;setFarmSeason(season);setFarmWeather(weather);
        window.ipadAppPaused=false;
        await new Promise(resolve=>{let n=0;const warmup=()=>++n>=12?resolve():requestAnimationFrame(warmup);requestAnimationFrame(warmup);});
        updateTimes=[];drawTimes=[];const intervals=[];let previous=null;
        await new Promise(resolve=>{
          const tick=t=>{if(previous!==null)intervals.push(t-previous);previous=t;
            intervals.length>=90?resolve():requestAnimationFrame(tick);};requestAnimationFrame(tick);
        });
        const sample={...scenario,frames:intervals.length,fps:Math.round(1000/avg(intervals)),
          frameMs:+avg(intervals).toFixed(2),frameP95Ms:+p95(intervals).toFixed(2),
          frameMaxMs:+Math.max(...intervals).toFixed(2),slowFrames:intervals.filter(value=>value>33.4).length,
          updateMs:+avg(updateTimes).toFixed(2),drawMs:+avg(drawTimes).toFixed(2)};
        assert.ok(Number.isFinite(sample.drawMs)&&updateTimes.length>=60,map+' 采样实际游戏帧');
        samples.push(sample);events.length=0;
      }
    } finally {window.ipadAppPaused=true;update=realUpdate;draw=realDraw;}
    window.regressionEvidence={performanceSamples:samples};
  })();
`);

check('全部鞋袜选项真实点击、换装完成和像素读取', `
  changeScene('house');player.x=places.shoeRack.x;player.y=places.shoeRack.y;
  for(const [attribute,styles,slot] of [['shoe',shoeStyles,'outdoor'],['slipper',slipperStyles,'slippers'],['sock',sockStyles,'socks']]) {
    for(const key of Object.keys(styles)) {
      busyUntil=0;openShoeRack();document.querySelector('[data-'+attribute+'="'+key+'"]').click();
      assert.ok(shoeAction);assert.equal(document.querySelector('#shoes-dialog').open,false);
      clock+=1.9;updateShoeAction();assert.equal(footwear[slot],key);draw();
      assert.ok(ctx.getImageData(600,500,1,1).data[3]);
    }
  }
  assert.ok(captureIPadLife());
`);

check('五套衣服实际换装，四床被子步行铺好，取消不更换', `
  changeScene('house');setFarmSeason(0);
  for(const clothes of ['blue','pajamas','down','robe','pink']) {
    busyUntil=0;player.x=places.wardrobe.x;player.y=places.wardrobe.y;
    wardrobe.open=true;wardrobe.started=null;document.querySelector('#clothes-panel').hidden=false;
    document.querySelector('[data-outfit="'+clothes+'"]').click();assert.equal(wardrobe.pendingOutfit,clothes);
    clock+=2.5;updateHome(0);assert.equal(outfit,clothes);draw();
  }
  closeClothesPanel();
  for(const kind of ['blue','sage','sunny','pink']) {
    busyUntil=0;player.x=places.wardrobe.x;player.y=places.wardrobe.y;
    wardrobe.open=true;wardrobe.started=null;document.querySelector('#clothes-panel').hidden=false;
    document.querySelector('[data-quilt="'+kind+'"]').click();assert.ok(quiltChange);
    for(let n=0;n<1200&&quiltChange;n++){update(1/60);}
    assert.equal(quiltChange,null);assert.equal(quilt,kind);draw();
  }
  busyUntil=0;player.x=places.wardrobe.x;player.y=places.wardrobe.y;
  wardrobe.open=true;wardrobe.started=null;changeQuilt('blue');assert.ok(quiltChange);
  keys.add('ArrowLeft');updateHome();keys.clear();assert.equal(quiltChange,null);assert.equal(quilt,'pink');
  assert.ok(captureIPadLife());
`);

check('蘑菇树叶采集、背包吃饭和图鉴记录独立于消耗', `
  changeScene('forest');const mushrooms=pocket.mushrooms;
  interactExploration('mushroom0');assert.equal(pocket.mushrooms,mushrooms+1);
  interactExploration('mushroom0');assert.equal(pocket.mushrooms,mushrooms+1);
  const leaves=pocket.leaves;collectLeaf('forestLeaves');collectLeaf('forestLeaves');
  assert.equal(pocket.leaves,leaves+1);assert.ok(hasDiscovery('leaf-forest'));assert.ok(hasDiscovery('mushroom'));
  document.querySelector('#open-guide').click();assert.equal(document.querySelector('#guide-dialog').open,true);
  document.querySelector('#close-guide').click();assert.equal(document.querySelector('#guide-dialog').open,false);
  pocket.bread=1;const hearts=pocket.hearts;document.querySelector('#open-backpack').click();
  document.querySelector('#eat-food').click();assert.equal(pocket.bread,0);assert.equal(pocket.hearts,hearts+1);
  document.querySelector('#close-backpack').click();assert.ok(hasDiscovery('mushroom'));
`);

check('交友送花和分享食物守恒，不重复增加友谊奖励', `
  changeScene('friends');hygiene.dirt=0;friendGroup[0].friend=false;
  const hearts=pocket.hearts;interactExploration('friend0');friendAction('flower');
  assert.equal(friendGroup[0].friend,false);assert.equal(pocket.hearts,hearts);
  pocket.flowers=1;friendAction('flower');assert.equal(pocket.flowers,0);assert.equal(pocket.hearts,hearts+1);
  friendAction('hello');assert.equal(pocket.hearts,hearts+1);
  pocket.fruit=1;friendAction('food');assert.equal(pocket.fruit,0);assert.equal(pocket.hearts,hearts+1);
  document.querySelector('#close-friend').click();assert.equal(chattingFriend,null);
`);

check('晴夜流星只能许愿一次，雨天和进入室内清理', `
  changeScene('farm');farmTime.hour=21;farmTime.phase='evening';setFarmWeather('sunny');
  meteor.event={started:clock,until:clock+12,x:400,y:60,wished:false};
  updateMeteor(0);assert.ok(places.wish);wishOnMeteor();assert.ok(meteor.wish);assert.equal(meteor.event.wished,true);
  const until=meteor.wish.until;wishOnMeteor();assert.equal(meteor.wish.until,until);draw();
  clock+=1.7;updateMeteor(0);assert.equal(meteor.wish,null);
  setFarmWeather('rain');updateMeteor(0);assert.equal(meteor.event,null);assert.equal(places.wish,undefined);
  changeScene('house');updateMeteor(0);assert.equal(meteor.placeMap,null);
`);

check('活动列表翻页到小伙伴，往上翻返回且不关闭菜单', `
  changeScene('farm');setActivityMenu(true);activityDrawer.scrollTop=0;
  document.querySelector('#ipad-menu-down').click();assert.ok(activityDrawer.scrollTop>0);
  assert.equal(activityDrawer.hidden,false);
  document.querySelector('#ipad-menu-up').click();assert.equal(activityDrawer.scrollTop,0);
  assert.equal(activityDrawer.hidden,false);setActivityMenu(false);
`);

check('四季、六种天气和全部地图可实际绘制并读取像素', `
  for(const season of [0,1,2,3]) {
    setFarmSeason(season);
    for(const weather of ['sunny','cloudy','rain','wind','snow','hail']) {
      setFarmWeather(weather);
      for(const map of ipadScenes) {
        changeScene(map); draw();
        assert.ok(ctx.getImageData(600,500,1,1).data[3]>0,map+' 不是空白');
      }
    }
  }
`);

check('盆栽浇水和换新苗完成后可以存档', `
  changeScene('house'); balconyDoor.open=true; rebuildGrid();
  for(const plant of housePlants) {
    plant.water=.2; player.x=plant.stand.x; player.y=plant.stand.y;
    busyUntil=0; interactHousePlants(plant.key); assert.ok(plantCare);
    clock+=2.7; updateHousePlants(0); assert.equal(plant.water,1); assert.equal(plantCare,null);
    plant.dead=true; plant.water=0; interactHousePlants(plant.key); assert.ok(plantCare.replacing);
    clock+=3.1; updateHousePlants(0); assert.equal(plant.dead,false); assert.equal(plant.water,1);
  }
  assert.ok(captureIPadLife()); draw();
`);

check('洗澡各阶段和穿浴袍收尾，方向退出不丢衣服', `
  changeScene('house'); player.x=places.bath.x; player.y=places.bath.y; hygiene.dirt=1;
  startBath(); assert.ok(bathSession);
  const started=clock;
  for(const elapsed of [.3,1,3,7.5,8.5,9.3]) {clock=started+elapsed;updateBath();draw();}
  assert.equal(outfit,'robe'); clock=started+10.1; updateBath();
  assert.equal(bathSession,null); assert.equal(hygiene.dirt,0); assert.ok(captureIPadLife());
  startBath(); clock+=3; keys.add('ArrowLeft');updateBath();keys.clear();
  assert.equal(bathSession,null);assert.equal(outfit,'robe');
`);

check('厕所使用、冲水和紧急时限正常收尾', `
  changeScene('house'); useToilet(); assert.ok(toiletSession);
  clock+=2.1; updateToilet(0);assert.ok(toiletSession.flushing);draw();
  clock+=4; updateToilet(0);assert.equal(toiletSession,null);assert.equal(busyUntil,0);
  toiletNeed.started=clock-61; updateToilet(0);assert.ok(toiletNeed.wetClothes);
  toiletNeed.wetClothes=false;toiletNeed.nextAt=clock;updateToilet(0);assert.equal(toiletNeed.started,clock);
  useToilet();assert.equal(toiletNeed.started,null);
`);

check('全部电视节目、换台和关闭使用实际预览画布', `
  changeScene('house');openTv(); assert.ok(tvOn);assert.ok(document.querySelector('#tv-dialog').open);
  for(let index=0;index<tvPrograms.length;index++) {
    document.querySelector('[data-tv-program="'+index+'"]').click();assert.equal(tvProgram,index);
    drawTvPreview();assert.ok(document.querySelector('#tv-preview').getContext('2d').getImageData(20,20,1,1).data[3]);
    draw();
  }
  const last=tvProgram;clock+=tvProgramLength+1;updateTv();assert.equal(tvProgram,(last+1)%tvPrograms.length);
  document.querySelector('#tv-power').click();assert.equal(tvOn,false);assert.equal(document.querySelector('#tv-dialog').open,false);
`);

check('集市、面包店打包取消不扣钱，购买和领取不重复', `
  changeScene('city'); const coins=pocket.coins;
  interactMarket('picnic');assert.ok(marketVisit); changeScene('junction');
  assert.equal(pocket.coins,coins);assert.equal(pocket.bread,0);
  changeScene('bakery');busyUntil=0;interactMarket('picnic');clock+=1.4;updateMarket(0);
  assert.equal(pocket.coins,coins-2);assert.equal(pocket.bread,1);updateMarket(0);assert.equal(pocket.bread,1);
  changeScene('city');busyUntil=0;interactMarket('marketFruit');clock+=1.4;updateMarket(0);
  assert.equal(pocket.fruit,2);assert.equal(pocket.vegetables,1);
  busyUntil=0;interactMarket('marketSeeds');clock+=1.4;updateMarket(0);assert.equal(pocket.flowers,2);
  interactMarket('marketSeeds');assert.equal(marketVisit,null);
  assert.ok(captureIPadLife());
`);

check('森林捕虫、伐木、三种动物互动和结束按钮守恒', `
  changeScene('forest');interactForestAdventure('catchBug'); assert.ok(forestAdventureSession);
  document.querySelector('#ipad-cancel').click();assert.equal(forestAdventureSession,null);assert.equal(pocket.insects,0);
  interactForestAdventure('catchBug');clock+=3.1;updateForestAdventure(0);assert.equal(pocket.insects,1);
  interactForestAdventure('catchBug');assert.equal(forestAdventureSession,null);
  busyUntil=0;interactForestAdventure('chopTree');clock+=3.7;updateForestAdventure(0);assert.equal(pocket.wood,3);
  for(const animal of forestWildlife) {
    busyUntil=0;interactForestAdventure(animal.key);assert.ok(forestAdventureSession);
    clock+=4.1;updateForestAdventure(0);draw();
  }
  assert.equal(pocket.hearts,3);assert.ok(captureIPadLife());
`);

check('空调和阳台门、窗帘、闹钟可触摸选择', `
  changeScene('house');player.x=places.airConditioner.x;player.y=places.airConditioner.y;
  interactAirConditioner('airConditioner');assert.ok(homeAirConditioner.on);draw();
  interactAirConditioner('airConditioner');assert.equal(homeAirConditioner.on,false);
  openHomeAlarm();assert.ok(document.querySelector('#alarm-dialog').open);
  document.querySelector('#nap-duration').value='1.5';document.querySelector('#morning-alarm').value='7';
  document.querySelector('#save-alarm').click();assert.equal(homeAlarm.napHours,1.5);assert.equal(homeAlarm.morningHour,7);
  assert.equal(document.querySelector('#alarm-dialog').open,false);
  balconyDoor.open=true;balconyDoor.progress=1;rebuildGrid();assert.ok(findPath(places.balcony).length);
  player.x=places.curtains.x;player.y=places.curtains.y;busyUntil=0;startCurtainPull();
  for(let n=0;n<180;n++) {clock+=1/60;updateHomeCurtains();draw();}
  assert.equal(homeCurtains.action,null);
`);

check('冰箱全部食品存取的数量守恒，关闭按钮正常', `
  changeScene('house');player.x=places.fridge.x;player.y=places.fridge.y;openFridge();
  for(const item of Object.keys(chilledItems)) {
    pocket[item]=2;const initial=fridge.stock[item];
    transferFridgeItem(item,'store');assert.equal(pocket[item],1);assert.equal(fridge.stock[item],initial+1);
    transferFridgeItem(item,'take');assert.equal(pocket[item],2);assert.equal(fridge.stock[item],initial);
  }
  document.querySelector('#close-fridge').click();assert.equal(fridge.open,false);
  assert.equal(document.querySelector('#fridge-dialog').open,false);
`);

check('触屏结束取消喂食路线，不在原地凭空添粮', `
  changeScene('house');petFood.dog=0;petFood.cat=0;feedHousePets();assert.ok(petFeedingAction);
  document.querySelector('#ipad-cancel').click();assert.equal(petFeedingAction,null);assert.equal(route.length,0);
  clock+=10;updatePetFeeding();assert.equal(petFood.dog,0);assert.equal(petFood.cat,0);
`);

check('城市交友、动物感情、电视和采集间隔在重载后保持', `
  changeScene('city');interactMarket('cityFriend0');
  document.querySelector('[data-friend-action="hello"]').click();assert.ok(cityFriends[0].friend);
  document.querySelector('#close-friend').click();
  animals[2].affinity=88;animals[2].lastPat=clock-10;
  tvOn=true;tvProgram=3;tvProgramStarted=clock-5;
  marketStalls.marketFruit.readyAt=clock+45;forestButterfly.readyAt=clock+40;
  const saved=captureIPadLife();assert.ok(saved);
  cityFriends[0].friend=false;animals[2].affinity=60;tvOn=false;tvProgram=0;
  marketStalls.marketFruit.readyAt=0;forestButterfly.readyAt=0;
  assert.ok(restoreIPadLife(saved));assert.ok(cityFriends[0].friend);assert.equal(animals[2].affinity,88);
  assert.equal(tvOn,true);assert.equal(tvProgram,3);assert.equal(forestButterfly.readyAt,clock+40);
  assert.equal(marketStalls.marketFruit.readyAt,clock+45);draw();
`);
