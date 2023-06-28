const express = require("express");
const fs = require("fs");
const https = require("https");
const { MongoClient } = require("mongodb");
const Web3 = require("web3");
const crypto = require('node:crypto');

const mongo_url = '000.0.0.0:00000'; //ip-адрес и порт mongodb сервера, например '127.0.0.1:27017'
//ABI смартконтракта Ethereum https://github.com/dbltkdbltk/tTokensContract 
const abi = [{"name": "Transfer", "inputs": [{"name": "sender", "type": "address", "indexed": true}, {"name": "receiver", "type": "address", "indexed": true}, {"name": "sndr_contract", "type": "address", "indexed": false}, {"name": "rcvr_contract", "type": "address", "indexed": false}, {"name": "t_token", "type": "bytes32", "indexed": true}], "anonymous": false, "type": "event"}, {"name": "MinterSet", "inputs": [{"name": "actor", "type": "address", "indexed": false}, {"name": "pre_minter", "type": "address", "indexed": false}, {"name": "approver", "type": "address", "indexed": false}, {"name": "minter", "type": "address", "indexed": false}], "anonymous": false, "type": "event"}, {"stateMutability": "nonpayable", "type": "constructor", "inputs": [{"name": "_admin0", "type": "address"}, {"name": "_admin1", "type": "address"}], "outputs": []}, {"stateMutability": "nonpayable", "type": "function", "name": "interContract", "inputs": [{"name": "_to", "type": "address"}, {"name": "_sender", "type": "address"}, {"name": "_token", "type": "bytes32"}], "outputs": [{"name": "", "type": "bool"}]}, {"stateMutability": "nonpayable", "type": "function", "name": "transfer", "inputs": [{"name": "_to", "type": "address"}, {"name": "_contract", "type": "address"}, {"name": "_token", "type": "bytes32"}], "outputs": []}, {"stateMutability": "nonpayable", "type": "function", "name": "transferFor", "inputs": [{"name": "_to", "type": "address"}, {"name": "_contract", "type": "address"}, {"name": "_token", "type": "bytes32"}, {"name": "_v", "type": "uint256"}, {"name": "_r", "type": "uint256"}, {"name": "_s", "type": "uint256"}], "outputs": []}, {"stateMutability": "nonpayable", "type": "function", "name": "mint", "inputs": [{"name": "_to", "type": "address"}, {"name": "_token", "type": "bytes32"}], "outputs": []}, {"stateMutability": "nonpayable", "type": "function", "name": "burn", "inputs": [{"name": "_token", "type": "bytes32"}], "outputs": []}, {"stateMutability": "nonpayable", "type": "function", "name": "userOn", "inputs": [{"name": "_user", "type": "address"}], "outputs": []}, {"stateMutability": "nonpayable", "type": "function", "name": "userOff", "inputs": [{"name": "_user", "type": "address"}], "outputs": []}, {"stateMutability": "nonpayable", "type": "function", "name": "userOffFrom", "inputs": [{"name": "_v", "type": "uint256"}, {"name": "_r", "type": "uint256"}, {"name": "_s", "type": "uint256"}], "outputs": []}, {"stateMutability": "nonpayable", "type": "function", "name": "otherContractOn", "inputs": [{"name": "_contract", "type": "address"}], "outputs": []}, {"stateMutability": "nonpayable", "type": "function", "name": "otherContractOff", "inputs": [{"name": "_contract", "type": "address"}], "outputs": []}, {"stateMutability": "nonpayable", "type": "function", "name": "minterSet", "inputs": [{"name": "_minter", "type": "address"}], "outputs": []}, {"stateMutability": "view", "type": "function", "name": "users", "inputs": [{"name": "arg0", "type": "address"}], "outputs": [{"name": "", "type": "bool"}]}, {"stateMutability": "view", "type": "function", "name": "t_tokens", "inputs": [{"name": "arg0", "type": "bytes32"}], "outputs": [{"name": "", "type": "address"}]}, {"stateMutability": "view", "type": "function", "name": "t_contracts", "inputs": [{"name": "arg0", "type": "address"}], "outputs": [{"name": "", "type": "bool"}]}];

