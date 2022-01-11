import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';

export default class Contract {
    constructor(web3, address) {
        this.web3 = web3;       
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, address);
        this.owner = null;
        this.airlines = [];
        this.passengers = [];        
    }

    async initialize() {
        let accts = await this.web3.eth.getAccounts();
        this.owner = accts[0];
        let counter = 1;        
        while(this.airlines.length < 5) {
            this.airlines.push(accts[counter++]);
        }
        while(this.passengers.length < 5) {
            this.passengers.push(accts[counter++]);
        }
    }

    async isOperational() {
       let sender = await this._sender();
       let result = await this.flightSuretyApp.methods
            .isOperational()
            .call({ from: sender});
        return result;
    }

    //TODO: reverts in server
    async fetchFlightStatus(flight, callback) {
        if (flight == "") {
            return
        }
        let self = this;
        let sender = await this._sender();
        let payload = {
            airline: sender,
            flight: flight,
            timestamp: Math.floor(Date.now() / 1000)
        } 
        self.flightSuretyApp.methods
            .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
            .send({ from: self.owner}, (error, result) => {
                callback(error, payload);
            });
    }

    async getFlights() {
        try {
            let owner = await this._sender();
            let flights = await this.flightSuretyApp.methods
                .getFlights()
                .call({ from: owner});
            return flights != null ? flights : [];
        } catch (error) {
            console.log(`getFlights error ${error}`);
            return [];
        }
    }

    async getAirlines() {        
        try {
            let sender = await this._sender();
            let airlines = await this.flightSuretyApp.methods.getAirlines().call({from: sender});
            if (airlines != null) {
                let addresses = airlines.addresses;
                let names = airlines.names;
                return addresses.map(function(element, index) {
                    return {address: element, name: names[index]};
                });
            } else {
                console.log(`no airlines`);
                return [];
            }
        } catch (error) {
            console.log(`getAirlines error ${error}`);
            return [];
        }
    }

    //TODO: why to change gas and gasPrice? TOO MUCH PRICE for this transaction
    async registerFlight(flight) {        
        if (flight == "") {
            return
        }
        let sender = await this._sender();
        let timestamp = new Date().getTime();
        await this.flightSuretyApp.methods
            .registerFlight(flight, timestamp)
            .send({from: sender, gas: 4712388, gasPrice: 100000000000});        
    }

    async purchaseInsurance(flight, amount) {
        if (flight == "" || amount == "") {
            return
        }
        let sender = await this._sender();
        let value = this.web3.utils.toWei(amount, 'wei');
        await this.flightSuretyApp.methods
            .buyInsurance(flight)
            .send({from: sender, value: value})
    }

    async withdrawAmount(flight) {
        if (flight == "") {
            return null;
        }
        try {
            let sender = await this._sender();
            let insurance = await this.flightSuretyApp.methods
                .getInsurance(flight)
                .call({from: sender});
            return insurance.pendingToPayAmount > 0 ? insurance.pendingToPayAmount : null;
        } catch (error) {
            console.log(error);
            return null;
        }
    }

    async withdraw(flight, amount) {
        if (flight == "" || amount == "") {
            return
        }
        try {
            let sender = await this._sender();
            await this.flightSuretyApp.methods
                .withdraw(flight)
                .send({from: sender});
        } catch (error) {
            console.log(error);
        }
    }
    
    async _sender() {        
        let accounts = await this.web3.eth.getAccounts();
        console.log(`accounts ${accounts}`);
        console.log(`sender ${accounts[0]}`);
        return accounts[0];
    }
}