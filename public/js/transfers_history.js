'use strict';

let parameters; //from html
let db;

async function init () {
  document.querySelector('#pageHeader>div').innerHTML = parameters.issuer_name;
  document.querySelector('#pageHeader>a').href = location.origin;

  document.getElementById('pageBody').addEventListener('click', async function(event) {
    let div = event.target.closest('div')
    if (!div.dataset.trHash) return;
    let object = await db.transaction('transactions').objectStore('transactions')
    .index('tr_idx').get([parameters.who, div.dataset.trHash]);
    let upload = {
      token: object.token,
      timestamp: object.timestamp,
      nonce: object.nonce,
      amount: object.amount,
      signature: object.signature,
      invoice: object.invoice,
      block: object.block,
      tr_hash: object.tr_hash,
    }
    await navigator.clipboard.writeText(JSON.stringify(upload));
    let tmp_title = div.dataset.title;
    div.dataset.title = 'Токен с данными о транзакции скопирован в буфер обмена'
    setTimeout( () => div.dataset.title = tmp_title, 5000);
  });


  db = await idb.openDB("store", parameters.db_ver);
  let trx_list = await db.transaction('transactions').objectStore('transactions')
    .index('tr_idx').getAll(IDBKeyRange.bound(
    [parameters.who, '0x0000000000000000000000000000000000000000000000000000000000000000'], 
    [parameters.who, '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'],
    true, true));
  trx_list.sort( (a, b) => b.block - a.block);

  let html = '';                                              
  for (let i = 0; i < trx_list.length; i++) {
    let time = new Date(trx_list[i].block_time * 1000);
    let dir_tion = (trx_list[i].direction == 'received') ? ["received", '&#8681'] : 
      (trx_list[i].direction == 'sent') ? ["sent", '&#8679'] : ["unknown" ,'&#11217'];

    html += `<div data-title="${trx_list[i].counterparty}"` + 
      ` data-tr-hash="${trx_list[i].tr_hash}" title="Нажать для выгрузки перевода">` +
      `<span id="direction" class=${dir_tion[0]}>${dir_tion[1]}</span>` +
      `<span id="time">${time.toLocaleDateString()} ${time.toLocaleTimeString()}</span>` + 
      `<span id="invoice">${trx_list[i].invoice || 'Без назначения'}</span>` +
      `<span id="amount">${text_amount(trx_list[i].amount)}</span></div>`;  
  }
  html += document.getElementById('pageBody').innerHTML;
  document.getElementById('pageBody').innerHTML = html;
}

function text_amount(amount) {
  if (typeof(amount) !== 'number' || isNaN(amount)) return 'Сумма не определена';
  if (amount < 0) return 'Сумма не определена';
  if (amount.toString().includes('.')) {
    if (amount.toString().length - amount.toString().indexOf('.') > 3) return 'Сумма не определена';
  }
  let decimal = `<span>,${(amount % 1).toFixed(2).slice(2)} \u20bd</span>`;
  amount = amount - amount % 1;
  let integer = '';
  let count = 0;
  while (amount) {
    if (amount < 1000) {    
      integer = ' ' + (amount % 1000).toString() + integer;
    } else {
      integer = ' ' + (amount % 1000).toString().padStart(3, '0') + integer;
    }
    amount = (amount - amount % 1000) / 1000;
    if (++count > 10) throw new Error('Ошибка форматирования суммы средств');
  }
  return (integer || '0') + decimal;
}


document.addEventListener("DOMContentLoaded", () => setTimeout(init, 0));
