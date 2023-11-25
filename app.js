require('dotenv').config();
const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const WebSocket = require('ws');
const creds= require('./krn-intern-5cd0ae828e97.json');
const { google } = require('googleapis');
const { promisify } = require('util');

const app = express();
const wss = new WebSocket.Server({ port: 8080 });

app.post('/webhook', async (req, res) => {
  console.log('Webhook received');

  let api;
  google.auth.getClient({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  }).then(auth => {
    api = google.sheets({ version: 'v4', auth });
    const getSheets = promisify(api.spreadsheets.get.bind(api.spreadsheets));
    return getSheets({ spreadsheetId: process.env.GOOGLE_SHEET_ID });
  })
  .then(({ data: { sheets } }) => {
    const getValues = promisify(api.spreadsheets.values.get.bind(api.spreadsheets.values));
    // Fetch data from all sheets
    return Promise.all(sheets.map(sheet => {
      const sheetTitle = sheet.properties.title;
      return getValues({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: sheetTitle })
        .then(({ data: { values } }) => ({ title: sheetTitle, values }));
    }));
  })
  .then(results => {
    // results is an array of { title, values } objects
    const allValues = {};
    results.forEach(({ title, values }) => {
      allValues[title] = values;
    });
    console.log(allValues);
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(allValues));
      }
    });
  })
  .catch(err => {
    console.error(err);
  });

  res.sendStatus(200);
});

app.listen(3000, () => console.log('Server is listening on port 3000'));