import _ from "lodash";
import utils from "./utils";
import ownedTests from "./ownedTests";

const TournamentManager = artifacts.require("./TournamentManager.sol");

contract("TournamentManager", (accounts) => {
    let instance;

    beforeEach(async () => {
        instance = await TournamentManager.new();
    });

    describe("getNumContests", () => {
        it("should inititally return 0", async () => {
            const numContests = await instance.getNumContests();
            assert.equal(numContests, 0);
        });
    });

    describe("getContestId", () => {
        it("should throw if there are no contests", async () => {
            const promise = instance.getContestId(0);
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if the index is invalid", async () => {
            const contest1 = web3.sha3("contest 1");
            await instance.publishContest(contest1);

            // We should be able to get the id of the contest we just created
            const id1 = await instance.getContestId(0);
            assert.equal(web3.fromDecimal(id1), contest1);

            // But trying to get the id of a non-existent contest index
            const promise = instance.getContestId(1);
            await utils.expectInvalidOpcode(promise);
        });

        it("should allow getting the ids of all contests", async () => {
            const contest1 = web3.sha3("contest 1");
            await instance.publishContest(contest1);

            const contest2 = web3.sha3("contest 2");
            await instance.publishContest(contest2);

            const numContests = await instance.getNumContests();
            assert.equal(numContests, 2);

            const id1 = await instance.getContestId(0);
            assert.equal(web3.fromDecimal(id1), contest1);

            const id2 = await instance.getContestId(1);
            assert.equal(web3.fromDecimal(id2), contest2);
        });
    });

    describe("getNumContestEntries", () => {
        it("should throw if the contest doesn't exist", async () => {
            const contestId = web3.sha3("unknown");
            const promise = instance.getNumContestEntries(contestId);
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if the contest id is zero", async () => {
            const promise = instance.getNumContestEntries(`0x${"0".repeat(64)}`);
            await utils.expectInvalidOpcode(promise);
        });

        it("should return the number of entries in the specified contest", async () => {
            const contestId = web3.sha3("my contest");
            await instance.publishContest(contestId);

            const picks = await makePicks(contestId);

            const numEntries = await instance.getNumContestEntries(contestId);
            assert.equal(numEntries, picks.length);
        });
    });

    describe("getContestEntry", () => {
        it("should throw if the contest doesn't exist", async () => {
            const contestId = web3.sha3("unknown");
            const promise = instance.getNumContestEntries(contestId);
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if the contest id is zero", async () => {
            const promise = instance.getNumContestEntries(`0x${"0".repeat(64)}`);
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if the contest has no picks", async () => {
            const contestId = web3.sha3("my contest");
            await instance.publishContest(contestId);

            const promise = instance.getContestEntry(contestId, 0);
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if the entry index is invalid", async () => {
            const contestId = web3.sha3("my contest");
            await instance.publishContest(contestId);

            await makePick(contestId, accounts[1]);

            const promise = instance.getContestEntry(contestId, 1);
            await utils.expectInvalidOpcode(promise);
        });

        it("should allow iterating through the picks in the contest", async () => {
            const contestId = web3.sha3("my contest");
            await instance.publishContest(contestId);

            const picks = await makePicks(contestId);

            const promises = _.map(picks, async (pick, i) => {
                const entry = await instance.getContestEntry(contestId, i);
                assert.equal(entry[0], pick.account);
                assert.equal(entry[1], pick.hash);
            });

            await Promise.all(promises);
        });
    });

    describe("getContestEntryForEntrant", () => {
        it("should throw if the contest doesn't exist", async () => {
            const contestId = web3.sha3("unknown");
            const promise = instance.getContestEntryForEntrant(contestId, accounts[1]);
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if the contest id is zero", async () => {
            const contestId = `0x${"0".repeat(64)}`;
            const promise = instance.getContestEntryForEntrant(contestId, accounts[1]);
            await utils.expectInvalidOpcode(promise);
        });

        it("should allow retrieving all entries in a contest", async () => {
            const contestId = web3.sha3("new contest");
            await instance.publishContest(contestId);

            const picks = await makePicks(contestId);

            const promises = _.map(picks, async (pick, i) => {
                const entry = await instance.getContestEntry(contestId, i);
                assert.equal(entry[0], pick.account);
                assert.equal(entry[1], pick.hash);

                const entryPick = await instance.getContestEntryForEntrant(contestId, pick.account);
                assert.equal(entryPick, pick.hash);
            });
            await Promise.all(promises);

            const promise = instance.getContestEntry(contestId, picks.length);
            await utils.expectInvalidOpcode(promise);
        });
    });

    describe("publishContest", () => {
        it("should throw if anyone but the owner tries to publish a contest", async () => {
            const contestId = web3.sha3("contest");
            const promise = instance.publishContest(contestId, {
                from: accounts[1]
            });

            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if the contestId is zero", async () => {
            const contestId = `0x${"0".repeat(64)}`;
            const promise = instance.publishContest(contestId);
            await utils.expectInvalidOpcode(promise);
        });

        it("should allow publishing new contests", async () => {
            const contest1 = web3.sha3("contest1");
            await instance.publishContest(contest1);

            let numContests = await instance.getNumContests();
            assert.equal(numContests, 1);

            const contest2 = web3.sha3("contest2");
            await instance.publishContest(contest2);

            numContests = await instance.getNumContests();
            assert.equal(numContests, 2);
        });

        it("should have no entries for a newly published contest", async () => {
            const contestId = web3.sha3("new contest");
            await instance.publishContest(contestId);

            const numEntries = await instance.getNumContestEntries(contestId);
            assert.equal(numEntries, 0, "There should be no entries");
        });

        it("should not allow publishing the same contest twice", async () => {
            const contestId = web3.sha3("contest");
            await instance.publishContest(contestId);

            const promise = instance.publishContest(contestId);
            await utils.expectInvalidOpcode(promise);
        });
    });

    describe("submitPick", () => {
        it("should allow adding picks", async () => {
            const contestId = web3.sha3("new contest");
            await instance.publishContest(contestId);

            const picks = await makePicks(contestId);

            const numEntries = await instance.getNumContestEntries(contestId);
            assert.equal(numEntries, picks.length);
        });

        it("should not allow adding more than one pick for a single user", async () => {
            const contestId = web3.sha3("new contest");
            await instance.publishContest(contestId);

            await makePick(contestId, accounts[1]);
            const promise = makePick(contestId, accounts[1]);

            await utils.expectInvalidOpcode(promise);

            const numEntries = await instance.getNumContestEntries(contestId);
            assert.equal(numEntries, 1);
        });

        it("should not allow a pick with an invalid signature", async () => {
            const contestId = web3.sha3("new contest");
            await instance.publishContest(contestId);

            const pick1 = await signPick("my pick1");
            const unsignedPick = web3.sha3("unsigned pick");
            const promise = instance.submitPick(contestId, unsignedPick, pick1.v, pick1.r, pick1.s, {
                from: accounts[1]
            });

            await utils.expectInvalidOpcode(promise);
        });

        it("should not allow submitting a zero-pick", async () => {
            const contestId = web3.sha3("new contest");
            await instance.publishContest(contestId);

            const pick = await signPickHash(`0x${"0".repeat(64)}`);
            const promise = instance.submitPick(contestId, pick.hash, pick.v, pick.r, pick.s, {
                from: accounts[1]
            });

            await utils.expectInvalidOpcode(promise);
        });
    });

    describe("Owned", () => {
        ownedTests.describeTests(() => instance, accounts);
    });

    async function makePicks(contestId) {
        const promises = _.map(accounts, account => makePick(contestId, account));
        const picks = await Promise.all(promises);

        return picks;
    }

    async function makePick(contestId, account) {
        const pick = await signPick(`pick ${account}`);
        await instance.submitPick(contestId, pick.hash, pick.v, pick.r, pick.s, {
            from: account
        });

        return {
            ...pick,
            account
        };
    }

    async function signPick(pick) {
        const hash = web3.sha3(pick);

        return signPickHash(hash);
    }

    async function signPickHash(hash) {
        const sig = await web3.eth.sign(accounts[0], hash);
        const r = sig.slice(0, 66);
        const s = `0x${sig.slice(66, 130)}`;
        const v = web3.toDecimal(`0x${sig.slice(130)}`) + 27;

        return {
            hash,
            v,
            r,
            s
        };
    }
});
