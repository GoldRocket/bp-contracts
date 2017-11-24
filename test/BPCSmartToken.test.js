import utils from "./utils";

const BPCSmartToken = artifacts.require("./BPCSmartToken.sol");

contract("BPCSmartToken", (accounts) => {
    let bpc;

    beforeEach(async () => {
        bpc = await BPCSmartToken.new();
    });

    describe("ERC20 interface", () => {
        beforeEach(async () => {
            // The ERC20 standard isn't aware of the possibility of disabled transfers
            await bpc.disableTransfers(false);
        });

        describe("name", () => {
            it("should return BlitzPredict as the token name", async () => {
                const name = await bpc.name();
                assert.equal(name, "BlitzPredict");
            });
        });

        describe("symbol", () => {
            it("should return BPZ as the token symbol", async () => {
                const symbol = await bpc.symbol();
                assert.equal(symbol, "BPZ");
            });
        });

        describe("decimals", () => {
            it("should return 18 decimals", async () => {
                const decimals = await bpc.decimals();
                assert.equal(decimals, 18);
            });
        });

        describe("totalSupply", () => {
            it("should return 0 for the intial supply", async () => {
                const totalSupply = await bpc.totalSupply();
                assert.equal(totalSupply, 0);
            });
        });

        describe("balanceOf", () => {
            it("should return 0 for the initial balance", async () => {
                const balance = await bpc.balanceOf(accounts[0]);
                assert.equal(balance, 0);
            });
        });

        describe("allowance", () => {
            it("should return 0 for the initial allowance", async () => {
                const allowance = await bpc.allowance(accounts[0], accounts[1]);
                assert.equal(allowance, 0);
            });
        });

        describe("transfer", () => {
            it("should throw if the target address is invalid", async () => {
                await bpc.issue(accounts[0], 100);

                const promise = bpc.transfer(0, 50);
                await utils.expectInvalidOpcode(promise);
            });

            it("should throw if the target address is the token contract", async () => {
                await bpc.issue(accounts[0], 100);

                const promise = bpc.transfer(bpc.address, 50);
                await utils.expectInvalidOpcode(promise);
            });

            it("should throw if there's not enough to transfer", async () => {
                await bpc.issue(accounts[0], 50);

                const promise = bpc.transfer(accounts[1], 100);
                await utils.expectInvalidOpcode(promise);
            });

            it("should perform the transfer if there's enough balance", async () => {
                await bpc.issue(accounts[0], 100);

                await bpc.transfer(accounts[1], 25);

                await expectTransferEvent(accounts[0], accounts[1], 25);

                assert.equal(await bpc.totalSupply(), 100);
                assert.equal(await bpc.balanceOf(accounts[0]), 75);
                assert.equal(await bpc.balanceOf(accounts[1]), 25);
            });
        });

        describe("transferFrom", () => {
            it("should throw if the 'from' isn't a valid address", async () => {
                const promise = bpc.transferFrom(0, accounts[2], 50);
                await utils.expectInvalidOpcode(promise);
            });

            it("should throw if the 'to' isn't a valid address", async () => {
                await bpc.issue(accounts[0], 100);
                await bpc.approve(accounts[1], 75);

                const promise = bpc.transferFrom(accounts[0], 0, 50, {
                    from: accounts[1]
                });
                await utils.expectInvalidOpcode(promise);
            });

            it("should throw if the 'to' is the token contract", async () => {
                await bpc.issue(accounts[0], 100);
                await bpc.approve(accounts[1], 75);

                const promise = bpc.transferFrom(accounts[0], bpc.address, 50, {
                    from: accounts[1]
                });
                await utils.expectInvalidOpcode(promise);
            });

            it("should throw if there's not enough allowance", async () => {
                await bpc.issue(accounts[0], 100);
                await bpc.approve(accounts[1], 25);

                const promise = bpc.transferFrom(accounts[0], accounts[2], 50, {
                    from: accounts[1]
                });
                await utils.expectInvalidOpcode(promise);
            });

            it("should throw if the source account doesn't have enough balance", async () => {
                await bpc.issue(accounts[0], 25);
                await bpc.approve(accounts[1], 100);

                const promise = bpc.transferFrom(accounts[0], accounts[2], 50, {
                    from: accounts[1]
                });
                await utils.expectInvalidOpcode(promise);
            });

            it("should successfully transfer if there's enough balance and allowance", async () => {
                await bpc.issue(accounts[0], 100);
                await bpc.approve(accounts[1], 25);

                await bpc.transferFrom(accounts[0], accounts[2], 25, {
                    from: accounts[1]
                });

                await expectTransferEvent(accounts[0], accounts[2], 25);

                assert.equal(await bpc.totalSupply(), 100);
                assert.equal(await bpc.balanceOf(accounts[0]), 75);
                assert.equal(await bpc.balanceOf(accounts[1]), 0);
                assert.equal(await bpc.balanceOf(accounts[2]), 25);
            });
        });

        describe("approve", () => {
            it("should throw if the 'spender' is an invalid address", async () => {
                const promise = bpc.approve(0, 100);
                await utils.expectInvalidOpcode(promise);
            });

            it("should throw if called twice with two non-zero values", async () => {
                await bpc.approve(accounts[1], 100);
                const promise = bpc.approve(accounts[1], 200);
                await utils.expectInvalidOpcode(promise);
            });

            it("should allow resetting the allowance", async () => {
                await bpc.approve(accounts[1], 100);
                assert.equal(await bpc.allowance(accounts[0], accounts[1]), 100);
                await expectApprovalEvent(accounts[0], accounts[1], 100);

                await bpc.approve(accounts[1], 0);
                assert.equal(await bpc.allowance(accounts[0], accounts[1]), 0);
                await expectApprovalEvent(accounts[0], accounts[1], 0);

                await bpc.approve(accounts[1], 200);
                assert.equal(await bpc.allowance(accounts[0], accounts[1]), 200);
                await expectApprovalEvent(accounts[0], accounts[1], 200);
            });
        });
    });

    describe("Bancor SmartToken interface", () => {
        describe("transfersEnabled", () => {
            it("should default to false", async () => {
                const transfersEnabled = await bpc.transfersEnabled();
                assert.isFalse(transfersEnabled);
            });
        });

        describe("NewSmartToken", () => {
            it("should be logged when creating a new BPCSmartToken", async () => {
                const newToken = await BPCSmartToken.new();

                await expectNewSmartTokenEvent(newToken);
            });
        });

        describe("disableTransfer", () => {
            it("should allow disabling", async () => {
                await bpc.disableTransfers(true);

                assert.isFalse(await bpc.transfersEnabled());
            });

            it("should allow enabling", async () => {
                await bpc.disableTransfers(true);
                await bpc.disableTransfers(false);

                assert.isTrue(await bpc.transfersEnabled());
            });
        });

        describe("issue", () => {
            it("should throw if the 'to' address is invalid", async () => {
                const promise = bpc.issue(0, 100);
                await utils.expectInvalidOpcode(promise);
            });

            it("should throw if the 'to' address is the token", async () => {
                const promise = bpc.issue(bpc.address, 100);
                await utils.expectInvalidOpcode(promise);
            });

            it("should issue tokens", async () => {
                await bpc.issue(accounts[1], 100);

                await expectIssuanceEvent(100);
                await expectTransferEvent(bpc.address, accounts[1], 100, { logIndex: 1 });
                assert.equal(await bpc.balanceOf(accounts[1]), 100);
                assert.equal(await bpc.totalSupply(), 100);
            });
        });

        describe("destroy", () => {
            it("should throw if trying to destroy someone else's tokens", async () => {
                await bpc.issue(accounts[2], 100);
                const promise = bpc.destroy(accounts[2], 50, {
                    from: accounts[1]
                });
                await utils.expectInvalidOpcode(promise);
            });

            it("should throw if trying to destroy more than the 'from' account's balance", async () => {
                await bpc.issue(accounts[0], 50);
                const promise = bpc.destroy(accounts[0], 100);
                await utils.expectInvalidOpcode(promise);
            });

            it("should allow the caller to destroy their own tokens", async () => {
                await bpc.issue(accounts[1], 100);
                await bpc.destroy(accounts[1], 100, {
                    from: accounts[1]
                });

                await expectTransferEvent(accounts[1], bpc.address, 100);
                await expectDestructionEvent(100, { logIndex: 1 });

                assert.equal(await bpc.balanceOf(accounts[1]), 0);
                assert.equal(await bpc.totalSupply(), 0);
            });

            it("should allow the token owner to destroy someone else's tokens", async () => {
                await bpc.issue(accounts[1], 100);
                await bpc.destroy(accounts[1], 100);

                await expectTransferEvent(accounts[1], bpc.address, 100);
                await expectDestructionEvent(100, { logIndex: 1 });

                assert.equal(await bpc.balanceOf(accounts[1]), 0);
                assert.equal(await bpc.totalSupply(), 0);
            });
        });

        describe("transfer", () => {
            it("should throw if transfers are disabled", async () => {
                await bpc.issue(accounts[0], 100);

                const promise = bpc.transfer(accounts[1], 25);
                await utils.expectInvalidOpcode(promise);
            });
        });

        describe("transferFrom", () => {
            it("should throw if transfers are disabled", async () => {
                await bpc.issue(accounts[0], 100);
                await bpc.approve(accounts[1], 75);

                const promise = bpc.transferFrom(accounts[0], accounts[2], 50, {
                    from: accounts[1]
                });
                await utils.expectInvalidOpcode(promise);
            });
        });
    });

    describe("Owned", () => {
        describe("owner", () => {
            it("should be the account that created the contract", async () => {
                const owner = await bpc.owner();
                assert.equal(owner, accounts[0]);
            });
        });

        describe("newOwner", () => {
            it("should default to the 0 address", async () => {
                const newOwner = await bpc.newOwner();
                assert.equal(newOwner, 0);
            });
        });

        describe("transferOwnership", () => {
            it("should throw if called by anyone but the owner", async () => {
                const promise = bpc.transferOwnership(accounts[2], {
                    from: accounts[1]
                });
                await utils.expectInvalidOpcode(promise);
            });

            it("should throw if trying to transfer ownership to the current owner", async () => {
                const promise = bpc.transferOwnership(accounts[0]);
                await utils.expectInvalidOpcode(promise);
            });

            it("should allow the owner to transfer ownership", async () => {
                await bpc.transferOwnership(accounts[1]);
                assert.equal(await bpc.owner(), accounts[0]);
                assert.equal(await bpc.newOwner(), accounts[1]);
            });
        });

        describe("acceptOwnership", () => {
            it("should throw if the caller is not the new owner", async () => {
                await bpc.transferOwnership(accounts[1]);

                const promise = bpc.acceptOwnership({
                    from: accounts[2]
                });
                await utils.expectInvalidOpcode(promise);
            });

            it("should transfer ownership to the new owner", async () => {
                await bpc.transferOwnership(accounts[1]);

                await bpc.acceptOwnership({
                    from: accounts[1]
                });

                await expectOwnerUpdateEvent(accounts[0], accounts[1]);
                assert.equal(await bpc.owner(), accounts[1]);
                assert.equal(await bpc.newOwner(), 0);
            });
        });
    });

    async function expectTransferEvent(from, to, value, filter = {}) {
        await utils.expectEvent(bpc, {
            event: "Transfer",
            logIndex: 0,
            args: {
                _from: from,
                _to: to,
                _value: new web3.BigNumber(value)
            },
            ...filter
        });
    }

    async function expectApprovalEvent(owner, spender, value, filter = {}) {
        await utils.expectEvent(bpc, {
            event: "Approval",
            logIndex: 0,
            args: {
                _owner: owner,
                _spender: spender,
                _value: new web3.BigNumber(value)
            },
            ...filter
        });
    }

    async function expectNewSmartTokenEvent(token, filter = {}) {
        await utils.expectEvent(token, {
            event: "NewSmartToken",
            logIndex: 0,
            args: {
                _token: token.address
            },
            ...filter
        });
    }

    async function expectIssuanceEvent(amount, filter = {}) {
        await utils.expectEvent(bpc, {
            event: "Issuance",
            logIndex: 0,
            args: {
                _amount: new web3.BigNumber(amount)
            },
            ...filter
        });
    }

    async function expectDestructionEvent(amount, filter = {}) {
        await utils.expectEvent(bpc, {
            event: "Destruction",
            logIndex: 0,
            args: {
                _amount: new web3.BigNumber(amount)
            },
            ...filter
        });
    }

    async function expectOwnerUpdateEvent(prevOwner, newOwner, filter = {}) {
        await utils.expectEvent(bpc, {
            event: "OwnerUpdate",
            logIndex: 0,
            args: {
                _prevOwner: prevOwner,
                _newOwner: newOwner
            },
            ...filter
        });
    }
});
