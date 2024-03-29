import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';

export default class Contract {
    constructor(web3, address) {
        this.web3 = web3;       
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, address);
        this.owner = null;
        this.airlines = [];
        this.passengers = []; 
        this.STATUS_CODE_UNKNOWN = "0";
        this.STATUS_CODE_ON_TIME = "10";
        this.STATUS_CODE_LATE_AIRLINE = "20";
        this.STATUS_CODE_LATE_WEATHER = "30";
        this.STATUS_CODE_LATE_TECHNICAL = "40";
        this.STATUS_CODE_LATE_OTHER = "50";
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

    async fetchFlightStatus(flight) {
        if (flight == "") {
            return {result: null, error: null};
        }
        let sender = await this._sender();
        let payload = { airline: sender, flight: flight, timestamp: Date.now() };
        try {
            await this.flightSuretyApp.methods
                .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
                .send({ from: sender});
            return {result: payload, error: null};
        } catch (error) {
            return {result: payload, error: error};
        }
    }

    async getFlights() {
        try {
            let owner = await this._sender();
            let flights = await this.flightSuretyApp.methods
                .getFlights()
                .call({ from: owner});
            return flights != null ? flights : [];
        } catch (error) {
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
                return [];
            }
        } catch (error) {
            return [];
        }
    }

    async registerFlight(flight) {        
        if (flight == "") {
            return
        }
        try {
            let sender = await this._sender();
            let timestamp = Date.now();
            await this.flightSuretyApp.methods
                .registerFlight(flight, timestamp)
                .send({from: sender});
            return {error: null, success: true}       
        } catch (error){
            return {error: error.message, success: false}
        }
    }

    async purchaseInsurance(flight, amount) {
        if (flight == "" || amount == "") {
            return {error: "Empty flight or/and amount", success: false}
        }
        let sender = await this._sender();
        let value = this.web3.utils.toWei(amount, 'wei');
        try {
            await this.flightSuretyApp.methods
                .buyInsurance(flight)
                .send({from: sender, value: value})
            return {error: null, success: true}
        } catch (error) {
            return {error: error.message, success: false}
        }
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
            if (insurance.pendingToPayAmount > 0) {
                return {flight: flight, amount: insurance.pendingToPayAmount, error: null};
             } else {
                return {flight: flight, amount: null, error: null};
             }
        } catch (error) {
            return {flight: flight, amount: null, error: error.message};
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
            return {error: null, success: true}
        } catch (error) {
            return {error: error.message, success: false}
        }
    }

    subscribe(params, callback) {
        let flight = params.flight;
        let timestamp = params.timestamp;
        let airline = params.airline;
        let self = this;
        this.flightSuretyApp.once('FlightStatusInfo', {
            filter: {flight: flight},
            fromBlock: 'latest'
        }, function(error, event){ 
            if (error) { 
                let data = {
                    airline: airline, 
                    flight: flight, 
                    timestamp: timestamp, 
                    status: null
                };
                callback({result: data, error: error.message});
              } else {
                let eventResult = event['returnValues'];
                var status = "Unknown";
                switch(eventResult.status) {
                    case self.STATUS_CODE_ON_TIME:
                        status = "On time"; 
                        break;
                    case self.STATUS_CODE_LATE_AIRLINE:
                        status = "Late due to airline issues"; 
                        break;
                    case self.STATUS_CODE_LATE_WEATHER:
                        status = "Late due to weather issues"; 
                        break;
                    case self.STATUS_CODE_LATE_TECHNICAL:
                        status = "Late due to technical issues"; 
                        break;
                    case self.STATUS_CODE_LATE_OTHER:
                        status = "Late due to other issues"; 
                        break;
                    default: break;
                  }
                let data = {
                    airline: eventResult.airline, 
                    flight: eventResult.flight, 
                    timestamp: eventResult.timestamp, 
                    status: status
                };
                callback({result: data, error: null});
              }    
        });
    }
    
    async _sender() {        
        let accounts = await this.web3.eth.getAccounts();
        return accounts[0];
    }
}