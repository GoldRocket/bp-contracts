import utils from "./utils";

const TournamentManager = artifacts.require("./TournamentManager.sol");

contract("TournamentManager", (accounts) => {
    let instance;

    beforeEach(async () => {
        instance = await TournamentManager.new();
    });

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

    it("should start with no contests", async () => {
        const numContests = await instance.getNumContests();

        assert.equal(numContests, 0, "There should be no contests");
    });

    it("should throw when attempting to get a contest by invalid index", async () => {
        const promise = instance.getContestId(0);
        await utils.expectInvalidOpcode(promise);
    });

    it("should throw when attempting to get num entries for an invalid contest id", async () => {
        const contestId = web3.sha3("unknown");
        const promise = instance.getNumContestEntries(contestId);
        await utils.expectInvalidOpcode(promise);
    });

    it("should support publishing new contests", async () => {
        const contest1 = web3.sha3("contest1");
        await instance.publishContest(contest1);

        let numContests = await instance.getNumContests();
        assert.equal(numContests, 1, "There should be one contest");

        const contest2 = web3.sha3("contest2");
        await instance.publishContest(contest2);

        numContests = await instance.getNumContests();
        assert.equal(numContests, 2, "There should be two contests");
    });

    it("should contain zero entries for a new contests", async () => {
        const contestId = web3.sha3("new contest");
        await instance.publishContest(contestId);

        const numEntries = await instance.getNumContestEntries(contestId);
        assert.equal(numEntries, 0, "There should be no entries");
    });

    it("should not allow publishing a contest from a non-owner account", async () => {
        const contestId = web3.sha3("contest");
        const promise = instance.publishContest(contestId, {
            from: accounts[1]
        });

        await utils.expectInvalidOpcode(promise);
    });

    it("should not allow publishing the same contest twice", async () => {
        const contestId = web3.sha3("contest");
        await instance.publishContest(contestId);

        const promise = instance.publishContest(contestId);
        await utils.expectInvalidOpcode(promise);
    });

    it("should allow getting the ids of all contests", async () => {
        const contest1 = web3.sha3("contest 1");
        await instance.publishContest(contest1);

        const contest2 = web3.sha3("contest 2");
        await instance.publishContest(contest2);

        const numContests = await instance.getNumContests();
        assert.equal(numContests, 2, "There should be two contests");

        const id1 = await instance.getContestId(0);
        assert.equal(id1, contest1, "First contest id should match");

        const id2 = await instance.getContestId(1);
        assert.equal(id2, contest2, "Second contest id should match");

        const promise = instance.getContestId(2);
        await utils.expectInvalidOpcode(promise);
    });

    it("should allow adding picks", async () => {
        const contestId = web3.sha3("new contest");
        await instance.publishContest(contestId);

        const pick1 = await signPick("my pick1");
        await instance.submitPick(contestId, pick1.hash, pick1.v, pick1.r, pick1.s, {
            from: accounts[1]
        });

        let numEntries = await instance.getNumContestEntries(contestId);
        assert.equal(numEntries, 1, "There should be one pick");

        const pick2 = await signPick("my pick2");
        await instance.submitPick(contestId, pick2.hash, pick2.v, pick2.r, pick2.s, {
            from: accounts[2]
        });

        numEntries = await instance.getNumContestEntries(contestId);
        assert.equal(numEntries, 2, "There should be two picks");
    });

    it("should not allow adding more than one pick for a single user", async () => {
        const contestId = web3.sha3("new contest");
        await instance.publishContest(contestId);

        const pick1 = await signPick("my pick1");
        await instance.submitPick(contestId, pick1.hash, pick1.v, pick1.r, pick1.s, {
            from: accounts[1]
        });

        let numEntries = await instance.getNumContestEntries(contestId);
        assert.equal(numEntries, 1, "There should be one pick");

        const pick2 = await signPick("my pick2");
        const promise = instance.submitPick(contestId, pick2.hash, pick2.v, pick2.r, pick2.s, {
            from: accounts[1]
        });

        await utils.expectInvalidOpcode(promise);

        numEntries = await instance.getNumContestEntries(contestId);
        assert.equal(numEntries, 1, "There should be one pick");
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

        const pick = await signPickHash("0x0000000000000000000000000000000000000000000000000000000000000000");
        const promise = instance.submitPick(contestId, pick.hash, pick.v, pick.r, pick.s, {
            from: accounts[1]
        });

        await utils.expectInvalidOpcode(promise);
    });

    it("should allow retrieving all entries in a contest", async () => {
        const contestId = web3.sha3("new contest");
        await instance.publishContest(contestId);

        const pick1 = await signPick("my pick1");
        await instance.submitPick(contestId, pick1.hash, pick1.v, pick1.r, pick1.s, {
            from: accounts[1]
        });

        const pick2 = await signPick("my pick2");
        await instance.submitPick(contestId, pick2.hash, pick2.v, pick2.r, pick2.s, {
            from: accounts[2]
        });

        const entry1 = await instance.getContestEntry(contestId, 0);
        assert.equal(entry1[0], accounts[1]);
        assert.equal(entry1[1], pick1.hash);
        const entryPick1 = await instance.getContestEntryForEntrant(contestId, accounts[1]);
        assert.equal(entryPick1, pick1.hash);

        const entry2 = await instance.getContestEntry(contestId, 1);
        assert.equal(entry2[0], accounts[2]);
        assert.equal(entry2[1], pick2.hash);
        const entryPick2 = await instance.getContestEntryForEntrant(contestId, accounts[2]);
        assert.equal(entryPick2, pick2.hash);

        const promise = instance.getContestEntry(contestId, 2);
        await utils.expectInvalidOpcode(promise);
    });
});
