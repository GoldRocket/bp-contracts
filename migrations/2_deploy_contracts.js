const moment = require("moment");

const SafeMath = artifacts.require("libraries/SafeMath");
const BPZSmartTokenSale = artifacts.require("BPZSmartTokenSale");

module.exports = (deployer) => {
    deployer.deploy(SafeMath);

    deployer.link(SafeMath, BPZSmartTokenSale);
    deployer.deploy(BPZSmartTokenSale, moment().add(1, "day").unix());
};
