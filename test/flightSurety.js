
const Test = require('../config/testConfig.js');
const BigNumber = require('bignumber.js');
const truffleAssert = require('truffle-assertions');

contract('Flight Surety Tests', async (accounts) => {

  var config;
  const airlineName = "test airline";
  const fundAmount = web3.utils.toWei('10', 'ether');
  const fundAmountBN = web3.utils.toBN(fundAmount);
  const notEnoughFundAmount = web3.utils.toWei('9', 'ether');
  const zeroEther = web3.utils.toWei('0', 'ether');
  const oneEther = web3.utils.toWei('1', 'ether');
  const oneEtherAndAHalf = web3.utils.toWei('1500', 'milli');
  const oneEtherAndAHalfBN = web3.utils.toBN(oneEtherAndAHalf);;
  const oneEtherBN = web3.utils.toBN(oneEther);
  const moreThanOneEther = web3.utils.toWei('1000000000000000001', 'wei');
  const flightId = "flight";
  const STATUS_CODE_ON_TIME = 10;
  const STATUS_CODE_LATE_AIRLINE = 20;
  var registerOracleFee; 

  before('setup contract', async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
    registerOracleFee = await config.flightSuretyApp.REGISTRATION_FEE.call();
  });

  it(`(deploy) transfers 10 eth from deployer to data contract`, async function(){
    let balance = await web3.eth.getBalance(config.flightSuretyData.address);
    assert.equal(balance, fundAmount);
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
    let numAirlines = await config.flightSuretyData.registeredNumberOfAirlines.call(); 

    assert.equal(result, true);
    assert.equal(numAirlines, 1);
  })

  it('(airline) given created airline then it can be retrieved', async () => {
    let airlines = await config.flightSuretyApp.getAirlines.call({from: config.owner});
    
    assert.equal(airlines.addresses.length, 1);
    assert.equal(airlines.names.length, 1);
    assert.equal(airlines.addresses[0], config.owner);
    assert.equal(airlines.names[0], "Deployer airline");
  });

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

    const transaction = await config.flightSuretyApp.registerAirline(newAirline, airlineName, {from: defaultAirline});
    truffleAssert.eventEmitted(transaction, "RegisteredAirline", (event) => {
      return event.airlineAddress === newAirline && event.airlineName === airlineName;
    });

    let airline = await config.flightSuretyData.getAirline.call(newAirline); 
    assert.equal(airline.isRegistered, true);
    assert.equal(airline.name, airlineName);
    assert.equal(airline.addr, newAirline);
    assert.equal(airline.isFunded, false);
    let numAirlines = await config.flightSuretyData.registeredNumberOfAirlines.call(); 
    assert.equal(numAirlines, 2);    
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
    const gasUsed = transaction.receipt.gasUsed;
    const tx = await web3.eth.getTransaction(transaction.tx);
    const gasPricePerUnit = tx.gasPrice;
    const gasPrice = web3.utils.toBN(gasUsed).mul(web3.utils.toBN(gasPricePerUnit));
    const expectedFinalAirlineBalance = web3.utils.toBN(initialAirlineBalance).sub(gasPrice).sub(fundAmountBN).toString();
    assert.equal(finalAirlineBalance, expectedFinalAirlineBalance);
    const expectedFundBalance = web3.utils.toBN(initialDataContractBalance).add(fundAmountBN).toString();
    assert.equal(finalDataContractBalance, expectedFundBalance);
  });

  it('(airline) when registering five airlines then last one is not an airline until at least 50% of registered ones register(or vote) it', async () => {
    let defaultAirline = config.owner;
    let thirdAirline = accounts[3];
    let fourthAirline = accounts[4];
    let fifthAirline = accounts[5];
    await config.flightSuretyApp.registerAirline(thirdAirline, "third", {from: defaultAirline});
    await config.flightSuretyApp.fundAirline({from: thirdAirline, value: fundAmount});
    await config.flightSuretyApp.registerAirline(fourthAirline, "fourth", {from: defaultAirline});
    await config.flightSuretyApp.fundAirline({from: fourthAirline, value: fundAmount});
    assert.equal(await config.flightSuretyData.isAirline.call(thirdAirline), true);
    assert.equal(await config.flightSuretyData.isAirline.call(fourthAirline), true);
    assert.equal(await config.flightSuretyData.registeredNumberOfAirlines.call(), 4);

    await config.flightSuretyApp.registerAirline(fifthAirline, "fifth", {from: defaultAirline});

    var fifthAirlineQueued = await config.flightSuretyData.getEnqueuedAirline.call(fifthAirline);
    assert.equal(fifthAirlineQueued.isEnqueued, true);
    assert.equal(fifthAirlineQueued.name, "fifth");
    assert.equal(fifthAirlineQueued.addr, fifthAirline);
    assert.equal(fifthAirlineQueued.numVotesInFavour, 1);
    assert.equal(fifthAirlineQueued.numAirlinesToVote, 4);
    assert.equal(await config.flightSuretyData.isAirline.call(fifthAirline), false);
    await truffleAssert.fails(
      config.flightSuretyApp.registerAirline(fifthAirline, "fifth", {from: fifthAirline}),
      "Caller is not a registered airline"
    );
    await truffleAssert.fails(
      config.flightSuretyApp.registerAirline(fifthAirline, "fifth", {from: defaultAirline}),
      "Vote address already voted to this airline"
    );   
    const transaction = await config.flightSuretyApp.registerAirline(fifthAirline, "fifth", {from: thirdAirline});    
    truffleAssert.eventEmitted(transaction, "RegisteredAirline", (event) => {
      return event.airlineAddress === fifthAirline && event.airlineName === "fifth";
    });
    assert.equal(await config.flightSuretyData.isAirline.call(fifthAirline), false);
    let fifthAirlineData = await config.flightSuretyData.getAirline.call(fifthAirline);
    assert.equal(fifthAirlineData.isRegistered, true);
    assert.equal(fifthAirlineData.name, "fifth");
    assert.equal(fifthAirlineData.isFunded, false);
    assert.equal(fifthAirlineData.addr, fifthAirline);    
    fifthAirlineQueued = await config.flightSuretyData.getEnqueuedAirline.call(fifthAirline);
    assert.equal(fifthAirlineQueued.isEnqueued, false);
  });

  it('(airline) when registering flight then it can be retrieved', async () => {
    await config.flightSuretyApp.registerFlight(flightId, new Date().getTime(), {from: config.firstAirline});

    let flights = await config.flightSuretyApp.getFlights();
    assert.equal(flights.toString(), [flightId]);
  });

  it('(passenger) given registered flight when buying flight insurance with 0 ether then fail', async () => {
    await truffleAssert.fails(
      config.flightSuretyApp.buyInsurance(flightId, {from: config.passenger, value: zeroEther}),
      "Can't buy insurance for 0 ether");
  });

  it('(passenger) given registered flight when buying flight insurance with more than 1 ether then fail', async () => {
    await truffleAssert.fails(
      config.flightSuretyApp.buyInsurance(flightId, {from: config.passenger, value: moreThanOneEther}),
      "Can't buy insurance for more than 1 ether");
  });

  it('(passenger) given registered flight when buying flight insurance with less than 1 ether then success', async () => {
    let initialDataContractBalance = await web3.eth.getBalance(config.flightSuretyData.address);
    await config.flightSuretyApp.buyInsurance(flightId, {from: config.passenger, value: oneEther});

    let insurance = await config.flightSuretyApp.getInsurance(flightId, {from: config.passenger});    
    assert.equal(insurance.flightId, flightId);
    assert.equal(insurance.amount, oneEther);
    assert.equal(insurance.passenger, config.passenger);
    assert.equal(insurance.pendingToPayAmount, 0);
    let finalDataContractBalance = await web3.eth.getBalance(config.flightSuretyData.address);
    const expectedDataContractBalance = web3.utils.toBN(initialDataContractBalance).add(oneEtherBN).toString();
    assert.equal(finalDataContractBalance, expectedDataContractBalance);
  });

  it('(passenger) given registered flight when buying flight insurance twice then fails as already bought insurance', async () => {
    await truffleAssert.fails(
      config.flightSuretyApp.buyInsurance(flightId, {from: config.passenger, value: oneEther}),
      "Passenger already bought insurance for flight");
  });

  it('(oracle) given registered flight when fetch flight status and submit min responses for delayed then emit flightStatusInfo, update flight status and credit to withdraw insurees', async () => {
    const onTimeResponses = 2;    
    const airline =  config.firstAirline;
    const timestamp = new Date().getTime();
    var index;    
    let fetchTransaction = await config.flightSuretyApp.fetchFlightStatus(airline, flightId, timestamp);    
    truffleAssert.eventEmitted(fetchTransaction, "OracleRequest", (event) => {
      index = event.index;
      return event.airline === airline && event.flight === flightId && event.timestamp == timestamp;
    });
    var oraclesAddress = []
    var accountIdx = 0;
    while(oraclesAddress.length < 4) {   
      await config.flightSuretyApp.registerOracle({ from: accounts[accountIdx], value: registerOracleFee });
      let indexes = await config.flightSuretyApp.getMyIndexes.call({from: accounts[accountIdx]});
      if (indexes.toString().includes(index)) {
        oraclesAddress.push(accounts[accountIdx]);
      }      
    }

    await config.flightSuretyApp.submitOracleResponse(index, airline, flightId, timestamp, STATUS_CODE_ON_TIME, {from: oraclesAddress[0]});
    for (let i=0; i<onTimeResponses;i++) {
      await config.flightSuretyApp.submitOracleResponse(index, airline, flightId, timestamp, STATUS_CODE_LATE_AIRLINE, {from: oraclesAddress[i+1]});
    }
    let transaction = await config.flightSuretyApp.submitOracleResponse(index, airline, flightId, timestamp, STATUS_CODE_LATE_AIRLINE, {from: oraclesAddress[3]});

    truffleAssert.eventEmitted(transaction, "FlightStatusInfo", (event) => {
      return event.airline === airline && event.flight === flightId && event.timestamp == timestamp && event.status == STATUS_CODE_LATE_AIRLINE;
    });
    let flightData = await config.flightSuretyApp.getFlight(flightId);
    assert.equal(flightData.flight, flightId);
    assert.equal(flightData.airline, airline);
    assert.equal(flightData.updatedTimestamp, timestamp);    
    assert.equal(flightData.statusCode, STATUS_CODE_LATE_AIRLINE);
    let insurance = await config.flightSuretyApp.getInsurance(flightId, {from: config.passenger});
    assert.equal(insurance.flightId, flightId);
    assert.equal(insurance.passenger, config.passenger);
    assert.equal(insurance.amount, oneEther);
    assert.equal(insurance.pendingToPayAmount, oneEtherAndAHalf);
  });

  it('(passenger) given no credit passenger for flight when try to withdraw then revert', async () => {
    await truffleAssert.fails(
      config.flightSuretyApp.withdraw(flightId, {from: config.testAddresses[0]}),
      "Passenger not found for flight");
  });

  it('(passenger) given credit insuree for flight when withdraw then insurance pending to pay amount is zero and passenger received payment', async () => {
    let initialPassengerBalance = await web3.eth.getBalance(config.passenger);
    let initialContractBalance = await web3.eth.getBalance(config.flightSuretyData.address);
    let transaction = await config.flightSuretyApp.withdraw(flightId, {from: config.passenger});

    let insurance = await config.flightSuretyApp.getInsurance(flightId, {from: config.passenger});
    assert.equal(insurance.flightId, flightId);
    assert.equal(insurance.passenger, config.passenger);
    assert.equal(insurance.amount, oneEther);
    assert.equal(insurance.pendingToPayAmount, 0);
    const gasUsed = transaction.receipt.gasUsed;
    const tx = await web3.eth.getTransaction(transaction.tx);
    const gasPricePerUnit = tx.gasPrice;
    const gasPrice = web3.utils.toBN(gasUsed).mul(web3.utils.toBN(gasPricePerUnit));
    const finalPassengerBalance = await web3.eth.getBalance(config.passenger);
    const expectedPassengerBalance = web3.utils.toBN(initialPassengerBalance).add(oneEtherAndAHalfBN).sub(gasPrice).toString();
    assert.equal(finalPassengerBalance, expectedPassengerBalance);
    let finalContractBalance = await web3.eth.getBalance(config.flightSuretyData.address);
    let expectedContractBalance = web3.utils.toBN(initialContractBalance).sub(oneEtherAndAHalfBN).toString();
    assert.equal(finalContractBalance, expectedContractBalance);
  });
});
