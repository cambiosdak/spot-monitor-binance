const {Telegraf, Scenes:{WizardScene, Stage}} = require('telegraf') 
const LocalSession = require('telegraf-session-local')
const {Spot} = require('@binance/connector')
const axios = require('axios')
let listenKey
// Initialize session middleware
const localSession = new LocalSession({
    database: 'local.db.json',
    storage: LocalSession.storageFileAsync,
    format: {
      serialize: (obj) => JSON.stringify(obj, null, 2),
      deserialize: (str) => JSON.parse(str),
    },
  })  
const bot = new Telegraf('YOUR_KEY_HERE')
bot.use(localSession.middleware())

bot.start( (ctx) =>{
    ctx.reply('Welcome!, to start you need to set up your API KEYs. Send the command /set_api_key to start. If you have already set them up please send the command /listen to start receiving notifications of new orders')
})


const symbolOrders = {}

bot.command('listen', async (ctx) =>{
    const apiKey = ctx.session.apiKey
    const apiSecret= ctx.session.apiSecret
    const client = new Spot(apiKey, apiSecret)
    let pnl
    const callbacks = {
        open: () => console.log('Connected with Websocket server'),
        close: () => console.log('Disconnected with Websocket server'),
        message: async response => {
            let data = JSON.parse(response)
            if (data.e === 'executionReport' ){
                if (data.x === 'TRADE'){
                    if(!symbolOrders[data.s] && data.S === 'BUY'){                        
                        let date = new Date(data.E).toLocaleString()
ctx.telegram.sendMessage(-1001750159291,`Execution Time: <b>${date}</b>

<b>Symbol:</b> ${data.s}
<b>Price:</b> ${data.L}
<b>Quantity:</b> ${data.q} / ${data.Z} USDT
<b>Side:</b> ${data.S}
`, {parse_mode: 'HTML'}).then( response => {
    symbolOrders[data.s] = {symbol: data.s, quantity: data.q, price: data.L, messageId: response.message_id}
}).catch(error => console.error(error))

                    } else if (symbolOrders[data.s] && symbolOrders[data.s].symbol === data.s && data.S === 'SELL' || !symbolOrders[data.s]){
                        if (symbolOrders[data.s] && symbolOrders[data.s].hasOwnProperty('messageId')){
                        pnl = (parseFloat(data.L) - parseFloat(symbolOrders[data.s].price)) * data.q
                        let date = new Date(data.E).toLocaleString()
ctx.telegram.sendMessage(-1001750159291,`Execution Time: <b>${date}</b>

<b>Symbol:</b> ${data.s}
<b>Price:</b> ${data.L}
<b>Quantity:</b> ${data.q} / ${data.Z} USDT
<b>Side:</b> ${data.S}
<b>PnL: </b> ${pnl}`, {reply_to_message_id: symbolOrders[data.s].messageId, parse_mode: 'HTML'}).then( response =>{
let message = response.text
let id = response.message_id
let chatid = response.chat.id
  client.userAsset()
  .then(async response => {
    await response.data
    let data = response.data
    let asset = 0
    for (const f of Object.values(data)){
      asset += parseFloat(f.btcValuation)
    }
    client.avgPrice('BTCUSDT').then( async response => {
      await response.data
      let price = parseFloat(response.data.price)
      let usdtWallet = asset * price
      let percentEarned = (pnl / usdtWallet)* 100
      let newText = message + `\n%PnL: ${percentEarned} %`
      ctx.telegram.editMessageText(chatid,id,0, newText)
    }).catch(error => console.error(error))
  }).catch(error => console.error(error))
})
                        } else{
                          symbolOrders[data.s] = {symbol: data.s, quantity: data.q, price: data.L}
                          let date = new Date(data.E).toLocaleString()
ctx.telegram.sendMessage(-1001750159291,`Execution Time: <b>${date}</b>

<b>Symbol:</b> ${data.s}
<b>Price:</b> ${data.L}
<b>Quantity:</b> ${data.q} / ${data.Z} USDT
<b>Side:</b> ${data.S}`, {parse_mode: 'HTML'})
                        }

delete symbolOrders[data.s]
                    }
                }
            }
        }
    }




    await client.createListenKey().then( async response => {
        await response.data
        console.log(response.data)
        listenKey = response.data.listenKey
        client.userData(response.data.listenKey, callbacks)

    }).catch(error => ctx.reply(error.response.data.msg))

    setInterval(() => {
        let options = {
          method: 'PUT',
          url: 'https://api.binance.com/api/v3/userDataStream',
          params: {listenKey: listenKey},
          headers: {
            'X-MBX-APIKEY': ctx.session.apiKey
          }
        };
        axios.request(options).then( (response) => {
            console.log('Keep alive ping sent')
        }).catch((error) => {
          console.error(error);
        });
    }, 30 * 60 *1000);



})

