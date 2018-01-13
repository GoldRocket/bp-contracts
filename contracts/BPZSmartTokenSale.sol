pragma solidity 0.4.18;

import "./common/BaseContract.sol";
import "./common/Owned.sol";
import "./common/TokenRetriever.sol";
import "./BPZSmartToken.sol";
import "./VestingManager.sol";

// solhint-disable not-rely-on-time

/// @title BPC Smart Token sale
contract BPZSmartTokenSale is BaseContract, Owned, TokenRetriever {
    using SafeMath for uint256;

    BPZSmartToken public bpz;
    VestingManager public vestingManager;

    uint256 public startTime = 0;
    uint256 public tokensPerEther = 25000;
    uint256 public tokensSold = 0;
    bool public isFinalized = false;
    mapping(address => uint256) public whitelist;
    mapping(address => uint256) public tokensPurchased;

    address public constant BLITZPREDICT_ADDRESS = 0x5Bf7300FA42dA87e4DA509f19A424379F570aE8c;
    address public constant FUTURE_HIRES_ADDRESS = 0xe4f14C37096C0086dCe359D124CF609a73823571;
    address public constant TEAM_ADDRESS = 0x04eDa37f4Dc2025c2FCE1CfaD65C0b2ac175AF0e;

    uint256 public constant DURATION = 31 days;

    uint256 public constant MAX_TOKENS = (10 ** 9) * (10 ** 18);
    uint256 public constant ONE_PERCENT = MAX_TOKENS / 100;
    uint256 public constant SEED_ROUND_TOKENS = 5 * ONE_PERCENT;
    uint256 public constant STRATEGIC_PARTNER_TOKENS = 8 * ONE_PERCENT;
    uint256 public constant ADVISOR_TOKENS = 5 * ONE_PERCENT;
    uint256 public constant LIQUIDITY_RESERVE_TOKENS = 5 * ONE_PERCENT;
    uint256 public constant FUTURE_HIRES_TOKENS = 9 * ONE_PERCENT;
    uint256 public constant TEAM_TOKENS = 18 * ONE_PERCENT;
    uint256 public constant BLITZPREDICT_TOKENS = 20 * ONE_PERCENT;
    uint256 public constant PRE_SALE_TOKENS = 15 * ONE_PERCENT;
    uint256 public constant TOKEN_SALE_TOKENS = 15 * ONE_PERCENT;

    event Whitelisted(address indexed _participant, uint256 _contributionLimit);
    event TokensPurchased(address indexed _to, uint256 _tokens);

    modifier onlyDuringSale() {
        require(tokensSold < TOKEN_SALE_TOKENS);
        require(now >= startTime);

        uint256 endTime = getEndTime();
        require(now < endTime);

        _;
    }

    modifier onlyBeforeSale() {
        require(now < startTime);

        _;
    }

    modifier onlyAfterSale() {
        bool allTokensSold = tokensSold >= TOKEN_SALE_TOKENS;
        uint256 endTime = getEndTime();
        bool afterEndTime = now >= endTime;

        require(allTokensSold || afterEndTime);

        _;
    }

    /// @dev Constructor that initializes the sale conditions.
    /// @param _startTime uint256 The start time of the token sale.
    function BPZSmartTokenSale(uint256 _startTime)
        public
        onlyIf(_startTime > now)
    {
        bpz = new BPZSmartToken();
        bpz.disableTransfers(true);
        startTime = _startTime;
    }

    /// @dev Fallback function -- just purchase tokens
    function ()
        external
        payable
    {
        purchaseTokens();
    }

    /// @dev Sets the number of BPZ that can be purchased for one ether
    function setTokensPerEther(uint256 _tokensPerEther)
        external
        onlyOwner
        onlyBeforeSale
    {
        tokensPerEther = _tokensPerEther;
    }

    /// @dev Adds or modifies items in the whitelist
    function updateWhitelist(address[] participants, uint256[] contributionLimits)
        external
        onlyOwner
        onlyIf(participants.length == contributionLimits.length)
    {
        for (uint256 i = 0; i < participants.length; ++i) {
            whitelist[participants[i]] = contributionLimits[i];
            Whitelisted(participants[i], contributionLimits[i]);
        }
    }

    /// @dev Finalizes the token sale event.
    function finalizeSale()
        external
        onlyAfterSale
        onlyOwner
        onlyIf(!isFinalized)
    {
        uint256 companyIssuedTokens = getCompanyIssuedTokens();
        uint256 vestingTokens = getVestingTokens();

        // Issue the immediate tokens to the company wallet
        bpz.issue(BLITZPREDICT_ADDRESS, companyIssuedTokens);

        // Grant vesting grants.
        vestingManager = new VestingManager(bpz);
        bpz.issue(vestingManager, vestingTokens);

        uint256 oneYear = now.add(1 years);
        uint256 twoYears = now.add(2 years);
        uint256 threeYears = now.add(3 years);

        vestingManager.grantTokens(FUTURE_HIRES_ADDRESS, FUTURE_HIRES_TOKENS, now, oneYear, threeYears);
        vestingManager.grantTokens(TEAM_ADDRESS, TEAM_TOKENS, now, oneYear, threeYears);
        vestingManager.grantTokens(BLITZPREDICT_ADDRESS, BLITZPREDICT_TOKENS, now, oneYear, twoYears);

        // Re-enable transfers after the token sale.
        bpz.disableTransfers(false);

        // Permanently disable issuance and destruction
        bpz.disableIssuance();
        bpz.disableDestruction();

        isFinalized = true;
    }

    /// @dev Proposes to transfer control of the BPZSmartToken contract to a new owner.
    /// @param newOwner address The address to transfer ownership to.
    ///
    /// Notes:
    ///   1. The new owner will need to call BPZSmartToken's acceptOwnership directly in order to accept the ownership.
    ///   2. Calling this method during the token sale will prevent the token sale to continue, since only the owner of
    ///      the BPZSmartToken contract can issue new tokens.
    ///    3. Due to #2, calling this method effectively pauses the token sale.
    function transferSmartTokenOwnership(address newOwner)
        external
        onlyOwner
    {
        bpz.transferOwnership(newOwner);
    }

    /// @dev Accepts new ownership on behalf of the BPZSmartToken contract. This can be used, by the token sale
    /// contract itself to claim back ownership of the BPZSmartToken contract.
    ///
    /// Notes:
    ///   1. This method must be called to "un-pause" the token sale after a call to transferSmartTokenOwnership
    function acceptSmartTokenOwnership()
        external
        onlyOwner
    {
        bpz.acceptOwnership();
    }

    /// @dev Proposes to transfer control of the VestingManager contract to a new owner.
    /// @param newOwner address The address to transfer ownership to.
    ///
    /// Notes:
    ///   1. The new owner will need to call VestingManager's acceptOwnership directly in order to accept the ownership.
    function transferVestingManagerOwnership(address newOwner)
        external
        onlyIf(isFinalized)
        onlyOwner
    {
        vestingManager.transferOwnership(newOwner);
    }

    /// @dev Accepts new ownership on behalf of the VestingManager contract.
    /// This can be used, by the token sale contract itself to claim back ownership of the VestingManager contract.
    function acceptVestingManagerOwnership()
        external
        onlyIf(isFinalized)
        onlyOwner
    {
        vestingManager.acceptOwnership();
    }

    function getCompanyIssuedTokens()
        public pure
        returns (uint256)
    {
        return 0 +
            SEED_ROUND_TOKENS +
            STRATEGIC_PARTNER_TOKENS +
            ADVISOR_TOKENS +
            LIQUIDITY_RESERVE_TOKENS +
            PRE_SALE_TOKENS;
    }

    function getVestingTokens()
        public pure
        returns (uint256)
    {
        return 0 +
            FUTURE_HIRES_TOKENS +
            TEAM_TOKENS +
            BLITZPREDICT_TOKENS;
    }

    function getEndTime()
        public view
        returns (uint256)
    {
        return startTime + DURATION;
    }

     /// @dev Create and sell tokens to the caller.
    function purchaseTokens()
        public
        payable
        onlyDuringSale
        greaterThanZero(msg.value)
    {
        uint256 purchaseLimit = whitelist[msg.sender].mul(tokensPerEther);
        uint256 purchaseLimitRemaining = purchaseLimit.sub(tokensPurchased[msg.sender]);
        require(purchaseLimitRemaining > 0);

        uint256 desiredTokens = msg.value.mul(tokensPerEther);
        uint256 desiredTokensCapped = SafeMath.min256(desiredTokens, purchaseLimitRemaining);
        uint256 tokensRemaining = TOKEN_SALE_TOKENS.sub(tokensSold);
        uint256 tokens = SafeMath.min256(desiredTokensCapped, tokensRemaining);
        uint256 contribution = tokens.div(tokensPerEther);

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
        tokensPurchased[msg.sender] = tokensPurchased[msg.sender].add(_tokens);

        bpz.issue(_recipient, _tokens);

        TokensPurchased(_recipient, _tokens);
    }
}
