'use strict';
const UIRenderer=(()=>{
  let activeCurrency='₽';
  const numberFmt=v=>FinancialEngine.formatMoney(v);
  const money=v=>FinancialEngine.formatCurrencyFull(v);
  const compactMoney=v=>FinancialEngine.formatCurrencyCompact(v);
  const currency=()=>activeCurrency;
  const labelWithCurrency=s=>String(s).replaceAll('THB', activeCurrency).replaceAll('BRL', activeCurrency);
  const pct=v=>FinancialEngine.formatPercent(v);
  const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\"','&quot;');
  let tooltipSeq=0;
  function infoTooltip(text,className=''){
    const raw=String(text??'');
    const id='info-tooltip-'+(++tooltipSeq);
    const aria=esc(raw.replace(/\s+/g,' ').trim());
    const body=esc(raw).replace(/\n/g,'<br>');
    const cls=className?' '+className:'';
    return `<button class="info-tooltip${cls}" type="button" aria-label="${aria}" aria-describedby="${id}"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7"/><path d="M8 7.1v4.2" stroke-linecap="round"/><circle cx="8" cy="4.8" r=".75" fill="currentColor" stroke="none"/></svg><span id="${id}" class="info-tooltip-bubble" role="tooltip">${body}</span></button>`;
  }

  const ICONS={
    briefcase:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7V6a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v1"/><rect x="4" y="7" width="16" height="13" rx="3"/><path d="M4 12h16M10 12v2h4v-2"/></svg>`,
    target:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>`,
    profit:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17l5-5 4 4 7-9"/><path d="M15 7h5v5"/><path d="M5 21h14"/></svg>`,
    roi:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7"/><circle cx="7.5" cy="7.5" r="2.2"/><circle cx="16.5" cy="16.5" r="2.2"/></svg>`,
    calendar:`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>`,
    growth:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18h16"/><path d="M6 15l4-4 3 3 5-7"/><path d="M15 7h3v3"/></svg>`,
    coin:`<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="7" rx="6" ry="3"/><path d="M6 7v7c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M6 11c0 1.7 2.7 3 6 3s6-1.3 6-3"/></svg>`,
    balance:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M5 7h14M8 7l-4 7h8L8 7zM16 7l-4 7h8l-4-7z"/></svg>`,
    pie:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none"/><path d="M12 12V3.5" stroke-linecap="round"/><path d="M12 12l7.4 4.3" stroke-linecap="round"/><path d="M12 12a8.5 8.5 0 0 1 7.4 4.3" fill="none"/></svg>`,
    calculator:`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="3"/><rect x="8" y="6" width="8" height="3" rx="1"/><path d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" stroke-linecap="round" stroke-width="2.2"/></svg>`,
    city:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16"/><path d="M6 20V8.5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2V20"/><path d="M9 10h.01M12 10h.01M15 10h.01M9 14h.01M12 14h.01M15 14h.01" stroke-linecap="round" stroke-width="2.2"/><path d="M10 20v-3.2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V20"/></svg>`,
    settings:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7.1 4l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1a2 2 0 0 1 0 4H21a1.7 1.7 0 0 0-1.6 1z"/></svg>`
  };
  const icon=name=>ICONS[name]||'';

  function tableRows(model){
    const fixedExpenseRows=(model.assumptions.expenseRows||[]).filter(r=>r.showInModel!==false).map(r=>({section:'expenses',customExpense:true,expenseId:r.id,labelText:r.name,value:m=>m.fixedExpenses?.[r.id]||0,fmt:money,removable:r.removable!==false}));
    const assistantExpenseRows=fixedExpenseRows.filter(r=>r.expenseId==='assistente');
    const otherFixedExpenseRows=fixedExpenseRows.filter(r=>r.expenseId!=='assistente');
    const callCenterIncomeRows=model.assumptions.callCenterEnabled===true
      ? [{section:'operations',label:'operatorSurcharge',value:m=>m.operatorSurcharge,fmt:money,financial:true}]
      : [];
    const callCenterExpenseRows=model.assumptions.callCenterEnabled===true
      ? [{section:'expenses',label:'unsuccessfulCallsExpense',value:m=>m.unsuccessfulCallsExpense,fmt:money}]
      : [];
    return [
      {section:'investment',icon:'briefcase',title:'investment',label:'initialPurchase',value:m=>m.initialPurchase,fmt:money},
      {section:'investment',label:'marketingInvestment',value:m=>m.marketingInvestment,fmt:money},
      {section:'operations',icon:'growth',title:'orderIndicators',label:'ridesPerDay',value:m=>m.ridesPerDay,fmt:numberFmt},
      {section:'operations',label:'ridesPerMonth',value:m=>m.ridesPerMonth,fmt:numberFmt},
      ...callCenterIncomeRows,
      {section:'operations',label:'commissionFromCompletedRidesValue',value:m=>m.commissionFromRides,fmt:money,financial:true},
      ...assistantExpenseRows.map((row,index)=>index===0?{...row,icon:'calculator',title:'operatingExpenses'}:row),
      ...callCenterExpenseRows,
      {section:'expenses',label:'smsExpense',value:m=>m.smsExpense,fmt:money},
      {section:'expenses',label:'outboundCallsExpense',value:m=>m.outboundCallsExpense,fmt:money},
      ...otherFixedExpenseRows,
      {section:'expenses',label:'royaltyCombined',value:m=>m.maximRevenue,fmt:v=>money(v)},
      {section:'expenses',label:'totalOperatingExpenses',value:m=>Math.max(0,m.opEx-m.marketingExpense)+m.maximRevenue,fmt:money,subtotal:true,total:true},
      {section:'profit',icon:'profit',title:'profitCash',label:'netProfit',value:m=>m.netProfit,fmt:money,subtotal:true,total:true,sign:true},
      {section:'profit',label:'accumulatedCashFlow',value:m=>m.accumulated,fmt:money,subtotal:true,total:true,sign:true}
    ];
  }
  function getDisplayMonths(model){
    return model.months.slice(2,14);
  }
  function shouldBlankCombined(row,m){return m.isCombinedPreOpening&&['operations','expenses'].includes(row.section)}
  function getTableRows(model){return tableRows(model).map(r=>({label:r.labelText||Localization.t(r.label),value:m=>r.value(m)}))}
  const sectionIconFor=(section)=>({investment:'briefcase',operations:'growth',expenses:'calculator',profit:'profit'}[section]||'briefcase');
  const sectionTitleHtml=(row)=>{
    const titleKey=row.title||({investment:'investment',operations:'orderIndicators',expenses:'operatingExpenses',profit:'profitCash'}[row.section]);
    const title=Localization.t(titleKey);
    return `<button class="section-title-button" type="button" data-section-help="${row.section}" aria-label="Подробнее о разделе ${esc(title)}"><span class="section-badge">${icon(sectionIconFor(row.section))}</span><span class="section-text">${esc(title)}</span><span class="section-more">Подробнее</span><span class="section-button-arrow" aria-hidden="true">›</span></button>`;
  };
  const metricHelp={};
  function metricLabelHtml(row){
    const key=row.label||'';
    const label=esc(labelWithCurrency(row.labelText||Localization.t(row.label)));
    if(key==='initialPurchase'||key==='marketingInvestment'){
      return `<button class="metric-primary-trigger ${key}" type="button" data-detail-type="${key}" aria-label="Подробнее: ${label}"><span>${label}</span><span class="metric-primary-arrow" aria-hidden="true">→</span></button>`;
    }
    const tooltip=metricHelp[key]?infoTooltip(metricHelp[key],'metric-inline-tooltip'):'';
    return `<div class="metric-label-wrap"><span>${label}</span>${tooltip}</div>`;
  }
  function renderKpis(model,state){
    const grid=document.getElementById('kpiGrid');
    if(!grid)return;
    const cities=Array.isArray(window.CityData)?window.CityData:[];
    const city=cities.find(x=>x.id===state.selectedCityId)||state.selectedCitySnapshot||null;
    const fmtNum=v=>Math.round(Number(v)||0).toLocaleString('ru-RU');
    const cityName=city?`${esc(city.city)}, ${esc(city.state)}`:'—';
    const cityPopulation=city?fmtNum(city.population):fmtNum(model.assumptions?.population||0);
    const cityInitialPayment=city?money(city.initialPayment):money(model.assumptions?.initialInvestment||0);
    const avgSub=`${Localization.t('averageMonthlyInvestment')}: ${compactMoney(model.summary.averageMonthlyInvestment||0)}`;
    const monthlyBreakEven=model.summary.breakEvenPeriod?`${Math.round(Number(model.summary.breakEvenPeriod))} месяц`:Localization.t('notAchieved12');
    const cityCard=`<article class="kpi-card city-context-card"><div class="kpi-icon">${icon('city')}</div><div class="city-context-content"><div class="kpi-label">${Localization.t('selectedCity')}</div><div class="city-context-name">${cityName}</div><div class="city-context-meta"><span><strong>${Localization.t('populationHeader')}:</strong> ${cityPopulation} · <strong>${Localization.t('initialPaymentHeader')}:</strong> ${cityInitialPayment}</span></div></div></article>`;
    const items=[
      {k:'initialInvestment',color:'yellow',icon:icon('briefcase'),val:model.summary.totalInvestment,sub:avgSub,fmt:v=>compactMoney(v)},
      {k:'breakEven',color:'green',icon:icon('target'),val:model.summary.paybackPeriod||0,sub:`${Localization.t('monthlyEquilibrium')}: ${monthlyBreakEven}`,fmt:v=>`${model.summary.paybackPeriod?Localization.formatMonthDuration(v):Localization.t('notAchieved12')}`},
      {k:'yearProfit',color:'blue',icon:icon('profit'),val:model.summary.netProfit,fmt:v=>compactMoney(v)},
      {k:'roi12',label:'kpiMargin',color:'purple',icon:icon('roi'),val:model.summary.roi,tooltip:'Доходность инвестиций показывает отношение чистой прибыли к инвестициям в текущем российском расчёте.',fmt:v=>`${Math.round(v)} %`}
    ];
    grid.innerHTML=cityCard+items.map(i=>`<article class="kpi-card ${i.color} kpi-${i.k}"><div class="kpi-icon">${i.icon}</div><div><div class="kpi-label">${Localization.t(i.label||i.k)}${i.tooltip?infoTooltip(i.tooltip,'kpi-title-tooltip'):''}</div><div class="kpi-value" id="kpi-${i.k}"></div>${i.sub?`<div class="kpi-sub">${i.sub}</div>`:''}</div></article>`).join('');
    items.forEach(i=>Animation.animateNumber(document.getElementById('kpi-'+i.k),i.k,i.val,i.fmt));
  }
  function renderTable(model){
    const tbl=document.getElementById('modelTable');
    const displayMonths=getDisplayMonths(model);
    const heads=Array.from({length:12},(_,i)=>i+1);
    const rows=tableRows(model);
    const colgroup='<colgroup><col class="col-section"><col class="col-metric">'+heads.map(()=>'<col class="col-period">').join('')+'</colgroup>';
    let html=`${colgroup}<thead><tr class="phase"><th colspan="2"></th><th colspan="12">${Localization.t('growthPhase')}</th></tr><tr><th>${Localization.t('section')}</th><th>${Localization.t('month')}</th>${heads.map((h,i)=>`<th class="${model.summary.paybackKey===displayMonths[i]?.key?'breakeven':''}">${h}</th>`).join('')}</tr></thead><tbody>`;
    let last='';
    rows.forEach(row=>{
      const first=row.section!==last;last=row.section;
      const rowCls=[row.total?'table-total-row':'',row.financial?'table-financial-row':''].filter(Boolean).join(' ');
      html+=`<tr${rowCls?` class="${rowCls}"`:''}>${first?`<td class="row-label section-name section-title table-section-title ${row.section}" rowspan="${rows.filter(r=>r.section===row.section).length}">${sectionTitleHtml(row)}</td>`:''}<td class="row-label metric-name table-row-label ${row.section}">${metricLabelHtml(row)}</td>`;
      displayMonths.forEach((m,index)=>{
        let val=row.value(m);
        const isInitialPurchase=row.label==='initialPurchase';
        if(isInitialPurchase&&index===0)val=Number(model.summary.initialPayment)||Number(model.assumptions?.initialInvestment)||0;
        const dashOnly=isInitialPurchase&&index!==0;
        const empty=!dashOnly&&((m.isPrep||m.isSetup)&&val===0&&!['netCashFlow','accumulatedCashFlow'].includes(row.label));
        const editable=(row.marketingEditable||row.ridesEditable)&&!empty&&!dashOnly;
        const cls=['table-cell',row.total?'table-total-cell':'',row.financial?'table-financial-cell':'',row.subtotal?'subtotal':'',row.sign?(val<0?'negative':val>0?'positive':''):'',model.summary.paybackKey===m.key?'breakeven':'',(empty||dashOnly)?'muted-cell':'',editable?'editable-month-cell':''].filter(Boolean).join(' ');
        let data='';
        if(row.marketingEditable&&editable)data=` data-month-edit="marketing" data-month-no="${m.monthNo}" data-current-pct="${m.marketingPct}" title="Дважды нажмите, чтобы изменить долю рекламного бюджета"`;
        if(row.ridesEditable&&editable)data=` data-month-edit="rides" data-month-no="${m.monthNo}" data-current-pct="${m.ridesPct}" title="Дважды нажмите, чтобы изменить долю заказов 12-го месяца"`;
        let content=dashOnly?'—':(empty?'':row.fmt(val,m));
        if(editable)content=`<div class="cell-absolute">${row.fmt(val,m)}</div>`;
        html+=`<td data-recalc class="${cls}"${data}>${content}</td>`;
      });
      html+='</tr>';
    });
    html+='</tbody>';
    tbl.innerHTML=html;
  }
  function renderSummary(model){
    const header=document.querySelector('.summary-card h3');
    if(header){header.innerHTML=`<span>${Localization.t('summary12')}</span>${infoTooltip(Localization.t('summary12Tooltip'),'summary-title-tooltip')}`;}
    const rows=[['totalInvestment',model.summary.totalInvestment,'currency'],['totalPartnerRevenue',model.summary.totalPartnerRevenue,'currency'],['summaryOperatingExpenses',model.summary.totalOperatingExpenses,'currency'],['netProfit',model.summary.netProfit,'currency'],['roi12',model.summary.roi,'%'],['paybackPeriod',model.summary.paybackPeriod?Localization.formatMonthDuration(model.summary.paybackPeriod):Localization.t('notAchieved12'),'']];
    document.getElementById('summaryList').innerHTML=rows.map(r=>{
      const cls=r[0]==='summaryOperatingExpenses'?'summary-expense-row':(r[0]==='totalInvestment'?'summary-investment-row':'');
      const value=typeof r[1]==='number'?(r[2]==='%'?Math.round(r[1])+' %':money(r[1])):r[1];
      return `<div class="summary-row ${cls}"><span>${Localization.t(r[0])}</span><span>${value}</span></div>`;
    }).join('');
  }
  function getInsightRows(model){
    const a=model.assumptions||{};
    const s=model.summary||{};
    const recommendedBudget=Math.max(0,Number(s.recommendedMarketingBudget||a.recommendedMarketingBudget||0));
    const budget=Math.max(0,Number(a.marketingBudget||0));
    const budgetRatio=recommendedBudget>0?budget/recommendedBudget:0;
    const budgetPercent=Math.round(budgetRatio*100);
    const recommendedFare=Math.max(0.01,Number(a.recommendedAverageFare||FinancialEngine.recommendedAverageFareForPopulation(a.population)||1));
    const fare=Math.max(0.01,Number(a.averageFare||recommendedFare));
    const fareRatio=fare/recommendedFare;
    const recommendedCommission=Number(a.recommendedCommission??FinancialEngine.recommendedCommissionForPopulation(a.population));
    const commission=Number(a.commission||0);
    const commissionDiff=commission-recommendedCommission;
    const baseRides=Math.max(0,Number(s.baseTargetRidesDay||0));
    const targetRides=Math.max(0,Number(s.targetRidesDay||0));
    const demandRatio=baseRides>0?targetRides/baseRides:0;
    const breakEvenMonth=s.breakEvenPeriod?Localization.formatMonthOrdinal(s.breakEvenPeriod):Localization.t('notAchieved12');
    const paybackMonth=s.paybackPeriod?Localization.formatMonthOrdinal(s.paybackPeriod):Localization.t('notAchieved12');
    const rows=[];

    if(budget<=0){
      rows.push({icon:'briefcase',tone:'danger',title:'budgetZeroTitle',text:'budgetZeroInsight',vars:{}});
    }else if(budgetRatio<0.3){
      rows.push({icon:'briefcase',tone:'danger',title:'budgetCriticalTitle',text:'budgetCriticalInsight',vars:{percent:budgetPercent,recommended:compactMoney(recommendedBudget)}});
    }else if(budgetRatio<0.7){
      rows.push({icon:'briefcase',tone:'warning',title:'budgetBelowTitle',text:'budgetBelowInsight',vars:{percent:budgetPercent,recommended:compactMoney(recommendedBudget)}});
    }else if(budgetRatio<=1.3){
      rows.push({icon:'briefcase',tone:'success',title:'budgetBalancedTitle',text:'budgetBalancedInsight',vars:{percent:budgetPercent,recommended:compactMoney(recommendedBudget)}});
    }else{
      rows.push({icon:'briefcase',tone:'warning',title:'budgetExcessTitle',text:'budgetExcessInsight',vars:{percent:budgetPercent,recommended:compactMoney(recommendedBudget)}});
    }

    if(targetRides<=Math.max(1,baseRides*0.05)){
      rows.push({icon:'growth',tone:'danger',title:'noDemandGrowth',text:'noDemandGrowthText',vars:{}});
    }else{
      const constraints=[];
      if(fareRatio>1.1)constraints.push(Localization.t('fareAboveRecommendation',{percent:Math.round((fareRatio-1)*100)}));
      if(commissionDiff>3)constraints.push(Localization.t('commissionAboveRecommendation',{points:Math.round(commissionDiff*10)/10}));
      const supports=[];
      if(fareRatio<0.9)supports.push(Localization.t('fareBelowRecommendation',{percent:Math.round((1-fareRatio)*100)}));
      if(commissionDiff<-3)supports.push(Localization.t('commissionBelowRecommendation',{points:Math.round(Math.abs(commissionDiff)*10)/10}));
      const joiner=Localization.t('insightJoiner');
      if(constraints.length){
        rows.push({icon:'growth',tone:'warning',title:'parameterConstraintsTitle',text:'parameterConstraintsText',vars:{details:constraints.join(joiner),rides:Math.round(targetRides)}});
      }else if(supports.length){
        rows.push({icon:'growth',tone:'info',title:'demandSupportTitle',text:'demandSupportText',vars:{details:supports.join(joiner),rides:Math.round(targetRides)}});
      }else if(demandRatio>1.1){
        rows.push({icon:'growth',tone:'info',title:'marketCapacityTitle',text:'marketCapacityText',vars:{rides:Math.round(targetRides),base:Math.round(baseRides)}});
      }else if(demandRatio>=0.85){
        rows.push({icon:'growth',tone:'success',title:'balancedDemandTitle',text:'balancedDemandText',vars:{rides:Math.round(targetRides)}});
      }else{
        rows.push({icon:'growth',tone:'warning',title:'limitedDemandTitle',text:'limitedDemandText',vars:{rides:Math.round(targetRides),base:Math.round(baseRides)}});
      }
    }

    if(s.netProfit<0){
      rows.push({icon:'coin',tone:'danger',title:'negativeResult',text:'negativeResultText',vars:{profit:compactMoney(s.netProfit)}});
    }else if(s.roi<20){
      rows.push({icon:'coin',tone:'warning',title:'lowProfitability',text:'lowProfitabilityText',vars:{profit:compactMoney(s.netProfit),roi:Math.round(s.roi)+' %'}});
    }else if(s.roi<60){
      rows.push({icon:'coin',tone:'info',title:'moderateProfitability',text:'moderateProfitabilityText',vars:{profit:compactMoney(s.netProfit),roi:Math.round(s.roi)+' %'}});
    }else{
      rows.push({icon:'coin',tone:'success',title:'highProfitability',text:'profitText',vars:{profit:compactMoney(s.netProfit),roi:Math.round(s.roi)+' %'}});
    }

    if(s.paybackPeriod&&s.paybackPeriod<=6){
      rows.push({icon:'balance',tone:'success',title:'rapidPayback',text:'rapidPaybackText',vars:{month:paybackMonth}});
    }else if(s.paybackPeriod){
      rows.push({icon:'balance',tone:'success',title:'paybackWithinYear',text:'cashText',vars:{month:paybackMonth}});
    }else if(s.breakEvenPeriod){
      rows.push({icon:'balance',tone:'warning',title:'operatingPositiveNoPayback',text:'operatingPositiveNoPaybackText',vars:{month:breakEvenMonth}});
    }else{
      rows.push({icon:'balance',tone:'danger',title:'noPayback',text:'noPaybackText',vars:{}});
    }
    return rows;
  }
  function renderInsights(model){
    const rows=getInsightRows(model);
    const list=document.getElementById('insightsList');
    if(!list)return;
    const renderedRows=rows.map(row=>({
      ...row,
      renderedTitle:Localization.t(row.title),
      renderedText:Localization.t(row.text,row.vars||{})
    }));
    const totalLength=renderedRows.reduce((sum,row)=>sum+row.renderedTitle.length+row.renderedText.length,0);
    const longestText=renderedRows.reduce((max,row)=>Math.max(max,row.renderedText.length),0);
    list.dataset.density=(totalLength>760||longestText>250)?'very-dense':((totalLength>570||longestText>190)?'dense':'normal');
    list.innerHTML=renderedRows.map(row=>`<div class="insight" data-tone="${row.tone||'neutral'}"><div class="insight-badge">${icon(row.icon)}</div><div><div class="insight-title">${row.renderedTitle}</div><div class="insight-text">${row.renderedText}</div></div></div>`).join('');
  }
  const basic=['marketingBudget'];
  function inputLabel(k){if(k==='averageFare')return Localization.t('averageRidePrice');if(k==='commission')return Localization.t('commissionFromCompletedRidesPct');if(k==='initialInvestment')return Localization.t('initialInvestmentInput');return Localization.t(k)}
  function renderInputs(state,errors){
    const gridEl=document.getElementById('inputsGrid');
    const panel=document.getElementById('validationPanel');
    if(!gridEl){return}
    const normalized=FinancialEngine.normalizeAssumptions(state.activeScenario.assumptions);state.activeScenario.assumptions=normalized;
    const currencyHtml=`<div class="input-row fixed-currency-row"><label>${Localization.t('currency')}</label><strong>₽</strong></div>`;
    const formHtml=basic.map(k=>`<div class="input-row ${errors[k]?'invalid':''}"><label for="input-${k}">${labelWithCurrency(inputLabel(k))}</label><input id="input-${k}" data-input="${k}" type="number" step="${['commission','percentagePopulationUsingService'].includes(k)?'0.01':'1'}" value="${normalized[k]}"></div>`).join('');
    const presetManager=`<div class="preset-manager"><div class="preset-row"><label>${Localization.t('marketingDistributionPreset')}</label><select data-preset="marketing"><option value="balanced" ${normalized.marketingDistributionPreset==='balanced'?'selected':''}>Равномерно</option><option value="launchHeavy" ${normalized.marketingDistributionPreset==='launchHeavy'?'selected':''}>Акцент на запуск</option><option value="growth" ${normalized.marketingDistributionPreset==='growth'?'selected':''}>Рост</option><option value="manual" ${normalized.marketingDistributionPreset==='manual'?'selected':''}>Вручную</option></select></div><div class="preset-row"><label>${Localization.t('ridesDistributionPreset')}</label><select data-preset="rides"><option value="balanced" ${normalized.ridesDistributionPreset==='balanced'?'selected':''}>Равномерно</option><option value="slow" ${normalized.ridesDistributionPreset==='slow'?'selected':''}>Плавный рост</option><option value="aggressive" ${normalized.ridesDistributionPreset==='aggressive'?'selected':''}>Быстрый рост</option><option value="manual" ${normalized.ridesDistributionPreset==='manual'?'selected':''}>Вручную</option></select></div><div class="preset-hint">${Localization.t('presetHint')}</div></div>`;
    const expenseRows=(normalized.expenseRows||[]).filter(r=>!r.hidden&&r.id!=='other_costs').map(r=>{
      const fixed=r.fixedType==='assistant'||r.id==='assistente';
      return `<div class="expense-edit-row"><label class="expense-visible-toggle"><input type="checkbox" data-expense-visible="${r.id}" ${r.showInModel!==false?'checked':''} ${fixed?'disabled':''}> ${Localization.t('show')}</label><input class="expense-name" data-expense-name="${r.id}" value="${esc(fixed?Localization.t('assistente'):r.name)}" aria-label="Expense name" ${fixed?'disabled':''}><input class="expense-amount" type="${fixed?'text':'number'}" data-expense-amount="${r.id}" value="${fixed?'250 / 500':r.amount}" aria-label="Expense amount" ${fixed?'disabled':''}><button class="btn danger expense-delete" data-expense-delete="${r.id}" ${r.removable===false?'disabled':''}>×</button></div>`
    }).join('');
    const expenseManager=`<div class="expense-manager"><div class="expense-manager-head"><strong>${Localization.t('operatingExpenses')}</strong><button class="btn secondary" id="addExpenseRow" type="button">${Localization.t('addRow')}</button></div>${expenseRows}</div>`;
    const revenueRules=(normalized.revenueRules||[]).map(r=>`<div class="revenue-rule-row"><span>${Localization.t('feeFrom')}</span><input type="number" data-rule-threshold="${r.id}" value="${r.threshold}"><span>${activeCurrency}</span><span>=</span><input type="number" data-rule-share="${r.id}" value="${r.maximShare}" min="0" max="100"><span>%</span><button class="btn danger revenue-rule-delete" data-rule-delete="${r.id}" ${r.removable===false?'disabled':''}>×</button></div>`).join('');
    const ruleManager=`<div class="revenue-rule-manager"><div class="expense-manager-head"><strong>${Localization.t('revenueDistributionRules')}</strong><button class="btn secondary" id="addRevenueRule" type="button">${Localization.t('addRule')}</button></div>${revenueRules}<div class="preset-hint">${Localization.t('revenueRulesHint')}</div></div>`;
    gridEl.innerHTML=formHtml+(state.advanced?'<div class="advanced-title">'+Localization.t('advancedSettings')+'</div>'+currencyHtml+presetManager+expenseManager:'');
    const list=Object.values(errors);if(panel){panel.hidden=!list.length;panel.innerHTML=list.join('<br>')}
  }
  function renderLegend(){const legendEl=document.getElementById('legendList');if(!legendEl)return;legendEl.innerHTML=`<div class="legend-list"><div class="legend-item"><span class="swatch investment"></span>${Localization.t('investmentLegend')}</div><div class="legend-item"><span class="swatch operations"></span>${Localization.t('operationsLegend')}</div><div class="legend-item"><span class="swatch expenses"></span>${Localization.t('expensesLegend')}</div><div class="legend-item"><span class="swatch profit"></span>${Localization.t('profitLegend')}</div></div>`}
  function renderScenarioSelect(state){const sel=document.getElementById('scenarioSelect');if(!sel)return;sel.innerHTML=`<option value="base">Базовый сценарий спроса</option>`;sel.value='base';}
  function renderAll(state,model,errors={}){
    activeCurrency='₽';
    Localization.setLanguage(state.language);
    const languageSelect=document.getElementById('languageSelect');
    if(languageSelect)languageSelect.value=state.language;
    const modeToggle=document.getElementById('modeToggle');
    if(modeToggle)modeToggle.textContent=Localization.t(state.advanced?'basicSettings':'advancedSettings');
    renderKpis(model,state);
    renderTable(model);
    renderSummary(model);
    renderInsights(model);
    renderLegend();
    const notesArea=document.getElementById('notesArea');
    if(notesArea)notesArea.value=state.activeScenario.notes||'';
    Charts.render(model);
    setTimeout(Animation.flashCells,10);
  }
  return{renderAll,getTableRows,getDisplayMonths,getInsightRows}
})();
