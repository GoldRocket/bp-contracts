const moment = require("moment");

const SafeMath = artifacts.require("libraries/SafeMath");
const TournamentManager = artifacts.require("TournamentManager");
const BPCSmartTokenSale = artifacts.require("BPCSmartTokenSale");

module.exports = (deployer) => {
    deployer.deploy(SafeMath);

    deployer.link(SafeMath, BPCSmartTokenSale);

    deployer.deploy(TournamentManager);
    deployer.deploy(BPCSmartTokenSale, moment("2018-01-10T16:00:00Z").unix());
};