const issuer_name = 'Наименование банка'; // Название банка, отображаемое у пользователя
const contract_address = '0x0000000000000000000000000000000000000000';//адрес смартконтракта Ethereum
const contract_alias = 'unb0';//имя базы данных в MongoDB, например unb0  
const mongo_pwd =  'some_password';пароль для подключения к базе данных MongoDB
const tcp_port = 8000; // tcp порт web сервера
const issuer_key = '';//секретный пароль эмитента для сайта, если не задан, то рекомендуемое значение будет
//выведено в log файл при запуске сайта  

const myProvider = 'https://'//url web3 провайдера, например 'https://mainnet.infura.io/v3/xxxxxxxxxxxxxxxx'
const minter = '0x0000000000000000000000000000000000000000';//etheteum адрес минтера смартконтракта
const minter_key = '0x0000000000000000000000000000000000000000000000000000000000000000';//секретный ключ минтера смартконтракта
const gas_limit = 5000000;//лимит газа
const ssl_key = './ca/localhost.key';//секретный ssl ключ для https сервера
const ssl_cert = './ca/localhost.crt';//ssl сертификат для https сервера

const web3 = new Web3(myProvider);
const contract = new web3.eth.Contract(abi, contract_address);
const app = express();
const mongo_uri = `mongodb://${encodeURIComponent(contract_alias)}:` +
  `${encodeURIComponent(mongo_pwd)}@${mongo_url}/?` +
  `authMechanism=DEFAULT&authSource=${encodeURIComponent(contract_alias)}`;
const mongoClient = new MongoClient(mongo_uri);

let timerId0, timerId1;
let mainOutput;
let errorOutput;
let logger; 
mainOutput = fs.createWriteStream(`./${contract_alias}_tokens.log`, {flags: 'a'});
mainOutput.on('ready', () => {
  errorOutput = fs.createWriteStream(`./${contract_alias}_errors.log`, {flags: 'a'});
  errorOutput.on('ready', () => {
    logger = new console.Console({stdout: mainOutput, stderr: errorOutput});
  });
});
function print(x) {
 return new Date().toLocaleDateString() + ' ' +
   new Date().toLocaleTimeString() + ' ' + x; 
}

console.log('Соединение с MongoDB...');
mongoClient.connect().then(mongoClient => {
  app.locals.users = mongoClient.db(contract_alias).collection("users");
  app.locals.users.createIndex({account: 1});
  app.locals.users.createIndex({for_bank_id: 1});
  app.locals.tokens = mongoClient.db(contract_alias).collection("tokens");
  app.locals.tokens.createIndex({token: 1});
  app.locals.queue = mongoClient.db(contract_alias).collection("queue");
  app.locals.transactions = mongoClient.db(contract_alias).collection("transactions");
  app.locals.transactions.createIndex({block: -1});
  app.locals.transactions.createIndex({block: 1});
  app.locals.transactions.createIndex({tr_hash: 1});
  app.locals.transactions.createIndex({status: 1});
  app.locals.transactions.createIndex({token: 1});
  app.locals.contracts = mongoClient.db(contract_alias).collection("contracts");
  app.locals.contracts.createIndex({address: 1});
  //app.listen(tcp_port);// for http
  const https_options = {
    key: fs.readFileSync(ssl_key),
    cert: fs.readFileSync(ssl_cert),
  };
  https.createServer(https_options, app).listen(tcp_port); //for https
  console.log('Сервер tToken работает (выключить - Ctrl+C)...');
  setTimeout(async function func() {
    await event_subscribe();//
    timerId0 = setTimeout(func, 5000); 
  });
  setTimeout(async function func() {
    await queue_handler();//
    timerId1 = setTimeout(func, 1000);// 
  });//
  if (typeof issuer_key === 'undefined' || !issuer_key) {
    logger.log( print("issuer_key =  '" + new Token(777).token) + "'");
    throw new Error('!!! Не задан ключ эмитента, рекомендуемое значение - в журнале');
  }
}).catch(err => {
  console.log(err.message);
  setTimeout(shutdown, 3000);
});

app.locals.buffer = [];

app.use(express.static('public'));
                                                              	
