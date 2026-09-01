'use strict';
const App=(()=>{
  let state, model, errors={}, undo=[], redo=[];
  let mobileChart=null;
  let mobileStickyCtaObserver=null;
  let startFilterState='', startFilterCityId='';
  let cityOverrides={added:[],deletedIds:[]};
  let cityCache=null;
  let adminAuthenticated=false;
  let adminReturnFocus=null;
  let adminNotice={text:'',tone:''};

  const CITY_OVERRIDES_KEY='maxim_rf_city_overrides_v1';
  const ADMIN_SESSION_KEY='maxim_rf_admin_session_v1';
  const baseCities=()=>Array.isArray(window.CityData)?window.CityData:CityData;
  const escapeCityHtml=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');

  function normalizeStoredCity(city){
    if(!city||typeof city!=='object')return null;
    const id=String(city.id||'').trim();
    const region=String(city.state||'').trim();
    const name=String(city.city||'').trim();
    const population=Math.round(Number(city.population));
    const initialPayment=Math.round(Number(city.initialPayment));
    if(!id||!region||!name||!Number.isFinite(population)||population<=0||!Number.isFinite(initialPayment)||initialPayment<0)return null;
    return {id,state:region,city:name,population,initialPayment,isCustom:true};
  }

  function loadCityOverrides(){
    try{
      const parsed=JSON.parse(localStorage.getItem(CITY_OVERRIDES_KEY)||'{}');
      const added=Array.isArray(parsed.added)?parsed.added.map(normalizeStoredCity).filter(Boolean):[];
      const deletedIds=Array.isArray(parsed.deletedIds)?parsed.deletedIds.map(String):[];
      cityOverrides={added,deletedIds:[...new Set(deletedIds)]};
    }catch(_error){
      cityOverrides={added:[],deletedIds:[]};
    }
    cityCache=null;
  }

  function saveCityOverrides(){
    try{
      localStorage.setItem(CITY_OVERRIDES_KEY,JSON.stringify(cityOverrides));
      cityCache=null;
      return true;
    }catch(_error){
      setAdminNotice('Не удалось сохранить изменения в браузере. Проверьте доступ к локальному хранилищу.','error');
      return false;
    }
  }

  function rebuildCityCache(){
    const deleted=new Set(cityOverrides.deletedIds);
    cityCache=baseCities()
      .filter(city=>!deleted.has(String(city.id)))
      .map(city=>({...city,isCustom:false}))
      .concat(cityOverrides.added.map(city=>({...city,isCustom:true})))
      .sort((a,b)=>a.state.localeCompare(b.state,'ru-RU')||a.city.localeCompare(b.city,'ru-RU')||Number(a.population)-Number(b.population));
    return cityCache;
  }

  const cities=()=>baseCities();
  const cityById=id=>cities().find(c=>c.id===id)||null;
  const states=()=>[...new Set(cities().map(c=>c.state))].sort((a,b)=>a.localeCompare(b,'ru-RU'));

  function fallbackCredentialHash(value){
    let hash=0x811c9dc5;
    for(const char of String(value??'')){
      hash^=char.charCodeAt(0);
      hash=Math.imul(hash,0x01000193);
    }
    return (hash>>>0).toString(16).padStart(8,'0');
  }

  async function secureCredentialHash(value){
    try{
      if(window.crypto?.subtle&&window.TextEncoder){
        const digest=await window.crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(value??'')));
        return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
      }
    }catch(_error){}
    return '';
  }

  function restoreAdminSession(){
    try{adminAuthenticated=sessionStorage.getItem(ADMIN_SESSION_KEY)==='1';}
    catch(_error){adminAuthenticated=false;}
  }

  function setAdminSession(active){
    adminAuthenticated=!!active;
    try{
      if(adminAuthenticated)sessionStorage.setItem(ADMIN_SESSION_KEY,'1');
      else sessionStorage.removeItem(ADMIN_SESSION_KEY);
    }catch(_error){}
  }

  function setAdminNotice(textValue,tone=''){
    adminNotice={text:String(textValue||''),tone};
  }

  function renderAdminUI(){
    document.body.classList.toggle('admin-authenticated',adminAuthenticated);
    document.querySelectorAll('[data-admin-login]').forEach(button=>{button.hidden=adminAuthenticated;});
    document.querySelectorAll('[data-admin-session]').forEach(bar=>{bar.hidden=!adminAuthenticated;});
    document.querySelectorAll('[data-admin-panel]').forEach(panel=>{
      panel.hidden=!adminAuthenticated;
      if(!adminAuthenticated)return;
      const regionInput=panel.querySelector('[data-admin-field="state"]');
      if(regionInput&&!regionInput.value&&startFilterState)regionInput.value=startFilterState;
      const selected=cityById(startFilterCityId);
      const selectedLabel=panel.querySelector('[data-admin-selected]');
      if(selectedLabel){
        selectedLabel.textContent=selected
          ? `Выбран для удаления: ${selected.city}, ${selected.state} · ${fmtNumber(selected.population)} чел. · ${fmtBRL(selected.initialPayment)}`
          : 'Выберите населённый пункт в списке для удаления.';
      }
      const deleteButton=panel.querySelector('[data-admin-delete]');
      if(deleteButton)deleteButton.disabled=!selected;
      const message=panel.querySelector('[data-admin-message]');
      if(message){
        message.textContent=adminNotice.text;
        message.className=`admin-message${adminNotice.tone?` is-${adminNotice.tone}`:''}`;
      }
    });
  }

  function openAdminLogin(trigger){
    const modal=document.getElementById('adminLoginModal');
    const username=document.getElementById('adminUsernameInput');
    const password=document.getElementById('adminPasswordInput');
    const validation=document.getElementById('adminLoginValidation');
    if(!modal)return;
    adminReturnFocus=trigger||document.activeElement;
    if(username)username.value='';
    if(password)password.value='';
    if(validation){validation.hidden=true;validation.textContent='';}
    modal.hidden=false;
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('admin-login-open');
    setTimeout(()=>username?.focus(),0);
  }

  function closeAdminLogin(){
    const modal=document.getElementById('adminLoginModal');
    if(!modal||modal.hidden)return;
    modal.hidden=true;
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('admin-login-open');
    const focusTarget=adminReturnFocus;
    adminReturnFocus=null;
    setTimeout(()=>focusTarget?.focus?.(),0);
  }

  async function confirmAdminLogin(){
    const username=document.getElementById('adminUsernameInput')?.value.trim()||'';
    const password=document.getElementById('adminPasswordInput')?.value||'';
    const validation=document.getElementById('adminLoginValidation');
    const config=window.MAXIM_ADMIN_CONFIG||{};
    const secureHash=await secureCredentialHash(password);
    const passwordMatches=secureHash
      ? secureHash===String(config.passwordHash||'')
      : fallbackCredentialHash(password)===String(config.fallbackHash||'');
    if(username===String(config.username||'')&&passwordMatches){
      setAdminSession(true);
      closeAdminLogin();
      setAdminNotice('Администратор авторизован. Можно добавлять и удалять населённые пункты.','success');
      renderStartScreen();
      renderMobileStartScreen();
      return;
    }
    if(validation){
      validation.textContent='Неверный логин или пароль.';
      validation.hidden=false;
    }
    document.getElementById('adminPasswordInput')?.select();
  }

  function readAdminCityForm(panel){
    const value=name=>panel.querySelector(`[data-admin-field="${name}"]`)?.value??'';
    return {
      state:String(value('state')).trim(),
      city:String(value('city')).trim(),
      population:Math.round(Number(value('population'))),
      initialPayment:Math.round(Number(value('initialPayment')))
    };
  }

  function addAdminCity(panel){
    if(!adminAuthenticated||!panel)return;
    const city=readAdminCityForm(panel);
    if(!city.state||!city.city){
      setAdminNotice('Заполните регион и название населённого пункта.','error');
      return;
    }
    if(!Number.isFinite(city.population)||city.population<=0){
      setAdminNotice('Численность населения должна быть больше нуля.','error');
      return;
    }
    if(!Number.isFinite(city.initialPayment)||city.initialPayment<0){
      setAdminNotice('Укажите корректный паушальный взнос.','error');
      return;
    }
    const duplicate=cities().find(item=>
      item.state.toLocaleLowerCase('ru-RU')===city.state.toLocaleLowerCase('ru-RU')&&
      item.city.toLocaleLowerCase('ru-RU')===city.city.toLocaleLowerCase('ru-RU')&&
      Number(item.population)===city.population&&Number(item.initialPayment)===city.initialPayment
    );
    if(duplicate){
      startFilterState=duplicate.state;
      startFilterCityId=duplicate.id;
      setAdminNotice('Такая запись уже есть в списке.','error');
      renderStartScreen();
      renderMobileStartScreen();
      return;
    }
    const id=`custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
    const added={id,...city,isCustom:true};
    cityOverrides.added.push(added);
    if(!saveCityOverrides())return;
    startFilterState=added.state;
    startFilterCityId=added.id;
    document.querySelectorAll('[data-admin-panel]').forEach(item=>{
      const cityInput=item.querySelector('[data-admin-field="city"]');
      const populationInput=item.querySelector('[data-admin-field="population"]');
      const paymentInput=item.querySelector('[data-admin-field="initialPayment"]');
      if(cityInput)cityInput.value='';
      if(populationInput)populationInput.value='';
      if(paymentInput)paymentInput.value='';
    });
    adminNotice={text:`Населённый пункт «${added.city}» добавлен.`,tone:'success'};
    renderStartScreen();
    renderMobileStartScreen();
  }

  function deleteAdminCity(){
    if(!adminAuthenticated)return;
    const selected=cityById(startFilterCityId);
    if(!selected){
      setAdminNotice('Сначала выберите населённый пункт в списке.','error');
      return;
    }
    if(!window.confirm(`Удалить населённый пункт «${selected.city}, ${selected.state}» из списка?`))return;
    if(selected.isCustom){
      cityOverrides.added=cityOverrides.added.filter(city=>city.id!==selected.id);
    }else if(!cityOverrides.deletedIds.includes(selected.id)){
      cityOverrides.deletedIds.push(selected.id);
    }
    if(!saveCityOverrides())return;
    if(state?.selectedCityId===selected.id)state.selectedCityId=null;
    startFilterCityId='';
    if(!cities().some(city=>city.state===startFilterState))startFilterState='';
    adminNotice={text:`Населённый пункт «${selected.city}» удалён из локального списка.`,tone:'success'};
    renderStartScreen();
    renderMobileStartScreen();
    setScreen();
  }

  function resetAdminCities(){
    if(!adminAuthenticated)return;
    if(!window.confirm('Восстановить исходный список населённых пунктов? Все локальные изменения будут отменены: добавленные населённые пункты будут удалены, а удалённые — восстановлены.'))return;
    cityOverrides={added:[],deletedIds:[]};
    if(!saveCityOverrides())return;
    startFilterState='';
    startFilterCityId='';
    if(state?.selectedCityId&&!cityById(state.selectedCityId))state.selectedCityId=null;
    adminNotice={text:'Исходный список населённых пунктов восстановлен.',tone:'success'};
    renderStartScreen();
    renderMobileStartScreen();
    setScreen();
  }
  const fmtNumber=v=>Math.round(Number(v)||0).toLocaleString('ru-RU');
  const fmtBRL=v=>FinancialEngine.formatCurrencyFull(v);
  const fmtBRLCompact=v=>FinancialEngine.formatCurrencyCompact(v);

  function hydrate(){
    const saved=Storage.load();
    state=saved&&saved.scenarios ? saved : {language:'ru-RU',currency:'RUB',advanced:false,activeScenarioId:'base',selectedCityId:null,scenarios:ScenarioManager.builtIns()};
    state.currency='RUB';
    state.advanced=false;
    // Small App Россия uses one reference scenario; payback is calculated from demand rather than targeted.
    const baseScenario=(ScenarioManager.builtIns().find(s=>s.id==='base')||ScenarioManager.builtIns()[0]);
    const savedBase=(state.scenarios||[]).find(s=>s.id==='base');
    if(savedBase&&savedBase.assumptions){
      baseScenario.assumptions={...baseScenario.assumptions,...savedBase.assumptions,autoPopulationUsingService:false};
      baseScenario.notes=savedBase.notes||'';
    }
    state.scenarios=[baseScenario];
    state.activeScenarioId='base';
    if(!['ru-RU'].includes(state.language))state.language='ru-RU';
    // The city selector must always start empty on a fresh app open.
    // Language and scenarios can persist, but the user explicitly chooses the city each time.
    state.selectedCityId=null;
    state.activeScenario=state.scenarios.find(s=>s.id===state.activeScenarioId)||state.scenarios[0];
    state.activeScenarioId=state.activeScenario.id;
    startFilterState='';
    startFilterCityId='';
  }
  function snapshot(){return JSON.stringify({language:state.language,currency:'RUB',advanced:false,activeScenarioId:state.activeScenarioId,selectedCityId:state.selectedCityId,scenarios:state.scenarios})}
  function pushUndo(){undo.push(snapshot());if(undo.length>100)undo.shift();redo=[]}
  function restore(snap){const parsed=JSON.parse(snap);state={...parsed,currency:'RUB'};state.activeScenario=state.scenarios.find(s=>s.id===state.activeScenarioId)||state.scenarios[0];recalc()}
  function persist(){Storage.save({language:state.language,currency:'RUB',advanced:false,activeScenarioId:state.activeScenarioId,selectedCityId:state.selectedCityId,scenarios:state.scenarios})}

  function applySelectedCity(city){
    if(!city)return;
    const initialInvestment=Math.max(0,Number(city.initialPayment)||0);
    state.selectedCityId=city.id;
    state.selectedCitySnapshot={id:city.id,state:city.state,city:city.city,population:Number(city.population)||0,initialPayment:initialInvestment};
    const population=Number(city.population)||0;
    const recommendedBudget=FinancialEngine.annualMarketingBudgetForPopulation(population);
    state.activeScenario.assumptions.population=population;
    state.activeScenario.assumptions.initialInvestment=initialInvestment;
    state.activeScenario.assumptions.useRecommendedValues=false;
    state.activeScenario.assumptions.callCenterEnabled=false;
    state.activeScenario.assumptions.averageFare=FinancialEngine.recommendedAverageFareForPopulation(population);
    state.activeScenario.assumptions.commission=FinancialEngine.recommendedCommissionForPopulation(population);
    state.activeScenario.assumptions.advertisingPackage=FinancialEngine.advertisingPackageForPopulation(population);
    state.activeScenario.assumptions.marketingBudget=recommendedBudget;
    state.activeScenario.assumptions.marketingDistributionPreset='auto';
    state.activeScenario.assumptions.marketingDistribution=FinancialEngine.marketingSharesForPopulation(population);
    state.activeScenario.assumptions.autoPopulationUsingService=false;
    startFilterState=city.state;
    startFilterCityId=city.id;
  }

  let parametersReturnFocus=null;

  function getRecommendedParameters(){
    const population=Number(state.activeScenario?.assumptions?.population)||Number(cityById(state.selectedCityId)?.population)||0;
    return {
      marketingBudget:FinancialEngine.annualMarketingBudgetForPopulation(population),
      averageFare:FinancialEngine.recommendedAverageFareForPopulation(population),
      commission:FinancialEngine.recommendedCommissionForPopulation(population)
    };
  }

  function setParametersFieldsDisabled(disabled){
    const editableIds=['annualInvestmentBudgetInput','averageFareParameterInput','driverCommissionParameterInput'];
    editableIds.forEach(id=>{
      const input=document.getElementById(id);
      if(input){
        input.disabled=disabled;
        input.closest('.parameter-group')?.classList.toggle('is-disabled',disabled);
      }
    });
  }

  function formatBudgetValue(value){
    const n=Math.max(0,Math.round(Number(String(value??'').replace(/\s/g,''))||0));
    return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(n).replace(/\u00a0|\u202f/g,' ');
  }

  function parseBudgetValue(value){
    const cleaned=String(value??'').replace(/[^0-9]/g,'');
    return cleaned?Number(cleaned):0;
  }

  function setParameterInputs(values){
    const budget=document.getElementById('annualInvestmentBudgetInput');
    const fare=document.getElementById('averageFareParameterInput');
    const commission=document.getElementById('driverCommissionParameterInput');
    if(budget)budget.value=formatBudgetValue(values.marketingBudget);
    if(fare)fare.value=String(Math.max(0,Number(values.averageFare)||0));
    if(commission)commission.value=String(Math.max(0,Number(values.commission)||0));
  }

  function readParameterInputs(){
    return {
      marketingBudget:parseBudgetValue(document.getElementById('annualInvestmentBudgetInput')?.value),
      averageFare:Number(document.getElementById('averageFareParameterInput')?.value),
      commission:Number(document.getElementById('driverCommissionParameterInput')?.value)
    };
  }

  function updateBudgetAssessment(){
    const el=document.getElementById('investmentBudgetAssessment');
    if(!el)return;
    const recommended=getRecommendedParameters().marketingBudget;
    const budget=Math.max(0,parseBudgetValue(document.getElementById('annualInvestmentBudgetInput')?.value));
    const ratio=recommended>0?budget/recommended:0;
    let key='budgetAssessmentRecommended',tone='recommended';
    if(budget===0){key='budgetAssessmentZero';tone='critical';}
    else if(ratio<0.3){key='budgetAssessmentCritical';tone='critical';}
    else if(ratio<0.7){key='budgetAssessmentBelow';tone='warning';}
    else if(ratio<1){key='budgetAssessmentWorking';tone='working';}
    else if(ratio<=1.3){key='budgetAssessmentRecommended';tone='recommended';}
    else {key='budgetAssessmentDiminishing';tone='neutral';}
    el.className=`parameter-assessment is-${tone}`;
    el.textContent=Localization.t(key,{percent:Math.round(ratio*100),recommended:fmtBRL(recommended)});
  }

  function renderParameterButtonLabels(){
    const label=Localization.t('parameters');
    ['parametersBtn','mobileParametersBtn'].forEach(id=>{
      const button=document.getElementById(id);
      if(button){button.title=label;button.setAttribute('aria-label',label);}
    });
    const cityLabel=Localization.t('changeCity');
    ['changeCityBtn','mobileChangeCityBtn'].forEach(id=>{
      const button=document.getElementById(id);
      if(button){button.title=cityLabel;button.setAttribute('aria-label',cityLabel);}
    });
  }

  function openParametersModal(trigger){
    if(!cityById(state.selectedCityId))return;
    const modal=document.getElementById('parametersModal');
    const callCenterCheckbox=document.getElementById('callCenterEnabledCheckbox');
    const validation=document.getElementById('parametersValidation');
    if(!modal||!callCenterCheckbox)return;
    parametersReturnFocus=trigger||document.activeElement;
    const current=FinancialEngine.normalizeAssumptions({...state.activeScenario.assumptions,useRecommendedValues:false});
    callCenterCheckbox.checked=current.callCenterEnabled===true;
    setParameterInputs(current);
    setParametersFieldsDisabled(false);
    updateBudgetAssessment();
    if(validation){validation.hidden=true;validation.textContent='';}
    modal.hidden=false;
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('parameters-modal-open');
    setTimeout(()=>document.getElementById('annualInvestmentBudgetInput')?.focus(),0);
  }

  function closeParametersModal(){
    const modal=document.getElementById('parametersModal');
    if(!modal||modal.hidden)return;
    modal.hidden=true;
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('parameters-modal-open');
    const focusTarget=parametersReturnFocus;
    parametersReturnFocus=null;
    setTimeout(()=>focusTarget?.focus?.(),0);
  }


  function confirmParameters(){
    const callCenterCheckbox=document.getElementById('callCenterEnabledCheckbox');
    const validation=document.getElementById('parametersValidation');
    if(!callCenterCheckbox)return;
    const callCenterEnabled=callCenterCheckbox.checked;
    const values=readParameterInputs();
    let message='';
    if(!Number.isFinite(values.marketingBudget)||values.marketingBudget<0)message=Localization.t('validationAnnualBudget');
    else if(!Number.isFinite(values.averageFare)||values.averageFare<=0)message=Localization.t('validationFare');
    else if(!Number.isFinite(values.commission)||values.commission<0||values.commission>50)message=Localization.t('validationCommission');
    if(message){
      if(validation){validation.textContent=message;validation.hidden=false;}
      return;
    }
    pushUndo();
    const a=state.activeScenario.assumptions;
    a.useRecommendedValues=false;
    a.callCenterEnabled=callCenterEnabled;
    a.marketingBudget=values.marketingBudget;
    a.averageFare=values.averageFare;
    a.commission=values.commission;
    a.marketingDistributionPreset='auto';
    a.marketingDistribution=FinancialEngine.marketingSharesForPopulation(a.population);
    closeParametersModal();
    recalc();
  }

  function setScreen(){
    const hasCity=!!cityById(state.selectedCityId);
    document.body.classList.toggle('city-start-mode',!hasCity);
    document.getElementById('startScreen').hidden=hasCity;
    document.getElementById('dashboard').hidden=!hasCity;
    document.querySelector('.topbar').hidden=!hasCity;
    if(!hasCity){delete document.body.dataset.mobileSlide; const ma=document.getElementById('mobileApp'); if(ma)ma.dataset.page='start';}
    else if(isMobileLayout()&&!document.body.dataset.mobileSlide){document.body.dataset.mobileSlide='kpi'; const ma=document.getElementById('mobileApp'); if(ma)ma.dataset.page='kpi';}
  }

  function renderSelectedCityBanner(){
    const box=document.getElementById('selectedCityBanner');
    const topbar=document.getElementById('topbarCityMeta');
    const c=cityById(state.selectedCityId);
    const effectiveInvestment=state.activeScenario?.assumptions?.initialInvestment??c?.initialPayment??0;
    const html=c ? `<div class="city-chip"><strong>${Localization.t('selectedCity')}:</strong> ${escapeCityHtml(c.city)}, ${escapeCityHtml(c.state)}</div><div class="city-chip"><strong>${Localization.t('populationHeader')}:</strong> ${fmtNumber(c.population)}</div><div class="city-chip"><strong>${Localization.t('initialPaymentHeader')}:</strong> ${fmtBRL(effectiveInvestment)}</div>` : '';
    if(box) box.innerHTML=html;
    if(topbar) topbar.innerHTML='';
  }

  function renderStartScreen(){
    Localization.setLanguage(state.language);
    const lang1=document.getElementById('startLanguageSelect');
    if(lang1)lang1.value=state.language;
    const lang2=document.getElementById('mobileLanguageSelect');
    if(lang2)lang2.value=state.language;
    const flag=document.getElementById('startLangFlag');
    if(flag)flag.textContent='🇷🇺';
    const startLangWrap=document.querySelector('.start-lang-switch');
    if(startLangWrap)startLangWrap.setAttribute('data-lang-label','RU');
    const mobileFlag=document.getElementById('mobileTopLangFlag');
    if(mobileFlag)mobileFlag.textContent='🇷🇺';
    const stateSelect=document.getElementById('startStateSelect');
    const citySelect=document.getElementById('startCitySelect');
    if(!stateSelect||!citySelect)return;
    const st=states();
    const statePlaceholder='Выберите регион...';
    const cityFirstPlaceholder='Сначала выберите регион...';
    const cityPlaceholder='Выберите населённый пункт...';
    stateSelect.innerHTML=`<option value="">${statePlaceholder}</option>`+st.map(x=>`<option value="${escapeCityHtml(x)}" ${x===startFilterState?'selected':''}>${escapeCityHtml(x)}</option>`).join('');
    const filtered=startFilterState ? cities().filter(c=>c.state===startFilterState) : cities();
    citySelect.disabled=!startFilterState;
    citySelect.innerHTML=startFilterState
      ? `<option value="">${cityPlaceholder}</option>`+filtered.map(c=>`<option value="${escapeCityHtml(c.id)}" ${c.id===startFilterCityId?'selected':''}>${escapeCityHtml(c.city)}</option>`).join('')
      : `<option value="">${cityFirstPlaceholder}</option>`;
    const calculateBtn=document.getElementById('startCalculateBtn');
    if(calculateBtn)calculateBtn.disabled=!startFilterCityId;
    const table=document.getElementById('cityTable');
    const rows=filtered.map(c=>`<tr data-city-row="${escapeCityHtml(c.id)}" class="${c.id===startFilterCityId?'selected':''}"><td>${escapeCityHtml(c.state)}</td><td>${escapeCityHtml(c.city)}</td><td>${fmtNumber(c.population)}</td><td>${fmtBRL(c.initialPayment)}</td></tr>`).join('');
    table.innerHTML=`<thead><tr><th>${Localization.t('state')}</th><th>${Localization.t('city')}</th><th>${Localization.t('populationHeader')}</th><th>${Localization.t('initialPaymentHeader')}</th></tr></thead><tbody>${rows}</tbody>`;
  }


  function isMobileLayout(){
    return window.matchMedia && window.matchMedia('(max-width: 820px)').matches;
  }

  function mobileActivateSlide(target){
    if(!isMobileLayout()){
      const el=document.querySelector(target);
      if(el)el.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    const map={
      '.hero-row':'kpi',
      '.chart-card':'chart',
      '#mobileInsightsSummary':'summary'
    };
    const slide=map[target]||target||'kpi';
    document.body.dataset.mobileSlide=slide;
    const ma=document.getElementById('mobileApp'); if(ma)ma.dataset.page=slide;
    window.scrollTo({top:0,left:0,behavior:'auto'});
    setTimeout(()=>{try{window.dispatchEvent(new Event('resize'));}catch(_e){}},40);
  }

  function mobileScrollTo(selector){
    mobileActivateSlide(selector);
  }

  function ensureMobilePresentation(){
    const dashboard=document.getElementById('dashboard');
    const hero=dashboard?.querySelector('.hero-row');
    const chart=dashboard?.querySelector('.chart-card');
    const modelCol=dashboard?.querySelector('.model-column');
    if(!dashboard||!hero||!chart||!modelCol)return;

    if(!document.getElementById('mobileKpiNext')){
      const btn=document.createElement('button');
      btn.id='mobileKpiNext';
      btn.type='button';
      btn.className='mobile-slide-button mobile-slide-button-bottom';
      btn.setAttribute('data-mobile-target','.chart-card');
      btn.setAttribute('aria-label','Следующий экран');
      btn.innerHTML='<span>↓</span>';
      hero.appendChild(btn);
    }

    if(!document.getElementById('mobileChartPrev')){
      const btn=document.createElement('button');
      btn.id='mobileChartPrev';
      btn.type='button';
      btn.className='mobile-slide-button mobile-slide-button-top';
      btn.setAttribute('data-mobile-target','.hero-row');
      btn.setAttribute('aria-label','Предыдущий экран');
      btn.innerHTML='<span>↑</span>';
      chart.prepend(btn);
    }
    if(!document.getElementById('mobileChartNext')){
      const btn=document.createElement('button');
      btn.id='mobileChartNext';
      btn.type='button';
      btn.className='mobile-slide-button mobile-slide-button-bottom';
      btn.setAttribute('data-mobile-target','#mobileInsightsSummary');
      btn.setAttribute('aria-label','Следующий экран');
      btn.innerHTML='<span>↓</span>';
      chart.appendChild(btn);
    }

    let combined=document.getElementById('mobileInsightsSummary');
    if(!combined){
      combined=document.createElement('section');
      combined.id='mobileInsightsSummary';
      combined.className='side-card mobile-insights-summary-card';
      combined.innerHTML=`
        <button type="button" class="mobile-slide-button mobile-slide-button-top" data-mobile-target=".chart-card" aria-label="Предыдущий экран"><span>↑</span></button>
        <div class="mobile-combined-content">
          <div class="mobile-combined-block">
            <h3 data-mobile-insights-title></h3>
            <div id="mobileInsightsList"></div>
          </div>
          <div class="mobile-combined-block">
            <h3 data-mobile-summary-title></h3>
            <div id="mobileSummaryList"></div>
          </div>
        </div>
      `;
      chart.insertAdjacentElement('afterend',combined);
    }
    const it=combined.querySelector('[data-mobile-insights-title]');
    if(it)it.textContent=Localization.t('keyInsights');
    const st=combined.querySelector('[data-mobile-summary-title]');
    if(st)st.textContent=Localization.t('summary12');
  }

  function syncMobilePresentation(){
    ensureMobilePresentation();
    const srcInsights=document.getElementById('insightsList');
    const dstInsights=document.getElementById('mobileInsightsList');
    const srcSummary=document.getElementById('summaryList');
    const dstSummary=document.getElementById('mobileSummaryList');
    if(srcInsights&&dstInsights)dstInsights.innerHTML=srcInsights.innerHTML;
    if(srcSummary&&dstSummary)dstSummary.innerHTML=srcSummary.innerHTML;
  }



  function mobileSetPage(page){
    const app=document.getElementById('mobileApp');
    if(!app)return;
    const next=(page==='detail'?'resumo':(page||'kpi'));
    app.dataset.page=next;
    document.body.dataset.mobileSlide=next;
    if(isMobileLayout()){
      document.documentElement.scrollTop=0;
      document.body.scrollTop=0;
      window.scrollTo(0,0);
      renderMobileKpis();
      renderMobileSummaryAndDetail();
      setTimeout(()=>{try{window.dispatchEvent(new Event('resize'));}catch(_e){}; renderMobileChart();},20);
      setTimeout(()=>{try{window.dispatchEvent(new Event('resize'));}catch(_e){}; renderMobileChart();},160);
    }
  }

  function renderMobileStartScreen(){
    const app=document.getElementById('mobileApp');
    if(!app)return;
    const flag=document.getElementById('mobileStartLanguageFlag');
    const text=document.getElementById('mobileStartLanguageText');
    if(flag)flag.textContent='🇷🇺';
    if(text)text.textContent='RU';
    const titleEl=document.querySelector('#mobileStartScreen .mobile-start-title');
    const subtitleEl=document.querySelector('#mobileStartScreen .mobile-start-subtitle');
    const stateSelect=document.getElementById('mobileStateSelect');
    const citySelect=document.getElementById('mobileCitySelect');
    const btn=document.getElementById('mobileCalculateBtn');
    if(titleEl)titleEl.textContent=Localization.t('mobileWelcomeTitle');
    if(subtitleEl)subtitleEl.textContent=Localization.t('mobileWelcomeSubtitle');
    if(!stateSelect||!citySelect||!btn)return;
    btn.textContent=Localization.t('mobileCalculate');
    const st=states();
    const statePlaceholder='Выберите регион...';
    const cityFirstPlaceholder='Сначала выберите регион...';
    const cityPlaceholder='Выберите населённый пункт...';
    stateSelect.innerHTML=`<option value="">${statePlaceholder}</option>`+st.map(x=>`<option value="${escapeCityHtml(x)}" ${x===startFilterState?'selected':''}>${escapeCityHtml(x)}</option>`).join('');
    const filtered=startFilterState ? cities().filter(c=>c.state===startFilterState) : [];
    citySelect.disabled=!startFilterState;
    citySelect.innerHTML=startFilterState
      ? `<option value="">${cityPlaceholder}</option>`+filtered.map(c=>`<option value="${escapeCityHtml(c.id)}" ${c.id===startFilterCityId?'selected':''}>${escapeCityHtml(c.city)}</option>`).join('')
      : `<option value="">${cityFirstPlaceholder}</option>`;
    btn.disabled=!startFilterCityId;
  }

  function mobileKpiIcon(name){
    const icons={
      city:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16"/><path d="M6 20V8.5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2V20"/><path d="M9 10h.01M12 10h.01M15 10h.01M9 14h.01M12 14h.01M15 14h.01" stroke-linecap="round" stroke-width="2.2"/><path d="M10 20v-3.2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V20"/></svg>`,
      briefcase:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7V6a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v1"/><rect x="4" y="7" width="16" height="13" rx="3"/><path d="M4 12h16M10 12v2h4v-2"/></svg>`,
      target:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>`,
      profit:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17l5-5 4 4 7-9"/><path d="M15 7h5v5"/><path d="M5 21h14"/></svg>`,
      roi:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7"/><circle cx="7.5" cy="7.5" r="2.2"/><circle cx="16.5" cy="16.5" r="2.2"/></svg>`
    };
    return `<span class="mobile-kpi-icon">${icons[name]||icons.briefcase}</span>`;
  }

  const htmlEsc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  function mobileMonthLabel(value){
    const n=Number(value);
    if(!Number.isFinite(n)||n<=0)return Localization.t('notAchieved12');
    return Localization.formatMonthDuration(n);
  }

  function mobileSetText(elementId, i18nKey, vars={}){
    const el=document.getElementById(elementId);
    if(el)el.textContent=Localization.t(i18nKey,vars);
  }

  function mobileInsightIcon(name){
    const icons={
      briefcase:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7V6a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v1"/><rect x="4" y="7" width="16" height="13" rx="3"/><path d="M4 12h16M10 12v2h4v-2"/></svg>`,
      calendar:`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>`,
      growth:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17l5-5 4 4 7-9"/><path d="M15 7h5v5"/></svg>`,
      coin:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v10M9 10.2c0-1.4 1.2-2.2 3-2.2s3 .8 3 2.2c0 1.3-1 1.9-3 2.1-2 .2-3 .8-3 2.1s1.2 2.2 3 2.2 3-.8 3-2.2"/></svg>`,
      balance:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M5 8h14M7 8l-3 6h6L7 8zM17 8l-3 6h6l-3-6z"/></svg>`
    };
    return icons[name]||icons.calendar;
  }

  let mobileTooltipSeq=0;
  function mobileInfoTooltip(text,className=''){
    const raw=String(text??'');
    const id='mobile-info-tooltip-'+(++mobileTooltipSeq);
    const aria=htmlEsc(raw.replace(/\s+/g,' ').trim());
    const body=htmlEsc(raw).replace(/\n/g,'<br>');
    const cls=className?' '+className:'';
    return `<button class="info-tooltip${cls}" type="button" aria-label="${aria}" aria-describedby="${id}"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7"/><path d="M8 7.1v4.2" stroke-linecap="round"/><circle cx="8" cy="4.8" r=".75" fill="currentColor" stroke="none"/></svg><span id="${id}" class="info-tooltip-bubble" role="tooltip">${body}</span></button>`;
  }

  function renderMobileKpis(){
    const holder=document.getElementById('mobileKpiContent');
    if(!holder||!model)return;
    const c=cityById(state.selectedCityId);
    const cityTitle=c?`${c.city}, ${c.state}`:'—';
    const pop=c?fmtNumber(c.population):'—';
    const pay=fmtBRL(model.summary.initialPayment||0);
    const paybackText=mobileMonthLabel(model.summary.paybackPeriod);
    const monthlyBreakEven=model.summary.breakEvenPeriod?`${Math.round(Number(model.summary.breakEvenPeriod))} месяц`:Localization.t('notAchieved12');
    const profitCompact=fmtBRLCompact(model.summary.netProfit);
    const cards=[
      {cls:'city',icon:'city',label:Localization.t('selectedCity'),value:cityTitle,sub:`${Localization.t('populationHeader')}: ${pop} · ${Localization.t('initialPaymentHeader')}: ${pay}`},
      {cls:'investment-editable',icon:'briefcase',label:Localization.t('initialInvestment'),value:fmtBRLCompact(model.summary.totalInvestment),sub:`${Localization.t('averageMonthlyInvestment')}: ${fmtBRLCompact(model.summary.averageMonthlyInvestment||0)}`},
      {icon:'target',label:Localization.t('breakEven'),value:paybackText,sub:`${Localization.t('monthlyEquilibrium')}: ${monthlyBreakEven}`},
      {icon:'profit',label:Localization.t('yearProfit'),value:profitCompact},
      {icon:'roi',label:Localization.t('kpiMargin'),value:Math.round(model.summary.roi)+' %'}
    ];
    const cardHtml=cards.map(x=>{
      return `<div class="mobile-kpi-card ${x.cls||''}">${mobileKpiIcon(x.icon)}<div class="mobile-kpi-copy"><div class="mobile-kpi-label">${htmlEsc(x.label)}</div><div class="mobile-kpi-value">${htmlEsc(x.value)}</div>${x.sub?`<div class="mobile-kpi-sub">${htmlEsc(x.sub)}</div>`:''}</div></div>`;
    }).join('');
    holder.innerHTML=cardHtml;
  }

  function mobileChartConfig(){
    if(!model)return null;
    const months=model.months.filter(x=>x.index>1);
    const labels=months.map((m,i)=>String(i+1));
    const net=months.map(x=>x.netProfit);
    const accumulated=months.map(x=>x.accumulated);
    return {
      type:'bar',
      data:{labels,datasets:[
        {label:Localization.t('monthlyNetProfit'),data:net,backgroundColor:net.map(v=>v<0?'rgba(226,71,71,.72)':'rgba(111,160,83,.72)'),borderColor:net.map(v=>v<0?'#e24747':'#6fa053'),borderWidth:1,borderRadius:6,barPercentage:.62,categoryPercentage:.72},
        {label:Localization.t('accumulatedNetProfit'),data:accumulated,backgroundColor:'rgba(23,59,99,.28)',borderColor:'#173b63',borderWidth:1,borderRadius:6,barPercentage:.62,categoryPercentage:.72}
      ]},
      options:{responsive:true,maintainAspectRatio:false,animation:{duration:300},interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${FinancialEngine.formatCurrencyFull(ctx.raw)}`}}},scales:{x:{grid:{display:false},ticks:{font:{size:10},autoSkip:false,maxRotation:0}},y:{ticks:{callback:v=>FinancialEngine.formatCurrencyCompact(v),font:{size:10},maxTicksLimit:6},grid:{color:'#e5e7eb'},beginAtZero:true}}}
    };
  }

  function renderMobileChart(){
    const canvas=document.getElementById('mobileCashFlowChart');
    if(!model||!isMobileLayout())return;
    const title=document.querySelector('#mobileChartScreen .mobile-chart-card h2');
    if(title)title.textContent='Динамика денежного потока';
    const note=document.getElementById('mobileChartNote');
    if(note)note.textContent=model.summary.paybackPeriod?Localization.t('mobileCashFlowNote',{payback:mobileMonthLabel(model.summary.paybackPeriod)}):Localization.t('noPaybackText');
    if(!canvas||!window.Chart)return;
    const cfg=mobileChartConfig();
    if(!cfg)return;
    if(mobileChart&&mobileChart.config&&mobileChart.config.type!==cfg.type){mobileChart.destroy();mobileChart=null;}
    if(mobileChart){mobileChart.data=cfg.data;mobileChart.options=cfg.options;mobileChart.resize();mobileChart.update();}
    else mobileChart=new Chart(canvas,cfg);
    const legend=document.getElementById('mobileChartLegend');
    if(legend){
      legend.innerHTML=`<span><i class="mobile-chart-dot" style="background:#6fa053"></i>${Localization.t('monthlyNetProfit')}</span><span><i class="mobile-chart-dot" style="background:#173b63"></i>${Localization.t('accumulatedNetProfit')}</span>`;
    }
  }

  function updateMobileWhatsAppCta(){
    const finalCta=document.getElementById('mobileWhatsAppCta');
    const stickyCta=document.getElementById('mobileStickyCta');
    const href='https://taxs.ee/maxbot';
    const markup='<span class="max-cta-brand"><img src="assets/max-cta.png" alt="MAX" /></span><span>Обсудить в MAX</span>';
    if(finalCta){
      finalCta.href=href;
      finalCta.setAttribute('aria-label','Обсудить в MAX');
      if(!finalCta.querySelector('img'))finalCta.innerHTML=markup;
    }
    if(stickyCta){
      stickyCta.href=href;
      stickyCta.setAttribute('aria-label','Обсудить в MAX');
      if(!stickyCta.querySelector('img'))stickyCta.innerHTML=markup;
    }
  }


  function setupMobileStickyCtaVisibility(){
    const stickyCta=document.getElementById('mobileStickyCta');
    const finalCta=document.querySelector('.final-cta-section');
    if(!stickyCta)return;
    const setHidden=hidden=>{
      stickyCta.classList.toggle('is-hidden',!!hidden);
      stickyCta.setAttribute('aria-hidden',hidden?'true':'false');
      if(hidden){stickyCta.dataset.prevTabindex=stickyCta.getAttribute('tabindex')||'';stickyCta.setAttribute('tabindex','-1');}
      else if(stickyCta.dataset.prevTabindex!==undefined){const prev=stickyCta.dataset.prevTabindex;if(prev)stickyCta.setAttribute('tabindex',prev);else stickyCta.removeAttribute('tabindex');delete stickyCta.dataset.prevTabindex;}
    };
    if(mobileStickyCtaObserver){
      try{mobileStickyCtaObserver.disconnect();}catch(_e){}
      mobileStickyCtaObserver=null;
    }
    if(!finalCta||!('IntersectionObserver' in window)){
      const onScroll=()=>{
        const target=document.querySelector('.final-cta-section');
        if(!target){setHidden(false);return;}
        const rect=target.getBoundingClientRect();
        const viewportHeight=window.innerHeight||document.documentElement.clientHeight||0;
        setHidden(rect.top < viewportHeight * 0.82 && rect.bottom > viewportHeight * 0.18);
      };
      if(stickyCta.dataset.scrollFallbackBound!=='1'){
        stickyCta.dataset.scrollFallbackBound='1';
        window.addEventListener('scroll',onScroll,{passive:true});
        window.addEventListener('resize',onScroll);
      }
      setTimeout(onScroll,0);
      return;
    }
    mobileStickyCtaObserver=new IntersectionObserver(([entry])=>{
      setHidden(entry && entry.isIntersecting);
    },{threshold:0.35});
    mobileStickyCtaObserver.observe(finalCta);
  }

  function renderMobileInsights(){
    const dst=document.getElementById('mobileStandaloneInsights');
    if(!dst||!model)return;
    const rows=UIRenderer.getInsightRows(model);
    dst.innerHTML=rows.map(row=>`<div class="insight" data-tone="${row.tone||'neutral'}"><div class="insight-badge">${mobileInsightIcon(row.icon)}</div><div><div class="insight-title">${htmlEsc(Localization.t(row.title))}</div><div class="insight-text">${htmlEsc(Localization.t(row.text,row.vars||{}))}</div></div></div>`).join('');
  }

  function renderMobileSummary(){
    const dst=document.getElementById('mobileStandaloneSummary');
    if(!dst||!model)return;
    const rows=[
      ['totalInvestment',model.summary.totalInvestment,'currency','summary-investment-row'],
      ['totalPartnerRevenue',model.summary.totalPartnerRevenue,'currency','summary-positive-row'],
      ['summaryOperatingExpenses',model.summary.totalOperatingExpenses,'currency','summary-expense-row'],
      ['netProfit',model.summary.netProfit,'currency','summary-positive-row'],
      ['roi12',model.summary.roi,'%','summary-positive-row'],
      ['paybackPeriod',model.summary.paybackPeriod?Localization.formatMonthDuration(model.summary.paybackPeriod):Localization.t('notAchieved12'),'','summary-positive-row']
    ];
    dst.innerHTML=rows.map(([key,val,type,cls])=>{
      const value=typeof val==='number'?(type==='%'?Math.round(val)+' %':fmtBRL(val)):val;
      return `<div class="summary-row ${cls||''}"><span>${htmlEsc(Localization.t(key))}</span><span>${htmlEsc(value)}</span></div>`;
    }).join('');
  }

  function renderMobilePresentation(){
    mobileSetText('mobilePresentationTitle','mobilePresentationTitle');
    mobileSetText('mobilePresentationText','mobilePresentationText');
    mobileSetText('mobileFinalCtaTitle','mobileFinalCtaTitle');
    mobileSetText('mobileFinalCtaText','mobileFinalCtaText');
    mobileSetText('mobileDisclaimer','mobileDisclaimer');
    const list=document.getElementById('mobilePresentationList');
    if(list){
      list.innerHTML=[1,2,3,4,5].map(i=>`<li>${htmlEsc(Localization.t('mobilePresentationPoint'+i))}</li>`).join('');
    }
  }

  function renderMobileSummaryAndDetail(){
    const insightsTitle=document.querySelector('#mobileSummaryScreen .mobile-info-panel h2');
    const resumoTitle=document.querySelector('#mobileResumoScreen .mobile-info-panel h2');
    if(insightsTitle)insightsTitle.textContent='Ключевые выводы';
    if(resumoTitle)resumoTitle.textContent='Итоги за 12 месяцев';
    renderMobileInsights();
    renderMobileSummary();
    renderMobilePresentation();
    updateMobileWhatsAppCta();
    setupMobileStickyCtaVisibility();
  }



  function mobilePageOrder(){return ['kpi','chart','summary','resumo','presentation'];}
  function mobileNextPage(page){const a=mobilePageOrder();const i=a.indexOf(page);return i>=0&&i<a.length-1?a[i+1]:page;}
  function mobilePrevPage(page){const a=mobilePageOrder();const i=a.indexOf(page);return i>0?a[i-1]:page;}

  function bindMobileGestures(){
    const app=document.getElementById('mobileApp');
    if(!app||app.dataset.gesturesBound==='1')return;
    app.dataset.gesturesBound='1';
    // Mobile result now uses normal vertical scroll-flow.
    // Do not convert swipe gestures into slide navigation, otherwise
    // ordinary scrolling can jump back to KPI and hide later sections.
  }

  function renderMobileApp(){
    if(!document.getElementById('mobileApp'))return;
    renderMobileStartScreen();
    if(model){
      renderMobileKpis();
      renderMobileSummaryAndDetail();
      if(!document.getElementById('mobileApp').dataset.page)document.getElementById('mobileApp').dataset.page='kpi';
      if(isMobileLayout())setTimeout(renderMobileChart,50);
    }
  }

  function recalc(){
    state.activeScenario=state.scenarios.find(s=>s.id===state.activeScenarioId)||state.scenarios[0];
    state.activeScenario.assumptions=FinancialEngine.normalizeAssumptions(state.activeScenario.assumptions);
    const v=Validation.validateAssumptions(state.activeScenario.assumptions);
    errors=v.errors;
    model=FinancialEngine.calculate(state.activeScenario.assumptions);
    model.currency='RUB';
    UIRenderer.renderAll(state,model,errors);
    renderSelectedCityBanner();
    renderParameterButtonLabels();
    renderStartScreen();
    syncMobilePresentation();
    renderMobileApp();
    document.dispatchEvent(new CustomEvent('maxim:model-rendered',{detail:{model,state}}));
    setScreen();
    document.getElementById('undoBtn')?.classList.toggle('disabled',undo.length===0);
    document.getElementById('redoBtn')?.classList.toggle('disabled',redo.length===0);
    persist();
  }

  function onInput(e){
    const el=e.target;
    if(el.dataset.currencyInput!==undefined){return}
    if(el.dataset.input){
      pushUndo();
      state.activeScenario.assumptions[el.dataset.input]=Number(el.value);
      if(el.dataset.input==='operatingExpenses'){
        const rows=state.activeScenario.assumptions.expenseRows||[];
        const base=rows.find(r=>r.id==='other_costs')||rows.find(r=>r.id!=='assistente')||rows[0];
        if(base&&base.id!=='assistente')base.amount=Number(el.value);
      }
      recalc();return;
    }
    if(el.dataset.marketingPct){pushUndo();const idx=Number(el.dataset.marketingPct)-1;const a=FinancialEngine.normalizeAssumptions(state.activeScenario.assumptions);a.marketingDistribution[idx]=Math.max(0,Number(el.value)||0);a.marketingDistributionPreset='manual';state.activeScenario.assumptions=a;recalc();return}
    if(el.dataset.ridesPct){pushUndo();const idx=Number(el.dataset.ridesPct)-1;const a=FinancialEngine.normalizeAssumptions(state.activeScenario.assumptions);a.ridesDistribution[idx]=Math.max(0,Number(el.value)||0);a.ridesDistributionPreset='manual';state.activeScenario.assumptions=a;recalc();return}
    if(el.dataset.ruleThreshold){pushUndo();const row=(state.activeScenario.assumptions.revenueRules||[]).find(r=>r.id===el.dataset.ruleThreshold);if(row)row.threshold=Math.max(0,Number(el.value)||0);recalc();return}
    if(el.dataset.ruleShare){pushUndo();const row=(state.activeScenario.assumptions.revenueRules||[]).find(r=>r.id===el.dataset.ruleShare);if(row)row.maximShare=Math.min(100,Math.max(0,Number(el.value)||0));recalc();return}
    if(el.dataset.preset){pushUndo();state.activeScenario.assumptions=FinancialEngine.applyPreset(state.activeScenario.assumptions,el.dataset.preset,el.value);recalc();return}
    if(el.dataset.expenseVisible){pushUndo();const row=(state.activeScenario.assumptions.expenseRows||[]).find(r=>r.id===el.dataset.expenseVisible);if(row)row.showInModel=el.checked;recalc();return}
    if(el.dataset.expenseAmount){pushUndo();const row=(state.activeScenario.assumptions.expenseRows||[]).find(r=>r.id===el.dataset.expenseAmount);if(row&&row.id!=='assistente'){row.amount=Number(el.value);state.activeScenario.assumptions.operatingExpenses=Number(el.value)}recalc();return}
    if(el.dataset.expenseName){pushUndo();const row=(state.activeScenario.assumptions.expenseRows||[]).find(r=>r.id===el.dataset.expenseName);if(row&&row.id!=='assistente')row.name=el.value.trim()||'Expense';recalc();}
  }

  function bind(){
    document.body.addEventListener('change',onInput);
    document.body.addEventListener('keydown',e=>{
      const modal=document.getElementById('parametersModal');
      if(!modal?.hidden&&e.key==='Escape'){e.preventDefault();closeParametersModal();}
      if(!modal?.hidden&&e.key==='Enter'&&e.target?.tagName!=='BUTTON'){e.preventDefault();confirmParameters();}
    });
    const mobileNavHandler=e=>{
      const nav=e.target.closest?.('[data-mobile-page-target]');
      if(nav&&isMobileLayout()){
        e.preventDefault();
        e.stopPropagation();
        mobileSetPage(nav.dataset.mobilePageTarget);
      }
    };
    document.body.addEventListener('pointerup',mobileNavHandler,{capture:true});
    document.body.addEventListener('touchend',mobileNavHandler,{capture:true,passive:false});
    document.body.addEventListener('click',e=>{
      const adminLoginTrigger=e.target.closest('[data-admin-login]');
      if(adminLoginTrigger){openAdminLogin(adminLoginTrigger);return}
      if(e.target.closest('[data-close-admin-login]')){closeAdminLogin();return}
      if(e.target.closest('#adminLoginSubmit')){void confirmAdminLogin();return}
      if(e.target.closest('[data-admin-logout]')){
        setAdminSession(false);
        adminNotice={text:'',tone:''};
            return;
      }
      const adminAdd=e.target.closest('[data-admin-add]');
      if(adminAdd){addAdminCity(adminAdd.closest('[data-admin-panel]'));return}
      if(e.target.closest('[data-admin-delete]')){deleteAdminCity();return}
      if(e.target.closest('[data-admin-reset]')){resetAdminCities();return}
      const parametersTrigger=e.target.closest('#parametersBtn, #mobileParametersBtn');
      if(parametersTrigger){openParametersModal(parametersTrigger);return}
      if(e.target.closest('[data-close-parameters-modal], #cancelParametersBtn')){closeParametersModal();return}
      if(e.target.closest('#confirmParametersBtn')){confirmParameters();return}
      const mobilePageNav=e.target.closest('[data-mobile-page-target]');
      if(mobilePageNav){mobileSetPage(mobilePageNav.dataset.mobilePageTarget);return}
      const mobileNav=e.target.closest('[data-mobile-target]');
      if(mobileNav){mobileScrollTo(mobileNav.dataset.mobileTarget);return}
      const cityRow=e.target.closest('[data-city-row]');
      if(cityRow){const city=cityById(cityRow.dataset.cityRow);if(city){startFilterState=city.state;startFilterCityId=city.id;}renderStartScreen();renderMobileStartScreen();return}
      const del=e.target.closest('[data-expense-delete]');
      if(del){pushUndo();const id=del.dataset.expenseDelete;state.activeScenario.assumptions.expenseRows=(state.activeScenario.assumptions.expenseRows||[]).filter(r=>r.id!==id || r.removable===false);recalc();return}
      const ruleDel=e.target.closest('[data-rule-delete]');
      if(ruleDel){pushUndo();const id=ruleDel.dataset.ruleDelete;state.activeScenario.assumptions.revenueRules=(state.activeScenario.assumptions.revenueRules||[]).filter(r=>r.id!==id || r.removable===false);recalc();return}
      if(e.target.id==='addRevenueRule'){pushUndo();const rules=state.activeScenario.assumptions.revenueRules||(state.activeScenario.assumptions.revenueRules=[]);rules.push(FinancialEngine.createRevenueRule(0,100));recalc();return}
      if(e.target.id==='addExpenseRow'){pushUndo();const rows=state.activeScenario.assumptions.expenseRows||(state.activeScenario.assumptions.expenseRows=[]);rows.push(FinancialEngine.createExpenseRow('New Expense',0));recalc();return}
      if(e.target.id==='startCalculateBtn'||e.target.id==='mobileCalculateBtn'){
        const city=cityById(startFilterCityId);
        if(!city)return;
        pushUndo();applySelectedCity(city);recalc();
        if(isMobileLayout())mobileSetPage('kpi');
        else window.scrollTo({top:0,behavior:'auto'});
        return;
      }
      if(e.target.closest('#changeCityBtn')||e.target.closest('#mobileChangeCityBtn')){
        state.selectedCityId=null;delete document.body.dataset.mobileSlide;renderStartScreen();setScreen();persist();return;
      }
    });
    document.body.addEventListener('dblclick',e=>{
      const cell=e.target.closest('[data-month-edit]');
      if(!cell||cell.querySelector('input.month-pct-editor'))return;
      const current=Number(cell.dataset.currentPct)||0;
      const input=document.createElement('input');input.className='month-pct-editor';input.type='number';input.step='0.1';input.min='0';input.value=current;
      cell.innerHTML='';cell.appendChild(input);input.focus();input.select();
      const commit=()=>{if(!input.isConnected)return;pushUndo();const idx=Number(cell.dataset.monthNo)-1;const a=FinancialEngine.normalizeAssumptions(state.activeScenario.assumptions);if(cell.dataset.monthEdit==='marketing'){a.marketingDistribution[idx]=Math.max(0,Number(input.value)||0);a.marketingDistributionPreset='manual'}if(cell.dataset.monthEdit==='rides'){a.ridesDistribution[idx]=Math.max(0,Number(input.value)||0);a.ridesDistributionPreset='manual'}state.activeScenario.assumptions=a;recalc()};
      input.addEventListener('blur',commit,{once:true});
      input.addEventListener('keydown',ev=>{if(ev.key==='Enter')input.blur();if(ev.key==='Escape')recalc()});
    });
    document.getElementById('startLanguageSelect')?.addEventListener('change',e=>{state.language=e.target.value;renderStartScreen();renderMobileApp();persist()});
    document.getElementById('mobileStartLanguageButton')?.addEventListener('click',()=>{state.language='ru-RU';Localization.setLanguage(state.language);renderStartScreen();renderMobileApp();persist()});
    document.getElementById('mobileLanguageSelect')?.addEventListener('change',e=>{state.language=e.target.value;recalc();persist()});
    window.addEventListener('resize',()=>{if(isMobileLayout()&&cityById(state.selectedCityId)&&!document.body.dataset.mobileSlide)document.body.dataset.mobileSlide='kpi';});
    document.getElementById('annualInvestmentBudgetInput')?.addEventListener('input',e=>{
      const input=e.currentTarget;
      const raw=parseBudgetValue(input.value);
      input.value=formatBudgetValue(raw);
      try{input.setSelectionRange(input.value.length,input.value.length);}catch(_e){}
      updateBudgetAssessment();
    });
    document.getElementById('startStateSelect').addEventListener('change',e=>{startFilterState=e.target.value;startFilterCityId='';renderStartScreen();renderMobileStartScreen()});
    document.getElementById('startCitySelect').addEventListener('change',e=>{startFilterCityId=e.target.value;renderStartScreen();renderMobileStartScreen()});
    document.getElementById('mobileStateSelect')?.addEventListener('change',e=>{startFilterState=e.target.value;startFilterCityId='';renderStartScreen();renderMobileStartScreen()});
    document.getElementById('mobileCitySelect')?.addEventListener('change',e=>{startFilterCityId=e.target.value;renderStartScreen();renderMobileStartScreen()});
    document.getElementById('notesArea')?.addEventListener('input',e=>{state.activeScenario.notes=e.target.value;persist()});
    document.getElementById('languageSelect')?.addEventListener('change',e=>{state.language=e.target.value;recalc()});
    document.getElementById('modeToggle')?.addEventListener('click',()=>{state.advanced=!state.advanced;recalc()});
    document.getElementById('resetBtn')?.addEventListener('click',()=>{if(!confirm(Localization.t('confirmReset')))return;pushUndo();const type=['conservative','optimistic'].includes(state.activeScenarioId)?state.activeScenarioId:'base';state.activeScenario.assumptions=FinancialEngine.defaultAssumptions(type);const c=cityById(state.selectedCityId);if(c)applySelectedCity(c);recalc()});
    document.getElementById('undoBtn')?.addEventListener('click',()=>{if(!undo.length)return;redo.push(snapshot());restore(undo.pop())});
    document.getElementById('redoBtn')?.addEventListener('click',()=>{if(!redo.length)return;undo.push(snapshot());restore(redo.pop())});
  }
  function init(){hydrate();bind();bindMobileGestures();recalc()}
  return{init}
})();
// UX upgrade layer inspired by international calculator patterns.
// UX layer for the fixed Russian V3 model.
const MaximUXUpgrade=(()=>{
  let latestModel=null;
  let latestState=null;
  const money=v=>FinancialEngine.formatCurrencyFull(Number(v)||0);
  const num=v=>Math.round(Number(v)||0).toLocaleString('ru-RU');
  const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');

  const sectionHelp={
    investment:{title:'Инвестиции',text:'Инвестиции — средства, которые партнёр вкладывает в запуск и развитие сервиса «Максим» в своём населённом пункте. В расчёте инвестиции состоят только из паушального взноса и рекламы.',items:[
      ['Паушальный взнос','Разовый платёж за запуск франшизного подразделения и право использования программного обеспечения, технологий и бренда сервиса «Максим». В него входят доступ к IT-платформе, запуск и настройка подразделения, обучение и сопровождение партнёра. Сервис «Максим» также за свой счёт формирует стартовый рекламный пакет, приобретает материалы и организует их доставку в город франчайзи. Размер взноса зависит от численности населения и учитывается в первом месяце.'],
      ['Реклама','Главная регулярная инвестиция партнёра после запуска. Она формирует узнаваемость сервиса, помогает привлекать пассажиров и водителей и поддерживает рост заказов. На старте продвижение особенно важно; по мере развития подразделения рекомендуемый бюджет постепенно снижается.']
    ]},
    operations:{title:'Доходы',text:'Раздел показывает развитие объёма выполненных заказов и доход, который получает партнёр от работы сервиса. Основной источник дохода — комиссия с выполненных заказов. При работе с Контакт центром дополнительно учитывается надбавка «Оператор».',items:[
      ['Заказов в день','Среднее прогнозное количество выполненных заказов в день в соответствующем месяце. Показатель растёт по мере развития подразделения и приближения к потенциалу выбранного города.'],
      ['Заказов в месяц','Прогнозное количество выполненных заказов за месяц. Рассчитывается на основе среднего количества заказов в день.'],
      ['Надбавка «Оператор»','Дополнительный доход по выполненным заказам, оформленным через Контакт центр. За каждый выполненный заказ через оператора партнёр получает 25 ₽. Показатель появляется только при включённой работе с Контакт центром.'],
      ['Комиссия по выполненным заказам','Основной доход партнёра. В базовом сценарии средний чек поездки — 250 ₽, комиссия — 12%. Оба параметра можно изменить в окне «Параметры».']
    ]},
    expenses:{title:'Операционные расходы',text:'Операционные расходы — регулярные затраты, возникающие в процессе работы сервиса. В отличие от паушального взноса и рекламы, они не относятся к инвестициям в запуск и зависят от объёма работы подразделения и финансового результата.',items:[
      ['Услуга «Ассистент»','«Ассистент» — отдел поддержки пользователей сервиса. Он обрабатывает входящие обращения от водителей и клиентов, проверяет заказы на наличие нарушений, обрабатывает анкеты новых водителей и проверяет фотоконтроли. Услуга заменяет отдельного менеджера со стороны партнёра и снижает издержки на оплату труда персонала. Стоимость зависит от суммы роялти: до 3 000 ₽ — 7 000 ₽; от 3 000 до 38 999 ₽ — 14 000 ₽; от 39 000 ₽ — 21 000 ₽. В первый рабочий месяц действует скидка 50%.'],
      ['Звонки в КЦ','Расходы возникают только при включённой работе с Контакт центром. Стоимость одного звонка — 16 ₽. В модели выполненные заказы через КЦ корректируются на коэффициент 1,25 для учёта принятых заказов, после чего используется среднее 1,2 звонка на результативный заказ.'],
      ['СМС','Сервисные сообщения в процессе выполнения заказов. Стоимость одного СМС — 8 ₽. В расчёте используется среднее число СМС по франчайзинговой сети: 10% от количества выполненных заказов.'],
      ['ИВР','Автоматические голосовые уведомления клиенту. Стоимость одного ИВР — 2,5 ₽. Базово в расчёте используется 1 ИВР на 20 выполненных заказов. При работе с Контакт центром каждый звонок КЦ добавляет ещё 2 ИВР: сообщение о том, что машина назначена, и сообщение о том, что водитель приехал на адрес.'],
      ['Роялти','Регулярное вознаграждение сервису «Максим», которое зависит от валовой прибыли подразделения. При валовой прибыли менее 30 000 ₽ роялти не начисляется. От 30 000 ₽ ставка составляет 10%; далее за каждые полные дополнительные 10 000 ₽ ставка увеличивается на 2 процентных пункта. Максимальная ставка — 30%.'],
      ['Итого','Сумма всех операционных расходов соответствующего месяца. Паушальный взнос и реклама сюда не входят.']
    ]},
    profit:{title:'Прибыль',text:'Раздел показывает итоговый финансовый результат партнёра после учёта доходов, инвестиций и операционных расходов.',items:[
      ['Чистая прибыль','Финансовый результат за конкретный месяц после учёта всех доходов и расходов этого месяца. В первом месяце дополнительно учитывается паушальный взнос; реклама учитывается в месяцах её размещения.'],
      ['Накопленная чистая прибыль','Сумма финансового результата с начала работы подразделения. Месяц, в котором накопленный результат становится неотрицательным, считается месяцем окупаемости инвестиций.']
    ]}
  };
  const metricHelp={};

  function openModal(id){
    const modal=document.getElementById(id); if(!modal)return;
    modal.hidden=false; modal.setAttribute('aria-hidden','false');
    document.body.classList.add('ux-modal-open');
    setTimeout(()=>modal.querySelector('.ux-modal-close,button,a')?.focus(),0);
  }
  function closeModal(id){
    const modal=document.getElementById(id); if(!modal)return;
    modal.hidden=true; modal.setAttribute('aria-hidden','true');
    if(!document.querySelector('.ux-modal:not([hidden])'))document.body.classList.remove('ux-modal-open');
  }
  function closeAll(){['uxInfoModal','advertisingModal','advertisingPlanModal','brandGalleryModal','starterPackageModal'].forEach(closeModal);}
  function openInfo(title,eyebrow,html){
    const titleEl=document.getElementById('uxInfoModalTitle');
    const eyebrowEl=document.getElementById('uxInfoModalEyebrow');
    const body=document.getElementById('uxInfoModalBody');
    if(titleEl)titleEl.textContent=title;
    if(eyebrowEl)eyebrowEl.textContent=eyebrow||'';
    if(body)body.innerHTML=html;
    openModal('uxInfoModal');
  }
  function openSectionHelp(section){
    const data=sectionHelp[section]; if(!data)return;
    const callCenterEnabled=latestModel?.assumptions?.callCenterEnabled===true;
    const hiddenWhenCallCenterOff=new Set(['Надбавка «Оператор»','Звонки в КЦ']);
    const items=callCenterEnabled
      ? data.items
      : data.items.filter(([name])=>!hiddenWhenCallCenterOff.has(name));
    let sectionText=data.text;
    if(section==='operations'&&!callCenterEnabled){
      sectionText='Раздел показывает развитие объёма выполненных заказов и доход, который получает партнёр от работы сервиса. Основной источник дохода — комиссия с выполненных заказов.';
    }
    openInfo(data.title,'Описание раздела',`<p class="ux-lead">${esc(sectionText)}</p><div class="help-metric-list">${items.map(([name,text])=>`<article class="help-metric-item"><div class="help-metric-title"><strong>${esc(name)}</strong></div><p>${esc(text)}</p></article>`).join('')}</div>`);
  }
  function selectedCity(){
    const cities=Array.isArray(window.CityData)?window.CityData:[];
    return cities.find(c=>c.id===latestState?.selectedCityId)||latestState?.selectedCitySnapshot||null;
  }
  function openInitialPayment(){
    if(!latestModel)return;
    const city=selectedCity();
    const cityName=city?`${city.city}, ${city.state}`:'Выбранный населённый пункт';
    const population=city?.population??latestModel.assumptions?.population??0;
    const payment=city?.initialPayment??latestModel.summary?.initialPayment??latestModel.assumptions?.initialInvestment??0;
    openInfo('Паушальный взнос','Инвестиции',`<div class="detail-value-card"><span>${esc(cityName)}</span><strong>${money(payment)}</strong><small>Население: ${num(population)} чел.</small></div><p class="ux-lead">Паушальный взнос — разовый платёж за запуск франшизного подразделения и право использования программного обеспечения, технологий и бренда сервиса «Максим».</p><div class="detail-copy-card"><strong>Что входит в паушальный взнос</strong><ul><li>доступ к IT-платформе и программному обеспечению;</li><li>запуск и настройка подразделения;</li><li>право использования бренда и стандартов сервиса;</li><li>обучение и сопровождение партнёра на старте;</li><li>стартовый рекламный пакет: сервис «Максим» за свой счёт формирует и приобретает материалы и организует их доставку в город франчайзи.</li></ul></div><div class="fee-rule-card"><strong>Как определяется размер</strong><div><span>до 20 000 жителей</span><b>100 000 ₽</b></div><div><span>от 20 000 до 299 999 жителей</span><b>150 000 ₽</b></div><div><span>от 300 000 жителей</span><b>400 000 ₽</b></div><small>Паушальный взнос оплачивается один раз и в финансовой модели учитывается в первом месяце.</small></div><button class="ux-feature-button ux-feature-button-single" id="openStarterPackage" type="button"><span>Стартовый пакет рекламы</span><small>Посмотреть пример макетов для запуска</small><i>›</i></button>`);
  }
  function advertisingMixForPopulation(population){
    const pop=Number(population)||0;
    const rows=[
      ['Брендирование','branding'],
      ['Билборды / сити-форматы','billboards'],
      ['Баннеры','banners'],
      ['Партнёрская реклама','partner'],
      ['Реклама в помещениях','indoor'],
      ['Печатная реклама','print'],
      ['Промо-акции','promo'],
      ['Онлайн-реклама','online']
    ];
    let shares;
    if(pop<=10000){
      shares={branding:.20,billboards:0,banners:0,partner:.30,indoor:0,print:.30,promo:0,online:.20};
    }else if(pop<30000){
      shares={branding:.20,billboards:0,banners:.20,partner:.20,indoor:0,print:.20,promo:0,online:.20};
    }else{
      shares={branding:.10,billboards:.20,banners:.10,partner:.10,indoor:.10,print:.05,promo:.05,online:.30};
    }
    return {rows,shares};
  }
  function splitAdvertisingBudget(budget,shares){
    const total=Math.max(0,Math.round(Number(budget)||0));
    const result={};
    let assigned=0;
    Object.keys(shares).forEach(key=>{
      if(key==='online')return;
      const value=Math.floor(total*(shares[key]||0));
      result[key]=value;
      assigned+=value;
    });
    result.online=Math.max(0,total-assigned);
    return result;
  }
  function renderAdvertisingPlan(){
    if(!latestModel)return;
    const city=selectedCity();
    const population=Number(city?.population??latestModel.assumptions?.population??0)||0;
    const months=(latestModel.months||[]).filter(m=>m.index>1).slice(0,12);
    const values=months.map(m=>Math.max(0,Math.round(Number(m.marketingInvestment)||0)));
    const total=values.reduce((a,b)=>a+b,0);
    const {rows,shares}=advertisingMixForPopulation(population);
    const allocations=values.map(v=>splitAdvertisingBudget(v,shares));
    const summary=document.getElementById('advertisingPlanSummary');
    const holder=document.getElementById('advertisingPlanTable');
    if(summary)summary.innerHTML=`<div class="advertising-summary-grid"><div><span>Населённый пункт</span><strong>${esc(city?`${city.city}, ${city.state}`:'—')}</strong><small>${num(population)} чел.</small></div><div><span>Реклама за 12 месяцев</span><strong>${money(total)}</strong><small>Суммы по месяцам совпадают с финансовой моделью</small></div></div>`;
    if(!holder)return;
    const bodyRows=rows.map(([name,key])=>`<tr><th>${esc(name)}</th>${allocations.map((month,i)=>`<td>${month[key]>0?money(month[key]):'—'}</td>`).join('')}</tr>`).join('');
    holder.innerHTML=`<table class="advertising-plan-table"><thead><tr><th>Рекламный инструмент</th>${values.map((_,i)=>`<th>${i+1} мес.</th>`).join('')}</tr></thead><tbody>${bodyRows}<tr class="advertising-total-row"><th>Итого</th>${values.map(v=>`<td>${money(v)}</td>`).join('')}</tr></tbody></table>`;
  }
  function openAdvertising(){openModal('advertisingModal');}
  function openAdvertisingPlan(){renderAdvertisingPlan();closeModal('advertisingModal');openModal('advertisingPlanModal');}

  function accordionRow(label,value,helpKey='',detailType=''){
    const help=helpKey?`<button class="mobile-metric-help" type="button" data-metric-help="${helpKey}" aria-label="Подробнее: ${esc(label)}">i</button>`:'';
    if(detailType){
      return `<button class="mobile-finance-row mobile-finance-detail-row" type="button" data-detail-type="${detailType}" aria-label="Подробнее: ${esc(label)}"><div class="mobile-finance-label"><span>${esc(label)}</span><span class="mobile-detail-arrow" aria-hidden="true">→</span></div><strong>${esc(value)}</strong></button>`;
    }
    return `<div class="mobile-finance-row"><div class="mobile-finance-label"><span>${esc(label)}</span>${help}</div><strong>${esc(value)}</strong></div>`;
  }
  function renderMobileAccordion(){
    const host=document.getElementById('mobileFinancialAccordion');
    if(!host||!latestModel)return;
    const s=latestModel.summary||{};
    const months=(latestModel.months||[]).filter(m=>m.index>1);
    const last=months.at(-1)||{};
    const sum=key=>months.reduce((acc,m)=>acc+(Number(m[key])||0),0);
    const callCenter=latestModel.assumptions?.callCenterEnabled===true;
    const investmentTotal=(Number(s.initialPayment)||0)+(Number(s.totalMarketingInvestment)||0);
    const incomeTotal=(Number(s.totalCommissionFromRides)||sum('commissionFromRides'))+(Number(s.totalOperatorSurcharge)||sum('operatorSurcharge'));
    const expenseTotal=Number(s.totalOperatingExpenses)||0;
    const sections=[
      {id:'investment',title:'Инвестиции',total:money(investmentTotal),rows:[
        accordionRow('Паушальный взнос',money(s.initialPayment||latestModel.assumptions?.initialInvestment||0),'','initialPurchase'),
        accordionRow('Реклама',money(s.totalMarketingInvestment||sum('marketingInvestment')),'','marketingInvestment')
      ]},
      {id:'operations',title:'Доходы',total:money(incomeTotal),rows:[
        accordionRow('Заказов в день · 12-й месяц',num(last.ridesPerDay||0)),
        accordionRow('Заказов в месяц · 12-й месяц',num(last.ridesPerMonth||0)),
        ...(callCenter?[accordionRow('Надбавка «Оператор» · 12 месяцев',money(s.totalOperatorSurcharge||sum('operatorSurcharge')))]:[]),
        accordionRow('Комиссия по выполненным заказам · 12 месяцев',money(s.totalCommissionFromRides||sum('commissionFromRides')))
      ]},
      {id:'expenses',title:'Операционные расходы',total:money(expenseTotal),rows:[
        accordionRow('Услуга «Ассистент» · 12 месяцев',money(s.totalAssistantExpense||sum('assistantExpense'))),
        ...(callCenter?[accordionRow('Звонки в КЦ · 12 месяцев',money(sum('unsuccessfulCallsExpense')))]:[]),
        accordionRow('СМС · 12 месяцев',money(sum('smsExpense'))),
        accordionRow('ИВР · 12 месяцев',money(sum('outboundCallsExpense'))),
        accordionRow('Роялти · 12 месяцев',money(s.totalRoyaltyExpense||sum('royaltyExpense'))),
        accordionRow('Итого',money(expenseTotal))
      ]},
      {id:'profit',title:'Прибыль',total:money(s.netProfit||0),rows:[
        accordionRow('Чистая прибыль · 12 месяцев',money(s.netProfit||0)),
        accordionRow('Накопленная чистая прибыль · 12-й месяц',money(last.accumulated||0))
      ]}
    ];
    host.innerHTML=`<div class="mobile-finance-head"><div><strong>Финансовая модель</strong><span>Краткая сводка по разделам</span></div></div>${sections.map((section,index)=>`<details class="mobile-finance-section" ${index===0?'open':''}><summary><span>${esc(section.title)}</span><strong>${esc(section.total)}</strong><i aria-hidden="true">⌄</i></summary><div class="mobile-finance-body">${section.rows.join('')}<button class="mobile-section-reference mobile-section-reference-large" type="button" data-section-help="${section.id}">Описание раздела →</button></div></details>`).join('')}`;
  }

  function handleClick(e){
    const section=e.target.closest('[data-section-help]');
    if(section){e.preventDefault();openSectionHelp(section.dataset.sectionHelp);return;}
    const detail=e.target.closest('[data-detail-type]');
    if(detail){e.preventDefault();detail.dataset.detailType==='marketingInvestment'?openAdvertising():openInitialPayment();return;}
    const metric=e.target.closest('[data-metric-help]');
    if(metric){e.preventDefault();const text=metricHelp[metric.dataset.metricHelp];if(text)openInfo('Пояснение','Показатель',`<p class="ux-lead">${esc(text)}</p>`);return;}
    if(e.target.closest('[data-close-ux-modal]')){closeModal('uxInfoModal');return;}
    if(e.target.closest('[data-close-advertising-modal]')){closeModal('advertisingModal');return;}
    if(e.target.closest('#openAdvertisingPlan')){openAdvertisingPlan();return;}
    if(e.target.closest('#backToAdvertising')){closeModal('advertisingPlanModal');openModal('advertisingModal');return;}
    if(e.target.closest('#openBrandGallery')){closeModal('advertisingModal');openModal('brandGalleryModal');return;}
    if(e.target.closest('#backFromBrandGallery')){closeModal('brandGalleryModal');openModal('advertisingModal');return;}
    if(e.target.closest('#openStarterPackage')){closeModal('uxInfoModal');openModal('starterPackageModal');return;}
    if(e.target.closest('#backToInitialPayment')){closeModal('starterPackageModal');openInitialPayment();return;}
    if(e.target.closest('[data-close-advertising-plan-modal]')){closeModal('advertisingPlanModal');return;}
    if(e.target.closest('[data-close-starter-package-modal]')){closeModal('starterPackageModal');return;}
    if(e.target.closest('[data-close-gallery-modal]')){closeModal('brandGalleryModal');return;}
  }
  function init(){
    document.addEventListener('click',handleClick);
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAll();});
    document.addEventListener('maxim:model-rendered',e=>{
      latestModel=e.detail?.model||latestModel;
      latestState=e.detail?.state||latestState;
      renderAdvertisingPlan();
      renderMobileAccordion();
    });
  }
  return{init};
})();
document.addEventListener('DOMContentLoaded',MaximUXUpgrade.init);
document.addEventListener('DOMContentLoaded',App.init);

// Shared accessible info tooltip behavior for KPI and summary icons.
document.addEventListener('DOMContentLoaded',()=>{
  const closeAll=except=>document.querySelectorAll('.info-tooltip.is-open').forEach(el=>{if(el!==except)el.classList.remove('is-open')});
  document.addEventListener('click',e=>{
    const btn=e.target.closest('.info-tooltip');
    if(btn){
      e.preventDefault();
      e.stopPropagation();
      const open=!btn.classList.contains('is-open');
      closeAll(btn);
      btn.classList.toggle('is-open',open);
      return;
    }
    closeAll();
  });
  document.addEventListener('pointerout',e=>{
    const btn=e.target.closest('.info-tooltip');
    if(btn&&e.relatedTarget&&!btn.contains(e.relatedTarget))btn.classList.remove('is-open');
  },true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAll();});
});
