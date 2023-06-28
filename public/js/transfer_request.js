'use strict';

let input; //from html

async function data_handler() {
  let invoice = document.getElementById('invoice_input').value;
  let amount = +document.getElementById('amount_input').value;
  if (typeof(amount) !== 'number' || isNaN(amount)) return;
  if (amount < 0.01) return;
  if (amount.toString().includes('.')) {
    if (amount.toString().length - amount.toString().indexOf('.') > 3) return;
  }
  document.getElementById('invoice_input').value = '';
  document.getElementById('amount_input').value = '';
  
  let order = {
   to: input.to, 
   contract: input.contract,
   amount: amount,
   invoice: invoice,
  }
  await navigator.clipboard.writeText(JSON.stringify(order));
  let info_text = `Запрос перевода себе суммы<br>${text_amount(amount)}`;
  info_text += `${(invoice) ? '<br>с назначением перевода:<br>' + '"' + invoice + '"' : ''}`;
  info_text += '<br>скопирован в буфер обмена';
  document.querySelector('#informScreen>div').innerHTML = info_text;
  document.getElementById('informScreen').style.visibility = 'visible';


}

function init () {
  document.querySelector('#pageHeader>div').innerHTML = input.issuer_name;
  document.querySelector('#pageHeader>a').href = location.origin;
  document.getElementById('button_input').addEventListener('click', function() {
    let button_label = this.innerHTML;
    let color = this.style.color;
    this.style.color = '#768c9e';
    this.innerHTML = 'Обработка данных...';
    setTimeout(() => {
      this.innerHTML = button_label;
      this.style.color = color;
    }, 300);
    data_handler();
  });
  document.getElementById('button_info').addEventListener('click', function() {
    document.getElementById('informScreen').style.visibility = 'hidden';
  });

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
