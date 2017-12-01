const moment = require("moment");

const SafeMath = artifacts.require("libraries/SafeMath");
const TournamentManager = artifacts.require("TournamentManager");
const BPZSmartTokenSale = artifacts.require("BPZSmartTokenSale");

module.exports = (deployer) => {
    deployer.deploy(SafeMath);

    deployer.link(SafeMath, BPZSmartTokenSale);

    deployer.deploy(TournamentManager);
    deployer.deploy(BPZSmartTokenSale, moment("2018-01-10T16:00:00Z").unix());
};
