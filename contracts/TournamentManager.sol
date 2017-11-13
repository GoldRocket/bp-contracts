pragma solidity 0.4.18;

contract TournamentManager {
    struct Contest {
        bytes32 id;
        address[] entrants;
        mapping(address => bytes32) picks;
    }

    address owner;
    mapping(bytes32 => Contest) contests;
    bytes32[] contestIds;

    function TournamentManager() public {
        owner = msg.sender;
    }

    //////////////////////////////////////////////
    // Transactions
    //////////////////////////////////////////////

    function publishContest(bytes32 contestId) public {
        require(msg.sender == owner);
        require(isUnknownContestId(contestId));

        contestIds.push(contestId);
        contests[contestId].id = contestId;
    }

    function submitPick(bytes32 contestId, bytes32 pickHash, uint8 v, bytes32 r, bytes32 s) public {
        require(pickHash != 0);
        require(verifyPickSignature(pickHash, v, r, s));

        var contest = getContest(contestId);
        require(contest.picks[msg.sender] == 0);

        contest.picks[msg.sender] = pickHash;
        contest.entrants.push(msg.sender);
    }

    //////////////////////////////////////////////
    // Getter functions
    //////////////////////////////////////////////

    function getNumContests() public view returns (uint) {
        return contestIds.length;
    }

    function getContestId(uint index) public view returns (bytes32) {
        require(isValidIndex(contestIds.length, index));

        return contestIds[index];
    }

    function getNumContestEntries(bytes32 contestId) public view returns (uint) {
        var contest = getContest(contestId);

        return contest.entrants.length;
    }

    function getContestEntryForEntrant(bytes32 contestId, address entrant) public view returns (bytes32) {
        var contest = getContest(contestId);
        var pick = contest.picks[entrant];
        require(pick != 0); // This reflects that the entrant doesn't exist.

        return pick;
    }

    function getContestEntry(bytes32 contestId, uint index) public view returns (address, bytes32) {
        var contest = getContest(contestId);
        require(isValidIndex(contest.entrants.length, index));

        var entrant = contest.entrants[index];
        var pick = contest.picks[entrant];
        assert(pick != 0);  // This should never be possible.

        return (
            entrant,
            pick
        );
    }

    //////////////////////////////////////////////
    // Internal functions
    //////////////////////////////////////////////

    function getContest(bytes32 contestId) internal view returns (Contest storage) {
        require(contestId != 0);
        var contest = contests[contestId];
        
        require(contest.id == contestId);

        return contest;
    }

    function isUnknownContestId(bytes32 contestId) internal view returns (bool) {
        require(contestId != 0);

        return contests[contestId].id == 0;
    }

    function isValidIndex(uint arrayLength, uint index) internal pure returns (bool) {
        return index >= 0 && index < arrayLength;
    }

    function verifyPickSignature(bytes32 hash, uint8 v, bytes32 r, bytes32 s) internal view returns (bool) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHash = keccak256(prefix, hash);

        return ecrecover(prefixedHash, v, r, s) == owner;
    }
}
