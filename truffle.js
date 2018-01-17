require("babel-register");
const HDWalletProvider = require("truffle-hdwallet-provider");

const mnemonicKey = "BLITZPREDICT_TOKENSALE_MNEMONIC";
const accessTokenKey = "INFURA_ACCESS_TOKEN";

const gasLimit = 4 * 1000 * 1000; // The BPZSmartTokenSale contract requires aprox 3.7 mil
const gwei = 1000 * 1000 * 1000;
const gasPrice = 10 * gwei;

module.exports = {
    // See <http://truffleframework.com/docs/advanced/configuration>
    // to customize your Truffle configuration!

    networks: {
        live: {
            provider: () => createInfuraProvider("mainnet"),
            network_id: 1,
            gas: gasLimit,
            gasPrice
        },

        ropsten: {
            provider: () => createInfuraProvider("ropsten"),
            network_id: 3,
            gas: gasLimit,
            gasPrice
        }
    },

    solc: {
        optimizer: {
            enabled: true,
            runs: 200
        }
    }
};

function createInfuraProvider(network) {
    const mnemonic = process.env[mnemonicKey];
    const accessToken = process.env[accessTokenKey];

    if (!mnemonic || !accessToken) {
        // eslint-disable-next-line no-console
        console.error(`Env vars ${mnemonicKey} and ${accessTokenKey} must be set!`);
        process.exit();
    }

    return new HDWalletProvider(mnemonic, `https://${network}.infura.io/${accessToken}`);
}
