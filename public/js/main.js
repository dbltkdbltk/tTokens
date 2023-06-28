'use strict';

let issuer_name; //from html
let contract_address; //from html
let abi; //from html

let db;
let tokens_list;
let web3;
let contract;
let total_amount;
let sendingObject;
let clipboard;
let free_funds;
let db_ver = 1;

function err_handler(err) {
  document.querySelector('.homePageHeader').className = 'homePageHeader homePageLog';
  document.querySelector('.homePageHeader.homePageLog>div').innerHTML = err.message;
  let err_type = err.message.slice(0, 9);
  if (err_type == 'TTKN-000:') document.querySelector('.homePageTotalAmount').style.visibility = 'hidden';
  if (err_type == 'TTKN-003:' || err_type == 'TTKN-005:' || err_type == 'TTKN-008:') {
    document.getElementById('waitingScreen').style.visibility = 'visible';
  }
}

function msg_handler(msg) {
    document.querySelector('.homePageHeader').className = 'homePageHeader homePageLog';
    let message = document.querySelector('.homePageHeader.homePageLog>div').innerHTML;
    if (message == issuer_name) {
      document.querySelector('.homePageHeader.homePageLog>div').innerHTML = msg;
    } else {
      document.querySelector('.homePageHeader.homePageLog>div').innerHTML = message + '<br>' + msg;
    }   
}

function err_reset() {
  let err_type;
  if (document.querySelector('.homePageHeader.homePageLog')) {
    document.querySelector('.homePageHeader.homePageLog').className = 'homePageHeader';
    err_type = document.querySelector('.homePageHeader>div').innerHTML.slice(0, 9); 
    document.querySelector('.homePageHeader>div').innerHTML = '';
  }
  setTimeout(() => {
    document.querySelector('.homePageHeader>div').innerHTML = issuer_name;
    if (err_type == 'TTKN-000:') {
      document.querySelector('.homePageTotalAmount').style.visibility = 'visible';
      init();
    }
    if (err_type == 'TTKN-001:') update_tokens();
    if (err_type == 'TTKN-003:') {
      document.getElementById('waitingScreen').style.visibility = 'hidden';
      prep_sending();
    }
    if (err_type == 'TTKN-005:') {
      document.getElementById('waitingScreen').style.visibility = 'hidden';
      token_receive();
    }
    if (err_type == 'TTKN-008:') {
      document.getElementById('waitingScreen').style.visibility = 'hidden';
      order_pay();
    }
    if (clipboard && (err_type.slice(0, 5) != 'TTKN-')) ctrl_c();
  }, 200);
} 

async function dis_close_amount() {
  if (document.querySelector('.homePageTotalAmount.homePageTotalAmountDisclose')) {
    document.querySelector('.homePageTotalAmount.homePageTotalAmountDisclose').className = 'homePageTotalAmount';
    document.querySelector('.homePageTotalAmount').innerHTML = 'Показать сумму средств';
  } else if (document.querySelector('.homePageTotalAmount')) {
    document.querySelector('.homePageTotalAmount').className = 'homePageTotalAmount homePageTotalAmountDisclose';
    document.querySelector('.homePageTotalAmount.homePageTotalAmountDisclose').innerHTML = 'Обновление данных...';
    await update_tokens();
    document.querySelector('.homePageTotalAmount.homePageTotalAmountDisclose').innerHTML = text_amount(total_amount);
  }
}

