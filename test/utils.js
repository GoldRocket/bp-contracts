import _ from "lodash";

export default {
    expectEvent,
    getEvents,

    expectInvalidOpcode
};

async function expectEvent(contract, filter) {
    const events = await this.getEvents(contract, filter.event);
    const event = _.find(events, filter);

    assert(!_.isNil(event), `Did not find matching event '${filter.event}'`);
}

function getEvents(contract, eventName) {
    return new Promise((resolve, reject) => {
        const event = contract[eventName]();
        event.watch();
        event.get((error, events) => {
            if (error) {
                return reject(error);
            }

            return resolve(events);
        });
        event.stopWatching();
    });
}

async function expectInvalidOpcode(promise) {
    let threw = false;

    try {
        await promise;
    } catch (error) {
        const invalidOpcode = error.message.search("invalid opcode") >= 0;
        assert(
            invalidOpcode,
            `Expected invalid opcode, got '${error}' instead`,
        );

        threw = true;
    }

    assert(threw, "Expected throw not received");
}
