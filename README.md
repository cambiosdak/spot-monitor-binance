# Spot orders monitor for Binance
# About
This is a Telegram bot developed to monitor new trades and once those trades are closed, reply to the message in order to retrieve the information required (PnL, fees, price, trade direction)
It was connected via Telegram API for BOTS and Binance API.
# Installation:
- Place your own Telegram Bot API TOKEN provided by @BotFather on the the line 15 of the code.
- Install npm:
```npm i @binance/connector```
```npm i telegraf```
```npm i telegraf-session-local```
```npm i axios```
- Run the batch file
- Start the bot on your Telegram
# How does this work?
This project will listen new orders and send the information to the bot:
- Symbol
- Side
- PnL if the order is a closed order.
- Executed quantity
- Size of the order
- Calculate PnL once a day.
- Bot will answer to the message of the order that was open once the order close, it will recover report the PnL and additional information

![Example:](https://github.com/cambiosdak/spot-monitor-binance/blob/master/example/image.png)

# License
License [MIT](https://opensource.org/license/mit/)
