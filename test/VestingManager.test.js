import _ from "lodash";
import moment from "moment";
import utils from "./utils";
import ownedTests from "./ownedTests.js";

const BPZSmartToken = artifacts.require("./BPZSmartToken.sol");
const VestingManager = artifacts.require("./VestingManager.sol");

const solidityYears = 365 * 24 * 60 * 60;

const grants = [
    {
        value: 100,
        cliff: 1 * solidityYears,
        end: 2 * solidityYears
    },
    {
        value: 500,
        cliff: 2 * solidityYears,
        end: 4 * solidityYears
    },
    {
        value: 1000,
        cliff: 1 * solidityYears,
        end: 4 * solidityYears
    }
];

const grantScenarios = [
    {
        name: "One second after start of grant",
        time: (_cliff, _end) => 0
    },
    {
        name: "Cliff 50% elapsed",
        time: (cliff, _end) => 0.5 * cliff
    },
    {
        name: "Cliff 1 second from elapsing",
        time: (cliff, _end) => cliff - 1
    },
    {
        name: "Cliff exactly elapsed",
        time: (cliff, _end) => cliff
    },
    {
        name: "10% of cliff => end",
        time: (cliff, end) => cliff + ((end - cliff) * 0.10)
    },
    {
        name: "25% of cliff => end",
        time: (cliff, end) => cliff + ((end - cliff) * 0.25)
    },
    {
        name: "50% of cliff => end",
        time: (cliff, end) => cliff + ((end - cliff) * 0.50)
    },
    {
        name: "75% of cliff => end",
        time: (cliff, end) => cliff + ((end - cliff) * 0.75)
    },
    {
        name: "90% of cliff => end",
        time: (cliff, end) => cliff + ((end - cliff) * 0.90)
    },
    {
        name: "99% of cliff => end",
        time: (cliff, end) => cliff + ((end - cliff) * 0.99)
    },
    {
        name: "Exactly at end",
        time: (_cliff, end) => end
    },
    {
        name: "After the end",
        time: (_cliff, end) => end + 1
    }
];

