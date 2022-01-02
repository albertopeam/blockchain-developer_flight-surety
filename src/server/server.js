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
let flights = [
  {        
    id: `fid_0`,
    description: `MAD-JFK`,
    departure: `11:50 01/01/2022`
  },
  {        
    id: `fid_1`,
    description: `MAD-LAX`,
    departure: `00:00 03/01/2022`
  },
  {        
    id: `fid_2`,
    description: `MAD-MIA`,
    departure: `13:30 04/01/2022`
  },
  {        
    id: `fid_3`,
    description: `MAD-AUS`,
    departure: `17:40 05/01/2022`
  },
  {        
    id: `fid_4`,
    description: `MAD-LAS`,
    departure: `13:03 06/01/2022`
  }
]
let airline;

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
app.get('/api/flights', (req, res) => {
  if (airline == null) {
    res.send([]);
  } else {
    let results = flights.map(element => Object.assign({}, element, {airline: airline}));
    res.send(results);
  }  
});

(async() => {
  const accounts = await web3.eth.getAccounts();
  web3.eth.defaultAccount = accounts[0];
  console.log(`default account ${web3.eth.defaultAccount}`);
  console.log(`airline address ${config.firstAirline}`);
  let firstAirline = await flightSuretyApp.methods.getAirline(config.firstAirline).call({from: web3.eth.defaultAccount})
  airline = { name: firstAirline.airlineName, address: firstAirline.airlineAddress };
  await oracles.registerOracles();
})();

export default app;


