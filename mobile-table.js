'use strict';
const MaximMobileTable=(()=>{
  const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');

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
  function sectionMeta(section){
    const key=String(section||'').toLowerCase();
    if(key.includes('инвест'))return {cls:'investment',help:'investment'};
    if(key.includes('доход'))return {cls:'income',help:'operations'};
    if(key.includes('операц'))return {cls:'expenses',help:'expenses'};
    return {cls:'profit',help:'profit'};
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
    return {type:'model',table,rows,title:'Помесячная таблица'};
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

  function labelContent(source,row){
    const label=esc(row.label);
    if(source.type!=='model')return `<span class="mobile-inline-label-text">${label}</span>`;
    const normalized=row.label.toLowerCase();
    if(normalized==='паушальный взнос'){
      return `<button class="mobile-inline-metric-button" type="button" data-detail-type="initialPurchase" aria-label="Подробнее: ${label}"><span>${label}</span><i aria-hidden="true">›</i></button>`;
    }
    if(normalized==='реклама'){
      return `<button class="mobile-inline-metric-button" type="button" data-detail-type="marketingInvestment" aria-label="Подробнее: ${label}"><span>${label}</span><i aria-hidden="true">›</i></button>`;
    }
    return `<span class="mobile-inline-label-text">${label}</span>`;
  }

  function tableLayout(source){
    const layout=document.createElement('div');
    layout.className='mobile-full-table-layout mobile-inline-12m-layout';

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
        const meta=sectionMeta(section);
        const sectionLabel=source.type==='model'
          ? `<button class="mobile-inline-section-button" type="button" data-section-help="${meta.help}" aria-label="Подробнее о разделе ${esc(section)}"><span>${esc(section)}</span><i aria-hidden="true">›</i></button>`
          : `<span class="mobile-inline-section-text">${esc(section)}</span>`;
        labelHtml+=`<tr class="mobile-full-section ${meta.cls}"><th>${sectionLabel}</th></tr>`;
        valueHtml+=`<tr class="mobile-full-section ${meta.cls}"><td colspan="12" aria-hidden="true"></td></tr>`;
      }
      const rowCls=`${row.total?'is-total ':''}${row.financial?'is-financial':''}`.trim();
      labelHtml+=`<tr class="${rowCls}"><th>${labelContent(source,row)}</th></tr>`;
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

  function closeLandscapeModal(){
    const modal=document.getElementById('mobileLandscapeTableModal');
    if(modal)modal.remove();
    document.body.classList.remove('mobile-landscape-table-open');
    try{
      if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
    }catch(_){ }
    try{
      if(screen.orientation&&screen.orientation.unlock)screen.orientation.unlock();
    }catch(_){ }
  }

  async function tryLandscape(modal){
    let locked=false;
    try{
      if(modal.requestFullscreen && !document.fullscreenElement){
        await modal.requestFullscreen({navigationUI:'hide'});
      }
    }catch(_){ }
    try{
      if(screen.orientation&&screen.orientation.lock){
        await screen.orientation.lock('landscape');
        locked=true;
      }
    }catch(_){ }
    const note=modal.querySelector('[data-landscape-note]');
    if(note){
      note.textContent=locked
        ? 'Экран открыт горизонтально. Месяцы прокручиваются вправо и влево.'
        : 'Если экран не повернулся автоматически, поверните телефон горизонтально.';
    }
  }

  function openLandscapeModal(source){
    closeLandscapeModal();
    const modal=document.createElement('div');
    modal.id='mobileLandscapeTableModal';
    modal.className='mobile-landscape-table-modal';
    modal.innerHTML=`<section class="mobile-landscape-table-shell" role="dialog" aria-modal="true" aria-label="Помесячная таблица в горизонтальном режиме">
      <header class="mobile-landscape-table-head"><div class="mobile-landscape-table-title"><strong>${esc(source.title||'Помесячная таблица')}</strong><span data-landscape-note>Поверните телефон горизонтально для удобного просмотра</span></div><button class="mobile-landscape-table-close" type="button" aria-label="Закрыть">×</button></header>
      <div class="mobile-landscape-table-body"></div>
    </section>`;
    modal.querySelector('.mobile-landscape-table-body').appendChild(tableLayout(source));
    document.body.appendChild(modal);
    document.body.classList.add('mobile-landscape-table-open');
    modal.querySelector('.mobile-landscape-table-close').addEventListener('click',closeLandscapeModal);
    tryLandscape(modal);
  }

  function card(source,scope){
    const el=document.createElement('section');
    el.className='mobile-month-table-card mobile-inline-12m-card';
    el.id=scope==='case'?'realCaseMobileMonthTable':'mobileMonthTableCard';
    el.dataset.mobileTableScope=scope;
    el.innerHTML=`<div class="mobile-month-table-head mobile-inline-12m-head"><div><strong>Помесячная таблица</strong><span>Прокручивайте месяцы горизонтально</span></div><div class="mobile-inline-table-actions"><span class="mobile-inline-scroll-hint" aria-hidden="true">← 1–12 →</span><button class="mobile-table-landscape-btn" type="button" aria-label="Открыть таблицу горизонтально"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 8V4h4M20 16v4h-4"></path><path d="M5.5 5.5A8 8 0 0 1 19 9M18.5 18.5A8 8 0 0 1 5 15"></path></svg><span>Горизонтально</span></button></div></div>`;
    const body=document.createElement('div');
    body.className='mobile-inline-12m-body';
    body.appendChild(tableLayout(source));
    el.appendChild(body);
    el.querySelector('.mobile-table-landscape-btn')?.addEventListener('click',()=>openLandscapeModal(source));
    return el;
  }

  function updateCard(existing,source,scope){
    const next=card(source,scope);
    existing.replaceWith(next);
  }

  function renderMain(){
    const host=document.getElementById('mobileFinancialAccordion');
    const source=parseModelTable();
    if(!host||!source)return;
    const existing=document.getElementById('mobileMonthTableCard');
    if(existing)updateCard(existing,source,'model');
    else host.insertAdjacentElement('afterend',card(source,'model'));
  }

  function renderCase(){
    const source=parseCaseTable();
    if(!source)return;
    const wrap=source.table.closest('.real-case-table-wrap');
    if(!wrap)return;
    const existing=document.getElementById('realCaseMobileMonthTable');
    if(existing)updateCard(existing,source,'case');
    else wrap.insertAdjacentElement('beforebegin',card(source,'case'));
  }

  function events(){
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('mobileLandscapeTableModal'))closeLandscapeModal();});
    document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&document.getElementById('mobileLandscapeTableModal')&&!document.body.classList.contains('mobile-landscape-table-open'))closeLandscapeModal();});
    document.addEventListener('maxim:model-rendered',()=>setTimeout(renderMain,0));
    const caseBody=document.getElementById('realCaseViewBody');
    if(caseBody){
      new MutationObserver(()=>setTimeout(renderCase,0)).observe(caseBody,{childList:true,subtree:false});
    }else{
      new MutationObserver(()=>{
        const body=document.getElementById('realCaseViewBody');
        if(body&&!body.dataset.mobileTableObserved){
          body.dataset.mobileTableObserved='1';
          new MutationObserver(()=>setTimeout(renderCase,0)).observe(body,{childList:true,subtree:false});
        }
      }).observe(document.body,{childList:true,subtree:true});
    }
  }

  function init(){events();setTimeout(renderMain,50);}
  return{init,renderMain,renderCase};
})();
document.addEventListener('DOMContentLoaded',MaximMobileTable.init);
