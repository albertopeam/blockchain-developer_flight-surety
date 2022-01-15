
import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';
import Web3 from 'web3';
import Config from './config.json';

let App = {
    network: "localhost",
    contract: null,
    web3: null,

    initWeb3: async function() {
        var web3Provider;
        if (window.ethereum) {    // Modern dapp browsers...
            web3Provider = window.ethereum;
            try {
                // Request account access
                await window.ethereum.enable();
                console.log(`using window.ethereum`);
            } catch (error) {
                // User denied account access...
                console.error("User denied account access")
            }
        } else if (window.web3) { // Legacy dapp browsers...
            console.log(`using window.web3.currentProvider`);
            web3Provider = window.web3.currentProvider;
        } else {                  // If no injected web3 instance is detected, fall back to Ganache
            let config = Config[this.network].url;
            console.log(`using HTTP provider from ${config.url}`);
            web3Provider = new Web3.providers.HttpProvider(config.url);
        }
        this.web3 = new Web3(web3Provider);
    },

    initContract: async function() {
        let config = Config[this.network];
        this.contract = new Contract(this.web3, config.appAddress);
        await this.contract.initialize();
        try {
            let result = await this.contract.isOperational()
            display('Operational Status', 'Check if contract is operational', [ { label: 'Operational Status', value: result} ]);
        } catch (error) {
            display('Operational Status', 'Check if contract is operational', [ { label: 'Operational Status', error: error} ]);
        }
    },

    initBind: async function() {
        // User-submitted transaction
        DOM.elid('submit-oracle').addEventListener('click', async () => {
            let flight = DOM.elid('flight-status-id').value;
            let response = await this.contract.fetchFlightStatus(flight);
            if (response.error != null) {                
                display('Oracles', 'Trigger oracles', [ { label: 'Fetch Flight Status', error: response.error.message, value: flight} ]);
            } else if (response.result != null) {                
                display('Oracles', 'Trigger oracles', [ { label: 'Fetch Flight Status', error: response.error, value: response.result.flight + ' ' + response.result.timestamp} ], flight);
                this.contract.subscribe(response.result.flight, this.flightStatus);
            }        
        })

        // Obtain flights
        DOM.elid('submit-flights').addEventListener('click', () => {
            App.getFlights();
        })

        // Obtain airlines
        DOM.elid('submit-airlines').addEventListener('click', () => {
            App.getAirlines();
        })

        // Register flight
        DOM.elid('submit-flight').addEventListener('click', async () => {
            let response = await this.contract.registerFlight(DOM.elid('flight-register-id').value);
            display('Register', 'Register flight', [ { label: 'Register flight Status', error: response.error, value: 'successful ' + response.success} ]);
            await this.getFlights();
        })

        // Purchase insurance
        DOM.elid('submit-purchase-flight-insurance').addEventListener('click', async () => {
            let response = await this.contract.purchaseInsurance(
                DOM.elid('flight-insurance-id').value, 
                DOM.elid('flight-insurance-amount').value
            );
            display('Purchase', 'Purchase insurance', [ { label: 'Purchase insurance Status', error: response.error, value: 'successful ' + response.success} ]);
        })

        // Get withdraw amount
        DOM.elid('submit-withdraw-amount').addEventListener('click', async () => {
            let response = await this.contract.withdrawAmount(DOM.elid('flight-withdraw-amount-id').value);
            DOM.elid('flight-withdraw-amount').value = response.amount;
            DOM.elid('flight-withdraw-id').value = response.flight;
            display('Wihtdraw', 'Get amount', [ { label: 'Get amount Status', error: response.error, value: response.flight + ' ' + response.amount + ' wei'} ]);
        })

        // Withdraw
        DOM.elid('submit-withdraw').addEventListener('click', async () => {
            let response = await this.contract.withdraw(
                DOM.elid('flight-withdraw-id').value,
                DOM.elid('flight-withdraw-amount').value
            );
            display('Withdraw', 'Withdraw amount', [ { label: 'Withdraw amount', error: response.error, value: 'successful ' + response.success} ]);
        })
    },
    
    getFlights: async function () {
        let flights = await this.contract.getFlights();
        if (flights.length == 0) {
            DOM.elid("flights-empty").hidden = false;
            DOM.elid("flights-ul").hidden = true;
        } else {
            DOM.elid("flights-ul").hidden = false;
            DOM.elid("flights-empty").hidden = true;
            removeChilds(DOM.elid("flights-ul"));
            flights.forEach( element => {
                DOM.elid("flights-ul").appendChild(DOM.li({className:'list-group-item py-0 field-value'}, element));
            });
        }
    },

    getAirlines: async function() {        
        let airlines = await this.contract.getAirlines();  
        console.log(`getting airlines ${airlines}`);
        if (airlines.length == 0) {
            DOM.elid("airlines-empty").hidden = false;
            DOM.elid("airlines-ul").hidden = true;
        } else {
            DOM.elid("airlines-ul").hidden = false;
            DOM.elid("airlines-empty").hidden = true;
            removeChilds(DOM.elid("airlines-ul"));                
            airlines.forEach( element => {
                let airline = `${element.name} ${element.address}`
                DOM.elid("airlines-ul").appendChild(DOM.li({className:'list-group-item py-0 field-value'}, airline));
            });
        }
    }, 
    
    flightStatus: async function(response) {
        if (response.result != null) {
            let result = response.result;
            let flight = result.flight;
            let date = result.timestamp;
            let message = `${DOM.elid(flight).textContent} - ${result.status}`
            DOM.elid(flight).textContent = message;
        } else if (response.error != null) {
            let error = response.error;
            let flight = error.flight;
            DOM.elid(flight).textContent = `${DOM.elid(flight).textContent} - ${error.message}`;
        }
    }
};

window.onload = async function() {
    await App.initWeb3();
    await App.initContract();
    await App.initBind();
    await App.getAirlines();
    await App.getFlights();
};

function display(title, description, results, id = null) {
    let displayDiv = DOM.elid("display-wrapper");
    let section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));    
    results.map((result) => {
        let row = section.appendChild(DOM.div({className:'row'}));
        let data = result.error ? String(result.error) : String(result.value)
        row.appendChild(DOM.div({className: 'col-sm-4 field'}, result.label));
        row.appendChild(DOM.div({className: 'col-sm-8 field-value', id: `${id ? id : ''}`}, data));
        section.appendChild(row);
    })
    displayDiv.append(section);
}

function removeChilds(node) {
    var last;
    while (last = node.lastChild) node.removeChild(last);
};







