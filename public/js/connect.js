'use strict';

let issuer_name; //from html
let web3;
let connect_request;

async function data_handler() {
  connect_request = undefined;
  await navigator.clipboard.writeText('');
  let current_address = web3.currentProvider.selectedAddress;
  if (!current_address) {     	
    show_info('Заблокирован счет в MetaMask');
    return;
  }
  current_address = web3.utils.toChecksumAddress(current_address);

  let bank_account_id = document.getElementById('bank_account_id').value;
  document.getElementById('bank_account_id').value = '';
  if (!bank_account_id) return;

  let signature;
  try { 
    document.getElementById('inputBlock').style.visibility = 'hidden';
    signature = await web3.eth.personal.sign(
      bank_account_id + current_address, current_address);
  } catch(err) {
      show_info(err.message);
      return;
  } finally {
      document.getElementById('inputBlock').style.visibility = 'visible';
  }
  
  connect_request = {
    bank_account_id: bank_account_id,
    account: current_address, 
    signature: signature,
  }
  let info_text = `Запрос подключения банковского<br>`
  info_text += `счёта с идентификатором<br>${bank_account_id}`;
  info_text += '<br>будет скопирован в буфер обмена';
  show_info(info_text);
}

function show_info(info_text) {
  document.querySelector('#informScreen>div').innerHTML = info_text;
  document.getElementById('informScreen').style.visibility = 'visible';
}

function init () {
  document.querySelector('#pageHeader>div').innerHTML = issuer_name;
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

  document.getElementById('button_info').addEventListener('click', async function() {
    if (connect_request) { 
      await navigator.clipboard.writeText(JSON.stringify(connect_request));
      connect_request = undefined;
      show_info('<br><br>Запрос скопирован в буфер обмена<br><br>');
    } else {
      document.getElementById('informScreen').style.visibility = 'hidden';
    }
  });

  web3 = new Web3(Web3.givenProvider);
}

document.addEventListener("DOMContentLoaded", () => setTimeout(init, 0));
