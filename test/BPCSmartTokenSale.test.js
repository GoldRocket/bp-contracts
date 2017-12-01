import moment from "moment";
import utils from "./utils";
import ownedTests from "./ownedTests.js";

const BPCSmartToken = artifacts.require("./BPCSmartToken.sol");
const BPCSmartTokenSale = artifacts.require("./BPCSmartTokenSale.sol");
const BPCSmartTokenSaleTestHarness = artifacts.require("./BPCSmartTokenSaleTestHarness.sol");
const VestingManager = artifacts.require("./VestingManager.sol");

const solidityYears = 365 * 24 * 60 * 60;

contract("BPCSmartTokenSale", (accounts) => {
    let testHarness;
    let tokenSale;

    beforeEach(async () => {
        testHarness = await BPCSmartTokenSaleTestHarness.new(moment().add(1, "minute").unix());
        tokenSale = BPCSmartTokenSale.at(testHarness.address);
    });

    describe("constructor", () => {
        it("should fail if the start time is not specified", async () => {
            const promise = BPCSmartTokenSale.new();
            await utils.expectInvalidOpcode(promise);
        });

        it("should fail if the start time is before 'now'", async () => {
            const promise = BPCSmartTokenSale.new(moment().subtract(1, "second").unix());
            await utils.expectInvalidOpcode(promise);
        });

        it("should succeed if the start time is after 'now'", async () => {
            const startTime = moment().add(1, "second").unix();
            const instance = await BPCSmartTokenSale.new(startTime);

            const duration = web3.toDecimal(await instance.DURATION());
            const expectedEndTime = startTime + duration;

            assert.notEqual(await instance.bpc(), "0x0");
            assert.equal(await instance.startTime(), startTime);
            assert.equal(await instance.getEndTime(), expectedEndTime);
        });
    });

    describe("fallback function", () => {
        it("should throw if an invalid function is called", async () => {
            const hash = web3.sha3("this function does not exist");
            const functionSignature = hash.slice(0, 6);

            const promise = tokenSale.sendTransaction({
                data: functionSignature
            });
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if the contract is directly sent ether", async () => {
            const promise = tokenSale.send(web3.toWei(1, "ether"));
            await utils.expectInvalidOpcode(promise);
        });
    });

    describe("setEtherPriceUSD", () => {
        it("should throw if the sale has already started", async () => {
            await testHarness.forceSaleStart();

            const promise = tokenSale.setEtherPriceUSD(1);
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if called by anyone but the owner", async () => {
            const promise = tokenSale.setEtherPriceUSD(1, {
                from: accounts[1]
            });
            await utils.expectInvalidOpcode(promise);
        });

        it("should set the price of ether", async () => {
            await tokenSale.setEtherPriceUSD(1);
            const one = await tokenSale.etherPriceUSD();
            assert.equal(one, 1);

            await tokenSale.setEtherPriceUSD(100);
            const oneHundred = await tokenSale.etherPriceUSD();
            assert.equal(oneHundred, 100);
        });
    });

    describe("finalizeSale", () => {
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
            const bpc = BPCSmartToken.at(await tokenSale.bpc());

            await buyAllTokens();
            await tokenSale.transferSmartTokenOwnership(accounts[1]);
            await bpc.acceptOwnership({
                from: accounts[1]
            });

            const promise = tokenSale.finalizeSale();
            await utils.expectInvalidOpcode(promise);
        });

        it("should issue the right number of tokens to the company", async () => {
            const bpc = BPCSmartToken.at(await tokenSale.bpc());

            await buyAllTokens();
            await tokenSale.finalizeSale();

            const companyAddress = await tokenSale.BLITZPREDICT_ADDRESS();
            const companyBalance = web3.toDecimal(await bpc.balanceOf(companyAddress));
            const expectedCompanyBalance = web3.toDecimal(await tokenSale.getCompanyIssuedTokens());
            assert.equal(companyBalance, expectedCompanyBalance);
        });

        it("should issue the right number of tokens to vesting manager", async () => {
            const bpc = BPCSmartToken.at(await tokenSale.bpc());

            await buyAllTokens();
            await tokenSale.finalizeSale();

            const vestingManager = VestingManager.at(await tokenSale.vestingManager());

            const vestingManagerBalance = web3.toDecimal(await bpc.balanceOf(vestingManager.address));
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
                end: 4 * solidityYears
            });

            await verifyGrant({
                name: "Team",
                block,
                vestingManager,
                address: await tokenSale.TEAM_ADDRESS(),
                tokens: await tokenSale.TEAM_TOKENS(),
                cliff: 1 * solidityYears,
                end: 4 * solidityYears
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
            const bpc = BPCSmartToken.at(await tokenSale.bpc());
            assert.isFalse(await bpc.transfersEnabled());

            await buyAllTokens();
            await tokenSale.finalizeSale();

            assert.isTrue(await bpc.transfersEnabled());
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

    describe("transferSmartTokenOwnership", () => {
        it("should throw if called by anyone but the owner", async () => {
            const promise = tokenSale.transferSmartTokenOwnership(accounts[2], {
                from: accounts[1]
            });
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if the token ownership has already been transferred", async () => {
            await tokenSale.transferSmartTokenOwnership(accounts[1]);

            const bpc = BPCSmartToken.at(await tokenSale.bpc());
            await bpc.acceptOwnership({
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

            const bpc = BPCSmartToken.at(await tokenSale.bpc());
            await bpc.acceptOwnership({
                from: accounts[1]
            });

            assert.equal(await bpc.owner(), accounts[1]);
        });

        it("should allow a second transfer if the first one has not yet been accepted", async () => {
            await tokenSale.transferSmartTokenOwnership(accounts[1]);
            await tokenSale.transferSmartTokenOwnership(accounts[2]);

            const bpc = BPCSmartToken.at(await tokenSale.bpc());
            await bpc.acceptOwnership({
                from: accounts[2]
            });

            assert.equal(await bpc.owner(), accounts[2]);
        });
    });

    describe("acceptSmartTokenOwnership", () => {
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

            const bpc = BPCSmartToken.at(await tokenSale.bpc());
            await bpc.acceptOwnership({
                from: accounts[1]
            });

            const promise = tokenSale.acceptSmartTokenOwnership();
            await utils.expectInvalidOpcode(promise);
        });

        it("should successfully accept ownership", async () => {
            await tokenSale.transferSmartTokenOwnership(accounts[1]);

            const bpc = BPCSmartToken.at(await tokenSale.bpc());
            await bpc.acceptOwnership({
                from: accounts[1]
            });

            await bpc.transferOwnership(tokenSale.address, {
                from: accounts[1]
            });

            await tokenSale.acceptSmartTokenOwnership();

            assert.equal(await bpc.owner(), tokenSale.address);
        });
    });

    describe("transferVestingManagerOwnership", () => {
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

    describe("acceptVestingManagerOwnership", () => {
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

    describe("getCompanyIssuedTokens", () => {
        it("should return the number of tokens to be issued to the company", async () => {
            const seedRoundTokens = web3.toDecimal(await tokenSale.SEED_ROUND_TOKENS());
            const strategicPartnerTokens = web3.toDecimal(await tokenSale.STRATEGIC_PARTNER_TOKENS());
            const advisorTokens = web3.toDecimal(await tokenSale.ADVISOR_TOKENS());
            const liquidityReserveTokens = web3.toDecimal(await tokenSale.LIQUIDITY_RESERVE_TOKENS());

            const expected = seedRoundTokens + strategicPartnerTokens + advisorTokens + liquidityReserveTokens;
            const actual = web3.toDecimal(await tokenSale.getCompanyIssuedTokens());

            assert.equal(actual, expected);
        });
    });

    describe("getVestingTokens", () => {
        it("should return the number of tokens to be transferred to the vesting mananger", async () => {
            const futureHiresTokens = web3.toDecimal(await tokenSale.FUTURE_HIRES_TOKENS());
            const teamTokens = web3.toDecimal(await tokenSale.TEAM_TOKENS());
            const blitzPredictTokens = web3.toDecimal(await tokenSale.BLITZPREDICT_TOKENS());

            const expected = futureHiresTokens + teamTokens + blitzPredictTokens;
            const actual = web3.toDecimal(await tokenSale.getVestingTokens());

            assert.equal(actual, expected);
        });
    });

    describe("getEndTime", () => {
        it("should return the ending timestamp of the sale", async () => {
            const startTime = web3.toDecimal(await tokenSale.startTime());
            const duration = web3.toDecimal(await tokenSale.DURATION());
            const expectedEndTime = startTime + duration;

            assert.equal(await tokenSale.getEndTime(), expectedEndTime);
        });
    });

    describe("getTokensPerEther", () => {
        it("should return the number of tokens that can be purchased for 1 ether", async () => {
            const oneHundred = web3.toWei(100);
            await setTokensPerEther(oneHundred);
            const tokensPerEther = web3.toDecimal(await tokenSale.getTokensPerEther());

            assert.equal(tokensPerEther, oneHundred);
        });
    });

    describe("purchaseTokens", () => {
        const oneHundred = web3.toWei(100);

        beforeEach(async () => {
            await setTokensPerEther(oneHundred);
        });

        it("should throw if the sale has not yet started", async () => {
            const promise = tokenSale.purchaseTokens({
                from: accounts[1],
                value: 1
            });
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if the sale is already over", async () => {
            await buyAllTokens();
            const promise = tokenSale.purchaseTokens({
                from: accounts[1],
                value: 1
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
                value: 1
            });

            tokensSold = web3.toDecimal(await tokenSale.tokensSold());
            assert.equal(tokensSold, oneHundred);
        });

        it("should issue the full number of tokens to the purchaser", async () => {
            await testHarness.forceSaleStart();

            await tokenSale.purchaseTokens({
                from: accounts[1],
                value: 1
            });

            const bpc = BPCSmartToken.at(await tokenSale.bpc());
            const balance = web3.toDecimal(await bpc.balanceOf(accounts[1]));

            assert.equal(balance, oneHundred);
        });

        it("should fire the TokensPurchased event", async () => {
            await testHarness.forceSaleStart();

            await tokenSale.purchaseTokens({
                from: accounts[1],
                value: 1
            });

            await expectTokensPurchasedEvent(accounts[1], oneHundred);
        });

        it("should issue only the remaining tokens for the last purchase in the sale", async () => {
            const tokenSaleTokens = await tokenSale.TOKEN_SALE_TOKENS();
            await setTokensPerEther(tokenSaleTokens.sub(oneHundred));
            await testHarness.forceSaleStart();

            await tokenSale.purchaseTokens({
                from: accounts[1],
                value: 1
            });

            await tokenSale.purchaseTokens({
                from: accounts[2],
                value: 1
            });

            const bpc = BPCSmartToken.at(await tokenSale.bpc());
            const balance = web3.toDecimal(await bpc.balanceOf(accounts[2]));

            assert.equal(balance, oneHundred);
        });

        it("should refund excess ether on the last purchase in the sale", async () => {
            const tokenSaleTokens = await tokenSale.TOKEN_SALE_TOKENS();
            await setTokensPerEther(tokenSaleTokens.sub(oneHundred));
            await testHarness.forceSaleStart();

            const account1BalanceBefore = web3.eth.getBalance(accounts[1]);
            await tokenSale.purchaseTokens({
                from: accounts[1],
                value: 1
            });
            const account1BalanceAfter = web3.eth.getBalance(accounts[1]);
            const account1Diff = web3.toDecimal(account1BalanceBefore.sub(account1BalanceAfter));

            const account2BalanceBefore = web3.eth.getBalance(accounts[2]);
            await tokenSale.purchaseTokens({
                from: accounts[2],
                value: 1
            });
            const account2BalanceAfter = web3.eth.getBalance(accounts[2]);
            const account2Diff = web3.toDecimal(account2BalanceBefore.sub(account2BalanceAfter));

            assert.isBelow(account2Diff, account1Diff);
        });
    });

    describe("Owned", () => {
        ownedTests.describeTests(() => tokenSale, accounts);
    });

    async function buyAllTokens() {
        const usdCap = await tokenSale.USD_CAP();

        // Set the exchange rate so we can buy all the tokens with a single Ether
        await tokenSale.setEtherPriceUSD(usdCap);

        // Force the sale to start
        await testHarness.forceSaleStart();

        // Purchase all the tokens
        await tokenSale.purchaseTokens({
            from: accounts[1],
            value: 1
        });

        const bpc = BPCSmartToken.at(await tokenSale.bpc());

        // Ensure that we actually bought all the tokens.
        const balance = web3.toDecimal(await bpc.balanceOf(accounts[1]));
        const tokenSaleTokens = web3.toDecimal(await tokenSale.TOKEN_SALE_TOKENS());
        const tokensSold = web3.toDecimal(await tokenSale.tokensSold());

        assert.equal(balance, tokenSaleTokens);
        assert.equal(tokensSold, tokenSaleTokens);
    }

    async function finalizeSale() {
        await buyAllTokens();
        await tokenSale.finalizeSale();
    }

    async function setTokensPerEther(numTokens) {
        const usdCap = await tokenSale.USD_CAP();
        const tokenSaleTokens = await tokenSale.TOKEN_SALE_TOKENS();
        const etherPrice = usdCap.mul(numTokens)
            .div(tokenSaleTokens);

        await tokenSale.setEtherPriceUSD(etherPrice);
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
});
