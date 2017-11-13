export default {
    expectInvalidOpcode
};

async function expectInvalidOpcode(promise) {
    try {
        await promise;
    } catch (error) {
        const invalidOpcode = error.message.search("invalid opcode") >= 0;
        assert(
            invalidOpcode,
            `Expected invalid opcode, got '${error}' instead`,
        );

        return;
    }

    assert.fail("Expected throw not received");
}
