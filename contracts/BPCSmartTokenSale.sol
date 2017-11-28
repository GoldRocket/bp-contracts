pragma solidity 0.4.18;

import "./common/BaseContract.sol";
import "./common/Owned.sol";
import "./BPCSmartToken.sol";
import "./VestingManager.sol";

// solhint-disable not-rely-on-time

/// @title BPC Smart Token sale
contract BPCSmartTokenSale is BaseContract, Owned {
    using SafeMath for uint256;

    uint256 public constant DURATION = 14 days;

    bool public isFinalized = false;

    BPCSmartToken public bpc;
    VestingManager public vestingManager;

    uint256 public startTime = 0;
    uint256 public endTime = 0;

    uint256 public tokensSold = 0;

    // TODO: dacarley: Update with real addresses.
    address public constant BLITZPREDICT_ADDRESS = 0x1234567890123456789012345678901234567890;
    address public constant FUTURE_HIRES_ADDRESS = 0x1234567890123456789012345678901234567890;
    address public constant TEAM_ADDRESS = 0x1234567890123456789012345678901234567890;

    uint256 public constant MAX_TOKENS = (10 ** 9) * (10 ** 18);
    uint256 public constant ONE_PERCENT = MAX_TOKENS / 100;
    uint256 public constant SEED_ROUND_TOKENS = 5 * ONE_PERCENT;
    uint256 public constant STRATEGIC_PARTNER_TOKENS = 8 * ONE_PERCENT;
    uint256 public constant ADVISOR_TOKENS = 5 * ONE_PERCENT;
    uint256 public constant LIQUIDITY_RESERVE_TOKENS = 5 * ONE_PERCENT;
    uint256 public constant FUTURE_HIRES_TOKENS = 9 * ONE_PERCENT;
    uint256 public constant TEAM_TOKENS = 18 * ONE_PERCENT;
    uint256 public constant BLITZPREDICT_TOKENS = 20 * ONE_PERCENT;
    uint256 public constant TOKEN_SALE_TOKENS = 30 * ONE_PERCENT;

    uint256 public constant USD_CAP = 6 * 10**6;
    uint256 public constant BPC_USD_EXCHANGE_RATE = USD_CAP / TOKEN_SALE_TOKENS;
    uint256 public constant ETH_USD_EXCHANGE_RATE = 350;
    uint256 public constant ETH_BPC_EXCHANGE_RATE = ETH_USD_EXCHANGE_RATE / BPC_USD_EXCHANGE_RATE;

    event TokensPurchased(address indexed to, uint256 tokens);

    modifier onlyDuringSale() {
        require(tokensSold < TOKEN_SALE_TOKENS);
        require(now >= startTime);
        require(now < endTime);

        _;
    }

    modifier onlyAfterSale() {
        bool allTokensSold = tokensSold >= TOKEN_SALE_TOKENS;
        bool afterEndTime = now >= endTime;

        require(allTokensSold || afterEndTime);

        _;
    }

    /// @dev Constructor that initializes the sale conditions.
    /// @param _startTime uint256 The start time of the token sale.
    function BPCSmartTokenSale(uint256 _startTime)
        public
        onlyIf(_startTime > now)
    {
        assert(tokenCountsAreValid());

        bpc = new BPCSmartToken();
        startTime = _startTime;
        endTime = startTime + DURATION;
    }

    /// @dev Fallback function that will delegate the request to buy tokens.
    function ()
        external
        payable
        onlyDuringSale
    {
        purchaseTokens();
    }

    /// @dev Finalizes the token sale event.
    function finalize()
        external
        onlyAfterSale
        onlyOwner
        onlyIf(!isFinalized)
    {
        uint256 immediateTokens = 0 +
            SEED_ROUND_TOKENS +
            STRATEGIC_PARTNER_TOKENS +
            ADVISOR_TOKENS +
            LIQUIDITY_RESERVE_TOKENS;

        uint256 vestingTokens = 0 +
            FUTURE_HIRES_TOKENS +
            TEAM_TOKENS +
            BLITZPREDICT_TOKENS;

        assert(immediateTokens + vestingTokens + TOKEN_SALE_TOKENS == MAX_TOKENS);

        // Issue the immediate tokens to the company wallet
        bpc.issue(BLITZPREDICT_ADDRESS, immediateTokens);

        // Grant vesting grants.
        vestingManager = new VestingManager(bpc);
        bpc.issue(vestingManager, vestingTokens);

        uint256 oneYear = now.add(1 years);
        uint256 twoYears = now.add(2 years);
        uint256 fourYears = now.add(4 years);

        vestingManager.grantTokens(FUTURE_HIRES_ADDRESS, FUTURE_HIRES_TOKENS, oneYear, fourYears);
        vestingManager.grantTokens(TEAM_ADDRESS, TEAM_TOKENS, oneYear, fourYears);
        vestingManager.grantTokens(BLITZPREDICT_ADDRESS, BLITZPREDICT_TOKENS, oneYear, twoYears);

        // Re-enable transfers after the token sale.
        bpc.disableTransfers(false);

        isFinalized = true;
    }

    /// @dev Proposes to transfer control of the BPCSmartToken contract to a new owner.
    /// @param newOwner address The address to transfer ownership to.
    ///
    /// Notes:
    ///   1. The new owner will need to call BPCSmartToken's acceptOwnership directly in order to accept the ownership.
    ///   2. Calling this method during the token sale will prevent the token sale to continue, since only the owner of
    ///      the BPCSmartToken contract can issue new tokens.
    ///    3. Due to #2, calling this method effectively pauses the token sale.
    function transferSmartTokenOwnership(address newOwner)
        external
        onlyOwner
    {
        bpc.transferOwnership(newOwner);
    }

    /// @dev Accepts new ownership on behalf of the BPCSmartToken contract. This can be used, by the token sale
    /// contract itself to claim back ownership of the BPCSmartToken contract.
    ///
    /// Notes:
    ///   1. This method must be called to "un-pause" the token sale after a call to transferSmartTokenOwnership
    function acceptSmartTokenOwnership()
        external
        onlyOwner
    {
        bpc.acceptOwnership();
    }

    /// @dev Proposes to transfer control of the VestingManager contract to a new owner.
    /// @param newOwner address The address to transfer ownership to.
    ///
    /// Notes:
    ///   1. The new owner will need to call VestingManager's acceptOwnership directly in order to accept the ownership.
    function transferVestingManagerOwnership(address newOwner)
        external
        onlyAfterSale
        onlyOwner
    {
        vestingManager.transferOwnership(newOwner);
    }

    /// @dev Accepts new ownership on behalf of the VestingManager contract.
    /// This can be used, by the token sale contract itself to claim back ownership of the VestingManager contract.
    function acceptVestingManagerOwnership()
        external
        onlyAfterSale
        onlyOwner
    {
        vestingManager.acceptOwnership();
    }

    /// @dev Create and sell tokens to the caller.
    function purchaseTokens()
        public
        payable
        onlyDuringSale
        greaterThanZero(msg.value)
    {
        uint256 desiredTokens = msg.value.mul(ETH_BPC_EXCHANGE_RATE);
        uint256 tokensRemaining = TOKEN_SALE_TOKENS.sub(tokensSold);
        uint256 tokens = SafeMath.min256(desiredTokens, tokensRemaining);
        uint256 contribution = tokens.div(ETH_BPC_EXCHANGE_RATE);

        issuePurchasedTokens(msg.sender, tokens);
        BLITZPREDICT_ADDRESS.transfer(contribution);

        // Refund the msg.sender, in the case that not all of its ETH was used.
        // This can happen only when selling the last chunk of BPC.
        uint256 refund = msg.value.sub(contribution);
        if (refund > 0) {
            msg.sender.transfer(refund);
        }
    }

    /// @dev Issues tokens for the recipient.
    /// @param _recipient address The address of the recipient.
    /// @param _tokens uint256 The amount of tokens to issue.
    function issuePurchasedTokens(address _recipient, uint256 _tokens)
        private
    {
        tokensSold = tokensSold.add(_tokens);

        bpc.issue(_recipient, _tokens);

        TokensPurchased(_recipient, _tokens);
    }

    function tokenCountsAreValid()
        private
        pure
        returns (bool)
    {
        uint256 sum = 0 +
            SEED_ROUND_TOKENS +
            STRATEGIC_PARTNER_TOKENS +
            ADVISOR_TOKENS +
            LIQUIDITY_RESERVE_TOKENS +
            FUTURE_HIRES_TOKENS +
            TEAM_TOKENS +
            BLITZPREDICT_TOKENS +
            TOKEN_SALE_TOKENS;

        return sum == MAX_TOKENS;
    }
}