async function yes_no_handler(event) {
  if (this.typeRequest ==  'sendToken') {
    if (event.target.innerHTML == 'Да') {
      document.getElementById('requestConfirm').typeRequest =  undefined;
      document.getElementById('requestConfirm').style.visibility = 'hidden';
      document.getElementById('waitingScreen').style.visibility = 'visible';
      try {
        let tmp_obj = sendingObject;
        sendingObject = undefined;
        await send_money(tmp_obj);
      } catch(err) {
          try {
            err.message = 'TTKN-002:' + err.message;
          } catch {
            err = new Error('TTKN-002:' + err);
          }
          err_handler(err);
      }
      document.getElementById('waitingScreen').style.visibility = 'hidden';
      await dis_close_amount();
      await dis_close_amount();
    } else if (event.target.innerHTML == 'Нет') {
      sendingObject = undefined;
      document.getElementById('requestConfirm').typeRequest =  undefined;
      document.getElementById('requestConfirm').style.visibility = 'hidden';
    }
  }

  if (this.typeRequest ==  'disconnect0') {
    if (event.target.innerHTML == 'Да') {
      this.typeRequest =  'disconnect1';
      document.querySelector('#requestConfirm>div').innerHTML = 
        'Отключиться от сервиса?<br><br><br>';
      return;
    } else if (event.target.innerHTML == 'Нет') {
      this.typeRequest =  undefined;
      this.style.visibility = 'hidden';
    }
  }
  if (this.typeRequest ==  'disconnect1') {
    if (event.target.innerHTML == 'Да') {
      this.typeRequest =  undefined;
      this.style.visibility = 'hidden';
      document.getElementById('waitingScreen').style.visibility = 'visible';
      try {
        await disconnect();
      } catch(err) {
        let error = new Error('TTKN-010:' + (err.message || err) );
        err_handler(error);
      }
      document.getElementById('waitingScreen').style.visibility = 'hidden';
    } else if (event.target.innerHTML == 'Нет') {
      this.typeRequest =  undefined;
      this.style.visibility = 'hidden';
    }
  }
}

async function ctrl_c() {
  await navigator.clipboard.writeText(clipboard);
  clipboard = undefined;
  msg_handler(`Токен с данными о транзакции скопирован в буфер обмена,
    отправьте эту информацию получателю перевода`);
}

async function init() {
  try {
    if (document.querySelector('.homePageHeader.homePageLog')) {
      document.querySelector('.homePageHeader.homePageLog').className = 'homePageHeader';
    }
    document.querySelector('.homePageHeader>button').addEventListener('click', err_reset);
    document.querySelector('.homePageHeader>div').innerHTML = issuer_name;
    document.querySelector('.homePageTotalAmount').addEventListener('click', dis_close_amount);
    document.querySelector('.homePageTotalAmount').innerHTML = 'Показать сумму средств';
    document.getElementById('requestConfirm').addEventListener('click', yes_no_handler);
    document.getElementById('orderPay').innerHTML = 'Оплатить запрос';
    document.getElementById('orderPay').addEventListener('click', function() {
      this.innerHTML = 'Чтение буфера...';
      setTimeout(() => this.innerHTML = 'Оплатить запрос', 300);
      order_pay();
    });
    document.getElementById('tokenReceive').innerHTML = 'Принять токен';
    document.getElementById('tokenReceive').addEventListener('click', function() {
      this.innerHTML = 'Чтение буфера...';
      setTimeout(() => this.innerHTML = 'Принять токен', 300);
      token_receive();
    });
    document.getElementById('transferRequest').innerHTML = 'Запрос перевода*';
    document.getElementById('transferRequest').addEventListener('click', function() {
      try {
//        document.getElementById('transferRequest').innerHTML = 'Нажать';
        document.getElementById('transferRequest').innerHTML = `<a href=
          "${location.origin}/transfer_request?to=${get_own_address()}`+
          `&contract=${contract_address}&issuer_name=${issuer_name}">
          Запрос перевода</a>`;
      } catch(err) {
        err.message = 'TTKN-006:' + err.message;
        err_handler(err);
      }
    });
    document.getElementById('transfersHistory').innerHTML = 'История*';
    document.getElementById('transfersHistory').addEventListener('click', function() {
      try {
//        document.getElementById('transfersHistory').innerHTML = 'Нажать';
        document.getElementById('transfersHistory').innerHTML = `<a href=
          "${location.origin}/transfers_history?who=${get_own_address()}`+
          `&issuer_name=${issuer_name}&db_ver=${db_ver}">История</a>`;
      } catch(err) {
        err.message = 'TTKN-007:' + err.message;
        err_handler(err);
      }
    });
    document.getElementById('disconnect').innerHTML = 'Отключиться';
    document.getElementById('disconnect').addEventListener('click', function() {
      let element = document.getElementById('requestConfirm');
      element.typeRequest =  'disconnect0';
      document.querySelector('#requestConfirm>div').innerHTML = 
        'Выполнить отключение от сервиса?<br><br><br>';
      element.style.visibility = 'visible';
    });

    document.getElementById('update').innerHTML = 'Обновить остаток';
    document.getElementById('update').addEventListener('click', function() {
      update();
    });

    
    if (Web3.givenProvider == null) {
      throw new Error('Требуется MetaMask');
    }
    web3 = new Web3(Web3.givenProvider);
    contract = new web3.eth.Contract(abi, contract_address);
    
    db = await idb.openDB("store", db_ver, {
      upgrade(db) {
        db.createObjectStore('tokens', {keyPath: 'token'})
        .createIndex('acc_stat_idx', ['account', 'status']);
        db.createObjectStore('accounts', {keyPath: 'account'});
        let objStore = db.createObjectStore('transactions', 
          {keyPath: 'trx_id', autoIncrement: true});
        objStore.createIndex('tr_idx', ['account', 'tr_hash']);
        objStore.createIndex('tk_idx', 'token');  //
        objStore.createIndex('attr_idx', ['account', 'direction', 'counterparty',
          'counter_contract', 'amount']);  //
      },
    });
  } catch(err) {
    err.message = 'TTKN-000:' + err.message;
    err_handler(err);
  }
}

