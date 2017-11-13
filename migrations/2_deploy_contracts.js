const TournamentManager = artifacts.require("TournamentManager");

module.exports = (deployer) => {
    deployer.deploy(TournamentManager);
};
