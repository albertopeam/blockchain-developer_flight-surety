//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./FlightSuretyData.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

    event RegisteredAirline(address airlineAddress, string airlineName);

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    address private contractOwner;          // Account used to deploy contract
    FlightSuretyData private contractData;
    uint8 private requireAtLeastHalfOfTheVotes = 2;
    uint256 private constant multiplier = 3;
    uint256 private constant divider = 2;
 
    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    *  Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() {
        require(contractData.isOperational(), "Contract is currently not operational");  
        _;
    }

    /**
    *  Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner(){
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier requireIsAirline(address _address) {
        require(contractData.isAirline(_address), "Caller is not a registered airline");
        _;
    }

    modifier requireAirlineFundEther() {
        require(msg.value >= 10 ether, "Not enough ether to fund an airline(>=10 eth needed)");
        _;
    }

    modifier requireNonEmptyEther() {
        require(msg.value > 0 ether, "Can't buy insurance for 0 ether");
        _;
    }

    modifier requireLessOrEqualThanOneEther() {
        require(msg.value <= 1 ether, "Can't buy insurance for more than 1 ether");
        _;
    }

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
    * Contract constructor
    *
    */
    constructor (address _contractDataAddress) {
        contractOwner = msg.sender;
        address payable contractAddress = payable(_contractDataAddress);
        contractData = FlightSuretyData(contractAddress);
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function isOperational() public view returns(bool) {
        return contractData.isOperational();
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

  
   /**
    * Add an airline to the registration queue
    */   
    function registerAirline(address _address, string memory _name) external 
        requireIsOperational
        requireIsAirline(msg.sender) returns(bool success, uint256 votes) {   
        bool airlineIsRegistered = false;      
        uint256 airlineVotes = 0;
        if (contractData.registeredNumberOfAirlines() < 4) {
            (airlineIsRegistered, airlineVotes) = (contractData.registerAirline(_address, _name), 1);
        } else {            
            (airlineIsRegistered, airlineVotes) = contractData.enqueueAirline(_address, _name, msg.sender, requireAtLeastHalfOfTheVotes);
        }
        if (airlineIsRegistered) {
            emit RegisteredAirline(_address, _name);
        }
        return (airlineIsRegistered, airlineVotes);
    }

    function getAirline(address _address) view external 
        requireIsOperational
        requireIsAirline(_address)
        returns(string memory airlineName, address airlineAddress) {
        (, airlineName, airlineAddress,) = contractData.getAirline(_address);
    }

    // get airlines
    function getAirlines() 
        requireIsOperational external view returns(address[] memory addresses, string[] memory names) {
        return contractData.getAirlines();
    }

    // Register a future flight for insuring.
    function registerFlight(string memory flightId, uint256 timeStamp) external
        requireIsOperational {
        contractData.registerFlight(flightId, timeStamp, msg.sender, STATUS_CODE_UNKNOWN);
    }

    // get flights
    function getFlights() view external
        requireIsOperational returns (string[] memory) {
        return contractData.getFlights();
    }

    // get flight
    function getFlight(string memory _flightId) view external
        requireIsOperational returns (string memory flight, uint8 statusCode, uint256 updatedTimestamp, address airline) {
        return contractData.getFlight(_flightId);
    }

    // buy insurance for flight
    function buyInsurance(string memory flightId) external payable
        requireIsOperational
        requireNonEmptyEther
        requireLessOrEqualThanOneEther {        
        contractData.buyInsurance(flightId, msg.sender, msg.value);
        payable(contractData).transfer(msg.value);
    }

    // get insurance status
    function getInsurance(string memory _flightId) view external 
        requireIsOperational returns (string memory flightId, address passenger, uint256 amount, uint256 pendingToPayAmount) {
        return contractData.getInsurance(_flightId, msg.sender);
    }

    // Called after oracle has updated flight status
    function processFlightStatus(string memory _flight, uint256 _timestamp, uint8 newStatusCode) internal {
        (,uint8 statusCode,,) = contractData.getFlight(_flight);
        if (statusCode == STATUS_CODE_UNKNOWN) {
            contractData.updateFlightStatus(_flight, _timestamp, newStatusCode);
            if (newStatusCode == STATUS_CODE_LATE_AIRLINE) {
                contractData.creditInsurees(_flight, multiplier, divider);
            }
        }       
    }

    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus(address airline, string memory flight, uint256 timestamp) external
        requireIsOperational {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp));
        ResponseInfo storage info = oracleResponses[key];
        info.requester = msg.sender;
        info.isOpen = true;

        emit OracleRequest(index, airline, flight, timestamp);
    } 

    // fund airline
    function fundAirline() external payable   
        requireIsOperational  
        requireAirlineFundEther {     
        contractData.fundAirline(msg.sender, msg.value);
        payable(contractData).transfer(msg.value);
    }

    // Transfers eligible payout funds to insuree
    function withdraw(string memory flight) payable external 
        requireIsOperational {
        contractData.withdraw(msg.sender, flight);
    }

// region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;    

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;


    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;        
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester;                              // Account that requested status
        bool isOpen;                                    // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses;          // Mapping key is the status code reported
                                                        // This lets us group responses and identify
                                                        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(address airline, string flight, uint256 timestamp, uint8 status);

    event OracleReport(address airline, string flight, uint256 timestamp, uint8 status);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(uint8 index, address airline, string flight, uint256 timestamp);


    // Register an oracle with the contract
    function registerOracle() external payable
        requireIsOperational {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({
                                        isRegistered: true,
                                        indexes: indexes
                                    });
    }

    function getMyIndexes() view external 
        requireIsOperational returns(uint8[3] memory) {
        require(oracles[msg.sender].isRegistered, "Not registered as an oracle");
        return oracles[msg.sender].indexes;
    }

    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse(uint8 index, address airline, string memory flight, uint256 timestamp, uint8 statusCode) external
        requireIsOperational {
        require((oracles[msg.sender].indexes[0] == index) || (oracles[msg.sender].indexes[1] == index) || (oracles[msg.sender].indexes[2] == index), "Index does not match oracle request");


        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp)); 
        require(oracleResponses[key].isOpen, "Flight or timestamp do not match oracle request");

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, timestamp, statusCode);
        if (oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES) {

            emit FlightStatusInfo(airline, flight, timestamp, statusCode);

            // Handle flight status as appropriate
            processFlightStatus(flight, timestamp, statusCode);
        }
    }

    function getFlightKey(address airline, string memory flight, uint256 timestamp) pure internal returns(bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes(address account) internal returns(uint8[3] memory) {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);
        
        indexes[1] = indexes[0];
        while(indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex(address account) internal returns (uint8) {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);

        if (nonce > 250) {
            nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

// endregion

}   