contract("VestingManager", (accounts) => {
    let bpz;
    let vestingManager;
    let yesterday;
    let now;
    let oneYearAgo;
    let oneYear;
    let twoYears;
    let fourYears;

    beforeEach(async () => {
        bpz = await BPZSmartToken.new();
        vestingManager = await VestingManager.new(bpz.address);
        yesterday = moment().subtract(1, "day").unix();
        now = moment().unix();
        oneYearAgo = now - (1 * solidityYears);
        oneYear = now + (1 * solidityYears);
        twoYears = now + (2 * solidityYears);
        fourYears = now + (4 * solidityYears);
    });

    describe("constructor()", () => {
        it("should throw if the bpz address is zero", async () => {
            const promise = VestingManager.new(0);
            await utils.expectInvalidOpcode(promise);
        });

        it("should save the bpz token address", async () => {
            assert.equal(await vestingManager.bpz(), bpz.address);
        });
    });

    describe("fallback function", () => {
        it("should throw if an invalid function is called", async () => {
            const hash = web3.sha3("this function does not exist");
            const functionSignature = hash.slice(0, 6);

            const promise = vestingManager.sendTransaction({
                data: functionSignature
            });
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if the contract is directly sent ether", async () => {
            const promise = vestingManager.send(web3.toWei(1, "ether"));
            await utils.expectInvalidOpcode(promise);
        });
    });

    describe("grantTokens()", () => {
        it("should throw if called by anyone but the owner", async () => {
            await bpz.issue(vestingManager.address, 1000);
            const promise = vestingManager.grantTokens(accounts[2], 100, now, oneYear, twoYears, {
                from: accounts[1]
            });
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if the 'to' address is invalid", async () => {
            await bpz.issue(vestingManager.address, 1000);
            const promise = vestingManager.grantTokens(0, 100, now, oneYear, twoYears, {
                from: accounts[1]
            });
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if the 'value' is zero", async () => {
            await bpz.issue(vestingManager.address, 1000);
            const promise = vestingManager.grantTokens(accounts[1], 0, now, oneYear, twoYears);
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if the cliff is before start", async () => {
            await bpz.issue(vestingManager.address, 1000);
            const promise = vestingManager.grantTokens(accounts[1], 100, now, yesterday, twoYears);
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if the end is before the cliff", async () => {
            await bpz.issue(vestingManager.address, 1000);
            const promise = vestingManager.grantTokens(accounts[1], 100, now, fourYears, twoYears);
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if the 'to' already has a grant", async () => {
            await bpz.issue(vestingManager.address, 1000);
            await vestingManager.grantTokens(accounts[1], 100, now, oneYear, twoYears);

            const promise = vestingManager.grantTokens(accounts[1], 100, now, fourYears, twoYears);
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if the VestingManager doesn't have enough balance for the grant", async () => {
            const promise = vestingManager.grantTokens(accounts[1], 100, now, oneYear, twoYears);
            await utils.expectInvalidOpcode(promise);
        });

        it("should correctly issue the grant", async () => {
            await bpz.issue(vestingManager.address, 1000);
            await vestingManager.grantTokens(accounts[1], 100, now, oneYear, twoYears);

            await verifyGrant(accounts[1], {
                value: 100,
                start: now,
                cliff: oneYear,
                end: twoYears,
                claimed: 0
            });
        });

        it("should fire the 'TokensGranted' event", async () => {
            await bpz.issue(vestingManager.address, 1000);
            await vestingManager.grantTokens(accounts[1], 100, now, oneYear, twoYears);

            await expectTokensGrantedEvent(accounts[0], accounts[1], 100);
        });

        it("should increment the 'totalVesting", async () => {
            await bpz.issue(vestingManager.address, 1000);
            await vestingManager.grantTokens(accounts[1], 100, now, oneYear, twoYears);

            assert.equal(await vestingManager.totalVesting(), 100);
        });
    });

    describe("getVestedTokens()", () => {
        it("should return 0 if the holder has no grant", async () => {
            const vestedTokens = await vestingManager.getVestedTokens(accounts[1], now);
            assert.equal(web3.toDecimal(vestedTokens), 0);
        });

        _.each(grants, (grant) => {
            _.each(grantScenarios, (scenario) => {
                const timeDelta = scenario.time(grant.cliff, grant.end);
                const expected = calculateVest(grant, timeDelta);

                it(`should return ${expected} vested tokens (${scenario.name})`, async () => {
                    await verifyVestedTokens(grant, expected, timeDelta);
                });
            });
        });
    });

    describe("getClaimableTokens()", () => {
        it("should return 0 if the holder has no grant", async () => {
            const vestedTokens = await vestingManager.getClaimableTokens(accounts[1], now);
            assert.equal(web3.toDecimal(vestedTokens), 0);
        });

        _.each(grants, (grant) => {
            _.each(grantScenarios, (scenario) => {
                const timeDelta = scenario.time(grant.cliff, grant.end);
                const expected = calculateVest(grant, timeDelta);

                it(`should return ${expected} claimable tokens (${scenario.name})`, async () => {
                    await verifyVestedTokens(grant, expected, timeDelta);

                    const claimableTokens = await vestingManager.getClaimableTokens(accounts[1], now + timeDelta);
                    assert.equal(web3.toDecimal(claimableTokens), web3.toWei(expected));

                    if (expected > 0) {
                        await vestingManager.claimVestedTokens({
                            from: accounts[1]
                        });

                        const after = await vestingManager.getClaimableTokens(accounts[1], now);
                        assert.equal(web3.toDecimal(after), 0);
                    }
                });
            });
        });
    });

    describe("claimVestedTokens()", () => {
        it("should do nothing if the caller has no vested tokens", async () => {
            await bpz.issue(vestingManager.address, 100);
            await vestingManager.grantTokens(accounts[1], 100, now, oneYear, fourYears);

            const balanceBefore = web3.toDecimal(await bpz.balanceOf(accounts[1]));

            await vestingManager.claimVestedTokens({
                from: accounts[1]
            });

            const balanceAfter = web3.toDecimal(await bpz.balanceOf(accounts[1]));

            assert.equal(balanceBefore, balanceAfter);
        });

        it("should do nothing if the caller has no grant", async () => {
            const balanceBefore = web3.toDecimal(await bpz.balanceOf(accounts[1]));

            await vestingManager.claimVestedTokens({
                from: accounts[1]
            });

            const balanceAfter = web3.toDecimal(await bpz.balanceOf(accounts[1]));

            assert.equal(balanceBefore, balanceAfter);
        });

        it("should do nothing if the caller has already claimed all claimable tokens", async () => {
            await bpz.issue(vestingManager.address, 100);
            await vestingManager.grantTokens(accounts[1], 100, oneYearAgo, now, now);

            await vestingManager.claimVestedTokens({
                from: accounts[1]
            });

            const balanceBefore = web3.toDecimal(await bpz.balanceOf(accounts[1]));

            await vestingManager.claimVestedTokens({
                from: accounts[1]
            });

            const balanceAfter = web3.toDecimal(await bpz.balanceOf(accounts[1]));

            assert.equal(balanceBefore, balanceAfter);
        });

        it("should transfer the tokens and increment the callers claimed token count", async () => {
            await bpz.issue(vestingManager.address, 100);
            await vestingManager.grantTokens(accounts[1], 100, oneYearAgo, now, now);

            const balanceBefore = web3.toDecimal(await bpz.balanceOf(accounts[1]));

            await vestingManager.claimVestedTokens({
                from: accounts[1]
            });

            const balanceAfter = web3.toDecimal(await bpz.balanceOf(accounts[1]));

            assert.equal(balanceBefore, 0);
            assert.equal(balanceAfter, 100);

            await verifyGrant(accounts[1], {
                value: 100,
                start: oneYearAgo,
                cliff: now,
                end: now,
                claimed: 100
            });
        });

        it("should decrement the totalVesting", async () => {
            await bpz.issue(vestingManager.address, 100);

            const initialVesting = web3.toDecimal(await vestingManager.totalVesting());

            await vestingManager.grantTokens(accounts[1], 100, oneYearAgo, now, now);

            const beforeVesting = web3.toDecimal(await vestingManager.totalVesting());

            await vestingManager.claimVestedTokens({
                from: accounts[1]
            });

            const afterVesting = web3.toDecimal(await vestingManager.totalVesting());

            assert.equal(initialVesting, 0);
            assert.equal(beforeVesting, 100);
            assert.equal(afterVesting, 0);
        });

        it("should fire the VestedTokensClaimed event", async () => {
            await bpz.issue(vestingManager.address, 100);
            await vestingManager.grantTokens(accounts[1], 100, oneYearAgo, now, now);

            await vestingManager.claimVestedTokens({
                from: accounts[1]
            });

            await expectVestedTokensClaimedEvent(accounts[1], 100);
        });
    });

    describe("Owned:", () => {
        ownedTests.describeTests(() => vestingManager, accounts);
    });

    async function verifyVestedTokens(grant, expected, timeDelta) {
        const start = now;
        const cliff = start + grant.cliff;
        const end = start + grant.end;
        const value = web3.toWei(grant.value);
        await bpz.issue(vestingManager.address, value);
        await vestingManager.grantTokens(accounts[1], value, start, cliff, end);

        const time = start + timeDelta;
        const vestedTokens = await vestingManager.getVestedTokens(accounts[1], time);

        assert.equal(web3.toDecimal(vestedTokens), web3.toWei(expected));
    }

    async function verifyBalance(account, expectedBalance) {
        const balance = await bpz.balanceOf(account);
        assert.equal(web3.toDecimal(balance), expectedBalance);
    }

    async function verifyGrant(account, expectedGrant) {
        const rawGrant = await vestingManager.grants(account);
        const grant = {
            value: web3.toDecimal(rawGrant[0]),
            start: web3.toDecimal(rawGrant[1]),
            cliff: web3.toDecimal(rawGrant[2]),
            end: web3.toDecimal(rawGrant[3]),
            claimed: web3.toDecimal(rawGrant[4])
        };

        assert.equal(grant.value, expectedGrant.value);
        assert.equal(grant.start, expectedGrant.start);
        assert.equal(grant.cliff, expectedGrant.cliff);
        assert.equal(grant.end, expectedGrant.end);
        assert.equal(grant.claimed, expectedGrant.claimed);
    }

    function calculateVest(grant, time) {
        if (time < grant.cliff) {
            return 0;
        }

        if (time >= grant.end) {
            return grant.value;
        }

        return (grant.value * time) / grant.end;
    }

    async function expectTokensGrantedEvent(from, to, tokens, filter = {}) {
        await utils.expectEvent(vestingManager, {
            event: "TokensGranted",
            args: {
                from,
                to,
                value: new web3.BigNumber(tokens)
            },
            ...filter
        });
    }

    async function expectGrantRevokedEvent(holder, refund, filter = {}) {
        await utils.expectEvent(vestingManager, {
            event: "GrantRevoked",
            args: {
                holder,
                refund: new web3.BigNumber(refund)
            },
            ...filter
        });
    }

    async function expectVestedTokensClaimedEvent(holder, value, filter = {}) {
        await utils.expectEvent(vestingManager, {
            event: "VestedTokensClaimed",
            args: {
                holder,
                value: new web3.BigNumber(value)
            },
            ...filter
        });
    }
});
