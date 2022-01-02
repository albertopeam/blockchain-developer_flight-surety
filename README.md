# FlightSurety

FlightSurety is a sample application project for Udacity's Blockchain course.

## Install

This repository contains Smart Contract code in Solidity (using Truffle), tests (also using Truffle), dApp scaffolding (using HTML, CSS and JS) and server app scaffolding.

To install, download or clone the repo, then:

`npm install`
`truffle compile`

## Develop Client

To run truffle tests:

`truffle test ./test/flightSurety.js`
`truffle test ./test/oracles.js`

To use the dapp:

`truffle migrate`
`npm run dapp`

To view dapp:

`http://localhost:8000`

## Develop Server

`npm run server`
`truffle test ./test/oracles.js`

## Deploy

To build dapp for prod:
`npm run dapp:prod`

Deploy the contents of the ./dapp folder

## Resources

* [How does Ethereum work anyway?](https://medium.com/@preethikasireddy/how-does-ethereum-work-anyway-22d1df506369)
* [BIP39 Mnemonic Generator](https://iancoleman.io/bip39/)
* [Truffle Framework](http://truffleframework.com/)
* [Ganache Local Blockchain](http://truffleframework.com/ganache/)
* [Remix Solidity IDE](https://remix.ethereum.org/)
* [Solidity Language Reference](http://solidity.readthedocs.io/en/v0.4.24/)
* [Ethereum Blockchain Explorer](https://etherscan.io/)
* [Web3Js Reference](https://github.com/ethereum/wiki/wiki/JavaScript-API)

## Development

1. npm install
2. metamask connected to localhost 8545
3. ganache-cli --port=8545 --accounts 50 --defaultBalanceEther 10000
   ganache-cli --port=8545 --accounts 50 --defaultBalanceEther 10000 -g 100000000000
4. truffle console
   1. compile
   2. test
   3. migrate
5. npm run dapp
6. npm run server

## Info

[ganache cli](https://docs.nethereum.com/en/latest/ethereum-and-clients/ganache-cli/)

## Website

1. deploying contracts -> truffle migrate
   1. needed 10 eth for deployer/account[0] to be the first airline. check `deploy_contracts` script if needed. It will be printed in cli the address of the account
   2. it will write to config.json:
      1. url of node
      2. addresses of the contracts and firstAirline
2. starting the server -> npm run server
   1. at startup will register 20 oracles, each one consuming 1ether to be registered.