app.get("/", function(request, response) {
  if (request.query.buffer_key) {
    let code = "";
    let index_b;
    let object = app.locals.buffer.find((item, index) => {
      index_b = index;
      return item.key == request.query.buffer_key;
    });
    if (object && object.type) {

      if (object.type == 'transferRequest') {
        code = `input={to:'${object.to}',contract:'${object.contract}',issuer_name:'${object.issuer_name}'};`
        fs.readFile("transfer_request.html", "utf8", function(error, data){
          if (error) {
            response.sendStatus(404);
          } else {
            data = data.replace("{Object}", code);
            response.send(data);
          }
        });
      }

      if (object.type == 'transfersHistory') {
        code = `parameters={who:'${object.who}',issuer_name:'${object.issuer_name}',db_ver:${object.db_ver}};`
        fs.readFile("transfers_history.html", "utf8", function(error, data){
          if (error) {
            response.sendStatus(404);
          } else {
            data = data.replace("{Object}", code);
            response.send(data);
          }
        });
      }

      app.locals.buffer.splice(index_b, 1);
      return;
    }
  } 

  fs.readFile("index.html", "utf8", function(error, data){
    if (error) {
      response.sendStatus(404);
    } else {
      let  code = `issuer_name = '${issuer_name}';` +
        `contract_address = '${contract_address}';` +
        `abi = ${JSON.stringify(abi)};`;
      data = data.replace("{Object}", code);
      response.send(data);
    }
  });
});

app.get("/transfer_request", function(request, response) {
  let object = request.query;
  let buffer_key = new Token(777).token;
  object.key = buffer_key;
  object.type = 'transferRequest';
  app.locals.buffer.push(object);
  response.redirect(`/?buffer_key=${buffer_key}`);
});

app.get("/transfers_history", function(request, response) {
  let object = request.query;
  let buffer_key = new Token(777).token;
  object.key = buffer_key;
  object.type = 'transfersHistory';
  app.locals.buffer.push(object);
  response.redirect(`/?buffer_key=${buffer_key}`);
});

app.get("/issue", async function(request, response) {
  let query = request.query;
  try {
    let address = web3.eth.accounts.recover(query.amount + query.account, query.signature);
    if (query.account != address) throw(new Error('Неверная подпись'));
    let user = await request.app.locals.users.findOne({account: address});
    if (!user) throw(new Error('Отсутствует аккаунт'));
    let token = new Token(+query.amount);
    if (!(user.free_funds >= token.amount)) throw(new Error('Недостаточно свободных средств'));
    await request.app.locals.tokens.insertOne(token);
    user.free_funds = +(user.free_funds - token.amount).toFixed(2);
    await request.app.locals.users.updateOne(
      {account: address},
      {$set: {free_funds: user.free_funds}}
    );
    await request.app.locals.users.updateOne(
      {account: address},
      {$push: {tokens: token.token}}
    );
    await request.app.locals.queue.insertOne({token: token.token, account: address, method: 'mint'});
    token.free_funds = user.free_funds;
    response.json(token);
  } catch(error) {
    response.status(400).send(error.message);
  }
});

function Token(amount) {
  if (typeof(amount) !== 'number' ||  amount <= 0 || isNaN(amount)) { 
    throw new Error('Неверный формат суммы');
  }
  if (amount.toString().includes('.') && amount.toString().length - amount.toString().indexOf('.') > 3) {
    throw new Error('Неверный формат суммы');
  }
  this.timestamp = Date.now();
  this.nonce = crypto.webcrypto.getRandomValues(new Uint32Array(1))[0];
  this.amount = amount;
  this.token = web3.utils.sha3(this.timestamp.toString() 
    + this.nonce.toString() + this.amount.toString());
}

