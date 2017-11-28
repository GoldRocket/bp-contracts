pragma solidity 0.4.18;

import "./common/BaseContract.sol";
import "./common/Owned.sol";

contract TournamentManager is BaseContract, Owned {
    struct Contest {
        uint256 id;
        address[] entrants;
        mapping(address => bytes32) picks;
    }

    mapping(uint256 => Contest) private contests;
    uint256[] private contestIds;

    //////////////////////////////////////////////
    // Modifiers
    //////////////////////////////////////////////

    modifier validPick(bytes32 pickHash, uint8 v, bytes32 r, bytes32 s) {
        require(pickHash != 0);

        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHash = keccak256(prefix, pickHash);

        address signer = ecrecover(prefixedHash, v, r, s);
        
        require(signer == owner);

        _;
    }

    modifier onlyUnknownContestId(uint256 contestId) {
        require(contests[contestId].id == 0);

        _;
    }

    //////////////////////////////////////////////
    // Transactions
    //////////////////////////////////////////////

    function publishContest(uint256 contestId)
        external
        validParamData(1)
        onlyOwner
        nonZero(contestId)
        onlyUnknownContestId(contestId)
    {
        contestIds.push(contestId);
        contests[contestId].id = contestId;
    }

    function submitPick(uint256 contestId, bytes32 pickHash, uint8 v, bytes32 r, bytes32 s)
        external
        validParamData(5)
        validPick(pickHash, v, r, s)
    {
        var contest = getContest(contestId);
        require(contest.picks[msg.sender] == 0);

        contest.picks[msg.sender] = pickHash;
        contest.entrants.push(msg.sender);
    }

    //////////////////////////////////////////////
    // Getter functions
    //////////////////////////////////////////////

    function getNumContests()
        public view
        validParamData(0)
        returns (uint256)
    {
        return contestIds.length;
    }

    function getContestId(uint256 index)
        public view
        validParamData(1)
        validIndex(contestIds.length, index)
        returns (uint256)
    {
        return contestIds[index];
    }

    function getNumContestEntries(uint256 contestId)
        public view
        validParamData(1)
        returns (uint256)
    {
        var contest = getContest(contestId);

        return contest.entrants.length;
    }

    function getContestEntry(uint256 contestId, uint256 index)
        public view
        validParamData(2)
        returns (address, bytes32)
    {
        var contest = getContest(contestId);
        requireValidIndex(contest.entrants.length, index);

        var entrant = contest.entrants[index];
        var pick = contest.picks[entrant];
        assert(pick != 0);  // This should never be possible.

        return (
            entrant,
            pick
        );
    }

    function getContestEntryForEntrant(uint256 contestId, address entrant)
        public view
        validParamData(2)
        returns (bytes32)
    {
        var contest = getContest(contestId);
        var pick = contest.picks[entrant];
        require(pick != 0); // This reflects that the entrant doesn't exist.

        return pick;
    }

    //////////////////////////////////////////////
    // Internal functions
    //////////////////////////////////////////////

    function getContest(uint256 contestId)
        internal view
        nonZero(contestId)
        returns (Contest storage)
    {
        var contest = contests[contestId];
        
        require(contest.id == contestId);

        return contest;
    }
}
