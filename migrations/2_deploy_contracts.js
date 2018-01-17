const moment = require("moment");

const SafeMath = artifacts.require("libraries/SafeMath");
const BPZSmartTokenSale = artifacts.require("BPZSmartTokenSale");

const tokenSaleStart = moment("2018-01-22T08:00:00.000-08:00").unix();

module.exports = (deployer) => {
    deployer.deploy(SafeMath);

    deployer.link(SafeMath, BPZSmartTokenSale);
    deployer.deploy(BPZSmartTokenSale, tokenSaleStart);
};
