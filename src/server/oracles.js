module.exports = class Oracles {
    constructor(flightSuretyApp, web3) {
        this.flightSuretyApp = flightSuretyApp
        this.web3 = web3;
        this.numOracles = 20;
        this.oracles = [];
        const UNKNOWN = 0;
        const ON_TIME = 10;
        const LATE_AIRLINE = 20;
        const LATE_WEATHER = 30;
        const LATE_TECHNICAL = 40;
        const LATE_OTHER = 50;
        this.statusCodes  = [
            UNKNOWN,
            ON_TIME,
            LATE_AIRLINE,
            LATE_WEATHER,
            LATE_TECHNICAL,
            LATE_OTHER
        ];
    }

    async registerOracles() {
        let accounts = await this.web3.eth.getAccounts();
        if (accounts.length < this.numOracles) {
            throw new Error("web3.eth.getAccounts must return 20 accounts");
        }
        let fee = await this.flightSuretyApp.methods.REGISTRATION_FEE().call({from: this.web3.eth.defaultAccount});
        for (let i = 0; i < accounts.length; i++) {
            try {
                let account = accounts[i];
                await this.flightSuretyApp.methods.registerOracle().send({from: account, value: fee, gas: 5000000}); 
                let indexes = await this.flightSuretyApp.methods.getMyIndexes().call({from: account});
                let newOracle = {'address': account, 'indexes': indexes}
                console.log(`register ${JSON.stringify(newOracle)}`);
                this.oracles.push(newOracle);
            } catch (e) {
                console.log(`can't register ${accounts[i]}. ${e}`);
            }            
        }
        console.log(`registered oracles ${this.oracles.length}`);
    }

    async requestFlightStatus(index, airline, flight, timestamp) {        
        console.log(`requestFlightStatus index: ${index} airline: ${airline} fligth: ${flight} timestamp: ${timestamp}`);
        let targetOracles = [];
        targetOracles = this.oracles.filter(element => element.indexes.includes(index));
        console.log(`numOracles match ${targetOracles.length}`);
        for (let i=0; i<targetOracles.length ;i++) {
            let status = this._randomStatusCode();
            let oracle = targetOracles[i];
            try {                
                await this.flightSuretyApp.methods.submitOracleResponse(index, airline, flight, timestamp, status).send({from: oracle.address});
            } catch(e) {
                console.log(`can't submit ${e}`);
                console.log(`oracle ${oracle.address} with ${oracle.indexes}. search index ${index}`);                
            }
        }
    }

    _randomStatusCode() {
        return this.statusCodes[Math.floor(Math.random() * this.statusCodes.length)];
    }
}