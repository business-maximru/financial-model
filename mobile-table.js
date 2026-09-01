'use strict';
const MaximMobileTable=(()=>{
  const MOBILE_MAX=820;
  let currentMonth=1;
  let fullscreenOwner=false;
  let latestSource='model';
  const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const isMobile=()=>window.innerWidth<=MOBILE_MAX;

  function ensureFullscreen(){
    if(document.getElementById('mobileFullTableModal'))return;
    const modal=document.createElement('div');
    modal.id='mobileFullTableModal';
    modal.className='mobile-full-table-modal';
    modal.hidden=true;
    modal.setAttribute('aria-hidden','true');
    modal.innerHTML=`<div class="mobile-full-table-shell" role="dialog" aria-modal="true" aria-labelledby="mobileFullTableTitle">
      <header class="mobile-full-table-head">
        <div><span class="mobile-full-table-eyebrow">Финансовая модель</span><h2 id="mobileFullTableTitle">Полная таблица за 12 месяцев</h2><p>Поверните телефон горизонтально. Таблицу можно прокручивать по месяцам.</p></div>
        <button class="mobile-full-table-close" type="button" aria-label="Закрыть полную таблицу">×</button>
      </header>
      <div class="mobile-full-table-orientation" aria-hidden="true"><span>↻</span><b>Поверните телефон горизонтально для удобного просмотра</b></div>
      <div class="mobile-full-table-scroll" id="mobileFullTableScroll"></div>
    </div>`;
    document.body.appendChild(modal);
  }

  function sectionNameFromCell(cell){
    if(!cell)return'';
    const s=cell.querySelector('.section-text');
    return (s?s.textContent:cell.textContent).replace(/Подробнее\s*›?/gi,'').trim();
  }
  function metricNameFromCell(cell){
    if(!cell)return'';
    const trigger=cell.querySelector('.metric-primary-trigger span:first-child');
    if(trigger)return trigger.textContent.trim();
    const wrap=cell.querySelector('.metric-label-wrap>span:first-child');
    if(wrap)return wrap.textContent.trim();
    return cell.textContent.replace(/→|i$/g,'').trim();
  }

  function parseModelTable(){
    const table=document.getElementById('modelTable');
    if(!table)return null;
    const rows=[];
    let currentSection='';
    table.querySelectorAll('tbody tr').forEach(tr=>{
      const sectionCell=tr.querySelector('td.section-name');
      if(sectionCell)currentSection=sectionNameFromCell(sectionCell);
      const metricCell=tr.querySelector('td.metric-name');
      if(!metricCell)return;
      const values=[...tr.querySelectorAll('td.table-cell')].map(td=>({
        text:td.textContent.trim()||'—',
        positive:td.classList.contains('positive'),
        negative:td.classList.contains('negative'),
        total:tr.classList.contains('table-total-row')||td.classList.contains('table-total-cell'),
        financial:tr.classList.contains('table-financial-row')||td.classList.contains('table-financial-cell')
      }));
      if(values.length<12)return;
      rows.push({section:currentSection,label:metricNameFromCell(metricCell),values});
    });
    return {type:'model',table,rows,title:'Финансовая модель'};
  }

  function parseCaseTable(){
    const table=document.querySelector('#realCaseView:not([hidden]) .real-case-table');
    if(!table)return null;
    const rows=[];
    let section='';
    table.querySelectorAll('tbody tr').forEach(tr=>{
      if(tr.classList.contains('real-case-section')){
        section=tr.textContent.trim();
        return;
      }
      const th=tr.querySelector(':scope > th');
      if(!th)return;
      const tds=[...tr.querySelectorAll(':scope > td')];
      if(tds.length<12)return;
      rows.push({section,label:th.textContent.trim(),values:tds.map(td=>({
        text:td.textContent.trim()||'—',
        positive:!!td.querySelector('.positive')||td.classList.contains('positive'),
        negative:!!td.querySelector('.negative')||td.classList.contains('negative'),
        total:tr.classList.contains('real-case-expense-total-row'),
        financial:tr.classList.contains('real-case-revenue-row')
      }))});
    });
    const title=document.getElementById('realCaseViewTitle')?.textContent?.trim();
    return {type:'case',table,rows,title:title?`Реальный кейс: ${title}`:'Реальный кейс'};
  }

  function selectedSource(prefer='model'){
    if(prefer==='case')return parseCaseTable()||parseModelTable();
    return parseModelTable();
  }

  function monthTableHtml(source,month){
    const idx=Math.max(0,Math.min(11,month-1));
    let section='';
    let html='<div class="mobile-month-table">';
    source.rows.forEach(row=>{
      if(row.section!==section){
        section=row.section;
        const cls=String(section).toLowerCase().includes('инвест')?'investment':String(section).toLowerCase().includes('доход')?'income':String(section).toLowerCase().includes('операц')?'expenses':'profit';
        html+=`<div class="mobile-month-section ${cls}">${esc(section)}</div>`;
      }
      const v=row.values[idx]||{text:'—'};
      const classes=['mobile-month-value',v.positive?'positive':'',v.negative?'negative':'',v.total?'total':'',v.financial?'financial':''].filter(Boolean).join(' ');
      html+=`<div class="mobile-month-row"><span>${esc(row.label)}</span><strong class="${classes}">${esc(v.text)}</strong></div>`;
    });
    html+='</div>';
    return html;
  }

  function cardMarkup(source,scope){
    const id=scope==='case'?'realCaseMobileMonthTable':'mobileMonthTableCard';
    return `<section class="mobile-month-table-card" id="${id}" data-mobile-table-scope="${scope}">
      <div class="mobile-month-table-head"><div><strong>Помесячная таблица</strong><span>Все показатели выбранного месяца</span></div><button class="mobile-full-table-open" type="button" data-mobile-full-table="${scope}">Развернуть таблицу ↗</button></div>
      <div class="mobile-month-switcher"><button type="button" data-mobile-month-step="-1" aria-label="Предыдущий месяц">‹</button><strong data-mobile-month-label>${currentMonth} месяц</strong><button type="button" data-mobile-month-step="1" aria-label="Следующий месяц">›</button></div>
      <input class="mobile-month-slider" type="range" min="1" max="12" step="1" value="${currentMonth}" aria-label="Выберите месяц" data-mobile-month-slider>
      <div class="mobile-month-slider-scale"><span>1</span><span>12</span></div>
      <div data-mobile-month-table-body>${monthTableHtml(source,currentMonth)}</div>
    </section>`;
  }

  function renderMain(){
    const host=document.getElementById('mobileFinancialAccordion');
    const source=parseModelTable();
    if(!host||!source)return;
    let card=document.getElementById('mobileMonthTableCard');
    if(!card){
      host.insertAdjacentHTML('afterend',cardMarkup(source,'model'));
    }else updateCard(card,source);
  }

  function renderCase(){
    const source=parseCaseTable();
    if(!source)return;
    const wrap=source.table.closest('.real-case-table-wrap');
    if(!wrap)return;
    let card=document.getElementById('realCaseMobileMonthTable');
    if(!card){
      wrap.insertAdjacentHTML('beforebegin',cardMarkup(source,'case'));
    }else updateCard(card,source);
  }

  function updateCard(card,source){
    const label=card.querySelector('[data-mobile-month-label]');
    const slider=card.querySelector('[data-mobile-month-slider]');
    const body=card.querySelector('[data-mobile-month-table-body]');
    if(label)label.textContent=`${currentMonth} месяц`;
    if(slider)slider.value=String(currentMonth);
    if(body)body.innerHTML=monthTableHtml(source,currentMonth);
  }

  function updateAllCards(){
    const main=document.getElementById('mobileMonthTableCard');
    if(main){const s=parseModelTable();if(s)updateCard(main,s);}
    const caseCard=document.getElementById('realCaseMobileMonthTable');
    if(caseCard){const s=parseCaseTable();if(s)updateCard(caseCard,s);}
  }

  function fullTableStandalone(source){
    const layout=document.createElement('div');
    layout.className='mobile-full-table-layout';

    const labels=document.createElement('div');
    labels.className='mobile-full-table-labels';
    const values=document.createElement('div');
    values.className='mobile-full-table-months-scroll';

    const labelTable=document.createElement('table');
    labelTable.className='mobile-full-table-label-grid';
    let labelHtml='<thead><tr><th>Показатель</th></tr></thead><tbody>';

    const valueTable=document.createElement('table');
    valueTable.className='mobile-full-table-values-grid';
    const monthHeads=Array.from({length:12},(_,i)=>`<th>${i+1} мес.</th>`).join('');
    let valueHtml=`<thead><tr>${monthHeads}</tr></thead><tbody>`;

    let section='';
    source.rows.forEach(row=>{
      if(row.section!==section){
        section=row.section;
        const key=String(section).toLowerCase();
        const cls=key.includes('инвест')?'investment':key.includes('доход')?'income':key.includes('операц')?'expenses':'profit';
        labelHtml+=`<tr class="mobile-full-section ${cls}"><th>${esc(section)}</th></tr>`;
        valueHtml+=`<tr class="mobile-full-section ${cls}"><td colspan="12" aria-hidden="true"></td></tr>`;
      }
      const rowCls=`${row.total?'is-total ':''}${row.financial?'is-financial':''}`;
      labelHtml+=`<tr class="${rowCls}"><th>${esc(row.label)}</th></tr>`;
      valueHtml+=`<tr class="${rowCls}">`;
      row.values.slice(0,12).forEach(v=>{
        const cls=[v.positive?'positive':'',v.negative?'negative':'',v.total?'total':'',v.financial?'financial':''].filter(Boolean).join(' ');
        valueHtml+=`<td class="${cls}">${esc(v.text)}</td>`;
      });
      valueHtml+='</tr>';
    });
    labelHtml+='</tbody>';
    valueHtml+='</tbody>';
    labelTable.innerHTML=labelHtml;
    valueTable.innerHTML=valueHtml;
    labels.appendChild(labelTable);
    values.appendChild(valueTable);
    layout.append(labels,values);
    return layout;
  }

  async function openFull(scope){
    ensureFullscreen();
    latestSource=scope;
    const source=selectedSource(scope);
    if(!source)return;
    const modal=document.getElementById('mobileFullTableModal');
    const holder=document.getElementById('mobileFullTableScroll');
    const title=document.getElementById('mobileFullTableTitle');
    holder.innerHTML='';
    holder.appendChild(fullTableStandalone(source));
    if(title)title.textContent=source.type==='case'?`${source.title} · 12 месяцев`:'Полная таблица за 12 месяцев';
    modal.hidden=false;modal.setAttribute('aria-hidden','false');document.body.classList.add('mobile-full-table-open');
    try{
      if(document.documentElement.requestFullscreen&&!document.fullscreenElement){
        await document.documentElement.requestFullscreen({navigationUI:'hide'});fullscreenOwner=true;
      }
      if(screen.orientation?.lock)await screen.orientation.lock('landscape');
    }catch(_e){}
  }

  async function closeFull(){
    const modal=document.getElementById('mobileFullTableModal');
    if(modal){modal.hidden=true;modal.setAttribute('aria-hidden','true');}
    document.body.classList.remove('mobile-full-table-open');
    try{if(screen.orientation?.unlock)screen.orientation.unlock();}catch(_e){}
    try{if(fullscreenOwner&&document.fullscreenElement)await document.exitFullscreen();}catch(_e){}
    fullscreenOwner=false;
  }

  function events(){
    document.addEventListener('click',e=>{
      const step=e.target.closest('[data-mobile-month-step]');
      if(step){
        currentMonth=Math.max(1,Math.min(12,currentMonth+Number(step.dataset.mobileMonthStep||0)));
        updateAllCards();return;
      }
      const open=e.target.closest('[data-mobile-full-table]');
      if(open){e.preventDefault();openFull(open.dataset.mobileFullTable||'model');return;}
      if(e.target.closest('.mobile-full-table-close')){e.preventDefault();closeFull();return;}
    });
    document.addEventListener('input',e=>{
      const slider=e.target.closest('[data-mobile-month-slider]');
      if(slider){currentMonth=Math.max(1,Math.min(12,Number(slider.value)||1));updateAllCards();}
    });
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.getElementById('mobileFullTableModal')?.hidden)closeFull();});
    document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&!document.getElementById('mobileFullTableModal')?.hidden){fullscreenOwner=false;}});
    document.addEventListener('maxim:model-rendered',()=>setTimeout(renderMain,0));

    const caseBody=document.getElementById('realCaseViewBody');
    if(caseBody){
      new MutationObserver(()=>setTimeout(renderCase,0)).observe(caseBody,{childList:true,subtree:false});
    }else{
      new MutationObserver(()=>{
        const body=document.getElementById('realCaseViewBody');
        if(body&&!body.dataset.mobileTableObserved){body.dataset.mobileTableObserved='1';new MutationObserver(()=>setTimeout(renderCase,0)).observe(body,{childList:true,subtree:false});}
      }).observe(document.body,{childList:true,subtree:true});
    }
  }

  function init(){ensureFullscreen();events();setTimeout(renderMain,50);}
  return{init,renderMain,renderCase};
})();
document.addEventListener('DOMContentLoaded',MaximMobileTable.init);
