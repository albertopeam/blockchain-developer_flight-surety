//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // auth
    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false
    mapping(address => uint) private authorizedContracts;

    // airlines
    struct Airline {
        bool isRegistered;
        bool isFunded;
        string name;
    }
    mapping(address => Airline) private airlines;  
    uint256 private numAirlines;  

    // enqueued airlines
    struct EnqueuedAirline {
        bool isEnqueued;
        string name;
        mapping(address => bool) votes;
        // num airlines that voted yes
        uint256 numVotesInFavour;
        // num airlines when enqueued
        uint256 numAirlines;
    }
    mapping(address => EnqueuedAirline) private enqueuedAirlines;  

    // flights
    struct Flight {
        bool isRegistered;
        uint8 statusCode;
        uint256 updatedTimestamp;        
        address airline;
    }
    mapping(string => Flight) private flights;
    string[] private flightIds;


    // funds
    mapping(address => uint256) private funds;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/


    /**
    * Constructor
    *      The deploying account becomes contractOwner
    */
    constructor() payable {
        require(msg.value >= 10 ether, "FlightSuretyData deployer becomes an airline and it needs 10 eth to be funded");
        contractOwner = msg.sender;        
        authorizedContracts[msg.sender] = 1;        
        funds[msg.sender] = funds[msg.sender].add(msg.value);    
        airlines[msg.sender] = Airline({isRegistered: true, isFunded: true, name: "Deployer airline"});
        numAirlines = numAirlines.add(1); 
        payable(this).transfer(msg.value);
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier requireIsCallerAuthorized() {
        require(authorizedContracts[msg.sender] == 1, "Sender is not authorized");
        _;
    }

    modifier requireIsNotRegisteredAirline(address _address) {
        require(!airlines[_address].isRegistered, "Airline is already registered");
        _;
    }

    modifier requireIsRegisteredAirline(address _address) {
        require(airlines[_address].isRegistered == true, "Airline is not registered");
        _;
    }

    modifier requireIsAirline(address _address) {
        require(airlines[_address].isRegistered == true && airlines[_address].isFunded == true, "Address is not an airline");
        _;
    }

    modifier requireFlightNotRegistered(string memory flightId) {
        require(flights[flightId].isRegistered == false, "Flight is already registered");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * Get operating status of contract
    *
    * @return A bool that is the current operating status
    */      
    function isOperational() public view returns(bool) {
        return operational;
    }

    function isAirline(address _address) 
        requireIsCallerAuthorized external view returns(bool) {
        return airlines[_address].isRegistered && airlines[_address].isFunded;
    }

    function getAirline(address _address) 
        requireIsCallerAuthorized external view returns(bool isRegistered, string memory name, address addr, bool isFunded) {
        return (airlines[_address].isRegistered, airlines[_address].name, _address, airlines[_address].isFunded);
    }

    function getEnqueuedAirline(address _address) 
        requireIsCallerAuthorized external view returns(bool isEnqueued, string memory name, address addr, uint256 numVotesInFavour, uint256 numAirlinesToVote) {
        return (enqueuedAirlines[_address].isEnqueued, enqueuedAirlines[_address].name, _address, enqueuedAirlines[_address].numVotesInFavour, enqueuedAirlines[_address].numAirlines);
    }

    function registeredNumberOfAirlines() 
        requireIsCallerAuthorized external view returns(uint256) {
        return numAirlines;
    }

    /**
    * Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */    
    function setOperatingStatus(bool mode) external
        requireContractOwner {
        operational = mode;
    }

    function authorizeCaller(address _address) external 
        requireContractOwner {
        authorizedContracts[_address] = 1;
    }

    function unauthorizeCaller(address _address) external 
        requireContractOwner {
        delete authorizedContracts[_address];
    }

    function requireOwner() internal view {
        require(contractOwner == msg.sender, "Caller is not contract owner");
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    *  Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */   
    function registerAirline(address _address, string memory _name) external returns (bool) {             
        return _registerAirline(_address, _name);
    }

    function enqueueAirline(address _address, string memory _name, address _voteAddress, uint8 times) external 
        requireIsOperational 
        requireIsCallerAuthorized
        requireIsNotRegisteredAirline(_address) returns(bool success, uint256 votes) {
        require(enqueuedAirlines[_address].votes[_voteAddress] == false, "Vote address already voted to this airline");
        if (enqueuedAirlines[_address].isEnqueued == false) {
            enqueuedAirlines[_address].isEnqueued = true;            
            enqueuedAirlines[_address].name = _name;     
            enqueuedAirlines[_address].numAirlines = numAirlines;       
        }
        if (_address != _voteAddress) {
            enqueuedAirlines[_address].votes[_voteAddress] = true;
            enqueuedAirlines[_address].numVotesInFavour = enqueuedAirlines[_address].numVotesInFavour.add(1);
        }                              
        bool registered = false;
        if (enqueuedAirlines[_address].numVotesInFavour.mul(times) >= enqueuedAirlines[_address].numAirlines) {
            registered = _registerAirline(_address, enqueuedAirlines[_address].name);
            _removeEnqueuedAirline(_address);            
        }        
        return (registered, enqueuedAirlines[_address].numVotesInFavour);
    }

    function _registerAirline(address _address, string memory _name) internal 
        requireIsOperational 
        requireIsCallerAuthorized
        requireIsNotRegisteredAirline(_address) returns (bool) {             
        airlines[_address] = Airline({isRegistered: true, isFunded: false, name: _name});
        numAirlines = numAirlines.add(1); 
        return true;
    }

    function _removeEnqueuedAirline(address _address) internal {
        delete enqueuedAirlines[_address];
    }

    // regiter flight
    function registerFlight(string memory flightId, uint256 timeStamp, address airlineAddress) external
        requireIsOperational 
        requireIsCallerAuthorized 
        requireIsAirline(airlineAddress)
        requireFlightNotRegistered(flightId) {
        flights[flightId].airline = airlineAddress;
        flights[flightId].updatedTimestamp = timeStamp;
        flights[flightId].statusCode = 0;
        flights[flightId].isRegistered = true;
        flightIds.push(flightId);
    }

    // get flights
    function getFlights() view external
        requireIsOperational 
        requireIsCallerAuthorized returns (string[] memory) {
        return flightIds;
    }

   /**
    * @dev Buy insurance for a flight
    *
    */   
    function buy
                            (                             
                            )
                            external
                            payable
    {

    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees
                                (
                                )
                                external
                                pure
    {
    }
    

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay
                            (
                            )
                            external
                            pure
    {
    }

   /**
    * Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */   
    function fund(address _address) public payable 
        requireIsOperational
        requireIsCallerAuthorized
        requireIsRegisteredAirline(_address) {
        funds[_address] = funds[_address].add(msg.value);        
        airlines[_address].isFunded = true;
    }

    function getFlightKey(address airline, string memory flight, uint256 timestamp) pure internal returns(bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
    * receive function for funding smart contract.
    *
    */
    receive() external payable {
        fund(msg.sender);
    }
}

