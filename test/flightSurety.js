
const Test = require('../config/testConfig.js');
const BigNumber = require('bignumber.js');
const truffleAssert = require('truffle-assertions');

contract('Flight Surety Tests', async (accounts) => {

  var config;
  const airlineName = "test airline";
  const fundAmount = web3.utils.toWei('10', 'ether');
  const fundAmountBN = web3.utils.toBN(fundAmount)
  const notEnoughFundAmount = web3.utils.toWei('9', 'ether');

  before('setup contract', async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) has correct initial isOperational() value`, async function () {

    // Get operating status
    let status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");

  });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

      // Ensure that access is denied for non-Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
            
  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

      // Ensure that access is allowed for Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false);
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, false, "Access not restricted to Contract Owner");
      
  });

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

      await config.flightSuretyData.setOperatingStatus(false);

      let reverted = false;
      try 
      {
          await config.flightSurety.setTestingMode(true);
      }
      catch(e) {
          reverted = true;
      }
      assert.equal(reverted, true, "Access not blocked for requireIsOperational");      

      // Set it back for other tests to work
      await config.flightSuretyData.setOperatingStatus(true);

  });

  it('(airline) contract deployer is an Airline by default', async () => {
    let defaultAirline = config.owner;

    let result = await config.flightSuretyData.isAirline.call(defaultAirline); 

    assert.equal(result, true);
  })

  it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {
    let newAirline = accounts[2];

    await truffleAssert.fails(
        config.flightSuretyApp.registerAirline(newAirline, airlineName, {from: config.firstAirline}),
        "Caller is not a registered airline");

    let result = await config.flightSuretyData.isAirline.call(newAirline); 
    assert.equal(result, false, "Airline should not be able to register another airline if it hasn't provided funding");
  });

  it('(airline) can register an Airline using registerAirline() if invoking airline is funded', async () => {
    let defaultAirline = config.owner;
    let newAirline = config.firstAirline;

    await config.flightSuretyApp.registerAirline(newAirline, airlineName, {from: defaultAirline});

    let airline = await config.flightSuretyData.getAirline.call(newAirline); 
    assert.equal(airline.isRegistered, true);
    assert.equal(airline.name, airlineName);
    assert.equal(airline.addr, newAirline);
    assert.equal(airline.isFunded, false);
  });

  it('(airline) registered airline that is funded with less than 10eth not becomes participated airline', async () => {
    let addedAirline = config.firstAirline;    

    await truffleAssert.fails(
        config.flightSuretyApp.fundAirline({from: addedAirline, value: notEnoughFundAmount}),
        "Not enough ether to fund an airline(>=10 eth needed)");
  });

  it('(airline) registered airline that is funded with 10eth becomes participated airline', async () => {
    let addedAirline = config.firstAirline;
    let initialAirlineBalance = await web3.eth.getBalance(addedAirline);
    let initialDataContractBalance = await web3.eth.getBalance(config.flightSuretyData.address);

    const transaction = await config.flightSuretyApp.fundAirline({from: addedAirline, value: fundAmount});

    let result = await config.flightSuretyData.isAirline.call(addedAirline); 
    assert.equal(result, true);
    let finalAirlineBalance = await web3.eth.getBalance(addedAirline);
    let finalDataContractBalance = await web3.eth.getBalance(config.flightSuretyData.address);
    const gasUsed = transaction.receipt.gasUsed
    const tx = await web3.eth.getTransaction(transaction.tx);
    const gasPricePerUnit = tx.gasPrice;
    const gasPrice = web3.utils.toBN(gasUsed).mul(web3.utils.toBN(gasPricePerUnit))
    const expectedFinalAirlineBalance = web3.utils.toBN(initialAirlineBalance).sub(gasPrice).sub(fundAmountBN).toString()
    assert.equal(finalAirlineBalance, expectedFinalAirlineBalance)
    const expectedFundBalance = web3.utils.toBN(initialDataContractBalance).add(fundAmountBN).toString()
    assert.equal(finalDataContractBalance, expectedFundBalance)
  });
});
