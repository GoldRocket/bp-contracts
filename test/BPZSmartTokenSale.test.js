import _ from "lodash";
import moment from "moment";
import utils from "./utils";
import ownedTests from "./ownedTests.js";

const BPZSmartToken = artifacts.require("./BPZSmartToken.sol");
const BPZSmartTokenSale = artifacts.require("./BPZSmartTokenSale.sol");
const BPZSmartTokenSaleTestHarness = artifacts.require("./BPZSmartTokenSaleTestHarness.sol");
const BPZSmartTokenSaleTestHarnessForFallback = artifacts.require("./BPZSmartTokenSaleTestHarnessForFallback.sol");
const VestingManager = artifacts.require("./VestingManager.sol");

const solidityYears = 365 * 24 * 60 * 60;

contract("BPZSmartTokenSale:", (accounts) => {
    let testHarness;
    let tokenSale;

    beforeEach(async () => {
        testHarness = await BPZSmartTokenSaleTestHarness.new(moment().add(1, "minute").unix());
        tokenSale = BPZSmartTokenSale.at(testHarness.address);
    });

    describe("token counts", () => {
        it("should add up to MAX_TOKENS", async () => {
            const MAX_TOKENS = await tokenSale.MAX_TOKENS();
            const SEED_ROUND_TOKENS = await tokenSale.SEED_ROUND_TOKENS();
            const STRATEGIC_PARTNER_TOKENS = await tokenSale.STRATEGIC_PARTNER_TOKENS();
            const ADVISOR_TOKENS = await tokenSale.ADVISOR_TOKENS();
            const LIQUIDITY_RESERVE_TOKENS = await tokenSale.LIQUIDITY_RESERVE_TOKENS();
            const FUTURE_HIRES_TOKENS = await tokenSale.FUTURE_HIRES_TOKENS();
            const TEAM_TOKENS = await tokenSale.TEAM_TOKENS();
            const BLITZPREDICT_TOKENS = await tokenSale.BLITZPREDICT_TOKENS();
            const PRE_SALE_TOKENS = await tokenSale.PRE_SALE_TOKENS();
            const TOKEN_SALE_TOKENS = await tokenSale.TOKEN_SALE_TOKENS();

            const total = SEED_ROUND_TOKENS
                .add(STRATEGIC_PARTNER_TOKENS)
                .add(ADVISOR_TOKENS)
                .add(LIQUIDITY_RESERVE_TOKENS)
                .add(FUTURE_HIRES_TOKENS)
                .add(TEAM_TOKENS)
                .add(BLITZPREDICT_TOKENS)
                .add(PRE_SALE_TOKENS)
                .add(TOKEN_SALE_TOKENS);

            assert.equal(web3.toDecimal(total), web3.toDecimal(MAX_TOKENS));
        });

        it("should be correct for issued, vesting, sold", async () => {
            const companyIssuedTokens = await tokenSale.getCompanyIssuedTokens();
            const vestingTokens = await tokenSale.getVestingTokens();
            const TOKEN_SALE_TOKENS = await tokenSale.TOKEN_SALE_TOKENS();
            const MAX_TOKENS = await tokenSale.MAX_TOKENS();

            const total = companyIssuedTokens
                .add(vestingTokens)
                .add(TOKEN_SALE_TOKENS);

            assert.equal(web3.toDecimal(total), web3.toDecimal(MAX_TOKENS));
        });
    });

    describe("constructor()", () => {
        it("should fail if the start time is not specified", async () => {
            const promise = BPZSmartTokenSale.new();
            await utils.expectInvalidOpcode(promise);
        });

        it("should fail if the start time is before 'now'", async () => {
            const promise = BPZSmartTokenSale.new(moment().subtract(1, "second").unix());
            await utils.expectInvalidOpcode(promise);
        });

        it("should succeed if the start time is after 'now'", async () => {
            const startTime = moment().add(1, "second").unix();
            const instance = await BPZSmartTokenSale.new(startTime);

            const duration = web3.toDecimal(await instance.DURATION());
            const expectedEndTime = startTime + duration;

            assert.notEqual(await instance.bpz(), "0x0");
            assert.equal(await instance.startTime(), startTime);
            assert.equal(await instance.getEndTime(), expectedEndTime);
        });

        it("should configure the BPZ token to disable transfers", async () => {
            const startTime = moment().add(1, "second").unix();
            const instance = await BPZSmartTokenSale.new(startTime);
            const bpz = BPZSmartToken.at(await instance.bpz());

            assert.isFalse(await bpz.transfersEnabled());
        });
    });

    describe("fallback function", () => {
        it("should call purchaseTokens", async () => {
            const harness = await BPZSmartTokenSaleTestHarnessForFallback.new(moment().add(1, "minute").unix());

            await harness.send(web3.toWei(1, "ether"), {
                from: accounts[1]
            });
            const purchaseTokensCalled = await harness.purchaseTokensCalled();

            assert.isTrue(purchaseTokensCalled);
        });
    });

    describe("setTokensPerEther()", () => {
        it("should throw if the sale has already started", async () => {
            await testHarness.forceSaleStart();

            const promise = tokenSale.setTokensPerEther(1);
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if called by anyone but the owner", async () => {
            const promise = tokenSale.setTokensPerEther(1, {
                from: accounts[1]
            });
            await utils.expectInvalidOpcode(promise);
        });

        it("should set the number of tokens that can be purchased for one ether", async () => {
            await tokenSale.setTokensPerEther(1);
            let tokensPerEther = await tokenSale.tokensPerEther();
            assert.equal(tokensPerEther, 1);

            await tokenSale.setTokensPerEther(100);
            tokensPerEther = await tokenSale.tokensPerEther();
            assert.equal(tokensPerEther, 100);
        });
    });

    describe("updateWhitelist()", () => {
        it("should throw if participants has nothing, and contributionLimits has something.", async () => {
            const promise = tokenSale.updateWhitelist([], [1]);
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if participants has something, and contributionLimits has nothing", async () => {
            const promise = tokenSale.updateWhitelist([accounts[0]], []);
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if participants has one and contributionLimits has two", async () => {
            const promise = tokenSale.updateWhitelist([accounts[0]], [1, 2]);
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if called by anyone but the owner", async () => {
            const promise = tokenSale.updateWhitelist([accounts[0]], [1], {
                from: accounts[1]
            });
            await utils.expectInvalidOpcode(promise);
        });

        it("should update the whitelist correctly with one participant and one contributionLimit", async () => {
            await tokenSale.updateWhitelist([accounts[0]], [1]);

            const contributionLimit = web3.toDecimal(await tokenSale.whitelist(accounts[0]));

            assert.equal(contributionLimit, 1);
        });

        it("should update the whitelist correctly with many participants and contributionLimits", async () => {
            const contributionLimits = _.map(accounts, (_account, n) => n);
            await tokenSale.updateWhitelist(accounts, contributionLimits);

            const actualContributionLimits = await Promise.all(_.map(accounts, account => tokenSale.whitelist(account)));

            _.each(accounts, (_account, n) => {
                assert.equal(actualContributionLimits[n], contributionLimits[n]);
            });
        });

        it("should fire the Whitelisted event for one participant", async () => {
            await tokenSale.updateWhitelist([accounts[0]], [1]);

            await expectWhitelistedEvent(accounts[0], 1);
        });

        it("should fire the Whitelisted event for many participants", async () => {
            const contributionLimits = _.map(accounts, (_account, n) => n);
            await tokenSale.updateWhitelist(accounts, contributionLimits);

            await Promise.all(_.each(accounts, async (account, n) => {
                await expectWhitelistedEvent(account, n, { logIndex: n });
            }));
        });
    });

    describe("finalizeSale()", () => {
        it("should throw if called before the sale is complete", async () => {
            const promise = tokenSale.finalizeSale();
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if called by anyone but the owner", async () => {
            await buyAllTokens();
            const promise = tokenSale.finalizeSale({ from: accounts[1] });
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if called more than once", async () => {
            await buyAllTokens();
            await tokenSale.finalizeSale();

            const promise = tokenSale.finalizeSale();
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if the token sale no longer owns the token", async () => {
            const bpz = BPZSmartToken.at(await tokenSale.bpz());

            await buyAllTokens();
            await tokenSale.transferSmartTokenOwnership(accounts[1]);
            await bpz.acceptOwnership({
                from: accounts[1]
            });

            const promise = tokenSale.finalizeSale();
            await utils.expectInvalidOpcode(promise);
        });

        it("should issue the right number of tokens to the company", async () => {
            const bpz = BPZSmartToken.at(await tokenSale.bpz());

            await buyAllTokens();
            await tokenSale.finalizeSale();

            const companyAddress = await tokenSale.BLITZPREDICT_ADDRESS();
            const companyBalance = web3.toDecimal(await bpz.balanceOf(companyAddress));
            const expectedCompanyBalance = web3.toDecimal(await tokenSale.getCompanyIssuedTokens());
            assert.equal(companyBalance, expectedCompanyBalance);
        });

        it("should issue the right number of tokens to vesting manager", async () => {
            const bpz = BPZSmartToken.at(await tokenSale.bpz());

            await buyAllTokens();
            await tokenSale.finalizeSale();

            const vestingManager = VestingManager.at(await tokenSale.vestingManager());

            const vestingManagerBalance = web3.toDecimal(await bpz.balanceOf(vestingManager.address));
            const expectedVestingManagerBalance = web3.toDecimal(await tokenSale.getVestingTokens());
            assert.equal(vestingManagerBalance, expectedVestingManagerBalance);
        });

        it("should grant the vesting tokens correctly", async () => {
            await buyAllTokens();
            const transaction = await tokenSale.finalizeSale();
            const block = web3.eth.getBlock(transaction.receipt.blockNumber);

            const vestingManager = VestingManager.at(await tokenSale.vestingManager());

            await verifyGrant({
                name: "Future Hires",
                block,
                vestingManager,
                address: await tokenSale.FUTURE_HIRES_ADDRESS(),
                tokens: await tokenSale.FUTURE_HIRES_TOKENS(),
                cliff: 1 * solidityYears,
                end: 3 * solidityYears
            });

            await verifyGrant({
                name: "Team",
                block,
                vestingManager,
                address: await tokenSale.TEAM_ADDRESS(),
                tokens: await tokenSale.TEAM_TOKENS(),
                cliff: 1 * solidityYears,
                end: 3 * solidityYears
            });

            await verifyGrant({
                name: "Company",
                block,
                vestingManager,
                address: await tokenSale.BLITZPREDICT_ADDRESS(),
                tokens: await tokenSale.BLITZPREDICT_TOKENS(),
                cliff: 1 * solidityYears,
                end: 2 * solidityYears
            });
        });

        it("should enable transfers on the token", async () => {
            const bpz = BPZSmartToken.at(await tokenSale.bpz());
            assert.isFalse(await bpz.transfersEnabled());

            await buyAllTokens();
            await tokenSale.finalizeSale();

            assert.isTrue(await bpz.transfersEnabled());
        });

        it("should disable issuance and destruction of the token", async () => {
            const bpz = BPZSmartToken.at(await tokenSale.bpz());
            assert.isTrue(await bpz.issuanceEnabled());
            assert.isTrue(await bpz.destructionEnabled());

            await buyAllTokens();
            await tokenSale.finalizeSale();

            assert.isFalse(await bpz.issuanceEnabled());
            assert.isFalse(await bpz.destructionEnabled());
        });

        async function verifyGrant(params) {
            const rawGrant = await params.vestingManager.grants(params.address);
            const grant = {
                value: web3.toDecimal(rawGrant[0]),
                start: web3.toDecimal(rawGrant[1]),
                cliff: web3.toDecimal(rawGrant[2]),
                end: web3.toDecimal(rawGrant[3]),
                claimed: web3.toDecimal(rawGrant[4])
            };

            const expectedStart = params.block.timestamp;
            const expectedCliff = moment.unix(expectedStart).add(params.cliff * 1000).unix();
            const expectedEnd = moment.unix(expectedStart).add(params.end * 1000).unix();

            assert.equal(grant.value, params.tokens, `${params.name} tokens doesn't match`);
            assert.equal(grant.start, expectedStart, `${params.name} start doesn't match`);
            assert.equal(grant.cliff, expectedCliff, `${params.name} cliff doesn't match`);
            assert.equal(grant.end, expectedEnd, `${params.name} end doesn't match`);
            assert.equal(grant.claimed, 0, `${params.name} claimed doesn't match`);
        }
    });

    describe("transferSmartTokenOwnership()", () => {
        it("should throw if called by anyone but the owner", async () => {
            const promise = tokenSale.transferSmartTokenOwnership(accounts[2], {
                from: accounts[1]
            });
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if the token ownership has already been transferred", async () => {
            await tokenSale.transferSmartTokenOwnership(accounts[1]);

            const bpz = BPZSmartToken.at(await tokenSale.bpz());
            await bpz.acceptOwnership({
                from: accounts[1]
            });

            const promise = tokenSale.transferSmartTokenOwnership(accounts[2]);
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if attempting to transfer ownership to the token sale", async () => {
            const promise = tokenSale.transferSmartTokenOwnership(tokenSale.address);
            await utils.expectInvalidOpcode(promise);
        });

        it("should allow a complete transfer of ownership", async () => {
            await tokenSale.transferSmartTokenOwnership(accounts[1]);

            const bpz = BPZSmartToken.at(await tokenSale.bpz());
            await bpz.acceptOwnership({
                from: accounts[1]
            });

            assert.equal(await bpz.owner(), accounts[1]);
        });

        it("should allow a second transfer if the first one has not yet been accepted", async () => {
            await tokenSale.transferSmartTokenOwnership(accounts[1]);
            await tokenSale.transferSmartTokenOwnership(accounts[2]);

            const bpz = BPZSmartToken.at(await tokenSale.bpz());
            await bpz.acceptOwnership({
                from: accounts[2]
            });

            assert.equal(await bpz.owner(), accounts[2]);
        });
    });

    describe("acceptSmartTokenOwnership()", () => {
        it("should throw if called by anyone other than the owner", async () => {
            const promise = tokenSale.acceptSmartTokenOwnership({
                from: accounts[1]
            });
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if token sale is already the owner", async () => {
            const promise = tokenSale.acceptSmartTokenOwnership();
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if the transfer has not yet been scheduled", async () => {
            await tokenSale.transferSmartTokenOwnership(accounts[1]);

            const bpz = BPZSmartToken.at(await tokenSale.bpz());
            await bpz.acceptOwnership({
                from: accounts[1]
            });

            const promise = tokenSale.acceptSmartTokenOwnership();
            await utils.expectInvalidOpcode(promise);
        });

        it("should successfully accept ownership", async () => {
            await tokenSale.transferSmartTokenOwnership(accounts[1]);

            const bpz = BPZSmartToken.at(await tokenSale.bpz());
            await bpz.acceptOwnership({
                from: accounts[1]
            });

            await bpz.transferOwnership(tokenSale.address, {
                from: accounts[1]
            });

            await tokenSale.acceptSmartTokenOwnership();

            assert.equal(await bpz.owner(), tokenSale.address);
        });
    });

    describe("transferVestingManagerOwnership()", () => {
        it("should throw if the sale is not yet finalized", async () => {
            const promise = tokenSale.transferVestingManagerOwnership(accounts[1]);
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if called by anyone but the owner", async () => {
            await finalizeSale();
            const promise = tokenSale.transferVestingManagerOwnership(accounts[2], {
                from: accounts[1]
            });
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if the vesting manager ownership has already been transferred", async () => {
            await finalizeSale();
            await tokenSale.transferVestingManagerOwnership(accounts[1]);

            const vestingManager = VestingManager.at(await tokenSale.vestingManager());
            await vestingManager.acceptOwnership({
                from: accounts[1]
            });

            assert.equal(await vestingManager.owner(), accounts[1]);

            const promise = tokenSale.transferVestingManagerOwnership(accounts[1]);
            await utils.expectInvalidOpcode(promise);
        });

        it("should allow a complete transfer of ownership", async () => {
            await finalizeSale();
            await tokenSale.transferVestingManagerOwnership(accounts[1]);

            const vestingManager = VestingManager.at(await tokenSale.vestingManager());
            await vestingManager.acceptOwnership({
                from: accounts[1]
            });

            assert.equal(await vestingManager.owner(), accounts[1]);
        });

        it("should allow a second transfer if the first one has not yet been accepted", async () => {
            await finalizeSale();
            await tokenSale.transferVestingManagerOwnership(accounts[1]);
            await tokenSale.transferVestingManagerOwnership(accounts[2]);

            const vestingManager = VestingManager.at(await tokenSale.vestingManager());
            await vestingManager.acceptOwnership({
                from: accounts[2]
            });

            assert.equal(await vestingManager.owner(), accounts[2]);
        });
    });

    describe("acceptVestingManagerOwnership()", () => {
        it("should throw if the sale has not yet been finalized", async () => {
            const promise = tokenSale.acceptVestingManagerOwnership();
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if called by anyone other than the owner", async () => {
            await finalizeSale();
            const promise = tokenSale.acceptVestingManagerOwnership({
                from: accounts[1]
            });
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if the transfer has not yet been scheduled", async () => {
            await finalizeSale();
            await tokenSale.transferVestingManagerOwnership(accounts[1]);

            const vestingManager = VestingManager.at(await tokenSale.vestingManager());
            await vestingManager.acceptOwnership({
                from: accounts[1]
            });

            assert.equal(await vestingManager.owner(), accounts[1]);

            const promise = tokenSale.acceptVestingManagerOwnership();
            await utils.expectInvalidOpcode(promise);
        });

        it("should successfully accept ownership", async () => {
            await finalizeSale();
            await tokenSale.transferVestingManagerOwnership(accounts[1]);

            const vestingManager = VestingManager.at(await tokenSale.vestingManager());
            await vestingManager.acceptOwnership({
                from: accounts[1]
            });

            assert.equal(await vestingManager.owner(), accounts[1]);

            await vestingManager.transferOwnership(tokenSale.address, {
                from: accounts[1]
            });

            await tokenSale.acceptVestingManagerOwnership();

            assert.equal(await vestingManager.owner(), tokenSale.address);
        });
    });

    describe("getCompanyIssuedTokens()", () => {
        it("should return the number of tokens to be issued to the company", async () => {
            const seedRoundTokens = web3.toDecimal(await tokenSale.SEED_ROUND_TOKENS());
            const strategicPartnerTokens = web3.toDecimal(await tokenSale.STRATEGIC_PARTNER_TOKENS());
            const advisorTokens = web3.toDecimal(await tokenSale.ADVISOR_TOKENS());
            const liquidityReserveTokens = web3.toDecimal(await tokenSale.LIQUIDITY_RESERVE_TOKENS());
            const preSaleTokens = web3.toDecimal(await tokenSale.PRE_SALE_TOKENS());

            const expected = seedRoundTokens + strategicPartnerTokens + advisorTokens + liquidityReserveTokens + preSaleTokens;
            const actual = web3.toDecimal(await tokenSale.getCompanyIssuedTokens());

            assert.equal(actual, expected);
        });
    });

    describe("getVestingTokens()", () => {
        it("should return the number of tokens to be transferred to the vesting mananger", async () => {
            const futureHiresTokens = web3.toDecimal(await tokenSale.FUTURE_HIRES_TOKENS());
            const teamTokens = web3.toDecimal(await tokenSale.TEAM_TOKENS());
            const blitzPredictTokens = web3.toDecimal(await tokenSale.BLITZPREDICT_TOKENS());

            const expected = futureHiresTokens + teamTokens + blitzPredictTokens;
            const actual = web3.toDecimal(await tokenSale.getVestingTokens());

            assert.equal(actual, expected);
        });
    });

    describe("getEndTime()", () => {
        it("should return the ending timestamp of the sale", async () => {
            const startTime = web3.toDecimal(await tokenSale.startTime());
            const duration = web3.toDecimal(await tokenSale.DURATION());
            const expectedEndTime = startTime + duration;

            assert.equal(await tokenSale.getEndTime(), expectedEndTime);
        });
    });

    describe("purchaseTokens()", () => {
        const oneHundredInWei = web3.toWei(100, "ether");

        beforeEach(async () => {
            await tokenSale.setTokensPerEther(100);
            await tokenSale.updateWhitelist(
                [accounts[1], accounts[2]],
                [web3.toWei(100, "ether"), web3.toWei(100, "ether")]
            );
        });

        it("should throw if the sale has not yet started", async () => {
            const promise = tokenSale.purchaseTokens({
                from: accounts[1],
                value: web3.toWei(1, "ether")
            });
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if the sale is already over", async () => {
            await buyAllTokens();
            const promise = tokenSale.purchaseTokens({
                from: accounts[1],
                value: web3.toWei(1, "ether")
            });
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if the transaction includes no ether", async () => {
            await testHarness.forceSaleStart();
            const promise = tokenSale.purchaseTokens({
                from: accounts[1]
            });
            await utils.expectInvalidOpcode(promise);
        });

        it("should increment the total number of tokens sold", async () => {
            await testHarness.forceSaleStart();

            let tokensSold = web3.toDecimal(await tokenSale.tokensSold());
            assert.equal(tokensSold, 0);

            await tokenSale.purchaseTokens({
                from: accounts[1],
                value: web3.toWei(1, "ether")
            });

            tokensSold = web3.toDecimal(await tokenSale.tokensSold());
            assert.equal(tokensSold, oneHundredInWei);
        });

        it("should increment the total number of tokens purchased by the contributor", async () => {
            await testHarness.forceSaleStart();

            const tokensPurchasedBefore = web3.toDecimal(await tokenSale.tokensPurchased(accounts[1]));
            assert.equal(tokensPurchasedBefore, 0);

            await tokenSale.purchaseTokens({
                from: accounts[1],
                value: web3.toWei(1, "ether")
            });

            const tokensPurchasedAfter = web3.toDecimal(await tokenSale.tokensPurchased(accounts[1]));
            assert.equal(tokensPurchasedAfter, oneHundredInWei);

            await tokenSale.purchaseTokens({
                from: accounts[1],
                value: web3.toWei(1, "ether")
            });

            const tokensPurchasedAfter2 = web3.toDecimal(await tokenSale.tokensPurchased(accounts[1]));
            assert.equal(tokensPurchasedAfter2, oneHundredInWei * 2);
        });

        it("should issue the full number of tokens to the purchaser", async () => {
            await testHarness.forceSaleStart();

            await tokenSale.purchaseTokens({
                from: accounts[1],
                value: web3.toWei(1, "ether")
            });

            const bpz = BPZSmartToken.at(await tokenSale.bpz());
            const balance = web3.toDecimal(await bpz.balanceOf(accounts[1]));

            assert.equal(balance, oneHundredInWei);
        });

        it("should fire the TokensPurchased event", async () => {
            await testHarness.forceSaleStart();

            await tokenSale.purchaseTokens({
                from: accounts[1],
                value: web3.toWei(1, "ether")
            });

            await expectTokensPurchasedEvent(accounts[1], oneHundredInWei);
        });

        it("should issue only the remaining tokens for the last purchase in the sale", async () => {
            const tokenSaleTokensInWei = await tokenSale.TOKEN_SALE_TOKENS();
            const tokenSaleTokens = web3.fromWei(tokenSaleTokensInWei, "ether");
            await tokenSale.setTokensPerEther(tokenSaleTokens.sub(100));
            await testHarness.forceSaleStart();

            await tokenSale.purchaseTokens({
                from: accounts[1],
                value: web3.toWei(1, "ether")
            });

            await tokenSale.purchaseTokens({
                from: accounts[2],
                value: web3.toWei(1, "ether")
            });

            const bpz = BPZSmartToken.at(await tokenSale.bpz());
            const balance = web3.toDecimal(await bpz.balanceOf(accounts[2]));

            assert.equal(balance, oneHundredInWei);
        });

        it("should refund excess ether on the last purchase in the sale", async () => {
            const bpz = BPZSmartToken.at(await tokenSale.bpz());

            const tokenSaleTokensInWei = await tokenSale.TOKEN_SALE_TOKENS();
            const tokenSaleTokens = web3.fromWei(tokenSaleTokensInWei, "ether");
            const tokensPerEther = tokenSaleTokens.sub(100);
            await tokenSale.setTokensPerEther(tokensPerEther);
            await testHarness.forceSaleStart();

            await tokenSale.updateWhitelist(
                [accounts[1], accounts[2]],
                [web3.toWei(100, "ether"), web3.toWei(100, "ether")]
            );

            const account1BalanceBefore = web3.eth.getBalance(accounts[1]);
            await tokenSale.purchaseTokens({
                from: accounts[1],
                value: web3.toWei(1, "ether")
            });
            const account1BalanceAfter = web3.eth.getBalance(accounts[1]);
            const account1Diff = web3.toDecimal(account1BalanceBefore.sub(account1BalanceAfter));
            const account1BalanceBPZ = web3.toDecimal(web3.fromWei(await bpz.balanceOf(accounts[1]), "ether"));

            assert.equal(account1BalanceBPZ, web3.toDecimal(tokensPerEther));

            const account2BalanceBefore = web3.eth.getBalance(accounts[2]);
            const tx = await tokenSale.purchaseTokens({
                from: accounts[2],
                value: web3.toWei(1, "ether"),
                gasPrice: 1
            });
            const account2BalanceAfter = web3.eth.getBalance(accounts[2]);
            const account2Diff = web3.toDecimal(account2BalanceBefore.sub(account2BalanceAfter));

            const oneInWei = new web3.BigNumber(web3.toWei(1, "ether"));
            const weiPerToken = oneInWei.div(tokensPerEther);
            const expectedTokenCost = weiPerToken.mul(100);
            const gasCost = tx.receipt.gasUsed;
            const expectedDiff = Math.floor(web3.toDecimal(expectedTokenCost.add(gasCost)));

            assert.isBelow(account2Diff, account1Diff);
            assert.equal(account2Diff, expectedDiff);
        });

        it("should not allow purchase by a contributor that is not whitelisted", async () => {
            await testHarness.forceSaleStart();
            const promise = tokenSale.purchaseTokens({
                from: accounts[3],
                value: web3.toWei(1, "ether")
            });
            await utils.expectInvalidOpcode(promise);
        });

        it("should not allow purchase by a contributor that has their limit reduced after their first purchase", async () => {
            await testHarness.forceSaleStart();
            await tokenSale.purchaseTokens({
                from: accounts[1],
                value: web3.toWei(1, "ether")
            });

            await tokenSale.updateWhitelist([accounts[1]], [0]);

            const promise = tokenSale.purchaseTokens({
                from: accounts[1],
                value: web3.toWei(1, "ether")
            });

            await utils.expectInvalidOpcode(promise);
        });

        it("should limit the contributor to their whitelisted contribution cap", async () => {
            await testHarness.forceSaleStart();

            await tokenSale.updateWhitelist([accounts[1]], [web3.toWei(0.5, "ether")]);

            const balanceBefore = web3.eth.getBalance(accounts[1]);
            const tx = await tokenSale.purchaseTokens({
                from: accounts[1],
                value: web3.toWei(1, "ether"),
                gasPrice: 1
            });
            const balanceAfter = web3.eth.getBalance(accounts[1]);
            const diff = web3.toDecimal(balanceBefore.sub(balanceAfter));

            const tokensPerEther = await tokenSale.tokensPerEther();
            const oneInWei = new web3.BigNumber(web3.toWei(1, "ether"));
            const weiPerToken = oneInWei.div(tokensPerEther);
            const expectedTokenCost = weiPerToken.mul(50);
            const gasCost = tx.receipt.gasUsed;
            const expectedDiff = Math.floor(web3.toDecimal(expectedTokenCost.add(gasCost)));

            assert.equal(diff, expectedDiff);
        });

        it("should allow a contributor to submit more than one purchase to consume their whitelist cap", async () => {
            await testHarness.forceSaleStart();

            await tokenSale.updateWhitelist([accounts[1]], [web3.toWei(1.5, "ether")]);

            const tokensPurchasedBefore = web3.toDecimal(await tokenSale.tokensPurchased(accounts[1]));
            assert.equal(tokensPurchasedBefore, 0);

            await tokenSale.purchaseTokens({
                from: accounts[1],
                value: web3.toWei(1, "ether")
            });

            const tokensPurchasedAfter = web3.toDecimal(await tokenSale.tokensPurchased(accounts[1]));
            assert.equal(tokensPurchasedAfter, oneHundredInWei);

            await tokenSale.purchaseTokens({
                from: accounts[1],
                value: web3.toWei(1, "ether")
            });

            const tokensPurchasedAfter2 = web3.toDecimal(await tokenSale.tokensPurchased(accounts[1]));
            assert.equal(tokensPurchasedAfter2, oneHundredInWei * 1.5);
        });
    });

    describe("Owned:", () => {
        ownedTests.describeTests(() => tokenSale, accounts);
    });

    async function buyAllTokens() {
        const tokenSaleTokensInWei = await tokenSale.TOKEN_SALE_TOKENS();
        const tokenSaleTokens = web3.fromWei(tokenSaleTokensInWei, "ether");

        // Set the exchange rate so we can buy all the tokens with a single Ether
        await tokenSale.setTokensPerEther(tokenSaleTokens);
        await tokenSale.updateWhitelist([accounts[1]], [tokenSaleTokensInWei]);

        // Force the sale to start
        await testHarness.forceSaleStart();

        // Purchase all the tokens
        await tokenSale.purchaseTokens({
            from: accounts[1],
            value: web3.toWei(1, "ether")
        });

        const bpz = BPZSmartToken.at(await tokenSale.bpz());

        // Ensure that we actually bought all the tokens.
        const balance = web3.toDecimal(await bpz.balanceOf(accounts[1]));
        const tokenSaleTokensInWeiDecimal = web3.toDecimal(await tokenSale.TOKEN_SALE_TOKENS());
        const tokensSoldInWeiDecimal = web3.toDecimal(await tokenSale.tokensSold());

        assert.equal(balance, tokenSaleTokensInWeiDecimal);
        assert.equal(tokensSoldInWeiDecimal, tokenSaleTokensInWeiDecimal);
    }

    async function finalizeSale() {
        await buyAllTokens();
        await tokenSale.finalizeSale();
    }

    async function expectTokensPurchasedEvent(_to, _tokens, filter = {}) {
        await utils.expectEvent(tokenSale, {
            event: "TokensPurchased",
            args: {
                _to,
                _tokens: new web3.BigNumber(_tokens)
            },
            ...filter
        });
    }

    async function expectWhitelistedEvent(_participant, _contributionLimit, filter = {}) {
        await utils.expectEvent(tokenSale, {
            event: "Whitelisted",
            args: {
                _participant,
                _contributionLimit: new web3.BigNumber(_contributionLimit)
            },
            ...filter
        });
    }
});
