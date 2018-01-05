import utils from "./utils";

export default {
    describeTests
};

function describeTests(ownedFactory, accounts) {
    let owned;

    beforeEach(() => {
        owned = ownedFactory();
    });

    describe("owner()", () => {
        it("should be the account that created the contract", async () => {
            const owner = await owned.owner();
            assert.equal(owner, accounts[0]);
        });
    });

    describe("newOwner()", () => {
        it("should default to the 0 address", async () => {
            const newOwner = await owned.newOwner();
            assert.equal(newOwner, 0);
        });
    });

    describe("transferOwnership()", () => {
        it("should throw if called by anyone but the owner", async () => {
            const promise = owned.transferOwnership(accounts[2], {
                from: accounts[1]
            });
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if trying to transfer ownership to the current owner", async () => {
            const promise = owned.transferOwnership(accounts[0]);
            await utils.expectInvalidOpcode(promise);
        });

        it("should allow the owner to transfer ownership", async () => {
            await owned.transferOwnership(accounts[1]);
            assert.equal(await owned.owner(), accounts[0]);
            assert.equal(await owned.newOwner(), accounts[1]);
        });
    });

    describe("acceptOwnership()", () => {
        it("should throw if the caller is not the new owner", async () => {
            await owned.transferOwnership(accounts[1]);

            const promise = owned.acceptOwnership({
                from: accounts[2]
            });
            await utils.expectInvalidOpcode(promise);
        });

        it("should transfer ownership to the new owner", async () => {
            await owned.transferOwnership(accounts[1]);

            await owned.acceptOwnership({
                from: accounts[1]
            });

            await expectOwnerUpdateEvent(accounts[0], accounts[1]);
            assert.equal(await owned.owner(), accounts[1]);
            assert.equal(await owned.newOwner(), 0);
        });
    });

    async function expectOwnerUpdateEvent(prevOwner, newOwner, filter = {}) {
        await utils.expectEvent(owned, {
            event: "OwnerUpdate",
            logIndex: 0,
            args: {
                _prevOwner: prevOwner,
                _newOwner: newOwner
            },
            ...filter
        });
    }
}
