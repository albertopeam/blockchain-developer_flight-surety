
import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';


(async() => {

    let result = null;

    let contract = new Contract('localhost', () => {

        // Read transaction
        contract.isOperational((error, result) => {
            console.log(error,result);
            display('Operational Status', 'Check if contract is operational', [ { label: 'Operational Status', error: error, value: result} ]);
        });
    
        // User-submitted transaction
        DOM.elid('submit-oracle').addEventListener('click', () => {
            let flight = DOM.elid('flight-number').value;
            // Write transaction
            contract.fetchFlightStatus(flight, (error, result) => {
                display('Oracles', 'Trigger oracles', [ { label: 'Fetch Flight Status', error: error, value: result.flight + ' ' + result.timestamp} ]);
            });
        })
    
        // Obtain flights
        DOM.elid('submit-flights').addEventListener('click', () => {
            getFlights();
        })

        async function getFlights() {
            let flights = await contract.getFlights();
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
        }

        getFlights();
    });
})();

function display(title, description, results) {
    let displayDiv = DOM.elid("display-wrapper");
    let section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    results.map((result) => {
        let row = section.appendChild(DOM.div({className:'row'}));
        row.appendChild(DOM.div({className: 'col-sm-4 field'}, result.label));
        row.appendChild(DOM.div({className: 'col-sm-8 field-value'}, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);
}

function removeChilds(node) {
    var last;
    while (last = node.lastChild) node.removeChild(last);
};