async function queue_handler() {
  let que = await app.locals.queue.find().toArray();
  for (let i = 0; i < que.length; i++) {
    if (que[i].failure) continue;
    try {
      let data;
      if (que[i].method == 'mint') data = contract.methods.mint(que[i].account, que[i].token).encodeABI();
      if (que[i].method == 'burn') data = contract.methods.burn(que[i].token).encodeABI();
      if (que[i].method == 'userOn') data = contract.methods.userOn(que[i].user).encodeABI();
      if (que[i].method == 'userOff') data = contract.methods.userOff(que[i].user).encodeABI();
      let tx_obj = {
        to: contract_address,
        data: data,
        gas: gas_limit,
      };
      let tx = await web3.eth.accounts.signTransaction(tx_obj, minter_key);
      try {
        await web3.eth.sendSignedTransaction(tx.rawTransaction);
      } catch(err) {
        await app.locals.queue.updateOne(
          {_id: que[i]._id},
          {$set: {failure: true}}
        );
        throw err;
      }
      await app.locals.queue.deleteOne({_id: que[i]._id});
      if (que[i].method == 'burn') {
        let token = await app.locals.tokens.findOne({token: que[i].token});
        if (!token) throw(new Error('Отсутствует токен, свободные средства не изменены'));
        let user = await app.locals.users.findOne({account: que[i].account});
        if (!user) throw(new Error('Отсутствует аккаунт, свободные средства не изменены'));
        user.free_funds = +(user.free_funds + token.amount).toFixed(2);
        await app.locals.users.updateOne(
          {account: que[i].account},
          {$set: {free_funds: user.free_funds}}
        );
        await app.locals.users.updateOne(
          {account: que[i].account},
          {$pull: {tokens: que[i].token}}
        );
        await delete_user(que[i].account);
      }
      if (que[i].method == 'userOff') {
        await delete_user(que[i].user);
      }
    } catch(error) {
      let err_txt;
      if (que[i].method == 'mint') err_txt = 'Ошибка при эмиссии  токен ' + que[i].token + '  адрес '+ que[i].account + '  ';
      if (que[i].method == 'burn') err_txt = 'Ошибка при сжигании  токен ' + que[i].token + '  адрес '+ que[i].account + '  ';
      if (que[i].method == 'userOn') err_txt = 'Ошибка подключения пользователя ' + que[i].user + '  ';
      if (que[i].method == 'userOff') err_txt = 'Ошибка отключения пользователя ' + que[i].user + '  ';
      logger.error( print(err_txt + error.message) );
    }
  }
}

app.get("/burn", async function(request, response) {
  let query = request.query;
  try {
    let sender = web3.eth.accounts.recover(query.token, query.signature);
    let address = await contract.methods.t_tokens(query.token).call();
    if (sender != address) throw(new Error('Чужой токен'));
    if (!await app.locals.tokens.findOne({token: query.token})) {
      throw(new Error('Отсутствует токен'));
    }
    if (!await app.locals.users.findOne({account: address})) {
      throw(new Error('Отсутствует аккаунт'));
    }
    let pending = await request.app.locals.queue.findOne(
        {token: query.token, method: 'burn'});
    if (!pending) {
      await request.app.locals.queue.insertOne({token: query.token, account: address, method: 'burn'});
    }
    response.sendStatus(200);
  } catch(error) {
    response.status(400).send(error.message);
  }
});

app.get("/update", async function(request, response) {
  let query = request.query;
  try {
    let address = web3.eth.accounts.recover(query.account, query.signature);
    if (query.account != address) throw(new Error('Неверная подпись'));
    let user = await request.app.locals.users.findOne({account: address});
    if (!user) throw(new Error('Отсутствует аккаунт'));
    let resp = {};
    resp.free_funds = user.free_funds;
    resp.tokens = [];
    for (let i = 0; i < user.tokens.length; i++) {
      let token = await request.app.locals.tokens.findOne({token: user.tokens[i]});
      if (token) resp.tokens.push(token);
    }
    response.json(resp);
  } catch(error) {
    response.status(400).send(error.message);
  }
});


app.get("/token_upload", async function(request, response) {
  let token = {
    timestamp: +request.query.timestamp,
    nonce: +request.query.nonce,
    amount: +request.query.amount,
    token: request.query.token,
  }
  try {
    if (token_calculate(token) !== token.token) {
      throw(new Error('Токен недостоверный'));
    }
    if (await contract.methods.t_tokens(token.token).call() ===
      '0x0000000000000000000000000000000000000000') {
      if (!await request.app.locals.transactions.findOne({token: token.token})) {
        throw (new Error('Токен отсутствует в смартконтракте'));
      }
    }
    if (await request.app.locals.tokens.findOne({token: token.token})) {
      response.sendStatus(200);
      return;
    }
    await request.app.locals.tokens.insertOne(token);
    response.sendStatus(200);
    //transaction_handler();
  } catch(error) {
    response.status(400).send(error.message);
  }
});

