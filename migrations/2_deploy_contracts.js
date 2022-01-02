const FlightSuretyApp = artifacts.require("FlightSuretyApp");
const FlightSuretyData = artifacts.require("FlightSuretyData");
const fs = require('fs');

module.exports = async function(deployer, network, accounts) {
    console.log(`deploying on ${network} network`);
    let firstAirline = accounts[0];
    console.log(`first airline address ${firstAirline}`);
    let fund = web3.utils.toWei('10', 'ether');
    await deployer.deploy(FlightSuretyData, {from: firstAirline, value: fund});
    await deployer.deploy(FlightSuretyApp, FlightSuretyData.address, {from: firstAirline});
    let flightSuretyData = await FlightSuretyData.deployed();
    console.log(`authorizing FlightSuretyApp to access FlightSuretyData`);
    await flightSuretyData.authorizeCaller(FlightSuretyApp.address);
    let config = {
        localhost: {
            url: 'http://localhost:8545',
            dataAddress: FlightSuretyData.address,
            appAddress: FlightSuretyApp.address,
            firstAirline: firstAirline
        }
    }
    fs.writeFileSync(__dirname + '/../src/dapp/config.json',JSON.stringify(config, null, '\t'), 'utf-8');
    fs.writeFileSync(__dirname + '/../src/server/config.json',JSON.stringify(config, null, '\t'), 'utf-8');
}