const API_KEY = Telegraf.hears(/.*/, (ctx) => {
        // Store the API key in the session
        console.log(ctx.message.text)
        ctx.session.apiKey = ctx.message.text;
        ctx.replyWithHTML('Please indicate your <b>API SECRET</b>. Do not add any extra character or spaces');
        ctx.wizard.next();
    }
)

const API_SECRET = Telegraf.hears(/.*/, (ctx) =>{
        // Store the API secret in the session
        console.log(ctx.message.text)
        ctx.session.apiSecret = ctx.message.text;
        ctx.replyWithHTML('Thank you! Your API KEYs has been succesfully saved. Please send the comand /listen to start receiving notifications of new orders');
        return ctx.scene.leave();
})

const apiKeyScene = new WizardScene('apiKeyScene', API_KEY, API_SECRET);
apiKeyScene.enter((ctx) => {
    ctx.replyWithHTML('Please indicate your <b>API KEY</b>. Do not add any extra character or spaces');
});

const stage = new Stage([apiKeyScene]);
// Register the stage middleware
bot.use(stage.middleware());

bot.command('set_api_key', ctx => {
    ctx.scene.enter('apiKeyScene')
})

bot.command('dailyPnl', (ctx) =>{
    const apiKey = ctx.session.apiKey
    const apiSecret= ctx.session.apiSecret
    const client = new Spot(apiKey, apiSecret)
    const moment = require('moment');

    const today = moment().startOf('day');
    const startTime = today.unix() * 1000; // convert to milliseconds
    const endTime = today.endOf('day').unix() * 1000; // convert to milliseconds

    async function calculateDailyPnL() {
        // Get list of symbols
        const symbolsResponse = await client.exchangeInfo();
        const symbols = await symbolsResponse.data.symbols.filter(s => s.quoteAsset === 'BTC' || s.quoteAsset === 'USDT').map(s => s.symbol);
        let totalPnl = 0;
        try {
            const promises = symbols.map(async (symbol, i) => {
              await new Promise((resolve) => setTimeout(resolve, 1000 * i));
              const tradesResponse = await client.myTrades(symbol, {startTime: startTime, endTime: endTime });
              const trades = tradesResponse.data.map(t => ({
                price: parseFloat(t.price),
                qty: parseFloat(t.qty),
                commission: parseFloat(t.commission),
                commissionAsset: t.commissionAsset,
                isBuyer: t.isBuyer === true,
                time: t.time
              }))
              let totalCost = 0;
              let totalCommission = 0;
                      
              for (const trade of trades) {
                const cost = trade.price * trade.qty;
                const commission = trade.commissionAsset === 'USDT' ? trade.commission : 0;
                          
                if (trade.isBuyer) {
                  totalCost += cost + commission;
                } else {
                  totalCost -= cost - commission;
                  totalCommission += commission;
                }
              }
                      
              const pnl = totalCost - totalCommission;
                      
              console.log(`${symbol}: ${pnl}`);
              totalPnl += pnl;
            });
              
            // Wait for all promises to resolve
            await Promise.all(promises);
              
            // For each symbol, retrieve trades and calculate PnL

            console.log(`Daily PnL: ${totalPnl}`)
            ctx.reply(`Daily PnL: ${totalPnl}`).then( response =>{
              let message = response.text
              let id = response.message_id
              let chatid = response.chat.id
                client.userAsset()
                .then(async response => {
                  await response.data
                  let data = response.data
                  let asset = 0
                  for (const f of Object.values(data)){
                    asset += parseFloat(f.btcValuation)
                  }
                  client.avgPrice('BTCUSDT').then( async response => {
                    await response.data
                    let price = parseFloat(response.data.price)
                    let usdtWallet = asset * price
                    let percentEarned = (totalPnl / usdtWallet)* 100
                    let newText = message + `\n%PnL: ${percentEarned} %`
                    ctx.telegram.editMessageText(chatid,id,0, newText)
                  }).catch(error => console.error(error))
                }).catch(error => console.error(error))
            })
          } catch (error) {
           console.log(error)
          }
      }
      calculateDailyPnL();
})

bot.command('help', (ctx) =>{
    ctx.replyWithHTML(`Here a list of commands:

/set_api_key - <i>Set your own API Key in order to gets</i>
/dailyPnl - <i>Retrieve the PnL of the day</i>
/listen - <i>Start listening new trades</i>`)
})


bot.launch()