function token_calculate(object) {
  ['timestamp', 'nonce', 'amount'].forEach((item) => {
    if (!(item in object && typeof(object[item]) == 'number')) {
      throw new Error('Неверный формат объекта токена');
    }
  });      
  return web3.utils.sha3(object.timestamp.toString() 
  + object.nonce.toString() + object.amount.toString());
}

async function event_subscribe() {
  let last_block = await app.locals.transactions.findOne({}, {sort: {block: -1},
    projection: {_id: 0, block: 1}}) || {};
  last_block = +last_block.block || 0;
  let events = await contract.getPastEvents('Transfer', {fromBlock: last_block + 1});
  for (let i = 0; i < events.length; i++) {
    if (await app.locals.transactions.findOne({tr_hash: events[i].transactionHash})) {
      continue;
    }
    let block_time = NaN;
    try {
      let block = await web3.eth.getBlock(events[i].blockNumber);
      block_time = block.timestamp;
    } catch(err) {};
    let trx = {
      tr_hash: events[i].transactionHash,
      block: events[i].blockNumber,
      block_time: block_time,
      token: events[i].returnValues.t_token,
      sender: events[i].returnValues.sender,
      sender_contract: events[i].returnValues.sndr_contract,
      receiver: events[i].returnValues.receiver,
      receiver_contract: events[i].returnValues.rcvr_contract,
      sender_for_bank_id : '',
      receiver_for_bank_id: '',
      status: 'pending',
    };
    await app.locals.transactions.insertOne(trx);
  }
  await transaction_handler();
}

async function transaction_handler() {
  let trx_list = await app.locals.transactions.find({status: 'pending'}).toArray();
  for (let i = 0; i < trx_list.length; i++) {
    let err = '';
    let token;
    let sender_user;
    let receiver_user;
    let other_contract;
    let sender_for_bank_id;
    let receiver_for_bank_id;
    if (trx_list[i].sender_contract !== contract_address) {
      receiver_user = await app.locals.users.findOne({account: trx_list[i].receiver});
      if (!receiver_user) err += `  Отсутствует получатель ${trx_list[i].receiver}`;
      other_contract = await app.locals.contracts.findOne({address: trx_list[i].sender_contract});
      if (!other_contract) err += `  Отсутствует смартконтракт отправителя ${trx_list[i].sender_contract}`;
    } else if(trx_list[i].receiver_contract !== contract_address) {
      sender_user = await app.locals.users.findOne({account: trx_list[i].sender});
      if (!sender_user) err += `  Отсутствует отправитель ${trx_list[i].sender}`;
      other_contract = await app.locals.contracts.findOne({address: trx_list[i].receiver_contract});
      if (!other_contract) err += `  Отсутствует смартконтракт получателя ${trx_list[i].receiver_contract}`;
    } else {
      if (trx_list[i].sender !== '0x0000000000000000000000000000000000000000') {
        sender_user = await app.locals.users.findOne({account: trx_list[i].sender});
        if (!sender_user && trx_list[i].receiver !== '0x0000000000000000000000000000000000000000' ) {
          err += `  Отсутствует отправитель ${trx_list[i].sender}`; //
        }
      }
      if (trx_list[i].receiver !== '0x0000000000000000000000000000000000000000') {
        receiver_user = await app.locals.users.findOne({account: trx_list[i].receiver});
        if (!receiver_user) err += `  Отсутствует получатель ${trx_list[i].receiver}`;
      }
      if (trx_list[i].sender == '0x0000000000000000000000000000000000000000' &&
        trx_list[i].receiver == '0x0000000000000000000000000000000000000000') {
        err += '  Отправитель и получатель с нулевымми адресами'
      }
    }
    token = await app.locals.tokens.findOne({token: trx_list[i].token});
    if (!token) {
      let lapse = Date.now() - trx_list[i].block_time * 1000;
      if (!sender_user && receiver_user && other_contract && lapse < 6000) {
        continue; 
      } else {
        err += `  Отсутствует токен ${trx_list[i].token}`;
      }
    }
    if (!!err) {
      err = `Ошибка обработки транзакции ${trx_list[i].tr_hash}` + err
      logger.error(print(err));
      continue;
    }

    if (sender_user) {
      sender_for_bank_id = sender_user.for_bank_id;
    }  else if (other_contract) {
      sender_for_bank_id = other_contract.for_bank_id;
    }
    if (receiver_user) {
      receiver_for_bank_id = receiver_user.for_bank_id;
    }  else if (other_contract) {
      receiver_for_bank_id = other_contract.for_bank_id;
    }
    let status = 'ready';
    if ( (!sender_user || !receiver_user) && !other_contract) {
      sender_for_bank_id = '';
      receiver_for_bank_id = '';
      status = 'non_transfer';
    }
    await app.locals.transactions.updateOne( {_id: trx_list[i]._id},
      {$set: {
        sender_for_bank_id: sender_for_bank_id,
        receiver_for_bank_id: receiver_for_bank_id,
        status: status,
        amount: token.amount,
      }} );
    if (status == 'ready') {
      if (sender_user) {
        await app.locals.users.updateOne(
          {_id: sender_user._id},
          {$pull: {tokens: token.token}}
        );
      }
      if (receiver_user) {
        await app.locals.users.updateOne(
          {_id: receiver_user._id},
          {$push: {tokens: token.token}}
        );
      }
      if (sender_user && !receiver_user && other_contract) {
        let url = other_contract.origin + '/token_upload?token='+ 
          token.token + '&timestamp=' + token.timestamp + '&nonce=' + 
          token.nonce + '&amount=' + token.amount;
        try {
          let response = await fetch(url);
          if (!response.ok) throw new Error(await response.text());
        } catch(err) {
          logger.error( print(`Ошибка загрузки токена ${token.token} в ` + 
            `смартконтракт ${other_contract.address}  ` + err.message) );
        }
      }
    }
  }
}

