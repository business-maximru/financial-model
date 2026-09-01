'use strict';
const Storage=(()=>{const KEY='financialModelCalculator.russia.price2026.v2';function save(state){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){console.warn('Autosave failed',e)}}function load(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){return null}}function clear(){localStorage.removeItem(KEY)}return{save,load,clear}})();
