import utils from "./utils";
import ownedTests from "./ownedTests.js";

const BPZSmartToken = artifacts.require("./BPZSmartToken.sol");

contract("BPZSmartToken", (accounts) => {
    let bpz;

    beforeEach(async () => {
        bpz = await BPZSmartToken.new();
    });

    describe("fallback function", () => {
        it("should throw if an invalid function is called", async () => {
            const hash = web3.sha3("this function does not exist");
            const functionSignature = hash.slice(0, 6);

            const promise = bpz.sendTransaction({
                data: functionSignature
            });
            await utils.expectInvalidOpcode(promise);
        });

        it("should throw if the contract is directly sent ether", async () => {
            const promise = bpz.send(web3.toWei(1, "ether"));
            await utils.expectInvalidOpcode(promise);
        });
    });

    describe("ERC20 interface:", () => {
        describe("name()", () => {
            it("should return BlitzPredict as the token name", async () => {
                const name = await bpz.name();
                assert.equal(name, "BlitzPredict");
            });
        });

        describe("symbol()", () => {
            it("should return BPZ as the token symbol", async () => {
                const symbol = await bpz.symbol();
                assert.equal(symbol, "BPZ");
            });
        });

        describe("decimals()", () => {
            it("should return 18 decimals", async () => {
                const decimals = await bpz.decimals();
                assert.equal(decimals, 18);
            });
        });

        describe("totalSupply()", () => {
            it("should return 0 for the intial supply", async () => {
                const totalSupply = await bpz.totalSupply();
                assert.equal(totalSupply, 0);
            });
        });

        describe("balanceOf()", () => {
            it("should return 0 for the initial balance", async () => {
                const balance = await bpz.balanceOf(accounts[0]);
                assert.equal(balance, 0);
            });
        });

        describe("allowance()", () => {
            it("should return 0 for the initial allowance", async () => {
                const allowance = await bpz.allowance(accounts[0], accounts[1]);
                assert.equal(allowance, 0);
            });
        });

        describe("transfer()", () => {
            it("should throw if the target address is invalid", async () => {
                await bpz.issue(accounts[0], 100);

                const promise = bpz.transfer(0, 50);
                await utils.expectInvalidOpcode(promise);
            });

            it("should throw if the target address is the token contract", async () => {
                await bpz.issue(accounts[0], 100);

                const promise = bpz.transfer(bpz.address, 50);
                await utils.expectInvalidOpcode(promise);
            });

            it("should throw if there's not enough to transfer", async () => {
                await bpz.issue(accounts[0], 50);

                const promise = bpz.transfer(accounts[1], 100);
                await utils.expectInvalidOpcode(promise);
            });

            it("should perform the transfer if there's enough balance", async () => {
                await bpz.issue(accounts[0], 100);

                await bpz.transfer(accounts[1], 25);

                await expectTransferEvent(accounts[0], accounts[1], 25);

                assert.equal(await bpz.totalSupply(), 100);
                assert.equal(await bpz.balanceOf(accounts[0]), 75);
                assert.equal(await bpz.balanceOf(accounts[1]), 25);
            });
        });

        describe("transferFrom()", () => {
            it("should throw if the 'from' isn't a valid address", async () => {
                const promise = bpz.transferFrom(0, accounts[2], 50);
                await utils.expectInvalidOpcode(promise);
            });

            it("should throw if the 'to' isn't a valid address", async () => {
                await bpz.issue(accounts[0], 100);
                await bpz.approve(accounts[1], 75);

                const promise = bpz.transferFrom(accounts[0], 0, 50, {
                    from: accounts[1]
                });
                await utils.expectInvalidOpcode(promise);
            });

            it("should throw if the 'to' is the token contract", async () => {
                await bpz.issue(accounts[0], 100);
                await bpz.approve(accounts[1], 75);

                const promise = bpz.transferFrom(accounts[0], bpz.address, 50, {
                    from: accounts[1]
                });
                await utils.expectInvalidOpcode(promise);
            });

            it("should throw if there's not enough allowance", async () => {
                await bpz.issue(accounts[0], 100);
                await bpz.approve(accounts[1], 25);

                const promise = bpz.transferFrom(accounts[0], accounts[2], 50, {
                    from: accounts[1]
                });
                await utils.expectInvalidOpcode(promise);
            });

            it("should throw if the source account doesn't have enough balance", async () => {
                await bpz.issue(accounts[0], 25);
                await bpz.approve(accounts[1], 100);

                const promise = bpz.transferFrom(accounts[0], accounts[2], 50, {
                    from: accounts[1]
                });
                await utils.expectInvalidOpcode(promise);
            });

            it("should successfully transfer if there's enough balance and allowance", async () => {
                await bpz.issue(accounts[0], 100);
                await bpz.approve(accounts[1], 25);

                await bpz.transferFrom(accounts[0], accounts[2], 25, {
                    from: accounts[1]
                });

                await expectTransferEvent(accounts[0], accounts[2], 25);

                assert.equal(await bpz.totalSupply(), 100);
                assert.equal(await bpz.balanceOf(accounts[0]), 75);
                assert.equal(await bpz.balanceOf(accounts[1]), 0);
                assert.equal(await bpz.balanceOf(accounts[2]), 25);
            });
        });

        describe("approve()", () => {
            it("should throw if the 'spender' is an invalid address", async () => {
                const promise = bpz.approve(0, 100);
                await utils.expectInvalidOpcode(promise);
            });

            it("should throw if called twice with two non-zero values", async () => {
                await bpz.approve(accounts[1], 100);
                const promise = bpz.approve(accounts[1], 200);
                await utils.expectInvalidOpcode(promise);
            });

            it("should allow resetting the allowance", async () => {
                await bpz.approve(accounts[1], 100);
                assert.equal(await bpz.allowance(accounts[0], accounts[1]), 100);
                await expectApprovalEvent(accounts[0], accounts[1], 100);

                await bpz.approve(accounts[1], 0);
                assert.equal(await bpz.allowance(accounts[0], accounts[1]), 0);
                await expectApprovalEvent(accounts[0], accounts[1], 0);

                await bpz.approve(accounts[1], 200);
                assert.equal(await bpz.allowance(accounts[0], accounts[1]), 200);
                await expectApprovalEvent(accounts[0], accounts[1], 200);
            });
        });
    });

    describe("Bancor SmartToken interface:", () => {
        describe("transfersEnabled()", () => {
            it("should default to true", async () => {
                const transfersEnabled = await bpz.transfersEnabled();
                assert.isTrue(transfersEnabled);
            });
        });

        describe("NewSmartToken()", () => {
            it("should be logged when creating a new BPZSmartToken", async () => {
                const newToken = await BPZSmartToken.new();

                await expectNewSmartTokenEvent(newToken);
            });
        });

        describe("disableTransfers()", () => {
            it("should allow disabling", async () => {
                await bpz.disableTransfers(true);

                assert.isFalse(await bpz.transfersEnabled());
            });

            it("should allow enabling", async () => {
                await bpz.disableTransfers(true);
                await bpz.disableTransfers(false);

                assert.isTrue(await bpz.transfersEnabled());
            });
        });

        describe("issue()", () => {
            it("should throw if the 'to' address is invalid", async () => {
                const promise = bpz.issue(0, 100);
                await utils.expectInvalidOpcode(promise);
            });

            it("should throw if the 'to' address is the token", async () => {
                const promise = bpz.issue(bpz.address, 100);
                await utils.expectInvalidOpcode(promise);
            });

            it("should issue tokens", async () => {
                await bpz.issue(accounts[1], 100);

                await expectIssuanceEvent(100);
                await expectTransferEvent(bpz.address, accounts[1], 100, { logIndex: 1 });
                assert.equal(await bpz.balanceOf(accounts[1]), 100);
                assert.equal(await bpz.totalSupply(), 100);
            });
        });

        describe("destroy()", () => {
            it("should throw if trying to destroy someone else's tokens", async () => {
                await bpz.issue(accounts[2], 100);
                const promise = bpz.destroy(accounts[2], 50, {
                    from: accounts[1]
                });
                await utils.expectInvalidOpcode(promise);
            });

            it("should throw if trying to destroy more than the 'from' account's balance", async () => {
                await bpz.issue(accounts[0], 50);
                const promise = bpz.destroy(accounts[0], 100);
                await utils.expectInvalidOpcode(promise);
            });

            it("should allow the caller to destroy their own tokens", async () => {
                await bpz.issue(accounts[1], 100);
                await bpz.destroy(accounts[1], 100, {
                    from: accounts[1]
                });

                await expectTransferEvent(accounts[1], "0x0000000000000000000000000000000000000000", 100);
                await expectDestructionEvent(100, { logIndex: 1 });

                assert.equal(await bpz.balanceOf(accounts[1]), 0);
                assert.equal(await bpz.totalSupply(), 0);
            });

            it("should allow the token owner to destroy someone else's tokens", async () => {
                await bpz.issue(accounts[1], 100);
                await bpz.destroy(accounts[1], 100);

                await expectTransferEvent(accounts[1], "0x0000000000000000000000000000000000000000", 100);
                await expectDestructionEvent(100, { logIndex: 1 });

                assert.equal(await bpz.balanceOf(accounts[1]), 0);
                assert.equal(await bpz.totalSupply(), 0);
            });
        });

        describe("transfer()", () => {
            it("should throw if transfers are disabled", async () => {
                bpz.disableTransfers(true);
                await bpz.issue(accounts[0], 100);

                const promise = bpz.transfer(accounts[1], 25);
                await utils.expectInvalidOpcode(promise);
            });
        });

        describe("transferFrom()", () => {
            it("should throw if transfers are disabled", async () => {
                bpz.disableTransfers(true);
                await bpz.issue(accounts[0], 100);
                await bpz.approve(accounts[1], 75);

                const promise = bpz.transferFrom(accounts[0], accounts[2], 50, {
                    from: accounts[1]
                });
                await utils.expectInvalidOpcode(promise);
            });
        });
    });

    describe("Owned", () => {
        ownedTests.describeTests(() => bpz, accounts);
    });

    async function expectTransferEvent(from, to, value, filter = {}) {
        await utils.expectEvent(bpz, {
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
        await utils.expectEvent(bpz, {
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
        await utils.expectEvent(bpz, {
            event: "Issuance",
            logIndex: 0,
            args: {
                _amount: new web3.BigNumber(amount)
            },
            ...filter
        });
    }

    async function expectDestructionEvent(amount, filter = {}) {
        await utils.expectEvent(bpz, {
            event: "Destruction",
            logIndex: 0,
            args: {
                _amount: new web3.BigNumber(amount)
            },
            ...filter
        });
    }
});