app.get("/connect", function(request, response) {
  fs.readFile("connect.html", "utf8", function(error, data) {
    if (error) {
      response.sendStatus(404);
    } else {
      let  code = `issuer_name = '${issuer_name}'`;
      data = data.replace("{Object}", code);
      response.send(data);
    }
  });
});

app.get("/user_on", async function(request, response) {
  try {
    let query = request.query;
    if (!query.account || !query.bank_account_id) {
      throw new Error('Неверный запрос');
    }
    if (query.issuer_key !== issuer_key) {
      throw new Error('Неверный ключ эмитента');
    }
    let address = web3.eth.accounts.recover(
      query.bank_account_id + query.account, query.signature);
    if (query.account !== address) {
      throw new Error('Неверная подпись');
    }
    let found_user_a = await app.locals.users.findOne(
      {account: query.account});
    let found_user_b = await app.locals.users.findOne(
      {for_bank_id: query.bank_account_id});
    if ( (!!found_user_a && found_user_a.for_bank_id !== query.bank_account_id) ||
      (!!found_user_b && found_user_b.account !== query.account) ) {
      throw new Error('Имеется пользователь с одним совпадающим параметром');
    }
    if (!found_user_a && !found_user_b) {
      let usr = {
        account: query.account,
        free_funds: 0,
        tokens: [],
        for_bank_id: query.bank_account_id,
      }
      await request.app.locals.users.insertOne(usr);
    }
    if ( !await contract.methods.users(query.account).call() ) {
      let pending = await request.app.locals.queue.findOne(
        {user: query.account, method: 'userOn'});
      if (!pending) {
        await request.app.locals.queue.insertOne({user: query.account, method: 'userOn'});
      }
    }
    response.sendStatus(200);
  } catch(err) {
    response.status(400).send(err.message);
  }
});

