import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';
import Oracles from './oracles.js'

let config = Config['localhost'];
let provider = config.url.replace('http', 'ws');
let web3 = new Web3(new Web3.providers.WebsocketProvider(provider));
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
let oracles = new Oracles(flightSuretyApp, web3);

flightSuretyApp.events.OracleRequest({fromBlock: 'latest' }, function (error, event) {
    if (error) { 
      console.log(`OracleRequest event error ${error}`) 
    } else {
      console.log(`OracleRequest event received`) 
      let eventResult = event['returnValues'];
      let index = eventResult['index'];
      let airline = eventResult['airline'];
      let flight = eventResult['flight'];
      let timestamp = eventResult['timestamp'];
      oracles.requestFlightStatus(index, airline, flight, timestamp);
    }    
});

const app = express();
app.get('/api', (req, res) => {
    res.send({
      message: 'An API for use with your Dapp!'
    })
});

(async() => {
  const accounts = await web3.eth.getAccounts();
  web3.eth.defaultAccount = accounts[0];
  console.log(`default account ${web3.eth.defaultAccount}`);
  await oracles.registerOracles();
  await fetch(); //TODO: remove
})();

async function fetch() {
  await flightSuretyApp.methods.fetchFlightStatus(config.firstAirline, "flight4", Date.now()).send({from: web3.eth.defaultAccount});
}

export default app;


