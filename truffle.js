//const HDWalletProvider = require("@truffle/hdwallet-provider");
//const mnemonic = "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";

module.exports = {
  networks: {
    // start ganache cli with 20 accounts: ganache-cli --port=9545 -a 20
    // compile: truffle compile 
    // test: truffle test
    development: {
      host: "localhost",
      port: 9545,
      network_id: '*'
    }
  },
  compilers: {
    solc: {
      version: "^0.8.10"
    }
  }
};