app.get("/user_off", async function(request, response) {
  try {
    let query = request.query;
    let init_check = false;
    if ( (!query.account && !query.signature && 
      query.bank_account_id && query.issuer_key) ||
      (query.account && query.signature && 
      !query.bank_account_id && !query.issuer_key) ) {
      init_check = true;
    }
    if (!init_check) {
      throw new Error('Неверный запрос');
    }
    let account;
    if (query.issuer_key) {
      if (query.issuer_key !== issuer_key) {
        throw new Error('Неверный ключ эмитента');
      }
      let found_user = await request.app.locals.users.findOne(
        {for_bank_id: query.bank_account_id});
      if (!found_user) {
        throw new Error('Нет пользователя с заданным номером счёта');
      }
      account = found_user.account;
    } else if ( query.account !== web3.eth.accounts.recover(
        query.account, query.signature) ) {
      throw new Error('Неверная подпись');
    } else {
      account = query.account;
    }
    let is_connected = await contract.methods.users(account).call();
    if (is_connected) {
      let pending = await request.app.locals.queue.findOne(
        {user: account, method: 'userOff'});
      if (!pending) {
        await request.app.locals.queue.insertOne({user: account, method: 'userOff'});
      }
    }
    let user = await request.app.locals.users.findOne({account: account});
    await delete_user(account);
    for (let i = 0; i < user.tokens.length; i++) {
      let pending = await request.app.locals.queue.findOne(
        {token: user.tokens[i], method: 'burn'});
      if (!pending) {
        await request.app.locals.queue.insertOne(
          {token: user.tokens[i], account: account, method: 'burn'});
      }
    }
    response.sendStatus(200);
  } catch(err) {
    response.status(400).send(err.message);
  }
});

async function delete_user(account) {
  let is_connected = await contract.methods.users(account).call();
  let user = await app.locals.users.findOne({account: account});
  if ( !is_connected && (!user.tokens || !user.tokens.length) ) {
    await app.locals.users.deleteOne({_id: user._id});
  }
}

app.get("/change_balance", async function(request, response) {
  try {
    let query = request.query;
    query.amount = +query.amount;
    if (!query.bank_account_id || !query.amount) {
      throw new Error('Неверный запрос');
    }
    if (query.issuer_key !== issuer_key) {
      throw new Error('Неверный ключ эмитента');
    }
    let user = await request.app.locals.users.findOne(
      {for_bank_id: query.bank_account_id});
    if (!user) {
      throw new Error('Отсутствует пользователь');
    }
    let tokens_list = [];
    let amount = user.free_funds;
    for (let i = 0; i < user.tokens.length; i++) {
      let token = await request.app.locals.tokens.findOne(
        {token: user.tokens[i]});
      let token_address = await contract.methods.t_tokens(
        user.tokens[i]).call();
      if ( token && (token_address == user.account) ) {
        tokens_list.push(token);
        amount += token.amount;
      }
    }
    tokens_list.sort( (a, b) => a.amount - b.amount ).reverse();
    if ( (amount + query.amount) < 0 ) {
      throw new Error('Сумма уменьшения больше остатка счёта');
    }
    if ( (user.free_funds + query.amount) < 0 ) {
      let pending = await request.app.locals.queue.findOne(
        {token: tokens_list[0].token, method: 'burn'});
      if (!pending) {
       await request.app.locals.queue.insertOne({token: tokens_list[0].token, 
          account: user.account, method: 'burn'});
      }
      let url = `/change_balance?bank_account_id=${query.bank_account_id}` +
        `&amount=${query.amount}&issuer_key=${query.issuer_key}`
      response.redirect(url);
    } else {
      await request.app.locals.users.updateOne(
        {account: user.account},
        {$set: {free_funds: +(user.free_funds + query.amount).toFixed(2)}}
      );
      response.sendStatus(200);
    }
  } catch(err) {
    response.status(400).send(err.message);
  }
});

app.get("/transactions_download", async function(request, response) {
  try {
    let query = request.query;
    if ( !Number.isFinite(+query.last_block) ) {
      throw new Error('Неверный запрос');
    }
    if (query.issuer_key !== issuer_key) {
      throw new Error('Неверный ключ эмитента');
    }
    let trx_list = await app.locals.transactions.find(
      { block: {$gt : +query.last_block}, status: "ready" }, 
      { sort: {block: 1}, projection: {_id: 0} }).toArray();
    response.json(trx_list);
  } catch(err) {
    response.status(400).send(err.message);
  }
});


function shutdown() {
  clearTimeout(timerId0);
  clearTimeout(timerId1);//
  mongoClient.close().then( () => {
    mainOutput.close();
    errorOutput.close();
    console.log('Завeршение работы');
    setTimeout(process.exit, 1500);
  });
}

process.on("SIGINT", shutdown);