async function prep_sending() {
  try {
    await update_tokens({stand_alone: false});
  } catch(err) {    
    err.message = 'TTKN-003:' + err.message;
    err_handler(err);
    return;
  }
  let tmp_obj = sendingObject;
  sendingObject = undefined;
  try {
    await sending_check(tmp_obj);
  } catch(err) {
    err.message = 'TTKN-004:' + err.message;
    err_handler(err);
    return;
  }
  sendingObject = tmp_obj;
  let element = document.getElementById('requestConfirm');
  element.typeRequest =  'sendToken';
  document.querySelector('#requestConfirm>div').innerHTML = 
    `Перевести сумму ${text_amount(sendingObject.amount)} ?` + '<br><br>' + 
    `Получатель: ${sendingObject.to}` + 
    (sendingObject.is_order ? '<br>           ' + new URL(sendingObject.url).hostname : '') + 
    (sendingObject.invoice ? `<br>Назначение: ${sendingObject.invoice}` : '');
  element.style.visibility = 'visible';
}

function get_own_address() {
  let current_address = web3.currentProvider.selectedAddress;
  if (!current_address) {     	
    throw new Error('Заблокирован счет в MetaMask');
  }
  return web3.utils.toChecksumAddress(current_address);
}

function token_calculate(object) {
  ['timestamp', 'nonce', 'amount'].forEach((item) => {
    if (!(item in object && typeof(object[item]) == 'number')) {
      throw new Error('Неверный формат объекта токена');
    }
  });      
  return web3.utils.sha3(object.timestamp.toString() 
  + object.nonce.toString() + object.amount.toString());
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

async function update_tokens(options = {stand_alone: true}) {
  try {
    tokens_list = null;
    total_amount = undefined;
    free_funds = undefined;
    let current_address =  get_own_address();
    let index = db.transaction('tokens').objectStore('tokens').index('acc_stat_idx');
    tokens_list = await index.getAll([current_address, 'active']);
    tokens_list = tokens_list.concat(await index.getAll([current_address, 'pending']));
    tokens_list = tokens_list.concat(await index.getAll([current_address, 'emitted']));
    tokens_list = tokens_list.concat(await index.getAll([current_address, 'burning']));
    for (let i = 0; i < tokens_list.length; i++) {
      let resp = await contract.methods.t_tokens(tokens_list[i].token).call();
      tokens_list[i].address = resp;
    };
    let obj_store = db.transaction('tokens', 'readwrite').objectStore('tokens');
    total_amount = 0;
    let released_funds = 0;
    let flag_trx_match = false;
    for (let i = 0; i < tokens_list.length; i++) {
      if (token_calculate(tokens_list[i]) === tokens_list[i].token) {
        if (tokens_list[i].address === tokens_list[i].account) {
          if (tokens_list[i].status == 'pending' || tokens_list[i].status == 'emitted') {
            tokens_list[i].status = 'active';
            await obj_store.put(tokens_list[i]);
            msg_handler(`Принят токен на сумму ${text_amount(tokens_list[i].amount)}`);
          }
          total_amount = +(total_amount + tokens_list[i].amount).toFixed(2);
        } else if (tokens_list[i].status == 'active') {
          tokens_list[i].status = 'archive';
          //
          let seek = await db.transaction('transactions').objectStore('transactions')
            .index('tk_idx').get(tokens_list[i].token);
          obj_store = db.transaction('tokens', 'readwrite').objectStore('tokens');
          if (seek) {
            await obj_store.delete(tokens_list[i].token);
          } else {
            await obj_store.put(tokens_list[i]);
          }
          flag_trx_match = true;
          //
        } else if (tokens_list[i].status == 'burning') {
          released_funds = +(released_funds + tokens_list[i].amount).toFixed(2);
          tokens_list[i].status = 'archive';
          await obj_store.delete(tokens_list[i].token); 
        } else if (tokens_list[i].status == 'emitted' && 
          tokens_list[i].address == '0x0000000000000000000000000000000000000000') {
          total_amount = +(total_amount + tokens_list[i].amount).toFixed(2);
        }
      } else {
        await obj_store.delete(tokens_list[i].token);
        tokens_list.splice(i, 1);
      }
    }
    //
    if (!await contract.methods.users(current_address).call() && !total_amount) {
      setTimeout( () => setTimeout( () => {
        document.querySelector('.homePageTotalAmount').innerHTML = 
          `<a href="${location.origin}/connect">Подключение к сервису</a>`;
        for (let elem of document.querySelectorAll('.homePageButtons')) {
          elem.style.visibility = 'hidden';
        }
        document.querySelector('.homePageTotalAmount').
          removeEventListener('click', dis_close_amount);
       }), 300);
    }    
    //
    await add_free_funds(released_funds);
    total_amount = +(total_amount + free_funds).toFixed(2);
    //
    if (flag_trx_match) {
      let profile = await get_profile(current_address);
      let last_block = (profile.last_scan_block || 0) + 1;
      let events = await contract.getPastEvents('Transfer', {
        filter: {sender: current_address},
        fromBlock: last_block,
      });
      for (let i = 0; i < events.length; i++) {
        if (events[i].blockNumber > last_block) {
          last_block = events[i].blockNumber;
        }
        if (events[i].returnValues.sndr_contract !== contract_address ||
          events[i].returnValues.receiver == '0x0000000000000000000000000000000000000000') {
          continue;
        }
        let trx_seek = await db.transaction('transactions').objectStore('transactions')
          .index('tr_idx').get([current_address, events[i].transactionHash]);
        if (trx_seek) continue;
        let tkn_seek = await db.transaction('transactions').objectStore('transactions')
          .index('tk_idx').get(events[i].returnValues.t_token);
        if (!tkn_seek) {
          let obj_store = db.transaction('tokens', 'readwrite').objectStore('tokens');
          tkn_seek = await obj_store.get(events[i].returnValues.t_token);
          if (!tkn_seek) continue;
          if (tkn_seek.status == 'archive') {
            await obj_store.delete(events[i].returnValues.t_token);
          }
        }
        let trx = {
          token: tkn_seek.token,
          nonce: tkn_seek.nonce,
          timestamp: tkn_seek.timestamp,
          amount: tkn_seek.amount,
          account: current_address,
          tr_hash: events[i].transactionHash,
          block: events[i].blockNumber,
          counterparty: events[i].returnValues.receiver,
          counter_contract: events[i].returnValues.rcvr_contract,
          direction: 'sent',
        }
        try {
          let block = await web3.eth.getBlock(events[i].blockNumber);
          trx.block_time = block.timestamp;
        } catch(err) {};
        await db.transaction('transactions', 'readwrite').objectStore('transactions').put(trx, );
        msg_handler(`Для завершения перевода суммы ${text_amount(trx.amount)}<br>` +
          `по адресу ${trx.counterparty}<br>повторите оплату того же запроса на перевод`);
      }
      profile = await get_profile(current_address);
      profile.last_scan_block = last_block;
      await db.transaction('accounts', 'readwrite')
        .objectStore('accounts').put(profile);
    }
  } catch(err) {
    tokens_list = null;
    total_amount = undefined;
    try {
      err.message = 'TTKN-001:' + err.message;
    } catch {
      err = new Error('TTKN-001:' + err);
    }
    if (options.stand_alone) {
      err_handler(err);
    } else {
      throw err;
    }
  }
}

async function store_add(object_list) {
  let current_address = get_own_address();
  for (let i = 0; i < object_list.length; i++) {
    let object = object_list[i];
    let status = object.status == 'emitted' ? 'emitted' : 'pending';
    let proto_token = {
      token: token_calculate(object),
      timestamp: object.timestamp,
      nonce: object.nonce,
      amount: object.amount,
      status: status,
      account: current_address,
      address: undefined,
    };

    let tkn_seek = await db.transaction('tokens').objectStore('tokens')
      .get(proto_token.token);
    if (!tkn_seek || tkn_seek.account !== current_address ||
      tkn_seek.status !== 'active') {
      await db.transaction('tokens', 'readwrite').objectStore('tokens')
        .put(proto_token);
    }
    if (!object.signature) continue;

    let sender = web3.eth.accounts.recover(object.invoice + object.token + 
      object.tr_hash, object.signature);
    let events = await contract.getPastEvents('Transfer', {
      filter: {sender: sender, receiver: current_address, t_token: proto_token.token},
      fromBlock: object.block,
      toBlock: object.block
    });
    let seek = events.find(item => item.transactionHash == object.tr_hash);
    if (seek) {
      object.account = current_address;
      object.direction = 'received';
      object.counterparty = sender;
      object.counter_contract = seek.returnValues.sndr_contract;
      try {
        let block = await web3.eth.getBlock(object.block);
        object.block_time = block.timestamp;
      } catch(err) {};
      await db.transaction('transactions', 'readwrite').objectStore('transactions').put(object);
    } else {
      msg_handler(`Предупреждение: данные о транзакции с токеном на сумму ${text_amount(object.amount)},
        представленные отправителем, не найдены в блокчейне`);
    }
  }
}

async function sending_check(object) {
  if (text_amount(object.amount) == 'Сумма не определена' || object.amount == 0) {
    throw new Error('Сумма перевода неверна');
  }
  if (object.amount > total_amount) {
    throw new Error('Недостаточно средств');
  }
  if (web3.utils.toChecksumAddress(object.contract) == contract_address) {
    if (web3.utils.toChecksumAddress(object.to) == get_own_address()) {
      throw new Error('Нельзя перевести себе');
    }
    if (!await contract.methods.users(object.to).call()) {
      throw new Error('Недоступен адрес получателя');
    }    
  } else {
    if (!await contract.methods.t_contracts(object.contract).call()) {
      throw new Error('Недоступен смарт-контракт получателя');
    } else {
      let contr_contract = new web3.eth.Contract(abi, object.contract);
      if (!await contr_contract.methods.users(object.to).call()) {
        throw new Error('Недоступен адрес получателя');
      }
    }
  }
  if (object.is_order) {
    if (!object.invoice) {throw new Error('Не указан номер заказа');}
    try {new URL(object.url);} 
    catch(err) {throw new Error('Неверный URL подтверждения оплаты');}
  }
}

async function send_money(object) {
  let time_out = 45;

  await sending_check(object);

  let token = tokens_list.find(item => item.amount == object.amount && item.status == 'active');
  if (token) {
    let receipt = await send_token(object, token);
    await send_pay_details(object, token, receipt);
    return;
  }

  if (tokens_list.find(item => item.status == 'emitted')) {
    await action_confirm(time_out, 'emitted');
    await send_money(object);
    return;
  }

  if (object.amount <= free_funds) {
    await issue_request(object.amount);
    await action_confirm(time_out, 'emitted');
    await send_money(object);
    return;
  } else {
    if (tokens_list.find(item => item.status !== 'burning')) await burn_request();
    await action_confirm(time_out, 'burning');
    await send_money(object);
  }
}

async function issue_request(amount) {
  let account = get_own_address();
  msg_handler(`Подписание запроса эмиссии токена на сумму ${text_amount(amount)}`);
  let signature = await web3.eth.personal.sign(amount + account, account);
  let url = location.origin + '/issue?amount='+ amount + '&account=' +
    account + '&signature=' + signature;

  let response = await fetch(url);
  if (!response.ok) throw new Error(await response.text());
  let resp = await response.json();
  resp.status = 'emitted';

  await add_free_funds(resp.free_funds, {refresh: true});

  await store_add([resp]);
}

async function add_free_funds(sum, options = {refresh: false}) {
  let profile = await get_profile(get_own_address());
  if (options.refresh) profile.free_funds = sum;
  else profile.free_funds = +(profile.free_funds + sum).toFixed(2);
  let objectStore = db.transaction('accounts', 'readwrite').objectStore('accounts');
  await objectStore.put(profile);
  free_funds = profile.free_funds;
}

async function get_profile(account) {
  let objectStore = db.transaction('accounts', 'readwrite').objectStore('accounts');
  let profile = await objectStore.get(account);
  if (!profile) profile = {
    account: account, 
    free_funds: 0,
    last_scan_block: 0,
  };
  await objectStore.put(profile);
  return profile;
}

async function action_confirm(limit, status) {
  let count = 0;
  let text = {emitted: 'эмиссии', burning: 'сжигания',};
  let promise = new Promise((resolve, reject) => {
    setTimeout(async function func() {
      if (++count > limit) reject(new Error(`Таймаут ${text[status]} токена`));
      await update_tokens();
      let pending = tokens_list.find(item => item.status == status);
      if (!!pending) {
        setTimeout(func, 1000);
      } else {
        resolve();
      }
    }, 1000);
  });
  await promise;
}

async function send_token(request, token) {
  msg_handler(`Подписание запроса перевода токена на сумму ${text_amount(token.amount)}`);
  let receipt = await contract.methods
    .transfer(request.to, request.contract, token.token)
    .send({from: get_own_address()});
  msg_handler(`Перевод на сумму ${text_amount(token.amount)} отправлен,<br>
    получатель ${(receipt.events.Transfer.returnValues || 
    receipt.events.Transfer[0].returnValues).receiver}` + 
    (request.is_order ? `<br>сайт ${new URL(request.url).hostname}` : ''));
  return receipt
}

async function send_pay_details(request, token, receipt) {
  msg_handler(`Подписание подтверждения перевода токена на сумму ${text_amount(token.amount)}` + 
    (request.is_order ? `<br>для сайта ${new URL(request.url).hostname}` : ''));
  let signature = await web3.eth.personal.sign(
    request.invoice + token.token + receipt.transactionHash,
    get_own_address());
  let upload = {
    token: token.token,
    timestamp: token.timestamp,
    nonce: token.nonce,
    amount: token.amount,
    signature: signature,
    invoice: request.invoice,
    block: receipt.blockNumber,
    tr_hash: receipt.transactionHash,
  };
  let tx = {};
  tx.account = token.account;
  tx.token = token.token;
  tx.nonce = token.nonce;
  tx.timestamp = token.timestamp;
  tx.amount = token.amount;
  tx.tr_hash = receipt.transactionHash;
  tx.signature = signature;
  tx.invoice = request.invoice;
  tx.block = receipt.blockNumber;
  if (request.is_order) tx.url = request.url;
  tx.direction = 'sent';
  tx.counterparty = (receipt.events.Transfer.returnValues || 
    receipt.events.Transfer[0].returnValues).receiver;
  tx.counter_contract = (receipt.events.Transfer.returnValues || 
    receipt.events.Transfer[0].returnValues).rcvr_contract;
  try {
    let block = await web3.eth.getBlock(receipt.blockNumber);
    tx.block_time = block.timestamp;
  } catch(err) {};
  if (token.trx_id) tx.trx_id = token.trx_id;
  await db.transaction('transactions', 'readwrite').objectStore('transactions').put(tx);

  if (!request.is_order) {
    clipboard = JSON.stringify(upload);
    msg_handler(`Токен будет скопирован в буфер обмена после закрытия этого окна`);
  } else {
    let response = {ok: false};
    try {
      response = await fetch(request.url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json;charset=utf-8'},
        body: JSON.stringify(upload),
      });
    } catch(err) {}
    if (!response.ok) {
      clipboard = JSON.stringify(upload);
      msg_handler(`Предупреждение: не удалось загрузить токен на сумму 
        ${text_amount(token.amount)} на url ${request.url}
        <br>Токен будет скопирован в буфер обмена после закрытия этого окна`);
    }
  }
}

