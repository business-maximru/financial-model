'use strict';
const RealCasesUI=(()=>{
  let activeCase=null;
  let caseChart=null;
  const money=v=>FinancialEngine.formatCurrencyFull(v);
  const compact=v=>FinancialEngine.formatCurrencyCompact(v);
  const num=v=>Math.round(Number(v)||0).toLocaleString('ru-RU');
  const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const signedMoney=v=>`${Number(v)>=0?'+':''}${FinancialEngine.formatCurrencyFull(v)}`;
  const total=(c,key)=>c.months.reduce((s,m)=>s+(Number(m[key])||0),0);

  function ensureButtons(){
    const strip=document.querySelector('.actions-strip-compact');
    const consult=document.getElementById('desktopConsultCta');
    if(strip&&consult&&!document.getElementById('realCasesBtn')){
      const btn=document.createElement('button');
      btn.id='realCasesBtn'; btn.type='button'; btn.className='btn icon-btn top-action-btn real-cases-trigger';
      btn.setAttribute('aria-label','Реальные примеры'); btn.title='Реальные примеры';
      btn.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 19V9M10 19V5M16 19v-7M3 19h18"></path><circle cx="4" cy="7" r="1.5"></circle><circle cx="10" cy="3" r="1.5"></circle><circle cx="16" cy="10" r="1.5"></circle></svg><span class="top-action-label">Реальные примеры</span>';
      strip.insertBefore(btn,consult);
    }
    // Desktop only: swap the positions of "Реальные примеры" and "Сменить город".
    // Final order: Параметры → Реальные примеры → Сменить город → MAX.
    if(strip&&consult&&window.matchMedia('(min-width:821px)').matches){
      const pair=strip.querySelector('.top-action-pair');
      const real=document.getElementById('realCasesBtn');
      const change=document.getElementById('changeCityBtn');
      if(pair&&real&&change){
        pair.appendChild(real);
        strip.insertBefore(change,consult);
      }
    }
    const actions=document.querySelector('#mobileKpiScreen .mobile-screen-actions');
    if(actions&&!document.getElementById('mobileRealCasesBtn')){
      const btn=document.createElement('button');
      btn.id='mobileRealCasesBtn';btn.type='button';btn.className='mobile-icon-action mobile-action-pill mobile-action-real-cases';
      btn.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 19V9M10 19V5M16 19v-7M3 19h18"></path><circle cx="4" cy="7" r="1.5"></circle><circle cx="10" cy="3" r="1.5"></circle><circle cx="16" cy="10" r="1.5"></circle></svg><span class="mobile-action-label">Реальные примеры</span>';
      actions.appendChild(btn);
    }
  }

  function ensureModals(){
    if(document.getElementById('realCasesModal'))return;
    const wrap=document.createElement('div');
    wrap.innerHTML=`
    <div class="real-cases-modal" hidden id="realCasesModal" aria-hidden="true">
      <div class="real-cases-backdrop" data-real-cases-close></div>
      <section class="real-cases-panel" role="dialog" aria-modal="true" aria-labelledby="realCasesTitle">
        <header class="real-cases-head">
          <div><span class="real-cases-eyebrow">Фактические данные действующих проектов</span><h2 id="realCasesTitle">Реальные примеры</h2><p>Сравните проекты, где системное развитие дало результат, и кейсы, где управленческие ошибки не позволили окупить вложения.</p></div>
          <button class="real-cases-close" type="button" data-real-cases-close aria-label="Закрыть">×</button>
        </header>
        <div class="real-cases-body" id="realCasesBody"></div>
      </section>
    </div>
    <div class="real-case-view" hidden id="realCaseView" aria-hidden="true">
      <div class="real-case-view-backdrop"></div>
      <section class="real-case-view-panel" role="dialog" aria-modal="true" aria-labelledby="realCaseViewTitle">
        <header class="real-case-view-head">
          <div class="real-case-view-head-main"><span class="real-case-mode-badge">Реальный кейс · данные зафиксированы</span><h2 id="realCaseViewTitle"></h2><p id="realCaseViewMeta"></p></div>
          <div class="real-case-view-actions"><button class="btn secondary" type="button" id="backToRealCases">← Все примеры</button><a class="btn primary top-consult-cta real-case-max" href="https://taxs.ee/maxbot" target="_blank" rel="noopener noreferrer"><span class="max-cta-brand"><img alt="MAX" src="assets/max-cta.png"></span><span>Обсудить в MAX</span></a><button class="real-cases-close" type="button" data-real-case-close aria-label="Закрыть">×</button></div>
        </header>
        <div class="real-case-view-body" id="realCaseViewBody"></div>
      </section>
    </div>`;
    document.body.append(...wrap.children);
  }

  function metric(label,value,sub='',tone=''){
    return `<div class="real-case-kpi ${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong>${sub?`<small>${esc(sub)}</small>`:''}</div>`;
  }
  function caseCard(c){
    const isSuccess=c.type==='success';
    const result=c.totalNetProfit;
    return `<button class="real-case-card ${isSuccess?'is-success':'is-failure'}" type="button" data-real-case-id="${esc(c.id)}">
      <div class="real-case-card-top"><span class="real-case-status">${isSuccess?'Успешная франшиза':'Проблемный проект'}</span><span class="real-case-open">Открыть кейс →</span></div>
      <h3>${esc(c.prefix)} ${esc(c.displayName)}</h3>
      <div class="real-case-location">${esc(c.region)} · ${num(c.population)} жителей</div>
      <strong class="real-case-card-title">${esc(c.title)}</strong>
      <ul>${c.bullets.slice(0,3).map(b=>`<li>${esc(b)}</li>`).join('')}</ul>
      <div class="real-case-card-metrics"><span><small>Результат за год</small><b class="${result>=0?'positive':'negative'}">${esc(signedMoney(result))}</b></span><span><small>Окупаемость</small><b>${c.paybackMonth?`${c.paybackMonth}-й месяц`:'не окупился'}</b></span></div>
    </button>`;
  }
  function renderList(){
    const host=document.getElementById('realCasesBody'); if(!host)return;
    const success=RealCaseData.filter(c=>c.type==='success');
    const failure=RealCaseData.filter(c=>c.type==='failure');
    host.innerHTML=`<div class="real-cases-columns">
      <section class="real-cases-group success"><div class="real-cases-group-head"><span class="real-cases-group-icon">✓</span><div><h3>Успешная франшиза</h3><p>Партнёр системно развивал город и продолжал инвестировать в рост.</p></div></div><div class="real-case-cards">${success.map(caseCard).join('')}</div></section>
      <section class="real-cases-group failure"><div class="real-cases-group-head"><span class="real-cases-group-icon">!</span><div><h3>Неудачный проект</h3><p>Реальные примеры того, как ошибки управления влияют на результат.</p></div></div><div class="real-case-cards">${failure.map(caseCard).join('')}</div></section>
    </div><p class="real-cases-footnote">Финансовые показатели в кейсах взяты из фактических месячных отчётов. Паушальный взнос учитывается отдельно при расчёте окупаемости проекта.</p>`;
  }
  function openList(){
    ensureModals();renderList();
    const m=document.getElementById('realCasesModal');m.hidden=false;m.setAttribute('aria-hidden','false');document.body.classList.add('real-cases-open');
  }
  function closeList(){const m=document.getElementById('realCasesModal');if(m){m.hidden=true;m.setAttribute('aria-hidden','true');} if(document.getElementById('realCaseView')?.hidden)document.body.classList.remove('real-cases-open');}
  function closeView(){const v=document.getElementById('realCaseView');if(v){v.hidden=true;v.setAttribute('aria-hidden','true');} if(caseChart){try{caseChart.destroy()}catch(_){}caseChart=null;} activeCase=null; if(document.getElementById('realCasesModal')?.hidden)document.body.classList.remove('real-cases-open');}

  function buildTable(c){
    const ms=c.months;
    const headers=ms.map(m=>`<th>${m.month}</th>`).join('');
    const dash='—';
    const cells=(fn,cls='')=>ms.map((m,i)=>`<td class="${cls}">${fn(m,i)}</td>`).join('');
    const row=(label,fn,cls='')=>`<tr class="${cls}"><th>${label}</th>${cells(fn,cls)}</tr>`;
    return `<div class="real-case-table-wrap"><table class="real-case-table"><thead><tr><th>Показатель</th>${headers}</tr></thead><tbody>
      <tr class="real-case-section investment"><th colspan="13">ИНВЕСТИЦИИ</th></tr>
      ${row('Паушальный взнос',(m,i)=>i===0?money(c.initialPayment):dash)}
      ${row('Реклама',m=>money(m.advertising))}
      <tr class="real-case-section income"><th colspan="13">ДОХОДЫ</th></tr>
      ${row('Выполненные заказы в день',m=>num(Math.round(Number(m.ridesPerDay)||0)))}
      ${row('Выполненные заказы в месяц',m=>num(m.completed))}
      ${row('Комиссия водителей',m=>money(m.driverCommission))}
      ${row('Надбавка «Оператор»',m=>money(m.operatorSurcharge))}
      ${row('Выручка',m=>money(m.revenue),'real-case-revenue-row')}
      <tr class="real-case-section expenses"><th colspan="13">ОПЕРАЦИОННЫЕ РАСХОДЫ</th></tr>
      ${row('Услуга «Ассистент»',m=>money(m.assistant))}
      ${row('Звонки в КЦ',m=>money(m.callCenter))}
      ${row('СМС',m=>money(m.sms))}
      ${row('ИВР',m=>money(m.ivr))}
      ${row('Роялти',m=>money(m.royalty))}
      ${row('Расходы франшизы',m=>money(m.license),'real-case-expense-total-row')}
      <tr class="real-case-section profit"><th colspan="13">ПРИБЫЛЬ</th></tr>
      ${row('Чистая прибыль после рекламы',m=>`<span class="${m.netProfit>=0?'positive':'negative'}">${signedMoney(m.netProfit)}</span>`)}
      ${row('Накопленный результат',m=>`<span class="${m.accumulated>=0?'positive':'negative'}">${signedMoney(m.accumulated)}</span>`)}
    </tbody></table></div>`;
  }

  function insightHtml(c){
    if(c.id==='anadyr')return '<strong>Что сработало</strong><p>Быстрый запуск, высокий объём заказов и регулярное продвижение позволили окупить стартовые вложения уже на 3-м месяце.</p>';
    if(c.id==='aleksandrovskoe')return '<strong>Что сработало</strong><p>Партнёр инвестировал в развитие выше базового уровня, быстро нарастил объём заказов и к первому полугодию занял ключевую позицию на локальном рынке.</p>';
    if(c.id==='serdobsk')return '<strong>Что сработало</strong><p>Партнёр не остановил инвестиции после тяжёлого старта. Между 4-м и 8-м месяцами выполненные заказы выросли более чем в 300 раз, что позволило окупить проект на 11-м месяце.</p>';
    if(c.id==='shatrovo')return '<strong>Почему проект не окупился</strong><p>Удалённое управление, небольшие и нерегулярные вложения и недостаток времени на развитие не позволили сформировать устойчивый рост заказов.</p>';
    return '<strong>Почему проект не окупился</strong><p>Несмотря на крупные вложения на старте, конфликт с водителями и последующее снижение внимания к проекту не позволили сформировать устойчивую базу исполнителей и заказов.</p>';
  }

  function renderCase(c){
    activeCase=c;
    const view=document.getElementById('realCaseView');
    document.getElementById('realCaseViewTitle').textContent=`${c.prefix} ${c.displayName}`;
    document.getElementById('realCaseViewMeta').textContent=`${c.region} · ${num(c.population)} жителей`;
    const invest=c.initialPayment+c.totalAdvertising;
    const result=c.totalNetProfit;
    const avgFare=total(c,'rideSum')/Math.max(1,total(c,'completed'));
    const avgCommissionPct=100*total(c,'driverCommission')/Math.max(1,total(c,'rideSum'));
    const body=document.getElementById('realCaseViewBody');
    body.innerHTML=`
      <div class="real-case-fact-banner ${c.type==='success'?'success':'failure'}"><span>${c.type==='success'?'Успешная франшиза':'Проблемный проект'}</span><div><h3>${esc(c.title)}</h3>${insightHtml(c)}</div></div>
      <div class="real-case-kpi-grid">
        ${metric('Инвестиции',compact(invest),'ПВ + фактическая реклама','investment')}
        ${metric('Выручка',compact(c.totalRevenue),'фактически за 12 месяцев','revenue')}
        ${metric('Финансовый результат',signedMoney(result),'после рекламы и ПВ',result>=0?'success':'danger')}
        ${metric('Окупаемость',c.paybackMonth?`${c.paybackMonth}-й месяц`:'Не окупился',c.paybackMonth?'по накопленному результату':'за первый год',c.paybackMonth?'success':'danger')}
      </div>
      <div class="real-case-annual-params">
        <div><span>Средний чек за год</span><strong>${money(avgFare)}</strong><small>по всем выполненным заказам</small></div>
        <div><span>Средняя комиссия водителя</span><strong>${avgCommissionPct.toLocaleString('ru-RU',{maximumFractionDigits:1})} %</strong><small>фактическая средневзвешенная ставка</small></div>
      </div>
      <div class="real-case-data-note"><strong>Фактические данные</strong><span>Месячные показатели зафиксированы по реальным отчётам проекта и не редактируются.</span></div>
      ${buildTable(c)}
      <section class="real-case-chart-card"><div><h3>Динамика фактического результата</h3><p>Чистая прибыль по месяцам и накопленный результат с учётом паушального взноса.</p></div><div class="real-case-chart-box"><canvas id="realCaseChart"></canvas></div></section>`;
    closeList();view.hidden=false;view.setAttribute('aria-hidden','false');document.body.classList.add('real-cases-open');
    setTimeout(()=>renderChart(c),0);
  }
  function renderChart(c){
    const canvas=document.getElementById('realCaseChart'); if(!canvas||typeof Chart==='undefined')return;
    if(caseChart){try{caseChart.destroy()}catch(_){}caseChart=null;}
    const monthly=c.months.map(m=>m.netProfit);
    const accumulated=c.months.map(m=>m.accumulated);
    const monthlyColors=monthly.map(v=>v>=0?'rgba(75,137,56,.72)':'rgba(185,71,61,.70)');
    const accumulatedColors=accumulated.map(v=>v>=0?'rgba(44,94,142,.68)':'rgba(119,130,143,.62)');
    caseChart=new Chart(canvas,{type:'bar',data:{labels:c.months.map(m=>`${m.month} мес.`),datasets:[
      {label:'Чистая прибыль',data:monthly,backgroundColor:monthlyColors,borderWidth:0,borderRadius:5,maxBarThickness:26},
      {label:'Накопленный результат',data:accumulated,backgroundColor:accumulatedColors,borderWidth:0,borderRadius:5,maxBarThickness:26}
    ]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:8,padding:18}},tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${money(ctx.raw)}`}}},scales:{x:{grid:{display:false},ticks:{font:{size:10}}},y:{grid:{color:'rgba(110,125,140,.13)'},ticks:{callback:v=>FinancialEngine.formatMoney(v,true)+' ₽'}}}}});
  }

  function find(id){return RealCaseData.find(c=>c.id===id);}
  function events(){
    document.addEventListener('click',e=>{
      if(e.target.closest('#realCasesBtn,#mobileRealCasesBtn')){e.preventDefault();openList();return;}
      if(e.target.closest('[data-real-cases-close]')){closeList();return;}
      const card=e.target.closest('[data-real-case-id]');if(card){const c=find(card.dataset.realCaseId);if(c)renderCase(c);return;}
      if(e.target.closest('#backToRealCases')){closeView();openList();return;}
      if(e.target.closest('[data-real-case-close]')){closeView();return;}
    });
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!document.getElementById('realCaseView')?.hidden)closeView();else if(!document.getElementById('realCasesModal')?.hidden)closeList();}});
  }
  function init(){ensureButtons();ensureModals();renderList();events();}
  return{init};
})();
document.addEventListener('DOMContentLoaded',RealCasesUI.init);
