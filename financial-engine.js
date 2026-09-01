'use strict';
const FinancialEngine=(()=>{
  const monthKeys=['setup','preparation',...Array.from({length:12},(_,i)=>`m${i+1}`)];
  const marketingPresets={
    balanced:[14,13,12,10,9,8,7,6,6,5,5,5],
    launchHeavy:[16,14,12,10,8,8,7,6,5,5,5,4],
    growth:[2,3,4,5,6,7,8,10,12,13,14,16],
    manual:null
  };
  const ridesPresets={
    balanced:[5,10,15,20,30,40,50,60,70,80,90,100],
    slow:[3,6,10,14,18,25,34,45,57,70,84,100],
    aggressive:[8,14,21,29,38,49,61,73,83,90,96,100],
    manual:null
  };
  function n(v){return Number(v)||0}
  function uid(){return 'ex_'+Math.random().toString(36).slice(2,9)}
  function clone(x){return JSON.parse(JSON.stringify(x))}
  function roundTo(value, step){return Math.round(n(value)/step)*step}
  function advertisingPackageForPopulation(_population){return 50065}
  function initialPaymentForPopulation(population){const p=n(population);return p<20000?100000:p<300000?150000:400000}
  function recommendedAverageFareForPopulation(_population){return 250}
  function recommendedCommissionForPopulation(_population){return 12}

  // РФ V3: зрелый потенциал выполненных заказов в день к 12-му месяцу.
  // Потенциал растёт непрерывно, а доля проникновения снижается с ростом города.
  function interpolateByPopulation(population,points){
    const p=Math.max(0,n(population));
    if(p<=points[0][0])return points[0][1];
    if(p>=points[points.length-1][0])return points[points.length-1][1];
    for(let i=0;i<points.length-1;i++){
      const [x0,y0]=points[i],[x1,y1]=points[i+1];
      if(p>=x0&&p<=x1)return y0+(p-x0)*(y1-y0)/(x1-x0);
    }
    return points[points.length-1][1];
  }
  const demandPotentialPoints=[
    // Малые города: до 4 тыс. ориентир 2,3% населения, затем плавное снижение.
    [3000,69],[4000,92],[5000,100],[10000,200],[15000,285],[25000,425],
    // Средние и крупные города: абсолютный потенциал растёт, доля проникновения снижается.
    [40000,600],[80000,900],[100000,940],[150000,1030],[250000,1095],
    [400000,1250],[600000,1350],[1000000,1500]
  ];
  function recommendedDailyPotentialForPopulation(population){
    return interpolateByPopulation(population,demandPotentialPoints);
  }
  function recommendedDailyDemandRateForPopulation(population){
    const p=Math.max(1,n(population));
    return recommendedDailyPotentialForPopulation(p)/p*100;
  }

  // Рекомендуемая реклама: внутри малых когорт используется практичная лестница,
  // далее стартовый бюджет растёт плавно и всё медленнее вместе с потенциалом рынка.
  function recommendedStartMarketingForPopulation(population){
    const p=n(population);
    if(p<=4000)return 8000;
    if(p<=5000)return 10000;
    if(p<=6000)return 12000;
    if(p<=7000)return 15000;
    if(p<=8000)return 20000;
    if(p<=9000)return 25000;
    if(p<=10000)return 30000;
    const points=[
      [10000,30000],[15000,50000],[25000,70000],[40000,100000],[80000,150000],
      [100000,180000],[150000,220000],[250000,260000],[300000,265000],
      [400000,288000],[600000,315000],[1000000,370000]
    ];
    return roundTo(interpolateByPopulation(p,points),500);
  }
  function recommendedMarketingPatternForPopulation(population){
    const start=recommendedStartMarketingForPopulation(population);
    const reduced=roundTo(start*0.75,500);
    // Новая рабочая модель: первые 6 месяцев — 100% стартового бюджета,
    // месяцы 7–12 — 75%.
    return [start,start,start,start,start,start,reduced,reduced,reduced,reduced,reduced,reduced];
  }
  function annualMarketingBudgetForPopulation(population){
    return recommendedMarketingPatternForPopulation(population).reduce((sum,value)=>sum+value,0);
  }

  // Below the recommended budget, underinvestment has a stronger-than-linear
  // impact. Above the recommendation, additional spend has diminishing returns.
  function investmentDemandFactor(annualBudget,population){
    const recommended=annualMarketingBudgetForPopulation(population);
    const budget=Math.max(0,n(annualBudget));
    if(recommended<=0)return budget>0?1:0;
    const ratio=budget/recommended;
    if(ratio<=0)return 0;
    if(ratio<=1)return Math.pow(ratio,1.35);
    return Math.min(1.25,1+Math.sqrt(ratio-1)*0.18);
  }

  // A higher fare increases revenue per ride but reduces demand. A lower fare can
  // improve demand only modestly because price alone cannot create the market.
  function fareDemandFactor(averageFare,population){
    const recommended=recommendedAverageFareForPopulation(population);
    const fare=Math.max(0.01,n(averageFare));
    if(recommended<=0)return 1;
    const ratio=fare/recommended;
    if(ratio>=1)return Math.max(0.35,1-0.8*(ratio-1));
    return Math.min(1.1,1+0.3*(1-ratio));
  }

  // Driver commission affects supply and therefore the share of demand that can
  // actually be fulfilled. High commission is penalised more strongly.
  function commissionFulfillmentFactor(commission,population){
    const recommended=recommendedCommissionForPopulation(population);
    const value=Math.max(0,n(commission));
    const diff=value-recommended;
    if(diff>0)return Math.max(0.25,1-0.03*diff);
    return Math.min(1.1,1+0.01*Math.abs(diff));
  }
  function marketingSharesForPopulation(population){
    const pattern=recommendedMarketingPatternForPopulation(population);const total=pattern.reduce((a,b)=>a+b,0)||1;
    return pattern.map(v=>v/total*100);
  }
  function monthlyMarketingBudgets(annualBudget,population){
    const annual=Math.max(0,n(annualBudget));
    const pattern=recommendedMarketingPatternForPopulation(population);
    const recommended=pattern.reduce((a,b)=>a+b,0)||1;
    const budgets=pattern.map(v=>roundTo(v*annual/recommended,50));
    budgets[11]+=annual-budgets.reduce((sum,value)=>sum+value,0);
    return budgets;
  }
  function defaultExpenseRows(monthly=10000){return[{id:'assistente',name:'Услуга «Ассистент»',amount:0,removable:false,showInModel:true,fixedType:'assistant'},{id:'other_costs',name:'Прочие расходы',amount:0,removable:false,showInModel:false,hidden:true}]}
  function normPctArray(arr,fallback){
    const src=Array.isArray(arr)&&arr.length===12?arr:fallback;
    return src.map(v=>Math.max(0,n(v)));
  }
  function normalizeAssumptions(input={}){
    const a={...defaultAssumptions(),...input};
    delete a.adminCost;
    delete a.activeUsers;
    if(!Array.isArray(a.expenseRows)||!a.expenseRows.length){a.expenseRows=defaultExpenseRows(a.otherCost||a.operatingExpenses||10000)}
    a.expenseRows=a.expenseRows.map((r,i)=>({
      id:r.id||uid(),
      name:String(r.name||`Expense ${i+1}`),
      amount:r.id==='other_costs'?0:n(r.amount),
      showInModel:r.id==='assistente'?true:(r.id==='other_costs'?false:r.showInModel!==false),
      removable:r.id==='assistente'?false:r.removable!==false,
      hidden:r.id==='other_costs'?true:!!r.hidden,
      fixedType:r.id==='assistente'?'assistant':(r.fixedType||null)
    }));
    if(!a.expenseRows.some(r=>r.id==='assistente')){a.expenseRows.unshift({id:'assistente',name:'Услуга «Ассистент»',amount:0,removable:false,showInModel:true,fixedType:'assistant'})} 
    a.expenseRows=a.expenseRows.map(r=>r.id==='assistente'?{...r,name:'Услуга «Ассистент»',amount:0,removable:false,showInModel:true,fixedType:'assistant'}:(r.id==='other_costs'?{...r,name:'Прочие расходы',amount:0,showInModel:false,hidden:true}:r));
    const recommendedBudget=annualMarketingBudgetForPopulation(a.population);
    const recommendedFare=recommendedAverageFareForPopulation(a.population);
    const recommendedCommission=recommendedCommissionForPopulation(a.population);
    // Все параметры доступны для ручного редактирования сразу. Рекомендуемые
    // значения служат стартовыми значениями при выборе города, а не блокировкой.
    a.useRecommendedValues=false;
    a.marketingBudget=Math.max(0,n(a.marketingBudget));
    a.averageFare=Math.max(0.01,n(a.averageFare)||recommendedFare);
    a.commission=Math.min(50,Math.max(0,n(a.commission)));
    a.recommendedMarketingBudget=recommendedBudget;
    a.recommendedAverageFare=recommendedFare;
    a.recommendedCommission=recommendedCommission;
    a.advertisingPackage=advertisingPackageForPopulation(a.population);
    a.marketingDistributionPreset='auto';
    a.marketingDistribution=marketingSharesForPopulation(a.population);
    a.ridesDistributionPreset=a.ridesDistributionPreset||'balanced';
    a.ridesDistribution=normPctArray(a.ridesDistribution,ridesPresets[a.ridesDistributionPreset]||ridesPresets.balanced);
    a.percentagePopulationUsingService=recommendedDailyDemandRateForPopulation(a.population);
    a.autoPopulationUsingService=false;
    // Работа с КЦ включается пользователем отдельно. Для старых сохранённых
    // сценариев без этого параметра безопасное значение по умолчанию — выключено.
    a.callCenterEnabled=a.callCenterEnabled===true;
    const legacyThailandRules=Array.isArray(a.revenueRules)&&a.revenueRules.some(r=>[20000,30000,40000,50000].includes(n(r.threshold)));
    if(!Array.isArray(a.revenueRules)||!a.revenueRules.length||legacyThailandRules||(a.revenueRules.length===1&&n(a.revenueRules[0].threshold)===0&&n(a.revenueRules[0].maximShare)===100)){a.revenueRules=defaultRevenueRules()}
    a.revenueRules=a.revenueRules.map((r,i)=>({id:r.id||uid(),threshold:Math.max(0,n(r.threshold)),maximShare:Math.min(100,Math.max(0,n(r.maximShare))),removable:r.removable!==false})).sort((x,y)=>x.threshold-y.threshold);
    return a;
  }
  function defaultRevenueRules(){return[{id:'rr_0',threshold:0,maximShare:0,removable:false}]}
  function defaultAssumptions(type='base'){
    const presets={
      conservative:{population:100000,averageFare:250,commission:12,rideGrowth:10,marketingBudget:817450,initialInvestment:150000,operatingExpenses:0,percentagePopulationUsingService:1.7,useRecommendedValues:false,callCenterEnabled:false,expenseRows:defaultExpenseRows(0),marketingDistributionPreset:'balanced',marketingDistribution:clone(marketingPresets.balanced),ridesDistributionPreset:'slow',ridesDistribution:clone(ridesPresets.slow)},
      base:{population:100000,averageFare:250,commission:12,rideGrowth:18,marketingBudget:1729500,initialInvestment:150000,operatingExpenses:0,percentagePopulationUsingService:1.7,useRecommendedValues:false,callCenterEnabled:false,expenseRows:defaultExpenseRows(0),marketingDistributionPreset:'balanced',marketingDistribution:clone(marketingPresets.balanced),ridesDistributionPreset:'balanced',ridesDistribution:clone(ridesPresets.balanced)},
      optimistic:{population:100000,averageFare:250,commission:12,rideGrowth:25,marketingBudget:1729500,initialInvestment:150000,operatingExpenses:0,percentagePopulationUsingService:1.7,useRecommendedValues:false,callCenterEnabled:false,expenseRows:defaultExpenseRows(0),marketingDistributionPreset:'growth',marketingDistribution:clone(marketingPresets.growth),ridesDistributionPreset:'aggressive',ridesDistribution:clone(ridesPresets.aggressive)}
    };
    return clone(presets[type]||presets.base)
  }
  function calculateCore(assumptions){
    const a=normalizeAssumptions(assumptions);
    const months=[];let accumulated=0;
    const baseDemandRate=recommendedDailyDemandRateForPopulation(a.population);
    const baseTargetRidesDay=Math.round(recommendedDailyPotentialForPopulation(a.population));
    const budgetDemandFactor=investmentDemandFactor(a.marketingBudget,a.population);
    const fareFactor=fareDemandFactor(a.averageFare,a.population);
    const commissionFactor=commissionFulfillmentFactor(a.commission,a.population);
    const combinedDemandFactor=budgetDemandFactor*fareFactor*commissionFactor;
    const targetRidesDay=Math.max(0,Math.round(baseTargetRidesDay*combinedDemandFactor));
    const autoMarketingBudgets=monthlyMarketingBudgets(a.marketingBudget,a.population);
    for(let i=0;i<14;i++){
      const isSetup=i===0,isPrep=i===1,monthNo=i-1;
      const mIndex=i-2;
      const marketingInvestment=i>1?autoMarketingBudgets[mIndex]:0;
      const investment=isSetup?n(a.initialInvestment):marketingInvestment;
      const ridesPerDay=i>1?Math.round(targetRidesDay*n(a.ridesDistribution[mIndex])/100):0;
      const ridesPerMonth=i>1?Math.round(ridesPerDay*30):0;
      const gross=ridesPerMonth*n(a.averageFare);
      const commissionFromRides=gross*n(a.commission)/100;
      // Показатели Контакт центра участвуют в модели только при включённом параметре.
      // Надбавка «Оператор»: 5% выполненных заказов относятся к КЦ, 25 ₽ за выполненный заказ.
      const operatorOrders=i>1&&a.callCenterEnabled?Math.ceil(ridesPerMonth*0.05):0;
      const operatorSurcharge=operatorOrders*25;
      // Звонки КЦ: выполненные заказы через КЦ × 1,25 (учёт принятых заказов)
      // × 1,2 звонка в среднем на результативный заказ. Стоимость звонка — 16 ₽.
      const callCenterCallOrders=i>1&&a.callCenterEnabled?operatorOrders*1.25*1.2:0;
      const unsuccessfulCallsExpense=callCenterCallOrders*16;
      // СМС: среднее по франчайзинговой сети — 10% от выполненных заказов, 8 ₽ за СМС.
      const smsExpense=i>1?ridesPerMonth*0.10*8:0;
      // ИВР: базово 1 ИВР на 20 выполненных заказов. При КЦ каждый звонок добавляет
      // 2 ИВР: «машина назначена» и «водитель приехал». Стоимость одного ИВР — 2,5 ₽.
      const baseIvrCount=i>1?ridesPerMonth/20:0;
      const extraIvrCount=i>1&&a.callCenterEnabled?callCenterCallOrders*2:0;
      const ivrCount=baseIvrCount+extraIvrCount;
      const outboundCallsExpense=ivrCount*2.5;
      const communicationExpenses=unsuccessfulCallsExpense+smsExpense+outboundCallsExpense;
      const totalOperatingIncome=commissionFromRides+operatorSurcharge;
      // Валовая прибыль партнёра для расчёта роялти:
      // комиссия по выполненным заказам + надбавка «Оператор»
      // − звонки в КЦ − СМС − исходящая связь.
      const grossProfit=totalOperatingIncome-communicationExpenses;
      const royaltyBase=Math.max(0,grossProfit);
      // Роялти не взимается при валовой прибыли ниже 30 000 ₽.
      // От 30 000 до 39 999,99 ₽ ставка составляет 10%.
      // За каждые следующие полные 10 000 ₽ ставка увеличивается на 2 п.п.,
      // но не может превышать 30%.
      const maximShare=royaltyBase<30000
        ? 0
        : Math.min(30,10+Math.floor((royaltyBase-30000)/10000)*2);
      const maximRevenue=royaltyBase*maximShare/100;
      const partner=totalOperatingIncome-maximRevenue;
      const fixedExpenses={};
      let fixedExpenseTotal=0;
      if(i>1){
        a.expenseRows.filter(r=>r.showInModel!==false).forEach(r=>{
          // Услуга «Ассистент» рассчитывается от суммы роялти за месяц:
          // до 3 000 ₽ — 7 000 ₽; от 3 000 ₽ до 38 999,99 ₽ — 14 000 ₽;
          // от 39 000 ₽ — 21 000 ₽. В первый рабочий месяц (месяц 1)
          // применяется скидка 50%; со второго месяца действует полный тариф.
          const assistantBase=r.fixedType==='assistant'
            ? (maximRevenue<3000?7000:maximRevenue<39000?14000:21000)
            : 0;
          const val=r.fixedType==='assistant'
            ? assistantBase*(i===2?0.5:1)
            : Math.round(n(r.amount));
          fixedExpenses[r.id]=val;fixedExpenseTotal+=val;
        });
      }
      const assistantExpense=fixedExpenses.assistente||0;
      const opEx=i>1?marketingInvestment+fixedExpenseTotal+communicationExpenses:0;
      const initialFeeInMonth=i===2?n(a.initialInvestment):0;
      const netProfit=i>1?(partner-opEx-initialFeeInMonth):0;
      const netCashFlow=i>1?netProfit:0;
      accumulated+=netCashFlow;
      const margin=partner?netProfit/partner*100:0;
      months.push({key:monthKeys[i],index:i,monthNo,isSetup,isPrep,marketingPct:i>1?n(a.marketingDistribution[mIndex]):0,ridesPct:i>1?n(a.ridesDistribution[mIndex]):0,targetRidesDay,investment,initialPurchase:isSetup?investment:0,marketingInvestment,ridesPerDay,ridesPerMonth,averageFare:n(a.averageFare),gross,commission:n(a.commission),commissionFromRides,operatorOrders,operatorSurcharge,callCenterCallOrders,baseIvrCount,extraIvrCount,ivrCount,totalOperatingIncome,grossProfit,royaltyBase,maximShare,revenue:maximRevenue,maximRevenue,partnerShare:100-maximShare,partner,marketingExpense:marketingInvestment,assistantExpense,unsuccessfulCallsExpense,smsExpense,outboundCallsExpense,communicationExpenses,royaltyExpense:maximRevenue,fixedExpenses,opEx,netProfit,margin,netCashFlow,accumulated})
    }
    const yearMonths=months.slice(2);
    const initialPayment=n(a.initialInvestment);
    const totalMarketingInvestment=yearMonths.reduce((s,x)=>s+x.marketingInvestment,0);
    const totalAssistantExpense=yearMonths.reduce((s,x)=>s+(x.fixedExpenses?.assistente||0),0);
    const totalCommunicationExpenses=yearMonths.reduce((s,x)=>s+x.communicationExpenses,0);
    const totalRoyaltyExpense=yearMonths.reduce((s,x)=>s+x.royaltyExpense,0);
    const totalExpenses=yearMonths.reduce((s,x)=>s+x.opEx,0);
    // Общие операционные расходы соответствуют строке «Итого» в разделе
    // «ОПЕРАЦИОННЫЕ РАСХОДЫ»: фиксированные расходы, связь и роялти.
    // Реклама относится к разделу «ИНВЕСТИЦИИ» и здесь не дублируется.
    const totalOperatingExpenses=Math.max(0,totalExpenses-totalMarketingInvestment)+totalRoyaltyExpense;
    // Инвестиции = паушальный взнос + реклама за 12 месяцев.
    const totalInvestment=initialPayment+totalMarketingInvestment;
    const totalCommissionFromRides=yearMonths.reduce((s,x)=>s+x.commissionFromRides,0);
    const totalOperatorSurcharge=yearMonths.reduce((s,x)=>s+x.operatorSurcharge,0);
    // Выручка = комиссия по выполненным заказам + надбавка «Оператор».
    const totalRevenue=totalCommissionFromRides+totalOperatorSurcharge;
    const totalPartnerRevenue=totalRevenue;
    const averageMonthlyInvestment=totalInvestment/12;
    const netProfit=yearMonths.reduce((s,x)=>s+x.netProfit,0);
    const roi=totalInvestment?netProfit/totalInvestment*100:0;
    const breakEven=months.find(x=>x.index>1&&x.netProfit>=0);
    const payback=months.find(x=>x.index>1&&x.accumulated>=0);
    return{assumptions:a,months,summary:{initialPayment,totalMarketingInvestment,totalAssistantExpense,totalCommunicationExpenses,totalRoyaltyExpense,totalOperatingExpenses,totalInvestment,totalRevenue,totalPartnerRevenue,totalCommissionFromRides,totalOperatorSurcharge,totalExpenses,averageMonthlyInvestment,netProfit,roi,breakEvenPeriod:breakEven?breakEven.monthNo:null,breakEvenKey:breakEven?breakEven.key:null,paybackPeriod:payback?payback.monthNo:null,paybackKey:payback?payback.key:null,targetRidesDay,baseTargetRidesDay,baseDemandRate,budgetDemandFactor,fareDemandFactor:fareFactor,commissionFulfillmentFactor:commissionFactor,combinedDemandFactor,recommendedMarketingBudget:a.recommendedMarketingBudget}}
  }
  function calculate(assumptions){
    return calculateCore(normalizeAssumptions(assumptions));
  }
  function formatMoney(v,compact=false){
    const value=n(v);
    const abs=Math.abs(value);
    const sign=value<0?'-':'';
    if(compact&&abs>=1000000){
      const scaled=abs/1000000;
      const digits=scaled>=10||Number.isInteger(scaled)?0:1;
      return sign+scaled.toLocaleString('ru-RU',{minimumFractionDigits:0,maximumFractionDigits:digits})+' млн';
    }
    if(compact&&abs>=1000){
      const scaled=abs/1000;
      const digits=scaled>=100||Number.isInteger(scaled)?0:1;
      return sign+scaled.toLocaleString('ru-RU',{minimumFractionDigits:0,maximumFractionDigits:digits})+' тыс.';
    }
    return sign+Math.round(abs).toLocaleString('ru-RU');
  }
  function formatCurrencyFull(v){return `${n(v)<0?'-':''}${formatMoney(Math.abs(n(v)),false)} ₽`}
  function formatCurrencyCompact(v){return `${n(v)<0?'-':''}${formatMoney(Math.abs(n(v)),true)} ₽`}
  function formatPercent(v){return `${Math.round(v)} %`}
  function createExpenseRow(name='New Expense',amount=0){return{id:uid(),name,amount,removable:true,showInModel:true}}
  function createRevenueRule(threshold=0,maximShare=100){return{id:uid(),threshold, maximShare, removable:true}}
  function applyPreset(assumptions,type,preset){
    const a=normalizeAssumptions(assumptions);
    if(type==='marketing'&&marketingPresets[preset]){a.marketingDistributionPreset=preset;a.marketingDistribution=clone(marketingPresets[preset])}
    if(type==='rides'&&ridesPresets[preset]){a.ridesDistributionPreset=preset;a.ridesDistribution=clone(ridesPresets[preset])}
    return a;
  }
  return{calculate,defaultAssumptions,normalizeAssumptions,createExpenseRow,createRevenueRule,formatMoney,formatCurrencyFull,formatCurrencyCompact,formatPercent,monthKeys,marketingPresets,ridesPresets,applyPreset,advertisingPackageForPopulation,initialPaymentForPopulation,annualMarketingBudgetForPopulation,recommendedAverageFareForPopulation,recommendedCommissionForPopulation,recommendedDailyDemandRateForPopulation,recommendedDailyPotentialForPopulation,investmentDemandFactor,fareDemandFactor,commissionFulfillmentFactor,marketingSharesForPopulation,monthlyMarketingBudgets}
})();