async function burn_request() {
  let tmp_list = tokens_list.filter(item => item.status == 'active');
  let token = tmp_list.sort( (a, b) => a.amount - b.amount).reverse()[0];
  if (!token) throw new Error('Нет токенов для сжигания');
  msg_handler(`Подписание запроса сжигания токена на сумму ${text_amount(token.amount)}`);
  let signature = await web3.eth.personal.sign(token.token, get_own_address());
  let url = location.origin + '/burn?token='+ token.token + '&signature=' + signature;
  let response = await fetch(url);
  if (!response.ok) throw new Error(await response.text());
  token.status = 'burning';
  let tx = db.transaction('tokens', 'readwrite');
  let obj_store = tx.objectStore('tokens');
  await obj_store.put(token);
  return token;
}

async function order_pay() {
  let order = {};
  try {order = JSON.parse(await navigator.clipboard.readText());} catch(err) {}
  let current_address;
  try {
    current_address = get_own_address()
  } catch(err) {
    err.message = 'TTKN-008:' + err.message;
    err_handler(err);
    return;
  }
  if (order.to && order.contract && order.amount && !(!order.invoice && order.url)
      && (order.to !== current_address || order.contract !== contract_address)) {
    await navigator.clipboard.writeText('');
    sendingObject = order;
    if (order.url) {
      sendingObject.is_order = true;
    } else {
      sendingObject.is_order = false;
      if (!order.invoice) sendingObject.invoice = '';
      sendingObject.url = '';
    }

    let tr_search = await db.transaction('transactions').objectStore('transactions')
      .index('attr_idx').getAll([current_address, 'sent', order.to, order.contract,
      order.amount]);
    for (let i = 0; i < tr_search.length; i++) {
      if (!tr_search[i].signature) {
        let receipt = {
          transactionHash: tr_search[i].tr_hash,
          blockNumber: tr_search[i].block,
          events: {Transfer: {returnValues: {
            receiver: tr_search[i].counterparty,
            rcvr_contract: tr_search[i].counter_contract,
          }}}
        }
        await send_pay_details(order, tr_search[i], receipt);
        return;
      }
    }
    await prep_sending();
  }
}

