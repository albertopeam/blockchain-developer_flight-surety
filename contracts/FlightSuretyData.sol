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

    // funds
    mapping(address => uint256) private funds;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/


    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor() {
        contractOwner = msg.sender;        
        numAirlines = 0;
        authorizedContracts[msg.sender] = 1;
        airlines[msg.sender] = Airline({isRegistered: true, isFunded: true, name: "Deployer airline"});
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() 
    {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
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

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */      
    function isOperational() public view returns(bool) {
        return operational;
    }

    function isAirline(address _address) external view returns(bool) {
        return airlines[_address].isRegistered && airlines[_address].isFunded;
    }

    function getAirline(address _address) external view returns(bool isRegistered, string memory name, address addr, bool isFunded) {
        return (airlines[_address].isRegistered, airlines[_address].name, _address, airlines[_address].isFunded);
    }

    /**
    * @dev Sets contract operations on/off
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
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */   
    function registerAirline(address _address, string memory _name) external 
        requireIsOperational 
        requireIsCallerAuthorized
        requireIsNotRegisteredAirline(_address) returns (bool) {             
        bool registered = false;
        //TODO: logic here???? move to the other contract. how to do that having to store airlines?
        if (numAirlines < 5) {
            airlines[_address] = Airline({isRegistered: true, isFunded: false, name: _name});
            registered = true;
        } else {
            //TODO: how to approach it? through vote system -> functions
            registered = false;
        }
        numAirlines = numAirlines + 1;
        return registered;
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
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
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
    * @dev Fallback function for funding smart contract.
    *
    */
    receive() external payable {
        fund(msg.sender);
    }
}

