pragma solidity 0.4.18;

import "./common/Owned.sol";
import "./common/SafeMath.sol";
import "./BPZSmartToken.sol";

// solhint-disable not-rely-on-time

contract VestingManager is BaseContract, Owned {
    using SafeMath for uint256;

    // The BPZ smart token instance
    BPZSmartToken public bpz;

    struct Grant {
        uint256 value;
        uint256 start;
        uint256 cliff;
        uint256 end;
        uint256 claimed;
    }

    mapping (address => Grant) public grants;

    // Total tokens available for vesting.
    uint256 public totalVesting;

    event TokensGranted(address indexed from, address indexed to, uint256 value);
    event VestedTokensClaimed(address indexed holder, uint256 value);
    event GrantRevoked(address indexed holder, uint256 refund);

    /// @dev Constructor that initializes the address of the BPZSmartToken contract.
    /// @param _bpc BPZSmartToken The address of the previously deployed BPZSmartToken smart contract.
    function VestingManager(BPZSmartToken _bpc)
        public
    {
        require(_bpc != address(0));

        bpz = _bpc;
    }

    /// @dev Grant tokens to a specified address.
    /// @param _to address The address to grant tokens to.
    /// @param _value uint256 The amount of tokens to be granted.
    /// @param _cliff uint256 The end of the cliff period.
    /// @param _end uint256 The end of the vesting period.
    function grantTokens(address _to, uint256 _value, uint256 _start, uint256 _cliff, uint256 _end)
        public
        onlyOwner
        validAddress(_to)
        greaterThanZero(_value)
        onlyIf(_start <= _cliff)
        onlyIf(_cliff <= _end)
        isZero(grants[_to].value)
    {
        // Check that we have enough BPZ balance to manage this grant.
        totalVesting = totalVesting.add(_value);
        require(totalVesting <= bpz.balanceOf(address(this)));

        grants[_to] = Grant({
            value: _value,
            start: _start,
            cliff: _cliff,
            end: _end,
            claimed: 0
        });

        TokensGranted(msg.sender, _to, _value);
    }

    /// @dev Revoke the grant of tokens of a specifed address.
    /// @param _holder The address which will have its tokens revoked.
    function revokeGrant(address _holder)
        public
        onlyOwner
        greaterThanZero(grants[_holder].value)
    {
        Grant storage grant = grants[_holder];

        // Send the remaining BPZ back to the owner.
        uint256 refund = grant.value.sub(grant.claimed);

        // Remove the grant.
        delete grants[_holder];

        totalVesting = totalVesting.sub(refund);
        bpz.transfer(owner, refund);

        GrantRevoked(_holder, refund);
    }

    /// @dev Calculate the total amount of vested tokens of a holder at a given time.
    /// @param _holder address The address of the holder.
    /// @param _time uint256 The specific time.
    /// @return a uint256 representing a holder's total amount of vested tokens.
    function getVestedTokens(address _holder, uint256 _time)
        public view
        returns (uint256)
    {
        Grant storage grant = grants[_holder];
        if (grant.value == 0) {
            return 0;
        }

        return calculateVestedTokens(grant, _time);
    }

    function getClaimableTokens(address _holder, uint256 _time)
        public view
        returns (uint256)
    {
        Grant storage grant = grants[_holder];
        if (grant.value == 0) {
            return 0;
        }

        uint256 vested = calculateVestedTokens(grant, _time);
        uint256 claimable = vested.sub(grant.claimed);

        return claimable;
    }

    /// @dev Claim vested tokens by transferring them to their holder.
    /// @return a uint256 representing the amount of vested tokens transferred to their holder.
    function claimVestedTokens()
        public
        returns (uint256)
    {
        uint256 claimable = getClaimableTokens(msg.sender, now);

        if (claimable == 0) {
            return 0;
        }

        Grant storage grant = grants[msg.sender];
        grant.claimed = grant.claimed.add(claimable);
        totalVesting = totalVesting.sub(claimable);
        bpz.transfer(msg.sender, claimable);

        VestedTokensClaimed(msg.sender, claimable);

        return claimable;
    }

    /// @dev Calculate amount of vested tokens at a specifc time.
    /// @param _grant Grant The vesting grant.
    /// @param _time uint256 The time to be checked
    /// @return A uint256 representing the amount of vested tokens of a specific grant.
    ///   |                         _/--------   vestedTokens rect
    ///   |                       _/
    ///   |                     _/
    ///   |                   _/
    ///   |                 _/
    ///   |                /
    ///   |              .|
    ///   |            .  |
    ///   |          .    |
    ///   |        .      |
    ///   |      .        |
    ///   |    .          |
    ///   +===+===========+---------+----------> time
    ///     Start       Cliff      End
    function calculateVestedTokens(Grant _grant, uint256 _time)
        private pure
        returns (uint256)
    {
        if (_time < _grant.cliff) {
            return 0;
        }

        if (_time >= _grant.end) {
            return _grant.value;
        }

        // Interpolate all vested tokens.
        // vestedTokens = tokens * (time - start) / (end - start)
        uint256 elapsed = _time.sub(_grant.start);
        uint256 duration = _grant.end.sub(_grant.start);
        uint256 vestedTokens = _grant.value.mul(elapsed).div(duration);

        return vestedTokens;
    }
}