async function token_receive() {
  let input = {};
  try {
    input = JSON.parse(await navigator.clipboard.readText());
  } catch(err) {}
  if (input.token && input.timestamp && input.nonce && input.amount &&
      input.signature && (input.invoice !== undefined) && input.block && input.tr_hash) {
    let current_address;
    try {
      current_address = get_own_address()
    } catch(err) {
      err.message = 'TTKN-005:' + err.message;
      err_handler(err);
      return;
    }
    let tr_search = await db.transaction('transactions').objectStore('transactions')
      .index('tr_idx').get([current_address, input.tr_hash]);
    if (!tr_search) {
      await navigator.clipboard.writeText('');
      await store_add([input]);
      let url = location.origin + '/token_upload?token='+ input.token + '&timestamp=' +
        input.timestamp + '&nonce=' + input.nonce + '&amount=' + input.amount;
      try {
        let response = await fetch(url);
        if (!response.ok) throw new Error(await response.text());
      } catch(err) {
        err.message = 'TTKN-009:' + err.message;
        err_handler(err);
      }
      await dis_close_amount();
      await dis_close_amount();
    }
  }
}

async function disconnect() {
  let current_address = get_own_address();
  if ( await contract.methods.users(current_address).call() ) {
    msg_handler(`Подписание запроса на отключение аккаунта ${current_address}` +
      ` от<br>смартконтаркта ${contract_address}`);
    await contract.methods.userOff(current_address)
      .send({from: current_address});
    msg_handler(`<br>Аккаунт ${current_address} отключен от смартконтаркта ` +
      `${contract_address}`);
    msg_handler(`<br>Подписание запроса сжигания токенов и удаление аккаунта из сервиса`);
    let signature = await web3.eth.personal.sign(current_address, current_address);
    let url = location.origin + '/user_off?account='+ current_address + 
      '&signature=' + signature;
    let response = await fetch(url);
    if (!response.ok) throw new Error(await response.text());
    msg_handler(`<br>Запрос отправлен`);
  } else {
    msg_handler(`Аккаунт ${current_address}<br>уже отключен от смартконтаркта` +
      `<br>${contract_address}`);
  }
}

async function update() {
  try {
    document.getElementById('waitingScreen').style.visibility = 'visible';
    let current_address =  get_own_address();
    msg_handler(`Подписание запроса на обновление остатка средств`);
    let signature = await web3.eth.personal.sign(current_address, current_address);
    document.querySelector('.homePageHeader>button').
      dispatchEvent(new Event('click'));
    let url = location.origin + '/update?account='+ current_address + 
      '&signature=' + signature;
    let response = await fetch(url);
    if (!response.ok) throw new Error(await response.text());
    let resp = await response.json();
    await add_free_funds(resp.free_funds, {refresh: true});
    setTimeout( async () => {
      await store_add(resp.tokens);
      await dis_close_amount();
      await dis_close_amount();
    });
  } catch(err) {
    err.message = 'TTKN-011:' + err.message;
    err_handler(err);
  } finally {
    document.getElementById('waitingScreen').style.visibility = 'hidden';
  }
}

document.addEventListener("DOMContentLoaded", () => setTimeout(init, 500));
