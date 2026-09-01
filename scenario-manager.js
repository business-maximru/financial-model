'use strict';
const ScenarioManager=(()=>{
  function builtIns(){return [
    {id:'conservative',name:'Консервативный',builtIn:true,assumptions:FinancialEngine.defaultAssumptions('conservative'),notes:'Значения в рублях. Консервативный сценарий для РФ.'},
    {id:'base',name:'Базовый',builtIn:true,assumptions:FinancialEngine.defaultAssumptions('base'),notes:'Значения в рублях. Рекомендуемый расчёт: средний чек 250 ₽, комиссия 12%.'},
    {id:'optimistic',name:'Оптимистичный',builtIn:true,assumptions:FinancialEngine.defaultAssumptions('optimistic'),notes:'Значения в рублях. Оптимистичный сценарий роста заказов.'}
  ]}
  function duplicate(s){return{...JSON.parse(JSON.stringify(s)),id:'custom_'+Date.now(),name:s.name+' — копия',builtIn:false}}
  return{builtIns,duplicate}
})();
