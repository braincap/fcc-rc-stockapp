'use strict';
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');
const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;
const request = require('request');
require('dotenv').config();

const staticFiles = express.static(path.join(__dirname, './public'));
app.use(staticFiles);

const apiQuery = `https://www.quandl.com/api/v3/datatables/WIKI/PRICES.json?api_key=${process.env.API_KEY}&qopts.columns=ticker,date,close&ticker=`;
// const apiQuery = `https://www.quandl.com/api/v3/datatables/WIKI/PRICES.json?api_key=${process.env.API_KEY}&qopts.columns=ticker,date,close&date.gte=2017-06-01&date.lte=2017-06-02&ticker=`;

io.on('connection', socket => {
  // Connect to Mongo
  MongoClient.connect(process.env.DATABASE_URL, (error, database) => {
    if (error) { console.log('Error: ', error); throw error; }
    const stockCollection = database.collection('stocks');

    // Find all stocks in DB and get their prices from API
    stockCollection.find({}).toArray((err, result) => {
      if (!result.length) { return; }
      const stockList = result.reduce((acc, val, currIndex) => {
        return acc + (currIndex === 0 ? '' : ',') + val.ticker
      }, '');

      pullAllData([], '', stockList);

    });

    // Listen for new stock triggers
    socket.on('stock', msg => {
      msg = msg.toUpperCase();
      console.log(msg);
      pullNewData([], '', msg)
    });

    function pullAllData(stockData, cursor_id, stockList) {
      request.get(`${apiQuery}${stockList}${cursor_id}`, (err, response, data) => {
        if (err) { console.log(err); throw err; }
        var data = JSON.parse(data);
        var tempData = stockData.concat(Array.from((data.datatable.data)));
        stockData = tempData;
        if (data.meta.next_cursor_id) {
          cursor_id = `&qopts.cursor_id=${data.meta.next_cursor_id}`;
          pullAllData(stockData, cursor_id, stockList);
        } else {
          socket.emit('stockAll', stockData);
        }
      });
    }

    function pullNewData(stockData, cursor_id, stockList) {
      request.get(`${apiQuery}${stockList}`, (err, response, data) => {
        if (err) { console.log(err) }
        var data = JSON.parse(data).datatable.data;
        if (data.length) {
          stockCollection.findOne({ ticker: stockList }, (err, data) => {
            if (!err) {
              if (!data) {
                stockCollection.insertOne({ ticker: stockList }, (err, result) => {
                  stockCollection.find({}).toArray((err, result) => {
                    if (!result.length) { return; }
                    const stockList = result.reduce((acc, val, currIndex) => {
                      return acc + (currIndex === 0 ? '' : ',') + val.ticker
                    }, '');
                    pullAllData([], '', stockList);
                  });

                });
              } else {
                socket.emit('stockNew', 'exists');
              }
            }
          });
        } else {
          socket.emit('stockNew', 'invalid');
        }
      });
    }

  });
});

app.set('port', process.env.PORT || 3001);
http.listen(app.get('port'), () => console.log(`Listening on ${app.get('port')}`));